"use strict"

/**
 * Loader Module
 */

const fs = require('fs')
const path = require('path')

const isFile = function(path) {
	return fs.statSync(path).isFile()
}

const isDir = function(path) {
	return fs.statSync(path).isDirectory()
}

class HadesLoader {
	constructor(){

	}

	load(mpath, app){
		if (!fs.existsSync(mpath)){
			console.trace("Fail to load dir ->", mpath)
			return
		}

		let files = fs.readdirSync(mpath)
		if(files.length === 0) {
			console.warn('path is empty, path:', mpath)
			return
		}

		if(mpath.charAt(mpath.length - 1) !== '/') {
			mpath += '/'
		}

		let res = {}
		for(let f of files){
			let fp = mpath + "/" + f
			if(!isFile(fp)) continue
			if(!f.endsWith(".js")) continue
			let m = this.loadFile(fp, app)
			if (!m) continue
			let fname = path.basename(f, ".js")
			res[fname] = m
		}

		return res		
	}

	loadFile(f, app){
		let m = this.reload(f)
		if(typeof m === 'function') {
			m = m(app)
		}
		return m
	}	

	/**
	 * safe require method
	 * @param {*} path 
	 */
	reload(p, root){
		try{
			if (!!root){
				p = path.resolve(root, p)
			}else{
				p = require.resolve(p)
			}
			delete require.cache[p]
			return require(p)
		}catch(err){
			console.error("Hades.LoaderUtil reload error -> ", err)
			return null
		}
	}
}

module.exports = new HadesLoader()