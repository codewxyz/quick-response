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
    var orgCode = req.query.org;
    var keyUserList = models.lists.getKeyOrgNUser(orgCode);
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
                reject({ label: "no data found", value: "no-data" });
            });
        }
    })
    .then((results) => {
        logger('search list user count '+results.length);
        var dt = [];
        if (results[1].length > 0) {
            dt = results[1];
        } else {
            dt = [{ label: "no data found", value: "no-data" }];
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

/**
 * create user
 * @param  {Request} req [description]
 * @param  {Resonse} res [description]
 * @return {Json}     [description]
 */
exports.addUser = (req, res) => {
    var formParam = req.body;
    //--------------validate user information-----------
    if (formParam.username == '' || formParam.name == '' || formParam.password == '') {
        return res.json({success: false, msg: 'Invalid data.'});
    }
    if (formParam.password != formParam.password2) {
        return res.json({success: false, msg: 'Invalid data.'});
    }

    //-------------format data to save---------------
    if (formParam.avatar == '') {
        formParam.avatar = './images/default-user.png';
    }
    delete formParam.password2;

    var commands = [
        ['hmset', formParam.username, formParam],//create user
        ['sadd', models.lists.getKey(models.lists.keyGUser, true), formParam.username]//add user to global list
    ];

    models.lists.mexists(models.lists.keyGUser, formParam.username)
    .then((hasUser) => {//validate username
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
            updateListHasUser();
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

function updateListHasUser() {
    logger('start to store diff user...', models.lists.keyGOrg);
    models.lists.redis().smembers(models.lists.getKey(models.lists.keyGOrg), (err, reps) => {
        if (err) {
            logger(err);
            return;
        }

        var commands = [];
        for (var i in reps) {
            commands.push(['sdiffstore', models.lists.getKey(models.lists.getKeyOrgNUser(reps[i])), 
                models.lists.getKey(models.lists.keyGUser),
                 models.lists.getKey(models.lists.getKeyOrgUser(reps[i]))]);
        }

        if (commands.length > 0)
            models.lists.redis().batch(commands).exec((err, rep) => {
                logger('end store diff user...', err, rep);
            });

    });
}

/**
 * create room in an organization
 * @param  {Request} req [description]
 * @param  {Response} res [description]
 * @return {Json}     [description]
 */
exports.addRoom = (req, res) => {
    // var formParam = req.body;
    // if (formParam.code == '' || formParam.name == '' || formParam.org == '') {
    //     return res.json({success: false, msg: 'Invalid data.'});
    // }
    // if (formParam.avatar == '') {
    //     formParam.avatar = './images/room-public.png';
    // }

    // models.rooms.create(formParam, (rep) => {
    //     if (rep != null) {
    //         return res.json({success: true});
    //     }
    //     return res.json({success: false});
    // });
};

/**
 * create organization
 * @param  {Request} req [description]
 * @param  {Response} res [description]
 * @return {Json}     [description]
 */
exports.addOrg = (req, res) => {
    var formParam = req.body;
    //-------------validate data-----------------
    var rg = new RegExp(/^[a-zA-Z0-9\-\_]{3,}$/i);
    formParam.code = formParam.code.trim();
    if (!rg.test(formParam.code)) {
        return res.json({success: false, msg: 'Code is required and cannot contain special characters (except: "-" and "_").'});            
    }
    if (0 == formParam.name.length || formParam.name.length > 50) {
        return res.json({success: false, msg: 'Name is required and has maximum length of 50 charactrers.'});
    }

    var commands = [
        ['hmset', formParam.code, formParam],
        ['sadd', models.lists.getKey(models.lists.keyGOrg, true), formParam.code]
    ];

    models.lists.mexists(models.lists.keyGOrg, formParam.code)
    .then((hasOrg) => {//validate organization code
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

/**
 * add user to an organization
 * @param  {Request} req [description]
 * @param  {Response} res [description]
 * @return {Json}     [description]
 */
exports.addOrgUsers = (req, res) => {
    if (!req.body) {
        return res.json({success: false, msg: 'No request param.'});
    }
    //get data and validate
    var userList = req.body.list.split(', ').map((val) => {
        return val.trim();
    }).filter((val) => {
        return val != '';
    });    
    var orgCode = req.body.org;
    var commands = [];

    for (var i in userList) {
        commands.push(['sismember', models.lists.keyGUser, userList[i]]);
    }

    models.lists.batch(commands)
    .then((results) => {//validate username
        logger(results);
        if (results.length != userList.length) {
            return new promise((resolve, reject) => reject('Error checking username.'));
        }
        var finalList = [];
        for (var i in results) {
            if (results[i] == 1) {
                finalList.push(userList[i]);
            }
        }
        if (finalList.length > 0) {
            var createOpts = {
                code: models.lists.getKeyOrgUser(orgCode),
                 data: finalList
            };
            return models.lists.create(createOpts);
        } else {
            return new promise((resolve, reject) => reject('List username is not valid.'));
        }
    })
    .then((result) => {//add username to list
        if (result > 0) {
            updateListOrg(orgCode);
            return res.json({success: true, msg: 'Added successfully.'});
        } else {
            return res.json({success: true, msg: 'These users has been added.'});
        }
    })
    .catch((err) => {
        logger(err);
        return res.json({success: false, msg: 'Failed to add users.'});
    });
};

function updateListOrg(orgCode) {
    models.lists.redis().sdiffstore(models.lists.getKey(models.lists.getKeyOrgNUser(orgCode)), 
        models.lists.getKey(models.lists.keyGUser), 
        models.lists.getKey(models.lists.getKeyOrgUser(orgCode)), 
        (err, rep)=>logger('stored diff user org', err, rep));
}

// exports.addOrgUser = (req, res) => {
//     var formParam = req.body;
//     logger(formParam);
//     if (formParam.code == '' || formParam.name == '') {
//         return res.json({success: false, msg: 'Invalid data.'});
//     }

//     models.orgs.create(formParam, (rep) => {
//         if (rep != null) {
//             return res.json({success: true});
//         }
//         return res.json({success: false});
//     });
// };