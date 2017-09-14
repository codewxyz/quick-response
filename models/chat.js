var chat = [];

chat.push({
	id: 0,
	chat_room_id: 0,
	msg: 'hello',
	user_id: 'hungtp'
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
exports.getByOrg = (value) => {
	return exports.getBy(value, 'username');
}