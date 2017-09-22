var db = require('../lib/db.js')('users');
var users = [];
var primaryKey = 'username';

//format for a user record
// var obj = {
// 	name: 'Hung Tran', 
// 	username: 'hungtp', 
// 	avatar: 'https://cdn4.iconfinder.com/data/icons/space-and-astronomy-1/800/rocket-512.png', 
// 	password: '123456',
// 	email: 'hungtp@abc.co'
// };

users.push({id: 0, name: 'Hung Tran', username: 'hungtp', 
	avatar: 'https://cdn4.iconfinder.com/data/icons/space-and-astronomy-1/800/rocket-512.png', 
	password: '123456', status: 0, devices: []});
users.push({id: 1, name: 'Hai Nguyen', username: 'haind', 
	avatar: '/images/default-user.png', 
	password: '123456', status: 0, devices: []});
users.push({id: 2, name: 'Giang Tran', username: 'giangtp', 
	avatar: '/images/default-user.png', 
	password: '123456', status: 0, devices: []});
users.push({id: 3, name: 'Phuong Nguyen', username: 'phuongnt', 
	avatar: '/images/default-user.png', 
	password: '123456', status: 0, devices: []});

//export to outside
// module.exports = () => {

// }

exports.create = (vals, callback='') => {
	db.hset('hmset', vals[primaryKey], vals, callback);
}
exports.exists = (vals, callback='') => {
	db.exists(vals, callback);
}

exports.list = (callback='') => {
	db.all(callback);
};

exports.get = (val, callback='') => {
	db.hgetall(val, callback)
};

exports.getBy = (value, col) => {
	for (var idx in users) {
		if (users[idx][col] == value)
			return users[idx];
	}
	return false;
}
exports.getByUsername = (value) => {
	return exports.getBy(value, 'username');
}