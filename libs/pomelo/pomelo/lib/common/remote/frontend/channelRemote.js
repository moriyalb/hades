/**
 * Remote channel service for frontend server.
 * Receive push request from backend servers and push it to clients.
 */
var utils = require('../../../util/utils');
const Hades = GlobalHades
const Logger = Hades.Logger.getLogger('pomelo', __filename);
const Message = Hades.Protocol.Message;


module.exports = function (app) {
	return new Remote(app);
};

var Remote = function (app) {
	this.app = app;
};

/**
 * Push message to client by uids.
 *
 * @param  {String}   pushMapId pushMapId push map id
 * @param  {Object}   msg   message
 * @param  {Array}    uids  user ids that would receive the message
 * @param  {Object}   opts  push options
 * @param  {Function} cb    callback function
 */
Remote.prototype.pushMessage = function (pushMapId, msg, uids, opts, cb) {
	if (!msg) {
		Logger.error('Can not send empty message! pushMapId : %i, compressed msg : %j',
			pushMapId, msg);
		utils.invokeCallback(cb, new Error('can not send empty message.'));
		return;
	}

	var connector = this.app.components.__connector__;

	var sessionService = this.app.get('sessionService');
	var fails = [],
		sids = [],
		sessions, j, k;
	for (var i = 0, l = uids.length; i < l; i++) {
		sessions = sessionService.getByUid(uids[i]);
		if (!sessions) {
			fails.push(uids[i]);
		} else {
			for (j = 0, k = sessions.length; j < k; j++) {
				sids.push(sessions[j].id);
			}
		}
	}
	//Logger.debug('[%s] pushMessage uids: %j, msg: %j, sids: %j', this.app.serverId, uids, msg, sids);
	connector.send(Message.TYPE_PUSH, pushMapId, msg, sids, opts, function (err) {
		utils.invokeCallback(cb, err, fails);
	});
};

/**
 * Broadcast to all the client connectd with current frontend server.
 *
 * @param  {String}    pushMapId  pushMapId int
 * @param  {Object}    msg    message
 * @param  {Boolean}   opts   broadcast options. 
 * @param  {Function}  cb     callback function
 */
Remote.prototype.broadcast = function (pushMapId, msg, opts, cb) {
	var connector = this.app.components.__connector__;

	connector.send(Message.TYPE_PUSH, pushMapId, msg, null, opts, cb);
};