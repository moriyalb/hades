"use strict";

const _ = require("lodash");

const Hades = GlobalHades
const Schema = Hades.Schema
const Types = Hades.Schema.Types
const HadesConfig = Hades.Config
const Models = Hades.Config.ormModel()
const Logger = Hades.Logger.getLogger('dms', __filename);

let dataStruct = new Object();

let changeData = {
    delete: {},
    set: {}
}

let loadQuery = {};
let loadData = {};

let _handleParseData = {
    "int": _.toSafeInteger,
    "uint": _.toSafeInteger,
    "small": _.toSafeInteger,
    "usmall": _.toSafeInteger,
    "tiny": _.toSafeInteger,
    "utiny": _.toSafeInteger,
    "float": parseFloat,
}

class ModelPaser {
    constructor() {
    }

    resetQueries() {
        changeData.delete = {}
        changeData.set = {}
        loadQuery = {}
        loadData = {}
    }

    init() {
		console.error("DMS need fixed.")
        // for (let [entityName, entityInfo] of Schema.getEntities()) {
        //     dataStruct[entityName] = new Object();
        //     let _props = Schema.getEntityProps(entityName);
        //     for (let name in _props) {
        //         let pinfo = _props[name];
        //         if (!!pinfo.persistent) {
        //             dataStruct[entityName][name] = this.gendataStruct(Types.getType(pinfo.type));
        //         }
        //     }
        // }
        // let fs = require('fs');
        // fs.writeFileSync('./DataStruct.json', JSON.stringify(dataStruct));
    }
    
    gendataStruct(type) {
        let ctype = _.cloneDeep(Types.getCompositeType(type));
        switch (ctype.ctype) {
            case "array":
                ctype.type = this.gendataStruct(ctype.type);
                break;
            case "map":
                ctype.keyType = this.gendataStruct(ctype.keyType);
                ctype.valueType = this.gendataStruct(ctype.valueType);
                break;
            case "object":
                for (let name in ctype.fields) {
                    let ft = ctype.fields[name];
                    ctype.fields[name] = this.gendataStruct(ft);
                }
                break;
        }
        return ctype;
    }

    getModel(tableName) {
        for (let n in Models) {
            if (Models[n].tableName == tableName) {
                return Models[n];
            }
        }
        return null;
    }

    getPath(tableName) {
        let path = [];
        for (let n in Models) {
            if (Models[n].tableName == tableName) {
                path = n.split('_');
            }
        }
        return path;
    }

    /**
     * 
     * @param {*} tableName 
     * @param {*} entityName 
     * @param {*} entityID 
     * @param {*} sqlData 
     */
    convertSqlDataToRedisData(tableName, entityName, entityID, sqlData) {
        let model = this.getModel(tableName);
        if (!model) {
            Logger.error('ModelParser - convertSqlDataToRedisData() can not find model!', tableName);
            return null;
        }
        let resultRedisData = {
            set: {},
            delete: {}
        }
        for (let data of sqlData) {
            let redisKey = model.tableName;
            for (let pkey of model.primary) {
                redisKey = redisKey + ':' + pkey + ':' + data[pkey];
            }
            resultRedisData.set[redisKey] = {
                where: {},
                data: data,
            }
        }
        return resultRedisData;
    }

    /**
     * parsing and return loading queries.
     * @param {*} entityName 
     * @param {*} entityID 
     * @param {*} data 
     */
    parseLoadData(entityName, entityID, data) {
        try {
            this.resetQueries();
            this.parseLoadBegin(entityName, entityID, data);
        } catch (err) {
            Logger.error('ModelParser - parseLoadData() ', err);
        }
        return loadQuery;
    }

    /**
     * parsing and return delete queries.
     * @param {*} entityName 
     * @param {*} entityID 
     * @param {*} data 
     */
    parseDeleteData(entityName, entityID, data) {
        try {
            this.resetQueries();
            this.parseDeleteBegin(entityName, entityID, data);
        } catch (err) {
            Logger.error('ModelParser - parseDeleteData() ', err);
        }
        return changeData
    }

