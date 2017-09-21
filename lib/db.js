var redis = require('redis');
var redisPrefix = 'qr-main:';
var table = '';

function connect() {
	redis = redis.createClient({
		prefix: redisPrefix
	});

	redis.on('connect', (err) => {
	    qrsLog('Redis connected with '+redisPrefix);
	});

	redis.on('end', (err) => {
	    qrsLog('Redis connection ended:', redisPrefix, err);
	});

	redis.on('error', (err) => {
	    qrsLog('Redis error:', redisPrefix, err);
	});
}

module.exports = (tableName) => {
	table = tableName;
	connect();
	return exports;
}

exports.create = (command, args, callback = '') => {
	var arr = [];
	if (typeof(args) == 'object' && !Array.isArray(args)) {
		for (var key in args) {
			arr.push(key);
			arr.push(args[key]);
		}
	} else {
		return false;
	}
	//
	if (callback == '') {
		redis[command](table, arr);
	} else {
		redis[command](table, arr, callback());
	}
}