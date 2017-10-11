//format for a chat room record
// var obj = {
// 	code: 'roomA', --primary key
// 	data: ['json msg']
// };
delete require.cache[require.resolve('./BaseModel.js')];
var BaseModel = require('./BaseModel.js');
var userModel = null;
var util = require('util');
var logger = global.qrLog;
var shortid = require('shortid');

function ChatsModel() {
    BaseModel.apply(this, ['chats', 'sorted_set']);
	userModel = new (require('./users.js'))();

    this.saveChat = (roomCode, data) => {
    	//add id to identify data in sorted set because content cannot be duplicated
    	data.cid = shortid.generate();
        return this.custom('zadd', roomCode, [global.system.moment.utc().valueOf(), JSON.stringify(data)]);
    };

    this.getLatestChat = (roomCode, page, limit = 10) => {
        var chats = [];
		var checkUser = [];
		var offset = 10*page;
        return new promise((mresolve, mreject) => {
	        this.custom('zrevrangebyscore', roomCode, ['+inf', '-inf', 'withscores', 'limit', offset, limit])
	            .then((results) => {
	                if (results.length > 0) {
	                    results.forEach((val, idx) => {
	                        if ((idx % 2) == 0) {
	                            var data = JSON.parse(val);
	                            data.time = global.system.momentz.tz(global.system.moment.utc(parseInt(results[idx + 1])), 'Asia/Ho_Chi_Minh')
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
	            		return userModel.batch(commands);
	            	} else {
	                	return new promise((resolve, reject) => resolve([]));
	            	}
	            })
	            .then((results) => {
	            	logger(results);
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

util.inherits(ChatsModel, BaseModel);

module.exports = ChatsModel;