//format for a user record
// var obj = {
// 	username: 'hungtp', --primary key
// 	name: 'Hung Tran', 
// 	avatar: 'https://cdn4.iconfinder.com/data/icons/space-and-astronomy-1/800/rocket-512.png', 
// 	password: '123456',
// 	email: 'hungtp@abc.co',
// 	role: member,
// 	created_at: '15012456',
// 	created_by: 'userA',
// 	updated_at: '15012456',
// 	updated_by: 'userA',
// 	last_login: '1504216',
// };

delete require.cache[require.resolve(__dirname+'/BaseModel.js')];
var BaseModel = require(__dirname+'/BaseModel.js');
var util = require('util');
var logger = global.qrLog;

function UsersModel() {
    BaseModel.apply(this, ['users']);
    this.test = () => {logger('aa test',BaseModel); return this.batch();}
    this.setPK('username');
    this.reserved = ['global', 'admin'];

}

util.inherits(UsersModel, BaseModel);

module.exports = UsersModel;