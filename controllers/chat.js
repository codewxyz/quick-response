var auth = global.auth;
var models = global.models;
var logger = global.qrLog;

function getRooms(org) {
    return chatRoomModel.getByOrg(org);
}

exports.show = (req, res) => {
    var user = auth.getUser(req);
    var chatRooms = [];

    //get list chat room user can access
    models.rooms_users.search('*' + user.username, (err, rooms) => {
        for (var i in rooms) {
        	models.rooms.get(rooms[i], (room) => {
        		chatRooms.push(room);
        	});
        }
    });

    res.render('chat_room.html', { user: user, rooms: chatRooms });
};