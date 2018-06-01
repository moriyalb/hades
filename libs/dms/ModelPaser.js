"use strict"
const _ = require("lodash")
const Hades = GlobalHades
const Schema = Hades.Schema
const Types = Hades.Schema.Types

class ModelPaser {
    constructor(){
        this.models = {
            entries:{}
        }
        this.handlerGenModel = {
            "basic": this._genBasic,
            "array": this._genArray,
            "map": this._genMap,
            "object": this._genObject,
            "enum": this._genBasic
        }
        this.keyType = {
            array: 'k_index',
            map: 'k_key'
        }
    }

    init(){
        this._composeModels()
    }

    toUpdate(entity, path, value){
        let result = this._toUpdateData(entity, path, value)
        return result
    }

    toDelete(entity, path){
        let result = this._toDeleteData(entity, path)
        return result
    }
    
    toLoad(){
    }

    _pathIsValid(path){
        if (!path) return false
        if (!path.valuePath || !path.typePath) return false
        if (path.valuePath.length != path.typePath.length) return false
        return true
    }

    _getTabelInfo(entity, path){
        if (!this._pathIsValid(path)) return null
        let propId = this._getPropId(entity, path)
        return this._getTableInfoByPropId(propId)
    }

    _getTableInfoByPropId(propId){
        if (!this.models.entries[propId]) return null
        let tbInfo = this.models.entries[propId]
        return tbInfo
    }

    _toDmsUnit(entity, path, tableInfo, method, value = null){
        let _tmpData = {
            _method: method,
            _eid: entity._eid,
            _key: `${tableInfo.table}:${entity._eidName}:${entity._eid}`,
            _table: tableInfo.table,
            _data: {[entity._eidName]: entity._eid}
        }
        let i = 0, j = 0
        for (; i < path.typePath.length; i++){
            switch (path.typePath[i]){
                case 'array':
                case 'map':
                let _field = tableInfo.fields[j]
                let _value = path.valuePath[i]
                _tmpData._key = `${_tmpData._key}:${_field}:${_value}`
                _tmpData._data[_field] = _value
                j++
                break
            }
        }
        if (method === 'update'){
            _tmpData._data[tableInfo.fields[j]] = value
        }
        return _tmpData
    }

    _toDeleteData(entity, path){
        let tbInfo = this._getTabelInfo(entity, path)
        if (!tbInfo) return null
        let dmsUnits = []
        if (!!tbInfo.subs){
            let refUnits = []
            let _propId = this._getPropId(entity, path)
            this._toDeleteDataSubs(entity, path, _propId, refUnits)
            for (let v of refUnits){
                dmsUnits.push(v)
            }
        } else {
            let dmsUint = this._toDmsUnit(entity, path, tbInfo, 'delete')
            if (!!dmsUint) dmsUnits.push(dmsUint)
        }
        return dmsUnits
    }

    _toDeleteDataSubs(entity, path, propId, refUnits){
        let tbInfo = this._getTableInfoByPropId(propId)
        if (!tbInfo){
            console.error('dms _toDeleteDataSub tbInfo is null', propId)
            return
        }
        let dmsUnit = this._toDmsUnit(entity, path, tbInfo, 'delete')
        if (!!dmsUnit) refUnits.push(dmsUnit)
        if (!!tbInfo.subs){
            for (let _propId of tbInfo.subs){
                this._toDeleteDataSubs(entity, path, _propId, refUnits)
            }
        }
    }

    _toUpdateData(entity, path, value){
        if (_.isNil(value)) return null
        let tbInfo = this._getTabelInfo(entity, path)
        if (!tbInfo) return null
        let dmsUnit = this._toDmsUnit(entity, path, tbInfo, 'update', value)
        return dmsUnit
    }

    _getPropId(entity, path){
        let propId = entity._ename
        let prevType = null
        for (let i = 0; i < path.typePath.length; i++){
            switch (path.typePath[i]){
                case 'object':
                propId += `_${path.valuePath[i]}`
                break

                case 'array':
                if (!!prevType && prevType == 'array' || prevType == 'map') propId += `_$sa`
                break

                case 'map':
                if (!!prevType && prevType == 'array' || prevType == 'map') propId += `_$smi`
                break
            }
            prevType = path.typePath[i]
        }
        return propId
    }

    _composeModels(){
        for (let ename in Schema.allEntities()){
            let props = Schema.getMetaProperty(ename)
            for (let prop in props){
                let tp = Types.getType(props[prop].type)
                let data = {
                    _type: Types.getCompositeType(tp),
                    _namePath: [ename, prop],
                    _typePath: ['object'],
                    _tablePath: [ename],
                    _lastFieldPath: [prop],
                    _fields: [],
                    _hasValue: true,
                    _keyType: null,
                    _parentPath: []
                }
                this._genModel(data)
            }
        }
    }

