"use strict"

const _ = require("lodash")
const path = require("path")
const Hades = GlobalHades
const Methods = Hades.Schema.Methods
const Mailbox = Hades.Schema.Mailbox

const SysEntityPath = `${path.dirname(__filename)}/../entity`

class CommunicateMgr {
    constructor(){
		//real handlers
		this.remotesHandle = {}		
		//remote desc
		this.remotesProxy = {}
    }

    init(){
		for (let ename in Hades.Schema.allEntities()){
			let entity = Hades.Schema.allEntities()[ename]
			let Local = entity.isSystem ? Hades.SysLocal : Hades.Local
			let Remote = entity.isSystem ? Hades.SysRemote : Hades.Remote

			//console.log("Check entity -> ", ename, entity)
			if (entity.etype == Hades.Const.EntityType.Single){
				//Local
				if (Hades.Config.checkServerType(entity.server)){
					let ent = Hades.Schema.Entity.createSingle(ename)					
					Local[ename] = ent
					for (let remote of entity.remotes){
						this._addRemoteHandle(ename, entity.server, remote, _.partial(this._handleSingleRemote.bind(this), ent, remote)	)		
					}
				}
				//Remote
				Remote[ename] = Mailbox.createStatic(ename, entity, Hades.Schema.getEntityProto(ename))
				for (let remote of entity.remotes){
					this._addRemoteProxy(ename, entity.server, remote)			
				}	
			}else if (entity.etype == Hades.Const.EntityType.Proxy){				
				//Local
				if (Hades.Config.checkServerType(entity.server)){
					for (let remote of entity.remotes){
						this._addRemoteHandle(ename, entity.server, remote, _.partial(this._handleProxyRemote.bind(this), remote))			
					}
				}
				//Remote
				for (let remote of entity.remotes){
					this._addRemoteProxy(ename, entity.server, remote)			
				}	
			}
		}
	}

	//for remote component
	getRemoteHandle(st){
		//console.log("getRemoteHandle ", st)
		return this.remotesHandle[st]
	}

	//for proxy component
	getRemoteProxy(st){
		//console.log("getRemoteProxy ", st)
		return this.remotesProxy[st]
	}

	_addRemoteHandle(tp, st, method, handler){
		//console.log("_addRemoteHandle ", tp, st, method)
		if (!this.remotesHandle[st]) {
			this.remotesHandle[st] = {}
		}
		if (!this.remotesHandle[st][tp]) {
			this.remotesHandle[st][tp] = {}
		}
		this.remotesHandle[st][tp][method] = handler
	}

	_addRemoteProxy(tp, st, method){
		if (!this.remotesProxy[st]) {
			this.remotesProxy[st] = {}
		}
		if (!this.remotesProxy[st][tp]) {
			this.remotesProxy[st][tp] = []
		}
		this.remotesProxy[st][tp].push(method)
	}

	async _handleSingleRemote(entity, method, args, cb){
		//console.log("_handleSingleRemote -> ", method, args)
		args = this._handleRemoteReq(args, method)		

		Hades.Event.emit(Hades.Event.HOOK_ON_REMOTE_REQ_MSG, entity._ename, method, args)

		let resp = await entity[method].call(entity, args)
		resp = this._handleRemoteResp(resp, method)

		Hades.Event.emit(Hades.Event.HOOK_ON_REMOTE_RESP_MSG, entity._ename, method, resp)
		//console.log("done _handleSingleRemote -> ", resp)
		cb(null, resp)
	}

	async _handleProxyRemote(method, proxyId, args, cb){
		//console.log("_handleProxyRemote -> ", method, proxyId, args)
		args = this._handleRemoteReq(args, method)
		let proxy = Hades.SysLocal.PlayerMgr.getPlayer(proxyId)

		Hades.Event.emit(Hades.Event.HOOK_ON_REMOTE_REQ_MSG, proxyId, method, args)

		if (!proxy){
			console.error("Invalid Remote Call. Player is offline -> ", proxyId, method)
			cb(null)
			return
		}
		let resp = await proxy[method].call(proxy, args)
		resp = this._handleRemoteResp(resp, method)

		Hades.Event.emit(Hades.Event.HOOK_ON_REMOTE_RESP_MSG, proxyId, method, args)
		//console.log("done _handleProxyRemote -> ", resp)
		cb(null, resp)
	}

	_handleRemoteReq(argObj, remote){
		let reqs = Methods.remote[remote].req
		let args = {}
		for (let req of reqs){
			let type = req[0]
			let key = req[1]
			args[key] = Hades.Schema.Mailbox.convertToJson(type, argObj[key], false)
		}
		return args
	}

	_handleRemoteResp(argObj, remote){
		let reqs = Methods.remote[remote].resp
		if (!reqs) return argObj
		if (!argObj) return argObj
		let args = {}
		for (let req of reqs){
			let type = req[0]
			let key = req[1]
			args[key] = Hades.Schema.Mailbox.convertToJson(type, argObj[key], true)
		}
		return args
	}
}

module.exports = new CommunicateMgr()