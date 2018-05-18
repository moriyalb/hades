let Protocol = exports

const PKG_HEAD_BYTES = 4
const MSG_FLAG_BYTES = 1
const MSG_ROUTE_CODE_BYTES = 2
const MSG_ROUTE_LEN_BYTES = 1

const MSG_ROUTE_CODE_MAX = 0xffff

let Package = Protocol.Package = {}
let Message = Protocol.Message = {}

Protocol.VERSION = 65536

Package.TYPE_HANDSHAKE = 1
Package.TYPE_HANDSHAKE_ACK = 2
Package.TYPE_HEARTBEAT = 3
Package.TYPE_DATA = 4
Package.TYPE_KICK = 5

//in lua
//proxy.server.method(args, cb)
Message.TYPE_REQUEST = 1   //server method
//in lua
//cb(resp)
Message.TYPE_RESPONSE = 2  //server method response
//in lua
//proxy.server.method(args)
Message.TYPE_NOTIFY = 3    //server method(no response)
//auto done by properties resetting
Message.TYPE_SYNC = 4      //client auto property sync method
//in js
//proxy.client.method(args)
Message.TYPE_PUSH = 5      //client method(no response)

const MSG_TYPE_MASK = 0xf

/**
 * Package protocol encode.
 *
 * Pomelo package format:
 * +------+-------------+------------------+
 * | type | body length |       body       |
 * +------+-------------+------------------+
 *
 * Head: 4bytes
 *   0: package type,
 *      1 - handshake,
 *      2 - handshake ack,
 *      3 - heartbeat,
 *      4 - data
 *      5 - kick
 *   1 - 3: big-endian body length
 * Body: body length bytes
 *
 * @param  {Number}    type   package type
 * @param  {ByteArray} body   body content in bytes
 * @return {ByteArray}        new byte array that contains encode result
 */
Package.encode = function(type, body){
    const length = body ? body.length : 0
    let buffer = Buffer.allocUnsafe(PKG_HEAD_BYTES + length)
    let index = 0
    buffer[index++] = type & 0xff
    buffer[index++] = (length >> 16) & 0xff
    buffer[index++] = (length >> 8) & 0xff
    buffer[index++] = length & 0xff
    if (!!body) {
        body.copy(buffer, index)
    }
    return buffer
}

/**
 * Package protocol decode.
 * See encode for package format.
 *
 * @param  {ByteArray} buffer byte array containing package content
 * @return {Object}           {type: package type, buffer: body byte array}
 */
Package.decode = function(buffer){
    let offset = 0
    let length = 0
    let rs = []
    //console.log("Check Package ", buffer)
    while (offset < buffer.length) {
        let type = buffer[offset++]
        length = ((buffer[offset++]) << 16 | (buffer[offset++]) << 8 | buffer[offset++]) >>> 0
        let body = length ? Buffer.allocUnsafe(length) : null
        if (!!body) {
            buffer.copy(body, 0, offset)
        }
        offset += length
        rs.push({'type': type, 'body': body})
    }
    return rs.length === 1 ? rs[0]: rs
}

/**
 * Message protocol encode.
 *
 * @param  {Number} msgType       message type
 * @param  {Number} mapId         req/push map id
 * @param  {Buffer} msg           message body bytes
 * @return {Buffer}               encode result
 */
Message.encode = function(msgType, mapId, msg){     
    let idmap = []
    while(mapId != 0){
        idmap.push(mapId & 0x7f)
        mapId >>= 7
        if ( mapId != 0 ){
          idmap[idmap.length - 1] |= 0x80
        }
    }
    msg = Buffer.from(msg)//maybe stringify to string through rpc request.

    let result = Buffer.allocUnsafe(1 + idmap.length + msg.length)
    result[0] = msgType & MSG_TYPE_MASK
    Buffer.from(idmap).copy(result, 1)
    msg.copy(result, idmap.length + 1)      
    return result
}

/**
 * Message protocol decode.
 *
 * @param  {Buffer}   buffer message bytes
 * @return {Object}          message object {"msgType":, "body":, "reqMapId":}
 */
Message.decode = function(buffer) {   
    //console.log("Message::decode -> ", buffer)
    let msg = {msgType:0, reqMapId:0, body:null}
    buffer = Buffer.from(buffer)//maybe stringify to string through rpc request.
    msg.msgType = buffer[0] & MSG_TYPE_MASK
    let idsize = 0
    while (idsize < 4){
        msg.reqMapId |= (buffer[idsize + 1] & 0x7f) << (idsize*7)
        if ((buffer[idsize + 1] & 0x80) == 1){
            idsize++
        }else{
          break
        }
    }
    msg.body = Buffer.allocUnsafe(buffer.length - idsize - 2)
    buffer.copy(msg.body, 0, idsize + 2)
    return msg
}