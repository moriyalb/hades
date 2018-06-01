"use strict"

const Const = module.exports

Const.GUID_BASE = 10000

Const.DefineSuffix = ".def"

Const.RedisType = {
	RT_CLUSTER_PERSISTENT: Symbol(),
	RT_CLUSTER_CACHE: Symbol(),
	RT_PROJECT_CACHE: Symbol()
}

Const.RedisConfig = {
	[Const.RedisType.RT_CLUSTER_PERSISTENT] : 	"ClusterPersistent",
	[Const.RedisType.RT_CLUSTER_CACHE] : 		"ClusterCache",
	[Const.RedisType.RT_PROJECT_CACHE] : 		"ProjectCache"
}

Const.RedisKey = {
	GUID: "IncrementalGuid",
	FrontendID: "FrontendID",
	BackendID: "BackendID",
	SessionID: "SessionID",
	OfflineTime: "OfflineTime", //0 means online,
	ENV: "Environment",
	Mirror: "Mirror:",
	Nick: "Nick:"
}

Const.ClusterType = {
	Base : "Base",
	Unique : "Unique",
	All : Symbol()
}

Const.ServerType = {
	All : [],
	Master : "master",
}

Const.ServerCache = {
    Time : 1800 * 1000
}

Const.EntityType = {
	Proxy : 0,
	Single : 1,
	Simple : 2
}
