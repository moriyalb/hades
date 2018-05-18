"use strict";

const _ = require("lodash");
const util = require("util");
const Knex = require('knex');
const HadesConfig = require("../../core/HadesConfig")
const Hades = GlobalHades
const Logger = Hades.Logger.getLogger('dms', __filename);

process.on('unhandledRejection', (reason, p) => {
});

class KnexJs {
    constructor() {
        this.mysqlConnection = null;
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
        this.mysqlConnection = new Knex(config);
    }

    async insert(tableName, object) {
        return await this.mysqlConnection(tableName).insert(object);
        // reutrn primary id
    }

    async insertInto(tableName, object) {
        return await this.mysqlConnection.insert(object).into(tableName);
        // count
    }

    async select(tableName, whereObject) {
        return await this.mysqlConnection(tableName).where(whereObject);
        // return select datas
    }

    async select(tableName, whereKey, whereValue) {
        return await this.mysqlConnection(tableName).where(whereKey, whereValue);
        // return select datas
    }

    async update(tableName, whereKey, whereValue, setKey, setValue) {
        return await this.mysqlConnection(tableName).where(whereKey, whereValue).update(setKey, setValue);
        // return 1, 0
    }

    async update(tableName, whereKey, whereValue, setObject) {
        return await this.mysqlConnection(tableName).where(whereKey, whereValue).update(object);
        // return 1, 0
    }

    async update(tableName, whereObject, setObject) {
        return await this.mysqlConnection(tableName).where(whereObject).update(setObject);
        // return 1, 0
    }

    async delete(tableName, whereObject) {
        return await this.mysqlConnection(tableName).where(whereObject).delete();
        // return 1, 0
    }

    async raw(query){
        let result = await this.mysqlConnection.raw(query)
        if (!_.isNil(result[0].affectedRows)){
            let res = []
            res.push(result[0].affectedRows)
            return res
        } else if (!_.isNil(result[0])){
            return JSON.stringify(result[0])
        }
        return []
    }

    async selectColumn(tableName, columnName, whereObject) {
        return await this.mysqlConnection(tableName).where(whereObject).select(columnName);
    }

    async runUpdateQueryUseTran(tableName, data, where, tran) {
        return await this.mysqlConnection(tableName).update(data).where(where).transacting(tran);
    }

    async runCreateQueryUseTran(tableName, data, tran) {
        return await this.mysqlConnection(tableName).insert(data).transacting(tran);
    }

    async runDeleteQueryUseTran(tableName, where, tran) {
        return await this.mysqlConnection(tableName).where(where).delete().transacting(tran);
    }

    async runRawQueryUseTran(query, tran) {
        let result = await this.mysqlConnection.raw(query).transacting(tran);
        return result;
    }

    async runRawQuery(query){
        return await this.mysqlConnection.raw(query)
    }

    createTransaction() {
        return new Promise((resolve) => {
            return this.mysqlConnection.transaction(resolve);
        });
    }

    optimizeDeleteQueries(deleteQueries) {
        let keys = _.keys(deleteQueries);
        let optimizeData = {};
        for (let info of keys) {
            let strs = info.split(':');
            let tableName = strs.shift();
            let whereInValue = strs.pop();
            let whereInColume = strs.pop();
            let where = strs.toString();
            if (_.isEmpty(optimizeData[tableName])) {
                optimizeData[tableName] = {};
            }
            if (_.isEmpty(optimizeData[tableName][where])) {
                let whereObject = {};
                for (let i = 0; i <= strs.length - 1; i++) {
                    whereObject[strs[i]] = strs[++i];
                }
                optimizeData[tableName][where] = {
                    where: whereObject,
                    whereInColume: whereInColume,
                    whereInValue: []
                };
            }
            optimizeData[tableName][where].whereInValue.push(parseInt(whereInValue));
        }

        let retQueries = [];
        
        for (let n in optimizeData) {

            let conditions = [];
            
            let values = _.values(optimizeData[n]);

            for (let info of values) {

                let condition = this.mysqlConnection.where(info.where).whereIn(info.whereInColume, info.whereInValue).toString().replace('select * where ', '');

                conditions.push(condition);
            }

            let query = this.mysqlConnection(n).del().toString() + ' where';

            let i = 0;
            
            for (let con of conditions) {
                if (i > 0) {
                    query += ' or'
                }
                
                query = query + ' (' + con + ')';
                
                i++;
            }

            retQueries.push(query);
        }

        return retQueries;
    }

    optimizeUpdateQueries(updateQueries) {
        let upsertQueries = {
        };
        
        for (let m in updateQueries) {
            for (let xx in updateQueries[m].data) {
                updateQueries[m].where[xx] = updateQueries[m].data[xx];
            }

            if (_.isEmpty(upsertQueries[updateQueries[m].tableName])) {
                upsertQueries[updateQueries[m].tableName] = {
                    dataSet: [],
                    columnSet: {}
                };
            }

            upsertQueries[updateQueries[m].tableName].dataSet.push(updateQueries[m].where);
            upsertQueries[updateQueries[m].tableName].columnSet = Object.assign(upsertQueries[updateQueries[m].tableName].columnSet, updateQueries[m].where);
        }

        let retQueries = [];
        
        for (let mm in upsertQueries) {
            let duplicate = ' ON DUPLICATE KEY UPDATE '+ Object.getOwnPropertyNames(upsertQueries[mm].columnSet).map((field) => `\`${field}\` = IFNULL(VALUES(\`${field}\`), \`${field}\`)`).join(", ");
            
            let query = this.mysqlConnection
                            .insert(upsertQueries[mm].dataSet)
                            .into(mm)
                            .toString() + duplicate;
            
            retQueries.push(query);
        }

        return retQueries;
    }

    async deleteDataUseTransaction(deleteQueries) {

        if (_.isEmpty(deleteQueries)) {
            return 'FAIL';
        }
        
        const tran = await this.createTransaction();

        let optDeleteQuery = this.optimizeDeleteQueries(deleteQueries);

        try {
            for (let m of optDeleteQuery) {
                await this.runRawQueryUseTran(m, tran);
            }
        } catch (err) {
            Logger.error('knex - queries excutes error, rollback data.', err);
            tran.rollback();
            return 'FAIL';
        }
    
        tran.commit();
        return 'OK';
    }

    async updateDataUseTransaction(updateQueries) {

        if (_.isEmpty(updateQueries)) {
            return 'FAIL';
        }

        let optUpdateQuery = this.optimizeUpdateQueries(updateQueries);

        const tran = await this.createTransaction();

        try {
            for (let m of optUpdateQuery) {
                await this.runRawQueryUseTran(m, tran);
            }
        } catch (err) {
            Logger.error('knex - queries excutes error, rollback data.', err);
            tran.rollback();
            return 'FAIL';
        }
    
        tran.commit();
        return 'OK';
    }

    async deleteAndUpdateData(deleteQueries, updateQueries) {
        let optUpdateQuery = [], optDeleteQuery = [];
        let query = ""
        if (!_.isEmpty(updateQueries)) {
            optUpdateQuery = this.optimizeUpdateQueries(updateQueries);
        }
        if (!_.isEmpty(deleteQueries)) {
            optDeleteQuery = this.optimizeDeleteQueries(deleteQueries);
        }
        try {
            for (query of optDeleteQuery) {
                await this.runRawQuery(query)
            }
            for (query of optUpdateQuery) {
                await this.runRawQuery(query)
            }
        } catch (err) {
            Logger.error('knex - queries excutes error', err, query);
            return 'FAIL';
        }
        return 'OK';
    }
}

module.exports = new KnexJs();