"use strict";

const _ = require("lodash");
const Hades = GlobalHades
const Logger = Hades.Logger.getLogger('dms', __filename);
const Constants = require('./Constants');
const HadesConfig = require('../core/HadesConfig')

class PerformanceTester {
    constructor() {
        this.Testers = new Map();

        this.testerTemplet = {
            startTime: 0,
            endTime: 0,
            excuteCount: 0,
            totalRunTimes: 0,
            avgRunTimes: 0,
            maxRunTimes: 0,
            minRunTimes: 0,
            lastRunTime: 0,
            lastPrintTime: 0,

            curExcuteCount: 0,
            curTotalRunTimes: 0,
            curAvgRunTimes: 0,
            curMaxRunTimes: 0,

            overTimes: 0
        }

		setInterval(this._printPerformance.bind(this), Constants.DMS_TICK.PERFORMANCE_LOG_PRINT_TICK)
    }

    _printPerformance() {

        for (let [key, value] of this.Testers) {

            for (let name in value) {

                if (value[name].excuteCount == 0) {
                    continue;
                }

                if (value[name].curExcuteCount > 0) {
                    value[name].curAvgRunTimes = value[name].curTotalRunTimes / value[name].curExcuteCount;
                }
                Logger.info(`
                ----- Performance -----
                server id: ${HadesConfig.getServerId()} group: ${key}   task: ${name}
                -------- total --------
                count: ${value[name].excuteCount}, avg: ${value[name].avgRunTimes.toFixed(1)} ms, max: ${value[name].maxRunTimes.toFixed(1)} ms, min: ${value[name].minRunTimes.toFixed(1)} ms, last: ${value[name].lastRunTime.toFixed(1)} ms
                overtimes: ${value[name].overTimes}
                ---- current tick -----
                count: ${value[name].curExcuteCount}, avg: ${value[name].curAvgRunTimes.toFixed(1)} ms, max: ${value[name].curMaxRunTimes.toFixed(1)} ms
                --------- end ---------
                `)
                
                value[name].lastPrintTime = Date.now();
                value[name].curExcuteCount = 0;
                value[name].curTotalRunTimes = 0;
                value[name].curAvgRunTimes = 0;
                value[name].curMaxRunTimes = 0;
            }
        }
    }

    addTester(id, works) {
        if (this.Testers.has(id)) {
            return 'FAIL';
        }

        if (!Array.isArray(works)) {
            return 'FAIL';
        }

        let tester = {
        };
        
        for (let lInfo of works) {
            tester[lInfo] = _.cloneDeep(this.testerTemplet);
        }

        this.Testers.set(id, tester);
    }

    addRunTime(id, work, oldTime){
        if (!this.Testers.has(id)) return 'FAIL'
        if (!this.Testers.get(id)[work]) return 'FAIL'
        let runTime = Date.now() - oldTime
        this.Testers.get(id)[work].excuteCount++;
        this.Testers.get(id)[work].lastRunTime = runTime;
        this.Testers.get(id)[work].totalRunTimes += runTime;
        this.Testers.get(id)[work].avgRunTimes = this.Testers.get(id)[work].totalRunTimes / this.Testers.get(id)[work].excuteCount;
        if (runTime > 100){
            this.Testers.get(id)[work].overTimes++;  
        }

        this.Testers.get(id)[work].curExcuteCount++;
        this.Testers.get(id)[work].curTotalRunTimes += runTime;
        if (runTime > this.Testers.get(id)[work].maxRunTimes) {
            this.Testers.get(id)[work].maxRunTimes = runTime;
        }
        if (runTime > this.Testers.get(id)[work].curMaxRunTimes) {
            this.Testers.get(id)[work].curMaxRunTimes = runTime;
        }
        if (this.Testers.get(id)[work].minRunTimes == 0 || runTime < this.Testers.get(id)[work].minRunTimes) {
            this.Testers.get(id)[work].minRunTimes = runTime;
        }
        return 'OK';
    }

    startTest(id, work) {
        if (!this.Testers.has(id)) {
            return 'FAIL';
        }

        if (!this.Testers.get(id)[work]) {
            return 'FAIL';
        }

        this.Testers.get(id)[work].startTime = Date.now();

        return 'OK';
    }

    endTest(id, work, processDataCount = 0) {
        if (!this.Testers.has(id)) {
            return 'FAIL';
        }

        if (!this.Testers.get(id)[work]) {
            return 'FAIL';
        }

        let endTime = Date.now();
        let runTime = endTime - this.Testers.get(id)[work].startTime;

        if (processDataCount != 0) {
            this.Testers.get(id)[work].excuteCount += processDataCount;    
        } else {
            this.Testers.get(id)[work].excuteCount++;
        }
        
        this.Testers.get(id)[work].lastRunTime = runTime;
        this.Testers.get(id)[work].totalRunTimes += runTime;
        this.Testers.get(id)[work].avgRunTimes = this.Testers.get(id)[work].totalRunTimes / this.Testers.get(id)[work].excuteCount;

        if (runTime > 1000){
            this.Testers.get(id)[work].overTimes++;
        }

        if (processDataCount != 0) {
            this.Testers.get(id)[work].curExcuteCount += processDataCount;    
        } else {
            this.Testers.get(id)[work].curExcuteCount++;
        }
        
        this.Testers.get(id)[work].curTotalRunTimes += runTime;
        
        if (runTime > this.Testers.get(id)[work].maxRunTimes) {
            this.Testers.get(id)[work].maxRunTimes = runTime;
        }

        if (runTime > this.Testers.get(id)[work].curMaxRunTimes) {
            this.Testers.get(id)[work].curMaxRunTimes = runTime;
        }

        if (this.Testers.get(id)[work].minRunTimes == 0 || runTime < this.Testers.get(id)[work].minRunTimes) {
            this.Testers.get(id)[work].minRunTimes = runTime;
        }

        return 'OK';
    }

    getTestInfo(id, work) {
        if (!this.Testers.has(id)) {
            return null;
        }

        if (!this.Testers.get(id)[work]) {
            return null;
        }

        return this.Testers.get(id)[work]
    }
}

module.exports = new PerformanceTester();