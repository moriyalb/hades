const Hades = GlobalHades
const Protocol = Hades.Protocol
var Package = Protocol.Package
let msgpack = require("msgpack-lite");
const _ = require("lodash");

module.exports.handle = function (socket, reason) {
	// websocket close code 1000 would emit when client close the connection
	socket.sendRaw(Package.encode(Package.TYPE_KICK, msgpack.encode(reason)));
};