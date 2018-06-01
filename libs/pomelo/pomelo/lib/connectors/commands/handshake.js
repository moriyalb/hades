const Hades = GlobalHades
const Protocol = Hades.Protocol
const Package = Protocol.Package

const ProtocolVersion = Protocol.VERSION
const ProtocolMD5 = GlobalHades.Config.schemaUUID().uuid

const msgpack = require("msgpack-lite")
const _ = require("lodash")

const HS_CODE_OK = 200
const HS_CODE_UNKOWN_ERROR = 500
const HS_CODE_INVALID_VERSION = 501
const HS_CODE_UNMATCH_MD5 = 502
const HS_CODE_INVALID_RSA = 503
const HS_CODE_UNMATCH_DT_MD5 = 504


/**
 * Process the handshake request.
 *
 * opts.handshake ->
 *  protoVer:HadesProtocolVersion
 *  hadesDefMd5:HadesDefineMd5
 *  hadesDefMap:HadesDefineMap
 */
var Command = function(opts) {
    opts = opts || {}
    if(opts.heartbeat) {
        this.heartbeatSec = opts.heartbeat
        this.heartbeat = opts.heartbeat * 1000
    }else{
        this.heartbeatSec = 10
        this.heartbeat = 10000
    }
    this.userHandshake = opts.handshake
	this.useCrypto = opts.useCrypto
	
	this.robots = {
		handshake : 0,
		handshakeResp : 0,
		handshakeAck : 0,
		handshakeAckResp : 0,
	}

	// setInterval(()=>{
	// 	console.log("Handshake check -> ", this.robots)
	// }, 1000)
}

module.exports = Command

Command.prototype.handle = function(socket, msg) {
	let data = {}
	this.robots.handshake += 1
    try{
        let decoder = new msgpack.DecodeBuffer() 
        decoder.write(msg)
		data.version = decoder.read()
		data.edmd5 = decoder.read()
		data.dtmd5 = decoder.read()
		data.rsa = decoder.read()
    }catch(e){
        processError(socket, HS_CODE_UNKOWN_ERROR)
        return
    }

    if (data.version != ProtocolVersion){
        processError(socket, HS_CODE_INVALID_VERSION)
        return
    }

	let resp = [HS_CODE_OK, Hades.TimeUtil.msnow(), this.heartbeatSec, this.userHandshake.datumMd5]

    if (data.edmd5 != ProtocolMD5){
        processError(socket, HS_CODE_UNMATCH_MD5)
        return
	}
	
	if (this.userHandshake.foreDtMd5 && data.dtmd5 != this.userHandshake.datumMd5){
		processError(socket, HS_CODE_UNMATCH_DT_MD5)
        return
	}

    if(this.useCrypto) {
        if (data.rsa == ""){
            processError(socket, HS_CODE_INVALID_RSA)
            return
        }
        Hades.App.app.components.__connector__.setPubKey(socket.id, data.rsa)
    }
    
    process.nextTick(() => {
        response.bind(this)(socket, resp)
    })
}


Command.prototype.handleAck = function(socket) {
	let resp = [HS_CODE_OK, Hades.TimeUtil.msnow()]
	this.robots.handshakeAck += 1
    process.nextTick(() => {
        responseAck.bind(this)(socket, resp)
    })
}

var response = function(socket, resp) {
    //console.log("Handshake::response", resp)
    let totalLength = 0
    let repbuffs = _.map(resp, (v) => {
        let vb = msgpack.encode(v)
        totalLength += vb.length
        return vb
    })
    let buffer = Buffer.concat(repbuffs, totalLength)
	//console.log("Handshake::response done", Array.prototype.slice.call(buffer))
	this.robots.handshakeResp += 1
    socket.handshakeResponse(Package.encode(Package.TYPE_HANDSHAKE, buffer))
}

var responseAck = function(socket, resp) {
    let totalLength = 0
    let repbuffs = _.map(resp, (v) => {
        let vb = msgpack.encode(v)
        totalLength += vb.length
        return vb
    })
    let buffer = Buffer.concat(repbuffs, totalLength)
	//console.log("Handshake::responseAck done", JSON.stringify(resp))
	this.robots.handshakeAckResp += 1
    socket.handshakeAckResponse(Package.encode(Package.TYPE_HANDSHAKE_ACK, buffer))
}

var processError = function(socket, code) {
    let buffer = msgpack.encode(code)
    socket.sendForce(Package.encode(Package.TYPE_HANDSHAKE, buffer))
    setTimeout(function() {
        socket.disconnect("InvalidHadesProtocolVersion")
    }, 1000)
}
