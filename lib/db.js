var redis = require('redis');
var redisPrefix = 'qr-main:';
var table = '';
var logger = global.qrLog;

function connect() {
	redis = redis.createClient({
		prefix: redisPrefix
	});

	redis.on('connect', (err) => {
	    logger('Redis connected with '+redisPrefix);
	});

	redis.on('end', (err) => {
	    logger('Redis connection ended:', redisPrefix, err);
	});

	redis.on('error', (err) => {
	    logger('Redis error:', redisPrefix, err);
	});
}

module.exports = (tableName) => {
	table = tableName;
	connect();
	return exports;
}

exports.hset = (command, id, vals, callback = '') => {
	var arr = [];
	var key = table+':'+id;
	if (typeof(vals) == 'object' && !Array.isArray(vals)) {
		for (var key in vals) {
			arr.push(key);
			arr.push(vals[key]);
		}
	} else {
		arr = vals;
	}

	if (callback == '') {
		redis[command](key, arr);
	} else {
		redis[command](key, arr, callback());
	}
	return true;
}

exports.hgetall = (id, callback = '') => {
	var key = table+':'+id;
	if (callback == '') {
		redis.hgetall(key);
	} else {
		redis.hgetall(key, callback());
	}
}

exports.all = (callback = '') => {
	var key = redisPrefix+table+'*';
	if (callback == '') {
		redis.keys(key);
	} else {
		redis.keys(key, callback());
	}
}

/**
 * check if specific key exists
 * return 1 if exists
 * 
 * @param  {String} id       key to check
 * @param  {Function} callback [description]
 * @return {void}          [description]
 */
exports.exists = (id, callback = '') => {
	var key = table+':'+id;
	if (callback == '') {
		redis.exists(key);
	} else {
		redis.exists(key, (err, rep) => {
			callback(err, rep);
		});
	}
}