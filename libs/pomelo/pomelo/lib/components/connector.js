const Hades = GlobalHades 
const Logger = Hades.Logger.getLogger('pomelo', __filename);
var taskManager = require('../common/manager/taskManager');
var pomelo = require('../pomelo');
var rsa = require("node-bignumber");
var events = require('../util/events');
var utils = require('../util/utils');
const Message = Hades.Protocol.Message;

module.exports = function (app, opts) {
	return new Component(app, opts);
};

/**
 * Connector component. Receive client requests and attach session with socket.
 *
 * @param {Object} app  current application context
 * @param {Object} opts attach parameters
 *                      opts.connector {Object} provides low level network and protocol details implementation between server and clients.
 */
var Component = function (app, opts) {
	opts = opts || {};
	this.app = app;
	this.connector = getConnector(app, opts);
	this.encode = opts.encode;
	this.decode = opts.decode;
	this.useCrypto = opts.useCrypto;
	this.useHostFilter = opts.useHostFilter;
	this.useAsyncCoder = opts.useAsyncCoder;
	this.blacklistFun = opts.blacklistFun;
	this.keys = {};
	this.blacklist = [];
	this.lag = opts.lag || 0;

	// component dependencies
	this.server = null;
	this.session = null;
	this.connection = null;
};

var pro = Component.prototype;

pro.name = '__connector__';

pro.start = function (cb) {
	this.server = this.app.components.__server__;
	this.session = this.app.components.__session__;
	this.connection = this.app.components.__connection__;

	// check component dependencies
	if (!this.server) {
		process.nextTick(function () {
			utils.invokeCallback(cb, new Error('fail to start connector component for no server component loaded'));
		});
		return;
	}

	if (!this.session) {
		process.nextTick(function () {
			utils.invokeCallback(cb, new Error('fail to start connector component for no session component loaded'));
		});
		return;
	}

	process.nextTick(cb);
};

pro.afterStart = function (cb) {
	this.connector.start(cb);
	this.connector.on('connection', hostFilter.bind(this, bindEvents));
};

pro.stop = function (force, cb) {
	if (this.connector) {
		this.connector.stop(force, cb);
		this.connector = null;
		return;
	} else {
		process.nextTick(cb);
	}
};

pro.send = function (msgType, mapId, msg, recvs, opts, cb) {
	// logger.debug('[%s] send message msgType: %s, mapId: %s, msg: %j, receivers: %j, opts: %j', this.app.serverId, msgType, mapId, msg, recvs, opts);
	// if (this.useAsyncCoder) {
	//   return this.sendAsync(reqId, route, msg, recvs, opts, cb);
	// }
	var emsg = this.connector.encode(msgType, mapId, msg);
	this.doSend(emsg, recvs, opts, cb);
};

pro.doSend = function (emsg, recvs, opts, cb) {
	if (!emsg) {
		process.nextTick(function () {
			return cb && cb(new Error('fail to send message for encode result is empty.'));
		});
	}

	this.app.components.__pushScheduler__.schedule(emsg, recvs, opts, cb);
}

pro.setPubKey = function (id, key) {
	var pubKey = new rsa.Key();
	pubKey.n = new rsa.BigInteger(key.rsa_n, 16);
	pubKey.e = key.rsa_e;
	this.keys[id] = pubKey;
};

pro.getPubKey = function (id) {
	return this.keys[id];
};

var getConnector = function (app, opts) {
	var connector = opts.connector;
	if (!connector) {
		return getDefaultConnector(app, opts);
	}

	if (typeof connector !== 'function') {
		return connector;
	}

	var curServer = app.getCurServer();
	return connector(curServer.clientPort, curServer.host, opts);
};

var getDefaultConnector = function (app, opts) {
	var DefaultConnector = require('../connectors/sioconnector');
	var curServer = app.getCurServer();
	return new DefaultConnector(curServer.clientPort, curServer.host, opts);
};

var hostFilter = function (cb, socket) {
	if (!this.useHostFilter) {
		return cb(this, socket);
	}

	var ip = socket.remoteAddress.ip;
	var check = function (list) {
		for (var address in list) {
			var exp = new RegExp(list[address]);
			if (exp.test(ip)) {
				socket.disconnect();
				return true;
			}
		}
		return false;
	};
	// dynamical check
	if (this.blacklist.length !== 0 && !!check(this.blacklist)) {
		return;
	}
	// static check
	if (!!this.blacklistFun && typeof this.blacklistFun === 'function') {
		var self = this;
		self.blacklistFun(function (err, list) {
			if (!!err) {
				logger.error('connector blacklist error: %j', err.stack);
				utils.invokeCallback(cb, self, socket);
				return;
			}
			if (!Array.isArray(list)) {
				logger.error('connector blacklist is not array: %j', list);
				utils.invokeCallback(cb, self, socket);
				return;
			}
			if (!!check(list)) {
				return;
			} else {
				utils.invokeCallback(cb, self, socket);
				return;
			}
		});
	} else {
		utils.invokeCallback(cb, this, socket);
	}
};

