var auth = global.auth;
var chatRoomModel = require('../models/chat_rooms.js');

function getRooms() {
	// var rooms = [{ns: '', name: 'public_room_00'}, {ns: '', name: 'public_room_01'}];
	return chatRoomModel.getByOrg('ttm');
}

exports.show = (req, res) => {
	var loginUser = auth.getUser(req);
	var chatRooms = getRooms();
	var globalRooms = [{ns: '', code: 'global_room', name: 'Global Room'}];
    res.render('chat_room.html', {user: loginUser, rooms: chatRooms, gRooms: globalRooms});
};