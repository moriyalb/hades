const Hades = GlobalHades
const Protocol = Hades.Protocol
var Message = Protocol.Message;
var Constants = require('../../util/constants');
const Logger = Hades.Logger.getLogger('pomelo', __filename);

var encode = function(msgType, mapId, msg) {
    return Message.encode(msgType, mapId, msg);
};

var decode = function(msg) {
    return Message.decode(msg);  
};

module.exports = {
    encode: encode,
    decode: decode
};