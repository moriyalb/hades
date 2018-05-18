import os
import re
import codecs
import simplejson as json
import copy
import hashlib
import utils

BASIC_TYPES = [
	"blob",
	"int",
	"uint",
	"float",
	"string",
	"mailbox",
	"small",
	"usmall",
	"tiny",
	"utiny",
	"udo"
]

BASIC_TYPES_CONVERT = {
	"small" : int,
	"usmall" : int,
	"tiny" : int,
	"utiny" : int,
	"blob" : str,
	"int" : int,
	"uint" : int,
	"float" : float,
	"string" : str
}

KEY_TYPES = ["int", "uint", "string", "small", "usmall", "tiny", "utiny"]

CTYPE_TAG = ["basic", "array", "enum", "object", "map"]

TMP_NAME_MAP = {}
TMP_NAME_INDEX = 1
TYPE_INDEX = 1

def addDoneType(cfg, name, dt):
	global TYPE_INDEX
	dt['id'] = TYPE_INDEX
	cfg['done_types'][name] = dt
	cfg['done_types_id'][TYPE_INDEX] = name
	TYPE_INDEX += 1	

def handleTmp(cfg, vtype):
	tname = str(vtype)
	if tname in TMP_NAME_MAP:
		return TMP_NAME_MAP[tname]

	if type(vtype) is str:
		if vtype in BASIC_TYPES or vtype in cfg['types']:
			return vtype
	elif type(vtype) is not dict:
		print("Invalid Type !!! ", vtype)
		return
	
	global TMP_NAME_INDEX
	TMP_NAME_MAP[tname] = "tt%d"%(TMP_NAME_INDEX)
	TMP_NAME_INDEX += 1
	cfg['types'][TMP_NAME_MAP[tname]] = vtype
	return TMP_NAME_MAP[tname]
		
def readBasic(cfg, k, sections):
	basicCfg = {
		"ctype": "basic",
        "type": sections[0]
	}
	i = 1
	while i < len(sections):
		if sections[i] == "size":
			if sections[0] != "string":
				print("Invalid basic size settings with type -> ", sections)
				return
			basicCfg['size'] = int(sections[i+1])
			i += 2
		elif sections[i] == "index":
			basicCfg['index'] = 1
			i += 1
		elif sections[i] == "unique":
			basicCfg['unique'] = 1
			i += 1
		elif sections[i] == "default":
			basicCfg['default'] = BASIC_TYPES_CONVERT[sections[0]](sections[i+1])
			i += 2
		else:
			print("ignore tag -> ", sections[i], "in ", k, " ".join(sections))
			i += 1
	
	addDoneType(cfg, k, basicCfg)

def readAlias(cfg, k, sections):
	if not sections[0] in cfg['done_types']:
		readType(cfg, sections[0]) #recursive fetch type

	#aliasCfg = copy.deepcopy(cfg['done_types'][sections[0]]) -- need to modify ?
	if len(sections) > 1:
		print("Invalid simple alias type, no setting support -> ", k)
		return	

	cfg['done_types'][k] = cfg['done_types'][sections[0]]	#keep id

def readArray(cfg, k, v):
	typename = handleTmp(cfg, v['type'])
	if not typename in BASIC_TYPES:
		if not typename in cfg['types']:
			print("readArray :: You can'nt go here!")
			return
		elif not typename in cfg['done_types']:
			readType(cfg, typename) #recursive fetch type
		
	if typename in cfg['done_types'] and cfg['done_types'][typename]['ctype'] == 'basic':		
		bs = cfg['done_types'][typename]
		arrayCfg = {
			"ctype": "array",
			"type": bs['type']			
		}
		if 'default' in bs:
			arrayCfg['default'] = bs['default']
		if 'size' in bs:
			arrayCfg['size'] = bs['size']
	else:
		arrayCfg = {
			"ctype": "array",
			"type": typename
		}
	if 'default' in v: #override the item default setting
		if not arrayCfg['type'] in BASIC_TYPES:
			print("Cannot set default value of -> ", sections)
			return
		arrayCfg['default'] = BASIC_TYPES_CONVERT[arrayCfg['type']](v['default'])
	if 'ordered' in v:
		arrayCfg['ordered'] = 1
	if 'size' in v:
		arrayCfg['size'] = int(v['size'])
	if 'unqiue' in v:
		arrayCfg['unqiue'] = 1
	if 'index' in v and v['index']:
		if not arrayCfg['type'] in BASIC_TYPES:
			print("Cannot set index of -> ", sections)
			arrayCfg['index'] = 0
		else:
			arrayCfg['index'] = 1
	else:
		v['index'] = 0
	addDoneType(cfg, k, arrayCfg)

