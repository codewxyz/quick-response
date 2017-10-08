var auth = global.auth;
var models = global.models;
var logger = global.qrLog;
var qrsModel = new (require('../models/QRSModel.js'))();

exports.show = (req, res) => {
    var user = auth.getUser(req);
    var chatRooms = [];

    //get list chat room user can access
    models.lists.custom('smembers', models.lists.getKeyUserRoom(user.username))
    .then((rooms) => {
        var commands = [];
        for (var i in rooms) {
            commands.push(['hgetall', rooms[i]]);
        }
        if (commands.length > 0) {
            return models.rooms.batch(commands);
        } else {
            return new promise((resolve, reject) => resolve([]));
        }
    })
    .then((rooms) => {
        if (rooms.length == 0) {
            return res.render('chat_room.html', { user: user, rooms: chatRooms });
        }
        for (var i in rooms) {
    		chatRooms.push(rooms[i]);
        }
        return res.render('chat_room.html', { user: user, rooms: chatRooms });
    })
    .catch((err) => {
        logger(err);
        return res.status(500).send('Server error.');
    });
};


/**
 * create room in an organization
 * @param  {Request} req [description]
 * @param  {Response} res [description]
 * @return {Json}     [description]
 */
exports.addRoom = (req, res) => {
    if (!req.body) {        
        return res.json({success: false, msg: 'no request param', data: []});
    }
    var user = auth.getUser(req);
    var formParam = req.body;
    //-------------validate data-----------------
    if (0 == formParam.name.length || formParam.name.length > 50) {
        return res.json({success: false, msg: 'Name is required and has maximum length of 50 charactrers.'});
    }

    //------------check & set default value-------------
    if (formParam.org == '') {
        formParam.org = models.orgs.defaultCode;
    }
    if (formParam.avatar == '') {
        formParam.avatar = './images/room-public.png';
    }
    var room = {
        code: global.system.shortid.generate(),
        avatar: formParam.avatar,
        org: formParam.org,
        name: formParam.name
    };

    var userList = req.body.users.split(', ').map((val) => {
        return val.trim();
    }).filter((val) => {
        return (val != '') && (val != user.username);
    });
    userList.push(user.username);

    var commands = [
        ['hmset', room.code, room],
        ['sadd', models.lists.getKey(models.lists.keyGRoom, true), room.code],
        ['sadd', models.lists.getKey(models.lists.getKeyOrgRoom(room.org), true), room.code]
    ];

    models.lists.mexists(models.lists.keyGRoom, room.code)
    .then((hasRoom) => {//validate room code
        if (hasRoom == 0) {
            return models.lists.mexists(models.lists.keyGOrg, room.org);
        } else {
            return new promise(function(resolve, reject) {
                reject({validate: false, msg: 'This code room '+room.code+' has been registered.'});
            });
        }
    })
    .then((hasOrg) => {//validate organization code
        if (hasOrg == 1) {
            return models.rooms.multi(commands);
        } else {
            return new promise(function(resolve, reject) {
                reject({validate: false, msg: 'This organization '+room.org+' does not exist.'});
            });
        }
    })
    .then((createResult) => {
        if ((createResult != null) && 
            (createResult.length == commands.length)) {
            //add user to this room
            addUsersToRoom(room, userList);
            return res.json({success: true, msg: 'Created successfully.', data: room});
        } else {
            return res.json({success: false, msg: 'Failed to create room.'});
        }
    })
    .catch((err) => {
        logger(err);
        return res.json({success: false, msg: 'Failed to create room.'});
    });
};


