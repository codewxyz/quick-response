// chat room record
// var obj = {
// 	code: 'w', --primary key
// 	name: 'World Channel', 
// 	created_at: '15012456',
// 	created_by: 'userA',
// 	updated_at: '15012456',
// 	updated_by: 'userA'
// };
delete require.cache[require.resolve('./BaseModel.js')];
var BaseModel = require('./BaseModel.js');
var util = require('util');
var logger = global.qrLog;

function OrganizationsModel() {
    BaseModel.apply(this, ['organizations']);

    this.reserved = ['global', 'qrgb'];
    this.defaultCode = 'qrgb';
}

util.inherits(OrganizationsModel, BaseModel);

module.exports = OrganizationsModel;