def readFastArray(cfg, k, sections):
	if sections[1] != "of" :
		print("Invalid Fast Array(need array of [type] [size x] [default x] [ordered] [unique]) -> ", sections)
		return

	arrayCfg = {
		"ctype" : "array",
		"type" : sections[2]
	}
	i = 3
	while i < len(sections):
		if sections[i] == "size":
			arrayCfg['size'] = sections[i+1]
			i += 2
		elif sections[i] == "default":			
			arrayCfg['default'] = sections[i+1]
			i += 2
		elif sections[i] == "ordered":
			arrayCfg['ordered'] = 1
			i += 1
		elif sections[i] == "unqiue":
			arrayCfg['unqiue'] = 1
			i += 1
		elif sections[i] == "index":
			arrayCfg['index'] = 1
			i += 1

	readArray(cfg, k, arrayCfg)

def readMap(cfg, k, v):	
	typename = handleTmp(cfg, v['keyType'])
	if not typename in handleTmp(cfg, v['keyType']):
		readType(cfg, typename)
	if not typename in BASIC_TYPES:
		if not cfg['done_types'][typename]['type'] in KEY_TYPES:
			print("Map key type must be in ", KEY_TYPES, " failed read ", k, )
			return
	elif not typename in KEY_TYPES:
		print("Map key type must be in ", KEY_TYPES, " failed read ", k, )
		return

	typename = handleTmp(cfg, v['valueType'])
	if not typename in BASIC_TYPES:
		if not typename in cfg['types']:
			print("readMap :: You can'nt go here!")
			return
		if not typename in cfg['done_types']:
			readType(cfg, typename) #recursive fetch type
		
	if typename in cfg['done_types'] and cfg['done_types'][typename]['ctype'] == 'basic':		
		mapCfg = {
			"ctype" : "map",
			"keyType" : v['keyType'],
			"valueType" : v['valueType']
		}
		if 'default' in v:
			mapCfg['default'] = v['default']
		if 'size' in v:
			mapCfg['size'] = v['size']
		if 'index' in v:
			mapCfg['index'] = v['index']
		if 'unique' in v:
			mapCfg['unique'] = v['unique']
	else:
		mapCfg = {
			"ctype" : "map",
			"keyType" : v['keyType'],
			"valueType" : typename
		}
		if 'index' in v:
			print("Failed set index on map type -> ", v)
	
	addDoneType(cfg, k, mapCfg)

def readFastMap(cfg, k, sections):
	if len(sections) != 5 or sections[1] != "of" or sections[3] != "to" :
		print("Invalid Fast Map(need map of [key] to [value]) -> ", sections)
		return
	mapCfg = {
		"ctype" : "map",
		"keyType" : sections[2],
		"valueType" : sections[4],
	}
	readMap(cfg, k, mapCfg)

def readEnum(cfg, k, v):
	isBit = False
	if 'extends' in v:
		if v['extends'] not in cfg['types']:
			print("Invalid enum extends type")
			return
		if v['extends'] not in cfg['done_types']:
			readType(cfg, v['extends']) #recursive fetch type
		enumCfg = {
			"ctype" : "enum",
			"fields" : copy.deepcopy(cfg['done_types'][v['extends']]['fields'])
		}
	else:
		if 'bit' in v and v['bit']:
			isBit = True
		enumCfg = {
			"ctype" : "enum",
			"fields" :{}
		}
	if 'index' in v:
		enumCfg['index'] = v['index']
	
	offset = ( len(enumCfg['fields']) >> 1 )+ 1
	for f in v['fields']:
		enumCfg['fields'][f] = offset
		enumCfg['fields'][offset] = f
		if isBit:
			offset <<= 1
		else:
			offset += 1
	addDoneType(cfg, k, enumCfg)

