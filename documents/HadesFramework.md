# <font color=#459977 size=10> Hades 框架说明</font>

<!-- 全角空格"  " -->

# <font color=#668855 size=5>Hades框架结构</font>
> 所有外围模块只能引入Hades（不能再直接require其中任何的文件了）  
> 所有对外开放的Hades功能都由core和manager等功能来指定

## <font color=#00a99e>核心系统</font>

   | Module         | Desc                                                                         |
   | :------------- | :--------------------------------------------------------------------------- |
   | Hades.Config   | 核心配置                                                                     |
   | Hades.Const    | 常量的配置，Project的相关文件可以基于此扩展                                  |
   | Hades.Schema   | 核心Entity配置模块                                           |
   | Hades.Schema.Types      | 类型系统                                                   |
   | Hades.Schema.Property   | 属性包装器                                                  |
   | Hades.Schema.Mailbox    | 远端Entity通信接口包装器                                         |
   | Hades.Schema.Entity     | Entity工厂                           |
   | Hades.Protocol | 协议（可以外露协议底层接口给应用层，日后可以提供协议的覆盖或者二次开发能力） |
   | Hades.Logger   | 日志                                                                         |
   | Hades.App      | 应用接口                                                                     |
   | Hades.Datum    | 数据配置封装，数据使用immutable机制保护起来                                  |
   | Hades.Event    | 事件接口，支持异步事件                                                       |
   | Hades.Hotfix   | 热更新模块，被调用后会自动更新配置、脚本以及触发更新事件                     |
	
## <font color=#00a99e>Pomelo模块(此部分由pomelo内部使用)</font>

   | Module        | Desc |
   | :------------ | :--- |
   | Hades.Pomelo  |      |
   | Hades.Monitor |      |
   | Hades.Amin    |      |
   | Hades.Rpc     |      |


## <font color=#00a99e>消息系统</font>

   | Module                     | Desc                     |
   | :------------------------- | :----------------------- |
   | Hades.Message              | 负责消息封装和解析       |
   | Hades.Local                | 本地Single类型Entity接口 |
   | Hades.Remote               | 远程Single类型Entity接口 |
   | Hades.SysLocal / SysRemote | 系统自带Entity接口       |


## <font color=#00a99e>管理器</font>

   | Module               | Desc                                             |
   | :------------------- | :----------------------------------------------- |
   | Hades.RedisMgr       | Redis管理器                                      |
   | Hades.DataMgr        | 数据管理器(原ResourceMgr)                        |
   | Hades.CommunicateMgr | 通信模块，负责远端调用函数的处理和声明           |
   | Hades.LifycycleMgr   | 生命周期模块，负责系统启动和关闭的事件触发和处理 |
	

## <font color=#00a99e>工具类</font> 

   | Module              | Desc                                         |
   | :------------------ | :------------------------------------------- |
   | Hades.Util          | 基础工具模块（暂时无法分类的方法会移到这里） |
   | Hades.TimeUtil      | 时间工具                                     |
   | Hades.ScheduleTool  | 日程工具                                     |
   | Hades.RandomUtil    | 随机数工具                                   |
   | Hades.HttpUtil      | 网络连接工具                                 |
   | Hades.CryptoUtil    | 加密模块                                     |
   | Hades.ProfanityUtil | 关键字过滤器                                 |

# <font color=#668855 size=5>Hades工程结构</font>
## <font color=#668855 size=4>Hades的目录结构</font>
* **/bin** 用于编译后的Hades二进制（提升性能使用）
* **/clients** 提供各个Client的库支持
* **/docuemtns** 文档
* **/libs** 源码
	* **/libs/core** Hades 核心框架
	* **/libs/manangers** Hades 框架管理器、
	* **/libs/entity** Hades 系统Entity
	* **/libs/pomelo** Pomelo 基础框架
	* **/libs/schema** Hades Entity协议支持模块
	* **/libs/dms** Hades 数据服务模块
	* **/libs/utils** Hades 工具代码
* **/src** C++源码
* **/test** 测试代码
* **/tools** 工具集
* **/Hades.js** 框架入口

## <font color=#668855 size=4>HadesProject的目录结构</font>
* **/CustomConfigs** 用户配置入口（多env环境）
	* **/CustomConfigs/common** 存放公共配置（例如log4js、admin等）
	* **/CustomConfigs/[env]** 存放个人配置，此env即导表工具中的user
		* **Basic.json** 配置项目基本信息
		* **Cluster.json** 配置服务器基本信息
		* **Mysql.json** 配置数据库
		* **Redis.json** 配置缓存数据库
		* **SpecialAccount.json** 配置黑白名单
* **/Configs** 用户配置导出后的接口（单env环境）
* **/Defines** 工程所有的Entity配置文件入口
* **/Entities** 工程所有的Entity脚本文件入口（自动导出+手动逻辑添加）
* **/Scripts 工程的脚本工具
* **/node_modules** npm依赖库
* **/package.json** 工程配置
* **/starter.js** 工程启动入口脚本
* **/app.js** 单进程启动入口（逻辑入口）
* **others** 其他的工程定制化文件

# <font color=#668855 size=5>Hades的目录结构</font>
