"use strict"

const log4js = require("log4js")
const _ = require("lodash")
const HadesConfig = require("./HadesConfig")

class HadesLogger {
	constructor(){	
		this.loggers = new Map()
	}

	init(){
		if (!!HadesConfig.getServerType()){
			let rawCfg = HadesConfig.log4jCfg()
			log4js.configure(this._modifyConfig(rawCfg))

			let consoleLogger = this.getLogger("default", "", false)
			let logger = this.getLogger("hades", "", true)
			
			//override console
			this._sys_console_log = console.log
			this._sys_console_error = console.error

			consoleLogger.isConsole = true
	
			console.log = function(){
				consoleLogger.info.apply(consoleLogger, arguments)
				logger.info.apply(logger, arguments)
			}
			console.error = function(){
				consoleLogger.error.apply(consoleLogger, arguments)
				logger.error.apply(logger, arguments)
			}
			console.warn = function(){
				consoleLogger.warn.apply(consoleLogger, arguments)
				logger.info.apply(logger, arguments)
			}

			if (!console.table){
				console.table = console.log
			}else{
				const printTable = console.table
				console.table = function(...args){
					console.info("\n")
					for (let arg of args){
						if (_.isArray(arg) || _.isMap(arg)){
							printTable(arg)
						}else{
							console.info(arg)
						}
					}
					logger.info.apply(logger, args)
				}
			}
			

			// console.log = logger.info.bind(logger)
			// console.error = logger.error.bind(logger)		
		}		
	}

	getLogger(categoryName, fileName, hideSid) {
		if (!!this.loggers.has(categoryName)){
			return this.loggers.get(categoryName)
		}

		let logger = log4js.getLogger(categoryName)
		this.loggers.set(categoryName, logger)	

		let error = logger.error
		let info = logger.info
		let warn = logger.warn
	
		if (!hideSid){					
			logger.info = function(){			
				info.apply(logger, ["<", HadesConfig.getServerId(), ">\t", ...arguments])
			}
			logger.warn = function(){
				warn.apply(logger, ["<", HadesConfig.getServerId(), ">\t", ...arguments])
			}
			logger.error = function(){
				error.apply(logger, ["<", HadesConfig.getServerId(), ">\t", ...arguments])
			}
		}

		return logger
	}

	_modifyConfig(cfg){
		for (let f in cfg.appenders){
			let detail = cfg.appenders[f]
			if (!!detail.filename){
				if (HadesConfig.isMaster()){
					detail.filename = `${detail.filename}.${HadesConfig.getEnv()}.${HadesConfig.getServerType()}.1`
				}else{
					detail.filename = `${detail.filename}.${HadesConfig.getEnv()}.${HadesConfig.getServerType()}.${HadesConfig.getServerIndex()}`
				}
				
			}
		}
		return cfg
	}
}

module.exports = new HadesLogger()