"use strict"

const _ = require("lodash")
const util = require("util")
const Hades = GlobalHades

class LoginMgr {
    constructor() {
		
	}

	onInit(){
		this._initLoginProxy()
	}

	onFini(){
		
	}
	
	_initLoginProxy(){
		//Login proxy is a singleton in each frontend server.
		this.loginProxy = Hades.Schema.Entity.createSingle(Hades.Config.loginProxy())
		this.loginProxy.onCreate()
	}

	getLoginProxy(){
		return this.loginProxy
	}

	canLogin(userId){
		return true
	}

	checkQueue(pid){
		return 0
	}

	async login(session, userId, playerId){
		let backendId = Hades.Config.randomBackendServer()
		await this.bindSession(session, backendId, playerId)
		return {
			backendId : backendId,
			playerId : playerId,
			isNewbie : true
		}
	}

	async bindSession(session, backendId, playerId){
		await util.promisify(session.bind.bind(session))(playerId)				
		session.set("backendID", backendId)
		session.set('playerID', playerId)
		session.on('closed', this.onSessionClose)
		await util.promisify(session.pushAll.bind(session))()	
	}

	//remote
	async kickProxy(args){
		let {proxyId, reason} = args
		let ss = Hades.App.getSessionService()
		let kick = util.promisify(ss.kick.bind(ss))
		return await kick(proxyId, reason)
	}

	onSessionClose(session, reason){
		let playerID = session.get("playerID")
		let backendID = session.get("backendID")
		Hades.Event.emit(Hades.Event.ON_DISCONNECT, backendID, playerID, reason)
	}
}

module.exports = LoginMgr