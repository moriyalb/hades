"use strict"

const crypto = require("crypto")
const _ = require("lodash")

class  Crypto {
	constructor(){

	}

	encryptDes(src, key){
		let c =  crypto.createCipher("aes-128-ecb", key, key)
		let enc = c.update(src, "utf8", "hex")
		return enc + c.final("hex")
	}

	decryptDes(src, key){
		let d = crypto.createDecipher("aes-128-ecb", key, key)
		let dec = d.update(src, "hex", "utf8")
		return enc + d.final("utf8")
	}

	md5(value) { 
		let md5 = crypto.createHash('md5')
		md5.update(value)
		return md5.digest('hex')
	}
}

module.exports = new Crypto()
