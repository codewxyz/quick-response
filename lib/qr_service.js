var chatRoomModel = require('../models/chat_rooms.js');
var userModel = require('../models/users.js');
var moment = require('moment');
var redisModule = require('redis');
var redis;
var io;
var nsList = {};
var roomList = {};
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
function getRooms(org='', username) {
	// var rooms = ['public_room_00', 'public_room_01'];
	return chatRoomModel.getByOrg(org);
}

/**
 * get list of namspaces (organization)
 * @return {array} [description]
 */
function getOrgs() {
	var orgs = ['ttm', 'GB'];
	return orgs;
}

/**
 * log message on console for debug
 * @return {void} [description]
 */
function logger() {
	console.log('-----------QR Service Log: '+moment().format('HH:mm:ss')+'-----------');
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
	redis.hget('users:list:'+user.username, 'status', (err, rep) => {
		logger('uss list', rep);
		if (rep == null || rep == 0) {
			//update user online status
			redis.hset(redisKeys.ulist+user.username, 'status', 1);
		} else {
			redis.hset(redisKeys.ulist+user.username, 'status', 0);
		}
	});

	//update devices (client id) user logged in
	redis.hset(redisKeys.udevice+user.username, clientId, 1);
}

/**
 * open connection for socket server
 * @param  {String} type [description]
 * @return {Boolean}      [description]
 */
function openConnection(type) {
	switch(type) {
		case 'global':
			logger('start listen on world channel');
			io.on(ioDefaultEvents.connect, function (socket) {
				var user = getSocketUser(socket);
				updateUserInfo(user, socket.id);

				logger('world channel: '+user.username+' joined');

			    socket.on(ioEvents.message, function(msg) {
			        logger(user.username+' send message:', msg);
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
			break;
		case 'namespace':
			// loading namespace for organizations
			var orgs = getOrgs();
			for (var idx in orgs) {
				logger('start listen on org '+orgs[idx]);
				nsList[orgs[idx]] = io.of('/'+orgs[idx]).on(ioDefaultEvents.connect, callbackNS(orgs[idx], orgs[idx]));
			}
			break;
		default:
			return false;
			break;
	}
	return true;
}

/**
 * callback for namespace
 * @param  {Socket.io} ns  namespace server
 * @param  {String} org namespace name
 * @return {void}     [description]
 */
function callbackNS(nsIdx, org) {
	return function (socket) {
		var user = getSocketUser(socket);
		var ns = nsList[nsIdx];

		logger('org '+org+': '+user.username+' joined');

		//user join room
		var rooms = getRooms(org, user.username);
		for (var idx in rooms) {
			var room = rooms[idx].code;
			qrsJoinRoom(socket, room);
			qrsSocketEvents(ns, socket, room);
		}

		qrsSocketDefaultEvents(socket);
	};
}

/**
 * user join room
 * @param  {Socket.io} ns     socket server instance
 * @param  {Socket} socket socket connection of user
 * @param  {String} room   room name
 * @return {void}        [description]
 */
function qrsJoinRoom(socket, room, isNew=false) {	
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
function qrsSocketDefaultEvents(socket, type=1) {
	var user = getSocketUser(socket);
	var nUser = userModel.get(user.id);

	//socket in disconnection
    socket.on(ioDefaultEvents.disconnecting, function (reason) {	
    	if (type == 0) {
    		//delete this device (socket id) from this user's list device
    		redis.hdel(redisKeys.udevice+user.username, socket.id);
    	}
        logger(user.username + ' disconnecting:', reason);
    })

    //socket disconnected
    socket.on(ioDefaultEvents.disconnect, function(reason) {
    	redis.hgetall(redisKeys.udevice+user.username, (err, rep) => {
    		if(rep == null || rep.length == 0) {
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
function qrsCountUserOnline(room, username, type=1) {
	if (type == 1) {		
		redis.hset(redisKeys.ronline+room, username, 1);
	} else {		
		redis.hdel(redisKeys.ronline+room, username);
	}
	redis.hkeys(redisKeys.ronline+room, callbackGetClients(room))
}

/**
 * callback for event in qrsCountUserOnline()
 * @param  {String} room room code
 * @return {Function}      [description]
 */
function callbackGetClients(room) { 
    return function (error, rep) {
		if (error) throw error;
	    var countObj = {
	    	count: rep.length
	    };
	    io.emit(createEvent(room, ioEvents.count_online), countObj); 
    };
}

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
	redis = redisModule.createClient({
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
	redis.keys(redisPrefix+'*', (err, rep) => {
		var arr = [];
		rep.forEach((val)=> {
			arr.push(val.slice(redisPrefix.length));
		});

		// logger(arr);
		if (arr.length > 0)
			redis.del(arr);
	});
}

//------------------------------MODULE PUBLIC FUNCTIONS-----------------------
//----------------------------------------------------------------------------

module.exports = (http, session) => {
	io = require('socket.io')(http);

	logger('start socket.io server');

	connectRedis();
	cleanRedis();

	var orgs = getOrgs();
	io.use(session); 
	for (var idx in orgs) {
		io.of('/'+orgs[idx]).use(session);
	}
	io.use(function (socket, next) {
		var user = socket.handshake.session.user;
		if (user == undefined || user.length == 0) {
			next(new Error('Authentication error'));
		} else {
			return next();
		}
	}); 

	var allRooms = chatRoomModel.list();
	for (var idx in allRooms) {
		var r = allRooms[idx];
		roomList[r.code] = {
			online: 0,
			name: r.name,
			code: r.code,
			org: r.ns
		};		
	}
	openConnection('global');
	openConnection('namespace');

	return exports;
}

