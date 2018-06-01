/**
 * Implementation of server component.
 * Init and start server instance.
 */
const Hades = GlobalHades
const Logger = Hades.Logger.getLogger('pomelo', __filename);
var fs = require('fs');
var path = require('path');
var utils = require('../util/utils');
var events = require('../util/events');
var Constants = require('../util/constants');
var FilterService = require('../common/service/filterService');
var HandlerService = require('../common/service/handlerService');

var ST_INITED = 0; // server inited
var ST_STARTED = 1; // server started
var ST_STOPED = 2; // server stoped

/**
 * Server factory function.
 *
 * @param {Object} app  current application context
 * @return {Object} erver instance
 */
module.exports.create = function (app, opts) {
	return new Server(app, opts);
};

var Server = function (app, opts) {
	this.opts = opts || {};
	this.app = app;
	this.globalFilterService = null;
	this.filterService = null;
	this.handlerService = null;

	this.state = ST_INITED;
};

var pro = Server.prototype;

/**
 * Server lifecycle callback
 */
pro.start = function () {
	if (this.state > ST_INITED) {
		return;
	}

	this.globalFilterService = initFilter(true, this.app);
	this.filterService = initFilter(false, this.app);
	this.handlerService = initHandler(this.app, this.opts);	
	this.state = ST_STARTED;
};

pro.afterStart = function () {
	
};

/**
 * Stop server
 */
pro.stop = function () {
	this.state = ST_STOPED;
};

/**
 * Global handler.
 *
 * @param  {Object} msg request message
 * @param  {Object} session session object
 * @param  {Callback} callback function 
 */
pro.globalHandle = function (msg, session, cb) {
	if (this.state !== ST_STARTED) {
		utils.invokeCallback(cb, new Error('server not started'));
		return;
	}

	var self = this;
	var dispatch = function (err, resp, opts) {
		if (err) {
			handleError(true, self, err, msg, session, resp, opts, function (err, resp, opts) {
				response(true, self, err, msg, session, resp, opts, cb);
			});
			return;
		}

		if (!Hades.Message.isBackendMsg(msg.reqMapId)) {
			doHandle(self, msg, session, function (err, resp, opts) {
				response(true, self, err, msg, session, resp, opts, cb);
			});
		} else {
			doForward(self.app, msg, session, function (err, resp, opts) {
				response(true, self, err, msg, session, resp, opts, cb);
			});
		}
	};
	beforeFilter(true, self, msg, session, dispatch);
};

/**
 * Handle request
 */
pro.handle = function (msg, session, cb) {
	if (this.state !== ST_STARTED) {
		cb(new Error('server not started'));
		return;
	}

	doHandle(this, msg, session, cb);
};

var initFilter = function (isGlobal, app) {
	var service = new FilterService();
	var befores, afters;

	if (isGlobal) {
		befores = app.get(Constants.KEYWORDS.GLOBAL_BEFORE_FILTER);
		afters = app.get(Constants.KEYWORDS.GLOBAL_AFTER_FILTER);
	} else {
		befores = app.get(Constants.KEYWORDS.BEFORE_FILTER);
		afters = app.get(Constants.KEYWORDS.AFTER_FILTER);
	}

	var i, l;
	if (befores) {
		for (i = 0, l = befores.length; i < l; i++) {
			service.before(befores[i]);
		}
	}

	if (afters) {
		for (i = 0, l = afters.length; i < l; i++) {
			service.after(afters[i]);
		}
	}

	return service;
};

var initHandler = function (app, opts) {
	return new HandlerService(app, opts);
};

/**
 * Fire before filter chain if any
 */
var beforeFilter = function (isGlobal, server, msg, session, cb) {
	var fm;
	if (isGlobal) {
		fm = server.globalFilterService;
	} else {
		fm = server.filterService;
	}
	if (fm) {
		fm.beforeFilter(msg, session, cb);
	} else {
		utils.invokeCallback(cb);
	}
};

/**
 * Fire after filter chain if have
 */
var afterFilter = function (isGlobal, server, err, msg, session, resp, opts, cb) {
	var fm;
	if (isGlobal) {
		fm = server.globalFilterService;
	} else {
		fm = server.filterService;
	}
	if (fm) {
		if (isGlobal) {
			fm.afterFilter(err, msg, session, resp, function () {
				// do nothing
			});
		} else {
			fm.afterFilter(err, msg, session, resp, function (err) {
				cb(err, resp, opts);
			});
		}
	}
};

/**
 * pass err to the global error handler if specified
 */
var handleError = function (isGlobal, server, err, msg, session, resp, opts, cb) {
	var handler;
	if (isGlobal) {
		handler = server.app.get(Constants.RESERVED.GLOBAL_ERROR_HANDLER);
	} else {
		handler = server.app.get(Constants.RESERVED.ERROR_HANDLER);
	}
	if (!handler) {
		Logger.debug('no default error handler to resolve unknown exception. ' + err.stack);
		utils.invokeCallback(cb, err, resp, opts);
	} else {
		if (handler.length === 5) {
			handler(err, msg, resp, session, cb);
		} else {
			handler(err, msg, resp, session, opts, cb);
		}
	}
};

/**
 * Send response to client and fire after filter chain if any.
 */

var response = function (isGlobal, server, err, msg, session, resp, opts, cb) {
	if (isGlobal) {
		cb(err, resp, opts);
		// after filter should not interfere response
		afterFilter(isGlobal, server, err, msg, session, resp, opts, cb);
	} else {
		afterFilter(isGlobal, server, err, msg, session, resp, opts, cb);
	}
};

var doForward = function (app, msg, session, cb) {
	var finished = false;
	//should route to other servers
	try {
		let serverType = Hades.Config.backendServer();
		let serverId = Hades.App.getBackendId(session)
		app.sysrpc[serverType].msgRemote.forwardMessage.toServer(
			serverId,
			msg,
			session.export(),
			function (err, resp, opts) {
				if (err) {
					//Logger.error('fail to process remote message:' + err.stack);
				}
				finished = true;
				utils.invokeCallback(cb, err, resp, opts);
			}
		);
	} catch (err) {
		if (!finished) {
			Logger.error('fail to forward message:' + err.stack);
			utils.invokeCallback(cb, err);
		}
	}
};

var doHandle = function (server, msg, session, cb) {
	var self = server;

	var handle = function (err, resp, opts) {
		if (err) {
			// error from before filter
			handleError(false, self, err, msg, session, resp, opts, function (err, resp, opts) {
				response(false, self, err, msg, session, resp, opts, cb);
			});
			return;
		}

		self.handlerService.handle(msg, session, function (err, resp, opts) {
			if (err) {
				//error from handler
				handleError(false, self, err, msg, session, resp, opts, function (err, resp, opts) {
					response(false, self, err, msg, session, resp, opts, cb);
				});
				return;
			}

			response(false, self, err, msg, session, resp, opts, cb);
		});
	}; //end of handle

	beforeFilter(false, server, msg, session, handle);
};