var bindEvents = function (self, socket) {
	var curServer = self.app.getCurServer();
	var maxConnections = curServer['max-connections'];
	if (self.connection && maxConnections) {
		self.connection.increaseConnectionCount();
		var statisticInfo = self.connection.getStatisticsInfo();
		if (statisticInfo.totalConnCount > maxConnections) {
			logger.warn('the server %s has reached the max connections %s', curServer.id, maxConnections);
			socket.disconnect();
			return;
		}
	}

	//create session for connection
	var session = getSession(self, socket);
	var closed = false;

	socket.on('disconnect', function () {
		if (closed) {
			return;
		}
		closed = true;
		if (self.connection) {
			self.connection.decreaseConnectionCount(session.uid);
		}
	});

	socket.on('error', function () {
		if (closed) {
			return;
		}
		closed = true;
		if (self.connection) {
			self.connection.decreaseConnectionCount(session.uid);
		}
	});

	// new message
	socket.on('message', function (msg) {
		// if (self.useAsyncCoder) {
		//   return handleMessageAsync(self, msg, session, socket);
		// }

		let dmsg = self.connector.decode(msg, socket);
		if (!dmsg) {
			// discard invalid message
			return;
		}

		// use rsa crypto
		if (self.useCrypto) {
			var verified = verifyMessage(self, session, dmsg);
			if (!verified) {
				logger.error('fail to verify the data received from client.');
				return;
			}
		}

		handleMessage(self, session, dmsg);
	}); //on message end
};

var handleMessageAsync = function (self, msg, session, socket) {
	if (self.decode) {
		self.decode(msg, session, function (err, dmsg) {
			if (err) {
				logger.error('fail to decode message from client %s .', err.stack);
				return;
			}

			doHandleMessage(self, dmsg, session);
		});
	} else if (self.connector.decode) {
		self.connector.decode(msg, socket, function (err, dmsg) {
			if (err) {
				logger.error('fail to decode message from client %s .', err.stack);
				return;
			}

			doHandleMessage(self, dmsg, session);
		});
	}
}

var doHandleMessage = function (self, dmsg, session) {
	if (!dmsg) {
		// discard invalid message
		return;
	}

	// use rsa crypto
	if (self.useCrypto) {
		var verified = verifyMessage(self, session, dmsg);
		if (!verified) {
			logger.error('fail to verify the data received from client.');
			return;
		}
	}

	handleMessage(self, session, dmsg);
}

/**
 * get session for current connection
 */
var getSession = function (self, socket) {
	var app = self.app,
		sid = socket.id;
	var session = self.session.get(sid);
	if (session) {
		return session;
	}

	session = self.session.create(sid, app.getServerId(), socket);
	//logger.info('[%s] getSession session is created with session id: %s', app.getServerId(), sid, socket);

	// bind events for session
	socket.on('disconnect', session.closedByReason.bind(session));
	socket.on('error', session.closedByReason.bind(session));
	session.on('closed', onSessionClose.bind(null, app));
	session.on('bind', function (uid) {
		//logger.debug('session on [%s] bind with uid: %s', self.app.serverId, uid);
		// update connection statistics if necessary
		if (self.connection) {
			self.connection.addLoginedUser(uid, {
				loginTime: Date.now(),
				uid: uid,
				address: socket.remoteAddress.ip + ':' + socket.remoteAddress.port
			});
		}
		self.app.event.emit(events.BIND_SESSION, session);
	});

	session.on('unbind', function (uid) {
		if (self.connection) {
			self.connection.removeLoginedUser(uid);
		}
		self.app.event.emit(events.UNBIND_SESSION, session);
	});

	return session;
};

var onSessionClose = function (app, session, reason) {
	taskManager.closeQueue(session.id, true);
	app.event.emit(events.CLOSE_SESSION, session);
};

var handleMessage = function (self, session, msg) {
	//logger.debug('[%s] handleMessage session id: %s, msg: %j', self.app.serverId, session.id, msg);  
	self.server.globalHandle(msg, session.toFrontendSession(), function (err, resp, opts) {
		if (msg.type == Message.TYPE_NOTIFY) {
			return;
		}

		function doSend() {
			if (!!resp)
				self.send(Message.TYPE_RESPONSE, msg.reqMapId, resp, [session.id], opts, function () {});
		}

		if (self.lag == 0) {
			doSend();
		} else {
			setTimeout(doSend, self.lag);
		}
	});
};

var verifyMessage = function (self, session, msg) {
	var sig = msg.body.__crypto__;
	if (!sig) {
		logger.error('receive data from client has no signature [%s]', self.app.serverId);
		return false;
	}

	var pubKey;

	if (!session) {
		logger.error('could not find session.');
		return false;
	}

	if (!session.get('pubKey')) {
		pubKey = self.getPubKey(session.id);
		if (!!pubKey) {
			delete self.keys[session.id];
			session.set('pubKey', pubKey);
		} else {
			logger.error('could not get public key, session id is %s', session.id);
			return false;
		}
	} else {
		pubKey = session.get('pubKey');
	}

	if (!pubKey.n || !pubKey.e) {
		logger.error('could not verify message without public key [%s]', self.app.serverId);
		return false;
	}

	delete msg.body.__crypto__;

	var message = JSON.stringify(msg.body);
	if (utils.hasChineseChar(message))
		message = utils.unicodeToUtf8(message);

	return pubKey.verifyString(message, sig);
};