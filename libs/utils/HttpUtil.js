"use strict"

const _ = require("lodash")
const http = require("http")
const util = require("util")

const RESPONSE_SUCCESS_CODE = 200
const TIMEOUT = 30 * 1000

function httpRequest(options, setting) {
	return new Promise((resolve, reject)=>{
		let timer
		let result
		let req = http.request(options, function (res) {
			if (res.statusCode != RESPONSE_SUCCESS_CODE) {
				console.error('STATUS: ' + res.statusCode)
				console.error('HEADERS: ' + JSON.stringify(res.headers))
				clearTimeout(timer)
				reject(new Error(`HttpRequest Failed ${res.statusCode}`))
			}

			res.setEncoding('utf8')

			res.on('data', function onData(data) {
				if (data instanceof Buffer) {
					result = result || Buffer.alloc(0)
					result = Buffer.concat([result, data], result.length + data.length)
				} else {
					result = result || ""
					result += data
				}
			})

			res.on('end', function () {
				clearTimeout(timer)
				resolve(result)			
			})

			res.on('close',function () {
				clearTimeout(timer)
			})
		})

		req.on('error', function (err) {
			console.error(`httpRequest::Error -> ${err}`)
			clearTimeout(timer)
			reject(new Error(`HttpRequest Error ${err}`))		
		})

		timer = setTimeout(function () {
			req.abort()
			reject(new Error(`httpRequest::Timeout -> ${JSON.stringify(options)}`))
		}, TIMEOUT)
	
		if (!_.isNil(setting)){
			setting(req)
		}
		
		req.end()
	})   
}

function httpsRequest(){
	//TODO
}

module.exports = {
	httpRequest,
	httpsRequest
}
