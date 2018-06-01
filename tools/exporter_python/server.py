import os
import simplejson as json
import codecs
import uuid
import utils

def makeServerDefine(svrCfg, env, svrType, hcount, hosts, portsStart, extras): 
	#print("makeServerDefine ", env, svrType, hcount)
	if hosts["local"] not in svrCfg["Cluster"]["Hosts"]:
		svrCfg["Cluster"]["Hosts"][hosts["local"]] = 1
	for i in range(hcount[0], hcount[1]):
		cfg = {
			"host": hosts["local"],
			"port": portsStart["local"],
			"restart-force": True,
			"id": env+"_"+svrType+"_"+str(i+1)
		}
		portsStart["local"] += 1

		if svrType == "bf_proxy":
			cfg["frontend"] = True
			cfg["clientPort"] = portsStart["remote"]
			if not env in svrCfg["Cluster"]["Connectors"]:
				svrCfg["Cluster"]["Connectors"][env] = []				
			svrCfg["Cluster"]["Connectors"][env].append({
				"host": hosts["remote"],
				"port": cfg["clientPort"]
			})
			portsStart["remote"] += 1

		for exTag, exValue in extras.items():
			#print("check extra -> ", exTag, exValue)
			tp, v = exValue.split("_")
			if v == "host":
				cfg[exTag] = hosts[tp]
			elif v == "port":
				cfg[exTag] = portsStart[tp]
				portsStart[tp] += 1

		#print("check cfg ", cfg)
		svrCfg['Servers'][env][svrType].append(cfg)

def importUnique(svrCfg, env, hosts, ports, servers, isUnique):	
	htKeys = sorted(list(hosts.keys()))	
	portsStart = {}
	for hostTag in htKeys:	
		local, remote = hosts[hostTag].split(":")
		hosts[hostTag] = {
			"local" : local,
			"remote" : remote
		}
		portsStart[hostTag] = {
			"remote": ports["remote"][0],
			"local": ports["local"][0],
		}
		if not env in svrCfg["Master"]:
			#master on the first host
			svrCfg["Master"][env] = {
				"id":"master",
				"host":local,
				"port":portsStart[hostTag]['local']
			}
			portsStart[hostTag]['local'] += 1

	for svrType, svr in servers.items():	
		svrCfg["Admin"].append({
			"token" : str(uuid.uuid1()).replace("-",""),
			"type" : svrType
		})
		svrCfg['Servers'][env][svrType] = []
		if type(svr) is str:
			hindex = 0
			for s in svr.split(","):
				htag, hcount = s.strip().split(":")
				hcount = int(hcount)					
				makeServerDefine(svrCfg, env, svrType, [hindex, hindex + hcount], hosts[htag], portsStart[htag], {})
				hindex += hcount

		elif type(svr) is dict:			
			extras = {}			
			for exKey, exCfg in svr.items():
				if exKey != "server":
					extras[exKey] = exCfg	
			hindex = 0				
			for s in svr['server'].split(","):
				htag, hcount = s.strip().split(":")
				hcount = int(hcount)						
				makeServerDefine(svrCfg, env, svrType, [hindex, hindex + hcount], hosts[htag], portsStart[htag], extras)
				hindex += hcount

		svrCfg["ServerCount"][svrType] = len(svrCfg['Servers'][env][svrType])
		if isUnique:
			svrCfg["UniqueServers"].append(svrType)

def importBase(svrCfg, clucfg):
	zones = sorted(list(clucfg['Hosts'].keys()))
	zoneServers = clucfg['Servers']
	if "Extras" in clucfg:
		for zoneNo, cfg in clucfg['Extras'].items():			
			env = clucfg["Name"] + "_" + str(zoneNo)
			#print("env => ", env)
			svrCfg["Cluster"]['Extras'][env] = cfg

	for zoneNo in zones:
		zoneHosts = clucfg['Hosts'][zoneNo]		
		env = clucfg["Name"] + "_" + str(zoneNo)
		if not env in svrCfg['Servers']:
			svrCfg['Servers'][env] = {}
		importUnique(svrCfg, env, zoneHosts, clucfg['Ports'], zoneServers, False)
		svrCfg["Cluster"]["Zones"][env] = clucfg["Zones"][zoneNo]["name"]

def generateServerInCluster(svrCfg):
	for env, ecfg in svrCfg['Servers'].items():
		for stype, scfg in ecfg.items():
			if not stype in svrCfg["UniqueServers"]:	
				svrCfg["Cluster"]["Servers"][stype] = {
					"env" : "Base",
					"count" : len(scfg)
				}
			else:
				svrCfg["Cluster"]["Servers"][stype] = {
					"env" : env,
					"count" : len(scfg)
				}

