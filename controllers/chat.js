exports.show = (req, res) => {
	var loginUser = {
		name: req.session.user.name,
		username: req.session.user.name
	};
    res.render('chat_room.html', {user: loginUser});
};