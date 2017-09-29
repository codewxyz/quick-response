var app = require('express')();
var http = require('http').Server(app);
var nunjucks = require('nunjucks');
// var io = require('socket.io')(http);
var serveStatic = require('serve-static');//get static file
var bodyParser = require('body-parser');//read data from post method
var moment = require('moment');

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
        prefix: 'qrs-session:'
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
global.myserver = {
	node: http,
	express: app
};
global.system = {
	setting: 'test'
};

//load models
global.models = {
    users: new (require('./models/users.js')),
    rooms: new (require('./models/rooms.js')),
    orgs: new (require('./models/organizations.js')),
    orgs_rooms: new (require('./models/orgs_rooms.js')),
    orgs_users: new (require('./models/orgs_users.js')),
    rooms_users: new (require('./models/rooms_users.js')),
    chats: new (require('./models/chats.js')),
    lists: new (require('./models/lists.js'))
};
global.auth = require('./lib/auth.js')({
    model: models.users,
    modelFunc: 'get'
});
var qrs = require('./lib/qr_service.js')(http, sharedsession);
global.qrService = qrs;
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

app.get('/admin', adminController.show);
app.get('/admin/get/users', adminController.getUsers);
app.get('/admin/get/orgs', adminController.getOrgs);
app.get('/admin/get/rooms', adminController.getRooms);
app.post('/admin/set/org', adminController.addOrg);
app.post('/admin/set/room', adminController.addRoom);
app.post('/admin/set/user', adminController.addUser);


//------------------STARTUP THE APP SERVER----------
if (!module.parent) {
	//server listen
	http.listen(3000, function() {
	    console.log('server listening on *:3000');
	});	

    initServer();
}

function initServer() {
    //create default admin if not exist
    models.lists.mexists('admin', (user) => {
        if (user == 0) {
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
            models.users.multi(commands, true, (results) => {
                logger(results);
                if (results != null && results.length == commands.length) {
                    qrLog('admin user created');
                }
                qrLog('failed to create admin user');
            });
            // models.users.create(obj, (rep) => {
            //     if (rep != null) {
            //         qrLog('admin user created');
            //     }
            // });
        }
    })
}