"use strict"

const R = require("ramda")
const _ = require("lodash")
const ioredis = require("ioredis")

const Hades = GlobalHades
const HadesConfig = Hades.Config
const HadesConst = Hades.Const

const CACHE_EXPIRE = 60 * 60 * 24 * 60

class RedisMgr {
	constructor(){
		this.clients = {}
	}

	_initRedisClient(cfg){
		let client
		try{
			let rcfg = {
				host: cfg.host,
				port: cfg.port,
				password: cfg.passwd,
				parser: 'javascript',
				dropBufferSupport: true //buffer is not supported!
			}
			client = new ioredis(rcfg)
		}catch(e){
			console.error("RedisMgr::Failed to init redis -> ", cfg, e)
		}
		return client
	}

	init(){
		let redises = [
			HadesConst.RedisType.RT_CLUSTER_PERSISTENT,
			HadesConst.RedisType.RT_CLUSTER_CACHE,
			HadesConst.RedisType.RT_PROJECT_CACHE
		]
		for (let rds of redises){
			let cfgName = HadesConst.RedisConfig[rds]
			let cfg = HadesConfig.redisCfg()[cfgName]
			if (rds == HadesConst.RedisType.RT_PROJECT_CACHE){
				cfg = cfg[HadesConfig.getEnv()]
			}
			if (!this.clients[rds]){
				this.clients[rds] = this._initRedisClient(cfg)
			}			
		}		
	}

	clientClusterPersistent(){
		return this.clients[HadesConst.RedisType.RT_CLUSTER_PERSISTENT]
	}

	clientClusterCache(){
		return this.clients[HadesConst.RedisType.RT_CLUSTER_CACHE]
	}

	clientProjectCache(){
		return this.clients[HadesConst.RedisType.RT_PROJECT_CACHE]
	}

	//redis handlers
	_mirrorKey(guid){
		return HadesConst.RedisKey.Mirror + guid
	}

	async existProxy(guid) {
		return await this.clientClusterCache().exists(this._mirrorKey(guid))
	}

	async refreshProxy(guid, values) {
		await this.clientClusterCache().hmset(this._mirrorKey(guid), values)
	}

	async fetchProxy(guid, ...keys) {
		return await this.clientClusterCache().hmget(this._mirrorKey(guid), ...keys)
	}

	async fetchProxyServer(guid) {
		return await this.clientClusterCache().hmget(this._mirrorKey(guid), HadesConst.RedisKey.BackendID, HadesConst.RedisKey.FrontendID, HadesConst.RedisKey.OfflineTime)
	}

	async persistProxy(guid) {
		await this.clientClusterCache().persist(this._mirrorKey(guid))
	}

	async removeProxy(guid) {
		await this.clientClusterCache().hmset(this._mirrorKey(guid), HadesConst.RedisKey.OfflineTime, parseInt(_.now() / 1000))
		await this.clientClusterCache().expire(this._mirrorKey(guid), CACHE_EXPIRE)
	}

	async initGUID() {
		let rhguid = this.clientClusterPersistent()
        let guid = await rhguid.get(HadesConst.RedisKey.GUID)
        if (!guid || guid < HadesConst.GUID_BASE) {
            await rhguid.set(HadesConst.RedisKey.GUID, HadesConst.GUID_BASE)
        }
	}

	async getGUID(account) {
		let acc = account
		if (HadesConfig.clusterCfg().StandaloneAccount){
			acc = HadesConfig.getEnv() + ":" + acc
		}
		let rhaccount = this.clientClusterPersistent()
		let guid = await rhaccount.get(acc)
		let isNewbie = false
		if (!guid){
			isNewbie = true
			let rhguid = this.clientClusterPersistent()			
			guid = await rhguid.incr(HadesConst.RedisKey.GUID)
			await rhaccount.set(acc, guid)
		}
		guid = _.toSafeInteger(guid)
        return {guid, isNewbie}
	}

	async isExistsNick(nick){
		let rhnick = this.clientClusterPersistent()
		let pids = await rhnick.smembers(nick)
		if (_.isEmpty(pids)) return false
		for (let info of pids){
			let tmp = info.split(':')
			if (tmp[0] == HadesConfig.getEnv()) return true
		}
		return false
	}

	async changeNick(guid, oldNick, nick){
		let rhnick = this.clientClusterPersistent()
		if (oldNick != ""){
			await rhnick.srem(oldNick, HadesConfig.getEnv() + ":" + guid)
		}
		await rhnick.sadd(nick, HadesConfig.getEnv() + ":" + guid)
	}

	//TODO
	async getRandomNick(){
		let rhnick = this.clientClusterPersistent()
		return await rhnick.scan()
	}

	async setEnv(guid){
		let env = await this.getEnv(guid)
		if (!_.isNil(env)) return
		let rhpid = this.clientClusterPersistent()
		await rhpid.hmset(this.parsePersistentKey(guid), HadesConst.RedisKey.ENV, HadesConfig.getEnv())
	}

	async getEnv(guid){
		let rhpid = this.clientClusterPersistent()
		let env = await rhpid.hmget(this.parsePersistentKey(guid), HadesConst.RedisKey.ENV)
		return env[0]
	}

	async getPidsByNick(nick){
		let rhnick = this.clientClusterPersistent()
		let pids = await rhnick.smembers(nick)
		return pids
	}

	parsePersistentKey(guid){
		return `Persistent:${guid}`
	}
}

module.exports = new RedisMgr()