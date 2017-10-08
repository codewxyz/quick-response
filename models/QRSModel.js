var redisPrefix = 'qr-service:';
var db;
var logger = global.qrLog;
var promise = global.promise;
var mainModels = global.models;

function QRSModel() {
    connect();

    this.keyDefaultRoom = 'room';
    this.keyGUserOnline = 'online:users';
    this.getKeyUserDevice = (username) => 'users:' + username + ':devices';
    this.getKeyUserRoomOnline = (roomCode) => 'online:rooms:' + roomCode;
    this.getKeyUserOrgOnline = (orgCode) => 'online:orgs:' + orgCode;

    this.getKey = (id) => {
        return redisPrefix + getKey(id);
    };

    this.redis = () => db;

    this.custom = (command, key, args = null) => {
        if (args == null) {
            return db[command + 'Async'](key);
        } else {
            return db[command + 'Async'](key, args);
        }
    };

    this.cleanRedis = () => {
        db.keysAsync(redisPrefix + '*')
            .then((results) => {
                results = results.map((val) => {
                    return getKey(val);
                });
                if (results.length > 0)
                    db.delAsync(results);
            })
            .catch(logger);
    };

    this.userOnline = (username, socket) => {
        var commands = [];
        commands.push(['sadd', this.getKeyUserRoomOnline(this.keyDefaultRoom), username]);
        commands.push(['sadd', this.keyGUserOnline, username]);
        commands.push(['sadd', this.getKeyUserDevice(username), socket.id]);

        this.multi(commands)
            .catch(logger);
    };

    this.userOffline = (username, clientId) => {
        return new promise((mresolve, mreject) => {
            var commands = [];

            db.scardAsync(this.getKeyUserDevice(username))
                .then((result) => {
                    if (result == 1) {
                        return mainModels.lists.custom('smembers', mainModels.lists.getKeyUserRoom(username));
                    } else {
                        return new promise((resolve, reject) => {
                            db.sremAsync(this.getKeyUserDevice(username), clientId)
                            .then((result) => {
                                mreject(username+' not offline.');
                            })
                            .catch(mreject);
                        });
                    }
                })
                .then((results) => {
                    if (results.length > 0) {
                        for (var i in results) {
                            commands.push(['srem', this.getKeyUserRoomOnline(results[i]), username]);
                        }
                        return db.keysAsync(this.getKey('users:*'));
                    } else {
                        return new promise((resolve, reject) => resolve([]));
                    }
                })
                .then((results) => { //get user's rooms and delete qr-service keys of user
                    if (results.length > 0) {
                        commands.push(['del', results]);
                        commands.push(['srem', this.getKeyUserRoomOnline(this.keyDefaultRoom), username]);
                        commands.push(['srem', this.keyGUserOnline, username]);
                        commands.push(['srem', this.getKeyUserDevice(username), clientId]);

                        return this.multi(commands);
                    } else {
                        return new promise((resolve, reject) => resolve([]));
                    }
                })
                .then((result) => {
                    mresolve(result);
                })
                .catch((err) => {
                    mreject(err);
                });
        });
    };

    this.joinUsersToRoom = (roomCode) => {
        return new promise((mresolve, mreject) => {
            var roomInfo = null;
            mainModels.rooms.custom('hgetall', roomCode)
                .then((result) => {
                    if (getLength(result) > 0) {
                        roomInfo = result;
                        return mainModels.lists.custom('smembers', mainModels.lists.getKeyRoomUser(roomCode));
                    } else {
                        return new promise((resolve, reject) => resolve([]));
                    }
                })
                .then((usernames) => {
                    var commands = [];
                    for (var i in usernames) {
                        commands.push(['smembers', this.getKeyUserDevice(usernames[i])]);
                    }
                    if (commands.length > 0) {
                        return this.batch(commands);
                    } else {
                        return new promise((resolve, reject) => resolve([]));
                    }
                })
                .then((results) => {
                    results.push(roomInfo);
                    mresolve(results);
                })
                .catch(mreject);
        });
    };

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

    this.search = (val) => {
        return search(val.type, val);
    };

    this.count = (id, type) => {
        return count(id, type);
    };

}

module.exports = QRSModel;

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
        logger('Redis connected with ' + redisPrefix);
    });

    db.on('end', (err) => {
        logger('Redis connection ended:', redisPrefix, err);
    });

    db.on('error', (err) => {
        logger('Redis error:', redisPrefix, err);
    });
}

function count(key, type) {
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

//----------------------------------SUPPORT FUNCTIONS-----------------------
//--------------------------------------------------------------------------
function getLength(obj) {
    if (typeof(obj) == 'object') {
        if (Array.isArray(obj)) {
            return obj.length;
        } else {
            return Object.keys(obj).length;
        }
    }
    return 0;
}
function getKey(id) {
    return checkKey(id) ? id.replace(redisPrefix, '') : id;
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
            args.push(vals[1]);
            args.push(arr);
            break;

        default:
            args.push(vals[1]);
            if (vals[2] != undefined)
                args.push(vals.slice(2));
            break;
    }

    return [vals[0]].concat(args);
}