    /**
     * parsing and return update queries.
     * @param {*} entityName 
     * @param {*} entityID 
     * @param {*} data 
     */
    parseUpdateData(entityName, entityID, data) {
        let resData = {
            delete: {},
            set: {}
        }
        try {
            this.resetQueries();
            this.parseUpdateBegin(entityName, entityID, data, resData);
        } catch (err) {
            Logger.error('ModelParser - parseUpdateData() ', err);
        }
        return resData
    }

    /**
     * 
     * @param {*} entityName 
     * @param {*} entityID 
     * @param {*} table 
     * @param {*} data 
     * @param {*} result 
     */
    parseLoadDataResult(entityName, entityID, table, data, result) {
        loadData = result;
        let model = this.getModel(table);
        if (!model) {
            Logger.error('DataManagerService - can not find model in parseLoadDataResult()', table);
            return;
        }
        if (_.isUndefined(model.tableType)) {
            Logger.error('DataManagerService - can not find model.tableType in parseLoadDataResult()', table);
            return;
        }
        switch (model.tableType) {
            case 1: //base
                this.parseLoadDataResultBasic(entityName, model, data);
                break;
            case 2: //array
                this.parseLoadDataResultArray(entityName, model, data, table);
                break;
            case 3: //map
                this.parseLoadDataResultMap(entityName, model, data, table);
                break;
            break;
        }
        return loadData;
    }

    getDataStruct(elementPath){
        let entityName = elementPath[0]
        let dStruct = dataStruct[entityName]
        if (_.isNil(dStruct)) return {}
        for (let i = 1; i < elementPath.length; i++){
            dStruct = dStruct[elementPath[i]]
            let nextPath
            switch (dStruct.ctype){
                case "basic":
                case "enum":
                    break
                case "object":
                    nextPath = elementPath[++i]
                    if (!!nextPath && !!dStruct.fields[nextPath]){
                        dStruct = dStruct.fields[nextPath]
                    }
                    break;
                case "map":
                    dStruct = dStruct.valueType
                    if (dStruct.ctype == "object"){
                        nextPath = elementPath[++i]
                        if (!!nextPath && !!dStruct.fields[nextPath]){
                            dStruct = dStruct.fields[nextPath]
                        }
                    }
                    break;
            }
        }
        return dStruct
    }

    parseLoadDataResultBasic(entityName, model, data) {
        for (let n in data) {
            let rowData = data[n];
            for (let m in rowData) {
                if (m.toLowerCase() == (entityName + 'ID').toLowerCase()) {
                    continue;
                };
                if (_.isNil(model.fields[m])){
                    console.error('ModelParser parseLoadDataResultBasic data model error!')
                    continue
                }
                let _elementPath = model.fields[m].elementPath;
                let _elementName = model.fields[m].elementName;
                let _rowData = rowData[m];
                
                let _tmpResult = loadData;
                let _subStruct = this.getDataStruct(_elementPath)
                if (!_.isEmpty(_subStruct) && _subStruct.ctype == "array" && _subStruct.size <= 6){
                    for (let x of _elementPath) {
                        if (!_tmpResult[x]) {
                            _tmpResult[x] = {};
                        }
                        _tmpResult = _tmpResult[x];
                    }
                    if (_.isNil(_tmpResult[_elementName])){
                        _tmpResult[_elementName] = []
                    }
                    _tmpResult[_elementName].push(_rowData)
                } else {
                    if (!_.isNil(_handleParseData[model.fields[m].type])){
                        _rowData = _handleParseData[model.fields[m].type](_rowData)
                    }
                    for (let x of _elementPath) {
                        if (!_tmpResult[x]) {
                            _tmpResult[x] = {};
                        }
                        _tmpResult = _tmpResult[x];
                    }
                    _tmpResult[_elementName] = _rowData;
                }
            }
        }
    }

