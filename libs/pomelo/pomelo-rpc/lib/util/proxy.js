const Hades = GlobalHades
const Logger = Hades.Logger.getLogger('pomelo', __filename);
var exp = module.exports;

/**
 * Create proxy.
 *
 * @param  {Object} opts construct parameters
 *           opts.origin {Object} delegated object
 *           opts.proxyCB {Function} proxy invoke callback
 *           opts.service {String} deletgated service name
 *           opts.attach {Object} attach parameter pass to proxyCB
 * @return {Object}      proxy instance
 */
exp.create = function (opts) {
	if (!opts || !opts.origin) {
		logger.warn('opts and opts.origin should not be empty.');
		return null;
	}

	if (!opts.proxyCB || typeof opts.proxyCB !== 'function') {
		logger.warn('opts.proxyCB is not a function, return the origin module directly.');
		return opts.origin;
	}

	return genObjectProxy(opts.service, opts.origin, opts.attach, opts.proxyCB);
};

exp.createUser = function (opts) {
	let res = {}
	for (let method of opts.methods) {
		res[method] = genFunctionProxy(opts.service, method, opts.attach, opts.proxyCB)
	}

	return res
}

var genObjectProxy = function (serviceName, origin, attach, proxyCB) {
	//generate proxy for function field
	var res = {};
	for (var field in origin) {
		if (typeof origin[field] === 'function') {
			res[field] = genFunctionProxy(serviceName, field, attach, proxyCB);
		}
	}

	return res;
};

/**
 * Generate prxoy for function type field
 *
 * @param namespace {String} current namespace
 * @param serverType {String} server type string
 * @param serviceName {String} delegated service name
 * @param methodName {String} delegated method name
 * @param proxyCB {Functoin} proxy callback function
 * @returns function proxy
 */
var genFunctionProxy = function (serviceName, methodName, attach, proxyCB) {
	return (function () {
		var proxy = function (...args) {
			proxyCB(serviceName, methodName, args, attach);
		};

		proxy.toServer = function (...args) {
			proxyCB(serviceName, methodName, args, attach, true);
		};

		return proxy;
	})();
};