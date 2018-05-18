"use strict"

const R = require("ramda")
const _ = require("lodash")
const Hades = GlobalHades
const TypeConfig = Hades.Config.schemaTypes()

const BasicTypeCheckers = {
	"blob": 	R.F, //not support now
	"int": 		_.isSafeInteger,
	"uint": 	R.both(R.lte(0), _.isSafeInteger),	    
	"tiny": 	R.allPass([R.lte(-128), R.gte(127), _.isSafeInteger]),
	"utiny": 	R.allPass([R.lte(0), R.gte(255), _.isSafeInteger]),
	"small":	R.allPass([R.lte(-32768), R.gte(32767), _.isSafeInteger]),
    "usmall":	R.allPass([R.lte(0), R.gte(65535), _.isSafeInteger]),
    "float":	_.isNumber,
    "string": 	_.isString,
	"mailbox":	(v) => {return v && _.isObject(v) && (v._isMailbox || v._isEntity)},
	"udo":		R.T
}

const BasicTypeDefaults = {
	"int": 		0,
	"uint": 	0,
	"tiny": 	0,
	"utiny": 	0,
	"small":	0,
    "usmall":	0,
    "float":	0,
    "string": 	"",
}

const IntegerValues = new Set(["int","uint","tiny","utiny","small","usmall"])

const TypeCheckers = {
	"basic": (value, type) => {
		if (_.isBoolean(value)){
			value = value ? 1 : 0
		}
		return BasicTypeCheckers[type.type](value)
	},
	"enum":(value, type) => {
		return !!type.fields[value]
	},
	"array": (value, type) => {
		let nt = TypeConfig.types[type.type]
		if (!_.isArray(value)) return false
		for (let v of value){
			if (!TypeCheckers[nt.ctype](v, nt)){
				return false
			}
		}
		return true
	},
	"object":(value, type) => {
		for (let field in type.fields){
			if (!value[field]){
				//TODO, is null can be true ?
				//console.warn("filed not set value")
				continue
			}
			let nt = TypeConfig.types[type.fields[field]]			
			if (!TypeCheckers[nt.ctype](value[field], nt)){
				return false
			}
		}
		return true
	},
	"map":(value, type) => {
		let nt = TypeConfig.types[type.valueType]
		if (!_.isObject(value)) return false
		for (let k in value){
			if (!TypeCheckers[nt.ctype](value[k], nt)){
				return false
			}
		}
		return true
	}
}

class Types {
    constructor() {
		this.Enum = {}
		this.types = TypeConfig.types
	}
	
	init(){
        for (let name in TypeConfig.types) {
            let tinfo = TypeConfig.types[name]
            if (tinfo.ctype == "enum") {
                this.Enum[name] = tinfo.fields
            }
        }
	}
	
	getTypeDesc(typeId){
		let t = this.getType(typeId)
		if (_.startsWith(t, "tt")){
			return TypeConfig.types[t]
		}else{
			return t
		}
	}

    getType(typeId) {
        return TypeConfig.id2types[typeId]
    }

    getTypeId(type) {
        return TypeConfig.types[type].id
    }

    getCompositeType(type) {
        return TypeConfig.types[type]
	}
	
	getCompositeTypeById(tid) {
		let type = TypeConfig.id2types[tid]
        return TypeConfig.types[type]
    }

    assertType(typeId, value, canNil) {
        const type = this.getType(typeId)
        if (!type) {
            console.error("Invalid type define ", type)
            return false
		}		
		let typeInfo = this.getCompositeType(type)	
		if (_.isNil(value)){
			if (!canNil){
				console.error("Client Args lost type", this.getTypeDesc(typeId))
				return false
			}			
		}
		return TypeCheckers[typeInfo.ctype](value, typeInfo)
	}
	
	getDefaultValue(typeId){
		let type = this.getCompositeTypeById(typeId)
		switch(type.ctype){
			case 'basic': 
				return BasicTypeDefaults[type.type]

			case 'array':
				return []
			
			case 'object':
				return {}

			case 'map':
				return new Map()

			case 'enum':
				//this is a hack value. maybe we should export a default value in enum type?
				return 1

			default:
				console.error("Invalid Default Value Type -> ", typeId)
				return null
		}
	}

	isIntegerKey(type){
		return IntegerValues.has(type)
	}
}

module.exports = new Types()