def readObject(cfg, k, v):
	objCfg = {
		"ctype":"object",
		"fields":{}
	}
	if 'indexs' in v:
		objCfg['indexs'] = v['indexs']
	for key in utils.getObjSortedKeys(v['fields']):
		ktype = v['fields'][key]
		typename = handleTmp(cfg, ktype)
		if not typename in BASIC_TYPES:
			if not typename in cfg['types']:
				print("readObject :: You can'nt go here!")
				return
			elif not typename in cfg['done_types']:
				readType(cfg, typename) #recursive fetch type
		objCfg['fields'][key] = typename
	addDoneType(cfg, k, objCfg)
	
def readType(cfg, k):
	v = cfg['types'][k]
	if type(v) is str:
		v = re.sub(" +", " ", v.strip())
		sections = v.split(" ")
		if len(sections) == 0:
			print("Invalid type -> ", v)
			return
		if sections[0] in BASIC_TYPES:
			readBasic(cfg, k, sections)
		elif sections[0] == "array":			
			readFastArray(cfg, k, sections)
		elif sections[0] == "map":
			readFastMap(cfg, k, sections)
		elif sections[0] in cfg['types']:
			readAlias(cfg, k, sections)
		else:
			tv = list(TMP_NAME_MAP.items())
			basic = [t[1] for t in tv].index(k)
			if basic >= 0 :
				print("Invalid alias type -> ", tv[basic][0])
			else:
				print("Invalid type -> ", k)

	elif type(v) is dict:
		if v['ctype'] == "array":
			readArray(cfg, k, v)
		elif v['ctype'] == "map":
			readMap(cfg, k, v)
		elif v['ctype'] == "enum":
			readEnum(cfg, k, v)
		elif v['ctype'] == "object":
			readObject(cfg, k, v)
		else:
			print("Invalid complex type ", k)

def analysesType(cfg):
	keys = utils.getObjSortedKeys(cfg['types'])
	for k in keys:
		v = cfg['types'][k]
		if k in cfg['done_types']:
			continue		
		readType(cfg, k)

	#print("analysesType ----------------------------------------------->")
	#pprint(cfg['done_types'])
	#print("analysesType ----------------------------------------------->")
	#tmpname = set(TMP_NAME_MAP.values())
	#print("analysesType ID ----------------------------------------------->")
	#pprint(cfg['done_types_id'])
	#print("analysesType ID ----------------------------------------------->")

def analysesServer(cfg):
	keys = utils.getObjSortedKeys(cfg['entities'])
	for ename in keys:
		ecfg = cfg['entities'][ename]
		if ecfg['Abstract']:continue

		sname = ecfg['Server']	
		if sname == "bf_proxy":
			cfg['done_proxies']['LoginProxy'] = ename
			cfg['done_proxies']['LoginProxyServer'] = sname
		elif sname == "bb_proxy":
			cfg['done_proxies']['ClientProxy'] = ename
			cfg['done_proxies']['ClientProxyServer'] = sname		

REQ_METHOD_INDEX = 1
PUSH_METHOD_INDEX = 1
def getArg(cfg, arg):
	result = []
	keys = utils.getObjSortedKeys(arg)
	for argname in keys:
		if argname.startswith("_"):
			print("Invalid Arg -> ", argname)
			continue
		
		argtype = arg[argname]
		tp = None
		canNil = False
		desc = "no-desc"
		if type(argtype) is list:
			if len(argtype) == 2:
				tp, desc = argtype[0], argtype[1]
			elif len(argtype) == 3:
				tp, desc, canNil = argtype[0], argtype[1], argtype[2]
			else:
				print("Invalid Arg Config -> ", arg)
		else:
			tp = argtype

		if tp not in cfg["done_types"]:
			#load new type
			typename = handleTmp(cfg, tp)		
			if not typename in BASIC_TYPES:
				if not typename in cfg['done_types']:
					readType(cfg, typename) #recursive fetch type
			tp = typename
		
		result.append([cfg['done_types'][tp]['id'], argname, desc, canNil])
	return result

