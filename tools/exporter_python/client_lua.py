import utils
import codecs
import os
from utils import AUTO_CODE

AUTO_LUA_COMMENT = "--"

gindent = 4

def int_tolua(pint):
	return str(pint)

def bool_tolua(pbool):
	return "true" if pbool else "false"

def float_tolua(pfloat):
	return "%.3f"%(pfloat)

def string_tolua(pstring):
	return "\"%s\""%(pstring)

def value_tolua(pvalue, indent):
	if type(pvalue) is int:
		return int_tolua(pvalue)
	if type(pvalue) is bool:
		return bool_tolua(pvalue)
	elif type(pvalue) is float:
		return float_tolua(pvalue)
	elif type(pvalue) is str:
		return string_tolua(pvalue)
	elif type(pvalue) is list:
		return array_tolua(pvalue, indent)
	elif type(pvalue) is dict:
		return dict_tolua(pvalue, indent)

def array_tolua(parray, indent):
	q = []
	for value in parray:
		q.append(value_tolua(value, indent))		
	return "{%s}"%(",".join(q))

def dict_tolua(pdict, indent):
	s = "%s{"%(" "*indent)
	q = []
	for k, v in pdict.items():
		if type(k) is int:
			key = "[%d]"%(k)
		else:
			key = k
		q.append("%s%s=%s"%(" "*(indent+gindent), key, value_tolua(v, indent+gindent)))
	s += ",".join(q)
	s += "%s}"%(" "*indent)
	return s

def tolua(pdict, indent = 0):
	global gindent
	gindent = 0
	return "local _V = %s\n\nreturn _V"%(dict_tolua(pdict, 0))


def writeCfg(cfg, ccfgPath):
	utils.make_sure_path(ccfgPath)

	#print("   ----> Write %s/Methods.lua "%(ccfgPath))
	with codecs.open(ccfgPath + "/Methods.lua", "w", "utf-8") as f:
		f.write(tolua(cfg["done_methods"]))

	#print("   ----> Write %s/Types.lua "%(ccfgPath))
	with codecs.open(ccfgPath + "/Types.lua", "w", "utf-8") as f:
		f.write(tolua({
				"types":cfg["done_types"],
				"id2types":cfg["done_types_id"]
			}))

	#print("   ----> Write %s/Entities.lua "%(ccfgPath))
	with codecs.open(ccfgPath + "/Entities.lua", "w", "utf-8") as f:
		f.write(tolua(cfg["done_entities"]))

	#print("   ----> Write %s/ProxyDefine.lua "%(ccfgPath))
	with codecs.open(ccfgPath + "/ProxyDefine.lua", "w", "utf-8") as f:
		f.write(tolua(cfg["done_proxies"]))

	#print("   ----> Write %s/HadesUUID.lua "%(ccfgPath))
	with codecs.open(ccfgPath + "/HadesUUID.lua", "w", "utf-8") as f:
		f.write(tolua(cfg["uuid"]))

	
	#print()

def exportLuaTypeInfo(cfg, tp, f, tab=""):
	if cfg['done_types'][tp]['ctype'] == 'enum':
		f.write('''{tab}\t\t\t{tp} is enum with the value below : \n'''.format(tp=tp, tab=tab))
		keys = sorted([k for k in cfg['done_types'][tp]['fields'].keys() if type(k) is int])
		for v in keys:
			fi = cfg['done_types'][tp]['fields'][v]			
			if type(v) is int:
				f.write('''{tab}\t\t\t\t{fi} = {fv}  -- Types.types.{tp}.fields.{fi}\n'''.format(tp=tp, fi=fi, fv=v, tab=tab))
	elif cfg['done_types'][tp]['ctype'] == 'object':
		f.write('''{tab}\t\t\t{tp} is object with the fields below : \n'''.format(tp=tp, tab=tab))
		keys = sorted(cfg['done_types'][tp]['fields'].keys())
		for fi in keys:
			vt = cfg['done_types'][tp]['fields'][fi]
			f.write('''{tab}\t\t\t\t{fi} : "{vt}"\n'''.format(tp=tp, fi=fi, vt=vt, tab=tab))
			if vt in cfg['done_types']:
				exportLuaTypeInfo(cfg, vt, f, tab+"\t\t")
	elif cfg['done_types'][tp]['ctype'] == 'array':
		f.write('''{tab}\t\t\t{tp} is array with the type : {t}\n'''.format(tp=tp, t=cfg['done_types'][tp]['type'], tab=tab))
		if cfg['done_types'][tp]['type'] in cfg['done_types']:
			exportLuaTypeInfo(cfg, cfg['done_types'][tp]['type'], f, tab+"\t\t")
	if tab == "":		
		f.write("\n")

