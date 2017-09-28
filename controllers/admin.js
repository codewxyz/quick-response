var auth = global.auth;
var models = global.models;
var logger = global.qrLog;

exports.show = (req, res) => {
    var user = auth.getUser(req);
    res.render('admin.html', { user: user });
};

function getRecords(type, records, res) {
    var total = records.length;
    if (total == 0) {
        return res.json(null);
    }
    var fail = 0;
    var commands = [];
    for (var i in records) {
        commands.push(['hgetall', records[i]]);
        models[type].batch(commands, false, (err, results) => {
            if (err) {
                fail++;
            }
            total--;
            if (total == 0) {
                logger('get list number of fail: '+fail);
                logger(results);
                return res.json(results);
            }
        });
    }
}

exports.getUsers = (req, res) => {

    //get list chat room user can access
    models.users.all((users) => {
        getRecords('users', users, res);
    });

    // res.render('chat_room.html', { user: user, rooms: chatRooms });
};
exports.getOrgs = (req, res) => {

    //get list chat room user can access
    models.orgs.all((orgs) => {
        getRecords('orgs', orgs, res);
    });

    // res.render('chat_room.html', { user: user, rooms: chatRooms });
};
exports.getRooms = (req, res) => {

    //get list chat room user can access
    models.rooms.all((rooms) => {
        getRecords('rooms', rooms, res);
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

    var commands = [
        ['hmset', formParam],
        ['sadd', models.lists.keyGUser, formParam.username]
    ];
    var total = commands.length;
    models.users.multi(commands, false, (err, results) => {
        if (err) {
            logger(err);
            throw err;
        }
        total--;
        logger(err, results);
        if (total == 0) {
            if (results != null && results.length == commands.length) {
                return res.json({success: true});
            }
            return res.json({success: false})
        }
    });

    // models.users.create(formParam, (rep) => {
    //     if (rep != null) {
    //         return res.json({success: true});
    //     }
    //     return res.json({success: false})
    // });

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

exports.addOrgUser = (req, res) => {
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