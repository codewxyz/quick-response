(function($) {
    //connect global channel
    var socket = io();
    //connect current org channel
    var socketOrg = io('/ttm');
    var socketGB = io('/GB');

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
    $('.chatperson').on('click', function () {
        var oldRoom = curRoom;
        var getTxt = $(this).find('.namechat').attr('id').split('qr-')[1];

        switch (getTxt.slice(0, 2)) {
            case 'w-':
                curRoom = worldRoom;
                curSocket = socket;
                break;
            case 'g-':
                curRoom = getTxt.replace('g-','');
                curSocket = socketGB;
                break;
            case 'm-':
                curRoom = getTxt.replace('m-','');
                curSocket = socketOrg;
                break;
            default:
                alert(alertMsg.change_room_err);
                location.href = '/';
                break;
        }

        loadNewChatContent(oldRoom);

        $('.chat-active').removeClass('chat-active');
        $(this).addClass('chat-active');
    });

    //validate input and send to server
    function sendMsg(sk, room) {
        var content = $(selectorList.input_msg).val(); 
        var roomEvent = createChatEvent(room, qrsEvents.message);
        if (content == '') {
            alert(alertMsg.validate_err_01);
            return;
        }
        var msgObj = {
            content: $(selectorList.input_msg).val(),
            room: room
        };
        sk.emit(roomEvent, msgObj);
        $(selectorList.input_msg).focus();
    }

    //receive message and display/store to target room
    function insertChat(obj, room) {
        var selfClass = '';
        if (user == obj.user) {
            selfClass = 'avatar-me';
        }
        var temp = '<tr> \
                    <td class="avatar '+selfClass+'"><img src="/images/default-user.png" /></td> \
                    <td class="display-msg"> \
                    <p class="display-msg-header">'+obj.user+' '+obj.time+'</p> \
                    <p class="display-msg-content">'+formatMsg(obj.msg)+'</p> \
                    </td></td> \
                    <td class="msg-info"> \
                        Opts \
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
        }
    }

    function formatMsg(msg) {
        return msg.replace(/\n/gi, "<br/>");
    }

    //init run, connect to all room user has access
    function connectRooms() {
        var divRooms = $('div[id^="qr-"]');
        for (var i = 0; i < divRooms.length; i++) {
        
            var getTxt = $(divRooms[i]).attr('id').split('qr-')[1];
            console.log(getTxt);

            switch (getTxt.slice(0, 2)) {
                case 'w-':
                    connectRoom(socket, worldRoom);
                    eventCountOnline(socket, worldRoom, divRooms[i])
                    chatContent[worldRoom] = $(selectorList.chat_container_inner).html();
                    break;
                case 'g-':
                    connectRoom(socketGB, getTxt.replace('g-',''));
                    eventCountOnline(socket, getTxt.replace('g-',''), divRooms[i]);
                    chatContent[getTxt.replace('g-','')] = $(selectorList.chat_container_inner).html();
                    break;
                case 'm-':
                    connectRoom(socketOrg, getTxt.replace('m-',''));
                    eventCountOnline(socket, getTxt.replace('m-',''), divRooms[i]);
                    chatContent[getTxt.replace('m-','')] = $(selectorList.chat_container_inner).html();
                    break;
                default:
                    break;
            }
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

    function eventCountOnline(sk, room, e) {
        var roomEvent = createChatEvent(room, qrsEvents.count_online);
        sk.on(roomEvent, function(msg) {
            $(e).find('.lastmsg span').html(msg.count);
        });
    }
})(jQuery);