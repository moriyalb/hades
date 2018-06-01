"use strict"

const _ = require("lodash")
const util = require("util")

const Hades = GlobalHades

class HadesApp{
	constructor(){
		this.app = null
	}

	createApp(name){
		if (!!this.app){
			console.error("Application is already created!")
			return
		}
		this.app = Hades.Pomelo.createApp()
		this.app.set("name", name)
		this.registerAdmin = this.app.registerAdmin.bind(this.app)
		return this
	}

	start(cb){
		if (!this.app){
			console.error("Application is not created!")
			return
		}
		
		this.app.start((err)=>{
			if (err){
				console.error("Application start failed! ", err)
				cb(new Error(err))
				return
			}
			this._start()			
			cb()
		})
	}

	configConnector(opts){
		if (Hades.Config.isFrontend()){
			//console.log("Set Connector -> ", opts)
			this.app.set('connectorConfig', {
				connector: Hades.Pomelo.connectors.hybridconnector,
				handshake: {
					datumMd5: opts.datumMd5 || "",
					foreDtMd5: opts.foreDtMd5 || "",							
				},
				timeout: opts.timeout || 10000,
				heartbeat: opts.heartbeat || 15000,
				lag: opts.lag || 0,
				useCrypto: false
			})
		}
	}

	configure(cfgs){
		for (let [env, st, func] of cfgs){
			//console.log("on configure -> ", env, st, Hades.Config.matchEnv(env), Hades.Config.matchServer(st))
			if (!Hades.Config.matchEnv(env)){
				continue
			}
			if (!Hades.Config.matchServer(st)){
				continue
			}
			func.call(null)			
		}	
	}

	rpc(st, ename, remote){
		//console.log("HadesApp Rpc -> ", st, ename, remote, this.app.rpc)
		return util.promisify(this.app.rpc[st][ename][remote].toServer)
	}

	async pushToClient(pushId, msg, uids){
		let channelService = this.app.get("channelService")
		let pushMethod = util.promisify(channelService.pushMessageByUids.bind(channelService))
		return await pushMethod(pushId, msg, uids)
	}

	getSessionService(){
		return this.app.get("sessionService")
	}

	hasSession(sid){
		return !!this.app.get("sessionService").get(sid)
	}

	getBackendId(session){
		return session.get("backendID")
	}

	async kickByUidBackend(frontID, playerID, reason) {
		let backendSessionService = this.app.get("backendSessionService")
		await util.promisify(backendSessionService.kickByUid.bind(backendSessionService))(frontID, playerID, reason)
	}
	
	async kickByUidFrontend(frontID, playerID, reason) {
		if (frontID == Hades.Config.getServerId()){
			let sessionService = this.app.get("sessionService")
			await util.promisify(sessionService.kick.bind(sessionService))(playerID, reason)
		}else{
			await Hades.SysRemote.LoginMgr.kickProxy(frontID, {
				proxyId:playerID,
				reason:"RELOGIN"
			})
		}		
	}

	routeDefaultBase(ename, env){
		//console.log("routeDefaultBase -< ", env, ename)
		let entity = Hades.Config.schemaEntities()[ename]		
		let {___, count} = Hades.Config.clusterCfg().Servers[entity.server]
		if (!env) env = Hades.Config.getEnv()
		return `${env}_${entity.server}_${_.random(1, count)}`
	}

	routeDefaultUnique(ename){
		let entity = Hades.Config.schemaEntities()[ename]		
		let {env, count} = Hades.Config.clusterCfg().Servers[entity.server]
		return `${env}_${entity.server}_${_.random(1, count)}`
	}

	_start(){
		this._addClusterServer()
		if (Hades.Config.isUniqueMaster()) {
			Hades.RedisMgr.initGUID()
		}
	}

	_addClusterServer(){
		for (let env in Hades.Config.serverCfg()) {			
			if (env ===  Hades.Config.getEnv()) continue
			let config = Hades.Config.serverCfg()[env]
			for (let serverType in config) {
				let servers = config[serverType]
				for (let sinfo of servers) {					
					this.app.addServers([{
						id : sinfo.id,
						serverType : serverType,
						host: sinfo.host,
						port: sinfo.port
					}])
				}
			}            
		}
	}


}

module.exports = new HadesApp()