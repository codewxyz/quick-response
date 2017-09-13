// var usersModel = require('./models/users.js');
var auth = global.auth;

function checkAuth(req, res) {
    if (auth.isAuthenticated(req)) {
        res.redirect('/main');
    }
}

function getErrorMsg(code) {
    getMsg = '';
    if (code == 0) {
        getMsg = 'Username or password is incorrect.';
    }
    if (code == 1) {
        getMsg = 'Cannot log in to app. Please try again or contact administrator.';
    }
    return getMsg;
}

exports.showLogin = (req, res) => {
    checkAuth(req, res);

    var getMsg = '';
    var queryParam = req.query;

    if (queryParam.error != undefined) {
        getMsg = getErrorMsg(queryParam.error);
    }

    res.render('login.html', { msg: getMsg });
};

exports.doLogin = (req, res) => {
    if (!req.body) return res.sendStatus(400);
    console.log(req.body.username);
    auth.login(req, res);
};

exports.showRegister = (req, res) => {
    checkAuth(req, res);
    var msg = '';
    res.render('register.html', { 'msg': msg });
};

exports.doRegister = (req, res) => {

};

exports.doLogout = (req, res) => {
    if (!auth.isAuthenticated(req)) {
        res.redirect('/login');
    }
    req.session.destroy((err) => {
        if (err != undefined) {
            console.log('session destroy err ' + err);
            res.redirect('/main');
        } else {
            console.log('user logged out');
            res.redirect('/login');
        }
    });
};