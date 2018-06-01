"use strict"
const _ = require("lodash")
const Hades = GlobalHades

const Redis = require('ioredis')

class AdapterRedis {
    constructor(){
        this.redis = null
        this.redisPipe = null
        this.redisKeys = new Map()
        this.queue = []
        this.lock = false
        this.handleQueueData = {
            'update': this._update,
            'delete': this._delete
        }
    }

    init(){
        this.redis = Hades.RedisMgr.clientProjectCache()
        this.redisPipe = this.redis.pipeline()
        console.log('dms AdapterRedis init.')
    }

    update(data){
        // console.log('redis update ->', data._key)
        this._enqueue(data)
        this._exec()
    }

    delete(data){
        // console.log('redis delete ->', data._key)
        this._enqueue(data)
        this._exec()
    }

    async _exec(){
        if (this.lock) return
        this.lock = true
        let data = this._dequeue()
        while(!!data){
            switch(data._method){
                case 'update':
                this._saveKey(data)
                await this.redisPipe.hmset(data._key, data._data).exec()
                console.log('redis exec ->', data._method, data._key, data._data)
                break

                case 'delete':
                let subKeys = this._removeSubKeys(data)
                for (let key of subKeys){
                    await this.redisPipe.del(key)
                    console.log('redis exec ->', data._method, key)
                }
                await this.redisPipe.exec()
                break
            }
            
            data = this._dequeue()
        }
        this.lock = false
    }

    _enqueue(data){
        // console.log('dms redis enqueue ->', data._method, data._key, data._data)
        this.queue.push(data)
    }

    _dequeue(){
        let data = this.queue.shift()
        if (data){
            // console.log('dms redis dequeue ->', data._method, data._key)
        }
        return data
    }

    _saveKey(data){
        if (!this.redisKeys.has(data._eid)){
            this.redisKeys.set(data._eid, {})
        }
        let info = this.redisKeys.get(data._eid)
        if (!info[data._table]){
            info[data._table] = []
        }
        if (_.indexOf(info[data._table], data._key) == -1){
            info[data._table].push(data._key)
        }
    }

    _removeSubKeys(data){
        let keys = []
        if (!this.redisKeys.has(data._eid)) return []
        let info = this.redisKeys.get(data._eid)
        if (!info[data._table]) return []
        let _keys = info[data._table]
        let matchKeys = _.remove(_keys, (n) => {
            return n.indexOf(data._key) >= 0
        })
        return matchKeys
    }
}

module.exports = new AdapterRedis()