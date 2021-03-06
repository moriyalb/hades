var async = require('async');
var utils = require('./utils');
var path = require('path');
var fs = require('fs');
var Constants = require('./constants');
var starter = require('../master/starter');
const Hades = GlobalHades 
const Logger = Hades.Logger.getLogger('pomelo', __filename);

/**
 * Initialize application configuration.
 */
module.exports.defaultConfiguration = function (app) {
	var args = parseArgs(process.argv);
	setupEnv(app, args);
	loadMaster(app);
	loadServers(app);
	processArgs(app, args);
	Hades.Lifecycle.register(app.lifecycleCbs)
};

/**
 * Start servers by type.
 */
module.exports.startByType = function (app, cb) {
	if (!!app.startId) {
		if (app.startId === Constants.RESERVED.MASTER) {
			utils.invokeCallback(cb);
		} else {
			starter.runServers(app);
		}
	} else {
		if (!!app.type && app.type !== Constants.RESERVED.ALL && app.type !== Constants.RESERVED.MASTER) {
			starter.runServers(app);
		} else {
			utils.invokeCallback(cb);
		}
	}
};

/**
 * Load default components for application.
 */
module.exports.loadDefaultComponents = function (app) {
	var pomelo = require('../pomelo');
	// load system default components
	if (app.serverType === Constants.RESERVED.MASTER) {
		app.load(pomelo.master, app.get('masterConfig'));
	} else {
		app.load(pomelo.proxy, app.get('proxyConfig'));
		if (app.getCurServer().port) {
			app.load(pomelo.remote, app.get('remoteConfig'));
		}
		if (app.isFrontend()) {
			app.load(pomelo.connection, app.get('connectionConfig'));
			app.load(pomelo.connector, app.get('connectorConfig'));
			app.load(pomelo.session, app.get('sessionConfig'));
			// compatible for schedulerConfig
			if (app.get('schedulerConfig')) {
				app.load(pomelo.pushScheduler, app.get('schedulerConfig'));
			} else {
				app.load(pomelo.pushScheduler, app.get('pushSchedulerConfig'));
			}
		}
		app.load(pomelo.backendSession, app.get('backendSessionConfig'));
		app.load(pomelo.channel, app.get('channelConfig'));
		app.load(pomelo.server, app.get('serverConfig'));
	}
	app.load(pomelo.monitor, app.get('monitorConfig'));
};

/**
 * Stop components.
 *
 * @param  {Array}  comps component list
 * @param  {Number}   index current component index
 * @param  {Boolean}  force whether stop component immediately
 * @param  {Function} cb
 */
module.exports.stopComps = function (comps, index, force, cb) {
	if (index >= comps.length) {
		utils.invokeCallback(cb);
		return;
	}
	var comp = comps[index];
	if (typeof comp.stop === 'function') {
		comp.stop(force, function () {
			// ignore any error
			module.exports.stopComps(comps, index + 1, force, cb);
		});
	} else {
		module.exports.stopComps(comps, index + 1, force, cb);
	}
};

/**
 * Apply command to loaded components.
 * This method would invoke the component {method} in series.
 * Any component {method} return err, it would return err directly.
 *
 * @param {Array} comps loaded component list
 * @param {String} method component lifecycle method name, such as: start, stop
 * @param {Function} cb
 */
module.exports.optComponents = function (comps, method, cb) {
	var i = 0;
	async.forEachSeries(comps, function (comp, done) {
		i++;
		if (typeof comp[method] === 'function') {
			comp[method](done);
		} else {
			done();
		}
	}, function (err) {
		if (err) {
			if (typeof err === 'string') {
				Logger.error('fail to operate component, method: %s, err: %j', method, err);
			} else {
				Logger.error('fail to operate component, method: %s, err: %j', method, err.stack);
			}
		}
		utils.invokeCallback(cb, err);
	});
};

/**
 * Load server info from config/servers.json.
 */
var loadServers = function (app) {
	app.loadConfigBaseApp(Constants.RESERVED.SERVERS);
	var servers = app.get(Constants.RESERVED.SERVERS);
	var serverMap = {}, slist, i, l, server;
	for (var serverType in servers) {
		slist = servers[serverType];
		for (i = 0, l = slist.length; i < l; i++) {
			server = slist[i];
			server.serverType = serverType;
			if (server[Constants.RESERVED.CLUSTER_COUNT]) {
				utils.loadCluster(app, server, serverMap);
				continue;
			}
			serverMap[server.id] = server;
			if (server.wsPort) {
				Logger.warn('wsPort is deprecated, use clientPort in frontend server instead, server: %j', server);
			}
		}
	}
	app.set(Constants.KEYWORDS.SERVER_MAP, serverMap);
};

/**
 * Load master info from config/master.json.
 */
var loadMaster = function (app) {
	app.loadConfigBaseApp(Constants.RESERVED.MASTER);
	app.master = app.get(Constants.RESERVED.MASTER);
	//console.log("loadMaster -> ", app.master);
};

/**
 * Process server start command
 */
var processArgs = function (app, args) {
	var serverType = args.serverType || Constants.RESERVED.MASTER;
	var serverId = args.id || app.getMaster().id;
	//console.log("processArgs -> ", serverType, serverId);
	var mode = args.mode || Constants.RESERVED.CLUSTER;
	var masterha = args.masterha || 'false';
	var type = args.type || Constants.RESERVED.ALL;
	var startId = args.startId;

	app.set(Constants.RESERVED.MAIN, args.main, true);
	app.set(Constants.RESERVED.SERVER_TYPE, serverType, true);
	app.set(Constants.RESERVED.SERVER_ID, serverId, true);
	app.set(Constants.RESERVED.MODE, mode, true);
	app.set(Constants.RESERVED.TYPE, type, true);
	if (!!startId) {
		app.set(Constants.RESERVED.STARTID, startId, true);
	}

	if (masterha === 'true') {
		app.master = args;
		app.set(Constants.RESERVED.CURRENT_SERVER, args, true);
	} else if (serverType !== Constants.RESERVED.MASTER) {
		app.set(Constants.RESERVED.CURRENT_SERVER, args, true);
	} else {
		app.set(Constants.RESERVED.CURRENT_SERVER, app.getMaster(), true);
	}
};

/**
 * Setup enviroment.
 */
var setupEnv = function (app, args) {
	app.set(Constants.RESERVED.ENV, args.env || process.env.NODE_ENV || Constants.RESERVED.ENV_DEV, true);
};

/**
 * Parse command line arguments.
 *
 * @param args command line arguments
 *
 * @return Object argsMap map of arguments
 */
var parseArgs = function (args) {
	var argsMap = {};
	var mainPos = 1;

	while (args[mainPos].indexOf('--') > 0) {
		mainPos++;
	}
	argsMap.main = args[mainPos];

	for (var i = (mainPos + 1); i < args.length; i++) {
		var arg = args[i];
		var sep = arg.indexOf('=');
		var key = arg.slice(0, sep);
		var value = arg.slice(sep + 1);
		if (!isNaN(Number(value)) && (value.indexOf('.') < 0)) {
			value = Number(value);
		}
		argsMap[key] = value;
	}

	return argsMap;
};
