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
    models.rooms_users.search('*' + user.username, (rooms) => {
        var total = rooms.length;
        if (total == 0) {
            return res.render('chat_room.html', { user: user, rooms: chatRooms });
        }
        for (var i in rooms) {
        	models.rooms.get(rooms[i], (room) => {
        		chatRooms.push(room);
                total--;
                if (total == 0) {
                    return res.render('chat_room.html', { user: user, rooms: chatRooms });
                }
        	});
        }
    });

    // return res.render('chat_room.html', { user: user, rooms: chatRooms });
};