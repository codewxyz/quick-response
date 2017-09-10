var app = require('express')();
var http = require('http').Server(app);
var nunjucks = require('nunjucks');
var io = require('socket.io')(http);
var serveStatic = require('serve-static');//get static file
var bodyParser = require('body-parser');//read data from post method

//set public directory for static files (css,js)
app.use(serveStatic('public', { 'index': false }));
app.use(bodyParser.urlencoded({
    extended: true
}));

//set up template engine for nunjucks
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

//---------------routing-----------------
app.get('/', function(req, res) {
    // res.render('main.html', { name: 'hungtp', age: '25' });
    res.redirect('/login');
});
app.get('/register', function(req, res) {
    res.render('register.html');
});
app.get('/login', function(req, res) {
    res.render('login.html');
});
app.post('/login', function(req, res) {
    console.log(req.body);

    if (!req.body) return res.sendStatus(400);
    res.send('welcome, ' + req.body.username);
});
app.get('/main', function(req, res) {
    res.render('chat_room.html');
});

//handling socket.io
io.on('connection', function(socket) {
    console.log('a user connected 1');

    socket.on('disconnect', function() {
        console.log('user disconnected');
    });
    socket.on('chat message', function(msg) {
        console.log(msg);
        io.emit('chat message', msg);
    });
})

//socket for ttm
var ttm = io.of('/ttm-chat');
ttm.on('connection', function(socket) {
    console.log('someone connected to ttm');
    socket.join('tinh tinh', () => {
        let rooms = Object.keys(socket.rooms);
        console.log(rooms); // [ <socket.id>, 'room 237' ]
    });

    socket.in('tinh tinh').on('chat message', function(msg) {
        console.log('ttm room tinh tinh ' + msg);
        ttm.in('tinh tinh').emit('chat message', msg);
    });

    console.log('socket id ' + socket.id);
    console.log('rooms ');
    console.log(socket.rooms);
});

//server listen
http.listen(3000, function() {
    console.log('listening on *:3000');
});