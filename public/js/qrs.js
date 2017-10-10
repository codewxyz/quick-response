(function($) {
    //connect global channel
    var g_socketOpts = {
        path: '/qrchat',
        reconnectionAttempts: 5
    };
    var g_socket = io('/', g_socketOpts);
    //connect current org channel
    var g_socketOrg = {
        qrgb: io('/qrgb', g_socketOpts)
    };

    var g_roomEvents = {
        message: 'chat message',
        message_failed: 'chat message send failed',
        count_online: 'count user online',
        buzz: 'chat buzz'
    };
    var g_orgEvents = {
        join_room: 'user join room',
        new_room: 'new room created'
    };
    var g_socketClientEvents = {
        connect: 'connect',
        disconnect: 'disconnect',
        error: 'error',
        connect_error: 'connect_error',
        connect_timeout: 'connect_timeout',
        reconnect: 'reconnect',
        reconnect_attempt: 'reconnect_attempt',
        reconnecting: 'reconnecting',
        reconnecting_error: 'reconnecting_error',
        reconnecting_failed: 'reconnecting_failed',
        ping: 'ping',
        pong: 'pong'
    };
    var g_alertMsg = {
        change_room_err: 'Cannot change room.',
        validate_err_01: 'Please input message first.'
    };
    var g_selectorList = {
        chat_container_inner: '.chatbody table tbody',
        chat_container: '.chatbody',
        chat_container_overlay: '.chatbody-overlay',
        input_msg: '.input-chat-msg'
    };

    var g_worldRoom = 'room';
    var g_user = $('#user').data();
    var g_curRoom = g_worldRoom;
    var g_curSocket = g_socket;
    var g_chatContent = {};
    var g_historyChatPage = {};

    connectRooms();

    setSocketEvents();

    //reload first messages
    $('.display-msg-content').each(function() {
        $(this).html(formatMsg($(this).data('remsg')));
    });

    //first auto scroll if chat section is long
    $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_inner).height() }, 1000);

    $(g_selectorList.chat_container).on('scroll', function () {
        if ($(this).scrollTop() == 0 && g_historyChatPage[g_curRoom] > -1) {
            loadHistoryChatContent();
        }
    });

    //send message to server
    $(g_selectorList.input_msg).keypress(function(event) {
        console.log(event.which);
        var keyCode = event.which;
        if (keyCode == 13) {
            $('.btn-chat-submit').click();
        }
    });
    $('.btn-chat-submit').on('click', function() {
        sendMsg(g_curSocket, g_curRoom);
        $(g_selectorList.input_msg).val('');
        return false;
    });

    $('#new-room-btn').on('click', function() {
        $('#qr-modal-room').modal('show');
    });

    $('.chat-room-add-member').on('click', function() {
        $('#fm-add-member-room').val($(this).parent().parent().find('.chat-room-name').html());
        $('#fm-add-member-room-code').val($(this).parents().filter('.chat-room').data('room'));
        $('#fm-add-member-org-code').val($(this).parents().filter('.chat-room').data('org'));
        $('#qr-modal-add-member').modal('show');
    });

    $('.nav-setting').on('click', function() {
        $('#qr-modal-setting').modal('show');
    });

    $('.btn-fm-setting-submit').on('click', function() {
        var data = {
            username: $('#fm-setting-username').val(),
            name: $('#fm-setting-name').val(),
            avatar: $('#fm-setting-avatar').val(),
            email: $('#fm-setting-email').val(),
            password: $('#fm-setting-password').val(),
            repassword: $('#fm-setting-repassword').val()
        };
        $.ajax({
            url: 'main/aj/change-setting',
            type: 'post',
            data: data,
            dataType: 'json',
            complete: function(xhr, status) {
                
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error updating data.');
                    $('#qr-alert').modal('show');
                }
                $('#qr-modal-setting').modal('hide');
            },
            success: function(result, status, xhr) {
                
                if (result.success) {
                    $('#do-logout').click();
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });

    });

    $('.btn-fm-add-member-submit').on('click', function() {
        var data = {
            roomCode: $('#fm-add-member-room-code').val(),
            orgCode: $('#fm-add-member-org-code').val(),
            users: $('#fm-add-member-users').val()
        };
        $.ajax({
            url: 'main/aj/add-members',
            type: 'post',
            data: data,
            dataType: 'json',
            complete: function(xhr, status) {
                
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error adding members.');
                    $('#qr-alert').modal('show');
                }
                $('#qr-modal-add-member').modal('hide');
            },
            success: function(result, status, xhr) {
                
                if (result.success) {
                    result.data.forEach((val) => {
                        var obj = {
                            roomCode: data.roomCode,
                            username: val
                        };
                        g_socketOrg[data.orgCode].emit(g_orgEvents.join_room, {obj});
                    });
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
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
                
                if (result.success) {
                    $('#qr-alert .modal-body').html(result.msg);
                    displayNewRoom(result.data);
                    notifyJoinRoom(result.data);
                    $('#qr-alert').modal('show');
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
    });

    $('#qr-modal-room, #qr-modal-add-member').on('hidden.bs.modal', function() {
        $(this).find('input').val('');
    });

    $('#qr-modal-setting').on('hidden.bs.modal', function() {
        $('#fm-setting-username').val(g_user.username);
        $('#fm-setting-name').val(g_user.name);
        $('#fm-setting-email').val(g_user.email);
        $('#fm-setting-avatar').val(g_user.avatar);
        $('#fm-setting-password').val('');
        $('#fm-setting-repassword').val('');
    });

    $('.chat-room-change-room').on('click', function() {
        var parent = $(this).parent();
        var getNs = $(parent).data('org');
        var getRoom = $(parent).data('room');
        changeChatRoom(getNs, getRoom, parent);
    });

    $('.chat-room-list-member').on('click', function() {
        var parent = $(this).parents().filter('.chat-room');
        var roomCode = parent.data('room');
        var data = {
            roomCode: roomCode
        };
        getMemberList(data);
    });

    function getMemberList(data) {
        $.ajax({
            url: 'main/aj/room-members',
            type: 'post',
            data: data,
            dataType: 'json',
            complete: function(xhr, status) {
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
                if (result.success) {
                    var str = "";
                    str += '<tr>';
                    str += '<th></th>';
                    str += '<th>Username</th>';
                    str += '<th>Status</th>';
                    str += '</tr>';
                    $('.qr-modal-room-list-member-table').html(str);
                    result.data.forEach((val) => {
                        var temp = '';
                        temp += '<tr>';
                        temp += '<td>';
                        temp += '<img src="${txt0}" alt="avatar" class="img-responsive img-thumbnail" width="50px"/>';
                        temp += '</td>';
                        temp += '<td>';
                        temp += '${txt1}';
                        temp += '</td>';
                        temp += '<td>';
                        temp += '${txt2}';
                        temp += '</td>';
                        temp += '</tr>';
                        temp = formatTxt(temp, [
                            val.avatar,
                            val.username,
                            val.status == 'online' ? 
                            '<span style="color:green;">online</span>' : '<span style="color:red;">offline</span>'
                        ]);
                        $('.qr-modal-room-list-member-table').append(temp);

                    });
                    $('#qr-modal-room-list-member').modal('show');
                } else {
                    $('#qr-modal-room-list-member .modal-body').html(result.msg);
                    $('#qr-modal-room-list-member').modal('show');
                }
            }
        });
    }

    function changeChatRoom(getNs, getRoom, e) {
        var oldRoom = g_curRoom;

        if (getNs == 'W') {
            g_curRoom = g_worldRoom;
            g_curSocket = g_socket;
        } else {
            g_curRoom = getRoom;
            g_curSocket = g_socketOrg[getNs];
        }
        console.log('old room '+oldRoom);
        console.log('new room '+g_curRoom);
        loadNewChatContent(oldRoom);

        $('.chat-active').removeClass('chat-active');
        $(e).addClass('chat-active');
        $('#r-' + g_curRoom).find('.chat-room-unread').html('');
    }

    function setSocketEvents() {
        //-----------for org sockets------------
        for (var i in g_socketOrg) {
            //room events
            g_socketOrg[i].on(g_roomEvents.message, function(msg) {
                insertChat(msg);
            });
            g_socketOrg[i].on(g_roomEvents.message_failed, function(msg) {
                insertChatStatus(msg);
            });

            //custom org event
            g_socketOrg[i].on(g_orgEvents.new_room, (obj) => {
                if ( (g_user.username == obj.username) && 
                    ($('#r-'+obj.room.code).length == 0) ) {
                    displayNewRoom(obj.room);
                }
            });

            //default org events
            g_socketOrg[i].on(g_socketClientEvents.connect, () => {
                console.log('socket connected');
            });

            g_socketOrg[i].on(g_socketClientEvents.connect_timeout, () => {
                console.log('socket connection timeout');
            });

            g_socketOrg[i].on(g_socketClientEvents.reconnecting_failed, () => {
                console.log('failed to reconnect socket');
                // location.href = '/';
            });

            g_socketOrg[i].on(g_socketClientEvents.error, (err) => {
                console.log('socket connection error');
                console.log(err);
                // location.href = '/';
            });
        }

        //------for default socket-----------
        g_socket.on(g_roomEvents.message, function(msg) {
            insertChat(msg);
        });
        g_socket.on(g_roomEvents.message_failed, function(msg) {
            insertChatStatus(msg);
        });

        g_socket.on(g_roomEvents.count_online, function(msg) {
            $('#r-' + msg.roomCode).find('.chat-room-online').html(msg.count);
        });

        g_socket.on(g_socketClientEvents.connect_timeout, () => {
            console.log('socket connection timeout');
        });
        g_socket.on(g_socketClientEvents.reconnecting_failed, () => {
            console.log('failed to reconnect socket');
            location.href = '/';
        });
        g_socket.on(g_socketClientEvents.error, (err) => {
            console.log('socket connection error');
            console.log(err);
            location.href = '/';
        });
        g_socket.on(g_socketClientEvents.connect, () => {
            console.log('socket connected');
        });
    }

    function notifyJoinRoom(room) {
        var obj = {
            roomCode: room.code
        };
        g_socketOrg[room.org].emit(g_orgEvents.new_room, obj);
    }

    function displayNewRoom(room) {
        var temp = '';
        temp += '<a href="javascript:void(0)" class="chat-room" id="r-${txt0}"';
        temp += 'data-room="${txt1}" data-org="${txt2}">';
        temp += '<span class="chatimg">';
        temp += '<img src="${txt3}" />';
        temp += '</span>';
        temp += '<div class="chat-room-info">';
        temp += '<div class="chat-room-name">${txt4}</div>';
        temp += '<div class="chat-room-status">';
        temp += 'Online: <span class="chat-room-online">1</span>&nbsp;&nbsp;';
        temp += '<i class="fa fa-users chat-room-list-member" title="view member list"></i>&nbsp;&nbsp;';
        temp += '<i class="fa fa-user-plus chat-room-add-member" title="add members"></i>&nbsp;&nbsp;';
        temp += '<span class="chat-room-unread badge"></span>';
        temp += '</div>';
        temp += '</div>';
        temp += '<div class="chat-room-change-room"></div>';
        temp += '</a>';
        temp = formatTxt(temp, [
            room.code,
            room.code,
            room.org,
            room.avatar,
            room.name
        ]);
        var parseHtml = $.parseHTML($.trim(temp));
        $('.chat-room-list').append(parseHtml);

        //save chat content of this room
        g_chatContent[room.code] = '';
        g_historyChatPage[room.code] = -1;

        //add event to this room DOM node
        $(parseHtml).find('.chat-room-change-room').on('click', function() {
            var parent = $(this).parent();
            var getNs = $(parent).data('org');
            var getRoom = $(parent).data('room');
            changeChatRoom(getNs, getRoom, parent);
        });

        $(parseHtml).find('.chat-room-list-member').on('click', function() {
            var parent = $(this).parents().filter('.chat-room');
            var roomCode = parent.data('room');
            var data = {
                roomCode: roomCode
            };
            getMemberList(data);
        });

        $(parseHtml).find('.chat-room-add-member').on('click', function() {
            $('#fm-add-member-room').val($(this).parent().parent().find('.chat-room-name').html());
            $('#fm-add-member-room-code').val($(this).parents().filter('.chat-room').data('room'));
            $('#fm-add-member-org-code').val($(this).parents().filter('.chat-room').data('org'));
            $('#qr-modal-add-member').modal('show');
        });
        //change seleted room to this room
        changeChatRoom(room.org, room.code, parseHtml);
    }


    function formatTxt(temp, txtArr) {
        for (var i in txtArr) {
            temp = temp.replace('${txt' + i + '}', txtArr[i]);
        }
        return temp;
    }

    //validate input and send to server
    function sendMsg(sk, room) {
        var content = $(g_selectorList.input_msg).val();
        if (content == '') {
            alert(g_alertMsg.validate_err_01);
            return;
        }
        // var getMsg = forge.util.encodeUtf8($($(g_selectorList.input_msg)[1]).html());
        var getMsg = $($(g_selectorList.input_msg)[1]).html();
        var msgObj = {
            content: getMsg,
            roomCode: room,
            orgCode: g_curSocket.nsp
        };
        sk.emit(g_roomEvents.message, msgObj);
        $($(g_selectorList.input_msg)[1]).html('');
        $(g_selectorList.input_msg).focus();
    }

    //receive message and display/store to target room
    function insertChat(obj) {
        roomCode = obj.roomCode;
        // obj.msg = forge.util.decodeUtf8(obj.msg);
        var temp = getFormattedChat(obj);

        //check to store or display this message                    
        if (roomCode == g_curRoom) {
            var oldHeight = $(g_selectorList.chat_container_inner).height();
            $(g_selectorList.chat_container_inner).append(temp);
            //auto scroll to newest message on screen
            if ($(g_selectorList.chat_container).scrollTop >= oldHeight) {
                $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_inner).height() }, 1000);
            }
        } else {
            if (g_chatContent[roomCode] != undefined) {
                g_chatContent[roomCode] += temp;
            } else {
                g_chatContent[roomCode] = temp;
            }

            var unreadhHtml = $('#r-' + roomCode).find('.chat-room-unread').html();
            $('#r-' + roomCode).find('.chat-room-unread').html(parseInt(unreadhHtml == '' ? 0 : unreadhHtml) + 1);
        }
    }

    function getFormattedChat(obj) {
        roomCode = obj.roomCode;
        var selfClass = '';
        if (g_user.username == obj.username) {
            selfClass = ['my-avatar', 'my-msg'];
        }
        var str = "";
        str += '<tr>';
        str += '<td class="avatar ${txt0}"><img src="${txt1}" alt="avatar"/></td>';
        str += '<td class="display-msg ${txt2}">';
        str += '<p class="display-msg-header"><span class="display-msg-header-username">${txt3}</span>&nbsp;&nbsp;';
        str += '<span class="display-msg-header-time">${txt4}</span></p>';
        str += '<p class="display-msg-content">${txt5}</p>';
        str += '</td>';
        str += '</tr>';
        var temp = formatTxt(str, [
            selfClass[0],
            obj.avatar,
            selfClass[1],
            obj.name,
            obj.time,
            formatMsg(obj.msg)
        ]);
        return temp;
    }

    /**
     * insert status send from server to chat content section
     * @param  {Object} obj [description]
     * @return {void}     [description]
     */
    function insertChatStatus(obj) {
        roomCode = obj.roomCode;
        var str = "";
        str += '<tr>';
        str += '<td style="text-align: center;" colspan="2">';
        str += '<span style="color:gray; font-size: 0.8em;">${txt0}</span>';
        str += '</td>';
        str += '</tr>';
        var temp = formatTxt(str, [
            obj.msg
        ]);

        //check to store or display this message                    
        if (roomCode == g_curRoom) {
            $(g_selectorList.chat_container_inner).append(temp);
            //auto scroll to newest message on screen
            $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_inner).height() }, 1000);
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
            var getSk = null;

            if (getNs == 'W') {
                getSk = g_socket;
                getRoom = g_worldRoom;
                g_chatContent[getRoom] = $(g_selectorList.chat_container_inner).html();
                g_historyChatPage[getRoom] = 1;

            } else {
                getSk = g_socketOrg[getNs];
                g_chatContent[getRoom] = null;
                g_historyChatPage[getRoom] = 0;
            }
        }
    }

    function loadHistoryChatContent() {
        $.ajax({
            url: 'main/aj/chat-latest',
            data: {
                roomCode: g_curRoom,
                page: g_historyChatPage[g_curRoom]
            },
            type: 'post',
            beforeSend: function (xhr) {
                // body...
                $(g_selectorList.chat_container_overlay).css('display', 'block');
                $(g_selectorList.chat_container_inner).css('display', 'none');
            },
            complete: function(xhr, status) {
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error getting data.');
                    $('#qr-alert').modal('show');
                }
                setTimeout(()=>{                        
                    $(g_selectorList.chat_container_overlay).css('display', 'none');
                    $(g_selectorList.chat_container_inner).css('display', 'block');
                }, 1000);
            },
            success: function(result, status, xhr) {
                if (result.success) {
                    var chatStr = '';
                    if (result.data.length > 0) {
                        result.data.forEach((val) => {
                            chatStr += getFormattedChat(val);
                        });
                        $(g_selectorList.chat_container_inner).prepend(chatStr);
                        g_historyChatPage[g_curRoom]++;
                    } else {
                        g_historyChatPage[g_curRoom] = -1;
                    }
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
    }

    function loadNewChatContent(old) {
        //store current chat room content
        g_chatContent[old] = $(g_selectorList.chat_container_inner).html();
        //get selected chat room content if exist & display
        if (g_chatContent[g_curRoom] != null) {
            $(g_selectorList.chat_container_inner).html(g_chatContent[g_curRoom]);
        } else {
            $(g_selectorList.chat_container_inner).html('');
            loadHistoryChatContent();
        }
        $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_inner).height() }, 0);
    }


    //---------------autocomplete input----------------

    function split(val) {
        return val.split(/,\s*/);
    }

    function extractLast(term) {
        return split(term).pop();
    }

    $("#fm-room-users, #fm-add-member-users")
        // don't navigate away from the field on tab when selecting an item
        .on("keydown", function(event) {
            if (event.keyCode === $.ui.keyCode.TAB &&
                $(this).autocomplete("instance").menu.active) {
                event.preventDefault();
            }
        })
        .autocomplete({
            source: function(request, response) {
                var data =[];
                if ($(this.bindings[0]).attr('id') == 'fm-add-member-users') {
                    data = {
                        term: extractLast(request.term),
                        org: $('#fm-add-member-org-code').val(),
                        room: $('#fm-add-member-room-code').val()
                    };
                } else {
                    data = {
                        term: extractLast(request.term),
                        org: $('#fm-room-org').val(),
                        room: ''
                    };
                }
                $.ajax({
                    url: 'main/aj/user-search',
                    data: data,
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