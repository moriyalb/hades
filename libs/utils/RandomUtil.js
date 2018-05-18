"use strict"
/**
 * @author: bwf 2014-10-27
 */
const _ = require('lodash')

class Random{

	/**
	 * 产生一个区间[start,end]的随机整数
	 */
	randint(start, end) {
		return Math.floor(start + (end - start + 1) * Math.random())
	}

	/**
	 * 从数组中随机挑选一个值并返回
	 */
	randchoice(array) {
		return array[this.randint(0, array.length - 1)]
	}

	randweight(array) {
		if (!_.isArray(array)){
			console.error("Random randweigth failed -> need an array but got ", array)
			return null
		}
		let weight = 0
		for (let [, w] of array) {
			weight += w
		}

		let r = this.randint(0, weight - 1)

		for (let [value, w] of array) {
			if (r < w) {
				return value
			}
			r -= w
		}

		return null
	}

	randweightindex(array) {
		if (!_.isArray(array)){
			console.error("Random randweightindex failed -> need an array but got ", array)
			return null
		}
		let weight = 0
		for (let w of array) {
			weight += w
		}

		let r = this.randint(0, weight - 1)

		for (let w of array) {
			if (r <w) {
				return i
			}
			r -= w
		}

		return -1
	}

	randkey(table) {
		if (!_.isPlainObject(table)){
			console.error("Random randkey failed -> need an object but got ", table)
			return null
		}
		return this.randchoice(_.keys(table))
	}

	
	randvalue(table) {
		if (!_.isPlainObject(table)){
			console.error("Random randvalue failed -> need an object but got ", table)
			return null
		}
		return this.randchoice(_.values(table))
	}

	/**
	 * 随机采样， 在数组中采样n个元素
	 * @param {} array 
	 * @param {*} n 采样数量，不能超过数组长度
	 * @param {*} shuffle 为true时将打乱返回的顺序
	 */
	randSample(array, n, shuffle) {
		if (!_.isArray(array)){
			console.error("Random randsample failed -> need an array but got ", array)
			return null
		}
		const newArray = []

		if (array.length > n * 5) {
			let indexs = {}
			for (let i = 0; i < n; ++i) {
				let index = this.randint(0, array.length - 1)
				while (indexs[index]) {
					index = this.randint(0, array.length - 1)
				}
				indexs[index] = true
				newArray.push(array[index])
			}
		} else {
			for (let i = 0; i < array.length; ++i) {
				let p = (n - newArray.length) / (array.length - i)
				if (p > Math.random()) {
					newArray.push(array[i])
				}
			}
			if (!!shuffle) {
				newArray = this.randshuffle(newArray)
			}
		}
		return newArray
	}

	// use lodash.shuffle instead
	randShuffle(array){
		return _.shuffle(array)
	}
	// randshuffle(array) {
	// 	let rnd, tmp

	// 	for (let i = 0; i < array.length; ++i) {
	// 		rnd = this.randint(i, array.length - 1)
	// 		tmp = array[rnd]
	// 		array[rnd] = array[i]
	// 		array[i] = tmp
	// 	}

	// 	return array
	// }
}


module.exports = new Random()