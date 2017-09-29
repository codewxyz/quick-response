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
    var commands = [];
    for (var i in records) {
        commands.push(['hgetall', records[i]]);
    }
    logger(records);
    models[type].batch(commands, false, (err, results) => {
        logger('get list user count '+results.length);
        return res.json(results);
    });
}

exports.getUsers = (req, res) => {

    //get list chat room user can access
    models.users.all((users) => {
        getRecords('users', users, res);
    });

};

exports.getOrgs = (req, res) => {

    //get list chat room user can access
    models.orgs.all((orgs) => {
        getRecords('orgs', orgs, res);
    });

};

exports.getRooms = (req, res) => {

    //get list chat room user can access
    models.rooms.all((rooms) => {
        getRecords('rooms', rooms, res);
    });

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
        ['hmset', formParam.username, formParam],
        ['sadd', models.lists.getKey(models.lists.keyGUser, true), formParam.username]
    ];
    models.users.multi(commands, true, (results) => {
        logger(results);
        if (results != null && results.length == commands.length) {
            return res.json({success: true});
        }
        return res.json({success: false});
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