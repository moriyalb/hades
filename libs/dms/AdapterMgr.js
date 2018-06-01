"use strict"
const _ = require("lodash")
const Hades = GlobalHades

const AdapterMysql = require('./AdapterMysql')
const AdapterRedis = require('./AdapterRedis')

class AdapterMgr{
    constructor(){
        this.adapterCfg = {
            cache: 'redis',
            db: 'mysql'
        }

        this.handleAdapter = {
            'redis': AdapterRedis,
            'mysql': AdapterMysql
        }
    }

    init(){
        AdapterMysql.init()
        AdapterRedis.init()
    }

    async updateDB(table, datas){
        await this.handleAdapter[this.adapterCfg.db].update(table, datas)
    }

    async deleteDB(table, datas){
        await this.handleAdapter[this.adapterCfg.db].delete(table, datas)
    }

    updateCache(data){
        this.handleAdapter[this.adapterCfg.cache].update(data)
    }

    deleteCache(data){
        this.handleAdapter[this.adapterCfg.cache].delete(data)
    }
}

module.exports = new AdapterMgr()