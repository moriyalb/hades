"use strict"

const _ = require("lodash")
const EventEmitter = require("events")

class HadesEvent extends EventEmitter {
	constructor(){
		super()
		this.ON_DISCONNECT = Symbol()
		this.ON_UPDATE_PROPERTY = Symbol()
		this.ON_DELETE_PROPERTY = Symbol()
	}
}

module.exports = new HadesEvent()