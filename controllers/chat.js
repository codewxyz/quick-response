var auth = global.auth;
var chatRoomModel = require('../models/chat_rooms.js');

function getRooms(org) {
	return chatRoomModel.getByOrg(org);
}

exports.show = (req, res) => {
	var loginUser = auth.getUser(req);
	var chatRooms = getRooms('ttm');
	var globalRooms = getRooms('GB');
    res.render('chat_room.html', {user: loginUser, rooms: chatRooms, gRooms: globalRooms});
};