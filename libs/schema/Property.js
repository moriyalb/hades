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
	let oldValue = Reflect.get(target, key)
	
	if (_.isSafeInteger(arrkey)){
		key = arrkey		
		value = Property._value(value, this,  {
			parentType : info.type,
			type : Types.getCompositeType(info.type.type),
			typePath: [...info.typePath, info.type.ctype],
			valuePath : [...info.valuePath, key]
		}, oldValue)
		if (_.isNil(value)){
			return true //don't really set this value but we can not return false
		}
	}else if (key == "length"){
		if (Reflect.get(target, key) > value){
			Hades.Event.emit(Hades.Event.ON_DELETE_PROPERTY, this, info)			
			for (let i = 0; i < value; ++i){
				Hades.Event.emit(Hades.Event.ON_UPDATE_PROPERTY, this, {
					typePath: [...info.typePath, info.type.ctype],
					valuePath : [...info.valuePath, i]
				}, target[i])
			}
		}
	}
	return Reflect.set(target, key, value, receiver)
}

const MapWrapper = {
	get(target, key, rev){
		if (key == "get" || key == "set" || key == "delete" || key == "clear"){
			return rev[`_${key}`].bind(this, target)
		}else if(key == "asPlainObject"){			
			let out = {}
			for (let [k,v] of target){
				out[k] = v
			}
			return R.always(out)
		}else if(typeof(target[key]) == 'function'){
			return target[key].bind(target)
		}
		return target[key]
		//This won't work for `size` property (which is a Map.prototype.size method.)
		//return Reflect.get(target, key, rev) 
	}
}

function parseMapKey(key, info){
	let kt = Types.getCompositeType(info.type.keyType)
	let vt = Types.getCompositeType(info.type.valueType)
	//console.log("parseMapKey -> ", key, typeof key, info, type, kt, vt)
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
			let [prop, key] = args
			key = parseMapKey(key, info)			
			return target.call(prop, key)
		}
	}
	
	const SetWrapper = {
		apply(target, thisBinding, args){
			let [prop, key, value] = args
			key = parseMapKey(key, info)		

			let vt = Types.getCompositeType(info.type.valueType)
			
			value = Property._value(value, entity,  {
				parentType : info.type,
				type : vt,
				typePath: [...info.typePath, info.type.ctype],
				valuePath : [...info.valuePath, key]
			}, prop.get(key))
			if (_.isNil(value)){
				return true //don't really set this value but we can not return false
			}
			return target.call(prop, key, value)
		}
	}

	const DeleteWrapper = {
		apply(target, thisBinding, args){
			let [prop, key] = args
			key = parseMapKey(key, info)	
			Hades.Event.emit(Hades.Event.ON_DELETE_PROPERTY, entity, {
				typePath: [...info.typePath, info.type.ctype],
				valuePath : [...info.valuePath, key]
			})	
			return target.call(prop, key)
		}
	}

	const ClearWrapper = {
		apply(target, thisBinding, args){
			let [prop] = args
			//console.log("ClearWrapper -> ", prop.size)
			if (prop.size > 0){
				Hades.Event.emit(Hades.Event.ON_DELETE_PROPERTY, entity, {
					typePath: info.typePath,
					valuePath : info.valuePath
				})	
			// }else{
			// 	console.log("Clear Nothing ->")
			}
			
			return target.call(prop)
		}
	}

	let wrapper = new Proxy(value, MapWrapper)
	wrapper._get = new Proxy(value.get, GetWrapper)
	wrapper._set = new Proxy(value.set, SetWrapper)
	wrapper._delete = new Proxy(value.delete, DeleteWrapper)
	wrapper._clear = new Proxy(value.clear, ClearWrapper)
	wrapper[Symbol.toPrimitive] = function(hint){
		//console.log("toPrimitive sssssssss ", hint)
		let out = []
		for (let [k, v] of this.entries()){
			out.push(`${JSON.stringify(k)}:${JSON.stringify(v)}`)
		}
		return `Map {${out.join(",")}}`
	}
	wrapper[util.inspect.custom] = function(hint){
		//console.log("util.inspect.custom sssssssss ")
		let out = []
		for (let [k, v] of this.entries()){
			out.push(`${JSON.stringify(k)}:${JSON.stringify(v)}`)
		}
		return `Map {${out.join(",")}}`
	}
	const attr = { enumerable : false }
	Object.defineProperties(wrapper, {
		"_get" : attr,
		"_set" : attr,
		"_delete" : attr,
		"_clear" : attr,
		[Symbol.toPrimitive] : attr,
		[util.inspect.custom] : attr
	})

	return wrapper
}

