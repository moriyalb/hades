"use strict"

const _ = require("lodash")
const util = require("util")
const EventEmitter = require("events")

class HadesEvent extends EventEmitter {
	constructor(){
		super()

		this.ON_DISCONNECT = Symbol("ON_DISCONNECT")
		this.ON_UPDATE_PROPERTY = Symbol("ON_UPDATE_PROPERTY")
		this.ON_DELETE_PROPERTY = Symbol("ON_DELETE_PROPERTY")
		this.ON_SAVE_PROPERTY = Symbol("ON_SAVE_PROPERTY")

		this.HOOK_ON_REQ_MSG = Symbol("HOOK_ON_REQ_MSG")
		this.HOOK_ON_RESP_MSG = Symbol("HOOK_ON_RESP_MSG")
		this.HOOK_ON_REMOTE_REQ_MSG = Symbol("HOOK_ON_REMOTE_REQ_MSG")
		this.HOOK_ON_REMOTE_RESP_MSG = Symbol("HOOK_ON_REMOTE_RESP_MSG")
		this.HOOK_ON_PUSH_MSG = Symbol("HOOK_ON_PUSH_MSG")
		this.HOOK_ON_SERVER_STARTUP = Symbol("HOOK_ON_SERVER_STARTUP")
		this.HOOK_ON_SERVER_SHUTDOWN = Symbol("HOOK_ON_SERVER_SHUTDOWN")
		this.HOOK_ON_HOTFIX = Symbol("HOOK_ON_HOTFIX")
	}

	/**
	 * 异步事件触发, 示例如下
	 * 目前事件触发器并行执行
	  
	  	console.log("Start Test -> ")
		function f(){
			Hades.Event.on(Hades.Event._TEST_ASYNC, async (a, b, c)=>{
				await Hades.TimeUtil.sleep(2000)
				console.log("check abc1 ", a, b, c, this)
			})

			Hades.Event.on(Hades.Event._TEST_ASYNC, async (a, b, c)=>{
				await Hades.TimeUtil.sleep(3000)
				console.log("check abc2 ", a, b, c, this)
			})
		}
		f.call(100)
		await Hades.Event.asyncEmit(Hades.Event._TEST_ASYNC, 1, 2, 3)
		console.log("End Test -> ")

	 * @param {*} event 
	 * @param {*} args 
	 */
	async asyncEmit(event, ...args){
		return new Promise((resolve, reject)=>{
			let handlers = this._events[event]
			if (!handlers) resolve()
			if (typeof handlers === 'function') handlers = [handlers]
			let results = []
			for (let handler of handlers){
				let r = handler(...args)
				if (!util.types.isPromise(r)){
					r = new Promise((res)=>{res(r)})
				}
				results.push(r)
			}
			Promise.all(results).then(()=>{
				resolve()
			}).catch((err)=>{
				reject(new Error(`HadesEvent::AsyncEmit -> ${String(event)}, ${err}`))
			})
		})
		
	}
}

module.exports = new HadesEvent()