def exportLuaEntity(cfg, ename, ecfg, userCode, f):
	utils.exportWarn2(f, AUTO_LUA_COMMENT)
	ebaseCfg = cfg['entities'][ename]

	imps = ""
	impsreq = []
	if len(ebaseCfg['Implements']) > 0:
		for imp in ebaseCfg['Implements']:
			ip = cfg['entities'][imp]['path']
			impsreq.append([imp, ".".join([ip, imp])])		
	impsreq = sorted(impsreq)
	hasSuper = False
	f.write('''local Cupid = require("Cupid")\n''')
	for ir in impsreq:
		hasSuper = True
		f.write('''local {imp} = require("Proxy.{pimp}")\n'''.format(imp=ir[0], pimp=ir[1]))
	if len(impsreq) > 0:
		imps = ",\n\t\t\t\t\t\t\t\t\t" + ",\n\t\t\t\t\t\t\t\t\t".join([x[0] for x in impsreq])
	if ebaseCfg['Abstract']:		
		f.write('''local {m} = Cupid.Utils.Class("{m}"{imp})\n'''.format(m=ename, imp=imps))
	else:
		hasSuper = True
		f.write('''local Proxy = require("HadesClient.Proxy")\n''')
		f.write('''local {m} = Cupid.Utils.Class("{m}", Proxy{imp})\n'''.format(m=ename, imp=imps))
	sp = '''{at}'''.format(at=(AUTO_CODE['rstart']%(AUTO_LUA_COMMENT)))
	f.write('''{:=<100}\n'''.format(sp))
	for line in userCode["__require"]:
		f.write(line)
	sp = '''{at}'''.format(at=(AUTO_CODE['rend']%(AUTO_LUA_COMMENT)))
	f.write('''{:=<100}\n\n\n'''.format(sp))

	sp = '''{at}'''.format(at=(AUTO_CODE['gstart']%(AUTO_LUA_COMMENT)))
	f.write('''{:=<100}\n'''.format(sp))
	for line in userCode["__global"]:
		f.write(line)
	sp = '''{at}'''.format(at=(AUTO_CODE['gend']%(AUTO_LUA_COMMENT)))
	f.write('''{:=<100}\n\n\n'''.format(sp))

	f.write('''--===========================================================================================\n''')
	f.write('''-- Constructor\n''')
	f.write('''--===========================================================================================\n''')
	f.write('''function {m}:ctor(tbl)\n'''.format(m=ename))
	if hasSuper:
		f.write('''\tfor k, super in pairs({m}.__supers) do\n'''.format(m=ename))
		f.write('''\t\tsuper.ctor(self, tbl)\n''')
		f.write('''\tend\n\n''')
	sp = '''\t{at}'''.format(at=(AUTO_CODE['prostart']%(AUTO_LUA_COMMENT)))
	f.write('''{:=<100}\n'''.format(sp))
	for line in userCode["__property"]:
		f.write(line)
	sp = '''\t{at}'''.format(at=(AUTO_CODE['proend']%(AUTO_LUA_COMMENT)))
	f.write('''{:=<100}\n'''.format(sp))
	f.write('''end\n\n''')

	f.write('''--===========================================================================================\n''')
	f.write('''-- Pushs\n''')
	f.write('''--===========================================================================================\n''')
	for mname in ecfg['pushes']:
		mcfg = cfg['done_methods']['push'][mname]
		f.write('''--[[\n''')
		#f.write('''\t * handler {m} :\n'''.format(m=mname))		
		args = []
		for tid, argname, desc, nil in mcfg['req']:
			tp = cfg['done_types_id'][tid]
			args.append(argname)
			f.write('''\t @param {{{tp}}} args.{an} : {tdesc}\n'''.format(an=argname, tp=tp, tdesc=desc))		
		f.write(''']]\n''')
		f.write('''function {e}:{m}(args)\n'''.format(e=ename, m=mname))
		
		sp = '''\t{at}'''.format(at=(AUTO_CODE['start']%(AUTO_LUA_COMMENT, mname)))
		f.write('''{:=<90}\n'''.format(sp))
		if mname in userCode:
			userCode[mname]["used"] = True
			for line in userCode[mname]["codes"]:
				f.write(line)
		sp = '''\t{at}'''.format(at=(AUTO_CODE['end']%(AUTO_LUA_COMMENT, mname)))				
		f.write('''{:=<90}\n'''.format(sp))
		f.write('''end\n\n''')

	f.write('''--===========================================================================================\n''')
	f.write('''-- Handlers\n''')
	f.write('''--===========================================================================================\n''')
	for mname in ecfg['handlers']:
		mcfg = cfg['done_methods']['handler'][mname]
		f.write('''-- Handlers `self.server.{h}` \n'''.format(h=mname))
		f.write('''--[[\n''')		
		args = []
		for tid, argname, desc, nil in mcfg['req']:
			tp = cfg['done_types_id'][tid]
			args.append(argname)
			f.write(''' @param {{{tp}}} {an} : {tdesc}\n'''.format(an=argname, tp=tp, tdesc=desc))
			if tp in cfg['done_types']:
				exportLuaTypeInfo(cfg, tp, f)

		hasResp = True
		if 'resp' not in mcfg:
			hasResp = False
		if hasResp:
			f.write(''' @return {object} resp : details in resp -> \n''')		
			for tid, argname, desc, nil in mcfg['resp']:
				tp = cfg['done_types_id'][tid]				
				f.write('''          {an} {{{tp}}} : {tdesc}\n'''.format(an=argname, tp=tp, tdesc=desc))
				if tp in cfg['done_types']:
					exportLuaTypeInfo(cfg, tp, f)

		f.write(''']]\n\n''')	

	sp = '''\n{at}'''.format(at=(AUTO_CODE['pstart']%(AUTO_LUA_COMMENT)))
	f.write('''{:=<90}\n'''.format(sp))
	for line in userCode["__private"]:
		f.write(line)
	sp = '''{at}'''.format(at=(AUTO_CODE['pend']%(AUTO_LUA_COMMENT)))
	f.write('''{:=<90}\n'''.format(sp))
	f.write('''\nreturn {m}\n'''.format(m=ename))

	f.write('''\n\n--[[''')
	sp = '''\n{at}'''.format(at=(AUTO_CODE['oldstart']%(AUTO_LUA_COMMENT)))	
	f.write('''{:=<90}\n'''.format(sp))
	for line in userCode["____old"]:
		f.write(line)
	for mname, mdata in userCode.items():
		if type(mdata) is dict:
			if not "used" in mdata:
				continue
			if not mdata["used"]:		
				sp = '''\t{at}'''.format(at=(AUTO_CODE['start']%(AUTO_LUA_COMMENT, mname)))				
				f.write('''{:=<90}\n'''.format(sp))
				
				for line in mdata["codes"]:
					f.write(line)
				
				sp = '''\t{at}'''.format(at=(AUTO_CODE['end']%(AUTO_LUA_COMMENT, mname)))
				f.write('''{:=<90}\n'''.format(sp))
	sp = '''{at}'''.format(at=(AUTO_CODE['oldend']%(AUTO_LUA_COMMENT)))	
	f.write('''{:=<90}\n'''.format(sp))
	f.write(''']]\n''')

