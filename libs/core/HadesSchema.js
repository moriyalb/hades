const _ = require("lodash")
const R = require("ramda")
const path = require("path")
const fs = require("fs")
const produce = require("immer").default

const HadesConst = require("./HadesConst")
const HadesConfig = require("./HadesConfig")

const IMPLEMENT_OMIT_METHODS = new Set(['constructor', 
	'onCreate', 'onLoad', 'onPrepare', 'onConnect', 'onDisconnect', 'onDestroy'])

class HadesSchema {
	constructor(){
		this.metaEntities = {}
	}

	init(){
		this.Types = require("../schema/Types")
		this.Types.init()	

		for (let ename in HadesConfig.schemaEntities()){
			let ecfg = HadesConfig.schemaEntities()[ename]
			if (ecfg.abstract) continue
			this._addMetaEntity(ename, ecfg)
		}

		this._loadSysDefine()
		
		this.Entity = require("../schema/Entity")
		this.Mailbox = require("../schema/Mailbox")				
	}

	hasEntity(ename){
		return _.has(this.metaEntities, ename)
	}

	allEntities(){
		return this.metaEntities
	}

	getMetaEntity(ename){
		return this.metaEntities[ename]
	}

	getEntityIdName(ename){
		let e = this.metaEntities[ename]
		return e.idName
	}

	getMetaProperty(ename){
		let e = this.metaEntities[ename]
		if (!e.properties){
			e.properties = this._properties(ename, HadesConfig.schemaEntities()[ename])
		}
		return e.properties
	}

	getMetaMethod(ename){
		let e = this.metaEntities[ename]
		if (!e.methods){
			e.methods = this._methods(ename, HadesConfig.schemaEntities()[ename])
		}
		return e.methods
	}

	getPushMethods(ename){
		let e = this.metaEntities[ename]
		return e.pushes		
	}

	getEntityMethodClass(ename){
		let e = this.metaEntities[ename]
		//console.log("getEntityMethodClass ", ename, e)
		if (!e){
			//Abstract
			let epath = path.join(HadesConfig.entitiesPath(), HadesConfig.schemaEntities()[ename].path, ename)
			return require(`${epath}Method`)
		}else if (e.isSystem){
			//System
			let epath = `../entity/${ename}`			
			return require(epath)
		}else{
			let epath = path.join(HadesConfig.entitiesPath(), HadesConfig.schemaEntities()[ename].path, ename)
			return require(`${epath}Method`)
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
		for (let imp in ecfg.impProperties){
			let impCfg = HadesConfig.schemaEntities()[imp]
			props = Object.assign(props, impCfg.properties)
		}
		return props
	}

	_methods(ename, ecfg){
		let methods = {}
		let e = this.getEntityMethodClass(ename)
		for (let methodName of Reflect.ownKeys(e.prototype)) {
            methods[methodName] = e.prototype[methodName]
        }
		methods = Object.assign(methods, e.prototype)
		for (let imp in ecfg.implements){
			let emp = this.getEntityMethodClass(imp)
			for (let methodName of Reflect.ownKeys(emp.prototype)) {
				if (IMPLEMENT_OMIT_METHODS.has(methodName)) continue
				methods[methodName] = emp.prototype[methodName]
			}			
		}
		//console.log("Schema load methods -> ", ename, methods, e.prototype)
		//console.log("methods checking -> ", Reflect.has(methods, "onCreate"))
		return methods
	}

	_remoteMethodCfg(ename, ecfg){
		let r = ecfg.remotes
		for (let imp in ecfg.implements){
			let impCfg = HadesConfig.schemaEntities()[imp]
			r = _.concat(r, impCfg.remotes)
		}
		return new Set(r)
	}

	_pushMethodCfg(ename, ecfg){
		let r = ecfg.pushes
		for (let imp in ecfg.implements){
			let impCfg = HadesConfig.schemaEntities()[imp]
			r = _.concat(r, impCfg.pushes)
		}
		return new Set(r)
	}

	_loadSysDefine(){
		let SysRemoteMethods = []
		let SysEntities = []
		let files = fs.readdirSync(`${__dirname}/../entity`)
		for (let f of files){
			if (f.endsWith(HadesConst.DefineSuffix)){
				let ename = path.basename(f, HadesConst.DefineSuffix)
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

		this.Methods = produce(HadesConfig.schemaMethods(), (draft)=>{
			for (let ret of SysRemoteMethods){
				draft.remote[ret.name] = ret
			}
		})
		this.metaEntities = produce(this.metaEntities, (draft)=>{
			for (let ent of SysEntities){
				draft[ent.ename] = {
					idName : `${_.lowerFirst(ent.ename)}ID`,
					etype : HadesConst.EntityType.Single,
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