def analysesEntity(cfg, ename):
	global REQ_METHOD_INDEX
	global PUSH_METHOD_INDEX
	ecfg = cfg['entities'][ename]
	cfg['done_entities'][ename] = {
		"handlers":[],
		"pushes":[],
		"remotes":[],
		"properties":{},
		# "impProperties":{},
		# "impHandlers":{},
		# "impRemotes":{},
		# "impPushes":{},			
		"implements":ecfg['Implements'],
		"path":ecfg['path'].replace("\\","/"),
		"abstract":ecfg['Abstract'],
		"etype":-1,
		"server":ecfg['Server'] if 'Server' in ecfg else ''
	}

	if 'Type' in ecfg:
		if ecfg['Type'] == 'single':
			cfg['done_entities'][ename]['etype'] = 1
		elif ecfg['Type'] == 'proxy':
			cfg['done_entities'][ename]['etype'] = 0
		elif ecfg['Type'] == 'simple':
			cfg['done_entities'][ename]['etype'] = 2
		else:
			print("Invalid Config to Entity Type -> ", ename, ecfg['Type'])
	
	decfg = cfg['done_entities'][ename]
	for imp, prior in ecfg['Implements'].items():
		if imp not in cfg['entities']:
			print("Invalid implements entity -> ", imp)
			continue
		if imp not in cfg['done_entities']:
			analysesEntity(cfg, imp)
		imecfg = cfg['done_entities'][imp]
		#decfg['impProperties'][imp] = list(imecfg['properties'].keys())
		#decfg['impProperties'].update(imecfg['impProperties'])
		#decfg['impHandlers'][imp] = imecfg['handlers']
		#decfg['impHandlers'].update(imecfg['impHandlers'])
		#decfg['impPushes'][imp] = imecfg['pushes']
		#decfg['impPushes'].update(imecfg['impPushes'])
		#decfg['impRemotes'][imp] = imecfg['remotes']
		#decfg['impRemotes'].update(imecfg['impRemotes'])
		imecfg['etype'] = decfg['etype']
		imecfg['server'] = decfg['server']

	if "Handlers" in ecfg:
		keys = utils.getObjSortedKeys(ecfg['Handlers'])
		h = cfg['done_methods']['handler']
		for mname in keys:
			if mname.startswith("_"):
				print("Invalid Methods -> ", mname)
				continue
				
			mcfg = ecfg['Handlers'][mname]
			h[mname] = {
				"id" : REQ_METHOD_INDEX,
				"req" : getArg(cfg, mcfg['req'])
			}
			if 'unbinded' in mcfg:
				h[mname]['unbinded'] = mcfg['unbinded']
			if 'resp' in mcfg:
				h[mname]['resp'] = getArg(cfg, mcfg['resp'])
			if 'resend' in mcfg:
				h[mname]['resend'] = mcfg['resend']
			else:
				h[mname]['resend'] = 0

			cfg['done_entities'][ename]['handlers'].append(mname)
			cfg['done_methods']['handlerIds'][REQ_METHOD_INDEX] = [ename, mname]
			REQ_METHOD_INDEX += 1

	if "Pushes" in ecfg:
		keys = utils.getObjSortedKeys(ecfg['Pushes'])
		h = cfg['done_methods']['push']
		for mname in keys:
			if mname.startswith("_"):
				print("Invalid Methods -> ", mname)
				continue
			mcfg = ecfg['Pushes'][mname]
			h[mname] = {
				"id" : PUSH_METHOD_INDEX,
				"req" : getArg(cfg, mcfg['req'])
			}
			cfg['done_entities'][ename]['pushes'].append(mname)
			cfg['done_methods']['pushIds'][PUSH_METHOD_INDEX] = [ename, mname]
			PUSH_METHOD_INDEX += 1

	if "Remotes" in ecfg:
		keys = utils.getObjSortedKeys(ecfg['Remotes'])
		h = cfg['done_methods']['remote']
		for mname in keys:
			if mname.startswith("_"):
				print("Invalid Methods -> ", mname)
				continue
			mcfg = ecfg['Remotes'][mname]
			h[mname] = {
				"req" : getArg(cfg, mcfg['req']),				
			}
			if 'resp' in mcfg:
				h[mname]['resp'] = getArg(cfg, mcfg['resp'])
			cfg['done_entities'][ename]['remotes'].append(mname)

	if "Properties" in ecfg:
		keys = utils.getObjSortedKeys(ecfg['Properties'])
		h = cfg['done_entities'][ename]['properties']
		for pname in keys:
			if pname.startswith("_"):
				print("Invalid Property -> ", pname)
				continue
			if pname.lower() == ename.lower()+"id":
				print("Critical Error -> property can not be set as ", pname)
				exit(1)
			elif "_" in pname:
				print("Critical Error -> property can not be set as ", pname)
				exit(1)
			pcfg = ecfg['Properties'][pname]
			tp = pcfg['type']
			if type(tp) is "str":
				if tp not in cfg["done_types"]:
					#load new type
					typename = handleTmp(cfg, tp)
					if not typename in BASIC_TYPES:
						if not typename in cfg['done_types']:
							readType(cfg, typename) #recursive fetch type
					tp = typename
			else:
				#load new type
				typename = handleTmp(cfg, tp)
				if not typename in BASIC_TYPES:
					if not typename in cfg['done_types']:
						readType(cfg, typename) #recursive fetch type
				tp = typename

			h[pname] = {
				"type":cfg["done_types"][tp]['id'],
				"persistent":pcfg['persistent'] if 'persistent' in pcfg else True,
				#"autoSyncClient":pcfg['autoSyncClient'] if 'autoSyncClient' in pcfg else False,
				#"flag":pcfg['flag'] if 'flag' in pcfg else "all",
				"index":pcfg['index'] > 0 if 'index' in pcfg else False,
				"unique":pcfg['unique'] > 0 if 'unique' in pcfg else False,				
			}

			if 'default' in pcfg:
				h[pname]["default"]  = pcfg['default']

			if h[pname]['index']:
				if cfg["done_types"][tp]['ctype'] != 'basic' and cfg["done_types"][tp]['ctype'] != 'enum':
					print("Invalid Index Settings, only simple type can be set into index !", tp)
					h[pname]['index'] = False

