"use strict";

const _ = require("lodash");
const MySqlAdapter = require('./knexjs/knex');
const RedisAdapter = require('./redis/ioredis');

class AdapterMgr {
    constructor() {
    }

    init(){
        MySqlAdapter.init()
        RedisAdapter.init()
    }

    /**
     * 
     * @param {*} loadKey 
     */
    async loadDataRedis(loadKey) {
        return await RedisAdapter.executeGetHashDatas(loadKey);
    }

    async setCacheData(chgData){
        return await RedisAdapter.executeDelAndSetDatas(chgData.delete, chgData.set);
    }

    /**
     * 
     * @param {*} deleteQuery 
     */
    async deleteDataRedis(deleteQuery) {
        return await RedisAdapter.executeDelHashDatas(deleteQuery);
    }

    /**
     * load data from mysql.
     * @param {*} tableName 
     * @param {*} where 
     */
    async loadDataSql(tableName, where) {
        return await MySqlAdapter.select(tableName, where);
    }

    /**
     * insert data to mysql. if exists to update.
     * @param {*} deleteQuery 
     * @param {*} updateQuery 
     * 
     * @returns {String} FAIL, OK
     */
    async deleteAndUpdateDataSql(deleteQuery, updateQuery) {
        return await MySqlAdapter.deleteAndUpdateData(deleteQuery, updateQuery);
    }

    /**
     * 
     * @param {*} updateQuery 
     * 
     * @returns {String} FAIL, OK
     */
    async updateDataSql(updateQuery) {
        return await MySqlAdapter.updateDataUseTransaction(updateQuery);
    }

    /**
     * delete data from mysql.
     * @param {*} deleteQuery 
     * 
     * @returns {String} FAIL, OK
     */
    async deleteDataSql(deleteQuery) {
        return await MySqlAdapter.deleteDataUseTransaction(deleteQuery);
    }

    /**
     * find entity id from base table in MySQL.
     * @param {*} tableName 
     * @param {*} columnName 
     * @param {*} whereObject 
     */
    async findEntityIDSql(tableName, columnName, whereObject) {
        return await MySqlAdapter.selectColumn(tableName, columnName, whereObject);
    }

    async rawQeury(query){
        return await MySqlAdapter.raw(query)
    }
}

module.exports = new AdapterMgr();
