//format for a chat room record
// var obj = {
// 	code: 'w:room', --primary key
// 	data: ['userA:member', 'userB:admin']
// };

delete require.cache[require.resolve('./BaseModel.js')];
var BaseModel = require('./BaseModel.js');
var util = require('util');
var logger = global.qrLog;

function RoomsUsersModel() {
    BaseModel.apply(this, ['rooms_users', 'set']);
}

util.inherits(RoomsUsersModel, BaseModel);

module.exports = RoomsUsersModel;