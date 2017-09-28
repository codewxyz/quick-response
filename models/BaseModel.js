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

    this.test = () => table;

    this.setPK = (key) => {
        primaryKey = key;
    }

    this.redis = () => db;

    this.multi = (commands, isTerminate, callback) => {
        if (!Array.isArray(commands)) {
            throw 'Command in multi function have to be an array.';
        }

        var commandList = [];

        for (var i in commands) {
            commandList.push(prepareMulti(commands[i]));
        }
        var multi = db.multi(commandList);

        multi.exec((err, reps) => {
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
        var multi = db.batch(commandList);

        multi.exec((err, reps) => {
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
    var key = checkKey(id) ? id.replace(redisPrefix, '') : table + ':' + id;
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
    var key = checkKey(id) ? id.replace(redisPrefix, '') : table + ':' + id;
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
            var id = vals[1];
            var key = checkKey(id) ? id.replace(redisPrefix, '') : table + ':' + id;
            args.push(key);
            break;
        case 'hmset':
            var id = vals[1].username;
            var key = checkKey(id) ? id.replace(redisPrefix, '') : table + ':' + id;
            var arr = [];
            if (typeof(vals[1]) == 'object' && !Array.isArray(vals[1])) {
                for (var i in vals[1]) {
                    arr.push(i);
                    arr.push(vals[1][i]);
                }
            } else {
                arr = vals[1];
            }
            args.push(key);
            args.push(arr);
            break;
        case 'sadd':
            var id = vals[1];
            var key = checkKey(id) ? id.replace(redisPrefix, '') : table + ':' + id;
            args.push(key);
            args.push(vals[2]);;
            break;

        default:
            break;
    }
    logger([vals[0]].concat(args));

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
    var key = checkKey(id) ? id.replace(redisPrefix, '') : table + ':' + id;
    if (callback == '') {
        db.exists(key);
    } else {
        db.exists(key, (err, rep) => {
        	if (err) throw err;
            callback(rep);
        });
    }
}