var users = require('../models/users.js');
// var session = require('express-session');

var noAuthPaths = ['/login', '/register'];

function isLogin() {
	return false;
}

exports.login = (username, password) => {
	var getUser = users.getBy(username, 'username');
	if (getUser !== false) {
		if (getUser.password === password) {
			return getUser;
		}
	}
	return false;
};

exports.checkLogin = (paths=[]) => {
	if (paths.length == 0) {
		paths = noAuthPaths;
	} else {
		paths = paths.concat(noAuthPaths);
		paths = paths.filter((val)=>{
			if (noAuthPaths.indexOf(val) > -1) {
				return false;
			}
			return true;
		});
	}
	return function (req, res, next) {
		var curUrl = req.path;
		if (paths.indexOf(curUrl) > -1 && isLogin()) {
			res.redirect('/main');
		} else if (paths.indexOf(curUrl) == -1 && !isLogin()) {
			res.redirect('/login');
		} else {
			next();
		}
	};
};