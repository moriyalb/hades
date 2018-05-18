"use strict";

const _ = require("lodash");
const RedisMgr = require("../../manager/RedisMgr")
const Hades = GlobalHades
const Logger = Hades.Logger.getLogger('dms', __filename);

const IoRedis = require('ioredis');
const Constants = require('../Constants');

class ioRedis {
    constructor() {		
        this.redisConnection = null;
    }

    init(){
        this.redisConnection = RedisMgr.clientProjectCache()
    }

    _isResultSuccess(result) {
        for (let data of result) {
            if (data[0] != null) {
                return false;
            }
        }
        return true;
    }

    _parseKeySet(key) {
        let spKey = key.split(':');
        if (_.isEmpty(spKey) || spKey.length < 3) {
            Logger.error('ioredis - _parseKeySet() key set error! check!!!', key);
            return null;
        }
        return `${spKey[0]}:${spKey[1]}:${spKey[2]}:keyset`
    }

    async delData(delDatas){
        if (_.isEmpty(delDatas)) return
        let sets = {}
        for (let name in delDatas){
            let keySet = this._parseKeySet(name)
            if (!sets[keySet]){
                sets[keySet] = []
            }
            sets[keySet].push(name)
        }
        let pipeLine = this.redisConnection.pipeline()
        for (let st in sets){
            let delKeys = []
            let keys = await this.redisConnection.smembers(st)
            for (let ke of keys){
                for (let v of sets[st]){
                    if (ke.indexOf(v) >= 0){
                        delKeys.push(ke)
                        pipeLine.del(ke)
                    }
                }
            }
            if (delKeys.length > 0) {
                pipeLine.srem(st, delKeys);
            }
        }
        let ret = await pipeLine.exec()
    }

    async setData(setDatas){
        if (_.isEmpty(setDatas)) return
        let pipeLine = this.redisConnection.pipeline();
        let setKeys = {};
        for (let name in setDatas) {
            let keySet = this._parseKeySet(name);
            if (_.isEmpty(setKeys[keySet])) {
                setKeys[keySet] = [];
            }
            pipeLine.hmset(name, setDatas[name].data)
            if (!_.isEmpty(setDatas[name].where)){
                pipeLine.hmset(name, setDatas[name].where)
            }
            setKeys[keySet].push(name);
        }
        for (let name in setKeys) {
            pipeLine.sadd(name, setKeys[name]);
        }
        await pipeLine.exec()
    }

    async executeDelAndSetDatas(delDatas, setDatas) {
        if (!_.isEmpty(delDatas)){
            await this.delData(delDatas)
        }
        if (!_.isEmpty(setDatas)){
            await this.setData(setDatas)
        }
        return 'OK'
    }

    async expireData(setKeys, times){
        let pipeLine = this.redisConnection.pipeline();
        for (let kn in setKeys){
            let keys = await this.redisConnection.smembers(kn);
            if (keys.length == 0) return
            for (let k of keys) {
                pipeLine.expire(k, times)
            }
            pipeLine.expire(kn, times)
        }
        pipeLine.exec()
    }

    async executeGetHashDatas(key) {
        if (_.isEmpty(key)) {
            return 'FAIL';
        }
        let getTimes = 0;
        let keySet = this._parseKeySet(key);
        let keys = await this.redisConnection.smembers(keySet);
        if (_.isEmpty(keys)) {
            return {};
        }

        let pipeLine = this.redisConnection.pipeline();

        for (let name of keys) {
            if (name.indexOf(key) >= 0) {
                pipeLine.hgetall(name);
                getTimes++;
            }
        }

        let result = await pipeLine.exec();
        return result;
    }
}

module.exports = new ioRedis();