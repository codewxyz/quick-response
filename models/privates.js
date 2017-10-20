//format for a private chat room
// var details = {
// 	code: 'userA-userB', --primary key
// 	name: 'private chat', 
// 	org_code: 'qrgb', 
// 	created_at: '15012456',
// 	created_by: 'userA',
// 	updated_at: '15012456',
// 	updated_by: 'userA'
// };
// var chats = {
// 	time: '15012456', --primary key
// 	msg: 'World Room', 
// 	username: 'userA'
// };
delete require.cache[require.resolve(global.root_dir+'/models/BaseModel.js')];

var BaseModel = require(global.root_dir+'/models/BaseModel.js');
var g_util = require('util');
var logger = global.qrLog;

function PrivatesModel() {
    BaseModel.apply(this, ['privates']);
    this.getKeyInfo = (roomCode) => roomCode+':details';
    this.getKeyChat = (roomCode) => roomCode':chats';
}

g_util.inherits(PrivatesModel, BaseModel);

module.exports = PrivatesModel;