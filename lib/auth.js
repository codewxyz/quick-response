var usersModel;
var setting = {
    sessionName: 'user',
    formUsername: 'username',
    formPassword: 'password',
    dbUsername: 'username',
    dbPassword: 'password',
    model: {},
    modelFunc: ''
};

var noAuthPaths = ['/login', '/register'];
var authorize = ['/admin']
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
    usersModel = setting.model;
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

exports.isAuthorized = (role) => {
    return getUser().role == role;
}

exports.login = (req, res) => {
    var formParam = req.body;
    logger(usersModel);
    usersModel[setting.modelFunc](formParam[setting.dbUsername], (getUser) => {    
        logger(getUser);
        if (getUser != null && getUser[setting.dbPassword] === formParam[setting.formPassword]) {
            return req.session.regenerate((err) => {
                if (err) {
                    console.log('session re-generate err ' + err);
                    res.redirect('/login?error=1');
                } else {
                    delete getUser.password;
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
            for (var i in authorize) {
                if (curUrl.indexOf(authorize[i]) == 0) {
                    if (exports.getUser(req).role != 'admin')
                        return res.status(401).send('<p>You do not have permission to access. <a href="/">Back to Home</a></p>');
                }
            }
            next();
        } else {
            if (paths.indexOf(curUrl) > -1) {
                next();
            } else {
                logger('test');
                if (req.xhr) {
                    //handle request from Ajax call
                    return res.status(403).json({msg: 'You have to login to perform this action.'});
                } else {
                    return res.redirect('/login');
                }
            }
        }
    };
}
