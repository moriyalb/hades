/**
 * Filter for toobusy.
 * if the process is toobusy, just skip the new request
 */
const Hades = GlobalHades
var conLogger = Hades.Logger.getLogger('pomelo', __filename);
var toobusy = null;
var DEFAULT_MAXLAG = 70;


module.exports = function(maxLag) {
  return new Filter(maxLag || DEFAULT_MAXLAG);
};

var Filter = function(maxLag) {
  try {
    toobusy = require('toobusy');
  } catch(e) {
  }
  if(!!toobusy) {
    toobusy.maxLag(maxLag);
  }
};

Filter.prototype.before = function(msg, session, next) {
  if (!!toobusy && toobusy()) {
    conLogger.warn('[toobusy] reject request msg: ' + msg);
    var err = new Error('Server toobusy!');
    err.code = 500;
    next(err);
  } else {
    next();
  }
};