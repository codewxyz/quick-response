//format for a chat room record
// var obj = {
// 	code: 'roomA', --primary key
// 	data: ['json msg']
// };

delete require.cache[require.resolve('./BaseModel.js')];
var BaseModel = require('./BaseModel.js');
var util = require('util');
var logger = global.qrLog;

function ChatsModel() {
    BaseModel.apply(this, ['chats', 'set']);
}

util.inherits(ChatsModel, BaseModel);

module.exports = ChatsModel;