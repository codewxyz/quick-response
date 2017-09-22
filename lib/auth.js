var usersModel;
var setting = {
    sessionName: 'user',
    formUsername: 'username',
    formPassword: 'password',
    dbUsername: 'username',
    dbPassword: 'password',
    model: '',
    modelFunc: ''
};

var noAuthPaths = ['/login', '/register'];
var logger = global.qrLog;

function isLogin(req) {
    return (req.session[setting.sessionName] != undefined);
}

function mergeArr(arr1, arr2) {
    return arr1.concat(arr2).filter((val) => {
        if (arr2.indexOf(val) > -1) {
            return false;
        }
        return true;
    });
}

//contructor
module.exports = (getSetting) => {
    setting = Object.assign(setting, getSetting);
    usersModel = require(setting.model);
    return exports;
}

exports.getUser = (req) => {
	if (req.session[setting.sessionName] != undefined) {
		return req.session[setting.sessionName];
	} else {
		return {};
	}
}

exports.isAuthenticated = (req) => {
    return isLogin(req);
}

exports.login = (req, res) => {
    var formParam = req.body;
    usersModel[setting.modelFunc](formParam[setting.dbUsername], (err, getUser) => {        
        if (getUser != null && getUser[setting.dbPassword] === formParam[setting.formPassword]) {
            return req.session.regenerate((err) => {
                if (err) {
                    console.log('session re-generate err ' + err);
                    res.redirect('/login?error=1');
                } else {
                    req.session[setting.sessionName] = getUser;
                    console.log('user logged in');
                    console.log('new session ' + req.session.id);
                    res.redirect('/main');
                }
            });
        } else {
            res.redirect('/login?error=0');     
        }
    });
}

exports.onMiddleware = (paths = []) => {
    if (paths.length == 0) {
        paths = noAuthPaths;
    } else {
        paths = mergeArr(paths, noAuthPaths);
    }
    return function(req, res, next) {
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
    };
}
