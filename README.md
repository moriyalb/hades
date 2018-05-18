<<<<<<< HEAD
# Hades ReadMe

## Hades架构基本说明
	通过对Pomelo项目的包装，提供更多的自动构建工具，将协议配置化并自动生成相关代码，开发者可以将更多的精力关注在具体业务逻辑上。
	> * Pomelo Homepage http://pomelo.netease.com/

## Hades 0.2 版本对0.1版本的改动

1. Defines的配置变化
1.1 修改Count配置为Type，其支持Proxy、Single和Simple三种类型
1.2 移除Route参数（Single类型的route机制将有Entity中的onRoute回调完成）
1.3 增加配置和导出脚本对utf-8编码的支持，现在可以任意使用中文注释
1.4 增加method参数的描述和null标记，如果配置为string则视作type，如果是一个array，则视为[type, desc, isNull]的描述
1.5 导出的Entities中ImpEntity也将拥有etype和server标签
1.6 导出脚本移植Hades框架内部（外部将只会设置少量配置即可），且做出了多client端的导出支持（目前暂时只实现了lua端）
1.7 导出脚本重构，使之更加易于重构和修改
1.8 Entity分类型导出固有方法，其中
	Proxy类型，将拥有onCreate, onLoad, onPrepare, onConnect, onDisconnect, onDestroy
	Single类型，将拥有onInit, onFini, onRoute
	Simple类型，将有用loadFromDB, saveToDB
	以上回调将根据不同的函数拥有不同的参数（而非统一的opts函数了）
	注意onPrepare的参数也被指定为clientInfo
1.9 Entity将根据类型来决定是否导出制定函数
	Proxy拥有handlers和remotes段
	Single只拥有remotes段
	Simple将配置函数支持（只能支持本地函数）
	客户端依然将只导出push方法和handlers的注释
1.10 移除LoginProxy中handle中bind字段，默认LoginProxy请求都是非绑定的，因此此LoginProxy所有的handler都将默认带入session参数

2. 服务器Lifecycle机制调整，移除无用的文件，将生命周期机制移到对应的SingleEntity中（onInit和onFini函数分别对应beforeStart和beforeShutdown）

3. Hades系统Entity被清晰勾勒，移除之前无用的ProxyMgr，系统Entity将拥有自身的配置（这份配置不能被解析，因此不能配置非系统类型），remote方法将被
	统一到跟其他的entity一致
	系统Entity的调用方法为
	Hades.SysLocal.[EntityName].[EntityMethod](args)
	Hades.SysRemote.[EntityName].[EntityMethod](serverId, args)

4. Single类型的Entity类似于系统Entity，自身属于服务器进程的（每个进程只存在一个同类型Entity），此种Entity的调用方法为
	Hades.Local.[EntityName].[EntityMethod](args)
	Hades.Remote.[EntityName].[EntityMethod](routeParam, args)
	其中routeParam和EntityName将被传到此Entity的onRoute方法（此方法要求返回一个serverId）

5. 玩家登陆现在由LoginMgr和PlayerMgr（SysEntity）负责，接管大部分session操作和默认的proxy初始化行为
	登陆流程的onCreate、onLoad、onConnect、onPrepare都自动调用（不像之前Hades模块会调用Project中的私有方法）
	离线时的onDisconnect也会被自动调用（其中会传入reason）

6. Hades结构的整理
6.1 所有外围模块只能引入Hades（不能再直接require其中任何的文件了）
6.2 所有对外开放的Hades功能都由core和manager等功能来指定
6.3 核心系统
	Hades.Config		核心配置
	Hades.Const			常量的配置，Project的相关文件可以基于此扩展
	Hades.Schema		核心Entity配置模块，下属以下子模块
		Hades.Schema.Types
		Hades.Schema.Methods
		Hades.Schema.Property
		Hades.Schema.Mailbox
		Hades.Schema.Entity
	Hades.Protocol		协议（可以外露协议底层接口给应用层，日后可以提供协议的覆盖或者二次开发能力）
	Hades.Logger		日志
	Hades.App			应用接口

6.4 Pomelo模块(此部分由pomelo内部使用)
	Hades.Pomelo		
	Hades.Monitor
	Hades.Amin
	Hades.Rpc

6.5 消息系统
	Hades.Message		负责消息封装和解析
	Hades.Local			本地Single类型Entity接口
	Hades.Remote		远程Single类型Entity接口
	Hades.SysLocal / SysRemote		系统自带Entity接口

6.6管理器
	Hades.RedisMgr		Redis管理器
	Hades.DataMgr		数据管理器(原ResourceMgr)
	Hades.CommunicateMgr通信模块，负责远端调用函数的处理和生命
	Hades.HookMgr		钩子管理，用于向Project提供注入方式

