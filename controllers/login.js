var usersModel = require('../models/users.js');
var auth = global.auth;
var logger = global.qrLog;

function checkAuth(req, res) {
    if (auth.isAuthenticated(req)) {
        return true;
    }
    return false;
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

function getRegisterErrorMsg(code) {
    getMsg = '';
    switch (code) {
        case '0':
            getMsg = 'Cannot register new user. Please try again or contact administrator.';
            break;
        case '1':
            getMsg = 'Username is required and have length greater than 4.';
            break;
        case '2':
            getMsg = 'Password is required and have length greater than 6.';
            break;
        case '3':
            getMsg = 'Passwords not match.';
            break;
        case '4':
            getMsg = 'This username existed.';
            break;
        default:
            break;

    }
    return getMsg;
}

function register(param, res) {
    if (param.avatar == '') {
        param.avatar = '/images/default-user.png';
    }
    delete param.password2;

    usersModel.exists(param.username, (err, rep) => {
        if (rep == 0) {
            usersModel.create(param, (err2, rep2) => {
                if (rep2 == 'OK') {
                    return res.redirect('/register?success=1');
                } else {    
                    return res.redirect('/register?error=0');
                }
            });
        } else {
            return res.redirect('/register?error=4');
        }
    });
}

exports.showLogin = (req, res) => {
    if (checkAuth(req, res)) {
        return res.redirect('/main');
    } else {
        var getMsg = '';
        var queryParam = req.query;

        if (queryParam.error != undefined) {
            getMsg = getErrorMsg(queryParam.error);
        }

        return res.render('login.html', { msg: getMsg });
    }
};

exports.doLogin = (req, res) => {
    if (!req.body) return res.sendStatus(400);
    auth.login(req, res);
};

exports.showRegister = (req, res) => {
    if (checkAuth(req, res)) {
        return res.redirect('/main');
    } else {
        var getMsg = '';
        var queryParam = req.query;

        if (queryParam.error != undefined) {
            getMsg = getRegisterErrorMsg(queryParam.error);
        }

        if (queryParam.success != undefined) {
            getMsg = 'Registered successfully.';
        }

        return res.render('register.html', { 'msg': getMsg });
    }
};

exports.doRegister = (req, res) => {
    var formParam = req.body;
    if (formParam.username == '' || formParam.username.length < 4) {
        return res.redirect('/register?error=1');
    }
    if (formParam.password == '' || formParam.password.length < 6) {
        return res.redirect('/register?error=2');
    }
    if (formParam.password !== formParam.password2) {
        return res.redirect('/register?error=3');
    }

    register(formParam, res);
};

exports.doLogout = (req, res) => {
    if (!auth.isAuthenticated(req)) {
        return res.redirect('/login');
    }
    req.session.destroy((err) => {
        if (err != undefined) {
            console.log('session destroy err ' + err);
           return res.redirect('/main');
        } else {
            console.log('user logged out');
            return res.redirect('/login');
        }
    });
};