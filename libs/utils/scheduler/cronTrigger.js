"use strict"

/**
 * This is the trigger used to decode the cronTimer and calculate the next excution time of the cron Trigger.
 */

 const TimeCron = require("./TimeCron")

/**
 * The constructor of the CronTrigger
 * @param trigger The trigger str used to build the cronTrigger instance
 */
var CronTrigger = function (trigger, job) {
	this.cronTrigger = TimeCron.decodeCron(trigger)
	//Debug.error("CronTrigger ", JSON.stringify(this.cronTrigger))
	this.nextTime = TimeCron.nextExcuteTime(this.cronTrigger, Date.now())
	//Debug.error("CronTrigger ", JSON.stringify(this.nextTime))
	this.job = job
}

var pro = CronTrigger.prototype

/**
 * Get the current excuteTime of trigger
 */
pro.excuteTime = function () {
	return this.nextTime || -1
}

/**
 * Get the current time of trigger.
 * The given trigger must be unqiue.
 */
pro.timeTag = function () {
	var self = this
	var checkInvalid = function (v) {
		if (typeof (v) == 'object' && v instanceof Array)
			return v.length > 1
		if (v == -1)
			return true
		return false
	}
	for (var i = 0; i < 7; ++i) {
		//console.log("self.cronTrigger[i] " , self.cronTrigger[i])
		if (checkInvalid(self.cronTrigger[i])) return -1
	}
	var date = new Date()
	date.setYear(self.cronTrigger[YEAR])
	date.setMonth(self.cronTrigger[MONTH])
	date.setDate(self.cronTrigger[DOM])
	date.setHours(self.cronTrigger[HOUR])
	date.setMinutes(self.cronTrigger[MIN])
	date.setSeconds(self.cronTrigger[SECOND])

	return parseInt(date.getTime() / 1000)
}

pro.nextExcuteTime = function () {
	this.nextTime = TimeCron.nextExcuteTime(this.cronTrigger, this.nextTime)
	return this.nextTime
}

/**
 * Create cronTrigger
 * @param trigger The Cron Trigger string
 * @return The Cron trigger
 */
function createTrigger(trigger, job) {
	return new CronTrigger(trigger, job)
}

module.exports.createTrigger = createTrigger