def analysesEntities(cfg):
	keys = utils.getObjSortedKeys(cfg['entities'])
	for ename in keys:
		analysesEntity(cfg, ename)		
	#pprint.pprint(cfg['done_methods'])
	#pprint.pprint(cfg['done_entities'])

def setEntityDefault(ecf):
	if 'Abstract' not in ecf or not ecf['Abstract']:
		ecf['Abstract'] = False
		if 'Server' not in ecf:
			print("Error! Invalid entity define -> no `Server` config")
			exit(1)
		if 'Type' not in ecf:
			print("Error! Invalid entity define -> no `Type` config")
			exit(1)
	else:
		ecf['Abstract'] = True

	if 'Handlers' not in ecf:
		ecf['Handler'] = {}
	if 'Remotes' not in ecf:
		ecf['Remotes'] = {}
	if 'Pushes' not in ecf:
		ecf['Pushes'] = {}
	if 'Properties' not in ecf:
		ecf['Properties'] = {}
	if 'Implements' not in ecf:
		ecf['Implements'] = {}

def addMd5Type(cfg, types, tname):
	if tname in types: return
	types.add(tname)	
	if not tname in cfg['done_types']:
		print("Invalid Type !!!! ", tname)
		return
	rt = cfg['done_types'][tname]
	if rt['ctype'] == 'array':
		addMd5Type(cfg, types, rt['type'])
	elif rt['ctype'] == 'object':
		for ot in rt['fields'].values():
			addMd5Type(cfg, types, ot)
	elif rt['ctype'] == 'enum':
		pass
	elif rt['ctype'] == 'map':
		addMd5Type(cfg, types, rt['keyType'])
		addMd5Type(cfg, types, rt['valueType'])
	elif rt['ctype'] == 'basic':
		pass

class Md5Check():
	def __init__(self):
		self.values = []

	def update(self, v):
		self.values.append(v)

