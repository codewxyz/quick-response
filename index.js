var app = require('express')();
var http = require('http').Server(app);
var nunjucks = require('nunjucks');
// var io = require('socket.io')(http);
var serveStatic = require('serve-static');//get static file
var bodyParser = require('body-parser');//read data from post method
var session = require('express-session')({ 
    secret: 'mT7vzH7des',  
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 360000 }
});
var sharedsession = require("express-socket.io-session")(
    session, {
    autoSave:true
});
var qrs = require('./lib/qr_service.js')(http, sharedsession);

global.auth = require('./lib/auth.js')({
	model: __dirname + '/models/users.js',
	modelFunc: 'getByUsername'
});
global.myserver = {
	node: http,
	express: app
};
global.qrService = qrs;
global.system = {
	setting: 'test'
};
// console.log(session);

//load models
// var users = require('./models/users.js');

//load controllers
var loginController = require('./controllers/login.js');
var chatController = require('./controllers/chat.js');

//set up template engine for nunjucks
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

//set public directory for static files (css,js)
app.use(serveStatic('public', { 'index': false }));
app.use(session);
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(global.auth.onMiddleware());


//---------------routing-----------------
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

qrs.connect();

if (!module.parent) {
	//server listen
	http.listen(3000, function() {
	    console.log('server listening on *:3000');
	});	
}