    parseLoadDataResultArray(entityName, model, data, table) {
        let path = this.getPath(table);
        if (path.length == 0) {
            Logger.error('DataManagerService - can not find key\'s path.', table);
            return;
        }
        for (let row of data) {
            if (_.isUndefined(row['k_index'])) {
                Logger.error('DataManagerService - parseLoadDataResultArray() can not find k_index. please check database data.', table);
                return;
            }
            let _tmpResult = loadData[entityName];
            for (let i = 1; i <= path.length - 2; i++) {
                let thisPath = path[i];
                if (!_tmpResult[thisPath]) {
                    _tmpResult[thisPath] = {};
                }
                _tmpResult = _tmpResult[thisPath];
                if (row['k_p' + i]) {
                    let _tmpKey = row['k_p' + i];
                    if (!_tmpResult[_tmpKey]) {
                        _tmpResult[_tmpKey] = {};
                    }
                    _tmpResult = _tmpResult[_tmpKey];
                }
            }

            let lastPath = _.last(path);
            if (lastPath == '$sa' || lastPath == '$smi' || lastPath == '$sms') {
                Logger.error('ModelPaser - parseLoadDataResultArray() not support sa, sms, smi please check!!!');
                return;
            }
            if (!_tmpResult[lastPath]) {
                _tmpResult[lastPath] = [];
            }
            _tmpResult = _tmpResult[lastPath];

            let index = row['k_index'];
            let value = row['k_value'];

            if (!_.isNil(_handleParseData[model.fields['k_value'].type])){
                value = _handleParseData[model.fields['k_value'].type](value)
            }
            _tmpResult[index] = value;
        }
    }

    parseLoadDataResultMap(entityName, model, data, table) {
        let path = this.getPath(table);
        if (_.isEmpty(path)) {
            Logger.error('DataManagerService - can not find key\'s path.', table);
            return;
        }
        for (let row of data) {
            if (_.isUndefined(row['k_key'])) {
                Logger.error('DataManagerService - parseLoadDataResultMap() can not find k_key. please check database data.', table);
                return;
            }
            let _tmpResult = loadData[entityName];
            for (let i = 1; i <= path.length - 2; i++) {
                let thisPath = path[i];
                if (!_tmpResult[thisPath]) {
                    _tmpResult[thisPath] = {};
                }

                _tmpResult = _tmpResult[thisPath];
                if (row['k_p' + i]) {
                    let _tmpKey = row['k_p' + i];
                    if (!_tmpResult[_tmpKey]) {
                        _tmpResult[_tmpKey] = {};
                    }
                    _tmpResult = _tmpResult[_tmpKey];
                }
            }

            let lastPath = _.last(path);

            if (!_tmpResult[lastPath]) {
                _tmpResult[lastPath] = {};
            }

            _tmpResult = _tmpResult[lastPath];
            let _key = row['k_key'];
            for (let name in row) {
                if (name.toLowerCase() == (entityName + 'ID').toLowerCase()) {
                    continue;
                };
                if (name.indexOf('k_p') != -1) {
                    continue;
                };
                if (name == 'k_key') {
                    continue;
                };
                if (!model.fields[name]){
                    continue
                }

                let _elementPath = model.fields[name].elementPath;
                let _elementName = model.fields[name].elementName;
                let _subStruct = this.getDataStruct(_elementPath)

                let _rowData = row[name];
                if (!_.isNil(_handleParseData[model.fields[name].type])){
                    _rowData = _handleParseData[model.fields[name].type](_rowData)
                }
                if (name == 'k_value') {
                    _tmpResult[_key] = _rowData;
                } else {
                    if (!_tmpResult[_key]) {
                        _tmpResult[_key] = {};
                    }
                    if (!_.isEmpty(_subStruct) && _subStruct.ctype == "array" && _subStruct.size <= 6){
                        let _lName = _.last(_elementPath)
                        if (_.isNil(_tmpResult[_key][_lName])) _tmpResult[_key][_lName] = []
                        _tmpResult[_key][_lName].push(_rowData)
                    } else {
                        _tmpResult[_key][name] = _rowData;
                    }
                }
            }
        }
    }

    parseLoadBegin(entityName, entityID, data) {
        let tableName = entityName;
        let key = [];

        let eID = _.lowerFirst(entityName) + 'ID';
        key.push({[eID]: entityID});

        if (_.isEmpty(data)) {
            this.parseLoadKey(tableName, key);
            
            for (let n_name in dataStruct[entityName]) {
                this.parseLoadNext(tableName, key, n_name, dataStruct[entityName][n_name], {});
            }
        } else {
            this.parseLoadKey(tableName, key);
            
            for (let n_name in data) {
                let subEntityName = n_name;
                let subEntityStruct = dataStruct[entityName][subEntityName];
                let subEntityData = data[n_name];
    
                this.parseLoadNext(tableName, key, subEntityName, subEntityStruct, subEntityData)
            }
        }
    }

