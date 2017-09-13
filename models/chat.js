var chat = [];

chat.push({
	id: 'room_01',
});

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