//first of all, load env var
require('dotenv-safe').load({
    allowEmptyValues: true
});

const APP = require('./config/app.js');

var app = require('express')();
var http = require('http').Server(app);
var nunjucks = require('nunjucks').configure('views', {
    autoescape: true,
    express: app
});
var serveStatic = require('serve-static');//get static file
var bodyParser = require('body-parser');//read data from post method
var promise = require("bluebird");
var session = require('express-session');
var redisSession = require('connect-redis')(session);

//--------------GLOBAL VAR DECLARATION-----------------
global.system = APP.system;
global.common = APP.common;
global.root_dir = __dirname;
global.qrLog = function() {
    console.log('-----------System Log: '+global.common.moment.utc().format('HH:mm:ss')+'-----------');
    for (var idx in arguments) {
        console.log(arguments[idx]);
    }
    console.log('-----------System Log End.----------------\n');
    
};
var logger = qrLog;

global.promise = promise;

//load models
global.models = {
    users: new (require('./models/users.js'))(),
    rooms: new (require('./models/rooms.js'))(),
    orgs: new (require('./models/organizations.js'))(),
    chats: new (require('./models/chats.js'))(),
    lists: new (require('./models/lists.js'))()
};

global.auth = require('./lib/auth.js');

//--------------------SESSION FOR APP---------------
var redisOpts = {
    prefix: 'qr-session:'
};
if (global.system.redis_url != '') {
    redisOpts.url = global.system.redis_url;
} else {  
    redisOpts.host = '127.0.0.1';
    redisOpts.port = '6379';
}
  
session = session({ 
    secret: system.app_mode == 'development' ? 'GiEGvn42zy' : global.common.shortid.generate(),  
    resave: true,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: global.system.session_maxage },
    unset: 'destroy',
    store: new redisSession(redisOpts)
});
//session for use in socket.io
var sharedsession = require("express-socket.io-session")(
    session, {
    autoSave:true
});

//----------------LOAD MIDDLEWARE TO APP------------------
//set public directory for static files (css,js)
app.use(serveStatic('public', { 'index': false }));
app.use(session);
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(global.auth.onMiddleware());


//---------------ROUTING-----------------
require('./config/route.js')(app);

//------------------STARTUP THE APP SERVER----------
if (!module.parent) {
    var checker = setInterval(checkDBConnection, 1000);
}

function checkDBConnection() {
    logger('checking Redis connection...');
    if (models.lists.redis().connected) {
        //server listen
        http.listen(system.app_port, function() {
            console.log('server listening on *:'+system.app_port);
        }); 

        initServer();

        //run main service
        global.qrService = require('./lib/qr_service.js')(http, sharedsession);

        clearInterval(checker);
    }
}

function initServer() {
    models.lists.mexists(models.lists.keyGUser, 'admin')
    .then((hasUser) => {
        if (hasUser == 0) {
            var obj = {
                username: 'admin',
                name: 'Administrator',
                avatar: './images/admin-user.png',
                email: 'admin@qr.com',
                password: 'admin',
                role: 'admin'
            };
            var commands = [
                ['hmset', obj.username, obj],
                ['sadd', models.lists.getKey(models.lists.keyGUser, true), obj.username]
            ];
            models.users.multi(commands)
            .then((results) => {
                if (results != null && results.length == commands.length) {
                    logger('admin user created');
                    return;
                }
                logger('failed to create admin user');
            });
        }
    })
    .catch(logger);
    

    //checking & creating global organization
    //add all user to this organization
    models.lists.mexists(models.lists.keyGOrg, 'qrgb')
    .then((hasOrg) => {
        if (hasOrg == 0) {
            var obj = {
                code: 'qrgb',
                name: 'Default organization of QR App'
            };
            var commands = [
                ['hmset', obj.code, obj],
                ['sadd', models.lists.getKey(models.lists.keyGOrg, true), obj.code]
            ];

            models.orgs.multi(commands)
            .then((results) => {
                if (results != null && results.length == commands.length) {
                    logger('global organization created');
                    //add user to this org                    
                    return models.lists.getAllMember(models.lists.keyGUser);
                } else {
                    return new promise((resolve, reject) => reject(['failed to create global organization', results]));
                }
            })
            .then((results) => {
                if (results.length > 0) {
                    return models.lists.addOrgUsers('qrgb', results);
                } else {
                    return new promise((resolve, reject) => reject('no user to add to global organization'));
                }
            })
            .then((result) => {
                if (result > 0) {
                    logger('added users to global organization');
                } else {
                    logger('no new users to add to global organization');
                }
            })
            .catch((err) => {
                logger('init global organization error', err);
            });
        } else {
            models.lists.getAllMember(models.lists.keyGUser)
            .then((results) => {
                if (results.length > 0) {
                    return models.lists.addOrgUsers('qrgb', results);
                } else {
                    return new promise((resolve, reject) => reject('no user to add to global organization'));
                }
            })
            .then((result) => {
                if (result > 0) {
                    logger('added users to global organization');
                } else {
                    logger('no new users to add to global organization');
                }
            })
            .catch((err) => {
                logger('init global organization error', err);
            });
        }
    })
    .catch(logger);
}