    parseLoadKey(tableName, key) {
        let model = Models[tableName];
        if (_.isUndefined(model)) {
            Logger.error('parseLoadKey() invalid model ', tableName);
            return;
        }

        let tbName = model.tableName;
        let tbPrimary = model.primary;

        // key init
        let keys = {};

        for (let i = 0; i < key.length; i++) {
            for (let m in key[i]) {
                keys[tbPrimary[i]] = key[i][m];
                continue;
            }
        }
        
        let elementName = tbName;
        for (let n in keys) {
            elementName = elementName + ":" + n + ":" + keys[n];
        }
        
        if (!loadQuery[elementName]) {
            let tmp = {};
            tmp['tableName'] = tbName;
            tmp['where'] = keys;
            loadQuery[elementName] = tmp;
        }
    }

    parseLoadNext(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        if(_.isUndefined(subEntityStruct)) {
            Logger.error('DataManagerService - Can not find subEntityStruct in parseLoadNext() ' + tableName + ', ' + subEntityName);
            return;
        }

        if(_.isUndefined(subEntityStruct.ctype)) {
            Logger.error('DataManagerService - Can not find ctype in parseLoadNext() ' + tableName + ', ' + subEntityName);
            return;
        }
        
        let subEntityCtype = subEntityStruct.ctype;

        switch (subEntityCtype) {
            case "basic":
                this.parseLoadBasic(tableName, key, subEntityName, subEntityStruct, subEntityData);
                break;
            
            case "map":
                this.parseLoadMap(tableName, key, subEntityName, subEntityStruct, subEntityData);
                break;

            case "object":
                this.parseLoadObject(tableName, key, subEntityName, subEntityStruct, subEntityData);
                break;
            
            case "array":
                this.parseLoadArray(tableName, key, subEntityName, subEntityStruct, subEntityData);
                break;
        }
    }

    parseLoadBasic(tableName, key, subEntityName, subEntityStruct, subEntityData) {
    }

    parseLoadObject(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        if (_.isEmpty(subEntityData)) {
            for (let o_name in subEntityStruct.fields) {
                let o_subEntityName = o_name;
                let o_subEntityData = {};
                let o_subEntityStruct = subEntityStruct.fields[o_name];

                let newTableName = tableName;
                
                if (o_subEntityStruct.ctype == 'map' || o_subEntityStruct.ctype == 'array') {
                    if (subEntityName != '') {
                        newTableName = tableName + '_' + subEntityName;
                    }
                }

                this.parseLoadNext(newTableName, key, o_subEntityName, o_subEntityStruct, o_subEntityData);
            }
        } else {
            for (let o_name in subEntityData) {

                let o_subEntityName = o_name;
                let o_subEntityStruct = subEntityStruct.fields[o_name];
                let o_subEntityData = subEntityData[o_name];

                let newTableName = tableName;
                
                if (o_subEntityStruct.ctype == 'map' || o_subEntityStruct.ctype == 'array') {
                    if (subEntityName != '') {
                        newTableName = tableName + '_' + subEntityName;
                    }
                }
        
                this.parseLoadNext(newTableName, key, o_subEntityName, o_subEntityStruct, o_subEntityData);
            }
        }
    }

    parseLoadArray(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        if (subEntityStruct.type.ctype == 'map' || subEntityStruct.type.ctype == 'array') {
            Logger.error('DataManagerService - parseLoadArray() not support sa, sms, smi please check!!!');
            return;
        }

        if (_.isNil(subEntityStruct.size) || subEntityStruct.size > 6) {
            let newTableName = tableName + '_' + subEntityName;

            if (_.isEmpty(subEntityData)) {
                let newKey = [];
                for (let n in key) {
                    if (n > 0) {
                        let keyName = 'k_p' + n;
                        let values = _.values(key[n])
                        newKey.push({[keyName]:values[0]});
                    } else {
                        newKey.push(key[n]);
                    }
                }
                this.parseLoadKey(newTableName, newKey);
    
            } else {
                for (let a_index in subEntityData) {
    
                    let a_subEntityName = 'k_value';
                    let a_subEntityStruct = subEntityStruct.type;
                    let a_subEntityData = subEntityData[a_index];
                    
                    let newKey = _.cloneDeep(key);
                    newKey.push({['k_index'] : a_subEntityData});
        
                    this.parseLoadKey(newTableName, newKey);
                }
            }
        }
    }

