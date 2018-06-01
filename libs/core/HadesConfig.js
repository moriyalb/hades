"use strict"

const _ = require("lodash")
const R = require("ramda")
const path = require("path")
const HadesConst = require("./HadesConst")

/**
 * Config Loaders.
 * This module read all the project settings.(configs and entity scripts)
 */
class HadesConfig {
	constructor(){
	}

	/**
	 * reset all configs in project path. this methods should be called very first on the server beginning.
	 * you can also use this method to hot update the server configs. (But you should also do other updates for the hot fix)
	 * @param {string} cfgPath 
	 */
	resetConfig(projectRoot){
		//Hack msgpack lib 
		//I don't think this should be good, but we don't have other choice maybe.
		//make sure the node_modules and project root as the sample project.
		const MsgPack = require("msgpack-lite")
		MsgPack.DecodeBuffer = require(`${projectRoot}/../node_modules/msgpack-lite/lib/decode-buffer`).DecodeBuffer
		MsgPack.EncodeBuffer = require(`${projectRoot}/../node_modules/msgpack-lite/lib/encode-buffer`).EncodeBuffer

		const ProjectConfigPath = `${projectRoot}/Configs`
		const SchemaEntitiesPath = `${projectRoot}/Entities`
		const SchemaCfg = `${ProjectConfigPath}/Schema`
		const OrmCfg = `${ProjectConfigPath}/Orm`
		const ServerCfg = `${ProjectConfigPath}/Server`

		//server configs
		this.masterCfg = this.__requireConfig(ServerCfg + "/Master")		
		this.adminCfg = this.__requireConfig(ServerCfg + "/Admin")
		this.adminUserCfg = this.__requireConfig(ServerCfg + "/AdminUser")
		this.clusterCfg = this.__requireConfig(ServerCfg + "/Cluster")
		this.log4jCfg = this.__requireConfig(ServerCfg + "/Log4js")				
		this.serverCfg = this.__requireConfig(ServerCfg + "/Servers")
		this.mysqlCfg = this.__requireConfig(ServerCfg + "/Mysql")
		this.redisCfg = this.__requireConfig(ServerCfg + "/Redis")
		this.platformCfg = this.__requireConfig(ServerCfg + "/Platform") //TODO
		this.specialAccountCfg = this.__requireConfig(ServerCfg + "/SpecialAccount") //TODO

		//schema configs
		this.entitiesPath = R.always(SchemaEntitiesPath)
		this.schemaEntities = this.__requireConfig(SchemaCfg + "/Entities")
		this.schemaUUID = this.__requireConfig(SchemaCfg + "/HadesUUID")
		this.schemaMethods = this.__requireConfig(SchemaCfg + "/Methods")
		this.schemaTypes = this.__requireConfig(SchemaCfg + "/Types")
		this.schemaProxyDefine = this.__requireConfig(SchemaCfg + "/ProxyDefine")

		//orm configs
		this.ormModel = this.__requireConfig(OrmCfg + "/OrmModel")

		//init from process arguments
		this.__initEnv()

		//save root
		this.projectRoot = R.always(projectRoot)
	}

	__requireConfig(cfgPath){
		let cfg
		try{
			delete require.cache[require.resolve(cfgPath)]
			cfg = require(cfgPath)
		}catch(e){
			console.error("Invalid Hades Config Settings !", cfgPath, e)
		}
		return R.always(cfg)
	}

	__initEnv(){
		this.isMaster = R.F		
		//console.log("process.argv ", process.argv)
		for (let arg of process.argv){
			if (arg.startsWith("env=")){
				this.env = arg.substr(4)
			}else if (arg.startsWith("serverType=")){
				this.serverType = arg.substr(11)
			}else if (arg.startsWith("id=")){
				this.serverId = arg.substr(3)				
			}else if (arg.startsWith("type=all")){
				this.isMaster = R.T
				this.serverType = "master"
				this.serverId = "master"
			}
		}

		if (!!this.serverId){
			let [index] = this.serverId.split("_").reverse()
			this.serverIndex = index
		}else{
			this.serverIndex = 0
		}		
	}

	getBaseEnvs(){
		return _.keys(this.clusterCfg().Connectors)
	}

	getEnv(){
		return this.env
	}

	getEnvType(){
		let envName = this.env.split("_")[0]
		return this.clusterCfg().Envs[envName]
	}

	matchEnv(env){
		if (env == HadesConst.ClusterType.All) return true
		return env == this.getEnvType()
	}

	getServerIndex(){
		return this.serverIndex
	}

	getExtras(){
		return this.clusterCfg().Extras[this.env]
	}

	getServerType(){
		return this.serverType
	}

	checkServerType(st){
		return this.serverType === st
	}

	matchServer(servers){
		return servers.length == 0 || _.indexOf(servers, this.serverType) >= 0
	}

	getServerId() {
		return this.serverId
	}

	getServerTag() {
		if (this.isMaster()){
			return `${this.env}_master`
		}else{
			return this.serverId
		}
	}

	loginProxy(){
		return this.schemaProxyDefine().LoginProxy
	}

	clientProxy(){
		return this.schemaProxyDefine().ClientProxy
	}

	backendServer(){
		return this.schemaProxyDefine().ClientProxyServer
	}

	frontendServer(){
		return this.schemaProxyDefine().LoginProxyServer
	}

	isFrontend(){
		return this.serverType == this.schemaProxyDefine().LoginProxyServer
	}

	isBackend(){
		return this.serverType == this.schemaProxyDefine().ClientProxyServer
	}

	randomBackendServer(){
		let svrs = this.serverCfg()[this.env][this.backendServer()]
		return _.sample(svrs).id
	}

	//This server can operate some special redis command
	isUniqueMaster(){
		return this.isMaster() && this.env == "Unique" 
	}	

	//TODO
	isValidServerId(st){
		return true 
	}

	isLocalServer(){
		return this.getGameNo() < 2000
	}

	getGameNo(){
		return this.clusterCfg().GameNo
	}

}

module.exports = new HadesConfig()