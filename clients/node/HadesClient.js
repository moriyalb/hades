const Protocol = require("./HadesProtocol")
const Package = Protocol.Package
const Message = Protocol.Message
const WS = require("ws")
const net = require("net")

const _ = require("lodash")
const Events = require("events")

const HadesDefine = require("./HadesDefine")
const HandShake = require("./HandShake")
const HeartBeat = require("./HeartBeat")
const Utils = require("./Utils")

class HadesClient extends Events{
	constructor() {
		super()
		this.socket = null		
		this.on("send", this._send.bind(this))
		this.on("disconnect", this._disconnect.bind(this))
		this.init()
	}

	init(){
		this.handshake = new HandShake(this)
		this.heartbeat = new HeartBeat(this)

		this.handlers = {
			[Package.TYPE_HANDSHAKE] : this.handshake.handle.bind(this.handshake),
			[Package.TYPE_HANDSHAKE_ACK] : this.handshake.handleAck.bind(this.handshake),
			[Package.TYPE_HEARTBEAT] : this.heartbeat.handle.bind(this.heartbeat),
			[Package.TYPE_DATA] : this._onData.bind(this),
			[Package.TYPE_KICK] : (msg) => { console.log("on kick wait") },
		}

		this.pushHandlers = {
		}

		this.state = HadesDefine.ClientState.CS_INITED
		this.resolveHolder = null
		this.rejectHolder = null
	}

	/**
	 * connect to the given connector, when connected, y
	 * @param {string} host 
	 * @param {int} port
	 * @returns {result:ResultCode}
	 */
	connect(connector) {
		this.socket = new WS(`ws://${connector[0]}:${connector[1]}`)
		this.socket.binaryType = "arraybuffer"
		this.state = HadesDefine.ClientState.CS_CONNECTING

		this.socket.onopen = event => {
			this.emit("onSocketOpen")
			this.emit("handshake")			
		}

		this.socket.onmessage = event => {
			let msg = Package.decode(Buffer.from(event.data))		
			this.emit("onRecvRecord")
			this.handlers[msg.type](msg.body)
			this.emit("done_response")
		}

		this.socket.onerror = event => {
			console.log('socket error %j', event)
			this.emit("failed")
			this._disconnect()
			if (!!this.rejectHolder){
				this.rejectHolder(new Error(`Socket is Closed!`))
				this.rejectHolder = null
			}
		}

		this.socket.onclose = event => {
			// console.log('socket close')
			this.socket = null
			if (!!this.rejectHolder){
				this.rejectHolder(new Error(`Socket is Closed!`))
				this.rejectHolder = null
			}
			this.emit("close")
		}
	}

	// connect(connector){
	// 	this.socket = net.createConnection( {host:connector[0], port:connector[1]}, ()=>{
	// 		this.emit("onSocketOpen")
	//  		this.emit("handshake")	
	// 	})
	// 	this.socket.on('data', (data)=>{			
	// 		let msgs = Package.decode(Buffer.from(data))
	// 		if (_.isArray(msgs)){
	// 			for (let msg of msgs){
	// 				this.emit("onRecvRecord")
	// 				this.handlers[msg.type](msg.body)
	// 			}
	// 		}else{
	// 			this.emit("onRecvRecord")
	// 			this.handlers[msgs.type](msgs.body)
	// 		}
	// 		//console.log("check data -> ", data, msg)
	 		
	// 	})
	// 	this.socket.on('end', ()=>{
	// 		console.log('socket close')
	// 		this.socket = null
	// 		if (!!this.rejectHolder){
	// 			this.rejectHolder(new Error(`Socket is Closed!`))
	// 			this.rejectHolder = null
	// 		}
	// 		this.emit("close")
	// 	})
	// }

	/**
	 * disconncet from the connector
	 */
	async disconnect() {
		await this._disconnect()
	}

	/**
	 * 
	 * @param {int} mapId 
	 * @param {buffer} msg
	 * @returns {result:ResultCode, data:buffer}
	 */
	async request(handlerName, msg) {
		return new Promise((resolve, reject)=>{
			if (this.state != HadesDefine.ClientState.CS_CONNECTED){
				//reject(new Error(`Request Failed! Invalid Client State -> ${this.state}`))
				resolve(null)
				return
			}
			let method = Utils.getMethod(Message.TYPE_REQUEST, handlerName)
			if (!method) {
				resolve(null)
				return
			}
			this.state = HadesDefine.ClientState.CS_WORKING
			this.resolveHolder = resolve
			this.rejectHolder = reject
			let data = Utils.packMsg(method.req, msg)
			data = Message.encode(Message.TYPE_REQUEST, method.id, data)
			let packet = Package.encode(Package.TYPE_DATA, data)
			this._send(packet, method.id)

			this.emit("do_request")
		})		
	}

	/**
	 * 
	 * @param {int} mapId 
	 * @param {buffer} data
	 * @return null
	 */
	notify(mapId, data) {

	}

	/**
	 * 
	 * @param {*} mapId 
	 * @param {*} handler with a buffer arg
	 */
	registerPush(pushName, handler) {		
		let method = Utils.getMethod(Message.TYPE_PUSH, pushName)
		let mapId = method.id
		
		if (!!this.pushHandlers[mapId]){
			this.pushHandlers[mapId].push(handler)
		}else{
			this.pushHandlers[mapId] = [handler]
		}
	}

	/**
	 * 
	 */
	clearAllPush() {
		this.pushHandlers = {}
	}

	/**
	 * Privates
	 */
	_send(data, tag){		
		if (!!this.socket){
			//console.log("socket sending -> ", data)
			this.emit("onSendRecord")
			this.socket.send(data, {binary:true, mask:true, ___tag:tag})
			//this.socket.write(data)
		}		
	}

	_onData(data){
		let msg = Message.decode(data)
		//console.log("HadesClient :: _onData -> %j ", msg)

		let id = msg.reqMapId
		let handlerName = Utils.getHandlerName(msg.msgType, id)
		let method = Utils.getMethod(msg.msgType, handlerName)
		
		if (msg.msgType == Message.TYPE_RESPONSE){
			let result = Utils.unpackMsg(method.resp, msg.body, handlerName)
			// console.log('hadesClient resp ->', id, handlerName, result)
			this._onResponse(result)
		}else if (msg.msgType == Message.TYPE_PUSH){
			let result = Utils.unpackMsg(method.req, msg.body, handlerName)
			this._onPush(id, result)
		}else{
			if (!!this.rejectHolder){
				this.rejectHolder(new Error(`Invalid msg type -> ${msg.msgType} , ${msg.reqMapId}`))
				this.rejectHolder = null
			}
		}
	}

	_onResponse(result){
		if (!!this.resolveHolder){
			this.resolveHolder(result)
			this.resolveHolder = null
		}		
		this.state = HadesDefine.ClientState.CS_CONNECTED
	}

	_onPush(id, result){
		//console.log("On Push Called -> ", id, result)
		if (!!this.pushHandlers[id]){
			for (let h of this.pushHandlers[id]){
				h(result)
			}
		}
	}

	_disconnect(){
		if (!!this.socket){
			// console.log("close the sock !")
			if(this.socket.disconnect) this.socket.disconnect()
			if(this.socket.close) this.socket.close()
			this.socket = null
			this.emit("close")
			this.state = HadesDefine.ClientState.CS_INITED
		}
	}
}

module.exports = HadesClient