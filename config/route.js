
var loginController = require(global.root_dir+'/controllers/login.js');
var chatController = require(global.root_dir+'/controllers/chat.js');
var adminController = require(global.root_dir+'/controllers/admin.js');

module.exports = (app) => {
	app.get('/', function(req, res) {
	    if (global.auth.isAuthenticated(req)) {
	    	return res.redirect('/main');
	    } else {
	    	return res.redirect('/login');
	    }
	});

	app.get('/register', loginController.showRegister);
	app.post('/register', loginController.doRegister);

	app.get('/login', loginController.showLogin);
	app.post('/login', loginController.doLogin);

	app.post('/logout', loginController.doLogout);

	app.get('/main', chatController.show);
	app.get('/main/aj/ping', chatController.checkSession);
	app.get('/main/aj/user-profile', chatController.getUserProfile);
	app.get('/main/aj/user-search', chatController.searchUser);
	app.post('/main/aj/add-room', chatController.addRoom);
	app.post('/main/aj/add-members', chatController.addRoomMembers);
	app.post('/main/aj/room-members', chatController.getRoomMembers);
	app.post('/main/aj/chat-latest', chatController.getChatLatest);
	app.post('/main/aj/change-setting', chatController.changeSetting);

	app.get('/admin', adminController.show);
	app.get('/admin/search/user', adminController.searchUser);
	app.get('/admin/get/users', adminController.getUsers);
	app.get('/admin/get/orgs', adminController.getOrgs);
	app.get('/admin/get/rooms', adminController.getRooms);
	app.post('/admin/set/org', adminController.addOrg);
	app.post('/admin/set/org-users', adminController.addOrgUsers);
	app.post('/admin/set/room', adminController.addRoom);
	app.post('/admin/set/user', adminController.addUser);
};