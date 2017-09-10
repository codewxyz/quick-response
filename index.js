var app = require('express')();
var http = require('http').Server(app);
var nunjucks = require('nunjucks');
var io = require('socket.io')(http);
var serveStatic = require('serve-static');

//set public directory for static files (css,js)
app.use(serveStatic('public', { 'index': false }));

//set up template engine for nunjucks
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

//---------------routing-----------------
app.get('/', function(req, res) {
    res.render('main.html', { name: 'hungtp', age: '25' });
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

//server listen
http.listen(3000, function() {
    console.log('listening on *:3000');
});