(function($) {
    //connect global channel
    var socket = io();
    //connect current org channel
    var socketOrg = io('/ttm');
    var socketGB = io('/GB');

    var worldRoom = 'room';
    var user = $('#user').val();
    var rooms = [];
    var curRoom = worldRoom;
    var curSocket = socket;
    var chatContent = {};
    console.log(chatContent);
    connectRooms();
    console.log(chatContent);

    //send message to server
    $('.btn-chat-submit').on('click', function() {
        // socket.emit('global room msg', $('.input-chat-msg').val());
        sendMsg(curSocket, curRoom);
        $('.input-chat-msg').val('');
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
                alert('change room error');
                location.href = '/';
                break;
        }

        loadNewChatContent(oldRoom);

        $('.chat-active').removeClass('chat-active');
        $(this).addClass('chat-active');
    });

    function sendMsg(sk, room) {
        var content = $('.input-chat-msg').val(); 
        var roomEvent = room == worldRoom ? 'chat message' : room + '::' + 'chat message';
        if (content == '') {
            alert('Please input message first!');
            return;
        }
        var msgObj = {
            content: $('.input-chat-msg').val(),
            room: room
        };
        sk.emit(roomEvent, msgObj);
        $('.input-chat-msg').focus();
    }

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
            $('.chatbody table tbody').append(temp);
            // document.getElementById('scroll').scrollTop = message.offsetHeight + message.offsetTop; 
            $('.chatbody').animate({ scrollTop: $('.chatbody table').height() }, 1000);
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

    function connectRooms() {
        var divRooms = $('div[id^="qr-"]');
        for (var i = 0; i < divRooms.length; i++) {
        
            var getTxt = $(divRooms[i]).attr('id').split('qr-')[1];
            console.log(getTxt);

            switch (getTxt.slice(0, 2)) {
                case 'w-':
                    connectRoom(socket, worldRoom);
                    chatContent[worldRoom] = $('.chatbody table tbody').html();
                    break;
                case 'g-':
                    // rooms.push(getTxt.replace('g-',''));
                    connectRoom(socketGB, getTxt.replace('g-',''));
                    chatContent[getTxt.replace('g-','')] = $('.chatbody table tbody').html();
                    break;
                case 'm-':
                    // rooms.push(getTxt.replace('m-',''));
                    connectRoom(socketOrg, getTxt.replace('m-',''));
                    chatContent[getTxt.replace('m-','')] = $('.chatbody table tbody').html();
                    break;
                default:
                    break;
            }
        }
    }

    function connectRoom(sk, room) {        
        var roomEvent = room == worldRoom ? 'chat message' : room + '::' + 'chat message';
        sk.on(roomEvent, function(msg) {
            insertChat(msg, room);
        });
    }

    function loadNewChatContent(old) {
        //store current chat room content
        chatContent[old] = $('.chatbody table tbody').html();
        console.log(old);
        //get selected chat room content if exist & display
        if (chatContent[curRoom] != undefined) {
            $('.chatbody table tbody').html(chatContent[curRoom]);
        } else {
            $('.chatbody table tbody').html('');
        }
    }
})(jQuery);