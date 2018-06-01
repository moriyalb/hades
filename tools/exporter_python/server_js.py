import utils
import os
from utils import AUTO_CODE
import codecs

AUTO_JS_COMMENT = "//"

ETYPE_PROXY = 0
ETYPE_SINGLE = 1
ETYPE_SIMPLE = 2
IMMANENTS = {
	0:[
		["onCreate", "When this entity is first created in database", 1, []],
		["onLoad", "When this entity is loaded", 1, []],
		["onPrepare", "", 1, ['clientInfo']],
		["onConnect", "When this entity connected", 1, ['opts']],
		["onDisconnect", "When this entity disconnected", 2, ['reason']],
		["onDestroy", "When this entity destroyed", 2, []]
	],
	2:[
		["onCreate", "When this entity is created", 1, []],
		["onLoad", "When this entity is created from database", 1, []],
		["onSave", "When this entity is saved to database", 1, []]
	],
	1:[
		["onInit", "When the server start", 1, []],
		["onFini", "When the server shutdown", 1, []],
		["onRoute", '''Route function. this method should return a valid serverId. 
	 * Don't use ==this== in this method since this method will be call the on the remote server.''', -1, ['routeParam', 'ename']],
	],
	9:[
		["onCreate", "When the entity is created", 1, []],
	]
}
		

