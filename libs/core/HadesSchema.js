"use strict"

const _ = require("lodash")
const R = require("ramda")
const path = require("path")
const fs = require("fs")
const produce = require("immer").default

const Hades = GlobalHades

const IMPLEMENT_OMIT_METHODS = new Set(['constructor', 
	'onCreate', 'onLoad', 'onPrepare', 'onConnect', 'onDisconnect', 'onDestroy', 'onInit', 'onFini', 'onRoute', 'onSave'])

/**
 * Schema Configs can not be hot reload now. Those configs affects the protocol with the client.
 * So any of the schema entity config changing, the server should be restarted, meanwhile a patch should be install on the client side.
 */
class HadesSchema {
	constructor(){
		this.metaEntities = {}
	}

	init(){
		this.Types = require("../schema/Types")
		this.Types.init()

		for (let ename in Hades.Config.schemaEntities()){
			let ecfg = Hades.Config.schemaEntities()[ename]
			if (ecfg.abstract) continue
			this._addMetaEntity(ename, ecfg)
		}

		this._loadSysDefine()

		this.resetMetaMethod()
		
		this.Entity = require("../schema/Entity")
		this.Mailbox = require("../schema/Mailbox")				
	}

	/**
	 * Check if it is a valid schema entity
	 * @param {*} ename 
	 */
	hasEntity(ename){
		return _.has(this.metaEntities, ename)
	}

	/**
	 * Get all schema entities
	 */
	allEntities(){
		return this.metaEntities
	}

	/**
	 * Get the given shema entity
	 * @param {*} ename 
	 */
	getMetaEntity(ename){
		return this.metaEntities[ename]
	}

	/**
	 * Get the entity id name
	 * Simply likes [entityName] + "ID"
	 * @param {*} ename 
	 */
	getEntityIdName(ename){
		let e = this.metaEntities[ename]
		return e.idName
	}

	/**
	 * Get the schema entity property defines with all implements
	 * @param {*} ename 
	 */
	getMetaProperty(ename){
		let e = this.metaEntities[ename]
		if (!e.properties){
			this.metaEntities = produce(this.metaEntities, (draft)=>{
				draft[ename].properties = this._properties(ename, Hades.Config.schemaEntities()[ename])
			})	
			e = this.metaEntities[ename]
		}
		return e.properties
	}

	/**
	 * Get the schema entity push method defines with all implements
	 * @param {*} ename 
	 */
	getPushMethods(ename){
		let e = this.metaEntities[ename]
		return e.pushes		
	}

	/**
	 * Get the schema entity remote method defines with all implements
	 * @param {*} ename 
	 */
	getRemoteMethods(ename){
		let e = this.metaEntities[ename]
		return e.remotes		
	}

	/**
	 * Get the schema entity method scripts.
	 * Notice: the scripts can be hot reloaded by resetMetaMethod function.
	 * @param {*} ename 
	 */
	getMetaMethod(ename){
		let e = this.metaEntities[ename]
		//console.log("getMetaMethod ", ename, e.methods)	
		return e.methods
	}

	/**
	 * Reload the schema entity method scripts.
	 */
	resetMetaMethod(){
		//console.log("resetMetaMethod called -> ")
		this.metaEntities = produce(this.metaEntities, (draft)=>{
			for (let ename in draft){
				let e = draft[ename]
				//console.log("resetMetaMethod called -> ", ename)
				e.methods = this._methods(ename, Hades.Config.schemaEntities()[ename])
			}
		})		
	}

	/**
	 * Get a entity metho proto defines
	 * @param {*} ename 
	 */
	getEntityProto(ename){
		return this._getEntityMethodClass(ename).prototype
	}

	_getEntityMethodClass(ename){
		let e = this.metaEntities[ename]
		//console.log("getEntityMethodClass ", ename, e)
		if (!e){
			//Abstract
			let epath = path.join(Hades.Config.entitiesPath(), Hades.Config.schemaEntities()[ename].path, ename)
			return Hades.LoaderUtil.reload(`${epath}Method`)
		}else if (e.isSystem){
			//System
			let epath = `../entity/${ename}`			
			return Hades.LoaderUtil.reload(epath)
		}else{
			let epath = path.join(Hades.Config.entitiesPath(), Hades.Config.schemaEntities()[ename].path, ename)
			return Hades.LoaderUtil.reload(`${epath}Method`)
		}		
	}

