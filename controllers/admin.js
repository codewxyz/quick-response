var auth = global.auth;
var models = global.models;
var logger = global.qrLog;

exports.show = function(req, res) {
    var user = auth.getUser(req);
    res.render('admin.html', { user: user });
};

function getRecords(type, records, res) {
    var total = records.length;
    if (total == 0) {
        return new promise(function(resolve, reject) {
            reject({getRecords: false, msg: 'No data found.'});
        });
    }
    var commands = [];
    for (var i in records) {
        commands.push(['hgetall', records[i]]);
    }
    return models[type].batch(commands);
}

exports.getUsers = (req, res) => {

    //get list chat room user can access
    models.users.all()
    .then((users) => {
        return getRecords('users', users, res);
    })
    .then((results) => {
        logger('get list user count '+results.length);
        return res.json({success: true, data: results});
    })
    .catch((err) => {
        logger(err);
        if (err.getRecords != undefined) {
            return res.json({success: false, msg: err.msg});
        }
        return res.json({success: false, msg: 'Cannot get users.'});
    });

};

exports.searchUser = (req, res) => {
    if (!req.query) {
        return res.json({success: false, msg: 'no request param', data: []});
    }
    var term = req.query.term;
    var keyUserList = models.lists.keyGUser;
    //get list chat room user can access
    var searchOption = {
        type: 'set',
        pattern: '*'+term+'*',
        key: keyUserList,
        count: 10
    };
    models.lists.count(keyUserList, 'set')
    .then((total) => {
        logger(total);
        if (total > 0) {
            searchOption.count = total;
            return models.lists.search(searchOption);
        } else {
            return new promise((resolve, reject) => {
                reject('No data found.');
            });
        }
    })
    .then((results) => {
        logger('search list user count '+results.length);
        var dt = ['No data found.'];
        if (results[1].length > 0) {
            dt = results[1];
        }
        return res.json({success: true, data: dt});
    })
    .catch((err) => {
        logger(err);
        return res.json({success: false, msg: 'Error'});
    });

};

exports.getOrgs = (req, res) => {

    //get list chat room user can access
    models.orgs.all()
    .then((orgs) => {
        logger(orgs);
        return getRecords('orgs', orgs, res);
    })
    .then((results) => {
        logger('get list org count '+results.length);
        return res.json({success: true, data: results});
    })
    .catch((err) => {
        logger(err);
        if (err.getRecords != undefined) {
            return res.json({success: false, msg: err.msg});
        }
        return res.json({success: false, msg: 'Cannot get orgs.'});
    });

};

exports.getRooms = (req, res) => {

    //get list chat room user can access
    models.rooms.all()
    .then((rooms) => {
        return getRecords('rooms', rooms, res);
    })
    .then((results) => {
        logger('get list room count '+results.length);
        return res.json({success: true, data: results});
    })
    .catch((err) => {
        logger(err);
        if (err.getRecords != undefined) {
            return res.json({success: false, msg: err.msg});
        }
        return res.json({success: false, msg: 'Cannot get rooms.'});
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

    //format data to save
    if (formParam.avatar == '') {
        formParam.avatar = './images/default-user.png';
    }
    delete formParam.password2;

    var commands = [
        ['hmset', formParam.username, formParam],
        ['sadd', models.lists.getKey(models.lists.keyGUser, true), formParam.username]
    ];

    models.lists.mexists(models.lists.keyGUser, formParam.username)
    .then((hasUser) => {
        if (hasUser == 0) {
            return models.users.multi(commands);
        } else {
            return new promise(function(resolve, reject) {
                reject({validate: false, msg: 'This username has been registered.'});
            });
        }
    })
    .then((createResult) => {
        if (createResult != null && createResult.length == commands.length) {
            return res.json({success: true, msg: 'Created successfully.'});
        } else {
            return res.json({success: false, msg: 'Failed to create user.'});
        }
    })
    .catch((err) => {
        logger(err);
        if (err.validate != undefined && !err.validate) {
            return res.json({success: false, msg: err.msg});
        }
        return res.json({success: false, msg: 'Failed to create user.'});
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
        return res.json({success: false});
    });
};

exports.addOrg = (req, res) => {
    var formParam = req.body;
    if (formParam.code == '' || formParam.name == '') {
        return res.json({success: false, msg: 'Invalid data.'});
    }

    var commands = [
        ['hmset', formParam.code, formParam],
        ['sadd', models.lists.getKey(models.lists.keyGOrg, true), formParam.code]
    ];

    models.lists.mexists(models.lists.keyGOrg, formParam.code)
    .then((hasOrg) => {
        if (hasOrg == 0) {
            return models.orgs.multi(commands);
        } else {
            return new promise(function(resolve, reject) {
                reject({validate: false, msg: 'This organization has been registered.'});
            });
        }
    })
    .then((createResult) => {
        if (createResult != null && createResult.length == commands.length) {
            return res.json({success: true, msg: 'Created successfully.'});
        } else {
            return res.json({success: false, msg: 'Failed to create organization.'});
        }
    })
    .catch((err) => {
        logger(err);
        if (err.validate != undefined && !err.validate) {
            return res.json({success: false, msg: err.msg});
        }
        return res.json({success: false, msg: 'Failed to create organization.'});
    });
};

exports.addOrgUsers = (req, res) => {
    if (!req.body) {
        return res.json({success: false, msg: 'No request param.'});
    }
    var userList = req.body.list.split(', ');
    var org = req.body.org;
    if (userList[userList.length-1] == '') {
        userList.pop();
    }
    var createOpts = {
        code: models.lists.getKeyOrgUser(org),
         data: userList
    };

    models.lists.create(createOpts)
    .then((result) => {
        if (result > 0) {
            return res.json({success: true, msg: 'Added successfully.'});
        } else {
            return new promise(function(resolve, reject) {
                reject({validate: false, msg: 'These users has been added.'});
            });
        }
    })
    .catch((err) => {
        logger(err);
        return res.json({success: false, msg: 'Failed to add users.'});
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
        return res.json({success: false});
    });
};