6.7 工具类 
	(移除DataUtil，此部分应该Project自身关心；移除DBUtil模块，此部分直接交给DataManager去关心； 移除Timer工具，使用系统自带时间工具+闭包足以)
	Hades.Util			基础工具模块（暂时无法分类的方法会移到这里）
	Hades.TimeUtil		时间工具
	Hades.ScheduleTool	日程工具
	Hades.RandUtil		随机数工具
	Hades.HttpUtil		网络连接工具
	Hades.CryptoUtil	加密模块
	Hades.ProfanityUtil	关键字过滤器

7. 修改了remote和push消息的参数格式，现在只接受object结构，移除了之前按照字母顺序调用的问题

8. 全面移除分号，所有Hades库代码使用无分号模式开发
	详情可以参考 
	JavaScript 语句后应该加分号么？ - 贺师俊的回答 - 知乎
	https://www.zhihu.com/question/20298345/answer/14670020

9. 修改了之前rpc中的proxy和handle的声明方式，不再从application层注入，直接调用Hades.CommunicteMgr中的接口即可

10. 修改了HadesServer中的configure函数，现将所有configure打包成一个数组传入（解决了之前配置函数可能位于start函数之后的尴尬）

11. 模块的修改
	HadesServer -> Hades.App
	HadesManagers -> 移除
	ProxyMgr  -> 移除
	ResourceMgr -> Hades.DataMgr
	HadesUtil -> 移除
	HadesRoute -> 移除
	EntityMgr -> 移除	
	schema模块
		decorator -> 移除
		其他模块层级提高（移除子文件夹）
		Schema -> Hades.Schema
	pomeloGlobal -> 移除
	pomelo模块
		pomelo-loader -> Hades.LoaderUtil
		pomelo-logger -> Hades.Logger
		pomelo-protocol -> Hades.Protocol
		pomelo-scheduler -> Hades.SchedulerUtil

12. 新增napi支持， 如果Hades部分系统如果遭遇CPU瓶颈，将考虑使用C++重构（例如Schema，但是0.2版本暂时不做此优化）

13. Property类型的包装，移除Proxy中的所有get方法

## Hades 框架说明

## Hades 开发教程
1. 项目的初始化，首次新建项目，可是用Hades/tools/hades_creator自动初始化项目结构
2. 工程路径
	/Configs 存放配置信息（自动导出）
		/Orm 存放数据相关配置
		/Schema 存放Entity元信息
		/Server 存放服务器进程相关配置
	/CustomConfigs 存放原始配置，
		/common 存放公共配置（例如log4js、admin等）
		/env 存放个人配置，此env即导表工具中的user
			Basic.json 配置项目基本信息
			Cluster.json 配置服务器基本信息
			Mysql.json 配置数据库
			Redis.json 配置缓存数据库
			SpecialAccount.json 配置黑白名单
	/Defines 存放Entity配置（此部分为开发逻辑最先编写的部分）
		单个文件以.def后缀的，则视作一个Entity（其中可以有多级子目录）
		__Alias.def为特殊的配置（配置公共类型信息）
		其中Define文件的配置格式为
		Abstact 表示此Entity会被其他Entity继承（因此不是真正的Entity）
		Server 配置该Entity所在的服务器类型（serverType，与Cluster.json是对应的）
			Entity将只会在配置的服务器类型上被创建，基于不同的类型有不同的获取方式
		Type 配置该Entity的类型
			single 表示此服务器进程中只存在单个实例
			proxy 表示为客户端代理类型
			simple 表示为简单Entity类型，仅支持创建和存库，一般的，可以视作临时Entity
		Properties 配置该Entity的所有属性（一般的，表示持久化属性， 对single类型无效）
		Handlers 配置该Entity的客户端请求方法（仅对proxy类型生效）
		Remotes 配置该Entity的服务器rpc请求方法（对simple类型无效）
		Pushes 配置该Entity的客户端推送方法（进队proxy类型生效）
		Implements 此Entity的父类Entity字典，字典的值表示父类的优先级，在调用系统方法的时候，按照优先级的排序异步调用
		Alias 类型别名（最终将会合并到__Alias中）

		其中方法的配置格式是一致的，req是必须的（表示请求的参数），resp是可选的（对push来说，resp无效）
		参数为字典类型，其顺序不重要（会在导出时根据字母顺序排序，以保证HadesUUID的稳定性）
		字典的key表示参数名，其值可以是
			字符串，此时配置的就是此参数的类型名（type）, 此配置下该参数强制不能传空值或者不传
			数组， 此时配置的是[类型名，参数描述，是否为空值]
		关于类型和类型名请详细参考后边的介绍

	/Entities Entity的逻辑脚本（自动导出，脚本文件会自动添加Method后缀，以兼容当前老项目）
		导出的脚本依据类型的不同，有不同的创建时机和回调
		注意此脚本的书写格式（不按照格式书写，可能会被自动导出逻辑覆盖）

