//format for a chat room record
// var obj = {
// 	code: 'roomA', --primary key
// 	data: ['json msg']
// };
delete require.cache[require.resolve(global.root_dir+'/models/BaseModel.js')];
var BaseModel = require(global.root_dir+'/models/BaseModel.js');
var g_userModel = null;
var g_util = require('util');
var logger = global.qrLog;
var g_moment = global.common.moment;
var g_momentz = global.common.momentz;
var g_promise = global.common.promise;

function ChatsModel() {
    BaseModel.apply(this, ['chats', 'sorted_set']);
	g_userModel = new (require('./users.js'))();

    this.saveChat = (roomCode, data, isNew=true) => {
    	//use timestamp for score
    	data.time = g_moment.utc().valueOf();
    	//script to run query
    	var dbScript = '';
    	dbScript += "local last_mem = redis.call('zrevrangebyscore', ARGV[1], '+inf', '-inf', 'withscores', 'limit', 0, 1) ";
    	dbScript += "local new_score = 0 ";
    	dbScript += "if (last_mem[3] == nil) ";
    	dbScript += "then if (last_mem[1] == nil) then new_score = 1 else new_score = last_mem[2]+1 end ";
    	dbScript += " local add_mem = redis.call('zadd', ARGV[1], 'NX', new_score, ARGV[2]) ";
    	dbScript += " if (add_mem == 1) then return new_score else return 0 end ";
    	dbScript += "else return 0 end";

    	return this.custom('eval', dbScript, 2, 'keyroom', 'chatdata', this.getKey(roomCode, true), JSON.stringify(data))
    	.then((result) => {
    		if (result > 0) {
        		return new g_promise((resolve, reject) => resolve(result));
    		} else {
    			return new g_promise((resolve, reject) => reject('Cannot save chat data.'));
    		}
    	})
    	.catch((err) => {
			return new g_promise((resolve, reject) => reject(err));
    	});
    };

    this.deleteChat = function (roomCode, chatid, username) {

    	return this.custom('zrevrangebyscore', roomCode, chatid, chatid)//get chat details
    	.then((chats) => {
    		if (chats.length == 1) {
		    	var chatDetails = JSON.parse(chats[0]);
				if (chatDetails.username == username) {
			    	var commands = [];

			    	//command to remove this chatid
			    	commands.push(['zrem', roomCode, JSON.stringify(chatDetails)]);

			    	//add this chatid again with empty content
			    	chatDetails.msg = '';
			    	commands.push(['zadd', roomCode, 'NX', chatid, JSON.stringify(chatDetails)]);

					return this.multi(commands);
				} else {
        			return new g_promise((resolve, reject) => reject('This user do not have permission to delete message.'));
				}
    		} else {
        		return new g_promise((resolve, reject) => reject(chats.length+' chat(s) retrieved '));
    		}
    	})
    	.then((results) => {
    		if (results != 'null') {
    			if (results[0] == 1 && results[1] == 1) {	
                	return new g_promise((resolve, reject) => resolve(results));
    			} else {
                	return new g_promise((resolve, reject) => reject(results));
    			}
    		}
    	})
    	.catch((err) => {
        	return new g_promise((resolve, reject) => reject(err));
    	});
    };

    this.getLatestChat = (roomCode, page, limit = 10) => {
        var chats = [];
		var checkUser = [];
		var offset = limit*page;
        return new g_promise((mresolve, mreject) => {
	        this.custom('zrevrangebyscore', roomCode, ['+inf', '-inf', 'withscores', 'limit', offset, limit])
	            .then((results) => {
	                if (results.length > 0) {
	                    results.forEach((val, idx) => {
	                        if ((idx % 2) == 0) {
	                            var data = JSON.parse(val);
	                            var getTime = data.time;
                				data.id = results[idx+1];
	                            data.time = g_momentz.tz(g_moment.utc(getTime), 'Asia/Ho_Chi_Minh')
	                            				.format('DD/MM/YYYY HH:mm');
                				data.datetime = g_momentz.tz(g_moment.utc(getTime), 'Asia/Ho_Chi_Minh')
                				.format('DD/MM/YYYY HH:mm');
	                            chats.push(data);
	                        }
	                    });
	                }
	                return new g_promise((resolve, reject) => resolve(chats));
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
	                	return new g_promise((resolve, reject) => resolve([]));
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

g_util.inherits(ChatsModel, BaseModel);

module.exports = ChatsModel;