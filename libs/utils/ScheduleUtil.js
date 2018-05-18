"use strict"

const MAX_YEAR = 2099;
const Limit = [
	[0, 59],
	[0, 59],
	[0, 24],
	[1, 31],
	[0, 11],	
	[0, 6],
	[2010, MAX_YEAR]
];

class TimeCron {
	constructor(){
		this.SECOND = 0
		this.MIN = 1
		this.HOUR = 2
		this.DOM = 3
		this.MONTH = 4
		this.DOW = 5
		this.YEAR = 6
		this.MAX_YEAR = MAX_YEAR
	}

	/**
	 * Decude the cronTrigger string to arrays
	 * @param cronTimeStr The cronTimeStr need to decode, like "0 12 * * * 3"
	 * @return The array to represent the cronTimer
	 */
	decodeCron(cronTimeStr){
		cronTimeStr = cronTimeStr.trim()
		let cronTimes = cronTimeStr.split(/\s+/)
	
		if (cronTimes.length == 6) {
			cronTimes.push("*")
		}
		if (cronTimes.length != 7) {
			console.error('Error in decodeCron -> ', cron)
			return null
		}
	
		for (let i = 0; i < cronTimes.length; i++) {
			cronTimes[i] = (this.decodeTimeStr(cronTimes[i], i))
	
			if (!this.checkNum(cronTimes[i], Limit[i][0], Limit[i][1])) {
				console.error('Decode crontime error, value exceed limit!' +
					JSON.stringify({
						cronTime: cronTimes[i],
						limit: Limit[i]
					}));
				return null;
			}
		}
	
		return cronTimes;
	}
	
	/**
	 * Decode the cron Time string
	 * @param timeStr The cron time string, like: 1,2 or 1-3
	 * @return A sorted array, like [1,2,3]
	 */
	decodeTimeStr(timeStr, type) {
		var result = {};
		var arr = [];
	
		if (timeStr == '*') {
			return -1;
		} else if (timeStr.search(',') > 0) {
			var timeArr = timeStr.split(',');
			for (var i = 0; i < timeArr.length; i++) {
				var time = timeArr[i];
				if (time.match(/^\d+-\d+$/)) {
					this.decodeRangeTime(result, time);
				} else if (time.match(/^\d+\/\d+/)) {
					this.decodePeriodTime(result, time, type);
				} else if (!isNaN(time)) {
					var num = Number(time);
					result[num] = num;
				} else
					return null;
			}
		} else if (timeStr.match(/^\d+-\d+$/)) {
			this.decodeRangeTime(result, timeStr);
		} else if (timeStr.match(/^\d+\/\d+/)) {
			this.decodePeriodTime(result, timeStr, type);
		} else if (!isNaN(timeStr)) {
			var num = Number(timeStr);
			result[num] = num;
		} else {
			return null;
		}
	
		for (var key in result) {
			arr.push(result[key]);
		}
	
		arr.sort(function (a, b) {
			return a - b;
		});
	
		return arr;
	}


	/**
	 * Decode time range
	 * @param map The decode map
	 * @param timeStr The range string, like 2-5
	 */
	decodeRangeTime(map, timeStr) {
		var times = timeStr.split('-');

		times[0] = Number(times[0]);
		times[1] = Number(times[1]);
		if (times[0] > times[1]) {
			console.error("Error time range");
			return null;
		}

		for (var i = times[0]; i <= times[1]; i++) {
			map[i] = i;
		}
	}

	/**
	 * Compute the period timer
	 */
	decodePeriodTime(map, timeStr, type) {
		var times = timeStr.split('/');
		var min = Limit[type][0];
		var max = Limit[type][1];

		var remind = Number(times[0]);
		var period = Number(times[1]);

		if (period == 0)
			return;

		for (var i = min; i <= max; i++) {
			if (i >= remind && (i-remind) % period == 0)
				map[i] = i;
		}
	}

	/**
	 * Check if the numbers are valid
	 * @param nums The numbers array need to check
	 * @param min Minimus value
	 * @param max Maximam value
	 * @return If all the numbers are in the data range
	 */
	checkNum(nums, min, max) {
		if (nums == null)
			return false;

		if (nums == -1)
			return true;

		for (var i = 0; i < nums.length; i++) {
			if (nums[i] < min || nums[i] > max)
				return false;
		}

		return true;
	}

