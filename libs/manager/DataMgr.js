"use strict"

const _ = require("lodash")
const Dms = require("../dms/Dms")
const Hades = GlobalHades

class DataMgr {
    constructor(){
    }

    init(){
		Dms.init()
		Hades.Event.on(Hades.Event.ON_UPDATE_PROPERTY, this.setEntityData)
		Hades.Event.on(Hades.Event.ON_DELETE_PROPERTY, this.delEntityData)
		Hades.Event.on(Hades.Event.ON_SAVE_PROPERTY, this.saveEntityData)		
    }

    async getEntityData(entityName, cond, data){
        // return await Dms.load(entityName, cond, data)
    }

    setEntityData(entity, path, value){
		if (!entity._inited) return
		if (Hades.isSimpleEntity(entity)){

		}else{

        }
        return Dms.update(entity, path, value)
    }

    delEntityData(entity, path){
        if (!entity._inited) return
		if (Hades.isSimpleEntity(entity)){

		}else{
			
		}
		return Dms.delete(entity, path)
    }
    
    async saveEntityData(eid){
		
	}

    async executeQuery(query){
        // return await Dms.execQuery(query)
    }

    async doBeforeShutDown(){
        // await Dms.syncDirty()
    }
}

module.exports = new DataMgr()