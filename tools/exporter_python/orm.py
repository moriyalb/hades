import os, sys
import simplejson as json
import copy
import utils
import codecs


INDEX_NONE = 0
INDEX_UNIQUE = 1
INDEX_INDEX = 2
INDEX_FULL_INDEX = 3
#INDEX_PRIMARY = 4

TABLE_BASE = 1
TABLE_ARRAY = 2
TABLE_MAP = 3

SUB_NAME_SA = "$sa"
SUB_NAME_SMI = "$smi"
SUB_NAME_SMS = "$sms"

def _toEntityName(name):
	return name[0].lower() + name[1:]

def _nameWithSuffix(ename, name, suffix = 0):
	if ename != "":
		if name != "":
			name = ename+"_"+name
		else:
			name = ename	
	if not suffix:return name
	return name + "_" + str(suffix)

def _isBasic(cfg, ptype):
	tp = cfg['done_types'][ptype]
	return tp['ctype'] == 'basic' or tp['ctype'] == 'enum'

def _getBasicType(cfg, ptype):
	tp = cfg['done_types'][ptype]
	if tp['ctype'] == 'basic':
		return tp['type']
	elif tp['ctype'] == 'enum':
		if 'bit' in tp and tp['bit']:		
			return 'uint'
		else:
			return 'utiny'
	else:
		print("Failed get basic type -> ", ptype)

def _isArray(cfg, ptype):
	tp = cfg['done_types'][ptype]
	return tp['ctype'] == "array"

def _isMap(cfg, ptype):
	tp = cfg['done_types'][ptype]
	return tp['ctype'] == "map"

def _isObject(cfg, ptype):
	tp = cfg['done_types'][ptype]
	return tp['ctype'] == "object"

def addBasicField(out, ename, pinfo, index, ptype, pname):
	out[ename]['fields'][pname] = {
		"type":ptype,
		"index":INDEX_NONE
	}

	if pinfo and ptype == "string":
		if 'size' in pinfo:
			out[ename]['fields'][pname]['type'] = "string:"+str(pinfo['size'])
		else:
			out[ename]['fields'][pname]['type'] = "string:50"

	if index:
		out[ename]['fields'][pname]['index'] = index
	elif pinfo and 'unique' in pinfo:
		out[ename]['fields'][pname]['index'] = INDEX_UNIQUE
	elif pinfo and 'index' in pinfo:
		out[ename]['fields'][pname]['index'] = INDEX_INDEX

	if "k_" not in pname:
		elePath = []
		
		epath = ename.split("_")
		ppath = pname.split("_")
		epath.extend(ppath[:-1])
		ele = ppath[-1]

		out[ename]['fields'][pname]['elementPath'] = epath
		if ele in [str(i) for i in range(10)]:
			out[ename]['fields'][pname]['elementName'] = ppath[-2]
		else:
			out[ename]['fields'][pname]['elementName'] = ele

		#out[ename]['fields'][pname]['desc'] = pinfo['desc']
		