	/**
	 * Caculate the next valid cronTime after the given time
	 * @param The given time point
	 * @return The nearest valid time after the given time point
	 */
	nextExcuteTime(cronTrigger, time) {
		//add 1s to the time so it must be the next time
		time += 1000;

		if (!cronTrigger){
			console.error("Invalid Trigger")
			return
		}

		var date = new Date(time);
		date.setMilliseconds(0);

		outmost: while (true) {
			if (date.getFullYear() > 2099) {
				return null;
			}
			if (!this.timeMatch(date.getFullYear(), cronTrigger[this.YEAR])) {
				var nextYear = this.nextCronTime(date.getFullYear(), cronTrigger[this.YEAR], true);
				if (date.getFullYear() > nextYear){
					return null;
				}
				date.setYear(nextYear);
				date.setMonth(0);
				date.setDate(1);
				date.setHours(0);
				date.setMinutes(0);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getMonth(), cronTrigger[this.MONTH])) {
				var nextMonth = this.nextCronTime(date.getMonth(), cronTrigger[this.MONTH]);
				console.log("Check NextMonth -> ", nextMonth)

				if (nextMonth == null)
					return null;

				if (nextMonth <= date.getMonth()) {
					if (cronTrigger[this.YEAR] != - 1) {
						return null;
					} else {
						date.setYear(date.getFullYear() + 1);
					}
					date.setMonth(0);
					date.setDate(1);
					date.setHours(0);
					date.setMinutes(0);
					date.setSeconds(0);
					continue;
				}

				date.setDate(1);
				date.setMonth(nextMonth);
				date.setHours(0);
				date.setMinutes(0);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getDate(), cronTrigger[this.DOM]) || !this.timeMatch(date.getDay(), cronTrigger[this.DOW])) {
				var domLimit = this.getDomLimit(date.getFullYear(), date.getMonth());

				do {
					var nextDom = this.nextCronTime(date.getDate(), cronTrigger[this.DOM]);
					if (nextDom == null)
						return null;

					//If the date is in the next month, add month
					if (nextDom <= date.getDate() || nextDom > domLimit) {
						date.setDate(1);
						date.setMonth(date.getMonth() + 1);
						date.setHours(0);
						date.setMinutes(0);
						date.setSeconds(0);
						continue outmost;
					}

					date.setDate(nextDom);
				} while (!this.timeMatch(date.getDay(), cronTrigger[this.DOW]));

				date.setHours(0);
				date.setMinutes(0);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getHours(), cronTrigger[this.HOUR])) {
				var nextHour = this.nextCronTime(date.getHours(), cronTrigger[this.HOUR]);

				if (nextHour <= date.getHours()) {
					date.setDate(date.getDate() + 1);
					date.setHours(nextHour);
					date.setMinutes(0);
					date.setSeconds(0);
					continue;
				}

				date.setHours(nextHour);
				date.setMinutes(0);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getMinutes(), cronTrigger[this.MIN])) {
				var nextMinute = this.nextCronTime(date.getMinutes(), cronTrigger[this.MIN]);

				if (nextMinute <= date.getMinutes()) {
					date.setHours(date.getHours() + 1);
					date.setMinutes(nextMinute);
					date.setSeconds(0);
					continue;
				}

				date.setMinutes(nextMinute);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getSeconds(), cronTrigger[this.SECOND])) {
				var nextSecond = this.nextCronTime(date.getSeconds(), cronTrigger[this.SECOND]);

				if (nextSecond <= date.getSeconds()) {
					date.setMinutes(date.getMinutes() + 1);
					date.setSeconds(nextSecond);
					continue;
				}

				date.setSeconds(nextSecond);
			}
			break;
		}

		return date.getTime()
	};

	/**
	 * return the next match time of the given value
	 * @param value The time value
	 * @param cronTime The cronTime need to match
	 * @return The match value or null if unmatch(it offten means an error occur).
	 */
	nextCronTime(value, cronTime, isYear = false) {
		value += 1;

		if (typeof (cronTime) == 'number') {
			if (cronTime == -1)
				return value;
			else
				return cronTime;
		} else if (typeof (cronTime) == 'object' && cronTime instanceof Array) {
			if (value > cronTime[cronTime.length - 1])
				return isYear ? cronTime[cronTime.length - 1] : cronTime[0];

			for (var i = 0; i < cronTime.length; i++)
				if (value <= cronTime[i])
					return cronTime[i];
		}

		//console.warn('Compute next Time error! value :' + value + ' cronTime : ' + cronTime);
		return null;
	}

	/**
	 * Caculate the last valid cronTime before the given time
	 * @param The given time point
	 * @return The nearest valid time before the given time point
	 */
	lastTriggerTime(cronTrigger, time) {
		//add 1s to the time so it must be the next time
		time += 1000;

		if (!cronTrigger){
			console.error("Invalid Trigger")
			return
		}

		var date = new Date(time);
		date.setMilliseconds(0);

		outmost: while (true) {
			console.log("check next time ", date)
			if (date.getFullYear() > 2099) {
				return null;
			}
			if (!this.timeMatch(date.getFullYear(), cronTrigger[this.YEAR])) {
				var nextYear = this.nextCronTime(date.getFullYear(), cronTrigger[this.YEAR], true);
				if (date.getFullYear() > nextYear){
					return null;
				}
				date.setYear(nextYear);
				date.setMonth(0);
				date.setDate(1);
				date.setHours(0);
				date.setMinutes(0);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getMonth(), cronTrigger[this.MONTH])) {
				var nextMonth = this.nextCronTime(date.getMonth(), cronTrigger[this.MONTH]);
				console.log("Check NextMonth -> ", nextMonth)

				if (nextMonth == null)
					return null;

				if (nextMonth <= date.getMonth()) {
					if (cronTrigger[this.YEAR] != - 1) {
						return null;
					} else {
						date.setYear(date.getFullYear() + 1);
					}
					date.setMonth(0);
					date.setDate(1);
					date.setHours(0);
					date.setMinutes(0);
					date.setSeconds(0);
					continue;
				}

				date.setDate(1);
				date.setMonth(nextMonth);
				date.setHours(0);
				date.setMinutes(0);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getDate(), cronTrigger[this.DOM]) || !this.timeMatch(date.getDay(), cronTrigger[this.DOW])) {
				var domLimit = this.getDomLimit(date.getFullYear(), date.getMonth());

				do {
					var nextDom = this.nextCronTime(date.getDate(), cronTrigger[this.DOM]);
					if (nextDom == null)
						return null;

					//If the date is in the next month, add month
					if (nextDom <= date.getDate() || nextDom > domLimit) {
						date.setDate(1);
						date.setMonth(date.getMonth() + 1);
						date.setHours(0);
						date.setMinutes(0);
						date.setSeconds(0);
						continue outmost;
					}

					date.setDate(nextDom);
				} while (!this.timeMatch(date.getDay(), cronTrigger[this.DOW]));

				date.setHours(0);
				date.setMinutes(0);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getHours(), cronTrigger[this.HOUR])) {
				var nextHour = this.nextCronTime(date.getHours(), cronTrigger[this.HOUR]);

				if (nextHour <= date.getHours()) {
					date.setDate(date.getDate() + 1);
					date.setHours(nextHour);
					date.setMinutes(0);
					date.setSeconds(0);
					continue;
				}

				date.setHours(nextHour);
				date.setMinutes(0);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getMinutes(), cronTrigger[this.MIN])) {
				var nextMinute = this.nextCronTime(date.getMinutes(), cronTrigger[this.MIN]);

				if (nextMinute <= date.getMinutes()) {
					date.setHours(date.getHours() + 1);
					date.setMinutes(nextMinute);
					date.setSeconds(0);
					continue;
				}

				date.setMinutes(nextMinute);
				date.setSeconds(0);
			}

			if (!this.timeMatch(date.getSeconds(), cronTrigger[this.SECOND])) {
				var nextSecond = this.nextCronTime(date.getSeconds(), cronTrigger[this.SECOND]);

				if (nextSecond <= date.getSeconds()) {
					date.setMinutes(date.getMinutes() + 1);
					date.setSeconds(nextSecond);
					continue;
				}

				date.setSeconds(nextSecond);
			}
			break;
		}

		return date.getTime()
	};

	/**
	 * return the last match time of the given value
	 * @param value The time value
	 * @param cronTime The cronTime need to match
	 * @return The match value or null if unmatch(it offten means an error occur).
	 */
	lastCronTime(value, cronTime, isYear) {
		value -= 1;

		if (typeof (cronTime) == 'number') {
			if (cronTime == -1)
				return value;
			else
				return cronTime;
		} else if (typeof (cronTime) == 'object' && cronTime instanceof Array) {
			if (value > cronTime[cronTime.length - 1] || value < 0)
				return cronTime[cronTime.length - 1];

			for (var i = cronTime.length - 1; i >= 0; i--)
				if (value >= cronTime[i])
					return cronTime[i];
		}

		//console.warn('Compute next Time error! value :' + value + ' cronTime : ' + cronTime);
		return null;
	}

	/**
	 * Get the date limit of given month
	 * @param The given year
	 * @month The given month
	 * @return The date count of given month
	 */
	getDomLimit(year, month) {
		var date = new Date(year, month + 1, 0);
		return date.getDate();
	}

	/**
	 * Match the given value to the cronTime
	 * @param value The given value
	 * @param cronTime The cronTime
	 * @return The match result
	 */
	timeMatch(value, cronTime) {
		if (typeof (cronTime) == 'number') {
			if (cronTime == -1)
				return true;
			if (value == cronTime)
				return true;
			return false;
		} else if (typeof (cronTime) == 'object' && cronTime instanceof Array) {
			if (value < cronTime[0] || value > cronTime[cronTime.length - 1])
				return false;

			for (var i = 0; i < cronTime.length; i++)
				if (value == cronTime[i])
					return true;

			return false;
		}

		return false;
	}
}


module.exports = new TimeCron()