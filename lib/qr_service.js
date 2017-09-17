var chatRoomModel = require('../models/chat_rooms.js');
var io;
var moment = require('moment');
var session;
var nsList = [];

/**
 * list of events a socket connection might emit
 * @type {Object}
 */
var ioEvents = {
	message: 'chat message',
	buzz: 'chat buzz'
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

/**
 * open connection for socket server
 * @param  {String} type [description]
 * @return {Boolean}      [description]
 */
function openConnection(type='') {
	switch(type) {
		case 'global':
			io.on(ioDefaultEvents.connect, function (socket) {
				debugLog('world channel is on');
				var user = getSocketUser(socket);
			    socket.on(ioEvents.message, function(msg) {
			        debugLog('send message:', msg);
			        var sendObj = {
			        	user: user.username,
			        	time: moment().format('HH:mm'),
			        	msg: msg.content
			        };
			        io.emit(ioEvents.message, sendObj);
			    });

			    socketDefaultEvents(socket);
			});
			break;
		case 'namespace':
			// loading namespace for organizations
			var orgs = getOrgs();
			for (var idx in orgs) {
				nsList[idx] = io.of('/'+orgs[idx]).on(ioDefaultEvents.connect, callbackNS(idx, orgs[idx]));
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

		debugLog('org '+org+' is on');

		//user join room
		var rooms = getRooms(org, user.username);
		for (var idx in rooms) {						
			qrJoinRoom(nsList[nsIdx], socket, rooms[idx].code);
		}

		socketDefaultEvents(socket);
	};
}

/**
 * user join room
 * @param  {Socket.io} ns     socket server instance
 * @param  {Socket} socket socket connection of user
 * @param  {String} room   room name
 * @return {void}        [description]
 */
function qrJoinRoom(ns, socket, room) {	
	var user = getSocketUser(socket);
    socket.join(room, () => {
        debugLog(user.username + ' joined room ' + room);
    });

    socket.in(room).on(room + '::' + ioEvents.message, function(msg) {
        debugLog('send message', msg);
        var sendObj = {
        	user: user.username,
        	time: moment().format('HH:mm'),
        	msg: msg.content
        };
        ns.in(room).emit(room + '::' + ioEvents.message, sendObj);
    });
}

function socketDefaultEvents(socket) {
	var user = getSocketUser(socket);

    socket.on(ioDefaultEvents.disconnecting, function (reason) {			    	
        debugLog(user.username + ' disconnecting:', reason);
    })

    socket.on(ioDefaultEvents.disconnect, function(reason) {
        debugLog(user.username + ' disconnected:', reason);
    });

    socket.on(ioDefaultEvents.error, function(error) {
        debugLog(user.username + ' socket connection error:', error);
    });
}

module.exports = (http, getSession) => {
	io = require('socket.io')(http);
	session = getSession;
	var orgs = getOrgs();
	debugLog('start socket.io server');
	io.use(session); 
	for (var idx in orgs) {
		io.of('/'+orgs[idx]).use(session);
	}
	io.use(function (socket, next) {
		debugLog(socket.handshake.session);
		var user = socket.handshake.session.user;
		if (user == undefined || user.length == 0) {
			next(new Error('Authentication error'));
		} else {
			return next();
		}
	}); 
	openConnection('global');
	openConnection('namespace');
	return exports;
}

exports.connect = () => {

	// openConnection('global');
	// openConnection('namespace');

}

