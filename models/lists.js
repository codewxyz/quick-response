//format for a chat room record
// var obj = {
// 	code: 'w:room', --primary key
// 	data: ['userA:member', 'userB:admin']
// };

delete require.cache[require.resolve('./BaseModel.js')];
var BaseModel = require('./BaseModel.js');
var util = require('util');
var logger = global.qrLog;

function ListsModel() {
    BaseModel.apply(this, ['lists', 'set']);

    this.createOrgRoom = (room, callback) => {
    	var id = 'orgs:' + room.org + ':' + room.code;
        dset('sadd', id, room.code, callback);
    }

    this.createUsers = (username, callback) => {
    	var id = 'users:global';
        dset('sadd', id, username, callback);
    }

    this.createOrgUsers = (org, username, callback) => {
    	var id = 'users:' + org;
        dset('sadd', id, username, callback);
    }  

    this.createRoomUsers = (room, username, callback) => {
    	var id = 'rooms:' + room;
        dset('sadd', id, username, callback);
    }
}

util.inherits(ListsModel, BaseModel);

module.exports = ListsModel;