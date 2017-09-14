var chatRoomModel = require('../models/chat_rooms.js');
var io;
var moment = require('moment');
var session;
var ioEvents = {
	message: 'chat message',
	buzz: 'chat buzz'
};

function getRooms(org='', username) {
	// var rooms = ['public_room_00', 'public_room_01'];
	return chatRoomModel.getByOrg(org);
}

function getOrgs() {
	var orgs = ['ttm'];
	return orgs;
}

function debugLog() {
	console.log('-----------QR Service Log: '+moment().format('HH:mm:ss')+'-----------');
	for (var idx in arguments) {
		console.log(arguments[idx]);
	}
	console.log('-----------QR Service Log End.------------------');

}

function qrJoinRoom(ns, socket, room) {	
    socket.join(room, () => {
        debugLog('user join room ' + room);
    });

    socket.in(room).on(ioEvents.message, function(msg) {
        debugLog('send message', msg);
        var sendObj = {
        	user: user.username,
        	time: moment().format('HH:mm'),
        	msg: msg
        };
        ns.in(room).emit(ioEvents.message, msg);
    });
}

function getSocketUser(socket) {
	return socket.handshake.session.user;
}

function openConnection(type='') {
	switch(type) {
		case 'global':
			io.on('connection', function(socket) {
			    var user = getSocketUser(socket);
				debugLog('global channel is on');

			    socket.on('disconnect', function() {
			        debugLog('global channel', user.username + ' disconnected');
			    });
			    socket.on(ioEvents.message, function(msg) {
			        debugLog('send message', msg);
			        var sendObj = {
			        	user: user.username,
			        	time: moment().format('HH:mm'),
			        	msg: msg
			        };
			        io.emit(ioEvents.message, sendObj);
			    });
			    socket.on('disconnecting', function () {			    	
			        debugLog('global channel', user.username + ' disconnecting...');
			    })
			});
			break;
		case 'namespace':
			// loading namespace for organiztions
			var orgs = getOrgs();
			for (var idx in orgs) {
				var ns = io.of('/'+orgs[idx]).on('connection', function(socket) {
			    	var user = getSocketUser(socket);
					debugLog('org ttm is on');
					//user join room
					var rooms = getRooms(orgs[idx], user.username);
					for (var idx in rooms) {						
						qrJoinRoom(ns, socket, rooms[idx].code);
					}
				});
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

module.exports = (http, getSession) => {
	io = require('socket.io')(http);
	session = getSession;
	return exports;
}

exports.connect = () => {
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

	//there is only one global room
	openConnection('global');
	openConnection('namespace');

}

