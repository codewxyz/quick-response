var models = global.models;
var moment = require('moment');
var redis;
var io;
var orgList = {}; //list of namespace object in socket.io
var roomList = {}; //list of room record
var redisPrefix = 'qrs-socket-io:';

var redisKeys = {
    udevice: 'users:devices:',
    ulist: 'users:list:',
    ronline: 'rooms:online:'
}

/**
 * list of events a socket connection might emit
 * @type {Object}
 */
var ioEvents = {
    message: 'chat message',
    buzz: 'chat buzz',
    count_online: 'count user online'
};

var ioDefaultEvents = {
    connect: 'connection',
    disconnect: 'disconnect',
    disconnecting: 'disconnecting',
    error: 'error',
    nlisten: 'newListenser',
    rmlisten: 'removeListener'
};

/**
 * get list of rooms in a specific namespace
 * which user can access
 * @param  {String} org      [description]
 * @param  {String} username [description]
 * @return {mixed}          array or false if nothing retrieved
 */
function getRooms(org = '', username) {
    return models.rooms.get();
}

/**
 * log message on console for debug
 * @return {void} [description]
 */
function logger() {
    console.log('-----------QR Service Log: ' + moment().format('HH:mm:ss') + '-----------');
    for (var idx in arguments) {
        console.log(arguments[idx]);
    }
    console.log('-----------QR Service Log End.----------------\n');

}

/**
 * get user stored in socket session
 * @param  {Socket} socket socket connection of user
 * @return {Object}        [description]
 */
function getSocketUser(socket) {
    return socket.handshake.session.user;
}

/**
 * update user info into Redis for access during online session
 * @param  {Object} user     [description]
 * @param  {String} clientId [description]
 * @return {void}          [description]
 */
function updateUserInfo(user, clientId) {
    redis.hget('users:list:' + user.username, 'status', (err, rep) => {
        logger('users list', rep);
        if (rep == null || rep == 0) {
            //update user online status
            redis.hset(redisKeys.ulist + user.username, 'status', 1);
        } else {
            redis.hset(redisKeys.ulist + user.username, 'status', 0);
        }
    });

    //update devices (client id) user logged in
    redis.hset(redisKeys.udevice + user.username, clientId, 1);
}

/**
 * open connection for socket server
 * @param  {String} type [description]
 * @return {void}      [description]
 */
function openMainConnection(orgs) {
    // loading global channel
    logger('start listen on world channel');
    io.on(ioDefaultEvents.connect, function(socket) {
        var user = getSocketUser(socket);
        updateUserInfo(user, socket.id);

        logger('world channel: ' + user.username + ' joined');

        socket.on(ioEvents.message, function(msg) {
            logger(user.username + ' send message:', msg);
            var sendObj = {
                user: user.username,
                avatar: user.avatar,
                name: user.name,
                time: moment().format('HH:mm'),
                msg: msg.content
            };
            io.emit(ioEvents.message, sendObj);
        });

        qrsSocketDefaultEvents(socket, 0);
        qrsCountUserOnline('room', user.username);
    });
}

/**
 * open connection for namespace in socket.io server
 * @param  {String} orgCode organization code
 * @return {void}         [description]
 */
function openOrgConnection(orgCode) {
    logger('start listen on org ' + orgCode);
    orgList[orgCode] = io.of('/' + orgCode).on(ioDefaultEvents.connect, (socket) => {
        var user = getSocketUser(socket);
        var orgObj = orgList[orgCode];

        logger('org ' + orgCode + ': ' + user.username + ' joined');

        //user join room
        models.rooms_users.search('*' + user.username, (rooms) => {
            for (var i in rooms) {
                var roomCode = roomList[rooms[i]].code;
                qrsJoinRoom(socket, roomCode);
                qrsSocketEvents(orgObj, socket, roomCode);
            }
        });

        qrsSocketDefaultEvents(socket);
    });
}

/**
 * callback for namespace
 * @param  {String} orgCode  index in orgList
 * @return {void}     [description]
 */
// function callbackNS(orgCode) {
//     return function(socket) {
//         var user = getSocketUser(socket);
//         var org = orgList[orgCode];

//         logger('org ' + orgCode + ': ' + user.username + ' joined');

//         //user join room
//         var rooms = getRooms(orgCode, user.username);
//         for (var idx in rooms) {
//             var room = rooms[idx].code;
//             qrsJoinRoom(socket, room);
//             qrsSocketEvents(org, socket, room);
//         }

//         qrsSocketDefaultEvents(socket);
//     };
// }

/**
 * user join room
 * @param  {Socket} socket socket connection of user
 * @param  {String} room   room name
 * @return {void}        [description]
 */
function qrsJoinRoom(socket, room) {
    var user = getSocketUser(socket);
    socket.join(room, () => {
        logger(user.username + ' joined room ' + room);
        qrsCountUserOnline(room, user.username);
    });
}

