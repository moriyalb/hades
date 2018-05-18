"use strict"

const _ = require("lodash")
const R = require("ramda")
const util = require("util")
const assert = require("assert")
const Hades = GlobalHades
const Types = Hades.Schema.Types

const Property = module.exports

function ArraySetter(info, target, key, value, receiver) {	
	//console.log("ArraySetter called ", key, value)
	let arrkey = parseInt(key)
	if (_.isSafeInteger(arrkey)){
		key = arrkey
		let type = Types.getCompositeTypeById(info.typeId)
		let subId = Types.getTypeId(type.type)
		value = Property._value(value, this,  {
			typeId : subId,
			path : [...info.path, key],
			isArray : true
		})
		if (_.isNil(value)){
			return true //don't really set this value but we can not return false
		}
	}else if (key == "length"){
		Reflect.get(target, key), value
	}
	return Reflect.set(target, key, value, receiver)
}

const MapWrapper = {
	get(target, key, rev){
		if (key == "set" || key == "get"){
			return rev[`_${key}`].bind(this, target)
		}else if(typeof(target[key]) == 'function'){
			return target[key].bind(target)
		}
		return target[key]
		//This won't work for `size` property (which is a Map.prototype.size method.)
		//return Reflect.get(target, key, rev) 
	}
}

function parseMapKey(key, info){
	let type = Types.getCompositeTypeById(info.typeId)
	let kt = Types.getCompositeType(type.keyType)
	let vt = Types.getCompositeType(type.valueType)
	console.log("parseMapKey -> ", key, typeof key, info, type, kt, vt)
	if (Types.isIntegerKey(kt.type)){
		key = parseInt(key)
		if (!_.isSafeInteger(key)){
			console.error("Invalid Map Key -> ", this._ename, info, key, value)
			return
		}
	}
	return key
}

function wrapMap(entity, info, value){
	const GetWrapper = {
		apply(target, thisBinding, args){
			console.log("GetWrapper get ", args)

			let [prop, key] = args
			let key = parseMapKey(key, info)			
			return target.call(prop, key)
		}
	}
	
	const SetWrapper = {
		apply(target, thisBinding, args){
			console.log("SetWrapper set", args)

			let [prop, key, value] = args
			key = parseMapKey(key, info)		

			let type = Types.getCompositeTypeById(info.typeId)
			let vt = Types.getCompositeType(type.valueType)
			
			console.log("SetWrapper 2 -> ", type, vt, subId)
			value = Property._value(value, this,  {
				typeId : vt.id,
				path : [...info.path, key]
			})
			if (_.isNil(value)){
				return true //don't really set this value but we can not return false
			}
			return target.call(prop, key, value)
		}
	}

	let wrapper = new Proxy(value, MapWrapper)
	wrapper._get = new Proxy(value.get, GetWrapper)
	wrapper._set = new Proxy(value.set, SetWrapper)
	wrapper[Symbol.toPrimitive] = function(hint){
		//console.log("toPrimitive sssssssss ", hint)
		return `Map {${_.toArray(this.entries())}}`
	}
	wrapper[util.inspect.custom] = function(hint){
		//console.log("util.inspect.custom sssssssss ")
		return `Map {${_.toArray(this.entries())}}`
	}
	const attr = { enumerable : false }
	Object.defineProperties(wrapper, {
		"_get" : attr,
		"_set" : attr,
		[Symbol.toPrimitive] : attr,
		[util.inspect.custom] : attr
	})

	return wrapper
}

function ObjectGetter(info, target, key, receiver) {	
	let type = Types.getCompositeTypeById(info.typeId)
	let value = Reflect.get(target, key, receiver)
	if (key in type.fields && _.isNil(value)){
		let subId = Types.getTypeId(type.fields[key])
		console.log("ObjectGetter -> ", key , subId, Types.getDefaultValue(subId))
		value = Property._value(Types.getDefaultValue(subId), this,  {
			typeId : subId,
			path : [...info.path, key]
		})
		target[key] = value
	}
	return value
}

