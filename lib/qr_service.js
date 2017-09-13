var io;
var moment = require('moment');

module.exports = (http) => {
	io = require('socket.io')(http);
	return exports;
}

exports.connect = () => {
	//handling socket.io
	io.on('connection', function(socket) {
	    console.log('qr service: ' + socket.id + ' connected');
	    console.log(socket.request);


	    socket.on('disconnect', function() {
	        console.log('qr service: ' + ' disconnected');
	    });
	    socket.on('global room msg', function(msg) {
	        console.log('qr service: ' + msg);
	        var sendObj = {
	        	// user: user.username,
	        	time: moment().format('HH:mm'),
	        	msg: msg
	        };
	        io.emit('global room msg', sendObj);
	    });
	})
}

// socket for ttm
// var ttm = io.of('/ttm-chat');
// ttm.on('connection', function(socket) {
//     console.log('someone connected to ttm');
//     socket.join('tinh tinh', () => {
//         let rooms = Object.keys(socket.rooms);
//         console.log(rooms); // [ <socket.id>, 'room 237' ]
//     });

//     socket.in('tinh tinh').on('chat message', function(msg) {
//         console.log('ttm room tinh tinh ' + msg);
//         ttm.in('tinh tinh').emit('chat message', msg);
//     });

//     console.log('socket id ' + socket.id);
//     console.log('rooms ');
//     console.log(socket.rooms);
// });