var auth = global.auth;
var models = global.models;
var logger = global.qrLog;

exports.show = (req, res) => {
    var user = auth.getUser(req);
    res.render('admin.html', { user: user });
};

exports.getUsers = (req, res) => {
    var usersList = [];

    //get list chat room user can access
    models.users.all((users) => {
        var total = users.length;
        if (total == 0) {
            return res.json(null);
        }
        for (var i in users) {
            models.users.get(users[i], (user) => {
                usersList.push(user);
                total--;
                if (total == 0) {
                     return res.json(usersList);
                }
            });
        }
    });

    // res.render('chat_room.html', { user: user, rooms: chatRooms });
};
exports.getOrgs = (req, res) => {
    var orgsList = [];

    //get list chat room user can access
    models.orgs.all((orgs) => {
        var total = orgs.length;
        if (total == 0) {
            return res.json(null);
        }
        for (var i in orgs) {
            models.orgs.get(orgs[i], (org) => {
                orgsList.push(org);
                total--;
                if (total == 0) {
                     return res.json(orgsList);
                }
            });
        }
    });

    // res.render('chat_room.html', { user: user, rooms: chatRooms });
};
exports.getRooms = (req, res) => {
    var roomsList = [];

    //get list chat room user can access
    models.rooms.all((rooms) => {
        var total = rooms.length;
        if (total == 0) {
            return res.json(null);
        }
        for (var i in rooms) {
            models.rooms.get(rooms[i], (room) => {
                roomsList.push(room);
                total--;
                if (total == 0) {
                     return res.json(roomsList);
                }
            });
        }
    });

    // res.render('chat_room.html', { user: user, rooms: chatRooms });
};

exports.addUser = (req, res) => {
    var formParam = req.body;
    if (formParam.username == '' || formParam.name == '' || formParam.password == '') {
        return res.json({success: false, msg: 'Invalid data.'});
    }
    if (formParam.password != formParam.password2) {
        return res.json({success: false, msg: 'Invalid data.'});
    }
    if (formParam.avatar == '') {
        formParam.avatar = './images/default-user.png';
    }
    delete formParam.password2;

    models.users.create(formParam, (rep) => {
        if (rep != null) {
            return res.json({success: true});
        }
        return res.json({success: false})
    });

};

exports.addRoom = (req, res) => {
    var formParam = req.body;
    if (formParam.code == '' || formParam.name == '' || formParam.org == '') {
        return res.json({success: false, msg: 'Invalid data.'});
    }
    if (formParam.avatar == '') {
        formParam.avatar = './images/room-public.png';
    }

    models.rooms.create(formParam, (rep) => {
        if (rep != null) {
            return res.json({success: true});
        }
        return res.json({success: false})
    });
};

exports.addOrg = (req, res) => {
    var formParam = req.body;
    logger(formParam);
    if (formParam.code == '' || formParam.name == '') {
        return res.json({success: false, msg: 'Invalid data.'});
    }

    models.orgs.create(formParam, (rep) => {
        if (rep != null) {
            return res.json({success: true});
        }
        return res.json({success: false})
    });
};