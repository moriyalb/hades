"use strict"

const _ = require("lodash")
const util = require("util")
const Hades = GlobalHades
const Methods = Hades.Schema.Methods

class PlayerMgr {
    constructor() {
		this.players = new Map()
		this.leavingPlayers = new Map()
	}

	getPlayer(proxyId){
		return this.players.get(proxyId)
	}

	async proxyLogin(args){
		let {proxyId, frontendId, isNewbie, opts} = args
		//console.log("PlayerMgr::ProxyID -> ", proxyId)
		let player = this.players.get(proxyId)
		if (!player){
			if (isNewbie){
				player = await Hades.Schema.Entity.createProxy(Hades.Config.clientProxy(), proxyId)
			}else{
				player = await Hades.Schema.Entity.createProxyFromDB(Hades.Config.clientProxy(), proxyId)
			}
			this.players.set(proxyId, player)
		}
		this._clearLeavingTimer(proxyId)

		player._setFrontendId(frontendId)
		
		await player.onConnect(opts)

		let info = {}
		await player.onPrepare(info)
		
		return player, info
	}

	async proxyLogout(args){
		let {proxyId, immediately, reason} = args
		if (_.has(this.leavingPlayers, proxyId)){
			console.error("PlayerMgr::proxyLogout failed -> try to logout twice", proxyId)
			return 1
		}
		let player = this.players.get(proxyId)
		if (!player){
			console.error("PlayerMgr::proxyLogout failed -> player not found -> ", proxyId)
			return 1
		}
		await player.onDisconnect(reason)
			
		if (immediately){
			this._cleanUp(proxyId)
		}else{
			this._addLeavingTimer(proxyId)			
		}	
	}

	async playerCleanUp(proxyId){
		this._cleanUp(proxyId)
	}

	_addLeavingTimer(proxyId){		
		// console.error("PlayerMgr::_addLeavingTimer ", proxyId)
		let timer = setTimeout(()=>{
			this._cleanUp(proxyId)					
		}, Hades.Const.ServerCache.Time)		
		this.leavingPlayers[proxyId] = timer
	}

	_clearLeavingTimer(proxyId){
		// console.error("PlayerMgr::_clearLeavingTimer ", proxyId)
		if (!!this.leavingPlayers[proxyId]){
			clearTimeout(this.leavingPlayers[proxyId])
			delete this.leavingPlayers[proxyId]
		}
	}

	_cleanUp(proxyId){
		console.log("PlayerMgr::_cleanUp ", proxyId)
		let player = this.players.get(proxyId)
		player.onDestroy()
		this.players.delete(proxyId)
		this._clearLeavingTimer(proxyId)	
	}
}

module.exports = PlayerMgr
