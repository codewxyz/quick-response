var g_redisPrefix = 'qr-main:';
var g_db;
var g_table = '';
var storeType = 'hash';
var g_primaryKey = 'code';
var logger = global.qrLog;
var g_promise = global.common.promise;
var g_moment = global.common.moment;
var g_system = global.system;

function BaseModel() {
    g_table = arguments[0];
    if (arguments[1] != undefined) {
        storeType = arguments[1];
    }

    connect();

    this.setPK = (key) => {
        g_primaryKey = key;
    };

    this.getKey = (id, hasPrefix=false) => {
        if (hasPrefix)
            return g_redisPrefix+getKey(id);
        else 
            return getKey(id);
    };

    this.redis = () => g_db;

    /**
     * run a redis command
     * arguments can be flexible
     * @return {g_promise} [description]
     */
    this.custom = function() {
        var args = Array.from(arguments);
        var command = arguments[0];
        var passArgs = [];
        if (command == 'eval') {
            passArgs = args.slice(1);
        } else {
            var key = getKey(arguments[1]);
            passArgs = [key].concat(args.slice(2));
        }
        return g_db[command+'Async'](...passArgs);
    };

    /**
     * perform g_db commands in transaction
     * get only one result at the end
     * @param  {Array}  commands    list of command to execute
     * @return {g_promise}              [description]
     */
    this.multi = (commands) => {
        var commandList = [];

        for (var i in commands) {
            commandList.push(prepareMulti(commands[i]));
        }

        return g_db.multi(commandList).execAsync();
    };

    /**
     * run multi g_db command at once
     *     
     * @param  {String} commands [description]
     * @return {g_promise}          [description]
     */
    this.batch = (commands) => {
        var commandList = [];

        for (var i in commands) {
            commandList.push(prepareMulti(commands[i]));
        }

        return g_db.batch(commandList).execAsync();
    };

    this.create = (vals) => {
    	vals = prepareData(vals);

        return new g_promise(function(resolve, reject) {
            switch (storeType) {
                case 'hash':
                    var arr = [];
                    for (var i in vals) {
                        arr.push(i);
                        arr.push(vals[i]);
                    }
                    resolve(dset('hmset', vals[g_primaryKey], arr));
                    break;
                case 'set':
                    resolve(dset('sadd', vals[g_primaryKey], vals.data));
                    break;
                default:
                    reject('no store type set in table '+g_table);
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

//----------------------------------HANDLING g_db FUNCTIONS-----------------------
//---------------------------------------------------------------------
function connect() {
    var redis = require('redis');

    g_promise.promisifyAll(redis.RedisClient.prototype);
    g_promise.promisifyAll(redis.Multi.prototype);
    var redisUrl = g_system.redis_url;
    if (redisUrl != '') {
        g_db = redis.createClient(redisUrl, {
            prefix: g_redisPrefix
        });
    } else {
        g_db = redis.createClient({
            prefix: g_redisPrefix
        });
    }

    g_db.on('connect', () => {
        logger('Redis connected with ' + g_redisPrefix + ' on ' + g_table);
    });

    g_db.on('end', () => {
        logger('Redis connection ended:', g_redisPrefix, g_table);
    });

    g_db.on('error', (err) => {
        logger('Redis error:', g_redisPrefix, g_table, err);
    });
}

function dset(command, id, vals) {
    var key = getKey(id);
    command += 'Async';

    return g_db[command](key, vals);
}

function hgetall(id) {
    var key = getKey(id);
    return g_db.hgetallAsync(key);
}

function all() {
    var key = g_redisPrefix + g_table + '*';
    return g_db.keysAsync(key);
}

function count(id, type) {
    var key = getKey(id);
    switch (type) {
        case 'set':
            return g_db.scardAsync(key);
        default:
            // statements_def
            break;
    }
}

function search(type, val) {
    switch (type) {
        case 'key':
            var pattern = g_redisPrefix + g_table + val.pattern;
            return g_db.keysAsync(pattern);
        case 'set':
            var key = getKey(val.key);
            return g_db.sscanAsync(key, 0, 'match', val.pattern, 'count', val.count);
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
    return g_db.existsAsync(key);
}

/**
 * check if member of set exist
 * @param  {String} member       member value
 * @return {void}          [description]
 */
function mexists(id, member) {
    return new g_promise(function(resolve, reject) {
        if (storeType == 'set') {
            resolve(g_db.sismemberAsync(getKey(id), member));
        } else {
            console.trace();
            reject('store type is not set for g_table '+g_table);
        }
    });
}

// //----------------------------------SUPPORT FUNCTIONS-----------------------
// //---------------------------------------------------------------------
function getKey(id) {
    return checkKey(id) ? id.replace(g_redisPrefix, '') : g_table + ':' + id;
}

function checkKey(key) {
    return (key.indexOf(g_redisPrefix) == 0);
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
            if (vals.length >= 3)
                args.push(vals.slice(2));

            break;
    }

    return [vals[0]].concat(args);
}

function prepareData(data) {
    switch (storeType) {
        case 'hash':
            data.created_at = g_moment.utc().valueOf();
            data.updated_at = g_moment.utc().valueOf();
            break;
        default:
            // statements_def
            break;
    }
    return data;
}