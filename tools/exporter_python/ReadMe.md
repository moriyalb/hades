Hades自动导出工具（Python版本）

1. python仅支持python3.x（推荐Python3.5及以上）
2. 请在外部调用按如下方式调用脚本
python exporter.py [args]

3. 需要配置的参数如下
--server_path 表示服务器项目路径（内含Defines、Entities、Configs、CustomConfigs等文件夹）
--client_lua_path 表示客户端Lua导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的lua客户端脚本）
--client_cs_path 表示客户端C#导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的C#客户端脚本）
--client_cpp_path 表示客户端C++导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的C++客户端脚本）
--client_js_path 表示客户端js导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的js客户端脚本）
--client_python_path 表示客户端js导出路径（内含Proxy、ProxyDefine文件夹，此路径将放置导出的python客户端脚本）
--user 表示服务器用户环境（不指定用户将无法导出服务器相关配置）
--auto_sync_cb 配置为1的话，表示将会自动将相关配置同步到配置中的mysql（否则仅生成增量sql文件）
--help 显示帮助信息

4. 导出后