def generateMd5(cfg):
	md5 = hashlib.md5()
	#md5 = Md5Check()

	types = set()
	for h in sorted(list(cfg['done_methods']['handler'].keys())):
		handler = cfg['done_methods']['handler'][h]
		md5.update(str(handler['id']).encode('utf-8'))
		md5.update(str(handler['req']).encode('utf-8'))
		if 'resp' in handler:
			md5.update(str(handler['resp']).encode('utf-8'))

		for req in handler['req']:
			addMd5Type(cfg, types, cfg['done_types_id'][req[0]])
		if 'resp' in handler:
			for req in handler['resp']:
				addMd5Type(cfg, types, cfg['done_types_id'][req[0]])
	for h in sorted(list(cfg['done_methods']['push'].keys())):
		handler = cfg['done_methods']['push'][h]
		md5.update(str(handler['id']).encode('utf-8'))
		md5.update(str(handler['req']).encode('utf-8'))
		for req in handler['req']:
			addMd5Type(cfg, types, cfg['done_types_id'][req[0]])

	for tname in sorted(list(types)):
		rt = cfg['done_types'][tname]
		if rt['ctype'] == 'array':
			md5.update(tname.encode('utf-8'))
			md5.update(rt['type'].encode('utf-8'))
		elif rt['ctype'] == 'object':
			for kt in sorted(list([str(i) for i in rt['fields'].keys()])):
				md5.update(kt.encode('utf-8'))
		elif rt['ctype'] == 'enum':
			for kt in sorted(list([str(i) for i in rt['fields'].keys()])):
				md5.update(kt.encode('utf-8'))
		elif rt['ctype'] == 'map':
			md5.update(str(tname).encode('utf-8'))
			md5.update(rt['keyType'].encode('utf-8'))
			md5.update(rt['valueType'].encode('utf-8'))
		elif rt['ctype'] == 'basic':
			pass

	return md5.hexdigest()
	#return md5.values

def load(defPath):
	print("schema start load -> ", defPath)
	cfg = {
		"types" : dict(zip(BASIC_TYPES,BASIC_TYPES)),
		"entities" : {},
		"done_entities":{},
		"done_methods" : {
			"handler":{},
			"push":{},
			"remote":{},
			"handlerIds":{},
			"pushIds":{}
		},
		"done_types" : {},
		"done_types_id":{},		
		"done_proxies":{},
		"uuid":{"uuid":""}
	}

	if os.path.exists(defPath + "/__Alias.def"):
		with codecs.open(defPath + "/__Alias.def", "r", "utf-8") as f:
			content = f.read()
			cfg['types'].update(json.loads(content))			

	for root, dirs, files in os.walk(defPath):
		for entity in files:			
			if entity.startswith("__"):
				continue			
			rlpath = root.replace(defPath, "")
			if rlpath.startswith("\\"):
				rlpath = rlpath[1:]
			with codecs.open(root+"/"+entity, "r", "utf-8") as f:
				content = f.read()
				edef = json.loads(content)
				if "Alias" in edef:
					cfg['types'].update(edef['Alias'])
				setEntityDefault(edef)
				edef['path'] = rlpath
				cfg['entities'][entity[:-4]] = edef

	
	#print("analysesType ->")
	analysesType(cfg)
	#print("analysesEntities ->")
	analysesEntities(cfg)
	#print("analysesServer ->")
	analysesServer(cfg)	

	cfg["uuid"]["uuid"] = generateMd5(cfg)	
	return cfg


def write(cfg, scfgPath):
	utils.make_sure_path(scfgPath)
	
	#print("   ----> Write %s/Types.json "%(scfgPath))
	with codecs.open(scfgPath + "/Types.json", "w", "utf-8") as f:
		f.write(json.dumps({
				"types":cfg["done_types"],
				"id2types":cfg["done_types_id"]
			}, sort_keys=True, indent=4))

	#print("   ----> Write %s/Methods.json "%(scfgPath))
	with codecs.open(scfgPath + "/Methods.json", "w", "utf-8") as f:
		f.write(json.dumps(cfg["done_methods"], sort_keys=True, indent=4))

	#print("   ----> Write %s/Entities.json "%(scfgPath))
	with codecs.open(scfgPath + "/Entities.json", "w", "utf-8") as f:
		#pprint(cfg["done_entities"])
		f.write(json.dumps(cfg["done_entities"], sort_keys=True, indent=4))

	#print("   ----> Write %s/ProxyDefine.json "%(scfgPath))
	with codecs.open(scfgPath + "/ProxyDefine.json", "w", "utf-8") as f:
		f.write(json.dumps(cfg["done_proxies"], indent=4))

	#print("   ----> Write %s/HadesUUID.json "%(scfgPath))
	with codecs.open(scfgPath + "/HadesUUID.json", "w", "utf-8") as f:
		f.write(json.dumps(cfg["uuid"], sort_keys=True, indent=4))