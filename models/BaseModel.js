var redisPrefix = 'qr-main:';
var db;
var table = '';
var storeType = 'hash';
var primaryKey = 'code';
var logger = global.qrLog;
var promise = global.promise;

function BaseModel() {
    table = arguments[0];
    if (arguments[1] != undefined) {
        storeType = arguments[1];
    }

    connect();

    this.setPK = (key) => {
        primaryKey = key;
    };

    this.getKey = (id, hasPrefix=false) => {
        if (hasPrefix)
            return redisPrefix+getKey(id);
        else 
            return getKey(id);
    };

    this.redis = () => db;

    this.custom = (command, id, args=null) => {
        var key = getKey(id);
        if (args == null) {
            return db[command+'Async'](key);
        } else {
            return db[command+'Async'](key, args);
        }
    }

    /**
     * perform db commands in transaction
     * get only one result at the end
     * @param  {Array}  commands    list of command to execute
     * @return {Promise}              [description]
     */
    this.multi = (commands) => {
        var commandList = [];

        for (var i in commands) {
            commandList.push(prepareMulti(commands[i]));
        }

        return db.multi(commandList).execAsync();
    };

    /**
     * run multi db command at once
     *     
     * @param  {String} commands [description]
     * @return {Promise}          [description]
     */
    this.batch = (commands) => {
        var commandList = [];

        for (var i in commands) {
            commandList.push(prepareMulti(commands[i]));
        }

        return db.batch(commandList).execAsync();
    };

    this.create = (vals) => {
    	vals = prepareData(vals);

        return new promise(function(resolve, reject) {
            switch (storeType) {
                case 'hash':
                    var arr = [];
                    for (var i in vals) {
                        arr.push(i);
                        arr.push(vals[i]);
                    }
                    resolve(dset('hmset', vals[primaryKey], arr));
                    break;
                case 'set':
                    resolve(dset('sadd', vals[primaryKey], vals.data));
                    break;
                case 'set_diff':
                    resolve(dset('sdiffstore', vals[primaryKey], vals.data));
                    break;
                default:
                    reject('no store type set in table '+table);
                    break;
            }

        });
    };

    this.exists = (vals) => {
        return exists(vals);
    };

    this.mexists = (id, vals) => {
        return mexists(id, vals);
    };

    this.get = (val) => {
        return hgetall(val);
    };

    this.getList = (val) => {

    };

    this.all = () => {
        return all();
    };

    this.search = (val) => {
        return search(val.type, val);
    };

    this.count = (id, type) => {
        return count(id, type);
    };

}

module.exports = BaseModel;

//----------------------------------HANDLING DB FUNCTIONS-----------------------
//---------------------------------------------------------------------
function connect() {
    var redis = require('redis');
    promise.promisifyAll(redis.RedisClient.prototype);
    promise.promisifyAll(redis.Multi.prototype);
    db = redis.createClient({
        prefix: redisPrefix
    });

    db.on('connect', (err) => {
        logger('Redis connected with ' + redisPrefix + ' on ' + table);
    });

    db.on('end', (err) => {
        logger('Redis connection ended:', redisPrefix, table, err);
    });

    db.on('error', (err) => {
        logger('Redis error:', redisPrefix, table, err);
    });
}

function dset(command, id, vals) {
    var key = getKey(id);
    command += 'Async';

    return db[command](key, vals);
}

function hgetall(id) {
    var key = getKey(id);
    return db.hgetallAsync(key);
}

function all() {
    var key = redisPrefix + table + '*';
    return db.keysAsync(key);
}

function count(id, type) {
    var key = getKey(id);
    switch (type) {
        case 'set':
            return db.scardAsync(key);
        default:
            // statements_def
            break;
    }
}

function search(type, val) {
    switch (type) {
        case 'key':
            var pattern = redisPrefix + table + val.pattern;
            return db.keysAsync(pattern);
        case 'set':
            var key = getKey(val.key);
            return db.sscanAsync(key, 0, 'match', val.pattern, 'count', val.count);
        default:
            // statements_def
            break;
    }
}

/**
 * check if specific key exists
 * return 1 if exists
 * 
 * @param  {String} id       key to check
 * @return {void}          [description]
 */
function exists(id) {
    var key = getKey(id);
    return db.existsAsync(key);
}

/**
 * check if member of set exist
 * @param  {String} member       member value
 * @return {void}          [description]
 */
function mexists(id, member) {
    return new promise(function(resolve, reject) {
        if (storeType == 'set') {
            resolve(db.sismemberAsync(getKey(id), member));
        } else {
            console.trace();
            reject('store type is not set for table '+table);
        }
    });
}

// //----------------------------------SUPPORT FUNCTIONS-----------------------
// //---------------------------------------------------------------------
function getKey(id) {
    return checkKey(id) ? id.replace(redisPrefix, '') : table + ':' + id;
}

function checkKey(key) {
    return (key.indexOf(redisPrefix) == 0);
}

function prepareMulti(vals) {
    var args = [];
    switch (vals[0]) {
        case 'hmset':
            var obj = prepareData(vals[2]);
            var arr = [];

            for (var i in obj) {
                arr.push(i);
                arr.push(obj[i]);
            }
            args.push(getKey(vals[1]));
            args.push(arr);
            break;

        default:
            args.push(getKey(vals[1]));
            if (vals[2] != undefined)
                args.push(vals.slice(2));
            break;
    }

    return [vals[0]].concat(args);
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