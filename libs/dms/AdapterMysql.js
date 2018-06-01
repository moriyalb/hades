"use strict"
const _ = require("lodash")
const Knex = require('knex');

const Hades = GlobalHades
const HadesConfig = Hades.Config

class AdapterMysql {
    constructor(){
        this.mysql = null
    }

    init(){
        let config = {
            client: 'mysql',
            connection: HadesConfig.mysqlCfg().logic[HadesConfig.getEnv()],
            pool: {
                min: 0, 
                max: 100,
            },
            useNullAsDefault: true
        }
        this.mysql = new Knex(config)
        console.log('dms AdapterMysql init.')
    }

    async update(table, datas){
        let query = this._toInsertQuery(table, datas)
        // console.log('dms AdapterMysql update query ->', query)
        if (!query) return
        this.execRaw(query)
    }

    async delete(table, datas){
        let query = this._toDeleteQuery(table, datas)
        // console.log('dms AdapterMysql delete query ->', query)
        if (!query) return
        this.execRaw(query)
    }

    _toInsertQuery(table, datas){
        let _datas = this._toDatas(datas)
        if (_datas.length == 0) return null
        let qr = this.mysql.insert(_datas).into(table).toString()
        let dup = this._toDuplicate(_datas)
        return `${qr} ${dup}`
    }

    _toDeleteQuery(table, datas){
        let _datas = this._toDatas(datas)
        if (_datas.length == 0) return null
        let qr = this.mysql(table).del().toString()
        let where = this._toWhere(_datas)
        return `${qr} WHERE${where}`
    }

    _toDatas(datas){
        let tmp = []
        for (let v of Object.values(datas)){
            tmp.push(v._data)
        }
        return tmp
    }

    _toWhere(datas){
        let temp = ''
        for (let v of datas){
            if (!!temp) temp = `${temp} OR `
            temp = `${temp} (${this.mysql.where(v).toString().replace('select * where ', '')})`
        }
        return temp
    }

    _toDuplicate(datas){
        let temp = {}
        for (let v of datas){
            Object.assign(temp, v)
        }
        return `ON DUPLICATE KEY UPDATE ${
            Object.getOwnPropertyNames(temp).map((f)=> `\`${f}\` = IFNULL(VALUES(\`${f}\`), \`${f}\`)`).join(', ')
        }`
    }

    async execRaw(query){
        console.log('mysql exec ->', query)
        return await this.mysql.raw(query)
    }
}

module.exports = new AdapterMysql()