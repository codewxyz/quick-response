var chatRoomModel = require('../models/chat_rooms.js');
var userModel = require('../models/users.js');
var moment = require('moment');
var redis = global.dbRedis.socket;
var io;
var session;
var nsList = {};
var roomList = {};

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
function debugLog() {
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

function callbackGetRedis(clientId) {
	return function (err, rep) {
		if (rep != null && rep.length > 0) {
			redis.hset('user:'+user.username+':devices', rep.length, clientId);
		} else {
			redis.hset('user:'+user.username+':devices', 0, clientId);
		}
	}
}

function qrsCountUserOnline(room, num) {
	redis.hincrby('rooms:online', room, num);
	redis.hget('rooms:online', (err, rep) => {	
		if (err) throw err;
	    var countObj = {
	    	count: rep
	    };	
	    io.emit(createEvent(room, ioEvents.count_online), countObj); 
	});
}

function updateUserInfo(user, clientId) {
	redis.hget('users:list:'+user.username, 'status', (err, rep) => {
		if (rep != null && rep == 0) {
			redis.hset('users:list:'+user.username, 'status', 1);
		}
	});
	redis.hgetall('users:devices:'+user.username, (err, rep) => {
		redis.hset('users:devices:'+user.username, clientId, 1);
	});
}

/**
 * open connection for socket server
 * @param  {String} type [description]
 * @return {Boolean}      [description]
 */
function openConnection(type='') {
	switch(type) {
		case 'global':
			debugLog('start listen on world channel');
			io.on(ioDefaultEvents.connect, function (socket) {
				var user = getSocketUser(socket);
				updateUserInfo(user, socket.client.id);

				debugLog('world channel: '+user.username+' joined');

			    socket.on(ioEvents.message, function(msg) {
			        debugLog(user.username+' send message:', msg);
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
				debugLog('start listen on org '+orgs[idx]);
				nsList[orgs[idx]] = io.of('/'+orgs[idx]).on(ioDefaultEvents.connect, callbackNS(idx, orgs[idx]));
			}
			break;
		case 'room':
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

		debugLog('org '+org+': '+user.username+' joined');

		//user join room
		var rooms = getRooms(org, user.username);
		for (var idx in rooms) {
			var room = rooms[idx].code;
			qrsJoinRoom(socket, room);
			qrsSocketEvents(nsIdx, socket, room);
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
        debugLog(user.username + ' joined room ' + room);
    	qrsCountUserOnline(room, user.username);
    });
}

function qrsLeaveRoom(socket, room) {	
	var user = getSocketUser(socket);
    socket.leave(room, () => {
        debugLog(user.username + ' leaved room ' + room);
        qrsCountUserOnline(room, user.username, -1);
    });
}

function qrsSocketEvents(nsIdx, socket, room) {
        debugLog(nsIdx, room);
	var user = getSocketUser(socket);
    socket.in(room).on(createEvent(room, ioEvents.message), function(msg) {
        debugLog(user.username + ' send message', msg, nsIdx, room);
        var sendObj = {
        	user: user.username,
        	avatar: user.avatar,
        	name: user.name,
        	time: moment().format('HH:mm'),
        	msg: msg.content
        };
        var ns = msg.ns.replace('/', '');
        nsList[ns].in(room).emit(createEvent(room, ioEvents.message), sendObj);
    });
}

function qrsSocketDefaultEvents(socket, type=1) {
	var user = getSocketUser(socket);
	var nUser = userModel.get(user.id);

    socket.on(ioDefaultEvents.disconnecting, function (reason) {	
    	if (type == 1) {
    		redis.hdel('users:devices:'+user.username, socket.client.id);
    	}
        debugLog(user.username + ' disconnecting:', reason, socket.id);
    })

    socket.on(ioDefaultEvents.disconnect, function(reason) {
    	debugLog(socket.rooms);
    	redis.hgetall('users:devices:'+user.username, (err, rep) => {
    		if(rep == null || rep.length == 0) {
    			for (var idx in roomList) {
    				qrsCountUserOnline(roomList[idx].code, user.username, -1);
    			}
    		}
    	});
        debugLog(user.username + ' disconnected:', reason);
    });

    socket.on(ioDefaultEvents.error, function(error) {
        debugLog(user.username + ' socket connection error:', error);
    });
}

function qrsCountUserOnline(room, username, type=1) {
	if (type == 1) {		
		redis.hset('rooms:online:'+room, username, 1);
	} else {		
		redis.hdel('rooms:online:'+room, username);
	}
	redis.hkeys('rooms:online:'+room, callbackGetClients(room))
}

function callbackGetClients(room) { 
    return function (error, rep) {
		if (error) throw error;
	    var countObj = {
	    	count: rep.length
	    };
	    io.emit(createEvent(room, ioEvents.count_online), countObj); 
    };
}

function createEvent(room, txtEvent) {
	return room == 'room' ? txtEvent : room + '::' + txtEvent;
}

module.exports = (http, getSession) => {
	io = require('socket.io')(http);
	session = getSession;

	debugLog('start socket.io server');

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

exports.connect = () => {

	// openConnection('global');
	// openConnection('namespace');

}

