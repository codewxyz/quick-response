//format for a private chat for one:one between users
//room code rule: userA-userB (userB-userA is the same and one, cannot be duplicated)
// var obj = {
// 	code: 'userA-userB', --primary key
// 	msg: ['json msg'],
// 	time: 151201201 (milliseconds)
// };
delete require.cache[require.resolve(global.root_dir+'/models/BaseModel.js')];
var BaseModel = require(global.root_dir+'/models/BaseModel.js');
var g_userModel = null;
var g_util = require('util');
var logger = global.qrLog;
var g_moment = global.common.moment;
var g_momentz = global.common.momentz;

function PrivatesModel() {
    BaseModel.apply(this, ['chats', 'sorted_set']);
	g_userModel = new (require('./users.js'))();

    this.saveChat = (roomCode, data) => {
    	//use time send to make message unique in redis
    	data.time = g_moment.utc().valueOf();
        return this.custom('zadd', roomCode, [data.time, JSON.stringify(data)]);
    };

    this.getLatestChat = (roomCode, page, limit = 10) => {
        var chats = [];
		var checkUser = [];
		var offset = limit*page;
        return new promise((mresolve, mreject) => {
	        this.custom('zrevrangebyscore', roomCode, ['+inf', '-inf', 'withscores', 'limit', offset, limit])
	            .then((results) => {
	                if (results.length > 0) {
	                    results.forEach((val, idx) => {
	                        if ((idx % 2) == 0) {
	                            var data = JSON.parse(val);
	                            data.time = g_momentz.tz(g_moment.utc(parseInt(results[idx + 1])), 'Asia/Ho_Chi_Minh')
	                            				.format('DD/MM/YYYY HH:mm');
                				data.datetime = g_momentz.tz(g_moment.utc(parseInt(results[idx + 1])), 'Asia/Ho_Chi_Minh')
                				.format('DD/MM/YYYY HH:mm');
	                            chats.push(data);
	                        }
	                    });
	                }
	                return new promise((resolve, reject) => resolve(chats));
	            })
	            .then((results) => {
	            	if (results.length > 0) {
	            		var commands = [];
	            		results.forEach((val) => {
	            			if (checkUser.indexOf(val.username) == -1 ) {
	            				commands.push(['hgetall', val.username]);
	            				checkUser.push(val.username);
	            			}
	            		});
	            		return g_userModel.batch(commands);
	            	} else {
	                	return new promise((resolve, reject) => resolve([]));
	            	}
	            })
	            .then((results) => {
	            	if (results.length == checkUser.length) {
	            		chats.forEach((val, idx) => {
	            			var user = results[checkUser.indexOf(val.username)];
	            			chats[idx].name = user.name;
	            			chats[idx].avatar = user.avatar;
	            			chats[idx].roomCode = roomCode;
	            		});
	            		mresolve(chats.reverse());
	            	} else {
	            		mresolve([]);
	            	}
	            })
	            .catch(mreject);
        });
    };
}

g_util.inherits(PrivatesModel, BaseModel);

module.exports = PrivatesModel;