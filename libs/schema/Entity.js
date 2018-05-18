"use strict"

const _ = require("lodash")
const EventEmitter = require("events")
const assert = require("assert")
const Hades = GlobalHades
const Property = require("./Property")

const EntityWrapper = {
    get(target, key, receiver) {
		let m = target._methods
		let p = target._properties
		//console.log("EntityWrapper get ", key, Reflect.has(m, key), Reflect.has(p, key))
        if (Reflect.has(m, key)){
			return m[key].bind(target.self)
		}else if (Reflect.has(p, key)){
			return p[key]
		}else{
			return Reflect.get(target, key, receiver)
		}     
    },

    set(target, key, value, receiver) {
		let m = target._methods
		let p = target._properties
		if (Reflect.has(p, key)){
			p[key] = value
			return true
		}else if(Reflect.has(m, key)){
			console.error("Don't override entity method! ", target._ename, key)
			return false
		}else{
			return Reflect.set(target, key, value, receiver)
		}
    }
}

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

		this._methods = Hades.Schema.getMetaMethod(ename)
		this._properties = Property.root(this)
		this._frontId = null //needs to be set
	}

	_setFrontendId(fid){
		this._frontId = fid
		this.client = Hades.Schema.Mailbox.createClient(this._frontId, this._eid)
	}
}

class SimpleEntity extends EventEmitter {
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
		this._properties = Property.root(this)		
	}
}

class EntityFactory {
	constructor(){

	}

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
		entity.self = entity		
		await entity.onCreate()
		return entity
	}

	async createProxyFromDB(ename, eid){
		let entity = new ProxyEntity(ename, eid)
		entity = new Proxy(entity, EntityWrapper)
		let data = await Hades.DataMgr.getEntityData(ename, { 
			[entity._eidName]: eid 
		}, {})
		for (let pname in data){
			entity._properties[pname] = data[pname]
		}
		await entity.onLoad()
		return entity
	}

	async createSimpleFromDB(ename, eid){
		let entity = new SimpleEntity(ename, eid)
		let data = await Hades.DataMgr.getEntityData(ename, { 
			[entity._eidName]: eid 
		}, {})
		entity = Object.assign(entity, data)
		await entity.loadFromDB()
		return entity
	}
}

module.exports = new EntityFactory()
