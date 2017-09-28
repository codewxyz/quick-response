var redisPrefix = 'qr-main:';
var db;
var table = '';
var storeType = 'hash';
var primaryKey = 'code';
var logger = global.qrLog;

function BaseModel() {
    table = arguments[0];
    if (arguments[1] != undefined) {
        storeType = arguments[1];
    }

    connect();

    this.setPK = (key) => {
        primaryKey = key;
    }

    this.getKey = (id) => getKey(id);

    this.redis = () => db;

    this.multi = (commands, isTerminate, callback) => {
        if (!Array.isArray(commands)) {
            throw 'Command in multi function have to be an array.';
        }

        var commandList = [];

        for (var i in commands) {
            commandList.push(prepareMulti(commands[i]));
        }
        logger(commandList);
        var multi = db.multi(commandList).exec((err, reps) => {
            if (!isTerminate) {
                return callback(err, reps);
            }

            if (err) {
                throw err;
            }
            callback(reps);
        });
    }

    this.batch = (commands, isTerminate, callback) => {
        if (!Array.isArray(commands)) {
            throw 'Command in batch function have to be an array.';
        }

        var commandList = [];

        for (var i in commands) {
            commandList.push(prepareMulti(commands[i]));
        }
        logger(commandList);
        var multi = db.batch(commandList).exec((err, reps) => {
            if (!isTerminate) {
                return callback(err, reps);
            }

            if (err) {
                throw err;
            }
            return callback(reps);
        });
    }

    this.create = (vals, callback = '') => {
    	vals = prepareData(vals);
        switch (storeType) {
            case 'hash':
                dset('hmset', vals[primaryKey], vals, callback);
                break;
            case 'set':
                dset('sadd', vals[primaryKey], vals['data'], callback);
                break;
            default:
                // statements_def
                break;
        }
    }
    this.exists = (vals, callback = '') => {
        exists(vals, callback);
    }

    this.list = (callback = '') => {
        all(callback);
    };

    this.get = (val, callback = '') => {
        hgetall(val, callback);
    };

    this.all = (callback = '') => {
        all(callback);
    };

    this.search = (val, callback = '') => {
        search(val, callback);
    };
}

// BaseModel.prototype.test = function () { console.log('hello basemodel'); return 'hah'; };

module.exports = BaseModel;

function getKey(id) {
    return checkKey(id) ? id.replace(redisPrefix, '') : table + ':' + id;
}
function prepareData(data) {
    switch (storeType) {
        case 'hash':
            data.created_at = Date.now();
            data.updated_at = Date.now();
            break;
        default:
            // statements_def
            break;
    }
    return data;
}

function connect() {
    db = require('redis').createClient({
        prefix: redisPrefix
    });

    db.on('connect', (err) => {
        logger('Redis connected with ' + redisPrefix);
    });

    db.on('end', (err) => {
        logger('Redis connection ended:', redisPrefix, err);
    });

    db.on('error', (err) => {
        logger('Redis error:', redisPrefix, err);
    });
}

function dset(command, id, vals, callback = '') {
    var arr = [];
    logger(command,id,vals);
    var key = getKey(id);
    if (typeof(vals) == 'object' && !Array.isArray(vals)) {
        for (var i in vals) {
            arr.push(i);
            arr.push(vals[i]);
        }
    } else {
        arr = vals;
    }

    if (callback == '') {
        db[command](key, arr);
    } else {
        db[command](key, arr, (err, rep) => {
        	if (err) throw err;
            callback(rep);
        });
    }
    return true;
}

function hgetall(id, callback = '') {
    var key = getKey(id);
    logger(key);
    if (callback == '') {
        db.hgetall(key);
    } else {
        db.hgetall(key, (err, rep) => {
        	if (err) throw err;
            callback(rep);
        });
    }
}


function prepareMulti(vals) {
    var args = [];
    switch (vals[0]) {
        case 'hgetall':
            args.push(getKey(vals[1]));
            break;
        case 'hmset':
            var obj = vals[2];
            var arr = [];
            if (typeof(obj) == 'object' && !Array.isArray(obj)) {
                for (var i in obj) {
                    arr.push(i);
                    arr.push(obj[i]);
                }
            } else {
                arr = obj;
            }
            args.push(getKey(vals[1]));
            args.push(arr);
            break;
        case 'sadd':
            args.push(getKey(vals[1]));
            args.push(vals[2]);;
            break;

        default:
            break;
    }

    return [vals[0]].concat(args);
}

function all(callback = '') {
    var key = redisPrefix + table + '*';
    if (callback == '') {
        db.keys(key);
    } else {
        db.keys(key, (err, rep) => {
        	if (err) throw err;
            callback(rep);
        });
    }
}

function search(pattern, callback = '') {
    var key = redisPrefix + table + pattern;
    if (callback == '') {
        db.keys(key);
    } else {
        db.keys(key, (err, rep) => {
        	if (err) throw err;
            callback(rep);
        });
    }
}

function checkKey(key) {
	return (key.indexOf(redisPrefix) == 0);
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
    var key = getKey(id);
    if (callback == '') {
        db.exists(key);
    } else {
        db.exists(key, (err, rep) => {
        	if (err) throw err;
            callback(rep);
        });
    }
}