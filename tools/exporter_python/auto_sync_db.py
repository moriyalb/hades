import MySQLdb
import simplejson as json
import sys, os
import uuid
from datetime import datetime
from sync_orm import *

sql_to_executes = []

is_new_create = False

def _fromType(sqlType):
	if 'tiny' in sqlType:
		if 'unsigned' in sqlType:
			return 'utiny'
		else:
			return 'tiny'
	elif 'small' in sqlType:
		if 'unsigned' in sqlType:
			return 'usmall'
		else:
			return 'small'
	elif 'int' in sqlType:
		if 'unsigned' in sqlType:
			return 'uint'
		else:
			return 'int'
	elif 'varchar' in sqlType:
		size = sqlType[:-1].split("(")[1]
		return "string:"+size
	elif 'decimal' in sqlType:
		return 'float'
	elif 'blob' in sqlType:
		return 'blob'
		
def _fromIndex(sqlIndex):
	if sqlIndex == "UNI":
		return INDEX_UNIQUE
	elif sqlIndex == "MUL":
		return INDEX_INDEX
	else:
		return INDEX_NONE

		
def connectMysql(dbCfg):
	conn = MySQLdb.connect(host=dbCfg['host'], user=dbCfg['user'], passwd=dbCfg['password'], port=dbCfg['port'])
	return conn.cursor()

def useDatabase(cursor, dbName):
	try:
		cursor.execute("use %s" % (dbName))
	except:
		global is_new_create
		is_new_create = True
		cursor.execute("create database %s default character set utf8 collate utf8_general_ci" % (dbName))
		cursor.execute("use %s" % (dbName))

def loadTableConfigFromDB(cursor, tableName):
	cursor.execute("desc %s" % (tableName))
	cfg = {
		"fields":{},
		"primary":[]
	}
	#print(cursor.fetchall())
	for fname, ftype, _, findex, _, _ in cursor.fetchall():
		if fname == "_id":continue
		if findex == "PRI":
			cfg['primary'].append(fname)
		cfg['fields'][fname] = {
			"type":_fromType(ftype),
			"index":_fromIndex(findex)
		}
	return cfg

def genCursor(dbCfg):
	cursor = connectMysql(dbCfg)
	useDatabase(cursor, dbCfg['database'])
	return cursor

def fetchCurrent(serverPath, cursor):
	old = {}
	cursor.execute("show tables")
	for tbl in cursor.fetchall():
		cfg = loadTableConfigFromDB(cursor, tbl[0])
		old[tbl[0]] = cfg

	new = {}
	with open(serverPath + "/Orm/OrmModel.json","r") as f:
		new = json.loads(f.read())

	return new, old

	
def execute(cursor):
	if len(sql_to_executes) == 0:
		print("Database Configure Is Not Changed ! ")
		return

	for sqlType, sql, tableName in sql_to_executes:
		print("Sql Statements Start ===================================== ")
		print(sql)
		print("Sql Statements End ===================================== ")
		try:
			res = cursor.execute(sql)
		except Exception as e:
			print("Execute Error -> ", e)
			return
			
		if sqlType == "create":
			if res != 0:
				print("Failed create table -> ", cfg[''])
			else:
				cursor.execute("desc {tn}".format(tn = tableName))
				print("Create Table {tname} Success".format(tname = tableName))
				print("    ========================= ========================= =========================")
				print("    |         Name           |            Type         |          Index         |")
				print("    ========================= ========================= =========================")
				for fname, ftype, _, findex, _, _ in cursor.fetchall():
					print("    |%20s    |%20s     |%20s    |"%(fname, ftype, findex))
				print("    ========================= ========================= =========================")
		elif sqlType == "delete":
			if res != 0:
				print("Failed drop table -> ", tableName)
			else:
				print("Drop Table {tname} Success".format(tname = tableName))
		elif sqlType == "alter":
			if res != 0:
				print("Failed alter table -> ", tableName)
			else:
				print("Alter Table {tname} Success".format(tname = tableName))
				#cursor.execute("desc {tn}".format(tn = tableName))
				#newCols = cursor.fetchall()
				#print("    ========================= ========================= =========================")

def genDateId():
	s = datetime.now().strftime("%Y_%m_%d_%H_%M_%S")
	return s + "_" + str(uuid.uuid4()).split("-")[-1]


if __name__ == "__main__":	
	ServerConfigPath = sys.argv[1]
	dbCfgs = None
	with open(ServerConfigPath + "/Server/Mysql.json","r") as f:
		dbCfgs = json.loads(f.read())

	for key in dbCfgs['logic'].keys():
		sql_to_executes = []
		cfg = dbCfgs['logic'][key]
		cursor = genCursor(cfg)
		new, old = fetchCurrent(ServerConfigPath, cursor)
		sync(new, old, sql_to_executes)
			
		epath = ServerConfigPath + "/Server/SqlStatements"
		if not os.path.exists(epath):
			os.makedirs(epath)
		did = genDateId()
		if is_new_create:
			tag = "/OrmCreates_" + key + "_"
		else:
			tag = "/OrmAlters_" + key + "_"
		with open(epath + tag + did + ".sql", "w") as f:
			f.write(";\n\n".join([sql[1] for sql in sql_to_executes]))

		if sys.argv[2]:
			execute(cursor)

		cursor.close()
	
	