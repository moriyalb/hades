"use strict"
const _ = require("lodash")
const Hades = GlobalHades
const Parser = require('./ModelPaser')
const Dirty = require('./DirtyMgr')
const AdapterMgr = require('./AdapterMgr')

class Dms {
    constructor(){
    }

    init(){
        AdapterMgr.init()
        Parser.init()
        console.log('dms all module init.')
    }

    update(entity, path, value){
        // console.log('dms update ->', entity._ename, entity._eid, path.valuePath, value)
        let data = Parser.toUpdate(entity, path, value)
        if (!data){
            console.error('dms update parse error ->', entity._ename, path, value)
            return
        }
        Dirty.addDirty(data)
        AdapterMgr.updateCache(data)
    }

    delete(entity, path){
        console.log('dms delete ->', entity._ename, entity._eid, path.valuePath)
        let datas = Parser.toDelete(entity, path)
        if (!datas){
            console.error('dms delete parse error ->', entity._ename, path)
            return
        }
        for (let data of datas){
            Dirty.addDirty(data)
            AdapterMgr.deleteCache(data)
        }
     }

    async load(ename, cond, data){
        console.log('dms load ->', ename, cond, data)
    }

    async execQuery(query){
        console.log('dms execQuery ->', query)
    }

    async syncDirty(){
        console.log('dms syncDirty ->')
    }
}

module.exports = new Dms()