//format for a chat room record
// var obj = {
// 	code: 'w:room', --primary key
// 	data: 'room'
// };

delete require.cache[require.resolve('./BaseModel.js')];
var BaseModel = require('./BaseModel.js');
var util = require('util');
var logger = global.qrLog;

function OrgsRoomsModel() {
    BaseModel.apply(this, ['orgs_rooms', 'set']);
}

util.inherits(OrgsRoomsModel, BaseModel);

module.exports = OrgsRoomsModel;