def addArrayField(out, cfg, kp, ename, pinfo, pname):
	if 'size' in pinfo and pinfo['size'] <= 6:
		if _isBasic(cfg, pinfo['type']):
			for i in range(pinfo['size']):
				addBasicField(out, ename, pinfo, None, _getBasicType(cfg, pinfo['type']), _nameWithSuffix("", pname, i+1))
		elif _isObject(cfg, pinfo['type']):
			ptinfo = cfg['done_types'][pinfo['type']]
			for i in range(pinfo['size']):				
				for fname, ftype in ptinfo['fields'].items():
					if not _isBasic(cfg, ftype):
						print("Critical !! Size Array can not got complex object field")
						continue
					addBasicField(out, ename, pinfo, None, _getBasicType(cfg, ftype), _nameWithSuffix(pname, fname, i+1))
					#addObjectField(out, cfg, None, ename, "", pinfo, i+1)
		else:
			print("Invalid size setting, did not support complex size")
	else:
		subname = _nameWithSuffix(ename, pname)
		root = ename.split("_")[0]
		rootName = _toEntityName(root) + "ID"
		out[subname] = {
			"tableName": subname.lower(),
			"tableType": TABLE_ARRAY,
			"owner": False,
			"fields": {				
				rootName : {
					"type":"uint",
					"index":INDEX_NONE
				},
				"k_index":{
					"type":"uint",
					"index":INDEX_NONE
				}
			},
			"unionIndex":[],
			"primary": [rootName]
		}

		i = 1
		for tag in kp:
			if tag == SUB_NAME_SA:
				out[subname]['primary'].append("k_p"+str(i))
				addBasicField(out, subname, None, None, "uint", "k_p"+str(i))
				i += 1
			elif tag == SUB_NAME_SMS:
				out[subname]['primary'].append("k_p"+str(i))
				addBasicField(out, subname, None, None, "string", "k_p"+str(i))
				i += 1
			elif tag == SUB_NAME_SMI:
				out[subname]['primary'].append("k_p"+str(i))
				addBasicField(out, subname, None, None, "int", "k_p"+str(i))
				i += 1

		out[subname]['primary'].append("k_index")

		kp.append(SUB_NAME_SA)
		propName = ""
		if _isBasic(cfg, pinfo['type']):
			propName = "k_value"
		elif _isObject(cfg, pinfo['type']):
			pass
		elif _isArray(cfg, pinfo['type']):
			propName = SUB_NAME_SA
			
		elif _isMap(cfg, pinfo['type']):
			ptinfo = cfg['done_types'][pinfo['type']]
			if ptinfo['keyType'] == "string":
				propName = SUB_NAME_SMS
			else:
				propName = SUB_NAME_SMI

		generateProp(out, cfg, None, subname, propName, pinfo['type'], copy.copy(kp))

def _getIndexFromObj(objInfo, fname):
	if 'uniques' in objInfo and fname in objInfo['uniques']:
		return INDEX_UNIQUE
	elif 'indexs' in objInfo and fname in objInfo['indexs']:
		return INDEX_INDEX
	else:
		return None

def addObjectField(out, cfg, kp, ename, parentName, objType, indexSuffix = 0):
	#print("AddObjectField ", kp, ename, parentName, objType)
	for fname, ftname in objType['fields'].items():
		tp = cfg['done_types'][ftname]
		if _isBasic(cfg, ftname):
			addBasicField(out, ename, tp, _getIndexFromObj(objType, fname),  
				_getBasicType(cfg, ftname), _nameWithSuffix("", _nameWithSuffix(parentName,fname), indexSuffix))
		elif _isObject(cfg, ftname):
			addObjectField(out, cfg, copy.copy(kp), ename, _nameWithSuffix(parentName, fname), tp, indexSuffix)
		elif _isArray(cfg, ftname):
			#print("check -> ", ename, fname, parentName)
			addArrayField(out, cfg, copy.copy(kp), _nameWithSuffix(ename,parentName), tp, fname)
		elif _isMap(cfg, ftname):
			#print("check -> ", ename, fname, parentName)
			addMapField(out, cfg, copy.copy(kp), _nameWithSuffix(ename,parentName), tp, fname)

def addMapField(out, cfg, kp, ename, pinfo, pname):
	subname = _nameWithSuffix(ename, pname)
	root = ename.split("_")[0]
	rootName = _toEntityName(root) + "ID"
	out[subname] = {
		"tableName": subname.lower(),
		"tableType": TABLE_MAP,
		"owner": False,
		"fields": {			
			rootName : {
				"type":"uint",
				"index":INDEX_NONE
			},
			"k_key":{
				"type":_getBasicType(cfg, pinfo['keyType']),
				"index":INDEX_NONE
			}
		},
		"unionIndex":[],
		"primary": [rootName]
	}

	i = 1
	for tag in kp:
		if tag == SUB_NAME_SA:
			out[subname]['primary'].append("k_p"+str(i))
			addBasicField(out, subname, None, None, "uint", "k_p"+str(i))
			i += 1
		elif tag == SUB_NAME_SMS:
			out[subname]['primary'].append("k_p"+str(i))
			addBasicField(out, subname, None, None, "string", "k_p"+str(i))
			i += 1
		elif tag == SUB_NAME_SMI:
			out[subname]['primary'].append("k_p"+str(i))
			addBasicField(out, subname, None, None, "int", "k_p"+str(i))
			i += 1

	out[subname]['primary'].append("k_key")
	
	if pinfo['keyType'] == "string":
		kp.append(SUB_NAME_SMS)
	else:
		kp.append(SUB_NAME_SMI)

	propName = ""
	if _isBasic(cfg, pinfo['valueType']):
		propName = "k_value"
	elif _isObject(cfg, pinfo['valueType']):
		pass
	elif _isArray(cfg, pinfo['valueType']):
		propName = SUB_NAME_SA
	elif _isMap(cfg, pinfo['valueType']):
		ptinfo = cfg['done_types'][pinfo['valueType']]
		if ptinfo['keyType'] == "string":
			propName = SUB_NAME_SMS
		else:
			propName = SUB_NAME_SMI

	generateProp(out, cfg, None, subname, propName, pinfo['valueType'], copy.copy(kp))

