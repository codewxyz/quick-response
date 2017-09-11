var users = [];

users.push({name: 'Hung Tran', username: 'hungtp', password: '123456'});
users.push({name: 'Hai Nguyen', username: 'haind', password: '123456'});
users.push({name: 'Giang Trang', username: 'giangtp', password: '123456'});

//export to outside
exports.list = () => users;
exports.get = (id) => users[id];
exports.getBy = (value, col) => {
	for (var idx in users) {
		if (users[idx][col] == value)
			return users[idx];
	}
	return false;
};