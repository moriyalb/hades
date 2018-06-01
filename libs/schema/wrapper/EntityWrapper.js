"use strict"

const Hades = GlobalHades

module.exports = {
	get(target, key, receiver) {
		let m = Hades.Schema.getMetaMethod(target._ename)
		let p = target._properties
		//console.log("EntityWrapper get ", key, Reflect.has(m, key), Reflect.has(p, key))
        if (Reflect.has(m, key)){
			return m[key].bind(target._self)
		}else if (Reflect.has(p, key)){
			return p[key]
		}else{
			return Reflect.get(target, key, receiver)
		}     
    },

    set(target, key, value, receiver) {
		let m = Hades.Schema.getMetaMethod(target._ename)
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