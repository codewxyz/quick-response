(function($) {
    //connect global channel
    var socket = io();
    //connect current org channel
    var socketNs = {
        GB: io('/GB'),
        ttm: io('/ttm')
    }
    // var socketNs.ttm = io('/ttm');
    // var socketNs.GB = io('/GB');

    var qrsEvents = {
        message: 'chat message',
        count_online: 'count user online',
        buzz: 'chat buzz'
    }
    var alertMsg = {
        change_room_err: 'Cannot change room.',
        validate_err_01: 'Please input message first.'
    };
    var selectorList = {
        chat_container_inner: '.chatbody table tbody',
        chat_container: '.chatbody',
        input_msg: '.input-chat-msg'
    };

    var worldRoom = 'room';
    var user = $('#user').val();
    var curRoom = worldRoom;
    var curSocket = socket;
    var chatContent = {};

    connectRooms();

    //send message to server
    $('.btn-chat-submit').on('click', function() {
        sendMsg(curSocket, curRoom);
        $(selectorList.input_msg).val('');
        return false;
    });

    //change chat room
    $('.chat-room').on('click', function () {
        var oldRoom = curRoom;
        var getNs = $(this).data('ns');
        var getRoom = $(this).data('room');

        if (getNs == 'W') {
            curRoom = worldRoom;
            curSocket = socket;
        } else {
            curRoom = getRoom;
            curSocket = socketNs[getNs];
        }

        loadNewChatContent(oldRoom);

        $('.chat-active').removeClass('chat-active');
        $(this).addClass('chat-active');
        $('#r-'+curRoom).find('.chat-room-unread').html('');
    });

    //validate input and send to server
    function sendMsg(sk, room) {
        console.log(curSocket);
        var content = $(selectorList.input_msg).val(); 
        var roomEvent = createChatEvent(room, qrsEvents.message);
        if (content == '') {
            alert(alertMsg.validate_err_01);
            return;
        }
        var msgObj = {
            content: $(selectorList.input_msg).val(),
            room: room,
            ns: curSocket.nsp
        };
        sk.emit(roomEvent, msgObj);
        $(selectorList.input_msg).focus();
    }

    //receive message and display/store to target room
    function insertChat(obj, room) {
        var selfClass = '';
        if (user == obj.user) {
            selfClass = ['my-avatar', 'my-msg'];
        }
        var temp = '<tr> \
                    <td class="avatar '+selfClass[0]+'"><img src="'+obj.avatar+'" alt="avatar"/></td> \
                    <td class="display-msg '+selfClass[1]+'"> \
                    <p class="display-msg-header"><span class="display-msg-header-username">'+obj.name+'</span> '+
                    '<span class="display-msg-header-time">'+obj.time+'</span></p> \
                    <p class="display-msg-content">'+formatMsg(obj.msg)+'</p> \
                    </td> \
                    </tr>';

        //check to store or display this message                    
        if (room == curRoom) {
            $(selectorList.chat_container_inner).append(temp);
            //auto scroll to newest message on screen
            $(selectorList.chat_container).animate({ scrollTop: $(selectorList.chat_container_inner).height() }, 1000);
        } else {
            if (chatContent[room] != undefined) {
                chatContent[room] += temp;
            } else {
                chatContent[room] = temp;
            }

            var unreadhHtml = $('#r-'+room).find('.chat-room-unread').html();
            console.log(room);
            $('#r-'+room).find('.chat-room-unread').html(parseInt(unreadhHtml == '' ? 0 : unreadhHtml)+1);
        }
    }

    function formatMsg(msg) {
        return msg.replace(/\n/gi, "<br/>");
    }

    //init run, connect to all room user has access
    function connectRooms() {
        var divRooms = $('.chat-room');
        for (var i = 0; i < divRooms.length; i++) {
        
            var getNs = $(divRooms[i]).data('ns');
            var getRoom = $(divRooms[i]).data('room');

            if (getNs == 'W') {
                connectRoom(socket, worldRoom);
                // eventCountOnline(socket, worldRoom);
                chatContent[worldRoom] = $(selectorList.chat_container_inner).html();
            } else {
                connectRoom(socketNs[getNs], getRoom);
                chatContent[getRoom] = $(selectorList.chat_container_inner).html();
            }
            eventCountOnline(socket, getRoom);
        }
    }

    //listen on event of each room
    function connectRoom(sk, room) {        
        var roomEvent = createChatEvent(room, qrsEvents.message);
        sk.on(roomEvent, function(msg) {
            insertChat(msg, room);
        });
    }

    //get chat event code
    function createChatEvent(room, txtEvent) {
        return room == worldRoom ? txtEvent : room + '::' + txtEvent;
    }

    function loadNewChatContent(old) {
        //store current chat room content
        chatContent[old] = $(selectorList.chat_container_inner).html();
        //get selected chat room content if exist & display
        if (chatContent[curRoom] != undefined) {
            $(selectorList.chat_container_inner).html(chatContent[curRoom]);
        } else {
            $(selectorList.chat_container_inner).html('');
        }
    }

    function eventCountOnline(sk, room) {
        var roomEvent = createChatEvent(room, qrsEvents.count_online);
        sk.on(roomEvent, function(msg) {
            $('#r-'+room).find('.chat-room-online').html(msg.count);
        });
    }
})(jQuery);