def writeScript(cfg, ccPath):
	utils.make_sure_path(ccPath)

	keys = utils.getObjSortedKeys(cfg['done_entities'])
	for ename in keys:
		ecfg = cfg['done_entities'][ename]
		if ecfg['etype'] != 0:
			continue

		rlpath = cfg["entities"][ename]['path']
		if rlpath:
			rlpath += "/"
		epath = ccPath + "/" + rlpath
		if not os.path.exists(epath):
			os.makedirs(epath)
		method = epath + ename +".lua"
		userCode = {"__private":[], "__require":[], "__global":[], "__property":[], "____old":{}}
		if os.path.exists(method):
			with codecs.open(method, "r", "utf-8") as f:
				#print("   ----> Load %s "%(method))	
				userCode = utils.importUserCode(f, AUTO_LUA_COMMENT)

		try:
			with codecs.open(method + ".tmp", "w", "utf-8") as f:	
				exportLuaEntity(cfg, ename, ecfg, userCode, f)				
			with codecs.open(method + ".tmp", "r", "utf-8") as f:	
				with codecs.open(method, "w", "utf-8") as fw:		 
					fw.write(f.read())						
		except (Exception) as e:
			import traceback
			print("Failed export lua -> ", method, e.args)
			traceback.print_exc()
		finally:
			os.remove(method + ".tmp")

	#print()