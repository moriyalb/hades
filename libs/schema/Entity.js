"use strict"

const _ = require("lodash")
const EventEmitter = require("events")
const assert = require("assert")
const Hades = GlobalHades
const Property = require("./Property")
const EntityWrapper = require("./wrapper/EntityWrapper")
const SingleEntityWrapper = require("./wrapper/SingleEntityWrapper")

class ProxyEntity extends EventEmitter {
    constructor(ename, eid) {
		super()

		if (Hades.Config.isDebugging()){
			assert(Hades.Schema.hasEntity(ename), "Create Entity Invalid Entity -> ", ename)
			assert(eid > 0, "Create Entity Invalid EntityID -> ", ename, eid)			
		}

		this._ename = ename
		this._eid = eid
		this._eidName = Hades.Schema.getEntityIdName(ename)
		this[this._eidName] = eid
		this._isEntity = true
		this._inited = false

		this._properties = Property.root(this)
		this._frontId = null //needs to be set
	}

	_setFrontendId(fid){
		this._frontId = fid
		this.client = Hades.Schema.Mailbox.createClient(this._frontId, this._eid)
	}
}

class SimpleEntity {
    constructor(ename, eid) {
		if (Hades.Config.isDebugging()){
			assert(Hades.Schema.hasEntity(ename), "Create Entity Invalid Entity -> ", ename)
			assert(eid > 0, "Create Entity Invalid EntityID -> ", ename, eid)			
		}

		this._ename = ename
		this._eid = eid
		this._eidName = Hades.Schema.getEntityIdName(ename)
		this[this._eidName] = eid
		this._properties = Property.root(this)		
		this._inited = false
		this._isEntity = true
	}
}


class SingleEntity {
    constructor(ename) {
		if (Hades.Config.isDebugging()){
			assert(Hades.Schema.hasEntity(ename), "Create Entity Invalid Entity -> ", ename)
		}

		this._ename = ename
		this._isEntity = true
	}
}

class EntityFactory {
	/**
	 * 新创建Proxy，此时Proxy的onCreate回调被调用，
	 * onCreate中的赋值将由dms自动保存（因此无需在创建时等待存库完毕）
	 * TODO，是否在创建时等待存库完毕？因为无法保证存库成功
	 * @param {*} ename 
	 * @param {*} eid 
	 */
	async createProxy(ename, eid){
		//console.log("create Proxy -> ", ename, eid)
		let entity = new ProxyEntity(ename, eid)
		entity = new Proxy(entity, EntityWrapper)
		entity._self = entity
		entity._inited = true

		await entity.onCreate()
		await entity.onLoad()
		return entity
	}

	async createProxyFromDB(ename, eid){
		let entity = new ProxyEntity(ename, eid)
		entity = new Proxy(entity, EntityWrapper)
		//console.log("createProxyFromDB ---------- ", ename, eid, entity)
		entity._self = entity

		let data = await Hades.DataMgr.getEntityData(ename, { 
			[entity._eidName]: eid 
		}, {})

		for (let pname in data){
			entity._properties[pname] = data[pname]
		}

		entity._inited = true
		await entity.onLoad()
		return entity
	}

	async createSimple(ename, eid, data){
		let entity = new SimpleEntity(ename, eid)
		entity = new Proxy(entity, EntityWrapper)
		for (let pname in data){
			entity._properties[pname] = data[pname]
		}
		entity._inited = true
		await entity.onCreate()
		return entity
	}

	async createSimpleFromDB(ename, eid){
		let entity = new SimpleEntity(ename, eid)
		entity = new Proxy(entity, EntityWrapper)

		let data = await Hades.DataMgr.getEntityData(ename, { 
			[entity._eidName]: eid 
		}, {})

		for (let pname in data){
			entity._properties[pname] = data[pname]
		}

		entity._inited = true
		await entity.onLoad()
		return entity
	}

	async saveSimple(entity){
		await Hades.Event.asyncEmit(Hades.Event.ON_SAVE_PROPERTY, entity._eid)
		await entity.onSave()
	}

	createSingle(ename){
		let entity = new SingleEntity(ename)
		entity = new Proxy(entity, SingleEntityWrapper)
		entity._self = entity

		return entity
	}

	isProxyEntity(e){
		return e instanceof ProxyEntity
	}

	isSimpleEntity(e){
		return e instanceof SimpleEntity
	}

	isSingleEntity(e){
		return e instanceof SingleEntity
	}
}

module.exports = new EntityFactory()
