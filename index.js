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
    chats: new (require('./models/chats.js'))
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
app.post('/admin/add/org', adminController.addOrg);
app.get('/admin/add/room', adminController.addRoom);


//------------------STARTUP THE APP SERVER----------
if (!module.parent) {
	//server listen
	http.listen(3000, function() {
	    console.log('server listening on *:3000');
	});	
}