"use strict"

const _ = require("lodash")
const util = require("util")
const MsgPack = require("msgpack-lite")

const Hades = GlobalHades
const Methods = Hades.Schema.Methods
const Types = Hades.Schema.Types

class HadesMessage{
	constructor(){

	}

	init(){
		
	}

	/**
	 * Check the given handle request is backend msg.
	 * @param {uint} reqMapId 
	 */
	isBackendMsg(reqMapId){		
		let [ename, ] = Methods.handlerIds[reqMapId]
		let entity = Hades.Config.schemaEntities()[ename]
		return entity.server == Hades.Config.backendServer()
	}

	isNotifyMethod(reqMapId){
		let [ename, mname] = Methods.handlerIds[reqMapId]
		let mdef = Methods.handler[mname]
		return !mdef.resp
	}

	/**
	 * Get the handle arguments from client.
	 * @param {*} msg 
	 * @param {*} pid 
	 */
	handleRequest(msg, pid) {
		let args = []
		let reqMapId = msg.reqMapId
		let buffer = msg.body
		if (!buffer) {
			console.error("Invalid Request Body ", reqMapId, pid)
			return null
		}

		try {
			let decoder = new MsgPack.DecodeBuffer()
			decoder.write(Buffer.from(buffer))
			let [ename, mname] = Methods.handlerIds[reqMapId]
			let mdef = Methods.handler[mname]
	
			for (const [t,,,canNil] of mdef.req) {
				let v = decoder.read()
				if (!Types.assertType(t, v, canNil)) {
					console.error("Invalid Request Argments ", ename, mname, Types.getTypeDesc(t), v)
					return null
				}
				args.push(v)
			}		
		} catch (e) {
			console.error("Fail Get Request Argments ", msg.reqMapId, e)
			return null
		}

		Hades.Hook.hookCall(Hades.Const.Hook.ReqMessage, reqMapId, pid, args)
		return args
	}

	/**
	 * Pack the response args
	 * @param {uint} reqMapId 
	 * @param {*} resp 
	 * @param {*} pid 
	 * @param {*} cb 
	 */
	handleResponse(reqMapId, resp, pid, cb) {
		//check resp args if it is good
		//make msg pack 
		let [ename, mname] = Methods.handlerIds[reqMapId]
		let mdef = Methods.handler[mname]
	
		//mare sure result is good
		if (!resp || !resp.result){
			console.error("Response Result field is null -> ", ename, mname, resp)
			cb(null, null)
			return
		}
	
		resp = _.map(mdef.resp, n => {
			let t = n[0]
			let v = resp[n[1]]
			if (Hades.Config.isDebugging()){
				if (!Types.assertType(t, v, n[3])) {
				 	console.error("Invalid Response Argments ", ename, mname, Types.getTypeDesc(t), v)
				}
			}			
			return v
		})
	
		Hades.Hook.hookCall(Hades.Const.Hook.RespMessage, reqMapId, pid, resp)
	
		let totalLength = 0
		let repbuffs = _.map(resp, (v) => {
			let vb = MsgPack.encode(v)
			totalLength += vb.length
			return vb
		})
		let buffer = Buffer.concat(repbuffs, totalLength)
		cb(null, buffer)
	}

	handlePush(pushId, args, pid){
		let [ename, mname] = Methods.pushIds[pushId]
		let mdef = Methods.push[mname]
		//mare sure result is good
		if (!args){
			console.error("Push args is null -> ", ename, mname, pid)
			return
		}

		//console.log("handlepush -> ", pushId, args, pid)

		args = _.map(mdef.req, n => {
			let t = n[0]
			let v = args[n[1]]
			if (Hades.Config.isDebugging()){
				if (!Types.assertType(t, v, n[3])) {
				 	console.error("Invalid Push Argments ", ename, mname, Types.getTypeDesc(t), v)
				}
			}			
			return v
		})

		Hades.Hook.hookCall(Hades.Const.Hook.PushMessage, pushId, pid, args)
	
		let totalLength = 0
		let repbuffs = _.map(args, (v) => {
			let vb = MsgPack.encode(v)
			totalLength += vb.length
			return vb
		})

		return Buffer.concat(repbuffs, totalLength)
	}
}

module.exports = new HadesMessage()