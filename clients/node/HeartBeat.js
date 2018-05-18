const HadesDefine = require("./HadesDefine")
const Protocol = require("./HadesProtocol")
const Package = Protocol.Package

const _ = require("lodash")

const HEARTBEAT_TIMEOUT_FACTOR = 2

class HeartBeat{
	constructor(client){
		this.client = client
		this.hbId = null
		this.client.on("disconnect", this.cancel.bind(this))
		this.client.on("heartbeat", this.start.bind(this))
		this.client.on("close", this.cancel.bind(this))
	}

	start(hbSec){
		//console.log("Start Heartbeat -> ", hbSec)
		const hbMs = hbSec * 1000
		if (!this.hbId){
			this.hbId = setInterval(()=>{
				this.heartbeat()
			}, hbMs)
		}
		this.heartbeatDone = _.debounce(this.onTimeout, hbMs * 2)
		this.heartbeatDone()
	}

	heartbeat(){
		let buffer = Package.encode(Package.TYPE_HEARTBEAT)
		this.client.emit("send", buffer)
	}

	handle(msg){
		//console.log("heartbeat handle ->")
		this.heartbeatDone()
	}

	onTimeout(){
		console.error("HadesClient Heartbeat Timeout -> ")
		this.client.emit("disconnect")
	}

	cancel(){
		if (!!this.hbId){
			clearInterval(this.hbId)
			this.hbId = null
		}
	}
}

module.exports = HeartBeat;