function ObjectGetter(info, target, key, receiver) {	
	let value = Reflect.get(target, key, receiver)
	if (key in info.type.fields && _.isNil(value)){
		let subId = Types.getTypeId(info.type.fields[key])
		value = Property._value(Types.getDefaultValue(subId), this,  {
			parentType : info.type,
			type: Types.getCompositeTypeById(subId),
			typePath: [...info.typePath, info.type.ctype],
			valuePath : [...info.valuePath, key]
		})
		target[key] = value
	}
	return value
}

function ObjectSetter(info, target, key, value, receiver) {	
	let type = Types.getCompositeTypeById(info.typeId)
	let oldValue = Reflect.get(target, key, receiver)
	if (value == oldValue){
		return true
	}
	
	if (key in info.type.fields){
		let subId = Types.getTypeId(info.type.fields[key])	
		value = Property._value(value, this,  {
			parentType : info.type,
			type: Types.getCompositeTypeById(subId),
			typePath: [...info.typePath, info.type.ctype],
			valuePath : [...info.valuePath, key]
		}, oldValue)
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
			parentType : null,			
			type : Types.getCompositeTypeById(props[key].type),
			typePath: ["object"],
			valuePath : [key]
		})
		target[key] = value
	}
	return value
}

function PropertySetter(target, key, value, receiver) {
	let props = Hades.Schema.getMetaProperty(this._ename)
	let oldValue = Reflect.get(target, key, receiver)
	if (value == oldValue){
		return true
	}

	if (Reflect.has(props, key)){
		value = Property._value(value, this, {
			parentType : null,			
			type : Types.getCompositeTypeById(props[key].type),
			typePath: ["object"],
			valuePath : [key]
		}, oldValue)
		if (_.isNil(value)){
			return true //don't really set this value but we can not return false
		}
	}
	return Reflect.set(target, key, value, receiver)
}

function PropertyChecker(target, name) {
	let props = Hades.Schema.getMetaProperty(this._ename)
	//console.log("Check Props -> ", props)
	return Reflect.has(props, name)
}

Property.root = (entity) => {	
	return new Proxy({}, {
		get : _.bind(PropertyGetter, entity),
		set : _.bind(PropertySetter, entity),
		has : _.bind(PropertyChecker, entity)
	})
}

Property._value = (value, entity, info, oldValue) => {	
	if (Hades.Config.isDebugging()){
		//console.log("Property _value checking2 -> ", value, info)
		if (!Types.assertType(info.type.id, value)){
			console.error("Invalid Entity Property Value -> ", info, value, entity._ename)
			return
		}
	}
	
	let prop
	switch(info.type.ctype){
		case 'basic':		
			prop = value
			Hades.Event.emit(Hades.Event.ON_UPDATE_PROPERTY, entity, info, prop)
		break

		case 'enum':
			prop = typeof(value) == "string" ? type.fields[value] : value
			Hades.Event.emit(Hades.Event.ON_UPDATE_PROPERTY, entity, info, prop)
		break

		case 'array':
			prop = new Proxy([], {
				set : _.bind(ArraySetter, entity, info)
			})
			if (!_.isNil(oldValue) && oldValue.length > 0){
				Hades.Event.emit(Hades.Event.ON_DELETE_PROPERTY, entity, info)
			}			
			for (let v of value){
				prop.push(v)
			}		
		break

		case 'map':
			prop = wrapMap(entity, info, new Map())
			let oldKeys = _.isNil(oldValue) ? new Set([]) : new Set(oldValue.keys())
			if (util.types.isMap(value)){
				for (let [k, v] of value){
					prop.set(k, v)
					oldKeys.delete(k)
				}				
			}else{
				for (let k in value){
					prop.set(k, value[k])
					oldKeys.delete(k)
				}	
			}
			for (let ok of oldKeys){
				Hades.Event.emit(Hades.Event.ON_DELETE_PROPERTY, entity, {
					typePath : [...info.typePath, info.type.ctype],
					valuePath : [...info.valuePath, ok]
				})
			}
		break

		case 'object':
			prop = new Proxy({}, {
				get : _.bind(ObjectGetter, entity, info),
				set : _.bind(ObjectSetter, entity, info)
			})
			for (let f in info.type.fields){
				let ft = info.type.fields[f]
				let subTypeInfo = Types.getCompositeType(ft)
				//console.log("check obj -> ", prop[f], value[f],  Types.getDefaultValue(subTypeInfo.id))
				prop[f] = !_.isNil(value[f]) ? value[f] : Types.getDefaultValue(subTypeInfo.id)
				delete value[f]		
			}
			for (let f in value){
				prop[f] = value[f]
			}
		break
	}
	
	return prop
}