def load(customPath):
	print("server start load -> ", customPath)
	svrCfg = {
		"Admin":[],		
		"Master":{},
		"Servers":{},
		"Mysql":{},
		"Redis":{},
		"Router":{},
		"AdminUser":[],
		"Log4js":{},
		"Platform":{},
		"SpecialAccount":{
			"accessType":0
		},
		"ServerCount":{},
		"UniqueServers":[]
	}

	with codecs.open(customPath + "/Cluster.json", "r", "utf-8") as f:
		clusterCfg = json.loads(f.read())
	with open(customPath + "/Redis.json") as f:
		svrCfg["Redis"] = json.loads(f.read())
	with open(customPath + "/Mysql.json") as f:
		svrCfg["Mysql"] = json.loads(f.read())
	with open(customPath + "/Basic.json") as f:
		basicCfg = json.loads(f.read())
	with open(customPath + "/../common/AdminUser.json") as f:
		svrCfg["AdminUser"] = json.loads(f.read())
	with open(customPath + "/../common/Log4js.json") as f:
		svrCfg["Log4js"] = json.loads(f.read())
	with open(customPath + "/../common/Platform.json") as f:
		svrCfg["Platform"] = json.loads(f.read())
	if os.path.exists(customPath + "/SpecialAccount.json"):
		with open(customPath + "/SpecialAccount.json") as f:
			svrCfg["SpecialAccount"] = json.loads(f.read())

	svrCfg["Cluster"] = {
		"Connectors":{},
		"Zones":{},
		"GameNo":basicCfg["GameNo"],
		"CenterServer":basicCfg["CenterServer"],
		"StandaloneAccount":basicCfg["StandaloneAccount"],
		"foreDtMd5": basicCfg["foreDtMd5"] if 'foreDtMd5' in basicCfg else False ,
		"Servers":{},
		"Envs":{},
		"Extras":{},
		"Hosts":{}
	}

	for ctag, cfg in clusterCfg.items():
		cname = cfg['Name']
		ctype = cfg['Type']
		#print("======= ", cname, ctype)
		svrCfg["Cluster"]["Envs"][cname] = ctype
		if ctype == "Base":
			importBase(svrCfg, cfg)			
		elif ctype == "Unique":
			env = cfg['Name']			
			if not env in svrCfg['Servers']:
				svrCfg['Servers'][env] = {}
			importUnique(svrCfg, env, cfg["Hosts"], cfg["Ports"], cfg["Servers"], True)
		else:
			print("Invalid Cluster Type -> ", ctag)

	generateServerInCluster(svrCfg)

	return svrCfg

def write(cfg, scfgPath):
	utils.make_sure_path(scfgPath)

	#print("   ----> Write %s/Servers.json "%(scfgPath))
	with open(scfgPath + "/Servers.json", "w") as f:
		f.write(json.dumps(cfg["Servers"], sort_keys=True, indent=4))

	#print("   ----> Write %s/Master.json "%(scfgPath))
	with open(scfgPath + "/Master.json", "w") as f:
		f.write(json.dumps(cfg["Master"], sort_keys=True, indent=4))

	#print("   ----> Write %s/Admin.json "%(scfgPath))
	with open(scfgPath + "/Admin.json", "w") as f:
		f.write(json.dumps(cfg['Admin'], sort_keys=True, indent=4))

	#print("   ----> Write %s/AdminUser.json "%(scfgPath))
	with open(scfgPath + "/AdminUser.json", "w") as f:
		f.write(json.dumps(cfg['AdminUser'], sort_keys=True, indent=4))

	#print("   ----> Write %s/Log4js.json "%(scfgPath))
	with open(scfgPath + "/Log4js.json", "w") as f:
		f.write(json.dumps(cfg['Log4js'], sort_keys=True, indent=4))

	with open(scfgPath + "/Platform.json", "w") as f:
		f.write(json.dumps(cfg['Platform'], sort_keys=True, indent=4))

	with open(scfgPath + "/SpecialAccount.json", "w") as f:
		f.write(json.dumps(cfg['SpecialAccount'], sort_keys=True, indent=4))

	#print("   ----> Write %s/Log.json "%(scfgPath))
	#with open(scfgPath + "/Log.json", "w") as f:
	#	f.write(json.dumps({"console": True}, sort_keys=True, indent=4))

	#print("   ----> Write %s/Cluster.json "%(scfgPath))
	with codecs.open(scfgPath + "/Cluster.json", "w", "utf-8") as f:
		f.write(json.dumps(cfg["Cluster"], sort_keys=True, ensure_ascii=False, indent=4))
	
	#print("   ----> Write %s/Redis.json "%(scfgPath))
	with open(scfgPath + "/Redis.json", "w") as f:
		f.write(json.dumps(cfg["Redis"], sort_keys=True, indent=4))

	#print("   ----> Write %s/Mysql.json "%(scfgPath))
	with open(scfgPath + "/Mysql.json", "w") as f:
		f.write(json.dumps(cfg["Mysql"], sort_keys=True, indent=4))

	#print()