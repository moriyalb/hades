"use strict"

/**
 * @author: bwf 2014-10-27
 */

var tt = module.exports

tt.MILI_SECOND_MUL = 1000
tt.MINUTE = 60
tt.HOUR = 3600
tt.DAY = 86400
tt.TIMEZONE = null

tt.getDate = function (year, month, day, hour, minute, second) {
    year = year || 0
    month = month || 0
    day = day || 0
    hour = hour || 0
    minute = minute || 0
    second = second || 0
    if (year > 0 && month > 0) {
        return new Date(year, month, day, hour, minute, second)
    } else if (year > 0) {
        return new Date(year)
    } else {
        return new Date()
    }
}

tt.getDateByTS = function (ns) {
    return new Date(ns * tt.MILI_SECOND_MUL)
}

tt.nowDate = function () {
    return new Date()
}

tt.msnow = function () {
    return tt.nowDate().getTime()
}

tt.fnow = function () {
    return tt.nowDate().getTime() / tt.MILI_SECOND_MUL
}

tt.inow = function () {
    return parseInt(tt.fnow())
}

tt.dateToStamp = function (date) {
    return parseInt(date.getTime() / tt.MILI_SECOND_MUL)
}

/**
 * 获取给定时间配置的时间戳
 * format参数暂时不能指定，所有时间格式必须为 "yyyy-MM-dd hh:mm:ss"
 */
tt.getTimestamp = function (date, format) {
    if (!!date) {
        var data = date.split(' ')
        var dd = data[0].split('-')
        var td = data[1].split(':')
        return (new Date(parseInt(dd[0]), parseInt(dd[1]) - 1, parseInt(dd[2]), parseInt(td[0]), parseInt(td[1]), parseInt(td[2])).getTime()) / tt.MILI_SECOND_MUL
    } else {
        return tt.fnow()
    }
}

/**
 * 获取当天某一整点的时间戳，如果当前时间大于该时间，获得第二天该整点的时间戳
 */
tt.fixedTimestamp = function (clock) {
    var stamp = parseInt(tt.getClockTimeToday(clock))
    if (tt.inow() >= stamp)
        stamp += tt.DAY
    return stamp
}

tt.year = function () {
    return (tt.nowDate().getFullYear())
}

tt.month = function () {
    return (tt.nowDate().getMonth() + 1)
}

tt.day = function () {
    return (tt.nowDate().getDate())
}

/**
 * 周日-周六 分别是 0-6
 */
tt.weekday = function () {
    return (tt.nowDate().getDay())
}

tt.weekdayByTS = function (ts) {
    return (this.getDateByTS(ts).getDay())
}

tt.hour = function () {
    return (tt.nowDate().getHours())
}

tt.minute = function () {
    return (tt.nowDate().getMinutes())
}

tt.second = function () {
    return (tt.nowDate().getSeconds())
}

tt.timezone = function () {
    if (tt.TIMEZONE === null) {
        tt.TIMEZONE = tt.nowDate().getTimezoneOffset() * tt.MINUTE
    }
    return tt.TIMEZONE * 1000
}

// tt.getTimeByTimeZone = function(timeZone){  
// 	var d=new Date()  
// 		localTime = d.getTime(),  
// 		localOffset=d.getTimezoneOffset()*60000, //获得当地时间偏移的毫秒数,这里可能是负数  
// 		utc = localTime + localOffset, //utc即GMT时间  
// 		offset = timeZone, //时区，北京市+8  美国华盛顿为 -5  
// 		localSecondTime = utc + (3600000*offset)  //本地对应的毫秒数  
// 	var date = new Date(localSecondTime)  
// 	console.log("根据本地时间得知"+timeZone+"时区的时间是 " + date.toLocaleString())  
// 	console.log("系统默认展示时间方式是："+ date)  
// }  

// getTimeByTimeZone(8)  

/**
 * 获取今日已经过去的秒数
 */
tt.secondPastToday = function () {
    var td = tt.getClockTimeToday(0)
    return tt.inow() - td
}

/**
 * 获取距今日0时，时间戳已经过去的秒数
 */
tt.secondPastTimeStamp = function (ts) {
    var td = tt.getClockTimeToday(0)
    return ts - td
}

/**
 * 获取距给定时间戳的剩余时间
 */
tt.toNextTimeStamp = function (nts) {
    return nts - tt.fnow()
}

/**
 * 获得距给定时间戳经过的时间
 */
tt.beforeTimeStamp = function (bts) {
    return tt.fnow() - bts
}

/**
 * 获得经过delta时间后的时间戳
 */
tt.getDelayTimeStamp = function (delta) {
    return tt.fnow() + delta
}

/**
 * 获得当天某一整点时刻的时间.
 * @param clock 整点时间
 * @returns {Number}秒
 */
tt.getClockTimeToday = function (clock) {
    var date = new Date()
    date.setHours(clock)
    date.setMinutes(0)
    date.setSeconds(0)
    date.setMilliseconds(0)
    return parseInt(date.getTime() / tt.MILI_SECOND_MUL)
}

