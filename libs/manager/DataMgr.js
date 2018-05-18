"use strict"

const _ = require("lodash")
const DataManagerService = require("../dms/DataManagerService")
const Hades = GlobalHades

class DataMgr {
    constructor(){
    }

    init(){
		DataManagerService.init()
		Hades.Event.on(Hades.Event.ON_UPDATE_PROPERTY, this.setEntityData)
    }

    async getEntityData(entityName, cond, data){
        return await DataManagerService.loadData(entityName, cond, data)
    }

    async setEntityData(entityName, cond, data){
		console.log("DMS setEntityData -> ", entityName, cond, data)
        //return await DataManagerService.updateData(entityName, cond, data)
    }

    async delEntityData(entityName, cond, data){
        return await DataManagerService.deleteData(entityName, cond, data)
    }

    async excuteRawQuery(query){
        return await DataManagerService.rawQuery()
    }

    async doBeforeShutDown(){
        await DataManagerService.syncDirtyData()
        console.log('ResourceMgr - shut down dirty sync')
    }

    shutDownReady(){
        DataManagerService.shutDownReady()
	}

}

module.exports = new DataMgr()