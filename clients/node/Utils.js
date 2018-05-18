const MsgPack = require("msgpack-lite")
MsgPack.DecodeBuffer = require(`../../../node_modules/msgpack-lite/lib/decode-buffer`).DecodeBuffer
MsgPack.EncodeBuffer = require(`../../../node_modules/msgpack-lite/lib/encode-buffer`).EncodeBuffer

const Methods = require("../../../Project/Configs/Schema/Methods")
const _ = require("lodash")

const Protocol = require("./HadesProtocol")
const Package = Protocol.Package
const Message = Protocol.Message

let Utils = module.exports = {}

Utils.sleep = function(time) {
    return new Promise((resolve, reject)=>{
        setTimeout(resolve, time)
    })
}

Utils.packListData = function(raw){
	let totalLength = 0
	let repbuffs = _.map(raw, (v) => {
		let vb = MsgPack.encode(v)
		totalLength += vb.length
		return vb
	})
	return Buffer.concat(repbuffs, totalLength)
}

//scope : handler / push
Utils.getMethod = function(mt, name){
	if (mt == Message.TYPE_REQUEST || mt == Message.TYPE_RESPONSE){
		return Methods.handler[name]
	}else if (mt == Message.TYPE_PUSH){
		return Methods.push[name]
	}
	return null
}

Utils.getHandlerName = function(mt, id){
	if (mt == Message.TYPE_REQUEST || mt == Message.TYPE_RESPONSE){
		return Methods.handlerIds[id][1]
	}else if (mt == Message.TYPE_PUSH){
		return Methods.pushIds[id][1]
	}
	return ""
}

Utils.packMsg = function(args, data){
	let totalLength = 0
	let repbuffs = _.map(args, (v) => {
		let vb = MsgPack.encode(data[v[1]])
		totalLength += vb.length
		return vb
	})
	return Buffer.concat(repbuffs, totalLength)
}

Utils.unpackMsg = function(args, data, id){
	let msg = {}
	let decoder = new MsgPack.DecodeBuffer() 
	decoder.write(data)
	//console.log("unpack Msg -> ", args, data)
	for (let arg of args){
		let obj = decoder.read()
		//console.log("	upackMsg step -> ", obj)
		msg[arg[1]] = obj
	}
	return msg
}
