var models = global.models;
var promise = global.promise;
var qrsModel = null;
var moment = require('moment');
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
 * open connection for socket server
 * @param  {String} type [description]
 * @return {void}      [description]
 */
function openMainConnection(orgs) {
    // loading global channel
    logger('start listen on world channel...');
    io.on(ioDefaultEvents.connect, function(socket) {
        var user = getSocketUser(socket);
        qrsModel.userOnline(user.username, socket);

        logger('world channel: ' + user.username + ' joined', socket.id);

        socket.on(roomEvents.message, function(msg) {
            logger(user.username + ' send message:', msg);
            var sendObj = {
                user: user.username,
                avatar: user.avatar,
                name: user.name,
                time: moment().format('HH:mm'),
                msg: msg.content,
                roomCode: models.rooms.defaultCode
            };
            io.emit(roomEvents.message, sendObj);
        });

        qrsSocketDefaultEvents(socket);
        qrsUpdateUserOnlineForRoom(qrsModel.keyDefaultRoom, user.username);
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

        //user join room
        models.lists.custom('smembers', models.lists.getKeyUserRoom(user.username))
        .then((rooms) => {
            for (var i in rooms) {
                var roomCode = rooms[i];
                qrsJoinRoom(socket, roomCode);
                qrsSocketEvents(orgObj, socket, roomCode);
            }
        })
        .catch(logger);

        qrsSocketDefaultEvents(socket);

        //event user was added to room
        socket.on(orgEvents.join_room, function(obj) {
            if (roomList[obj.roomCode] != undefined) {
                var roomCode = obj.roomCode;
                qrsJoinRoom(socket, roomCode, user.username);
                qrsSocketEvents(orgObj, socket, roomCode);                
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

                        qrsJoinRoom(otherSocket, roomCode, otherUser.username);
                        qrsSocketEvents(socketOrgList[orgCode], otherSocket, roomCode); 

                        //emit event to user's sockets
                        if (socket.id != socketId) {
                            socket.broadcast.to(socketId).emit(orgEvents.new_room, {
                                room: roomInfo, 
                                username: otherUser.username,
                                socketid: socketId
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
 * @param  {String} room   room name
 * @return {void}        [description]
 */
function qrsJoinRoom(socket, room) {
    var user = getSocketUser(socket);
    socket.join(room, () => {
        logger(user.username + ' joined room ' + room);
        qrsUpdateUserOnlineForRoom(room, user.username);
    });
}

function qrsLeaveRoom(socket, room) {
    var user = getSocketUser(socket);
    socket.leave(room, () => {
        logger(user.username + ' leaved room ' + room);
        qrsUpdateUserOnlineForRoom(room, user.username);
    });
}

/**
 * custom socket.io event defined by QRS for the app
 * @param  {Namespace} ns     socket namespace obj
 * @param  {Socket} socket socket obj
 * @param  {String} room   room code
 * @return {void}        [description]
 */
function qrsSocketEvents(ns, socket, roomCode) {
    var user = getSocketUser(socket);

    //event exchange message
    socket.in(roomCode).on(roomEvents.message, function(msg) {
        if (msg.roomCode == roomCode) {
            logger(user.username + ' send message', msg);

            var sendObj = {
                username: user.username,
                avatar: user.avatar,
                name: user.name,
                time: moment().format('HH:mm'),
                msg: msg.content,
                roomCode: roomCode
            };

            ns.in(roomCode).emit(roomEvents.message, sendObj);
        }
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
        qrsUpdateUserOnline(user.username, socket.id);
        logger(user.username + ' disconnected:', reason);
    });

    //socket connection has error or broken
    socket.on(ioDefaultEvents.error, function(error) {
        qrsUpdateUserOnline(user.username, socket.id);
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

function qrsUpdateUserOnline(username, clientId) {
    var userRooms = [];
    qrsModel.userOffline(username, clientId)
    .then((result) => {//get list room of user
        if (result.length > 0) {
            return models.lists.custom('smembers', models.lists.getKeyUserRoom(username));
        } else {
            return new promise((resolve, reject) => reject(username+' not offline.'));
        }
    })
    .then((results) => {//count user online in each room
        userRooms = results;
        userRooms.push(qrsModel.keyDefaultRoom);
        var commands = [];
        for (var i in userRooms) {
            commands.push(['scard', qrsModel.getKeyUserRoomOnline(results[i])]);
        }
        if (commands.length > 0) {
            return qrsModel.batch(commands);
        } else {
            return new promise((resolve, reject) => reject('No room found.'));
        }
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

/**
 * create socket event base on specific rule of QRS
 * @param  {String} room     room code
 * @param  {String} txtEvent original event code
 * @return {String}          formatted event code
 */
// function createEvent(room, txtEvent) {
//     return (room == qrsModel.keyDefaultRoom) ? txtEvent : (room + '::' + txtEvent);
// }

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
        logger('end update room in QR Service', Object.keys(roomList).length);
    })
    .catch((err) => {
        logger(err);
    });
}

//------------------------------MODULE PUBLIC FUNCTIONS-----------------------
//----------------------------------------------------------------------------

module.exports = (http, session) => {
    io = require('socket.io')(http, {
        path: '/qrchat'
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
    // connectRedis();
    // cleanRedis();

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

module.updateRooms = () => {
    updateRooms();
};