//format for a chat room record
// var obj = {
// 	code: 'w:room', --primary key
// 	data: ['userA:member', 'userB:admin']
// };

delete require.cache[require.resolve('./BaseModel.js')];
var BaseModel = require('./BaseModel.js');
var util = require('util');
var logger = global.qrLog;

function OrgsUsersModel() {
    BaseModel.apply(this, ['orgs_users', 'set']);

    this.reserved = ['admin'];
}

util.inherits(OrgsUsersModel, BaseModel);

module.exports = OrgsUsersModel;