    parseLoadMap(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        let newTableName = tableName + '_' + subEntityName;

        let m_subEntityStruct = subEntityStruct.valueType;
        let m_subEntityData = {};
        
        if (_.isEmpty(subEntityData)) {
            this.parseLoadKey(newTableName, key);
            
            let _subEntityName = '';

            if (m_subEntityStruct.ctype == 'array') {
                _subEntityName = '$sa';
            } else if (m_subEntityStruct.ctype == 'map') {
                _subEntityName = '$sms';

                if (m_subEntityStruct.keyType.type == 'uint' || m_subEntityStruct.keyType.type == 'int') {
                    _subEntityName = '$smi';
                }
            }

            if (_subEntityName != '') {
                Logger.error('DataManagerService - parseLoadMap() not support sa, sms, smi please check!!!');
                return;
            }
            
            this.parseLoadNext(newTableName, key, _subEntityName, m_subEntityStruct, m_subEntityData);
        } else {
            for (let m_key in subEntityData) {

                m_subEntityData = subEntityData[m_key];
    
                let newKey = _.cloneDeep(key);
                newKey.push({['k_key'] : m_key});

                if (_.isEmpty(m_subEntityData)) {
                    this.parseLoadKey(newTableName, newKey);
                }
                
                this.parseLoadNext(newTableName, newKey, '', m_subEntityStruct, m_subEntityData);
            }
        }
    }

    parseDeleteBegin(entityName, entityID, data) {
        let tableName = entityName;
        let key = [];

        let eID = _.lowerFirst(entityName) + 'ID';
        key.push({[eID]: entityID});

        for (let n_name in data) {
            let subEntityName = n_name;
            let subEntityStruct = dataStruct[entityName][subEntityName];
            let subEntityData = data[n_name];

            this.parseDeleteNext(tableName, key, subEntityName, subEntityStruct, subEntityData)
        }
    }

    parseDeleteKey(tableName, key) {
        let model = Models[tableName];
        if (_.isUndefined(model)) {
            Logger.error('parseDeleteKey() invalid model ', tableName);
            return;
        }

        let tbName = model.tableName;
        let tbPrimary = model.primary;

        // key init
        let keys = {};

        for (let i = 0; i < key.length; i++) {
            for (let m in key[i]) {
                keys[tbPrimary[i]] = key[i][m];
                continue;
            }
        }

        let elementName = tbName;
        for (let n in keys) {
            elementName = elementName + ":" + n + ":" + keys[n];
        }
        
        if (!changeData.delete[elementName]) {
            let tmp = {};
            tmp['tableName'] = tbName;
            tmp['where'] = keys;
            changeData.delete[elementName] = tmp;
        }
    }

    parseDeleteNext(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        
        if(_.isUndefined(subEntityStruct)) {
            Logger.error('DataManagerService - Can not find subEntityStruct in parseDeleteNext() ' + tableName + ', ' + subEntityName);
            return;
        }

        if(_.isUndefined(subEntityStruct.ctype)) {
            Logger.error('DataManagerService - Can not find ctype in parseDeleteNext()' + tableName + ', ' + subEntityName);
            return;
        }
        
        let subEntityCtype = subEntityStruct.ctype;

        switch (subEntityCtype) {
            case "basic":
                this.parseDeleteBasic(tableName, key, subEntityName, subEntityStruct, subEntityData);
                break;
            
            case "map":
                this.parseDeleteMap(tableName, key, subEntityName, subEntityStruct, subEntityData);
                break;

            case "object":
                this.parseDeleteObject(tableName, key, subEntityName, subEntityStruct, subEntityData);
                break;
            
            case "array":
                this.parseDeleteArray(tableName, key, subEntityName, subEntityStruct, subEntityData);
                break;
        }
    }

