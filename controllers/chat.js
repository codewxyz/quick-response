var auth = global.auth;

exports.show = (req, res) => {
	var loginUser = auth.getUser(req);
    res.render('chat_room.html', {user: loginUser});
};