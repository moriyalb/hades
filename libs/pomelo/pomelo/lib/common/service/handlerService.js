const _ = require("lodash")
var fs = require('fs')
var utils = require('../../util/utils')

const Hades = GlobalHades
const Logger = Hades.Logger.getLogger('pomelo', __filename)
var forwardLogger = Logger
const Protocol = Hades.Protocol
const Message = Protocol.Message

/**
 * Handler service.
 * Dispatch request to the relactive handler.
 *
 * @param {Object} app      current application context
 */
var Service = function (app, opts) {
	this.app = app
}

module.exports = Service

Service.prototype.name = 'handler'

/**
 * Handler the request.
 */
Service.prototype.handle = function (msg, session, cb) {
	//msg.reqMapId 
	//msg.type MSG_TYPE(req or notify)
	//msg.args [bytes, ...]
	let proxy = null

	let serverType = this.app.getServerType()
	let playerID = session.get("playerID")

	let methodName = Hades.Schema.Methods.handlerIds[msg.reqMapId][1]
	let args = Hades.Message.handleRequest(msg, playerID)

	if (_.isNil(args)) {
		utils.invokeCallback(cb, "Invalid Args", null)
		return
	}

	if (serverType == Hades.Config.frontendServer()) {
		proxy = Hades.SysLocal.LoginMgr.getLoginProxy()
		args = _.concat([session], args)
	} else {
		proxy = Hades.SysLocal.PlayerMgr.getPlayer(playerID)
	}

	if (!proxy){
		console.error("handleService Failed -> Cannot get proxy -> ", playerID)
		utils.invokeCallback(cb, new Error("Invalid Proxy"), null)
		return
	}

	//console.log("Check Proxy ", methodName, proxy)
	
	proxy[methodName].apply(proxy, args)
		.then(response => {
			if (Hades.Message.isNotifyMethod(msg.reqMapId)) {
				utils.invokeCallback(cb, null, null)
			} else {
				Hades.Message.handleResponse(msg.reqMapId, response, playerID, cb)
			}
		})
		.catch(error => {
			console.error("Failed call handler -> ", msg.reqMapId, error)
			utils.invokeCallback(cb, error, null)
		})
}