    parseDeleteBasic(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        // Logger.log(tableName, key, subEntityName, subEntityStruct, subEntityData);
    }

    parseDeleteObject(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        if (_.isEmpty(subEntityData)) {
            for (let o_name in subEntityStruct.fields) {
                let o_subEntityName = o_name;
                let o_subEntityData = {};
                let o_subEntityStruct = subEntityStruct.fields[o_name];

                let newTableName = tableName;

                if (o_subEntityStruct.ctype == 'map' || o_subEntityStruct.ctype == 'array') {
                    if (subEntityName != '') {
                        newTableName = tableName + '_' + subEntityName;
                    }
                }

                this.parseDeleteNext(newTableName, key, o_subEntityName, o_subEntityStruct, o_subEntityData);
            }
        } else {
            for (let o_name in subEntityData) {

                let o_subEntityName = o_name;
                let o_subEntityStruct = subEntityStruct.fields[o_name];
                let o_subEntityData = subEntityData[o_name];

                let newTableName = tableName;

                if (o_subEntityStruct.ctype == 'map' || o_subEntityStruct.ctype == 'array') {
                    if (subEntityName != '') {
                        newTableName = tableName + '_' + subEntityName;
                    }
                }
        
                this.parseDeleteNext(newTableName, key, o_subEntityName, o_subEntityStruct, o_subEntityData);
            }
        }
    }

    parseDeleteArray(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        if (!_.isNil(subEntityStruct.size) && subEntityStruct.size <= 6) return
        
        let newTableName = tableName + '_' + subEntityName;

        let a_subEntityStruct = subEntityStruct.type;
        let a_subEntityName = '';

        if (a_subEntityStruct.ctype == "array") {
            a_subEntityName = '$sa';
        } else if (a_subEntityStruct.ctype == "map") {
            a_subEntityName = '$sms';

            if (a_subEntityStruct.keyType.type == 'uint' || a_subEntityStruct.keyType.type == 'int') {
                a_subEntityName = '$smi';
            }
        }

        if (a_subEntityName == '$sa' || a_subEntityName == '$sms' || a_subEntityName == '$smi') {
            Logger.error('ModelPaser - parseUpdateArray() not support sa, sms, smi please check!!!');
            return;
        }

        if (_.isEmpty(subEntityData)) {
            let newKey = [];
            
            for (let n in key) {
                if (n > 0) {
                    let keyName = 'k_p' + n;
                    let values = _.values(key[n])
                    newKey.push({[keyName]:values[0]});
                } else {
                    newKey.push(key[n]);
                }
            }

            this.parseDeleteKey(newTableName, newKey);

        } else {
            for (let a_index in subEntityData) {

                let a_subEntityName = 'k_value';
                let a_subEntityStruct = subEntityStruct.type;
                let a_subEntityData = subEntityData[a_index];
                
                let newKey = _.cloneDeep(key);
                newKey.push({['k_index'] : a_subEntityData});
    
                this.parseDeleteKey(newTableName, newKey);
            }
        }
    }

    parseDeleteMap(tableName, key, subEntityName, subEntityStruct, subEntityData) {
        let newTableName = tableName + '_' + subEntityName;

        let m_subEntityStruct = subEntityStruct.valueType;
        let m_subEntityData = {};
        let m_subEntityName = '';

        if (m_subEntityStruct.ctype == "array") {
            m_subEntityName = '$sa';
        } else if (m_subEntityStruct.ctype == "map") {
            m_subEntityName = '$sms';

            if (m_subEntityStruct.keyType.type == 'uint' || m_subEntityStruct.keyType.type == 'int') {
                m_subEntityName = '$smi';
            }
        }

        if (m_subEntityName == '$sa' || m_subEntityName == '$sms' || m_subEntityName == '$smi') {
            Logger.error('ModelPaser - parseDeleteMap() not support sa, sms, smi please check!!!');
            return;
        }
        
        if (_.isEmpty(subEntityData)) {
            this.parseDeleteKey(newTableName, key);
            this.parseDeleteNext(newTableName, key, m_subEntityName, m_subEntityStruct, m_subEntityData);
        } else {
            for (let m_key in subEntityData) {
                m_subEntityData = subEntityData[m_key];
                let newKey = _.cloneDeep(key);
                newKey.push({['k_key'] : m_key});
                if (_.isEmpty(m_subEntityData)) {
                    this.parseDeleteKey(newTableName, newKey);
                }
                this.parseDeleteNext(newTableName, newKey, m_subEntityName, m_subEntityStruct, m_subEntityData);
            }
        }
    }

