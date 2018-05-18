"use strict";
const AdapterMgr = require('./AdapterMgr')
const ModelPaser = require('./ModelPaser')
const DirtyDataMgr = require('./DirtyDataMgr')
const FileSystem = require('fs')
const _ = require("lodash")
const Hades = GlobalHades
const Logger = Hades.Logger.getLogger('dms', __filename)

class DataManagerService{

    constructor(){
        this.isShutDown = false
        this.redisQueue = []
        this.redisLock = false
    }

    init(){
        AdapterMgr.init()
        ModelPaser.init()
    }

    shutDownReady(){
        this.isShutDown = true
    }

    async syncDirtyData(){
        return await DirtyDataMgr.syncDirtyData()
    }

    _checkNullInObject(data){
        let str = JSON.stringify(data)
        if (str.indexOf('null') < 0) return false
        return true
    }

    _getEntityID(entityName, condition){
        let strEntityID = _.lowerFirst(entityName) + 'ID'
        return condition[strEntityID]
    }

    _checkCondition(entityName, condition){
        let strEntityID = _.lowerFirst(entityName) + 'ID'
        return _.isNil(condition[strEntityID])
    }
    
    _handleDirtyData(chgData){
        DirtyDataMgr.addDirtyData(chgData)
    }

    async _syncCache(){
        if (this.redisLock == true) return
        this.redisLock = true
        let data = this.redisQueue.shift()
        while(!_.isNil(data)){
            await AdapterMgr.setCacheData(data)
            data = this.redisQueue.shift()
        }
        this.redisLock = false;
    }

    /**
     * update data to redis and mysql. 
     * alpha version.
     * @param {String} entityName 
     * @param {Object} condition
     * @param {Object} data 
     */
    async updateData(entityName, condition, data){
		// Logger.info(`update entityName:${entityName} condition:${JSON.stringify(condition)} data:${JSON.stringify(data)}`)
        if (!entityName || !condition || !data) return 'FAIL'
        if (this._checkNullInObject(data)){
            console.error('DMS - updateData data has null ', entityName, condition)
            console.error(data)
            return 'FAIL'
        }
        if (this._checkCondition(entityName, condition)){
            console.error('DMS - updateData condition invalid ', entityName, condition)
            return 'FAIL'
        }
        let entityID = this._getEntityID(entityName, condition)
        let chgData = ModelPaser.parseUpdateData(entityName, entityID, data)
        this._handleDirtyData(chgData)
        this.redisQueue.push(chgData)
        this._syncCache()
        return 'OK'
    }

    /**
     * delete data from redis and mysql. 
     * alpha version.
     * @param {String} entityName 
     * @param {Object} condition
     * @param {Object} data 
     */
    async deleteData(entityName, condition, data) {
        // Logger.info(`delete entityName:${entityName} condition:${JSON.stringify(condition)} data:${JSON.stringify(data)}`)
        if (!entityName || !condition || !data) return 'FAIL'
        if (this._checkNullInObject(data)){
            console.error('DMS - deleteData data has null ', entityName, condition, data)
            return 'FAIL'
        }
        if (this._checkCondition(entityName, condition)){
            console.error('DMS - deleteData condition invalid ', entityName, condition)
            return 'FAIL'
        }
        let entityID = this._getEntityID(entityName, condition)
        let chgData = ModelPaser.parseDeleteData(entityName, entityID, data);
        let copyData = JSON.parse(JSON.stringify(chgData))
        this._handleDirtyData(copyData)

        this.redisQueue.push(copyData)
        await this._syncCache()
        return 'OK'
    }

    /**
     * load data from dms.
     * first load redis data, if not exists to read mysql and sync data to redis. 
     * alpha version.
     * @param {String} entityName 
     * @param {Object} condition
     * @param {Object} data 
     */
    async loadData(entityName, condition, data) {
        // Logger.info(`load entityName:${entityName} condition:${JSON.stringify(condition)} data:${JSON.stringify(data)}`)
        if (!entityName || !condition || !data) return 'FAIL'
        if (this._checkNullInObject(data)){
            console.error('DMS - loadData data has null ', entityName, condition, data)
            return 'FAIL'
        }
        if (this._checkCondition(entityName, condition)){
            console.error('DMS - loadData condition invalid ', entityName, condition)
            return 'FAIL'
        }
        let entityID = this._getEntityID(entityName, condition)

        let loadResult = {
            [entityName]:{}
        };

        try {
            let ldData = ModelPaser.parseLoadData(entityName, entityID, data);
            let copyData = JSON.parse(JSON.stringify(ldData))

            for (let n in copyData) {
                let resultData = [];

                // load redis
                let redisResult = await AdapterMgr.loadDataRedis(n);
                if (!_.isEmpty(redisResult)) {
                    for (let m of redisResult) {
                        resultData.push(m[1]);
                    }
                } else {
                    resultData = await AdapterMgr.loadDataSql(copyData[n].tableName, copyData[n].where);
                    if (!_.isEmpty(resultData)) {
                        // set data to redis
                        let redisData = ModelPaser.convertSqlDataToRedisData(copyData[n].tableName, entityName, entityID, resultData);
                        if (!_.isEmpty(redisData)) {
                            AdapterMgr.setCacheData(redisData)
                        }
                    }
                }

                if (!_.isEmpty(resultData)) {
                    loadResult[entityName] = condition
                    loadResult = ModelPaser.parseLoadDataResult(entityName, entityID, copyData[n].tableName, resultData, loadResult);
                }
            }
        } catch (err) {
            Logger.error('DMS - loadData() catch error!!!! FIX IT!!! ', err);
            return 'FAIL';
        }
        
        //!!!! log temp
        // FileSystem.writeFileSync("./LoadResult_Do_Not_Commit.json", JSON.stringify(loadResult[entityName]));
        // Logger.debug("DataManagerService - loadData() result", JSON.stringify(loadResult[entityName]));

        return loadResult[entityName];
    }

    /**
     * 
     * @param {*} query 
     * @returns array
     * select: return array of rawdata [{"playerID":10003,"nick":"aaaa"},{"playerID":10004,"nick":"aaaa"},{"playerID":10005,"nick":"aaaa"}]
     * update, delete: return affected rows count ex: deleted 3 rows then return [3]
     */
    async rawQuery(query){
        return await AdapterMgr.rawQeury(query)
    }
}

module.exports = new DataManagerService();
