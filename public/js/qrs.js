(function($) {
    //connect global channel
    var socket = io();
    //connect current org channel
    var socketOrg = {
        qrgb: io('/qrgb')
    };

    var qrsEvents = {
        message: 'chat message',
        count_online: 'count user online',
        buzz: 'chat buzz'
    };
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
        var getNs = $(this).data('org');
        var getRoom = $(this).data('room');

        if (getNs == 'W') {
            curRoom = worldRoom;
            curSocket = socket;
        } else {
            curRoom = getRoom;
            curSocket = socketOrg[getNs];
        }

        loadNewChatContent(oldRoom);

        $('.chat-active').removeClass('chat-active');
        $(this).addClass('chat-active');
        $('#r-'+curRoom).find('.chat-room-unread').html('');
    });

    $('#new-room-btn').on('click', function() {
        $('#qr-modal-room').modal('show');
    });

    $('.btn-fm-room-submit').on('click', function() {
        var data = {
            name: $('#fm-room-name').val(),
            avatar: $('#fm-room-avatar').val(),
            users: $('#fm-room-users').val(),
            org: $('#fm-room-org').val()
        };
        $.ajax({
            url: 'main/aj/add-room',
            type: 'post',
            data: data,
            dataType: 'json',
            complete: function(xhr, status) {
                console.log(xhr);
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error creating data.');
                    $('#qr-alert').modal('show');
                }
                $('#qr-modal-room').modal('hide');
            },
            success: function(result, status, xhr) {
                console.log(xhr);
                if (result.success) {
                    $('#qr-alert .modal-body').html(result.msg);
                    displayNewRoom(result.data);
                    $('#qr-alert').modal('show');
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
    });

    function displayNewRoom(room) {
        var temp = '';
        temp += '<a href="javascript:void(0)" class="chat-room" id="r-${txt0}"';
        temp += 'data-room="${txt1}" data-ns="${txt2}">';
        temp += '<span class="chatimg">';
        temp += '<img src="${txt3}" />';
        temp += '</span>';
        temp += '<div class="chat-room-info">';
        temp += '<div class="chat-room-name">${txt4}</div>';
        temp += '<div class="chat-room-status">Online: <span class="chat-room-online">0</span> <span class="chat-room-unread badge"></span></div>';
        temp += '</div>';
        temp += '</a>';
        temp = formatTxt(temp, [
            room.code,
            room.code,
            room.org,
            room.avatar,
            room.name
        ]);
        $('.chat-room-list').append(temp);
    }


    function formatTxt(temp, txtArr) {
        for (var i in txtArr) {
            temp = temp.replace('${txt' + i + '}', txtArr[i]);
        }
        return temp;
    }

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
            org: curSocket.nsp
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
        
            var getNs = $(divRooms[i]).data('org');
            var getRoom = $(divRooms[i]).data('room');

            if (getNs == 'W') {
                connectRoom(socket, worldRoom);
                // eventCountOnline(socket, worldRoom);
                chatContent[worldRoom] = $(selectorList.chat_container_inner).html();
            } else {
                connectRoom(socketOrg[getNs], getRoom);
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


    //---------------autocomplete input----------------

    function split(val) {
        return val.split(/,\s*/);
    }

    function extractLast(term) {
        return split(term).pop();
    }

    $("#fm-room-users")
        // don't navigate away from the field on tab when selecting an item
        .on("keydown", function(event) {
            if (event.keyCode === $.ui.keyCode.TAB &&
                $(this).autocomplete("instance").menu.active) {
                event.preventDefault();
            }
        })
        .autocomplete({
            source: function(request, response) {
                $.ajax({
                    url: 'main/aj/user-search',
                    data: {
                        term: extractLast(request.term),
                        org: $('#fm-room-org').val()
                    },
                    type: 'get',
                    complete: function(xhr, status) {
                        if (xhr.status == 403) {
                            location.href = '/';
                            return;
                        }
                        if (status == 'error') {
                            response([{ label: "no data found", value: "no-data" }]);
                        }
                    },
                    success: function(result, status, xhr) {
                        if (result.success) {
                            response(result.data);
                        } else {
                            response([{ label: "no data found", value: "no-data" }]);
                        }
                    }
                });
            },
            search: function() {
                // custom minLength
                var term = extractLast(this.value);
                if (term.length < 3) {
                    return false;
                }
            },
            focus: function() {
                // prevent value inserted on focus
                return false;
            },
            select: function(event, ui) {
                var terms = split(this.value);
                // remove the current input
                terms.pop();
                // add the selected item
                if (ui.item.value != 'no-data')
                    terms.push(ui.item.value);
                // add placeholder to get the comma-and-space at the end
                terms.push("");
                this.value = terms.join(", ");
                return false;
            }
        });
})(jQuery);