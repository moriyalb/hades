const HadesDefine = require("./HadesDefine")
const Protocol = require("./HadesProtocol")
const Package = Protocol.Package

const MsgPack = require("msgpack-lite")
const _ = require("lodash")
const Utils = require("./Utils")
const MD5 = require("../../../Project/Datum/Json/MD5")
const HadesMD5 = require("../../../Project/Configs/Schema/HadesUUID")

const HANDSHAKE_TIMEOUT = 10000000 // 10 seconds

class HandShake{
	constructor(client){
		this.client = client
		this.hkId = null
		this.client.on("disconnect", this.cancel.bind(this))
		this.client.on("handshake", this.hand.bind(this))
	}

	hand(){
		let data = [
			65536,
			HadesMD5.uuid,
			MD5[0].md5,
			""
		]
		let buffer = Package.encode(Package.TYPE_HANDSHAKE, Utils.packListData(data))		
		this.client.emit("send", buffer)
		this.hkId = setTimeout(this.onHandshakeTimeout.bind(this), HANDSHAKE_TIMEOUT)
	}

	handAck(){
		let buffer = Package.encode(Package.TYPE_HANDSHAKE_ACK)
		this.client.emit("send", buffer)
	}

	handle(msg){
		let result = {}
		try{
			let decoder = new MsgPack.DecodeBuffer() 
			decoder.write(msg)
			result.code = decoder.read()
			//console.log("check on handshake -> ", result.code)
			switch (result.code){
			case HadesDefine.ResultCode.HS_CODE_OK:
				let _ = decoder.read() //later maybe sueful
				let hbSec = decoder.read()
				//start heart beat
				this.client.emit("heartbeat", hbSec)
				//send handshake ack
				this.handAck()
				break

			default:
				console.error("Hades HandShake Failed! -> ", result.code)
				this.client.emit("disconnect")
				break
			}
		}catch(e){
			console.error("HadesClient HandShake Exception -> ", e)
			this.client.emit("disconnect")
		}			
	}

	handleAck(msg){
		//maybe change the state
		this.cancel()
		this.client.state = HadesDefine.ClientState.CS_CONNECTED
		this.client.emit("connected")		
	}

	onHandshakeTimeout(){
		console.error("HadesClient Handshake Server Timeout !")
		this.hkId = null
		if (!!this.client)
			this.client.emit("disconnect")
	}

	cancel(){
		if (!!this.hkId){
			clearTimeout(this.hkId)
		}
	}
}

module.exports = HandShake