    parseUpdateBegin(entityName, entityID, data, resData) {
        let tableName = entityName;
        let key = [];

        let eID = _.lowerFirst(entityName) + 'ID';
        // key.push({[eID]: entityID});
        key.push(entityID)
        
        this.parseUpdateBasic(tableName, key, {[eID]: entityID}, [], resData);
        
        for (let n_name in data) {
            let subEntityName = n_name;
            let subEntityStruct = dataStruct[entityName][subEntityName];
            let subEntityData = data[n_name];
            let tableLayer = [];
            tableLayer.push(entityName);
            this.parseUpdateNext(tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData);
        }
    }

    parseUpdateNext(tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData) {

        if(_.isUndefined(subEntityStruct)) {
            Logger.error('DataManagerService - Can not find subEntityStruct in parseUpdateNext()' + tableName + ', ' + subEntityName);
            return;
        }

        if(_.isUndefined(subEntityStruct.ctype)) {
            Logger.error('DataManagerService - Can not find ctype in parseUpdateNext()' + tableName + ', ' + subEntityName);
            return;
        }
        
        let subEntityCtype = subEntityStruct.ctype;

        switch (subEntityCtype) {
            case "basic": 
            case "enum":
                let b_data = {[subEntityName]:subEntityData};
                this.parseUpdateBasic(tableName, key, b_data, tableLayer, resData);
                break;

            case "object":
                this.parseUpdateObject(tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData);
                break;

            case "map":
                this.parseUpdateMap(tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData);
                break;

            case "array":
                this.parseUpdateArray(tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData);
                break;

            default:
                Logger.error('DataManagerService - Unable to parsing next entity data in Update.', tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData);
                break;
        }
    }

    parseUpdateBasic(tableName, key, value, tableLayer, resData) {
        let keys = this.parseUpdateKeys(tableName, key)
        tableName = tableName.toLowerCase();
        let elementName = tableName;
        for (let n in keys) {
            elementName = elementName + ":" + n + ":" + keys[n];
        }
        if (!resData.set[elementName]) {
            let tmp = {};
            tmp['tableName'] = tableName;
            tmp['where'] = keys;
            tmp['data'] = value;
            resData.set[elementName] = tmp;
            for (let n in resData.set[elementName].where) {
                if (n == 'k_index') {
                    this.parseUpdateArrayDelete(tableName, keys, resData)
                }
            }
        } else {
            for (let n in value) {
                resData.set[elementName].data[n] = value[n];
            }
        }
    }

    parseUpdateKeys(tableName, key){
        let model = Models[tableName]
        if (!model){
            console.error(`ModelParser model invalid tableName ${tableName}`)
        }
        let keys = {}
        for (let i = 0; i < key.length; i++) {
            keys[model.primary[i]] = key[i]
        }
        return keys
    }

    parseUpdateArrayDelete(tableName, keys, resData){
        let delQueryKeys = _.cloneDeep(keys);
        delete delQueryKeys['k_index'];
        let delQueryElement = tableName;
        for (let n in delQueryKeys) {
            delQueryElement = delQueryElement + ":" + n + ":" + delQueryKeys[n];
        }
        if (!resData.delete[delQueryElement]) {
            let tmpDelete = {};
            tmpDelete['tableName'] = tableName;
            tmpDelete['where'] = delQueryKeys;
            resData.delete[delQueryElement] = tmpDelete;
        }
    }

