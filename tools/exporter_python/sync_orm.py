
import sys, os
import jellyfish

INDEX_NONE = 0
INDEX_UNIQUE = 1
INDEX_INDEX = 2
INDEX_FULL_INDEX = 3


def _toType(modelType):
	if modelType == "int":
		return "int(10)"
	elif modelType == "uint":
		return "int(10) unsigned"
	elif modelType == "small":
		return "smallint(4)"
	elif modelType == "usmall":
		return "smallint(4) unsigned"
	elif modelType == "tiny":
		return "tinyint(2)"
	elif modelType == "utiny":
		return "tinyint(2) unsigned" 
	elif "string" in modelType:
		size = modelType.split(":")[1]
		return "varchar(%s)"%size
	elif modelType == "float":
		return "decimal(20,2)"
	elif modelType == "blob":
		return "blob"

def _toIndex(modelIndex, fieldName):
	if modelIndex == INDEX_UNIQUE:
		return '''UNIQUE INDEX `{fname}_INDEX` (`{fname}`)'''.format(fname=fieldName)
	elif modelIndex == INDEX_INDEX:
		return '''INDEX `{fname}_INDEX` (`{fname}`)'''.format(fname=fieldName)
	else:
		return ""

def _toIndexName(fieldName):
	return fieldName + "_INDEX"

def _null(fieldName, tableName):
	if fieldName.startswith("k_"):
		return "NOT NULL"
	elif fieldName == tableName + "ID":
		return "NOT NULL"
	return ""

def saveTable(cfg, output):
	tcolumns = []
	tindexs = []
	#tcolumns.append('''`_id` int(10) unsigned not null auto_increment''')
	for fname, field in cfg['fields'].items():
		tcolumns.append('''`{fname}` {ftype} {null}'''.format(fname = fname, null = _null(fname, cfg['tableName']), ftype = _toType(field['type'])))
		idx = _toIndex(field['index'], fname)
		if idx != "":
			tindexs.append(idx) 
	
	#PRIMARY KEY (`_id`),
	sql = '''CREATE TABLE `{tname}` (
			{tcolumns},			
			PRIMARY KEY ({tprimarys}){pd}
			{tindexs}) ENGINE=InnoDB CHARSET=utf8'''.format(
				tname = cfg['tableName'],
				tcolumns = ",\n			".join(tcolumns),
				tprimarys = ",".join(["`"+p+"`" for p in cfg['primary']]),
				pd =  ("," if len(tindexs) > 0 else ""),
				tindexs = ",\n			".join(tindexs)
			).strip()

	# print(sql)
	# print()
	# print()
	# print()
	output.append(('create', sql, cfg['tableName']))
		
def dropTable(tableName, output):
	sql = '''DROP TABLE `{tname}`'''.format(tname = tableName.lower())
	output.append(('delete', sql, tableName))
	