function qrsLeaveRoom(socket, room) {
    var user = getSocketUser(socket);
    socket.leave(room, () => {
        logger(user.username + ' leaved room ' + room);
        qrsCountUserOnline(room, user.username, -1);
    });
}

/**
 * custom socket.io event defined by QRS for the app
 * @param  {Namespace} ns     socket namespace obj
 * @param  {Socket} socket socket obj
 * @param  {String} room   room code
 * @return {void}        [description]
 */
function qrsSocketEvents(ns, socket, room) {
    var user = getSocketUser(socket);

    //event exchange message
    socket.in(room).on(createEvent(room, ioEvents.message), function(msg) {

        logger(user.username + ' send message', msg);

        var sendObj = {
            user: user.username,
            avatar: user.avatar,
            name: user.name,
            time: moment().format('HH:mm'),
            msg: msg.content
        };

        ns.in(room).emit(createEvent(room, ioEvents.message), sendObj);
    });
}

/**
 * default socket events of socket.io
 * @param  {Socket} socket socket obj
 * @param  {Number} type   run from global(0) or namespace(1)
 * @return {[type]}        [description]
 */
function qrsSocketDefaultEvents(socket, type = 1) {
    var user = getSocketUser(socket);

    //socket in disconnection
    socket.on(ioDefaultEvents.disconnecting, function(reason) {
        if (type == 0) {
            //delete this device (socket id) from this user's list device
            redis.hdel(redisKeys.udevice + user.username, socket.id);
        }
        logger(user.username + ' disconnecting:', reason);
    })

    //socket disconnected
    socket.on(ioDefaultEvents.disconnect, function(reason) {
        redis.hgetall(redisKeys.udevice + user.username, (err, rep) => {
            if (rep == null || rep.length == 0) {
                //update user online in each room
                for (var idx in roomList) {
                    qrsCountUserOnline(roomList[idx].code, user.username, -1);
                }
            }
        });
        logger(user.username + ' disconnected:', reason);
    });

    //socket connection has error or broken
    socket.on(ioDefaultEvents.error, function(error) {
        logger(user.username + ' socket connection error:', error);
    });
}

/**
 * count user online in specific room
 * @param  {String} room     room code
 * @param  {String} username [description]
 * @param  {Number} type     count is inscrease(1) or descrease(-1)
 * @return {void}          [description]
 */
function qrsCountUserOnline(room, username, type = 1) {
    if (type == 1) {
        redis.hset(redisKeys.ronline + room, username, 1);
    } else {
        redis.hdel(redisKeys.ronline + room, username);
    }
    redis.hkeys(redisKeys.ronline + room, (err, rep) => {
        if (err) throw err;

        var countObj = {
            count: rep.length
        };
        io.emit(createEvent(room, ioEvents.count_online), countObj);
    });
}

/**
 * callback for event in qrsCountUserOnline()
 * @param  {String} room room code
 * @return {Function}      [description]
 */
// function callbackGetClients(room) {
//     return function(error, rep) {
//         if (error) throw error;
//         var countObj = {
//             count: rep.length
//         };
//         io.emit(createEvent(room, ioEvents.count_online), countObj);
//     };
// }

/**
 * create socket event base on specific rule of QRS
 * @param  {String} room     room code
 * @param  {String} txtEvent original event code
 * @return {String}          formatted event code
 */
function createEvent(room, txtEvent) {
    return room == 'room' ? txtEvent : room + '::' + txtEvent;
}

function connectRedis() {
    redis = require('redis').createClient({
        prefix: redisPrefix
    });
    redis.on('connect', (err) => {
        logger('Redis connected');
    });
    redis.on('end', (err) => {
        logger('Redis connection ended:', err);
    });
    redis.on('error', (err) => {
        logger('Redis error:', err);
    });
}

function cleanRedis() {
    //reset all keys QRS used in previous server run
    redis.keys(redisPrefix + '*', (err, rep) => {
        var arr = [];
        rep.forEach((val) => {
            arr.push(val.slice(redisPrefix.length));
        });

        // logger(arr);
        if (arr.length > 0)
            redis.del(arr);
    });
}

function updateRooms() {
    models.rooms.all((rooms) => {
        for (var i in rooms) {
            models.rooms.get(rooms[i], (room) => {
                roomList[r.code] = room;
            });
        }
    })
}

//------------------------------MODULE PUBLIC FUNCTIONS-----------------------
//----------------------------------------------------------------------------

module.exports = (http, session) => {
    io = require('socket.io')(http);

    //middleware
    io.use(session);
    io.use(function(socket, next) {
        var user = socket.handshake.session.user;
        if (user == undefined || user.length == 0) {
            next(new Error('Authentication error'));
        } else {
            return next();
        }
    });

    logger('start socket.io server');

    connectRedis();
    cleanRedis();

    openMainConnection();

    //org	
    models.orgs.all((orgs) => {
        for (var i in orgs) {
            models.orgs.get(orgs[i], (org) => {
                io.of('/' + org.code).use(session);
                openOrgConnection(org.code);
            });
        }
    });

    //rooms
    updateRooms();

    return exports;
}