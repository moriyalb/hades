# <font color=#459977 size=10>Hades 开发说明</font>

<!-- 全角空格"  " -->

<!-- 
1. 项目的初始化，首次新建项目，可是用Hades/tools/hades_creator自动初始化项目结构  
2. 工程路径  
	/Configs 存放配置信息（自动导出)
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

-->