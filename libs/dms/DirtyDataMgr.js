"use strict";

const _ = require("lodash");
const AdapterMgr = require("./AdapterMgr");
const PerformanceTester = require('./PerformanceTester');
const Constants = require('./Constants');

class DirtyDataMgr {
    constructor() {
		this.dirtyDataQueue = [];
		setInterval(this.syncDirtyData.bind(this), Constants.DMS_TICK.DIRTY_SYNC_TICK)
        PerformanceTester.addTester('dirty', ['sync']);
        this.dirtyLock = false
    }

    /**
     * add dirty data
     * @param {*} chgData 
     */
    addDirtyData(chgData){
        this.dirtyDataQueue.push(chgData);
    }

    /**
     * sync dirty data to mysql, to be optimize...
     * alpha version
     */
    async syncDirtyData() {
        if (_.isEmpty(this.dirtyDataQueue)) return 'OK'
        if (this.dirtyLock == true) return 'OK'
        this.dirtyLock = true
        let processCnt = 0;        
        let updateList = {}, deleteList = {};
        let info = this.dirtyDataQueue.shift()
        while(!_.isNil(info)){
            for (let name in info.delete){
                if (!deleteList[name]) {
                    deleteList[name] = info.delete[name];
                }
                delete updateList[name];
            }
            for (let name in info.set){
                if (!updateList[name]) {
                    updateList[name] = info.set[name];
                } else {
                    updateList[name].data = Object.assign(updateList[name].data, info.set[name].data);
                }
            }
            info = this.dirtyDataQueue.shift()
        }
        await AdapterMgr.deleteAndUpdateDataSql(deleteList, updateList);
        this.dirtyLock = false
        return 'OK'
    }
}

module.exports = new DirtyDataMgr();