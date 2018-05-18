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

		this.get = this.app.get.bind(this.app)
		//this.set = this.app.set.bind(this.app)
		return this
	}

	start(cb){
		if (!this.app){
			console.error("Application is not created!")
			return
		}

		//route proxy forward message for handlers.
		this.app.route(Hades.Config.backendServer(), (session, msg, app, cb) => {
			cb(null, session.get("backendID"))
		})
		
		this.app.start((err)=>{
			if (err){
				console.error("Application start failed! ", err)
				cb(new Error(err))
				return
			}
			this._start()
			this._addClusterServer()
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
		return util.promisify(this.app.rpc[st][ename][remote].toServer)
	}

	async pushToClient(pushId, msg, uids){
		let channelService = this.app.get("channelService")
		let pushMethod = util.promisify(channelService.pushMessageByUids.bind(channelService))
		return await pushMethod(pushId, msg, uids)
	}

	routeDefaultBase(env, ename){
		console.log("routeDefaultBase -< ", env, ename)
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
		if (Hades.Config.isUniqueMaster()) {
			Hades.RedisMgr.initGUID()
		}
	}

	_addClusterServer(){
		let config = _.omit(Hades.Config.serverCfg(), Hades.Config.getEnv())
		for (let env in config) {
			for (let serverType in config[env]) {
				let servers = config[env][serverType]
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