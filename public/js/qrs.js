(function($) {
    //connect global channel
    var g_socketOpts = {
        path: '/qrchat',
        reconnectionAttempts: 5,
        transports: ['websocket']
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
        buzz: 'chat buzz',
        message_deleted: 'chat message deleted'
    };
    var g_orgEvents = {
        join_room: 'user join room',
        new_room: 'new room created',
        invite_chat: 'invite private chat',
        is_invite_chat: 'is invited with private chat'
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
        chat_container_table: '.chatbody table',
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
    var g_msgKeyHelper = 0;
    var g_scrollChatHelper = $(g_selectorList.chat_container).scrollTop();
    var g_isScrollHorizon = $(g_selectorList.chat_container).scrollLeft();
    var g_shouldNotify = 0;
    var g_isTabActive = 1;
    var g_prolongSession = setInterval(prolongSession, 55 * 60 * 1000); //set to 25min to avoid idle of free heroku instance
    var g_currentFavicon = 'favicon';

    connectRooms();

    setSocketEvents();

    //--------setup for notification--------
    isBrowserTabActive();
    checkNotify();

    //--------setup for emoji input---------
    // Initializes and creates emoji set from sprite sheet
    window.emojiPicker = new EmojiPicker({
        emojiable_selector: '[data-emojiable=true]',
        assetsPath: '../images/emoji/',
        popupButtonClasses: 'fa fa-smile-o'
    });
    // Finds all elements with `emojiable_selector` and converts them to rich emoji input fields
    // You may want to delay this step if you have dynamically created input fields that appear later in the loading process
    // It can be called as many times as necessary; previously converted input fields will not be converted again
    window.emojiPicker.discover();
    $(g_selectorList.input_msg).focus();
    //--------end setup for emoji input---------

    //-----------------user actons------------------
    $('body').on('shown.bs.popover', '.has-popover', function (e) {
        var contentE = e.currentTarget;
        var eUsername = $(contentE).data('username');
        var eName = $(contentE).data('name');
        var eAvatar = $(contentE).data('avatar');
        var eId = $(contentE).data('chatid');
        var itemUserArr = ['delete', 'edit'];

        $('#'+$(contentE).attr('aria-describedby'))
        .find('.list-group-item')
        .each(function (e) {
            var actionCode = $(this).data('action');
            if (g_user.username == eUsername) {
                if (actionCode == 'private-chat') {                    
                    $(this).addClass('disabled');
                    $(this).prop('disabled', true);
                    return;
                }
            } else {
                if (itemUserArr.indexOf(actionCode) > -1) {                  
                    $(this).addClass('disabled');
                    $(this).prop('disabled', true);
                    return;
                }
            }

            $(this).data('username', eUsername);
            $(this).data('chatid', eId);
            $(this).data('name', eName);
            $(this).data('avatar', eAvatar);
            $(this).data('popoverid', $(contentE).attr('aria-describedby'));
        });

        $('body').one('click', function () {
            if ($(contentE).parents().is('body')) {
                $(contentE).popover('destroy');
            } else {
                $('#'+$(contentE).attr('aria-describedby')).fadeOut(0);
            }
        });
    });

    $('body').on('click', '.popover-user-actions-item', function (e) {
        var action = $(this).data('action');
        var popoverid = $(this).data('popoverid');
        var uObj = {
            username: $(this).data('username'),
            name: $(this).data('name'),
            avatar: $(this).data('avatar'),
            chatid: $(this).data('chatid')
        };

        switch (action) {
            case 'profile':
                showUserProfile(uObj);
                break;
            case 'quote':
                getQuote(uObj);
                break;
            case 'edit':
                editMsg(uObj);
                break;
            case 'delete':
                confirmDeleteMsg(uObj);
                break;
            case 'private-chat':
                initPrivateChat(uObj);
                break;
            default:
                break;
        }
    });

    $('body').on('click', '.has-popover', function (e) {
        var contentE = e.currentTarget;
        var shouldShow = false;
        if ($(contentE).attr('aria-describedby') == undefined) {
            shouldShow = true;
        } else {
            if ($('#'+$(contentE).attr('aria-describedby')).length == 0) {
                $(contentE).removeAttr('aria-describedby');
                shouldShow = true;
            } else if ($('#'+$(contentE).attr('aria-describedby')).css('display') == 'none') {
                $(contentE).removeAttr('aria-describedby');
                $('#'+$(contentE).attr('aria-describedby')).remove();
                shouldShow = true;
            }
        }

        if (shouldShow) {
            $(contentE).popover({
                container: 'body',
                placement: 'right',
                trigger: 'manual',
                html: true,
                content: $('#popover-user-actions').html()
            }).popover('show');
        }
    });
    //-----------------end user action--------------------

    //reload first messages
    $('.display-msg-content').each(function() {
        if ($(this).data('remsg') != undefined) {
            $(this).html(formatMsg($(this).data('remsg')));
        }
    });

    //first auto scroll if chat section is long
    $(g_selectorList.chat_container).on('qrsheightchange', function(e, containerHeight) {
        var height = ($(g_selectorList.chat_container_table).height() < containerHeight) ? 
                        containerHeight : $(g_selectorList.chat_container_table).height();
        $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_table).height() }, 0);
        setTimeout(() => {
            g_scrollChatHelper = $(g_selectorList.chat_container).scrollTop();
        }, 20);
    });

    $(g_selectorList.chat_container).on('scroll', function() {
        if ($(this).scrollTop() == 0 && g_historyChatPage[g_curRoom] >= 1) {
            loadHistoryChatContent();
        }
    });

    //send message to server when enter
    //combine CTRL+Enter to use multi lines message
    $($(g_selectorList.input_msg)[1]).on('keydown', function(event) {
        var keyCode = event.which;
        if (keyCode == 17) {
            g_msgKeyHelper = keyCode;
        } else if (keyCode == 13 && g_msgKeyHelper != 17) {
            $('.btn-chat-submit').click();
        } else {
            g_msgKeyHelper = 0;
        }
        return;
    });
    $('.btn-chat-submit').on('click', function() {
        sendMsg(g_curSocket, g_curRoom);
        $(g_selectorList.input_msg).focus();
        $($(g_selectorList.input_msg)[1]).html('');
        return;
    });

    $('#new-room-btn').on('click', function() {
        $('#qr-modal-room').modal('show');
    });

    $('.chat-room-list').on('click', '.chat-room-add-member', function() {
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
                        g_socketOrg[data.orgCode].emit(g_orgEvents.join_room, { obj });
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
            org: $('#fm-room-org').val(),
            type: 'public'
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

    $('.chat-room-list').on('click', '.chat-room-change-room', function() {
        var parent = $(this).parent();
        if (!parent.hasClass('chat-active')) {
            var getNs = parent.data('org');
            var getRoom = parent.data('room');
            changeChatRoom(parent);
        }
    });

    $('.chat-room-list').on('click', '.chat-room-list-member', function() {
        var parent = $(this).parents().filter('.chat-room');
        var roomCode = parent.data('room');
        var data = {
            roomCode: roomCode
        };
        getMemberList(data);
    });

    $('body').on('click', '.btn-alert-confirm-ok', function () {
        var data = {
            chatid: $(this).data('chatid'),
            roomCode: g_curRoom
        };
        $.ajax({
            url: 'main/aj/delete-msg',
            type: 'post',
            data: data,
            dataType: 'json',
            complete: function(xhr, status) {

                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error delete message.');
                    $('#qr-alert').modal('show');
                }
            },
            success: function(result, status, xhr) {
                if (result.success) {
                    $('#'+getChatIdName(data.chatid)).find('.display-msg-content').addClass('display-msg-content-deleted');
                    $('#'+getChatIdName(data.chatid)).find('.display-msg-content').html(
                        '<i class="fa fa-times-circle text-danger"></i> This message has been deleted.'
                    );
                    data.username = g_user.username;
                    data.roomCode = g_curRoom;
                    g_curSocket.emit(g_roomEvents.message_deleted, data);
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
    });

    function confirmDeleteMsg(obj) {
        //user can only delete their own message
        if (g_user.username != obj.username) {
            return;
        }
        $('#qr-alert-confirm .modal-body').html('Do you want to delete this message permenantly?');
        $('#qr-alert-confirm .btn-alert-confirm-ok').addClass('btn-alert-confirm-deletemsg');
        $('#qr-alert-confirm .btn-alert-confirm-ok').data('chatid', obj.chatid);
        $('#qr-alert-confirm').modal('show');

    }

    function initPrivateChat(obj) {
        //user cannot private himself
        if (g_user.username == obj.username) {
            return;
        }

        //check if private room is existed on screen
        //swith to that room
        var findNode = $('a[id^="r-"').filter('[data-targetuser="'+obj.username+'"]');
        if(findNode.length > 0) {
            if (!findNode.hasClass('chat-active')) {
                changeChatRoom(findNode);
                if (findNode.data('room') != g_worldRoom) {
                    var roomNode = $(findNode).detach();
                    $('#'+getChatRoomIdName(g_worldRoom)).after(roomNode);
                }
            }
        } else {
            //if room does not exist, create one
            var data = {
                name: g_user.username+' and '+obj.username,
                type: 'private',
                targetUser: obj.username,
                users: obj.username
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
                        $('#qr-alert .modal-body').html('Error creating private room.');
                        $('#qr-alert').modal('show');
                    }
                },
                success: function(result, status, xhr) {

                    if (result.success) {
                        displayNewRoom(result.data);
                        notifyJoinRoom(result.data);
                        insertChatStatus({
                            roomCode: result.data.code, 
                            msg: 'You started a private chat with '+result.data.targetUser.name+'. Start your chat now...'
                        });
                    } else {
                        $('#qr-alert .modal-body').html(result.msg);
                        $('#qr-alert').modal('show');
                    }
                }
            });
        }
    }

    function showUserProfile(obj) {
        var username = obj.username;
        $.ajax({
            url: 'main/aj/user-profile?username='+username,
            type: 'get',
            dataType: 'json',
            complete: function(xhr, status) {
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error getting data.');
                    $('#qr-alert').modal('show');
                }
            },
            success: function(result, status, xhr) {
                if (result.success) {
                    var user = result.data;
                    $('#qr-modal-user-profile-avatar img').attr('src', user.avatar);
                    $('#qr-modal-user-profile-username').text(user.username);
                    $('#qr-modal-user-profile-name').text(user.name);
                    $('#qr-modal-user-profile-mail').text(user.email);
                    $('#qr-modal-user-profile').modal('show');
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
    }

    function getChatIdName(id, roomCode='') {
        return roomCode == '' ? 
                $.escapeSelector('msg-'+g_curRoom+'-'+id) : 
                $.escapeSelector('msg-'+roomCode+'-'+id);
    }

    function getChatRoomIdName(id) {
        return $.escapeSelector('r-'+id);
    }

    function getQuote(obj) {
        var chatid = obj.chatid;
        var name = obj.name;
        var quoteId = g_curRoom+chatid;

        var chatContent = $('#'+getChatIdName(chatid)).find('.display-msg-content').html();
        var findQuote = chatContent.match(/<div class="display-msg-quote">(.*?)<\/div>/g);
        if (findQuote != null && findQuote.length > 0) {
            chatContent = chatContent.replace(findQuote[0], '');
        }
        var temp = '';
        temp += '<div id="store-quote-'+quoteId+'" style="display:none;">';
        temp += '<div class="display-msg-quote">';
        temp += '<i class="fa fa-quote-left"></i> <b>'+name+'</b>:<br/>';
        temp += chatContent;
        temp += '</div>';
        temp += '</div>';
        $('body').append(temp);

        var representQuote = '[quote]'+quoteId+'[/quote]';
        $($(g_selectorList.input_msg)[1]).text(representQuote);
        $(g_selectorList.input_msg).focus();

        window.getSelection().collapse(
            document.getElementsByClassName('emoji-wysiwyg-editor')[0].firstChild, 
            representQuote.length
        );
    }

    function changeFavicon() {
        var src = '';
        if (g_currentFavicon == 'favicon' && g_isTabActive == 0) {
            src = '/images/favicon_active/favicon.ico';
            g_currentFavicon = 'favicon_active';
        } else if (g_currentFavicon == 'favicon_active' && g_isTabActive == 1) {
            src = '/images/favicon/favicon.ico';
            g_currentFavicon = 'favicon';
        } else {
            return;
        }
        var link = document.createElement('link'),
            oldLink = document.getElementById('dynamic-favicon');
        link.id = 'dynamic-favicon';
        link.rel = 'shortcut icon';
        link.href = src;
        if (oldLink) {
            document.head.removeChild(oldLink);
        }
        document.head.appendChild(link);
    }

    function prolongSession() {
        $.ajax({
            url: 'main/aj/ping',
            type: 'get',
            dataType: 'json',
            complete: function(xhr, status) {
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
            },
            success: function(result, status, xhr) {
                if (result.success) {
                    // console.log('re-lived the session');
                } else {
                    location.href = '/';
                }
            }
        });
    }

    function checkNotify() {
        // Let's check if the browser supports notifications
        if (!("Notification" in window)) {
            console.log("This browser does not support system notifications");
        }
        // Let's check whether notification permissions have already been granted
        else if (Notification.permission === "granted") {
            // If it's okay let's create a notification
            // var g_notify = new Notification("Hi there!");
            console.log("Notify granted.");
            return true;
        }
        // Otherwise, we need to ask the user for permission
        else if (Notification.permission !== 'denied') {
            Notification.requestPermission(function(permission) {
                // If the user accepts, let's create a notification
                if (permission === "granted") {
                    // var notification = new Notification("Hi there!");
                    console.log("Notify granted.");
                    return true;
                }
            });
        }
        return false;
    }

    function createNotify(msg, icon = '') {
        // body...
        var options = {
            body: msg,
            icon: icon == '' ? '/images/metro_mail.png' : icon,
        };

        var n = new Notification('Notification', options);
        setTimeout(n.close.bind(n), 10000);
    }

    function isBrowserTabActive() {
        // body...
        var hidden, visibilityChange;
        if (typeof document.hidden !== "undefined") {
            hidden = "hidden";
            visibilityChange = "visibilitychange";
        } else if (typeof document.mozHidden !== "undefined") {
            hidden = "mozHidden";
            visibilityChange = "mozvisibilitychange";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
        }
        if (typeof document.addEventListener === "undefined" || typeof document[hidden] === "undefined") {
            console.log("This requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.");
        } else {
            // Handle page visibility change   
            document.addEventListener(visibilityChange, function() {
                if (document[hidden]) {
                    g_isTabActive = 0;
                    g_shouldNotify = 1;
                } else {
                    g_isTabActive = 1;
                    g_shouldNotify = 0;
                    changeFavicon();
                }
            }, false);

        }
    }

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
                        temp += '<img src="${txt0}" alt="avatar" class="img-responsive img-circle" width="50"/>';
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

    function changeChatRoom(e) {
        var oldRoom = g_curRoom;
        var getNs = $(e).data('org');
        var getRoomCode = $(e).data('room');

        if (getNs == 'W') {
            g_curRoom = g_worldRoom;
            g_curSocket = g_socket;
        } else {
            g_curRoom = getRoomCode;
            g_curSocket = g_socketOrg[getNs];
        }
        loadNewChatContent(oldRoom);
        $('.chat-active').removeClass('chat-active');
        $(e).addClass('chat-active');
        $('#'+getChatRoomIdName(g_curRoom)).find('.chat-room-unread').html('');
    }

    function setSocketEvents() {
        //-----------FOR ORG SOCKETS------------
        for (var i in g_socketOrg) {
            //room events
            g_socketOrg[i].on(g_roomEvents.message, function(msg) {
                if (g_isTabActive == 0 && msg.username != g_user.username) {
                    changeFavicon();
                    if (g_shouldNotify == 1) {
                        createNotify('Spam mail arrived!');
                        g_shouldNotify = 0;
                    }
                }
                insertChat(msg);
            });
            g_socketOrg[i].on(g_roomEvents.message_failed, function(msg) {
                if (msg.username == g_user.username) {
                    insertChatStatus(msg);
                }
            });

            //custom org event
            g_socketOrg[i].on(g_orgEvents.new_room, (obj) => {
                if ((g_user.username == obj.username) &&
                    ($('#'+getChatRoomIdName(obj.room.code)).length == 0)) {
                    displayNewRoom(obj.room);
                    if (obj.room.type == 'private') {
                        insertChatStatus({
                            roomCode: obj.room.code, 
                            msg: obj.room.targetUser.name+' want to start a private chat with you. Start your chat now...'
                        });
                    }
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

        //------FOR DEFAULT SOCKET-----------
        g_socket.on(g_roomEvents.message, function(msg) {
            if (g_isTabActive == 0 && msg.username != g_user.username) {
                changeFavicon();
                if (g_shouldNotify == 1) {
                    createNotify('Spam mail arrived!');
                    g_shouldNotify = 0;
                }
            }
            insertChat(msg);
        });

        g_socket.on(g_roomEvents.message_failed, function(msg) {
            if (msg.username == g_user.username) {
                insertChatStatus(msg);
            }
        });

        g_socket.on(g_roomEvents.message_deleted, function(msg) {
            if (msg.username != g_user.username) {
                var deleteHtml = $.parseHTML('<i class="fa fa-times-circle text-danger"></i> This message has been deleted.');
                if ((g_curRoom == msg.roomCode) && ($('#'+getChatIdName(msg.chatid)).length > 0)) {            
                    $('#'+getChatIdName(msg.chatid)).find('.display-msg-content').addClass('display-msg-content-deleted');
                    $('#'+getChatIdName(msg.chatid)).find('.display-msg-content').html(deleteHtml);
                } else {
                    if (g_chatContent[msg.roomCode] != null) {
                        g_chatContent[msg.roomCode].find('#'+getChatIdName(msg.chatid, msg.roomCode))
                            .find('.display-msg-content').addClass('display-msg-content-deleted');
                        g_chatContent[msg.roomCode].find('#'+getChatIdName(msg.chatid, msg.roomCode))
                            .find('.display-msg-content').html(deleteHtml);
                    }
                }    
            }
        });

        g_socket.on(g_roomEvents.count_online, function(msg) {
            var roomCode = '#'+$.escapeSelector('r-' + msg.roomCode);
            var type = $(roomCode).data('rtype');

            if (type == 'private') {
                if (msg.count > 1) {
                    $(roomCode).find('.chat-room-private-status').removeClass('user-status-offline');
                    $(roomCode).find('.chat-room-private-status').addClass('user-status-online');
                    $(roomCode).find('.chat-room-private-status').text('online');
                } else {
                    $(roomCode).find('.chat-room-private-status').removeClass('user-status-online');
                    $(roomCode).find('.chat-room-private-status').addClass('user-status-offline');
                    $(roomCode).find('.chat-room-private-status').text('offline');
                }
            } else {
                $(roomCode).find('.chat-room-online').text(msg.count);
            }
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

    function getPrivateRoomTemplate(room) {
        var temp = '';
        temp += '<a href="javascript:void(0)" class="chat-room" id="r-${txt0}"';
        temp += 'data-room="${txt1}" data-org="${txt2}" data-rtype="${txt5}" data-targetuser="${txt6}">';
        temp += '<span class="chatimg">';
        temp += '<img src="${txt3}" alt="icon" />';
        temp += '</span>';
        temp += '<div class="chat-room-info">';
        temp += '<div class="chat-room-name">${txt4}</div>';
        temp += '<div class="chat-room-status">';
        temp += 'Status: <span class="chat-room-private-status user-status-online">checking...</span>&nbsp;&nbsp;';
        temp += '<span class="chat-room-unread badge"></span>';
        temp += '</div>';
        temp += '</div>';
        temp += '<div class="chat-room-change-room"></div>';
        temp += '</a>';
        temp = formatTxt(temp, [
            room.code,
            room.code,
            room.org,
            room.targetUser.avatar,
            room.targetUser.name,
            room.type,
            room.targetUser.username
        ]);
        return temp;
    }

    function getRoomTemplate(room) {
        var temp = '';
        temp += '<a href="javascript:void(0)" class="chat-room" id="r-${txt0}"';
        temp += 'data-room="${txt1}" data-org="${txt2}" data-rtype="${txt5}" data-targetuser="">';
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
            room.name,
            room.type

        ]);
        return temp;
    }

    function displayNewRoom(room) {
        var temp = room.type == 'private' ? getPrivateRoomTemplate(room) : getRoomTemplate(room);
        var parseHtml = $.parseHTML($.trim(temp));
        $('#'+getChatRoomIdName(g_worldRoom)).after(parseHtml);

        //save chat content of this room
        g_chatContent[room.code] = $.parseHTML('<tbody></tbody>');
        g_historyChatPage[room.code] = -1;

        //change seleted room to this room
        changeChatRoom(parseHtml);
    }


    function formatTxt(temp, txtArr) {
        for (var i in txtArr) {
            temp = temp.replace('${txt' + i + '}', txtArr[i]);
        }
        return temp;
    }

    //validate input and send to server
    function sendMsg(sk, room) {
        var content = $($(g_selectorList.input_msg)[1]).html().trim();
        // content = content.replace('<div><br></div>', '');
        // if (content.startsWith('<br>')) {
        //     content = content.replace('<br>', '');
        // }

        if ((content.split('<br>').join('') == '') ||
            (content.split('<div><br></div>').join('') == '')) {
            alert(g_alertMsg.validate_err_01);
            return;
        }
        var checkContent = content.match(/<div>(.*?)<\/div>/g);
        if (checkContent != null ) {
            content = content.split('<div>')[0] == '' ? '' : content.split('<div>')[0] + '<br>';
            content = content.split('<div>')[0]+checkContent.filter((val) => {                
                var newContent = val.replace(/(<br>)*<\/?div>/g,'').replace('<br>', '');
                return newContent != '';
            }).map(function(val){
                return val.replace(/(<br>)*<\/?div>/g,'').replace('<br>', '');
            }).join('<br/>');
        }
        // add quote if exist
        var quotes = content.match(/\[quote\](.*?)\[\/quote\]/g);
        var getQuote = '';
        var getMsg = content;
        if (quotes != null && quotes.length > 0) {
            getQuote = $('#store-quote-'+quotes[0].replace(/\[\/?quote\]/g,''));
            getMsg = getQuote.html()+content.replace(quotes[0], '');
            //remove stored quote DOM
            getQuote.remove();
        }
        var msgObj = {
            content: getMsg,
            roomCode: room,
            orgCode: g_curSocket.nsp
        };
        sk.emit(g_roomEvents.message, msgObj);
    }

    //receive message and display/store to target room
    function insertChat(obj) {
        roomCode = obj.roomCode;
        // obj.msg = forge.util.decodeUtf8(obj.msg);
        var temp = getDisplayMessageTemplate(obj);
        temp = $.parseHTML(temp);

        //check to store or display this message                    
        if (roomCode == g_curRoom) {
            $(g_selectorList.chat_container_inner).append(temp);
            //auto scroll to newest message on screen
            if ((obj.username == g_user.username) ||
                ($(g_selectorList.chat_container).scrollTop() >= g_scrollChatHelper)) {
                $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_table).height() }, 1000);
                setTimeout(() => {
                    g_scrollChatHelper = $(g_selectorList.chat_container).scrollTop();
                }, 1020);
            }
        } else {
            if (g_chatContent[roomCode] != undefined && g_chatContent[roomCode] != null) {
                g_chatContent[roomCode].append(temp);
            }

            var eRoomCode = '#' + getChatRoomIdName(roomCode);
            var unreadhHtml = $(eRoomCode).find('.chat-room-unread').html();

            $(eRoomCode).find('.chat-room-unread').html(parseInt(unreadhHtml == '' ? 0 : unreadhHtml) + 1);
            if (roomCode != g_worldRoom) {
                var roomNode = $(eRoomCode).detach();
                $('#'+getChatRoomIdName(g_worldRoom)).after(roomNode);
            }
        }
    }

    function getDisplayMessageTemplate(obj) {
        roomCode = obj.roomCode;
        var selfClass = ['',''];
        var msgStatusClass = '';
        if (g_user.username == obj.username) {
            selfClass = ['my-avatar', 'my-msg'];
        }
        if (obj.msg == '') {
            obj.msg = '<i class="fa fa-times-circle text-danger"></i> This message has been deleted.';
            msgStatusClass = 'display-msg-content-deleted';
        }
        var str = "";
        str += '<tr id="msg-${txt10}">';
        str += '<td class="avatar ${txt0}">';
        str += '<a class="has-popover" role="button" data-chatid="${txt7}" data-username="${txt8}" data-name="${txt9}">';
        str += '<img src="${txt1}" alt="avatar"/>';
        str += '</a>';
        str += '</td>';
        str += '<td class="display-msg ${txt2}">';
        str += '<p class="display-msg-header"><span class="display-msg-header-username">${txt3}</span>&nbsp;&nbsp;';
        str += '<span class="display-msg-header-time" data-toggle="tooltip" data-placement="bottom" title="${txt6}">${txt4}</span></p>';
        str += '<div class="display-msg-content ${txt11}">${txt5}</div>';
        str += '</td>';
        str += '</tr>';
        var temp = formatTxt(str, [
            selfClass[0],
            obj.avatar,
            selfClass[1],
            obj.name,
            obj.time,
            obj.msg,
            obj.datetime,
            obj.id,
            obj.username,
            obj.name,
            g_curRoom+'-'+obj.id,
            msgStatusClass
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
        str += '<td style="text-align: center; flex-grow: 2;" colspan="2">';
        str += '<span style="color:gray; font-size: 0.9em;">${txt0}</span>';
        str += '</td>';
        str += '</tr>';
        var temp = formatTxt(str, [
            obj.msg
        ]);

        //check to store or display this message                    
        if (roomCode == g_curRoom) {
            $(g_selectorList.chat_container_inner).append(temp);
            //auto scroll to newest message on screen
            $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_table).height() }, 1000);
            setTimeout(() => {
                g_scrollChatHelper = $(g_selectorList.chat_container).scrollTop();
            }, 1020);
        } else {
            if (g_chatContent[roomCode] != undefined && g_chatContent[roomCode] != null) {
                g_chatContent[roomCode].append(temp);
            } else {
                g_chatContent[roomCode] = $.parseHTML('<tbody></tbody>').append(temp);
            }
        }
    }

    function formatMsg(msg) {
        if (typeof(msg) == 'number') {
            msg = msg.toString();
        }
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
                g_chatContent[getRoom] = null;
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
            beforeSend: function(xhr) {
                // body...
                $(g_selectorList.chat_container_overlay).css('display', 'block');
                $(g_selectorList.chat_container_table).css('display', 'none');
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

                setTimeout(() => {
                    $(g_selectorList.chat_container_overlay).css('display', 'none');
                    $(g_selectorList.chat_container_table).css('display', '');
                }, 500);
            },
            success: function(result, status, xhr) {
                if (result.success) {
                    var chatStr = '';
                    if (result.data.length > 0) {
                        result.data.forEach((val) => {
                            chatStr += getDisplayMessageTemplate(val);
                        });
                        if ($(g_selectorList.chat_container_inner).length == 0) {

                            $(g_selectorList.chat_container_table)
                                .append($.parseHTML('<tbody></tbody>'))
                                .append($.parseHTML(chatStr));
                        } else {
                            $(g_selectorList.chat_container_inner).prepend($.parseHTML(chatStr));
                        }
                    }
                    var timer = setInterval(() => {
                        if ($(g_selectorList.chat_container_table).css('display') != 'none') {
                            if (g_historyChatPage[g_curRoom] < 1) {
                                $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_table).height() }, 0);
                                setTimeout(() => {
                                    g_scrollChatHelper = $(g_selectorList.chat_container).scrollTop();
                                }, 20);
                            } else {
                                $(g_selectorList.chat_container).animate({ scrollTop: 0 }, 0);
                            }
                            g_historyChatPage[g_curRoom] = result.data.length == 20 ? g_historyChatPage[g_curRoom] + 1 : -1;
                            clearInterval(timer);
                        }
                    }, 100);
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
    }

    function loadNewChatContent(old) {
        //store current chat room content
        g_chatContent[old] = $(g_selectorList.chat_container_inner).detach();
        //get selected chat room content if exist & display
        if (g_chatContent[g_curRoom] != null && g_historyChatPage[g_curRoom] != 0) {
            $(g_selectorList.chat_container_table).append(g_chatContent[g_curRoom]);
            $(g_selectorList.chat_container).animate({ scrollTop: $(g_selectorList.chat_container_table).height() }, 0);
            setTimeout(() => {
                g_scrollChatHelper = $(g_selectorList.chat_container).scrollTop();
            }, 20);
        } else {
            loadHistoryChatContent();
        }
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
                var data = [];
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