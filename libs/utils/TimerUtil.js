"use strict"

/**
 *@author:mario 2014-2-25
 * timer模块
 */

var SECOND = 1000
const _ = require("lodash")

var Timer = function () {
	this.timerMap = []
}
var itp = Timer.prototype

const Warning = _.once(()=>{
	console.error("Hades.TimerUtil module is deprecated. use setTimeout/setInterval instead.")
})


itp.addTimer = function (timerID, start, interval, cb, args, force) {
	Warning()
	var self = this

	if (!!force && force && self.hasTimer(timerID)) {
		self.delTimer(timerID)
	}
	if (self.hasTimer(timerID)) {
		return
	}
	if (!args) {
		args = null
	}

	start *= SECOND
	interval *= SECOND

	if (interval == 0) {
		self.timerMap[timerID] = {
			id: setTimeout(function () {
				self.onTimeOut(timerID)
			}, start),
			args: args,
			callback: cb,
			clearFunc: clearTimeout
		}
	} else if (start == 0) {
		self.timerMap[timerID] = {
			id: setInterval(function () {
				self.onInterval(timerID)
			}, interval),
			args: args,
			callback: cb,
			clearFunc: clearInterval
		}
	} else {
		self.timerMap[timerID] = {
			id: setTimeout(function () {
				self.onIntervalStart(timerID)
			}, start),
			args: args,
			interval: interval,
			callback: cb,
			clearFunc: clearTimeout
		}
	}
}

itp.delTimer = function (timerID) {
	Warning()
	var self = this

	if (!self.hasTimer(timerID)) {
		return
	}

	var td = self.timerMap[timerID]
	td.clearFunc(td.id)
	delete self.timerMap[timerID]
}

itp.hasTimer = function (timerID) {
	Warning()
	var self = this

	return timerID in self.timerMap
}

itp.onIntervalStart = function (timerID) {
	Warning()
	var self = this

	var timerData = self.timerMap[timerID]
	timerData.id = setInterval(function () {
		self.onInterval(timerID)
	}, timerData.interval)
	timerData.clearFunc = clearInterval
	timerData.callback.apply(self, timerData.args)
}

itp.onTimeOut = function (timerID) {
	Warning()
	var self = this

	var timerData = self.timerMap[timerID]
	timerData.callback.apply(self, timerData.args)
	delete self.timerMap[timerID]
}

itp.onInterval = function (timerID) {
	Warning()
	var self = this

	var timerData = self.timerMap[timerID]
	timerData.callback.apply(self, timerData.args)
}

module.exports = new Timer()