3. app.js 
	此为项目入口函数，需要调用Hades.setProjectRoot来设置项目路径
	之后可以调用Hades.init来初始化工程，其参数配置如下
		name 工程名
		datumMd5 协议握手的MD5标志， 此表示讲和握手时客户端传来的值进行比对
		verifyDatumMd5 是否强制验证MD5，强制验证不匹配的话将禁止登陆
		debug 表示否则开启debug（此值可以由Hades.Config.isDebugging()来获取）
		timeout 表示请求的超时时间（默认10s）
		heartbeat 表示心跳间隔（默认15s）
		lag 表示服务器模拟网络延迟（默认0）

	接着可以调用Hades.App.configure来配置服务器进程，此函数接收一个配置数组（无需关注顺序）
	每个数组接收3个参数
		ClusterType 集群参数（可以使用Hades.Const.ClusterType来配置，区分Base、Unique集群）
		ServerType参数 数组类型， 可以指定服务器的类型（或者使用Const.ServerType.ALL 来配置所有， 此时无需使用数组）
		handler 具体的配置函数

	之后调用Hades.App.start来启动即可。 注意到app.js是单个服务器进程的接口

4. start.js 
	整个集群的启动接口，使用如下脚本来启动
	node start.js start -e env
	env即Configs/Server/servers.json中的env配置

	启动的进程有如下
	starter进程，无serverType、serverId等信息（仅为了启动master进程使用）
	master进程（注意到master也可能远程启动）
	server进程（基于配置信息，由master进程本地spawn或者远程ssh启动）

5. 测试逻辑接口
5.1 Handlers
	配置好的handler将在服务器脚本中//Hadlers注释端之后按函数一个一个出现，你可以指定的地方编写逻辑
	你可以使用this来指代本Entity, this.client来调用client（push）方法，为resp字段赋值即是本request的返回值
	示例

	handler的配置可能如下
	"changeNick":{
			"req":{
				"nick" :["string", "新昵称", false]
			},
			"resp":{
				"result": "Result"
			}
		}	

	注意到Result字段（他是个类型别名，一个枚举类型，其配置可能如下）
	"Alias":{
		"Result":{
			"ctype":"enum",
			"fields":{
				"SUCCESS",
				"FAIL"
			}
		}
	}

	async changeNick(nick) {
		let resp = {result : null}
		//====changeNick start===================================================================
		if (!checkNick(nick)){
			resp.result = Hades.Schema.Types.Enum.Result.FAIL
			return resp
		}
		this.nick = nick //this will be auto saved
		resp.result = Hades.Schema.Types.Enum.Result.SUCCESS
		//====changeNick end=====================================================================
		return resp
	}

	注意到如果handler不配置resp字段的话，此方法默认成为一个notify方法（客户端将不使用request来请求，而使用notify来请求）

5.2 Remotes
	Remotes方法表示Entity在不同的服务器之间的相互调用，此部分调用需要配置到define文件中去
	配置好的remotes导出后的函数和handler基本一致，这里不在详细说明
	唯一需要注意的是，remotes方法中的参数可以有mailbox类型（实际上entity.client也是一种特殊的mailbox）
	mailbox参数在消息通信中会自动序列化和反序列化（而且entity类型也可以被退化成mailbox类型）

	参数中的mailbox仅支持proxy类型entity，single类型的请使用Hades.Remote或者Hades.SysRemote来调用

	//some entity logic
	otherEntityMB.remoteMethod(this) 	//this将在传递过程中由entity类型退化为mailbox数据

	//other entity
	remoteMethod(args){
		let {entityMB} = args			//接收到的参数将自动将mailbox数据反序列化成mailbox实例
		entityMB.otherRemoteMethod()
		entityMB.client.clientPushMethod()
		...
	}

	注意到Hades.Remote和Hades.SysRemote也是mailbox类型

	Remtoes中的map类型参数将自动退化成object

5.3 Pushes
	entity可以直接使用 entity.client 来向客户端推送消息
	proxy mailbox也可以使用 mailbox.client 来向客户端推送消息
	push消息不支持resp方法

5.4 Properties的自动缓存和持久化
	对entity的property使用Proxy机制进行包装（在赋值时刻）
	任何新增的赋值都将被截获并用于判断此属性是否被修改， Hades的dms模块将自动同步数据库来保证数据的持久化

6. Hades Type系统介绍

7. Hades Logger配置

8. Hades Util模块介绍

9. Hades RedisMgr介绍

10. Hades DMS介绍

11. Hades tools工具集介绍



=======
# hades
一个基于配置的可扩展服务器解决方案，帮助开发者快速搭建一个后端服务器原型，可以应用于游戏服务器或应用服务器；使用Tcp和Websocket协议， 应用层协议使用MsgPack，但开发者无需关心协议细节。 只需关注业务逻辑。
# HadesServer 
包含所有的Hades服务端源代码

# HadesClient
一个C++的客户端实现，可以直接挂接到Unity或者Cocos的客户端上，也可以给予参考，并给出其他平台的实现。具体协议介绍请参考Documents

# HadesTools
一些常用的工具，例如配置导出工具，服务器模板脚手架工具等，帮助开发者快速搭建原型
>>>>>>> c7fd99c06c942eb00f1070c061a2ecee0dba7438
