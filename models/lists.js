//format for a chat room record
// var obj = {
// 	code: 'w:room', --primary key
// 	data: ['userA:member', 'userB:admin']
// };

delete require.cache[require.resolve(global.root_dir+'/models/BaseModel.js')];
var BaseModel = require(global.root_dir+'/models/BaseModel.js');
var g_util = require('util');
var logger = global.qrLog;

function ListsModel() {
    BaseModel.apply(this, ['lists', 'set']);

    this.getKeyOrgRoom = (org) => 'orgs:'+org+':rooms';
    this.getKeyOrgUser = (org) => 'orgs:'+org+':users';
    this.getKeyOrgNUser = (org) => 'orgs:'+org+':non-users';
    this.getKeyRoomUser = (room) => 'rooms:'+room+':users';
    this.getKeyRoomNUser = (room) => 'rooms:'+room+':non-users';
    this.getKeyUserRoom = (username) => 'users:'+username+':rooms';
    this.getKeyUserOrg = (username) => 'users:'+username+':orgs';
    this.keyGUser = 'users:global';
    this.keyGOrg = 'orgs:global';
    this.keyGRoom = 'rooms:global';

    this.createOrgRoom = (room, callback) => {
    	var id = this.getKeyOrgRoom(room.org);
        dset('sadd', id, room.code, callback);
    };

    this.addOrgUsers = (org, users) => {
    	var id = this.getKeyOrgUser(org);
        return this.create({
        	code: id,
        	data: users
        });
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

    this.getAllMember = (id) => {
    	var key = this.getKey(id);
    	return this.redis().smembersAsync(key);
    };
}

g_util.inherits(ListsModel, BaseModel);

module.exports = ListsModel;