/**
 * 获得时间戳所在日期的某一整点时刻的时间.
 * @param clock 整点时间
 * @returns {Number}秒
 */
tt.getClockTimeTodayByTS = function (ts, clock) {
    var date = this.getDateByTS(ts)
    date.setHours(clock)
    date.setMinutes(0)
    date.setSeconds(0)
    date.setMilliseconds(0)
    return parseInt(date.getTime() / tt.MILI_SECOND_MUL)
}

/**
 * 获得离当前时间最近的跳点时间
 * @param startTime
 * @param interval 间隔时间(秒)
 * @returns {number}秒
 */
tt.getFirstIntervalTimeBeforeNow = function (startTime, interval) {
    var nowTime = this.inow()
    var result = nowTime - (nowTime - startTime) % interval
    return result
}

/**
 * 获得第一个当前时间之前的某一整点时刻的时间
 * @param clock 整点时间
 * @returns {Number}秒
 */
tt.getFirstClockTimeBeforeNow = function (clock) {
    var date = new Date()
    var nowTime = date.getTime()
    date.setHours(clock)
    date.setMinutes(0)
    date.setSeconds(0)
    date.setMilliseconds(0)
    var clockTime = date.getTime()
    if (clockTime > nowTime) {
        date.setDate(date.getDate() - 1)
    }
    return parseInt(date.getTime() / tt.MILI_SECOND_MUL)
}

/**
 * 获取当月的天数
 */
tt.getCurrentMonthDays = function () {
    var day = new Date()
    day.setDate(1)
    var endDate = new Date(day)
    endDate.setMonth(day.getMonth() + 1)
    endDate.setDate(0)
    return endDate.getDate()
}

/**
 * 获取本日在一年中的第几天
 */
tt.getDaysInYear = function () {
    var now = new Date()
    var firstDay = new Date(now.getFullYear(), 0, 1)
    //计算当前时间与本年第一天的时差(返回一串数值，代表两个日期相差的毫秒数)
    var dateDiff = now - firstDay
    //一天的毫秒数
    var msPerDay = 1000 * 60 * 60 * 24
    //计算天数
    return Math.ceil(dateDiff / msPerDay)
}

/**
 *
 * 判断是否是同一年的同一个月
 * @param t1 秒的时间戳
 * @param t2
 * @returns {boolean}
 */
tt.equalMonth = function (t1, t2) {
    var aDate = new Date(t1 * 1000)
    var bDate = new Date(t2 * 1000)
    if (aDate.getFullYear() === bDate.getFullYear()) {
        if ((aDate.getMonth() + 1) === (bDate.getMonth() + 1)) {
            return true
        }
    }
    return false
}

/**
 *
 * 判断是否是同一年的同一个月的同一天
 * @param t1 秒的时间戳
 * @param t2
 * @returns {boolean}
 */
tt.equalDate = function (t1, t2) {
    var aDate = new Date(t1 * 1000)
    var bDate = new Date(t2 * 1000)
    if (aDate.getFullYear() === bDate.getFullYear()) {
        if ((aDate.getMonth() + 1) === (bDate.getMonth() + 1)) {
            if (aDate.getDate() === bDate.getDate()) {
                return true
            }
        }
    }
    return false
}

/**
 * 获得距现在x天的时间(毫秒值)
 * @param x 距现在的天数(支持正负)
 * @returns {*}
 */
tt.getDayAwayFromNow = function (x) {
    if (isNaN(x))
        return this.inow()

    var now = new Date()
    now.setDate(now.getDate() + x)
    return this.dateToStamp(now)
}

/**
 * 获得距时间戳x天的时间
 * @param x 距现在的天数(支持正负)
 * @returns {*}
 */
tt.getDayAwayFromTS = function (ts, x) {
    if (isNaN(x))
        return ts

    var date = this.getDateByTS(ts)
    date.setDate(date.getDate() + x)
    return this.dateToStamp(date)
}

/**
 * 获得2个时间相差多少天
 * @param time1
 * @param time2
 * @returns {*}
 */
tt.getDayDistance = function (time1, time2) {
    var date1 = this.getDateByTS(time1)
    date1.setHours(0)
    date1.setMinutes(0)
    date1.setSeconds(0)
    date1.setMilliseconds(0)

    var date2 = this.getDateByTS(time2)
    date2.setHours(0)
    date2.setMinutes(0)
    date2.setSeconds(0)
    date2.setMilliseconds(0)

    var d = this.dateToStamp(date1) - this.dateToStamp(date2)
    if (d < 0) {
        d = -d
    }

    return Math.floor(d / this.DAY)
}

/**
 * 获得某一时间距今天的天数
 * @param time
 * @returns {*}
 */
tt.getDayDistanceBetweenNow = function (time) {
    return this.getDayDistance(time, this.inow())
}

tt.getSecondDistance = function (time1, time2) {
    var d = time1 - time2
    if (d < 0) {
        d = -d
    }

    return d
}

tt.sleep = function(time) {
    return new Promise((resolve, reject)=>{
        setTimeout(resolve, time)
    })
}