    parseUpdateObject(tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData) {
        // for (let o_name in subEntityData) {
        for (let o_name in subEntityStruct.fields) {

            if (subEntityStruct.fields[o_name].ctype == 'basic' || subEntityStruct.fields[o_name].ctype == 'enum') {
                let tmpName = o_name;
                
                if (subEntityName != 'k_value') {
                    tmpName = subEntityName + '_' + o_name;
                }
                if (_.isUndefined(subEntityData[o_name])) {
                    continue;
                }
                let o_data = {[tmpName] : subEntityData[o_name]};
                this.parseUpdateBasic(tableName, key, o_data, tableLayer, resData);
            } else {
                let newTableName = tableName;
                if (subEntityName != 'k_value') {
                    newTableName = tableName + '_' + subEntityName;
                }
                let o_subEntityName = o_name;
                let o_subEntityStruct = subEntityStruct.fields[o_name];
                let o_subEntityData = subEntityData[o_name];
                if (_.isUndefined(subEntityData[o_name])) {
                    continue;
                }
                this.parseUpdateNext(newTableName, key, o_subEntityName, o_subEntityStruct, o_subEntityData, tableLayer, resData);
            }
        }
    }

    parseUpdateMap(tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData) {
        let newTableName = tableName + '_' + subEntityName;
        
        for (let m_key in subEntityData) {
            let m_subEntityStruct = subEntityStruct.valueType;
            let m_subEntityData = subEntityData[m_key];
            let m_subEntityName = "k_value";
            
            if (m_subEntityStruct.ctype == "array") {
                m_subEntityName = '$sa';
            } else if (m_subEntityStruct.ctype == "map") {
                m_subEntityName = '$sms';

                if (m_subEntityStruct.keyType.type == 'uint' || m_subEntityStruct.keyType.type == 'int') {
                    m_subEntityName = '$smi';
                }
            }

            if (m_subEntityName == '$sa' || m_subEntityName == '$sms' || m_subEntityName == '$smi') {
                Logger.error('ModelPaser - parseUpdateMap() not support sa, sms, smi please check!!!');
                return;
            }
            
            let newKey = _.cloneDeep(key);
            newKey.push(m_key);
            let newTableLayer = _.cloneDeep(tableLayer);
            newTableLayer.push(subEntityName);
            this.parseUpdateNext(newTableName, newKey, m_subEntityName, m_subEntityStruct, m_subEntityData, newTableLayer, resData);
        }
    }

    parseUpdateArray(tableName, key, subEntityName, subEntityStruct, subEntityData, tableLayer, resData) {
        if (!_.isNil(subEntityStruct.size) && subEntityStruct.size <= 6) {
            for (let i = 0; i < subEntityStruct.size; i++){
                let subEntName = subEntityName + '_' + (i+1)
                if (_.isNil(subEntityData)){
                    continue
                }
                let subData = {[subEntName]: subEntityData[i]}
                this.parseUpdateBasic(tableName, key, subData, tableLayer, resData)
            }
        } else {
            let newTableName = tableName + '_' + subEntityName;

            if (subEntityData.length == 0){
                let keys = this.parseUpdateKeys(newTableName, key)
                this.parseUpdateArrayDelete(newTableName.toLocaleLowerCase(), keys, resData)
            } else {
                for (let a_index in subEntityData) {
                    let a_subEntityName = 'k_value';
                    let a_subEntityStruct = subEntityStruct.type;
                    let a_subEntityData = subEntityData[a_index];
    
                    if (a_subEntityStruct.ctype == "array") {
                        a_subEntityName = '$sa';
                    } else if (a_subEntityStruct.ctype == "map") {
                        a_subEntityName = '$sms';
                        if (a_subEntityStruct.keyType.type == 'uint' || a_subEntityStruct.keyType.type == 'int') {
                            a_subEntityName = '$smi';
                        }
                    }
                    if (a_subEntityName == '$sa' || a_subEntityName == '$sms' || a_subEntityName == '$smi') {
                        Logger.error('ModelPaser - parseUpdateArray() not support sa, sms, smi please check!!!');
                        return;
                    }
                    
                    let newKey = _.cloneDeep(key);
                    newKey.push(a_index);
    
                    let newTableLayer = _.cloneDeep(tableLayer);
                    newTableLayer.push(subEntityName);
    
                    this.parseUpdateNext(newTableName, newKey, a_subEntityName, a_subEntityStruct, a_subEntityData, newTableLayer, resData);
                }
            }
        }
    }
}

module.exports = new ModelPaser();
