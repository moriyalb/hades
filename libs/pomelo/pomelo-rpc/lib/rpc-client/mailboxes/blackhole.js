const Hades = GlobalHades 
const Logger = Hades.Logger.getLogger('pomelo', __filename);
var EventEmitter = require('events');
var utils = require('../../util/utils');

var exp = module.exports = new EventEmitter();

exp.connect = function(tracer, cb) {
	tracer && tracer.info('client', __filename, 'connect', 'connect to blackhole');
	process.nextTick(function() {
		cb(new Error('fail to connect to remote server and switch to blackhole.'));
	});
};

exp.close = function(cb) {};

exp.send = function(tracer, msg, opts, cb) {
	tracer && tracer.info('client', __filename, 'send', 'send rpc msg to blackhole');
	Logger.info(`message into blackhole: ${msg}`);
	process.nextTick(function() {
		cb(tracer, new Error('message was forward to blackhole.'));
	});
};