function ObjectSetter(info, target, key, value, receiver) {	
	let type = Types.getCompositeTypeById(info.typeId)
	if (value == Reflect.get(target, key, receiver)){
		return true
	}
	
	if (key in type.fields){
		let subId = Types.getTypeId(type.fields[key])
		value = Property._value(value, this,  {
			typeId : subId,
			path : [...info.path, key]
		})
		if (_.isNil(value)){
			return true //don't really set this value but we can not return false
		}
	}
	return Reflect.set(target, key, value, receiver)
}


function PropertyGetter(target, key, receiver) {
	let props = Hades.Schema.getMetaProperty(this._ename)
	let value = Reflect.get(target, key, receiver)

	//console.log("PropertyGetter ", _.has(props, key), value)
	
	if (_.has(props, key) && _.isNil(value)){
		let dv = props[key].default
		if (_.isNil(dv)){
			let tid = props[key].type
			dv = Types.getDefaultValue(tid)
		}
		value = Property._value(dv, this,  {
			typeId : props[key].type,
			path : [key]
		})
		target[key] = value
	}
	return value
}

function PropertySetter(target, key, value, receiver) {
	let props = Hades.Schema.getMetaProperty(this._ename)
	if (value == Reflect.get(target, key, receiver)){
		return true
	}

	if (Reflect.has(props, key)){
		value = Property._value(value, this, {
			typeId : props[key].type,
			path : [key]
		})
		if (_.isNil(value)){
			return true //don't really set this value but we can not return false
		}
	}
	return Reflect.set(target, key, value, receiver)
}

function PropertyChecker(target, name) {
	let props = Hades.Schema.getMetaProperty(this._ename)
	return Reflect.has(props, name)
}

Property.root = (entity) => {	
	return new Proxy({}, {
		get : _.bind(PropertyGetter, entity),
		set : _.bind(PropertySetter, entity),
		has : _.bind(PropertyChecker, entity)
	})
}

Property._value = (value, entity, info) => {	
	if (Hades.Config.isDebugging()){
		//console.log("Property _value checking2 -> ", value, info.typeId)
		if (!Types.assertType(info.typeId, value)){
			console.error("Invalid Entity Property Value -> ", info, value, entity._ename)
			return
		}
	}
	let type = Types.getCompositeTypeById(info.typeId)
	let prop
	switch(type.ctype){
		case 'basic':
			prop = value
		break

		case 'enum':
			prop = typeof(value) == "string" ? type.fields[value] : value
		break

		case 'array':
			prop = new Proxy([], {
				set : _.bind(ArraySetter, entity, info)
			})
			for (let v of value){
				prop.push(v)
			}
			//console.log("_value case array -> ", info)
			if (Hades.Config.isWholeArrayNeeded()){
				Hades.Event.emit(Hades.Event.ON_UPDATE_PROPERTY, entity._ename, info.path, prop)
				return prop
			}
		break

		case 'map':
			prop = wrapMap(entity, info, new Map())
			for (let v in value){
				prop[v] = value[v]
			}
		break

		case 'object':
			prop = new Proxy({}, {
				get : _.bind(ObjectGetter, entity, info),
				set : _.bind(ObjectSetter, entity, info)
			})
			for (let f in type.fields){
				let ft = type.fields[f]
				let subTypeInfo = Types.getCompositeType(ft)
				console.log("check obj -> ", prop[f], value[f],  Types.getDefaultValue(subTypeInfo.id))
				prop[f] = !_.isNil(value[f]) ? value[f] : Types.getDefaultValue(subTypeInfo.id)
				delete value[f]		
			}
			for (let f in value){
				prop[f] = value[f]
			}
		break
	}

	if (Hades.Config.isWholeArrayNeeded() && info.isArray){

	}else{
		Hades.Event.emit(Hades.Event.ON_UPDATE_PROPERTY, entity._ename, info.path, prop)
	}
	
	return prop
}

