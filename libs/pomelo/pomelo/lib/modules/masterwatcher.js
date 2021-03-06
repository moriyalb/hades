const Hades = GlobalHades 
const Logger = Hades.Logger.getLogger('pomelo', __filename);
var utils = require('../util/utils');
var Constants = require('../util/constants');
var MasterWatchdog = require('../master/watchdog');

module.exports = function (opts, consoleService) {
	return new Module(opts, consoleService);
};

module.exports.moduleId = Constants.KEYWORDS.MASTER_WATCHER;

var Module = function (opts, consoleService) {
	this.app = opts.app;
	this.service = consoleService;
	this.id = this.app.getServerId();

	this.watchdog = new MasterWatchdog(this.app, this.service);
	this.service.on('register', onServerAdd.bind(null, this));
	this.service.on('disconnect', onServerLeave.bind(null, this));
	this.service.on('reconnect', onServerReconnect.bind(null, this));
};

// ----------------- bind methods -------------------------

var onServerAdd = function (module, record) {
	//Logger.debug('masterwatcher receive add server event, with server: %j', record);
	if (!record || record.type === 'client' || !record.serverType) {
		return;
	}
	module.watchdog.addServer(record);
};

var onServerReconnect = function (module, record) {
	//Logger.debug('masterwatcher receive reconnect server event, with server: %j', record);
	if (!record || record.type === 'client' || !record.serverType) {
		Logger.warn('onServerReconnect receive wrong message: %j', record);
		return;
	}
	module.watchdog.reconnectServer(record);
};

var onServerLeave = function (module, id, type) {
	//Logger.debug('masterwatcher receive remove server event, with server: %s, type: %s', id, type);
	if (!id) {
		Logger.warn('onServerLeave receive server id is empty.');
		return;
	}
	if (type !== 'client') {
		module.watchdog.removeServer(id);
	}
};

// ----------------- module methods -------------------------

Module.prototype.start = function (cb) {
	utils.invokeCallback(cb);
};

Module.prototype.masterHandler = function (agent, msg, cb) {
	if (!msg) {
		Logger.warn('masterwatcher receive empty message.');
		return;
	}
	var func = masterMethods[msg.action];
	if (!func) {
		Logger.warn(`masterwatcher unknown action: ${msg.action}`);
		return;
	}
	func(this, agent, msg, cb);
};

// ----------------- monitor request methods -------------------------

var subscribe = function (module, agent, msg, cb) {
	if (!msg) {
		utils.invokeCallback(cb, new Error('masterwatcher subscribe empty message.'));
		return;
	}

	module.watchdog.subscribe(msg.id);
	utils.invokeCallback(cb, null, module.watchdog.query());
};

var unsubscribe = function (module, agent, msg, cb) {
	if (!msg) {
		utils.invokeCallback(cb, new Error('masterwatcher unsubscribe empty message.'));
		return;
	}
	module.watchdog.unsubscribe(msg.id);
	utils.invokeCallback(cb);
};

var query = function (module, agent, msg, cb) {
	utils.invokeCallback(cb, null, module.watchdog.query());
};

var record = function (module, agent, msg) {
	if (!msg) {
		utils.invokeCallback(cb, new Error('masterwatcher record empty message.'));
		return;
	}
	module.watchdog.record(msg.id);
};

var masterMethods = {
	'subscribe': subscribe,
	'unsubscribe': unsubscribe,
	'query': query,
	'record': record
};