def exportJsEntityMethod(cfg, ename, ecfg, userCode, f):
	f.write('''"use strict"\n\n''')	
	utils.exportWarn2(f, AUTO_JS_COMMENT)
	ebaseCfg = cfg['entities'][ename]
	impsreq = []
	impprior = {}
	if len(ebaseCfg['Implements']) > 0:
		for imp, prior in ebaseCfg['Implements'].items():
			ip = cfg['entities'][imp]['path']
			impsreq.append([imp, "/".join([ip, imp]), prior])
			if prior not in impprior:
				impprior[prior] = []
			impprior[prior].append(imp)
	impsreq = sorted(impsreq)
	priors = sorted(impprior.keys())

	for ir in impsreq:
		f.write('''const {imp}Method = require("./{pimp}Method")\n'''.format(imp=ir[0], pimp=ir[1]))

	f.write('''const Hades = GlobalHades\n''')
	f.write('''const Types = Hades.Schema.Types\n\n''')
	sp = '''{at}'''.format(at=(AUTO_CODE['rstart']%(AUTO_JS_COMMENT)))
	f.write('''{:=<100}\n'''.format(sp))
	for line in userCode["__require"]:
		f.write(line)
	sp = '''{at}'''.format(at=(AUTO_CODE['rend']%(AUTO_JS_COMMENT)))
	f.write('''{:=<100}\n\n\n'''.format(sp))

	sp = '''{at}'''.format(at=(AUTO_CODE['gstart']%(AUTO_JS_COMMENT)))
	f.write('''{:=<100}\n'''.format(sp))
	for line in userCode["__global"]:
		f.write(line)
	sp = '''{at}'''.format(at=(AUTO_CODE['gend']%(AUTO_JS_COMMENT)))
	f.write('''{:=<100}\n\n\n'''.format(sp))

	f.write('''class {ename}Method {{\n'''.format(ename=ename))

	immanents = []
	etype = cfg['done_entities'][ename]['etype']

	f.write('''\t//===========================================================================================\n''')
	f.write('''\t// Immanents\n''')
	f.write('''\t//===========================================================================================\n''')
	if cfg['done_proxies']['LoginProxy'] != ename:				
		immanents = IMMANENTS[etype]
	else:
		immanents = IMMANENTS[9] #special for login proxy

	for imm in immanents:		
		f.write('''\t/**\n''')
		f.write('''\t * {desc}\n'''.format(desc=imm[1]))
		f.write('''\t */\n''')
		f.write('''\tasync {n}({opts}) {{\n'''.format(n=imm[0], opts=", ".join(imm[3])))
		if len(impsreq) > 0 and imm[2] >= 0:
			if imm[2] == 0:
				f.write('''\t\tawait Promise.all(\n\t\t\t[\n''')
				for ir in impsreq:
					f.write('''\t\t\t\t{imp}Method.prototype.{md}.call(this{splitter}{opts}),\n'''.format(
						splitter=", " if len(imm[3])>0 else "", imp=ir[0], md=imm[0], opts=", ".join(imm[3])))
				f.write('''\t\t\t]\n\t\t)\n\n''')
			elif imm[2] == 1:
				for p in priors:
					f.write('''\t\t//Prior {p}\n'''.format(p=p))
					f.write('''\t\tawait Promise.all(\n\t\t\t[\n''')
					for imp in sorted(impprior[p]):
						f.write('''\t\t\t\t{imp}Method.prototype.{md}.call(this{splitter}{opts}),\n'''.format(
							splitter=", " if len(imm[3])>0 else "", imp=imp, md=imm[0], opts=", ".join(imm[3])))
					f.write('''\t\t\t]\n\t\t)\n''')
			elif imm[2] == 2:
				for p in sorted(priors, reverse=True):
					f.write('''\t\t//Prior {p}\n'''.format(p=p))
					f.write('''\t\tawait Promise.all(\n\t\t\t[\n''')
					for imp in sorted(impprior[p]):
						f.write('''\t\t\t\t{imp}Method.prototype.{md}.call(this{splitter}{opts}),\n'''.format(
							splitter=", " if len(imm[3])>0 else "", imp=imp, md=imm[0], opts=", ".join(imm[3])))
					f.write('''\t\t\t]\n\t\t)\n''')
		sp = '''\t\t{at}'''.format(at=(AUTO_CODE['start']%(AUTO_JS_COMMENT, imm[0])))
		f.write('''{:=<90}\n'''.format(sp))		
		if imm[0] in userCode:
			userCode[imm[0]]['used'] = True
			for line in userCode[imm[0]]["codes"]:
				f.write(line)
		sp = '''\t\t{at}'''.format(at=(AUTO_CODE['end']%(AUTO_JS_COMMENT, imm[0])))				
		f.write('''{:=<90}\n'''.format(sp))
		#f.write('''\t\tconsole.log("{ename}Method::{md} Called!")\n'''.format(ename=ename, md=imm[0]))
		f.write('''\t}\n\n''')

	if etype == ETYPE_PROXY:
		f.write('''\t//===========================================================================================\n''')
		f.write('''\t// Handlers\n''')
		f.write('''\t//===========================================================================================\n''')
		for mname in ecfg['handlers']:
			mcfg = cfg['done_methods']['handler'][mname]
			f.write('''\t/**\n''')
			#f.write('''\t * handler {m} :\n'''.format(m=mname))
			bndArg = ""
			if "unbinded" in mcfg and mcfg['unbinded']:
				f.write('''\t * @param {object} session : unbinded method need this\n''')
				bndArg = "session, "

			args = []
			for tid, argname, desc, canNil in mcfg['req']:
				tp = cfg['done_types_id'][tid]
				args.append(argname)
				f.write('''\t * @param {{{tp}{nil}}} {an} : {tdesc}\n'''.format(an=argname, tp=tp, tdesc=desc, nil=" or null" if canNil else ""))

			hasResp = True
			if 'resp' not in mcfg:
				hasResp = False

			f.write('''\t *\n''')
			if hasResp:
				f.write('''\t * @return {object} resp : details in resp -> \n''')		
				rets = []
				for tid, argname, desc, canNil in mcfg['resp']:
					tp = cfg['done_types_id'][tid]
					if 'default' in tp:
						rets.append([argname, tp['default']])
					else:
						rets.append([argname, "null"])
					f.write('''\t *        {{{tp}{nil}}} {an} : {tdesc}\n'''.format(an=argname, tp=tp, tdesc=desc, nil=" or null" if canNil else ""))

			f.write('''\t */\n''')
			f.write('''\tasync {m}({bd}{args}) {{\n'''.format(m=mname, bd=bndArg, args=", ".join(args)))
			if hasResp:
				f.write('''\t\tlet resp = {{{rets}}}\n'''.format(rets=", ".join(["%s : %s"%(n,v) for n,v in rets])))
			sp = '''\t\t{at}'''.format(at=(AUTO_CODE['start']%(AUTO_JS_COMMENT, mname)))
			f.write('''{:=<90}\n'''.format(sp))
			if mname in userCode:
				userCode[mname]['used'] = True
				for line in userCode[mname]["codes"]:
					f.write(line)
			sp = '''\t\t{at}'''.format(at=(AUTO_CODE['end']%(AUTO_JS_COMMENT, mname)))				
			f.write('''{:=<90}\n'''.format(sp))
			if hasResp:
				f.write('''\t\treturn resp\n''')
			f.write('''\t}\n\n''')

	if etype != ETYPE_SIMPLE:
		f.write('''\n\t//===========================================================================================\n''')
		f.write('''\t// Remotes\n''')
		f.write('''\t//===========================================================================================\n''')
		for mname in ecfg['remotes']:
			mcfg = cfg['done_methods']['remote'][mname]
			f.write('''\t/**\n''')
			f.write('''\t * @param {object} args : details in args -> \n''')
			args = []
			for tid, argname, desc, canNil in mcfg['req']:
				tp = cfg['done_types_id'][tid]
				args.append(argname)
				f.write('''\t *         {{{tp}{nil}}} {an} : {tdesc}\n'''.format(an=argname, tp=tp, tdesc=desc, nil=" or null" if canNil else ""))
						
			hasResp = True
			if 'resp' not in mcfg:
				hasResp = False
			if hasResp:
				f.write('''\t * @return {object} resp : details in resp -> \n''')		
				rets = []
				for tid, argname, desc, canNil in mcfg['resp']:
					tp = cfg['done_types_id'][tid]
					if 'default' in tp:
						rets.append([argname, tp['default']])
					else:
						rets.append([argname, "null"])
					f.write('''\t *         {{{tp}{nil}}} {an} : {tdesc}\n'''.format(an=argname, tp=tp, tdesc=desc, nil=" or null" if canNil else ""))

			f.write('''\t */\n''')
			f.write('''\tasync {m} (args){{\n'''.format(m=mname))
			f.write('''\t\tconst {{{args}}} = args\n'''.format(args=", ".join(args)))
			if hasResp:
				f.write('''\t\tlet resp = {{{rets}}}\n'''.format(rets=", ".join(["%s : %s"%(n,v) for n,v in rets])))
			sp = '''\t\t{at}'''.format(at=(AUTO_CODE['start']%(AUTO_JS_COMMENT, mname)))
			f.write('''{:=<90}\n'''.format(sp))
			if mname in userCode:
				userCode[mname]['used'] = True
				for line in userCode[mname]["codes"]:
					f.write(line)
			sp = '''\t\t{at}'''.format(at=(AUTO_CODE['end']%(AUTO_JS_COMMENT, mname)))
			f.write('''{:=<90}\n'''.format(sp))
			if hasResp:
				f.write('''\t\treturn resp\n''')
			f.write('''\t}\n\n''')

	sp = '''\n\n\t{at}'''.format(at=(AUTO_CODE['pbstart']%(AUTO_JS_COMMENT)))
	f.write('''{:=<90}\n'''.format(sp))
	for line in userCode["__public"]:
		f.write(line)
	sp = '''\t{at}'''.format(at=(AUTO_CODE['pbend']%(AUTO_JS_COMMENT)))
	f.write('''{:=<90}\n'''.format(sp))

	sp = '''\n\n\t{at}'''.format(at=(AUTO_CODE['pstart']%(AUTO_JS_COMMENT)))
	f.write('''{:=<90}\n'''.format(sp))
	for line in userCode["__private"]:
		f.write(line)
	sp = '''\t{at}'''.format(at=(AUTO_CODE['pend']%(AUTO_JS_COMMENT)))
	f.write('''{:=<90}\n'''.format(sp))

	f.write('''}\n\n''')
	f.write('''module.exports = {ename}Method\n'''.format(ename=ename))

	f.write('''\n\n/**''')
	sp = '''\n{at}'''.format(at=(AUTO_CODE['oldstart']%(AUTO_JS_COMMENT)))	
	f.write('''{:=<90}\n'''.format(sp))
	for line in userCode["____old"]:
		f.write(line)
	for mname, mdata in userCode.items():
		if type(mdata) is dict:
			if not "used" in mdata:
				continue
			if not mdata["used"]:		
				sp = '''\t{at}'''.format(at=(AUTO_CODE['start']%(AUTO_JS_COMMENT, mname)))				
				f.write('''{:=<90}\n'''.format(sp))
				
				for line in mdata["codes"]:
					f.write(line)
				
				sp = '''\t{at}'''.format(at=(AUTO_CODE['end']%(AUTO_JS_COMMENT, mname)))
				f.write('''{:=<90}\n'''.format(sp))
	sp = '''{at}'''.format(at=(AUTO_CODE['oldend']%(AUTO_JS_COMMENT)))	
	f.write('''{:=<90}\n'''.format(sp))
	f.write('''*/\n''')


