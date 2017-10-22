//format for a private chat room
// var details = {
// };
delete require.cache[require.resolve(global.root_dir+'/models/BaseModel.js')];

var BaseModel = require(global.root_dir+'/models/BaseModel.js');
var g_util = require('util');
var logger = global.qrLog;

function PrivatesModel() {
    BaseModel.apply(this, ['privates']);
    this.setPK('username');
}

g_util.inherits(PrivatesModel, BaseModel);

module.exports = PrivatesModel;