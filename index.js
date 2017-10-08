var app = require('express')();
var http = require('http').Server(app);
var nunjucks = require('nunjucks');
// var io = require('socket.io')(http);
var serveStatic = require('serve-static');//get static file
var bodyParser = require('body-parser');//read data from post method
var moment = require('moment');
var promise = require("bluebird");

//--------------------SESSION FOR APP---------------
var session = require('express-session');
var redisStore = require('connect-redis')(session);
session = session({ 
    secret: 'mT7vzH7des',  
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 360000 },
    store: new redisStore({
        host: '127.0.0.1',
        port: '6379',
        prefix: 'qr-session:'
    })
});

//session for use in socket.io
var sharedsession = require("express-socket.io-session")(
    session, {
    autoSave:true
});

//--------------GLOBAL VAR DECLARATION-----------------
global.qrLog = function() {
    console.log('-----------System Log: '+moment().format('HH:mm:ss')+'-----------');
    for (var idx in arguments) {
        console.log(arguments[idx]);
    }
    console.log('-----------System Log End.----------------\n');
    
};
var logger = qrLog;
global.promise = promise;
global.myserver = {
	node: http,
	express: app
};
global.system = {
	setting: 'test',
    shortid: require('shortid')
};

//load models
global.models = {
    users: new (require('./models/users.js'))(),
    rooms: new (require('./models/rooms.js'))(),
    orgs: new (require('./models/organizations.js'))(),
    chats: new (require('./models/chats.js'))(),
    lists: new (require('./models/lists.js'))()
};
global.auth = require('./lib/auth.js');
//----------------LOAD CONTROLLERS----------------------
var loginController = require('./controllers/login.js');
var chatController = require('./controllers/chat.js');
var adminController = require('./controllers/admin.js');

//set up template engine for nunjucks
nunjucks.configure('views', {
    autoescape: true,
    express: app
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
app.get('/', function(req, res) {
    if (global.auth.isAuthenticated(req)) {
    	res.redirect('/main');
    } else {
    	res.redirect('/login');
    }
});

app.get('/register', loginController.showRegister);
app.post('/register', loginController.doRegister);

app.get('/login', loginController.showLogin);
app.post('/login', loginController.doLogin);

app.post('/logout', loginController.doLogout);

app.get('/main', chatController.show);
app.get('/main/aj/user-search', chatController.searchUser);
app.post('/main/aj/add-room', chatController.addRoom);
app.post('/main/aj/room-members', chatController.getRoomMembers);

app.get('/admin', adminController.show);
app.get('/admin/search/user', adminController.searchUser);
app.get('/admin/get/users', adminController.getUsers);
app.get('/admin/get/orgs', adminController.getOrgs);
app.get('/admin/get/rooms', adminController.getRooms);
app.post('/admin/set/org', adminController.addOrg);
app.post('/admin/set/org-users', adminController.addOrgUsers);
app.post('/admin/set/room', adminController.addRoom);
app.post('/admin/set/user', adminController.addUser);


//------------------STARTUP THE APP SERVER----------
if (!module.parent) {
    var checker = setInterval(checkDBConnection, 1000);
}

function checkDBConnection() {
    logger('checking Redis connection...');
    if (models.lists.redis().connected) {
        //server listen
        http.listen(3000, function() {
            console.log('server listening on *:3000');
        }); 

        initServer();
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
    });
}