	_addMetaEntity(ename, ecfg){
		//console.log("check entity -> ", ename, ecfg)
		let e = {
			idName : `${_.lowerFirst(ename)}ID`,
			server : ecfg.server,
			isSystem : false,
			etype : ecfg.etype,
			remotes : this._remoteMethodCfg(ename, ecfg),
			pushes : this._pushMethodCfg(ename, ecfg)
		}
		this.metaEntities[ename] = e	
	}

	_properties(ename, ecfg){		
		let props = {}
		props = Object.assign({}, ecfg.properties)
		for (let imp in ecfg.implements){
			let impCfg = Hades.Config.schemaEntities()[imp]
			props = Object.assign(props, impCfg.properties)
		}
		return props
	}

	_methods(ename, ecfg){
		let methods = {}
		let e = this._getEntityMethodClass(ename)
		for (let methodName of Reflect.ownKeys(e.prototype)) {
            methods[methodName] = e.prototype[methodName]
        }

		if (!!ecfg){
			for (let imp in ecfg.implements){
				let emp = this._getEntityMethodClass(imp)
				for (let methodName of Reflect.ownKeys(emp.prototype)) {
					if (IMPLEMENT_OMIT_METHODS.has(methodName)) continue
					methods[methodName] = emp.prototype[methodName]
				}			
			}
		}		
		//console.log("Schema load methods -> ", ename, methods, e.prototype)
		//console.log("methods checking1 -> ", Reflect.has(methods, "onCreate"))
		//console.log("methods checking2 -> ", Reflect.has(methods, "onLoad"))
		return methods
	}

	_remoteMethodCfg(ename, ecfg){
		let r = ecfg.remotes
		for (let imp in ecfg.implements){
			let impCfg = Hades.Config.schemaEntities()[imp]
			r = _.concat(r, impCfg.remotes)
		}
		return new Set(r)
	}

	_pushMethodCfg(ename, ecfg){
		let r = ecfg.pushes
		for (let imp in ecfg.implements){
			let impCfg = Hades.Config.schemaEntities()[imp]
			r = _.concat(r, impCfg.pushes)
		}
		return new Set(r)
	}

	_loadSysDefine(){
		let SysRemoteMethods = []
		let SysEntities = []
		let files = fs.readdirSync(`${__dirname}/../entity`)
		for (let f of files){
			if (f.endsWith(Hades.Const.DefineSuffix)){
				let ename = path.basename(f, Hades.Const.DefineSuffix)
				let sysDef = fs.readFileSync(`${__dirname}/../entity/${f}`)
				let entity = JSON.parse(sysDef)				
				SysEntities.push({
					ename : ename,
					server : entity.Server,
					remotes : R.keys(entity.Remotes)
				})
				for (let rname in entity.Remotes){
					let reqs = []
					let resps = []
					let rdef = entity.Remotes[rname]
					for (let reqname in rdef.req){
						let tp = rdef.req[reqname]
						reqs.push([
							this.Types.types[tp].id, reqname, "", true
						])
					}
					for (let reqname in rdef.resp){
						let tp = rdef.resp[reqname]
						resps.push([
							this.Types.types[tp].id, reqname, "", true
						])
					}
					SysRemoteMethods.push({name:rname, req:reqs, resp:resps})
				}
			}
		}

		this.Methods = produce(Hades.Config.schemaMethods(), (draft)=>{
			for (let ret of SysRemoteMethods){
				draft.remote[ret.name] = ret
			}
		})
		this.metaEntities = produce(this.metaEntities, (draft)=>{
			for (let ent of SysEntities){
				draft[ent.ename] = {
					idName : `${_.lowerFirst(ent.ename)}ID`,
					etype : Hades.Const.EntityType.Single,
					server : ent.server,
					properties : {},
					remotes : new Set(ent.remotes),
					isSystem : true
				}
			}			
		})

		//console.table(this.Methods)
		//console.table(this.metaEntities)
	}
}

module.exports = new HadesSchema()