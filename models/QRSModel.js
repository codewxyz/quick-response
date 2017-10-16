var g_redisPrefix = 'qr-service:';
var g_db;
var logger = global.qrLog;
var g_promise = global.common.promise;
var g_mainModels = global.models;

function QRSModel() {
    connect();

    this.keyDefaultRoom = 'room';
    this.keyGUserOnline = 'online:users';//all users online currently
    this.getKeyUserDevice = (username) => 'users:' + username + ':devices';//number of devices user used to login currently
    this.getKeyUserRoomOnline = (roomCode) => 'online:rooms:' + roomCode;//users online in specific room
    this.getKeyUserOrgOnline = (orgCode) => 'online:orgs:' + orgCode;//users online in specific org

    this.getKey = (id) => {
        return g_redisPrefix + getKey(id);
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
        var key = getKey(arguments[1]);
        var passArgs = [key].concat(args.slice(2));

        return g_db[command+'Async'](...passArgs);
    };

    /**
     * delete all key of this model redis key space
     * @return {voide} [description]
     */
    this.cleanRedis = () => {
        g_db.keysAsync(g_redisPrefix + '*')
            .then((results) => {
                results = results.map((val) => {
                    return getKey(val);
                });
                if (results.length > 0)
                    g_db.delAsync(results);
            })
            .catch(logger);
    };

    /**
     * update info when user log in
     * change online status of user
     * 
     * @param  {String} username [description]
     * @param  {Object} socket   [description]
     * @return {void}          [description]
     */
    this.userOnline = (username, socket) => {
        var commands = [];
        commands.push(['sadd', this.getKeyUserRoomOnline(this.keyDefaultRoom), username]);
        commands.push(['sadd', this.keyGUserOnline, username]);
        commands.push(['sadd', this.getKeyUserDevice(username), socket.id]);

        this.multi(commands)
            .catch(logger);
    };

    /**
     * update info when user log out or socket disconnected
     * delete keys belong to user
     * delete online status of user
     * 
     * @param  {String} username [description]
     * @param  {String} clientId [description]
     * @return {Promise}          [description]
     */
    this.userOffline = (username, clientId) => {
        return new g_promise((mresolve, mreject) => {
            var commands = [];

            g_db.scardAsync(this.getKeyUserDevice(username))//get how many device user used to log in
                .then((result) => {
                    if (result <= 1) {
                        //get rooms user belong to
                        return g_mainModels.lists.custom('smembers', g_mainModels.lists.getKeyUserRoom(username));
                    } else {
                        return new g_promise((resolve, reject) => {
                            g_db.sremAsync(this.getKeyUserDevice(username), clientId)
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

                        //get all qr-service keys belong to this user
                        return g_db.keysAsync(this.getKey('users:'+username+':*'));
                    } else {
                        return new g_promise((resolve, reject) => resolve([]));
                    }
                })
                .then((results) => {
                    if (results.length > 0) {
                        var keys = results.map((val) => {
                            return getKey(val);
                        });
                        commands.push(['srem', this.getKeyUserRoomOnline(this.keyDefaultRoom), username]);
                        commands.push(['srem', this.keyGUserOnline, username]);
                        commands.push(['del'].concat(keys));

                        //run all DB command at once
                        return this.multi(commands);
                    } else {
                        return new g_promise((resolve, reject) => resolve([]));
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

    /**
     * add user to a room
     * @param  {String} roomCode [description]
     * @return {Promise}          [description]
     */
    this.joinUsersToRoom = (roomCode) => {
        return new g_promise((mresolve, mreject) => {
            var roomInfo = null;
            g_mainModels.rooms.custom('hgetall', roomCode)
                .then((result) => {
                    if (getLength(result) > 0) {
                        roomInfo = result;
                        return g_mainModels.lists.custom('smembers', g_mainModels.lists.getKeyRoomUser(roomCode));
                    } else {
                        return new g_promise((resolve, reject) => resolve([]));
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
                        return new g_promise((resolve, reject) => resolve([]));
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

    this.search = (val) => {
        return search(val.type, val);
    };

    this.count = (id, type) => {
        return count(id, type);
    };

}

module.exports = QRSModel;

//----------------------------------HANDLING g_db FUNCTIONS-----------------------
//---------------------------------------------------------------------
function connect() {
    var redis = require('redis');

    g_promise.promisifyAll(redis.RedisClient.prototype);
    g_promise.promisifyAll(redis.Multi.prototype);

    var redisUrl = global.system.redis_url;
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
        logger('Redis connected with ' + g_redisPrefix);
    });

    g_db.on('end', () => {
        logger('Redis connection ended:', g_redisPrefix);
    });

    g_db.on('error', (err) => {
        logger('Redis error:', g_redisPrefix, err);
    });
}

function count(key, type) {
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
            var pattern = g_redisPrefix + table + val.pattern;
            return g_db.keysAsync(pattern);
        case 'set':
            var key = getKey(val.key);
            return g_db.sscanAsync(key, 0, 'match', val.pattern, 'count', val.count);
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
    return checkKey(id) ? id.replace(g_redisPrefix, '') : id;
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