# Hades Changelog

<!--lint disable maximum-line-length-->

# Table of Contents


<a id="0.2"></a>
## 2018-06-01, Version 0.2 (Current)

### Notable Changes

* **Defines配置**:
  - 修改了Entity基本类型(Proxy, Single, Simple), 移除原有Count字段，修改为Type字段
  - 移除Route参数
  - 增加配置和导出脚本对utf-8编码的支持，现在可以任意使用中文注释
  - 修改方法（Method）参数的配置方式，使用数组配置时，支持Desc（描述字段）和Null（非空字段）的配置
  - 移除Single类型Entity的Property配置
  - 移除Simple类型Entity的Method配置
  - 移除LoginProxy中handlers的bind字段配置（强制为true）
  - 增加了udo参数类型


* **导出脚本**:
  - 多客户端配置导出支持
  - 导出脚本重构，使之更加易于重构和修改
  - 移除Entity导出文件（仅保留Method）
  - 移除Client端的非Proxy Entity
  - Immanent函数将根据Entity类型进行区分，如下
   
| EntityType          | Immanent Functions | Desc                                                       |
| :-----------------: | :----------------: | :--------------------------------------------------------: |
| Simple              | onCreate           | When this entity is created                                |
| Simple              | onLoad             | When this entity is created from database                  |
| Simple              | onSave             | When this entity is saved to database                      |
| -                   | -                  | -                                                          |
| Single              | onInit             | When the server start                                      |
| Single              | onFini             | When the server shutdown                                   |
| Single              | onCreate           | Route function. this method should return a valid serverId |
| -                   | -                  | -                                                          |
| Proxy               | onCreate           | When this entity is first created in database              |
| Proxy               | onLoad             | When this entity is loaded                                 |
| Proxy               | onPrepare          | Make this entity info                                      |
| Proxy               | onConnect          | When this entity connected                                 |
| Proxy               | onDisconnect       | When this entity disconnected                              |
| Proxy               | onDestroy          | When this entity destroyed                                 |
| -                   | -                  | -                                                          |
| LoginProxy(Special) | onCreate           | When this entity is created                                |
  
* **Lifecyle机制**:
  - 移除原lifecyle文件，为SingleEntity提供生命周期
  - 提供HOOK_ON_SERVER_STARTUP, HOOK_ON_SERVER_SHUTDOWN异步事件

* **Route路由机制**:
  - 移除Route参数
  - 为Single ENtity提供onRoute回调函数
  - 提供默认的路由函数（基于随机性）
  - 自动路由bb_proxy

* **系统Entity**:
  - 提供了LoginMgr（前端）和PlayerMgr（后端）
  - 支持原生的Entity配置（此配置不导出，由Schema库直接解析）

* **Mailbox通信机制**:
  - 系统Entity使用如下方式
	```javascript
		Hades.SysLocal.[EntityName].[EntityMethod](args)
		Hades.SysRemote.[EntityName].[EntityMethod](serverId, args)
	```
  - SingleEntity使用如下方式
	```javascript
		Hades.Local.[EntityName].[EntityMethod](args)
		Hades.Remote.[EntityName].[EntityMethod](routeParam, args)
	```

* **Hades结构调整**:
  - 移除了全局Pomelo依赖
  - 完善了启动流程和相关依赖
  - 调整的文件层级依赖，增加未来对npai扩展的支持	
  - 新框架说明请参考 [Hades架构说明.md](HadesFramework.md)

* **Message消息**:
  - 调整Remote和Push接口的参数格式，和request、response统一为object类型，消除参数传递顺序问题
  - 自动检查参数合法性
  - 自动序列化和反序列化mailbox类型

* **代码风格**:
  - 全面移除框架内代码的分号
  - 尽量统一使用class风格的代码
  - 全部文件都在严格模式下

* **Rpc通信**:
  - 通过Hades.CommunicateMgr来提供Rpc方法的封装，不再注入到启动流程和opts参数
  - 与Mailbox一起完成了client和server端rpc方法的封装

* **Schema模块**:
  - 重构了Schema模块中关于Types、Property包装器、Entity包装器的写法
  - Property基于原生数据类型，基本做到开发者感觉不到的程度

* **DMS模块**:
  - 重构了基本的更新算法，提升性能，降低临时对象的创建


<a id="0.2"></a>
## 2018-02-10, Version 0.1

* **Define配置系统**:
  - 支持配置Define文件，自动导出Entity，以此作为基本单位完成逻辑通信、数据存储

* **自动导出工具**:
  - 支持服务器配置的导出
  - 支持Entity配置和脚本的导出
  - 支持数据库同步脚本的导出
  - 支持数据库自动通

* **Schema模块**:
  - 类型系统，支持基本类型和复杂类型，覆盖大部分逻辑需求场景
  - 自动包装Entity属性，监控其值的变化，并发送给DMS系统进行自动同步

* **Managers模块**:
  - EntityMgr和ProxyMgr，负责管理Entity的生命周期和创建
  - RedisMgr负责缓存管理
  - ResrouceMgr负责DMS消息处理和分发

* **DMS系统**:
  - Redis缓存自动同步
  - Mysql通过脏数据服务器自动同步

* **Pomelo整合**:
  - 重新定制PomeloProtocol，通过配置来匹配协议
  - 加入MsgPack
  - 定制了Pomelo的相关流程，注入Rpc等外围接口使其正常工作
  - 定制了Cluster集群，可以无缝在多个集群之间进行Rpc调用

