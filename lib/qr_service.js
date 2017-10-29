var g_models = global.models;
var g_promise = global.common.promise;
var g_qrsModel = null;
var redis;
var io;
var g_socketOrgList = {}; //list of namespace object in socket.io
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
    new_room: 'new room created'
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
        g_qrsModel.userOnline(user.username, socket);

        logger('world channel: ' + user.username + ' joined', socket.id);
        //custom events
        qrsSocketEvents(io, socket);
        //default events
        qrsSocketDefaultEvents(socket);
        //update online user in world room (global channel)
        qrsUpdateUserOnlineForRoom(g_models.rooms.defaultCode, user.username);
    });
}

/**
 * open connection for namespace in socket.io server
 * @param  {String} orgCode organization code
 * @return {void}         [description]
 */
function openOrgConnection(orgCode) {
    logger('start listen on org ' + orgCode+'...');
    g_socketOrgList[orgCode] = io.of('/' + orgCode).on(ioDefaultEvents.connect, (socket) => {
        var user = getSocketUser(socket);
        var orgObj = g_socketOrgList[orgCode];

        logger('org ' + orgCode + ': ' + user.username + ' joined');

        //init user join room on first access
        g_models.lists.custom('smembers', g_models.lists.getKeyUserRoom(user.username))
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
        //custom org events
        qrsSocketOrgEvents(orgObj, socket, orgCode);
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
 * custom socket.io organization (namespace) events defined by QRS for the app
 * @param  {Namespace} ns     socket namespace obj
 * @param  {Socket} socket socket obj
 * @return {void}        [description]
 */
function qrsSocketOrgEvents(ns, socket, orgCode) {
    //event user was added to room
    socket.on(orgEvents.join_room, function(f2_obj) {
        logger(orgEvents.join_room, f2_obj);
        var f2_room = {};
        g_models.rooms.custom('hgetall', f2_obj.roomCode)
        .then((getRoom) => {
            if (Object.keys(getRoom).length > 0) {
                f2_room = getRoom;
                return g_models.lists.custom('smembers', g_models.lists.getKeyUserDevice(f2_obj.username));
            } else {
                return new g_promise((resolve, reject) => reject('Room '+f2_obj.roomCode+' does not exist.'));
            }
        })
        .then((deviceIds) => {
            deviceIds.forEach((deviceId) => {
                var socketId  = '/'+orgCode+'#'+deviceId;
                var otherSocket = g_socketOrgList[orgCode].connected[socketId];                        

                qrsJoinRoom(otherSocket, f2_obj.roomCode, f2_obj.username);

                //emit event to user's sockets
                if (socket.id != socketId) {
                    socket.broadcast.to(socketId).emit(orgEvents.new_room, {
                        room: f2_room, 
                        username: f2_obj.username
                    });
                }
            });
        })
        .catch(logger);
    });

    //event new room created
    //all room members (user) should be joined
    socket.on(orgEvents.new_room, function(obj) {
        var roomCode = obj.roomCode;

        g_qrsModel.joinUsersToRoom(roomCode)
        .then((results) => {
            var roomInfo = results.pop();
            if (roomInfo.type == 'private') {
                var u1 = {};
                var u2 = {};
                var otherSocketIds = [];
                results.forEach((listDevices, idx) => {
                    listDevices.forEach((deviceId) => {
                        var socketId  = '/'+orgCode+'#'+deviceId;
                        var otherSocket = g_socketOrgList[orgCode].connected[socketId];                        
                        var otherUser = getSocketUser(otherSocket);

                        qrsJoinRoom(otherSocket, roomCode);
                        if (idx == 0) {
                            u1 = otherUser;
                        } else if (idx == 1) {
                            u2 = otherUser;
                        }
                        if (socket.id != socketId) {
                            otherSocketIds.push([idx, socketId]);
                        }

                    });
                });

                otherSocketIds.forEach((val) => {
                    roomInfo.targetUser = val[0] == 0 ? u2 : u1;
                    socket.broadcast.to(val[1]).emit(orgEvents.new_room, {
                        room: roomInfo, 
                        username: val[0] == 0 ? u1.username : u2.username
                    });
                });

            } else {
                for (var i in results) {
                    var listDevices = results[i];
                    listDevices.forEach((deviceId) => {
                        var socketId  = '/'+orgCode+'#'+deviceId;
                        var otherSocket = g_socketOrgList[orgCode].connected[socketId];                        
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
            }
        })
        .catch(logger);
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
    var isIO = ((ns.name == undefined) || (ns.name == '/'));

    //event exchange message
    socket.on(roomEvents.message, function(msg) {
            var roomCode = isIO ? g_models.rooms.defaultCode : msg.roomCode;
            // logger(user.username + ' send message', msg);

            var msgTime = global.system.moment.utc().valueOf();
            var sendObj = {
                id: 0,
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
            g_models.chats.saveChat(roomCode, saveObj)
            .then((chatid) => {
                sendObj.id = chatid;
                if (isIO) {
                    ns.emit(roomEvents.message, sendObj);
                } else {
                    ns.in(roomCode).emit(roomEvents.message, sendObj);
                }
            })
            .catch((err) => {
                logger(err);
                sendObj.msg = 'Message failed to send. :(';
                if (isIO) {
                    ns.emit(roomEvents.message_failed, sendObj);
                } else {
                    ns.in(roomCode).emit(roomEvents.message_failed, sendObj);
                }
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
    g_qrsModel.custom('sadd', g_qrsModel.getKeyUserRoomOnline(roomCode), username)
    .then((result) => {
        return g_qrsModel.custom('scard', g_qrsModel.getKeyUserRoomOnline(roomCode));
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
    g_qrsModel.userOffline(username, clientId)
    .then((results) => {
        userRooms = results;
        var commands = [];
        //count user online in each room
        results.forEach((roomCode) => {
            commands.push(['scard', g_qrsModel.getKeyUserRoomOnline(roomCode)]);
        });
        return g_qrsModel.batch(commands);
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

//------------------------------MODULE PUBLIC FUNCTIONS-----------------------
//----------------------------------------------------------------------------

module.exports = exports = (http, session) => {
    io = require('socket.io')(http, {
        path: '/qrchat',
        transports: ['websocket'],
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

    g_qrsModel = new (require(global.root_dir+'/models/QRSModel.js'))();
    g_qrsModel.cleanRedis();
    openMainConnection();

    //org	
    g_models.lists.custom('smembers', g_models.lists.keyGOrg)
    .then((orgs) => {
        for (var i in orgs) {
            io.of('/' + orgs[i]).use(session);
            openOrgConnection(orgs[i]);
        }
    })
    .catch(logger);

    return exports;
};