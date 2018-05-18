const path = require("path")
const _ = require("lodash")
const R = require("ramda")

/**
 * @author: mario
 * @modified Version 0.2 from 2018/5/2
 * 
 */
const Hades = module.exports

//Make sure only this is the only global value.
GlobalHades = Hades

//Util
Hades.CryptoUtil = require("./libs/utils/CryptoUtil")
Hades.ProfanityUtil = require("./libs/utils/ProfanityUtil")
Hades.RandomUtil = require("./libs/utils/RandomUtil")
Hades.ScheduleUtil = require("./libs/utils/ScheduleUtil")
Hades.TimeUtil = require("./libs/utils/TimeUtil")
Hades.LoaderUtil = require("./libs/utils/LoaderUtil")

//Core
Hades.Const = require("./libs/core/HadesConst")
Hades.Event = require("./libs/core/HadesEvent")
Hades.Config = require("./libs/core/HadesConfig")
Hades.Logger = require("./libs/core/HadesLogger")
Hades.Schema = require("./libs/core/HadesSchema")
Hades.Protocol = require("./libs/core/HadesProtocol")

//Msg
Hades.Local = {}
Hades.SysLocal = {}
Hades.Remote = {}
Hades.SysRemote = {}


/**
 * make sure this directory contains what the hades framework needs :
 * 	-> Defines
 * 	-> Configs/Schema
 *  -> Configs/Server
 * 	-> Entities
 * 
 * generally, project should be created by hades_creator tool. (in hades/tools directory) 
 * and export all the auto configs/scripts by hades_exporter tool.(in hades/tools directory)
 * 	
 * @param {string} root Project root directory
 */
Hades.setProjectRoot = function(root){
	Hades.Config.resetConfig(root)
}

/**
 * init a hades application. which opts can have
 * 	-> name : app name
 *  -> datumMd5 : a datum MD5 config which maybe used in the handshake module.
 * 	-> verifyDatumMd5 : set true to forbid the connection unless the md5 match to the server version.
 * 	-> timeout : handlers responing delay
 *  -> heartbeat : frequency to check the connection is valid.
 *  -> lag : simulate a bad network connection.
 * @param {*} opts 
 */
Hades.init = function(opts){
	Hades.Config.isDebugging = opts.debug ? R.T : R.F
	Hades._initCore()
	Hades._initPomelo()
	Hades._initApp(opts)
}

Hades._initCore = function(){
	Hades.Logger.init()
	Hades.Schema.init()
	
	//Managers
	Hades.RedisMgr = require("./libs/manager/RedisMgr")
	Hades.RedisMgr.init()

	Hades.DataMgr = require("./libs/manager/DataMgr")
	Hades.DataMgr.init()

	Hades.CommunicateMgr = require("./libs/manager/CommunicateMgr")
	Hades.CommunicateMgr.init()

	Hades.Hook = require("./libs/manager/HookMgr")
	Hades.Hook.init()

	//Lifecycle
	Hades.Lifecycle = require("./libs/lifecycle/Lifecycle.js")
}

Hades._initPomelo = function(){
	Hades.Monitor = require("./libs/pomelo/pomelo-monitor")
	Hades.Admin = require("./libs/pomelo/pomelo-admin")
	Hades.Rpc = require("./libs/pomelo/pomelo-rpc")
	Hades.Pomelo = require("./libs/pomelo/pomelo")
}

Hades._initApp = function(opts){
	Hades.App = require("./libs/core/HadesApp")
	let app = Hades.App.createApp(opts.name || "HadesProject")
	app.configConnector(opts)

	Hades.Message = require("./libs/core/HadesMessage")
	Hades.Message.init()
}

