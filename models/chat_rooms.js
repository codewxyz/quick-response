var chatRooms = [];

chatRooms.push({
	id: 0,
	ns: 'ttm',
	code: 'public_room_00',
	name: 'Tinh tinh'
});
chatRooms.push({
	id: 1,
	ns: 'ttm',
	code: 'public_room_01',
	name: 'ODC'
});
chatRooms.push({
	id: 2,
	ns: 'GB',
	code: 'gb_request_room',
	name: 'QR Feedback/Request'
});

//export to outside
exports.list = () => chatRooms;
exports.get = (id) => chatRooms[id];
exports.getBy = (value, col) => {
	var result = [];
	for (var idx in chatRooms) {
		if (chatRooms[idx][col] == value)
			result.push(chatRooms[idx]);
	}
	return result.length > 0 ? result : false;
}
exports.getByOrg = (value) => {
	return exports.getBy(value, 'ns');
}