def alterTable(tableName, alters, output):
	if len(alters) == 0:return
	talters = []

	for alter in alters:
		if alter['alterType'] == AT_TABLE_NAME:
			talters.append('''RENAME TO `{newName}`'''.format(newName = alter['value']))
		elif alter['alterType'] == AT_PRIMARY:
			talters.append('''DROP PRIMARY KEY, ADD PRIMARY KEY ({tprimary})'''.format(tprimary = ",".join(["`"+p+"`" for p in alter['value']])))
		elif alter['alterType'] == AT_ADD_COLUMN:
			talters.append('''ADD COLUMN `{fname}` {ftype} {null}'''.format(fname = alter['field'], null = _null(alter['field'], tableName), ftype = _toType(alter['value']['type'])))
			if alter['value']['index'] != INDEX_NONE:
				talters.append('''ADD {tindexname}'''.format(tindexname = _toIndex(alter['value']['index'], alter['field'])))
		elif alter['alterType'] == AT_DEL_COLUMN:
			talters.append('''DROP COLUMN `{fname}`'''.format(fname = alter['field']))
		elif alter['alterType'] == AT_COLUMN_TYPE or alter['alterType'] == AT_COLUMN_LITE_TYPE:
			talters.append('''CHANGE COLUMN `{fname}` `{fname}` {ftype} {null}'''.format(fname = alter['field'], null = _null(alter['field'], tableName), ftype = _toType(alter['value']['type'])))
		elif alter['alterType'] == AT_COLUMN_NAME:
			talters.append('''CHANGE COLUMN `{foldname}` `{fnewname}` {ftype} {null}'''.format(foldname = alter['field'], null = _null(alter['field'], tableName), fnewname = alter['fieldNew'], ftype = _toType(alter['value']['type'])))
		elif alter['alterType'] == AT_COLUMN_INDEX_ADD:
			talters.append('''ADD {tindexname}'''.format(tindexname = _toIndex(alter['value'], alter['field'])))
		elif alter['alterType'] == AT_COLUMN_INDEX_DROP:
			talters.append('''DROP INDEX `{tindexname}`'''.format(tindexname = _toIndexName(alter['field'])))
		elif alter['alterType'] == AT_COLUMN_INDEX_MODIFY:
			talters.append('''DROP INDEX `{tindexname}`'''.format(tindexname = _toIndexName(alter['field'])))
			talters.append('''ADD {tindexname}'''.format(tindexname = _toIndex(alter['value'], alter['field'])))
	
	if len(talters) == 0:return
	sql = '''ALTER TABLE `{tname}`
			{talters};'''.format(tname = tableName.lower(), talters = ",\n			".join(talters))
	
	output.append(("alter", sql, tableName))

def sync(new, old, output):
	#cursor.execute("show index from table1")
	#('table1', 0, 'name_UNIQUE', 1, 'name', 'A', 0, None, None, 'YES', 'BTREE', '', '')
	deltaCfg = diff(old, new)
	#print()
	for tname, cfg in deltaCfg['creates'].items():
		saveTable(cfg, output)
	#print()
	for tname in deltaCfg['drops']:
		dropTable(tname, output)
	#print()
	for tname, alters in deltaCfg['alters'].items():
		alterTable(tname, alters, output)
	#print()	

def checkSimilarTable(first, second):
	if sys.version_info[0] == 2:
		first = first.decode('utf-8')
	return jellyfish.jaro_distance(first, second) > 0.50

def checkSimilarField(first, second):
	if sys.version_info[0] == 2:
		first = first.decode('utf-8')
	dist = 1 if (len(first)+len(second)) < 6 else 2
	return jellyfish.damerau_levenshtein_distance(first, second) <= dist

AT_TABLE_NAME = 1
AT_ADD_COLUMN = 2
AT_DEL_COLUMN = 3
AT_COLUMN_TYPE = 4
AT_COLUMN_NAME = 5
AT_COLUMN_INDEX_MODIFY = 6
AT_COLUMN_LITE_TYPE = 7
AT_PRIMARY = 8
AT_COLUMN_INDEX_ADD = 9
AT_COLUMN_INDEX_DROP = 10

def diffField(fieldOld, fieldNew, alters, fieldName):
	#print("diff ------- ", fieldOld, fieldNew, fieldName)
	if fieldOld['type'] != fieldNew['type']:
		atp = AT_COLUMN_TYPE
		#print("diffField1 ---------------- ", fieldOld)
		#print("diffField2 ---------------- ", fieldNew)
		# if isLiteType(fieldOld['type'], fieldNew['type']):
		# 	atp = AT_COLUMN_LITE_TYPE
		alters.append({
			'alterType':atp,
			'field':fieldName,
			'value':fieldNew
		})

	if fieldOld['index'] != fieldNew['index']:
		ci = 0
		if fieldNew['index'] == INDEX_NONE:
			ci = AT_COLUMN_INDEX_DROP
		elif fieldOld['index'] == INDEX_NONE:
			ci = AT_COLUMN_INDEX_ADD
		elif fieldOld['index'] != fieldNew['index']:
			ci = AT_COLUMN_INDEX_MODIFY
		else:
			print("Invalid index change !")
			exit(1)
		
		alters.append({
			'alterType':ci,
			'field':fieldName,
			'value':fieldNew['index']
		})
		
	return alters

