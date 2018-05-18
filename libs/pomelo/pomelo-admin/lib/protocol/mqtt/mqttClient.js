const Hades = GlobalHades 
const Logger = Hades.Logger.getLogger('pomelo', __filename);
var EventEmitter = require('events');
var constants = require('../../util/constants');
var MqttCon = require('mqtt-connection');
var Util = require('util');
var net = require('net');

var MqttClient = function(opts) {
	EventEmitter.call(this);
	this.clientId = 'MQTT_ADMIN_' + Date.now();
	this.id = opts.id;
	this.requests = {};
	this.connectedTimes = 1;
	this.host = null;
	this.port = null;
	this.socket = null;
	this.lastPing = -1;
	this.lastPong = -1;
	this.closed = false;
	this.timeoutId = null;
	this.connected = false;
	this.reconnectId = null;
	this.timeoutFlag = false;
	this.keepaliveTimer = null;
	this.reconnectDelay = 0;
	this.reconnectDelayMax = opts.reconnectDelayMax || constants.DEFAULT_PARAM.RECONNECT_DELAY_MAX;
	this.timeout = opts.timeout || constants.DEFAULT_PARAM.TIMEOUT;
	this.keepalive = opts.keepalive || constants.DEFAULT_PARAM.KEEPALIVE;
}

Util.inherits(MqttClient, EventEmitter);

MqttClient.prototype.connect = function(host, port, cb) {
	cb = cb || function() {}
	if (this.connected) {
		return cb(new Error('MqttClient has already connected.'));
	}

	if (host) {
		this.host = host;
	} else {
		host = this.host;
	}

	if (port) {
		this.port = port;
	} else {
		port = this.port;
	}

	var self = this;
	this.closed = false;

	var stream = net.createConnection(this.port, this.host);
	this.socket = MqttCon(stream);

	// Logger.info(`try to connect ${this.host}:${this.port}`);
	this.socket.connect({
		clientId: this.clientId
	});

	this.addTimeout();

	this.socket.on('connack', function() {
		if (self.connected) {
			return;
		}

		self.connected = true;

		self.setupKeepAlive();

		if (self.connectedTimes++ == 1) {
			self.emit('connect');
			cb();
		} else {
			self.emit('reconnect');
		}
	});

	this.socket.on('publish', function(pkg) {
		var topic = pkg.topic;
		var msg = pkg.payload.toString();
		msg = JSON.parse(msg);

		// Logger.debug('[MqttClient] publish %s %j', topic, msg);
		self.emit(topic, msg);
	});

	this.socket.on('close', function() {
		Logger.error(`mqtt socket is close, remote server host: ${host}, port: ${port}`);
		self.onSocketClose();
	});

	this.socket.on('error', function(err) {
		Logger.error(`mqtt socket is error, remote server host: ${host}, port: ${port}`);
		// self.emit('error', new Error('[MqttClient] socket is error, remote server ' + host + ':' + port));
		self.onSocketClose();
	});

	this.socket.on('pingresp', function() {
		//const Hades = GlobalHades
		//Logger.info("AdminMqtt on Pong --------------------->", Hades.Config.getServerId())
		self.lastPong = Date.now();
	});

	this.socket.on('disconnect', function() {
		Logger.error('mqtt socket is disconnect, remote server host: %s, port: %s', host, port);
		self.emit('disconnect', self.id);
		self.onSocketClose();
	});

	this.socket.on('timeout', function(reconnectFlag) {
		if (reconnectFlag) {
			self.reconnect();
		} else {
			self.exit();
		}
	})
}

MqttClient.prototype.send = function(topic, msg) {
	// console.log('MqttClient send %s %j ~~~', topic, msg);
	this.socket.publish({
		topic: topic,
		payload: JSON.stringify(msg)
	})
}

MqttClient.prototype.onSocketClose = function() {
	// console.log('onSocketClose ' + this.closed);
	if (this.closed) {
		return;
	}

	clearInterval(this.keepaliveTimer);
	clearTimeout(this.timeoutId);
	this.keepaliveTimer = null;
	this.lastPing = -1;
	this.lastPong = -1;
	this.connected = false;
	this.closed = true;
	delete this.socket;
	this.socket = null;

	if (this.connectedTimes > 1) {
		this.reconnect();
	} else {
		this.exit();
	}
}

MqttClient.prototype.addTimeout = function(reconnectFlag) {
	var self = this;
	if (this.timeoutFlag) {
		return;
	}

	this.timeoutFlag = true;

	this.timeoutId = setTimeout(function() {
		self.timeoutFlag = false;
		Logger.error('mqtt client connect %s:%d timeout %d s', self.host, self.port, self.timeout / 1000);
		self.socket.emit('timeout', reconnectFlag);
	}, self.timeout);
}

MqttClient.prototype.reconnect = function() {
	var delay = this.reconnectDelay * 2 || constants.DEFAULT_PARAM.RECONNECT_DELAY;
	if (delay > this.reconnectDelayMax) {
		delay = this.reconnectDelayMax;
	}

	this.reconnectDelay = delay;

	var self = this;

	// Logger.debug('[MqttClient] reconnect %d ...', delay);
	this.reconnectId = setTimeout(function() {
		Logger.info(`reconnect delay ${delay / 1000}s`);
		self.addTimeout(true);
		self.connect();
	}, delay);
}

MqttClient.prototype.setupKeepAlive = function() {
	clearTimeout(this.reconnectId);
	clearTimeout(this.timeoutId);

	//Logger.info("SetUp AdminAlive -> ", this.clientId, this.host, this.port, this.keepalive)

	var self = this;
	this.keepaliveTimer = setInterval(function() {
		self.checkKeepAlive();
	}, this.keepalive);
}

MqttClient.prototype.checkKeepAlive = function() {
	if (this.closed) {
		return;
	}

	var now = Date.now();
	var KEEP_ALIVE_TIMEOUT = this.keepalive * 2;
	if (this.lastPing > 0) {
		if (this.lastPong < this.lastPing) {
			if (now - this.lastPing > KEEP_ALIVE_TIMEOUT) {
				Logger.error(`mqtt rpc client checkKeepAlive error timeout for ${KEEP_ALIVE_TIMEOUT}`);
				this.close();
			}
		} else {
			this.socket.pingreq();
			this.lastPing = Date.now();
		}
	} else {
		this.socket.pingreq();
		this.lastPing = Date.now();
	}
}

MqttClient.prototype.disconnect = function() {
	this.close();
}

MqttClient.prototype.close = function() {
	this.connected = false;
	this.closed = true;
	this.socket.disconnect();
}

MqttClient.prototype.exit = function() {
	Logger.info('exit ...');
	process.exit(0);
}

module.exports = MqttClient;