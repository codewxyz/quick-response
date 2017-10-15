//format for a chat room record
// var obj = {
// 	code: 'room', --primary key
// 	name: 'World Room', 
// 	org_code: 'w', 
// 	created_at: '15012456',
// 	created_by: 'userA',
// 	updated_at: '15012456',
// 	updated_by: 'userA'
// };
delete require.cache[require.resolve(global.root_dir+'/models/BaseModel.js')];

var BaseModel = require(global.root_dir+'/models/BaseModel.js');
var g_util = require('util');
var logger = global.qrLog;

function RoomsModel() {
    BaseModel.apply(this, ['rooms']);
    this.reserved = ['global', 'room'];
    this.defaultCode = 'room';
}

g_util.inherits(RoomsModel, BaseModel);

module.exports = RoomsModel;