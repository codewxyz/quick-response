var users = require('../models/users.js');
// var session = require('express-session');

var noAuthPaths = ['/login', '/register'];
var bypassAuthPaths = ['/logout'];


function isLogin(req) {	
	return !(req.session.user == undefined);
}

exports.isAuthenticated = (req) => {
	return isLogin(req);
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

exports.onMiddleware = (paths=[]) => {
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
		var checklogin = isLogin(req);

		if (checklogin) {
			next();
		} else {
			if (paths.indexOf(curUrl) > -1) {
				next();
			} else {
				res.redirect('/login');
			}
		}

		// if (bypassAuthPaths.indexOf(curUrl) > -1) {
		// 	next();
		// } else if (paths.indexOf(curUrl) > -1 && checklogin) {
		// 	res.redirect('/main');
		// } else if (paths.indexOf(curUrl) == -1 && !checklogin) {
		// 	res.redirect('/login');
		// } else {
		// 	next();
		// }
	};
};