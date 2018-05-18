"use strict"

const _ = require("lodash")

class HookMgr {
    constructor(){
		this.hooks = new Map
    }

    init(){
		
	}
	
	hook(ht, handler){
		this.hooks.set(ht, handler)
	}

	hookCall(ht, ...args){
		if (this.hooks.has(ht)){
			this.hooks.get(ht).apply(null, args)
		}
	}

}

module.exports = new HookMgr()