def diffTable(tableOld, tableNew, alters):
	alters = []
	temps = {
		"removes":[],
		"adds":{}
	}
	if set(tableOld['primary']) - set(tableNew['primary']) != set():
		alters.append({
			'alterType':AT_PRIMARY,
			'value':tableNew['primary']
		})
	for key in tableOld['fields']:
		if not key in tableNew['fields']:
			temps["removes"].append(key)
			continue
		diffField(tableOld['fields'][key], tableNew['fields'][key], alters, key)
	for key in tableNew['fields']:
		if not key in tableOld['fields']:
			temps["adds"][key] = tableNew['fields'][key]

	notRemove = set()
	for index, toRemove in tuple(enumerate(temps["removes"])):
		#print(index, toRemove)
		for toAdd, field in tuple(temps["adds"].items()):
			#print(toAdd, field)
			if checkSimilarField(toRemove, toAdd):
				alters.append({
					'alterType':AT_COLUMN_NAME,
					'field':toRemove,
					'fieldNew':toAdd,
					'value':field
				})
				notRemove.add(toRemove)
				del temps["adds"][toAdd]
				break
	for rm in temps["removes"]:
		if rm in notRemove:continue
		alters.append({
			'alterType':AT_DEL_COLUMN,
			'field':rm
		})
	for add,field in temps["adds"].items():
		alters.append({
			'alterType':AT_ADD_COLUMN,
			'field':add,
			'value':field	
		})
	return alters

def isLiteType(t1, t2):
	if 'int' in t1 and 'int' in t2:
		return True
	if 'string' in t1 and 'string' in t2:
		return True
	if 'float' in t1 and 'float' in t2:
		return True
	return False

def isSameTable(tableOld, tableNew):
	alters = []
	if set(tableOld['primary']) - set(tableNew['primary']) != set():
		return False,None
	#print("	 check table -> primary done.")
	for key in tableOld['fields']:
		if not key in tableNew['fields']:
			return False,None
		#print("	 	check table field -> field exists done.")
		diffField(tableOld['fields'][key], tableNew['fields'][key], alters, key)
		if len(alters) > 0:
			return False, None
		# for alter in alters:
		# 	if alter['alterType'] != AT_COLUMN_LITE_TYPE or alter['alterType'] != AT_COLUMN_INDEX:
		# 		return False,None
		#print("	 	check table field -> field check done.")
	for key in tableNew['fields']:
		if not key in tableOld['fields']:
			return False,None
	return True, alters

def checkIfHasLowerTableName(newTable, oldTblName):
	for key in newTable.keys():
		if key.lower() == oldTblName:
			return True, key
	return False, oldTblName

def diff(old, new):
	temps = {
		"drops":[],
		"creates":[]
	}
	delta = {
		"drops":[],
		"creates":{},
		"alters":{}
	}
	for tableName, tableDefine in old.items():
		#print("diff1 -> ", tableName)
		same, tn = checkIfHasLowerTableName(new, tableName)
		#print("diff2 -> ", same, tn)
		if not same:
			temps['drops'].append(tn)
			delta['drops'].append(tn)
		else:
			diffOnTable = diffTable(old[tableName], new[tn], tn)
			if diffOnTable != []:
				delta['alters'][tn] = diffOnTable
	for tableName, tableDefine in new.items():
		if tableName.lower() not in old:
			temps['creates'].append(tableName)
			delta['creates'][tableName] = tableDefine

	#print(" check -> ", temps)
	#print(" check -> ", delta) 
	#print('\n'*3)
	
	for toDrop in temps['drops']:
		for index, toCreate in enumerate(temps['creates']):
			if checkSimilarTable(toDrop, toCreate):
				#print(toDrop ,toCreate)
				#print(old.keys())
				#print(new.keys())
				same, dt = isSameTable(old[toDrop], new[toCreate])
				if same :
					del temps['creates'][index]
					del delta['creates'][toCreate]
					delta['drops'].remove(toDrop)
					delta['alters'][toDrop] = [
						{
							'alterType':AT_TABLE_NAME,
							'value':toCreate
						}
					]
					delta['alters'][toDrop].extend(dt)
					break

	#print(" check -> ", delta)

	return delta
