"use strict"

const _ = require("lodash")
const produce = require("immer").default
const fs = require("fs")
const path = require("path")
const Hades = GlobalHades

const DatumWrapper = {
	get(target, key, rev){
		//console.log("What ? ", key, typeof target[key])
		if (key == "__datums" || typeof target[key] === "function"){
			return Reflect.get(target, key, rev)
		}else{
			return target.__datums[key]
		}
	}
}

class HadesDatum {
	constructor(){
		this.__datums = {}
	}
	
	/**
	 * Register a data module. a generator method is needed to get the data value.
	 * @example:
	 * 		Hades.Datum.registerData((datum)=>{
	 * 			datum.DDHero = {
	 * 				heros: [1,2,3]
	 * 			}
	 * 		})
	 * 		
	 * 		//to use
	 * 		for (let hero of Hades.Datum.DDHero.heros) ...
	 * @param {*} generator 
	 */
	registerData(generator){
		this.__datums = produce(this.__datums, generator)
	}

	/**
	 * clear all data modules
	 */
	clear(){
		this.__datums = {}
	}
}

module.exports = new Proxy(new HadesDatum(), DatumWrapper)