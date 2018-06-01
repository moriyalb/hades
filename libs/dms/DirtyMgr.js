"use strict"
const _ = require("lodash")
const Hades = GlobalHades
const SyncDirtyTick = 2000

const AdapterMgr = require('./AdapterMgr')

class DirtyManager {
    constructor(){
        this.handleAddDirty = {
            'update': this._addUpdate,
            'delete': this._addDelete
        }
        this.lock = false
        this.dirtyUpdate = new Map()
        this.dirtyDelete = new Map()
        setInterval(async ()=> {
            await this.syncDirty()
        }, SyncDirtyTick)
    }

    addDirty(info){
        if (!info) return
        this.handleAddDirty[info._method].call(this, info)
    }

    _addUpdate(info){
        if (!!this.dirtyDelete.has(info._table)){
            let temp = this.dirtyDelete.get(info._table)
            for (let v in temp){
                if (temp[v]._key === info._key){
                    delete temp[v]
                }
            }
        }
        if (!this.dirtyUpdate.has(info._table)){
            this.dirtyUpdate.set(info._table, {})
        }
        let value = this.dirtyUpdate.get(info._table)
        if (!value[info._key]){
            value[info._key] = info
        }
        Object.assign(value[info._key]._data, info._data)
    }

    _addDelete(info){
        if (!!this.dirtyUpdate.has(info._table)){
            let temp = this.dirtyUpdate.get(info._table)
            for (let v in temp){
                if (temp[v]._key.indexOf(info._key) >= 0){
                    delete temp[v]
                } 
            }
        }
        if (!this.dirtyDelete.has(info._table)){
            this.dirtyDelete.set(info._table, {})
        }
        let value = this.dirtyDelete.get(info._table)
        if (!!value[info._key]) return
        value[info._key] = info
    }

    async syncDirty(){
        if (this.lock) return
        this.lock = true
        await this._syncDirtyDelete()
        await this._syncDirtyUpdate()
        this.lock = false
    }

    async _syncDirtyDelete(){
        for (let [k, v] of this.dirtyDelete){
            if (!_.isEmpty(v)){
                await AdapterMgr.deleteDB(k, v)
            }
        }
        this.dirtyDelete.clear()
    }

    async _syncDirtyUpdate(){
        for (let [k, v] of this.dirtyUpdate){
            if (!_.isEmpty(v)){
                await AdapterMgr.updateDB(k, v)
            }
        }
        this.dirtyUpdate.clear()
    }
}

module.exports = new DirtyManager()