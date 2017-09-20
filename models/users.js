var users = [];

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
exports.list = () => users;
exports.get = (id) => users[id];
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