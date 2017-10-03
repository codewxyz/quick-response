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

    this.getKeyOrgRoom = (org) => 'orgs:'+org+':rooms';
    this.getKeyOrgUser = (org) => 'orgs:'+org+':users';
    this.getKeyOrgNUser = (org) => 'orgs:'+org+':non-users';
    this.getKeyRoomUser = (room) => 'rooms:'+room+':users';
    this.getKeyRoomNUser = (room) => 'rooms:'+room+':non-users';
    this.keyGUser = 'users:global';
    this.keyGOrg = 'orgs:global';
    this.keyGRoom = 'rooms:global';

    this.createOrgRoom = (room, callback) => {
    	var id = this.getKeyOrgRoom(room.org);
        dset('sadd', id, room.code, callback);
    };

    this.createOrgUsers = (org, username, callback) => {
    	var id = this.getKeyOrgUser(org);
        dset('sadd', id, username, callback);
    };

    this.createRoomUsers = (room, username, callback) => {
    	var id = this.getKeyRoomUser(room);
        dset('sadd', id, username, callback);
    };

    this.addUser = (username, callback) => {
        var id = this.keyGUser;
        dset('sadd', id, username, callback);
    };

    this.addOrg = (code, callback) => {
        var id = this.keyGOrg;
        dset('sadd', id, code, callback);
    };

    this.addRoom = (code, callback) => {
        var id = this.keyGRoom;
        dset('sadd', id, code, callback);
    };
}

util.inherits(ListsModel, BaseModel);

module.exports = ListsModel;