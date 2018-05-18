"use strict"

const path = require("path")
const AppBase = path.dirname(require.main.filename)
const Timetool = require("../utils/Timetool")
const Hades = GlobalHades

let stripError = function(err){
	if (typeof(err) == "string"){
		return err
	}
	
	let stacks = err.stack.split("\n")
	console.error(stacks)
	
	let etype_details = stacks[0].split(":")
	let etype = etype_details.shift()
	let edetail = etype_details.join("")
	let [method, file] = stacks[1].split("(")
	method = method.replace("    at","").trim()
	file = file.replace(AppBase, "").replace(")","").trim()
	if (file[0] == "\\") file = file.substring(1)
	return `${file}:${method} -> ${etype} :: ${edetail}`
}


module.exports = function(err, msg, resp, session, cb){
	console.error("[error] -> ", stripError(err), "\n reqID = ", msg.reqMapId, "  resp=", resp)
	cb(null, [])
}