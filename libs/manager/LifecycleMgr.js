"use strict"

const util = require('util')
const R = require("ramda")

const Hades = GlobalHades

class Lifecycle{
	constructor(){

	}

	register(callbacks){
		callbacks.beforeStartup = this.beforeStartup.bind(this)
		callbacks.beforeShutdown = this.beforeShutdown.bind(this)
	}

	async beforeStartup(){
		//console.log("beforeStartup 1")
		await this._entityCB("onInit")	
		//console.log("beforeStartup 2")
		await Hades.Event.asyncEmit(Hades.Event.HOOK_ON_SERVER_STARTUP)
		//console.log("beforeStartup 3")
	}

	// async afterStartup(){
		
	// }

	// async afterStartAll(){
		
	// }

	async beforeShutdown(){
		await Hades.Event.asyncEmit(Hades.Event.HOOK_ON_SERVER_SHUTDOWN)
		await this._entityCB("onFini")					
		await Hades.DataMgr.doBeforeShutDown()
	}

	async _entityCB(method){
		let executes = []
		for (let e in Hades.Local){
			//console.log("check ======= ", method, e)
			executes.push(Hades.Local[e][method]())
		}
		for (let e in Hades.SysLocal){
			//console.log("check ======= ", method, e)
			executes.push(Hades.SysLocal[e][method]())
		}	
		return await Promise.all(executes)
	}
}

module.exports = new Lifecycle()
