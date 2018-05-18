"use strict"

const util = require('util')
const R = require("ramda")

const Hades = GlobalHades

class Lifecycle{
	constructor(){

	}

	register(callbacks){
		callbacks.beforeStartup = util.callbackify(this.beforeStartup)
		callbacks.beforeShutdown = util.callbackify(this.beforeShutdown)
	}

	async beforeStartup(){
		let executes = []
		for (let e in Hades.Local){
			executes.push(Hades.Local[e].onInit())
		}		
		return await Promise.all(executes)
	}

	async afterStartup(){
		
	}

	async afterStartAll(){
		
	}

	async beforeShutdown(){
		
		let executes = []
		for (let e in Hades.Local){
			executes.push(Hades.Local[e].onFini())
		}	
		await Promise.all(executes)

		await Hades.DataMgr.doBeforeShutDown()
	}
}

module.exports = new Lifecycle()
