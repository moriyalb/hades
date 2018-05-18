"use strict"

let _ = require("lodash")
const Hades = GlobalHades
const Methods = Hades.Schema.Methods
const produce = require("immer").default

/**
 * This wrapper is a remote mailbox wrapper.
 * which can invoke remote method or client method.
 * notice : don't save this wrapper, use it immediately or the serverId maybe changed(without notify)
 */
const RemoteMailboxWrapper = {
	get(target, key, receiver) {
		let ename = Reflect.get(target, "entityName")		
		let remotes = Hades.Schema.getMetaEntity(ename).remotes
		if (remotes.has(key)){
			let sid = Reflect.get(target, "backendID")
			//console.log("RemoteMailboxWrapper ->", key)
			return async (argObj) => {							
				if (!_checkValid(sid, argObj, ename, key)){
					return
				}
				
				let args = _handleArg(argObj, ename, key)
				let rpc = Hades.App.rpc(Hades.Config.backendServer(), ename, key)
				return await rpc(sid, Reflect.get(target, "entityID"), args)
			}
		}
		return Reflect.get(target, key, receiver)
    }
}

/**
 * This wrapper is only for create push method.
 * This mailbox can not be send from each server.
 * This mailbox is auto saved as `entity`.client property.
 */
const ClientMailboxWrapper = {
	get(target, key, receiver) {
		let pushes = Hades.Schema.getPushMethods(Hades.Config.clientProxy())
		if (pushes.has(key)){
			//console.log("ClientMailboxWrapper ->", key)
			let frontId = Reflect.get(target, "frontendID")
			let entityId = Reflect.get(target, "entityID")
			return async (argObj) => {				
				let pushId = Hades.Schema.Methods.push[key].id
				let msg = Hades.Message.handlePush(pushId, argObj, entityId)
				let uids = [{ sid: frontId, uid: entityId }]
				//console.log("check push result -> ", pushId, msg, uids)
				let fails = Hades.App.pushToClient(pushId, msg, uids)
				if (fails.length > 0){
					console.warn("ClientMailbox::push failed -> ", frontId, entityId, ename, key)
				}
			}
		}
		return Reflect.get(target, key, receiver)
	}
}

class ProxyMB{
	constructor(value){
		this._isMailbox = true
		this.entityName = value.entityName
		this.entityID = value.entityID
		this.backendID = value.backendID
		this.frontendID = value.frontendID
	}

	[Symbol.toStringTag](){
		return `ProxyMB(${this.entityID})`
	}
}

class MailBox {
	constructor(){

	}

	createStatic(ename, entity, eproto){
		let mb = {}
		for (let remote of entity.remotes){
			mb[remote] = async (routeParam, argObj) => {
				let sid
				if (entity.isSystem){
					sid = routeParam
				}else{
					sid = await eproto.onRoute.call(null, routeParam, ename)
				}
				
				if (!_checkValid(sid, argObj, ename, remote)){
					return
				}
				
				let args = _handleArg(argObj, ename, remote)
				let rpc = Hades.App.rpc(entity.server, ename, remote)
				return await rpc(sid, args)
			}
		}
		return mb
	}
	
	createClient(frontId, entityId){
		return new Proxy({
			frontendID: frontId,
			entityID: entityId
		}, ClientMailboxWrapper)
	}

	convertToJson(type, value, toJson){
		if (_.isNil(value)) return value
		
		type = Hades.Schema.Types.getType(type)
		let typeInfo = Hades.Schema.Types.getCompositeType(type)

		//console.log("convertToJson ", typeInfo)

		switch(typeInfo.ctype){
			case 'basic':
				if (typeInfo.type == "mailbox"){
					return toJson ? this._wrap(value) : this._unwrap(value)
				}				
			break

			case 'array':
				return produce(value, (draft)=>{
					for (let i = 0; i < draft.length; ++i){
						draft[i] = this.convertToJson(Hades.Schema.Types.getTypeId(typeInfo.type), draft[i], toJson)
					}
				})
			break

			case 'object':
				return produce(value, (draft)=>{
					let fields = typeInfo.fields
					for (let fname in fields){
						draft[fname] = this.convertToJson(Hades.Schema.Types.getTypeId(fields[fname]), draft[fname], toJson)
					}
				})
			break

			case 'map':
				return produce(value, (draft)=>{
					for (let key in draft){
						draft[key] = this.convertToJson(Hades.Schema.Types.getTypeId(typeInfo.valueType), draft[key], toJson)
					}
				})
			break
		}	
		
		return value
	}

	_wrap(value){
		//console.log("Mailbox wrap -> ", value)
		if (value._isEntity){
			return {
				"entityName" : value._ename,
				"entityID" : value._eid,
				"backendID" : Hades.Config.getServerId(),
				"frontendID" : value._frontId
			}
		}else if(value._isMailbox){
			return value
		}else{
			console.error("Mailbox::Fail to wrap mailbox -> ", value)
		}		
	}

	_unwrap(value){
		if (value.backendID == Hades.Config.getServerId()){
			let entity = Hades.SysLocal.PlayerMgr.getPlayer(value.entityID)
			if (!!entity){
				return entity
			}
		}
		let mb = new Proxy(value, RemoteMailboxWrapper)
		mb.client = this.createClient(value.frontendID, value.entityID)
		return mb
	}	
}

function _checkValid(sid, argObj, ename, remote){
	if (Hades.Config.isDebugging()){
		if (!Hades.Config.isValidServerId(sid)){
			console.error("Invalid System Remote Call -> ", ename, remote, sid)
			return false
		}
		let reqs = Methods.remote[remote].req
		for (let req of reqs){
			let type = req[0]
			let key = req[1]
			if (!Hades.Schema.Types.assertType(type, argObj[key], req[3])){
				console.error("Invalid System Remote Call Arguments -> ", ename, remote, req)
				return false
			}
		}
	}
	return true
}

function _handleArg(argObj, ename, remote){
	//console.log("_handleArg ", ename, remote, argObj)
	let reqs = Methods.remote[remote].req
	let args = {}
	for (let req of reqs){
		//console.log("Check req -> ", argObj, req)
		let type = req[0]
		let key = req[1]
		args[key] = _mb.convertToJson(type, argObj[key], true)
	}
	//console.log("_handleArg Done ", args)
	return args
}

const _mb = new MailBox()
module.exports = _mb