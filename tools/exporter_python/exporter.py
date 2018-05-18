import getopt
import sys
import os
import schema
import server
import orm

CLIENT_TYPE = {
	'--client_lua_path' 	: "lua",
	'--client_cs_path' 		: "cs",
	'--client_cpp_path' 	: "cpp",
	'--client_js_path' 		: "js",
	'--client_python_path' 	: "python",
}

def export():
	opts, args = getopt.getopt(sys.argv[1:], '-h-u:', ['help', 
		'server_path=', 
		'client_lua_path=', 'client_cs_path=', 'client_cpp_path=', 'client_js_path=', 'client_python_path=', 
		'user='])

	user = None
	exportClient = {}
	exportServer = None
	for tag, value in opts:
		if tag in ('-h', '--help'):
			print('''
--server_path 表示服务器项目路径（内含Defines、Entities、Configs、CustomConfigs等文件夹）
--client_lua_path 表示客户端Lua导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的lua客户端脚本）
--client_cs_path 表示客户端C#导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的C#客户端脚本）
--client_cpp_path 表示客户端C++导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的C++客户端脚本）
--client_js_path 表示客户端js导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的js客户端脚本）
--client_python_path 表示客户端js导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的python客户端脚本）
--user(-u) 表示服务器用户环境（不指定用户将无法导出服务器相关配置）
--help(-h) 显示帮助信息''')
			exit()
		if tag in ('-u','--user'):
			user = value
		if tag == '--server_path':
			exportServer = value
		if tag in CLIENT_TYPE:
			exportClient[CLIENT_TYPE[tag]] = value		

	if not exportServer:
		print("Error in Exporter : no server_path -> ")
		return
	elif not os.path.exists(exportServer):
		print("Error in Exporter : invalid server_path -> ", exportServer)
		return

	if not user:
		print("== Please set your user name in preference.bat ==")
		print("== set USER=mario ==")
		print("The user name settings exists at Server/Project/CustomConfigs")
		return
	else:
		cfgPath = exportServer + "/CustomConfigs/" + user
		if not os.path.exists(cfgPath):
			print("Error in Exporter : invalid user -> ", user)
			return

	for ctype, cpath in exportClient.items():
		if not os.path.exists(cpath):
			print("Error in Exporter : invalid client_path -> ", ctype, cpath)

	define_path = exportServer + "/Defines"
	schemaCfg = schema.load(define_path)

	cfgPath = exportServer + "/CustomConfigs/" + user
	serverCfg = server.load(cfgPath)

	exportCfgPath = exportServer + "/Configs"
	exportSchemaPath = exportCfgPath + "/Schema"
	exportServerPath = exportCfgPath + "/Server"
	exportOrmPath = exportCfgPath + "/Orm"

	schema.write(schemaCfg, exportSchemaPath)
	server.write(serverCfg, exportServerPath)
	orm.write(schemaCfg, exportOrmPath)

	exportServerScriptPath = exportServer + "/Entities"
	ss = __import__('server_js', globals(), locals(), [], 0)
	ss.write(schemaCfg, exportServerScriptPath)
	for ctype, cpath in exportClient.items():
		sc = None
		try:
			sc = __import__('client_' + ctype, globals(), locals(), [], 0)			
		except Exception as e:
			print("Exporter don't support the client script now. -> ", ctype)
		if sc:
			sc.writeCfg(schemaCfg, cpath + "/ProxyDefine")
			sc.writeScript(schemaCfg, cpath + "/Proxy")

if __name__ == "__main__":
	#try:
		export()
	#except Exception as e:
	#	print("Error in exporter -> ", e)