def _genPropIndex(prop):
	if prop and 'unique' in prop and prop['unique']:
		return INDEX_UNIQUE
	elif prop and 'index' in prop and prop['index']:
		return INDEX_INDEX
	else:
		return None

def generateProp(out, cfg, prop, ename, propName, ptname, kp=[]):
	ptinfo = cfg['done_types'][ptname]
	if ptinfo['ctype'] == 'basic':
		addBasicField(out, ename, ptinfo, _genPropIndex(prop), ptinfo['type'], propName)
	elif ptinfo['ctype'] == 'enum':
		addBasicField(out, ename, ptinfo, _genPropIndex(prop), 'uint', propName)
	elif ptinfo['ctype'] == 'array':
		addArrayField(out, cfg, copy.copy(kp), ename, ptinfo, propName)
	elif ptinfo['ctype'] == 'object':
		addObjectField(out, cfg, copy.copy(kp), ename, propName, ptinfo)
	elif ptinfo['ctype'] == 'map':
		addMapField(out, cfg, copy.copy(kp), ename, ptinfo, propName)

def generateEntity(out, cfg, ename, e):
	props = e["properties"]
	#print(e)
	for impename,_ in e["implements"].items():
		impe = cfg['done_entities'][impename]["properties"]
		props.update(impe)
	props = {k:v for k,v in props.items() if v['persistent']}
	if len(props) == 0:return
	out[ename] = {
		"tableName": ename.lower(),
		"tableType": TABLE_BASE,
		"owner": True,
		"fields": {			
			_toEntityName(ename)+"ID": {
				"type":"uint",
				"index":INDEX_NONE
			}
		},
		"unionIndex":[],
		"primary": [_toEntityName(ename)+"ID"]
	}
	for propName, prop in props.items():
		ptname = cfg['done_types_id'][prop['type']]
		generateProp(out, cfg, prop, ename, propName, ptname)

# index = 0
# orichars = "abcdefghijklmnopqrstuvwxyz0123456789_"
# chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`~!@#$%^&()-"
# def generateTag(index):
# 	res = ""
# 	total = len(chars)
# 	while index >= total:
# 		index = (index // total) - 1
# 		res += chars[index % total]		
# 	res += chars[index % total]
# 	index = index + 1
# 	return res
	

# def generateMapping(cfg):
# 	map = {
# 		"to" : {},
# 		"from": {}
# 	}
# 	for tcfg in cfg.values(): 
# 		pass

def write(cfg, outPath):
	utils.make_sure_path(outPath)

	out = {}
	for ename, e in cfg['done_entities'].items():
		if e["abstract"] : continue
		#print("Start Entity -> ", ename)
		generateEntity(out, cfg, ename, e)

	newPath = outPath + "/OrmModel.json"
	with codecs.open(newPath, "w", "utf-8") as f:
		f.write(json.dumps(out, indent = 4))

# 	mapping = outPath + "/OrmMapping.json"
# 	mapOut = generateMapping(out)
# 	with open(mapping, "w") as f:
# 		f.write(json.dumps(mapOut, indent = 4))

# if __name__ == "__main__":
# 	print("len -> ", len(chars))