exports.getRoomMembers = (req, res) => {
    if (!req.body) {
        return res.json({success: false, msg: 'no request param', data: []});
    }
    var roomCode = req.body.roomCode;
    var roomKey = models.lists.getKeyRoomUser(roomCode);
    if (roomCode == models.rooms.defaultCode) {
        roomKey = models.lists.keyGUser;
    }
    var userList = [];

    models.lists.custom('smembers', roomKey)
    .then((results) => {
        if (results.length > 0) {
            var commands = [];
            results.forEach((username) => {
                commands.push(['hgetall', username]);
            });
            return models.users.batch(commands);
        } else {
            return new promise((resolve, reject) => resolve([]));
        }
    })
    .then((results) => {
        if (getLength(results) > 0) {
            userList = results;
            var commands = [];
            results.forEach((user) => {
                commands.push(['sismember', qrsModel.keyGUserOnline, user.username]);
            });
            return qrsModel.batch(commands);
        } else {
            return new promise((resolve, reject) => resolve([]));
        }
    })
    .then((results) => {
        if ((getLength(results) > 0) && (getLength(results) == userList.length)) {

            results.forEach((status, idx) => {
                if (status == 1) {
                    userList[idx].status = 'online';
                } else {
                    userList[idx].status = 'offline';
                }
            });
            return res.json({success: true, data: userList});
        } else {
            return new promise((resolve, reject) => reject([]));
        }
    })
    .catch((err) => {
        logger(err);
        return res.json({success: false, msg: 'Failed to get room memebers.'});
    });

};
exports.searchUser = (req, res) => {
    if (!req.query) {
        return res.json({success: false, msg: 'no request param', data: []});
    }
    var user = auth.getUser(req);
    var term = req.query.term;
    var orgCode = req.query.org != '' ? req.query.org : 'qrgb';
    var keyUserList = models.lists.getKeyOrgUser(orgCode);
    var searchOption = {
        type: 'set',
        pattern: '*'+term+'*',
        key: keyUserList,
        count: 10
    };
    models.lists.count(keyUserList, 'set')
    .then((total) => {
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
        var dt = [];
        if (results[1].length > 0) {
            dt = results[1];
        } else {
            dt = [{ label: "no data found", value: "no-data" }];
        }
        dt = dt.filter((val) => {
            return val != user.username;
        });
        if (dt.length == 0) {            
            dt = [{ label: "no data found", value: "no-data" }];
        }
        return res.json({success: true, data: dt});
    })
    .catch((err) => {
        logger(err);
        return res.json({success: false, msg: 'Error'});
    });

};

function addUsersToRoom(room, userList) {
    var roomCode = room.code;
    var roomOrg = room.org;

    var commands = [];
    for (var i in userList) {
        commands.push(['sismember', models.lists.keyGUser, userList[i]]);
    }

    models.lists.batch(commands)
    .then((results) => {//validate username
        logger('start add users to room '+roomCode+'...');
        if (results.length != userList.length) {
            return new promise((resolve, reject) => reject('Error checking username.'));
        }
        var finalList = [];
        results.map((val, idx) => {
            if (val == 1) {
                finalList.push(userList[idx]);
            }
        });

        if (finalList.length > 0) {
            commands = [];
            finalList.forEach((username) => {
                    commands.push(['sadd', models.lists.getKeyRoomUser(roomCode), username]);
                    commands.push(['sadd', models.lists.getKeyUserRoom(username), roomCode]);
            });
            return models.lists.batch(commands);
        } else {
            return new promise((resolve, reject) => reject('List username is not valid.'));
        }
    })
    .then((result) => {//add username to list
        if (result.length > 0) {    
            //update list user in room        
            models.lists.custom('sdiffstore', models.lists.getKeyRoomNUser(roomCode), 
                models.lists.getKey(models.lists.getKeyOrgUser(roomOrg)), 
                models.lists.getKey(models.lists.getKeyRoomUser(roomCode)))
            .catch(logger);

            logger('end adding users to room', 'successfully', result.length, commands.length);
        } else {
            logger('end adding users to room', 'These users has been added.');
        }
    })
    .catch((err) => {
        logger(err);
    });
}
function getLength(obj) {
    if (typeof(obj) == 'object') {
        if (Array.isArray(obj)) {
            return obj.length;
        } else {
            return Object.keys(obj).length;
        }
    }
    return 0;
}