def write(cfg, scPath):
	keys = utils.getObjSortedKeys(cfg['done_entities'])
	for ename in keys:
		ecfg = cfg['done_entities'][ename]
		rlpath = cfg["entities"][ename]['path']
		if rlpath:
			rlpath += "/"
		epath = scPath + "/" + rlpath
		utils.make_sure_path(epath)

		method = epath + ename + "Method.js"
		userCode = {"__private":[], "__require":[], "__global":[], "__property":[], "__public":[], "____old":{}}
		if os.path.exists(method):
			with codecs.open(method, "r", "utf-8") as f:
				#print("   ----> Load %s "%(method))	
				userCode = utils.importUserCode(f, AUTO_JS_COMMENT)
			
		#print("   ----> Write %s "%(method))	
		try:
			with codecs.open(method + ".tmp", "w", "utf-8") as f:	
				exportJsEntityMethod(cfg, ename, ecfg, userCode, f)				
			with codecs.open(method + ".tmp", "r", "utf-8") as f:	
				with codecs.open(method, "w", "utf-8") as fw:		 
					fw.write(f.read())						
		except (Exception) as e:	
			import traceback		
			print("Failed export method -> ", method, e.args)
			traceback.print_exc()
		finally:
			os.remove(method + ".tmp")

	#print()
	