    _genModel(data){
        // console.log('_genModel ->', data._type.ctype)
        this.handlerGenModel[data._type.ctype].call(this, data)
    }

    _autoGenBasic(data){
        let _data = _.cloneDeep(data)
        let tmpType = data._type.ctype
        let lastType = this._getLastType(_data)
        _data._keyType = this.keyType[lastType]
        _data._hasValue = false
        this._genBasic(_data)
    }

    _genBasic(data){
        let tmpCnt = 0, kpCount = 1
        for (let v of data._typePath){
            if (v === 'array' || v === 'map'){
                tmpCnt++
                if (tmpCnt >= 2){
                    data._fields.push(`k_p${kpCount}`)
                    kpCount++
                }
            }
        }
        if (!!data._keyType){
            data._fields.push(data._keyType)
        }
        switch(this._getLastType(data)){
            case 'object':
                if (data._hasValue){
                    data._fields.push(_.join(data._lastFieldPath, '_').toLowerCase())
                }
                break
            case 'array':
            case 'map':
                if (data._hasValue){
                    data._fields.push('k_value')
                }
                break
        }

        let name = _.join(data._namePath, '_')
        let table = _.join(data._tablePath, '_').toLowerCase()
        let parent = _.join(data._parentPath, '_')

        if (!this.models.entries[name]){
            this.models.entries[name] = {
                fields: [],
                subs:[]
            }
        }
        if (!!parent){
            if (!this.models.entries[parent]){
                this.models.entries[parent] = {
                    fields: [],
                    subs:[]
                }
            }
            this.models.entries[parent].subs.push(name)
        }
        Object.assign(this.models.entries[name], {
            table: table,
            fields: data._fields,
            // types: data._typePath,
            // parent: parent
        })
        
        require('fs').writeFileSync('models.json', JSON.stringify(this.models))
    }

    _genArraySmallSize(data){
        console.log('small size array', data)
        for (let i = 1; i <= data._type.size; i++){
            let _data = _.cloneDeep(data)
            let _last = _.last(_data._namePath)
            _data._namePath = _.dropRight(_data._namePath, 1)
            _data._namePath.push(`${_last}_${i}`)
            
            let _lastField = _.last(_data._lastFieldPath)
            _data._lastFieldPath = _.dropRight(_data._lastFieldPath, 1)
            _data._lastFieldPath.push(`${_lastField}_${i}`)

            this._genBasic(_data)
        }
    }

    _genArray(data){
        if (data._type.size <= 6){
            this._genArraySmallSize(data)
            return
        }
        data._lastFieldPath = []
        let _data = _.cloneDeep(data)
        _data._type = Types.getCompositeType(data._type.type)
        _data._tablePath = []
        _data._fields = []
        let tmp = 0
        for (let v of data._namePath){
            _data._tablePath.push(v)
        }
        if (this._isLastMapOrArray(data)){
            this._autoGenBasic(data)
            _data._parentPath = data._namePath
            _data._namePath.push('$sa')
            _data._tablePath.push('$sa')
        }
        _data._typePath.push('array')
        _data._keyType = 'k_index'
        this._genModel(_data)
    }

    _genMap(data){
        data._lastFieldPath = []
        let _data = _.cloneDeep(data)
        _data._type = Types.getCompositeType(data._type.valueType)
        _data._tablePath = []
        for (let v of data._namePath){
            _data._tablePath.push(v)
        }
        if (this._isLastMapOrArray(data)){
            this._autoGenBasic(data)
            _data._parentPath = data._namePath
            _data._namePath.push('$smi')
            _data._tablePath.push('$smi')
        }
        _data._typePath.push('map')
        _data._keyType = 'k_key'
        this._genModel(_data)
    }

    _genObject(data){
        if (this._isLastMapOrArray(data)){
            this._autoGenBasic(data)
        }
        for (let v in data._type.fields){
            let _data = _.cloneDeep(data)
            _data._type = Types.getCompositeType(data._type.fields[v])
            _data._parentPath = []
            if (_data._type.ctype == 'array' || _data._type.ctype == 'map'){
                _data._parentPath = data._namePath
            }
            _data._typePath.push('object')
            _data._namePath.push(v)
            _data._lastFieldPath.push(v)
            this._genModel(_data)
        }
    }

    _isLastMapOrArray(data){
        let parentType = this._getLastType(data)
        if (parentType == 'array' || parentType == 'map'){
            return true
        }
        return false
    }
    
    _getLastType(data){
        return _.last(data._typePath)
    }

    _getLastNamePath(data){
        return _.last(data._namePath)
    }
}

module.exports = new ModelPaser()