const Hades = GlobalHades
const Protocol = Hades.Protocol
var Package = Protocol.Package
const Logger = Hades.Logger.getLogger('pomelo', __filename)

/**
 * Process heartbeat request.
 *
 * @param {Object} opts option request
 *                      opts.heartbeat heartbeat interval
 */
var Command = function (opts) {
	opts = opts || {};
	this.heartbeat = null;
	this.timeout = null;

	if (opts.heartbeat) {
		this.heartbeat = opts.heartbeat * 1000; // heartbeat interval
		this.timeout = opts.timeout * 1000 || this.heartbeat * 2; // max heartbeat message timeout
		this.disconnectOnTimeout = true;
	} else {
		this.heartbeat = 10000;
		this.timeout = 20000; // max heartbeat message timeout
		this.disconnectOnTimeout = true;
	}

	this.timeouts = {};
	this.clients = {};
};

module.exports = Command;

Command.prototype.handle = function (socket) {
	var self = this;

	if (!this.clients[socket.id]) {
		// clear timers when socket disconnect or error
		this.clients[socket.id] = 1;
		socket.once('disconnect', clearTimers.bind(null, this, socket.id));
		socket.once('error', clearTimers.bind(null, this, socket.id));
	}

	// clear timeout timer
	if (self.disconnectOnTimeout) {
		this.clear(socket.id);
	}

	socket.sendRaw(Package.encode(Package.TYPE_HEARTBEAT));

	if (self.disconnectOnTimeout) {
		self.timeouts[socket.id] = setTimeout(function () {
			Logger.debug(`client ${socket.id} heartbeat timeout.`);
			socket.disconnect();
		}, self.timeout);
	}
};

Command.prototype.clear = function (id) {
	var tid = this.timeouts[id];
	if (tid) {
		clearTimeout(tid);
		delete this.timeouts[id];
	}
};

var clearTimers = function (self, id) {
	delete self.clients[id];
	var tid = self.timeouts[id];
	if (tid) {
		clearTimeout(tid);
		delete self.timeouts[id];
	}
};