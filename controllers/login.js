// var usersModel = require('./models/users.js');
var auth = require('../lib/auth.js');

function checkAuth(req, res) {	
	if (auth.isAuthenticated(req)) {
	    res.redirect('/main');
	}
}

exports.showLogin = (req, res) => {
	checkAuth(req, res);

	var getMsg = '';
	
	if (req.query.validation != undefined && req.query.validation == 0) {
		getMsg = 'Username or password is incorrect.'
	}
	if (req.query.status != undefined && req.query.status == 0) {
		getMsg = 'Cannot log in to app. Please try again or contact administrator.';
	}
	console.log(getMsg);
    res.render('login.html', {msg: getMsg});
};

exports.doLogin = (req, res) => {
	if (!req.body) return res.sendStatus(400);
	var getUser = auth.login(req.body.username, req.body.password);
    if (getUser !== false) {
    	req.session.regenerate((err)=>{
    		if (err != undefined) {
    			console.log('session re-generate err ' + err);
    			res.redirect('/login?status=0');
    		} else {
    			req.session.user = getUser;
    			console.log('user logged in');
    			res.redirect('/main');
    		}
    	});
    } else {
    	res.redirect('/login?validation=0');
    }
};

exports.showRegister = (req, res) => {
    console.log(req.session.user);
    checkAuth(req, res);
    res.render('register.html', {'msg': msg});
};

exports.doRegister = (req, res) => {
	
};

exports.doLogout = (req, res) => {
	if (!auth.isAuthenticated(req)) {
		res.redirect('/login');
	}
	req.session.destroy((err)=> {
		if (err != undefined) {
			console.log('session destroy err ' + err);
			res.redirect('/main');
		} else {
			console.log('user logged out');
			res.redirect('/login');
		}
	});
};