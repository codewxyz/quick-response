var models = global.models;
var promise = global.promise;
var qrsModel = null;
var redis;
var io;
var socketOrgList = {}; //list of namespace object in socket.io
var roomList = {}; //list of room record

/**
 * list of events a socket connection might emit
 * @type {Object}
 */
var roomEvents = {
    message: 'chat message',
    message_failed: 'chat message send failed',
    buzz: 'chat buzz',
    count_online: 'count user online'
};
var orgEvents = {
    join_room: 'user join room',
    new_room: 'new room created',
    invite_chat: 'invite private chat',
    is_invite_chat: 'is invited with private chat'
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
 * log message on console for debug
 * @return {void} [description]
 */
function logger() {
    console.log('-----------QR Service Log: ' + global.system.moment.utc().format('HH:mm:ss') + '-----------');
    for (var idx in arguments) {
        console.log(arguments[idx]);
    }
    console.log('-----------QR Service Log End.----------------\n');

}

/**
 * get user stored in socket session
 * @param  {Socket} socket socket connection of user
 * @return {Mixed}        [description]
 */
function getSocketUser(socket) {
    if (socket.handshake.session != undefined) {
        return (socket.handshake.session.user == undefined) ? 
                null : socket.handshake.session.user;
    }

    return null;
}

/**
 * open connection for socket server
 * @return {void}      [description]
 */
function openMainConnection() {
    // loading global channel
    logger('start listen on world channel...');
    io.on(ioDefaultEvents.connect, function(socket) {
        var user = getSocketUser(socket);
        qrsModel.userOnline(user.username, socket);

        logger('world channel: ' + user.username + ' joined', socket.id);

        socket.on(roomEvents.message, function(msg) {
            logger(user.username + ' send message:', msg);
            var msgTime = global.system.moment.utc().valueOf();
            var sendObj = {
                id: msgTime,
                username: user.username,
                avatar: user.avatar,
                name: user.name,
                time: global.system.momentz.tz(msgTime, 'Asia/Ho_Chi_Minh').format('HH:mm'),
                datetime: global.system.momentz.tz(msgTime, 'Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm'),
                msg: msg.content,
                roomCode: models.rooms.defaultCode
            };
            var saveObj = {
                username: user.username,
                msg: msg.content
            };

            //save chat then emit to other users
            models.chats.saveChat(models.rooms.defaultCode, saveObj)
            .then((result) => {
                if (result > 0) {
                    io.emit(roomEvents.message, sendObj);
                } else {
                    return new promise((resolve, reject) => reject('Cannot save chat.'));
                }
            })
            .catch((err) => {
                logger(err);
                sendObj.msg = 'Message failed to send. :(';
                io.emit(roomEvents.message_failed, sendObj);
            });
        });

        qrsSocketDefaultEvents(socket);
        qrsUpdateUserOnlineForRoom(models.rooms.defaultCode, user.username);
    });
}

/**
 * open connection for namespace in socket.io server
 * @param  {String} orgCode organization code
 * @return {void}         [description]
 */
function openOrgConnection(orgCode) {
    logger('start listen on org ' + orgCode+'...');
    socketOrgList[orgCode] = io.of('/' + orgCode).on(ioDefaultEvents.connect, (socket) => {
        var user = getSocketUser(socket);
        var orgObj = socketOrgList[orgCode];

        logger('org ' + orgCode + ': ' + user.username + ' joined');

        //init user join room on first access
        models.lists.custom('smembers', models.lists.getKeyUserRoom(user.username))
        .then((rooms) => {
            for (var i in rooms) {
                var roomCode = rooms[i];
                qrsJoinRoom(socket, roomCode);
            }
        })
        .catch(logger);

        //default events
        qrsSocketDefaultEvents(socket);
        //custom events
        qrsSocketEvents(orgObj, socket);

        //event user was added to room
        socket.on(orgEvents.join_room, function(obj) {
            logger(orgEvents.join_room, obj);
            if (roomList[obj.roomCode] != undefined) {
                models.lists.custom('smembers', models.lists.getKeyUserDevice(obj.username))
                .then((results) => {
                    results.forEach((val) => {
                        var socketId  = '/'+orgCode+'#'+val;
                        var otherSocket = socketOrgList[orgCode].connected[socketId];                        

                        qrsJoinRoom(otherSocket, obj.roomCode, obj.username);

                        //emit event to user's sockets
                        if (socket.id != socketId) {
                            socket.broadcast.to(socketId).emit(orgEvents.new_room, {
                                room: roomList[obj.roomCode], 
                                username: obj.username
                            });
                        }
                    });
                })
                .catch(logger);
            }
        });

        //event new room created
        //all room members (user) should be joined
        socket.on(orgEvents.new_room, function(obj) {
            var roomCode = obj.roomCode;

            qrsModel.joinUsersToRoom(roomCode)
            .then((results) => {
                var roomInfo = results.pop();
                for (var i in results) {
                    var listDevices = results[i];
                    listDevices.forEach((deviceId) => {
                        var socketId  = '/'+orgCode+'#'+deviceId;
                        var otherSocket = socketOrgList[orgCode].connected[socketId];                        
                        var otherUser = getSocketUser(otherSocket);

                        qrsJoinRoom(otherSocket, roomCode);

                        //emit event to user's sockets
                        if (socket.id != socketId) {
                            socket.broadcast.to(socketId).emit(orgEvents.new_room, {
                                room: roomInfo, 
                                username: otherUser.username
                            });
                        }

                    });
                }
            })
            .catch(logger);
        });

        socket.on(orgEvents.invite_chat, function(obj) {
            var roomCode = obj.roomCode;
            var targetUser = obj.targetUser;

            qrsModel.joinUsersToRoom(roomCode)
            .then((results) => {
                var roomInfo = results.pop();
                for (var i in results) {
                    var listDevices = results[i];
                    listDevices.forEach((deviceId) => {
                        var socketId  = '/'+orgCode+'#'+deviceId;
                        var otherSocket = socketOrgList[orgCode].connected[socketId];                        
                        var otherUser = getSocketUser(otherSocket);

                        qrsJoinRoom(otherSocket, roomCode);

                        //emit event to user's sockets
                        if (socket.id != socketId) {
                            socket.broadcast.to(socketId).emit(orgEvents.new_room, {
                                room: roomInfo, 
                                username: otherUser.username
                            });
                        }

                    });
                }
            })
            .catch(logger);
        });
    });
}

/**
 * user join room
 * @param  {Socket} socket socket connection of user
 * @param  {String} room   room code
 * @return {void}        [description]
 */
function qrsJoinRoom(socket, roomCode) {
    var user = getSocketUser(socket);
    socket.join(roomCode, () => {
        logger(user.username + ' joined room ' + roomCode);
        qrsUpdateUserOnlineForRoom(roomCode, user.username);
    });
}

/**
 * user leave room
 * @param  {Socket} socket [description]
 * @param  {String} room   room code
 * @return {void}        [description]
 */
function qrsLeaveRoom(socket, roomCode) {
    var user = getSocketUser(socket);
    socket.leave(roomCode, () => {
        logger(user.username + ' leaved room ' + roomCode);
        qrsUpdateUserOnlineForRoom(roomCode, user.username);
    });
}

/**
 * custom socket.io events defined by QRS for the app
 * @param  {Namespace} ns     socket namespace obj
 * @param  {Socket} socket socket obj
 * @return {void}        [description]
 */
function qrsSocketEvents(ns, socket) {
    var user = getSocketUser(socket);

    //event exchange message
    socket.on(roomEvents.message, function(msg) {
            var roomCode = msg.roomCode;
            logger(user.username + ' send message', msg);

            var msgTime = global.system.moment.utc().valueOf();
            var sendObj = {
                id: msgTime,
                username: user.username,
                avatar: user.avatar,
                name: user.name,
                time: global.system.momentz.tz(msgTime, 'Asia/Ho_Chi_Minh').format('HH:mm'),
                datetime: global.system.momentz.tz(msgTime, 'Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm'),
                msg: msg.content,
                roomCode: roomCode
            };
            var saveObj = {
                username: user.username,
                msg: msg.content
            };

            //save chat then emit to other users
            models.chats.saveChat(roomCode, saveObj)
            .then((result) => {
                if (result > 0) {
                    ns.in(roomCode).emit(roomEvents.message, sendObj);
                } else {
                    return new promise((resolve, reject) => reject('Cannot save chat.'));
                }
            })
            .catch((err) => {
                logger(err);
                sendObj.msg = 'Message failed to send. :(';
                ns.in(roomCode).emit(roomEvents.message_failed, sendObj);
            });
    });
}

/**
 * default socket events of socket.io
 * @param  {Socket} socket socket obj
 * @return {[type]}        [description]
 */
function qrsSocketDefaultEvents(socket) {
    var user = getSocketUser(socket);

    //socket in disconnection
    socket.on(ioDefaultEvents.disconnecting, function(reason) {
        logger(user.username + ' disconnecting:', reason);
    });

    //socket disconnected
    socket.on(ioDefaultEvents.disconnect, function(reason) {
        qrsUpdateUserOffline(user.username, socket.id);
        logger(user.username + ' disconnected:', reason);
    });

    //socket connection has error or broken
    socket.on(ioDefaultEvents.error, function(error) {
        qrsUpdateUserOffline(user.username, socket.id);
        logger(user.username + ' socket connection error:', error);
    });
}

function qrsUpdateUserOnlineForRoom(roomCode, username) {
    qrsModel.custom('sadd', qrsModel.getKeyUserRoomOnline(roomCode), username)
    .then((result) => {
        return qrsModel.custom('scard', qrsModel.getKeyUserRoomOnline(roomCode));
    })
    .then((result) => {
        var countObj = {
            count: result,
            roomCode: roomCode
        };
        io.emit(roomEvents.count_online, countObj);
    })
    .catch(logger);    
}

function qrsUpdateUserOffline(username, clientId) {
    var userRooms = [];
    qrsModel.userOffline(username, clientId)
    .then((results) => {
        userRooms = results;
        var commands = [];
        //count user online in each room
        results.forEach((roomCode) => {
            commands.push(['scard', qrsModel.getKeyUserRoomOnline(roomCode)]);
        });
        return qrsModel.batch(commands);
    })
    .then((results) => {//get count online and emit event to each online user
        if (results.length == userRooms.length) {
            for (var i in results) {
                var countObj = {
                    count: results[i],
                    roomCode: userRooms[i]
                };
                io.emit(roomEvents.count_online, countObj);                
            }
        }
    })
    .catch(logger);
}

function updateRooms() {
    logger('start update room in QR Service...');
    models.lists.custom('smembers', models.lists.keyGRoom)
    .then((rooms) => {
        if (rooms.length > 0) {
            var commands = [];
            for (var i in rooms) {
                commands.push(['hgetall', rooms[i]]);
            }
            return models.rooms.batch(commands);
        } else {
            return new promise((resolve, reject) => resolve([]));
        }
    })
    .then((rooms) => {
        if (rooms.length > 0) {
            roomList = {};
            for (var i in rooms) {
                roomList[rooms[i].code] = rooms[i];
            }
        }
        logger('end update room in QR Service', Object.keys(roomList).length + ' rooms added');
    })
    .catch((err) => {
        logger(err);
    });
}

//------------------------------MODULE PUBLIC FUNCTIONS-----------------------
//----------------------------------------------------------------------------

module.exports = exports = (http, session) => {
    io = require('socket.io')(http, {
        path: '/qrchat',
        transports: ['websocket'],
        upgrade: false,
        cookie: false
    });

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

    qrsModel = new (require('../models/QRSModel.js'))();
    qrsModel.cleanRedis();
    openMainConnection();

    //org	
    models.lists.custom('smembers', models.lists.keyGOrg)
    .then((orgs) => {
        for (var i in orgs) {
            io.of('/' + orgs[i]).use(session);
            openOrgConnection(orgs[i]);
        }
    })
    .catch(logger);

    //rooms
    updateRooms();

    return exports;
};

exports.updateRooms = () => {
    updateRooms();
};