(function($) {
    var ajaxGetData = {
        users: {
            urlget: '/admin/get/users',
            urlset: '/admin/set/user',
            urlsearch: '/admin/search/user',
            handle: (user) => { insertUser(user); }
        },
        orgs: {
            urlget: '/admin/get/orgs',
            urlset: '/admin/set/org',
            urlsetu: '/admin/set/org-users',
            handle: (user) => { insertOrg(user); }
        },
        rooms: {
            urlget: '/admin/get/rooms',
            urlset: '/admin/set/room',
            handle: (user) => { insertRoom(user); }
        }
    };

    getData('users');

    //change chat room
    $('.chat-room').on('click', function() {
        showLoading();
        $('.chatbody table tbody').html('');
        var getType = $(this).data('gtype');
        if (getType == 'rooms') {
            getSelectOrg();
        }

        getData(getType);

        $('.chat-active').removeClass('chat-active');
        $(this).addClass('chat-active');
    });

    $('.new-record').on('click', function() {
        var getType = $('.chat-active').data('gtype');

        $('form[id^=fm-create]').addClass('hide');
        $('#fm-create-' + getType).removeClass('hide');
        $('#qr-modal-form').modal('show');
    });

    $('.btn-fm-submit').on('click', function() {
        var getType = $('.chat-active').data('gtype');
        setData(getType);
    });

    $('.btn-fm-search-submit').on('click', function() {
        setOrgUsers();
    });

    $('#qr-fm-search , #qr-modal-form').on('hidden.bs.modal', function(e) {
        $('form input').val('');
    });

    function subActions() {

        $('.btn-sub-action').on('click', function() {
            var type = $(this).data('type');
            var code = $(this).data('code');
            switch (type) {
                case 'orgs-add-user':
                    $('#fm-search-org-code').val(code);
                    $('#qr-fm-search').modal('show');
                    break;
                default:
                    // statements_def
                    break;
            }
        });

    }

    function hideLoading() {
        $('.chatbody-loading').css('display', 'none');
        $('.chatbody table').css('display', 'inline-block');
    }

    function showLoading(argument) {
        $('.chatbody-loading').css('display', 'inline-block');
        $('.chatbody table').css('display', 'none');
    }

    function insertUser(user) {
        var str = "";
        str += '<tr>';
        str += '<td class="avatar"><img src="${txt0}" /></td>';
        str += '<td class="display-msg">';
        str += '<p>${txt1}</p>';
        str += '<p>Role: ${txt2}</p>';
        str += '<p>Actions: <button type="button" class="btn btn-default btn-xs btn-sub-action"';
        str += 'title="view details"';
        str += 'data-code="${txt3}"><i class="fa fa-eye"></i></button>';
        str += '<button type="button" class="btn btn-default btn-xs btn-sub-action" title="edit this user"';
        str += 'data-code="${txt4}"><i class="fa fa-pencil"></i></button></p>';
        str += '</td>';
        str += '</tr';
        var temp = formatTxt(
            str, 
            [user.avatar, user.username, user.role, user.username]
        );

        $('.chatbody table tbody').append(temp);
    }

    function insertOrg(org) {
        var str = "";
        str += '<tr>';
        str += '<td class="avatar"><img src="./images/logo.png" /></td>';
        str += '<td class="display-msg">';
        str += '<p>${txt0}</p>';
        str += '<p>Code: ${txt1}</p>';
        str += '<p>Actions: <button type="button" class="btn btn-default btn-xs btn-sub-action"';
        str += 'title="add user to this organization"';
        str += 'data-code="${txt2}" data-type="orgs-add-user"><i class="fa fa-user"></i></button>';
        str += '<button type="button" class="btn btn-default btn-xs btn-sub-action" title="edit this organization"';
        str += 'data-code="${txt3}"><i class="fa fa-pencil"></i></button></p>';
        str += '</td>';
        str += '</tr';
        var temp = formatTxt(str, [org.name, org.code, org.code, org.code]);

        $('.chatbody table tbody').append(temp);
    }

    function insertRoom(room) {
        var str = "";
        str += '<tr>';
        str += '<td class="avatar"><img src="${txt0}" /></td>';
        str += '<td class="display-msg">';
        str += '<p>${txt1}</p>';
        str += '<p>Code: ${txt2}</p>';
        str += '<p>Actions: <button type="button" class="btn btn-default btn-xs btn-sub-action"';
        str += 'title="add user to this room"';
        str += 'data-code="${txt3}"><i class="fa fa-user"></i></button>';
        str += '<button type="button" class="btn btn-default btn-xs btn-sub-action" title="edit this room"';
        str += 'data-code="${txt4}"><i class="fa fa-pencil"></i></button></p>';
        str += '</td>';
        str += '</tr';
        var temp = formatTxt(str, [room.avatar, room.name, room.code, room.code, room.code]);

        $('.chatbody table tbody').append(temp);
    }

    function formatTxt(temp, txtArr) {
        for (var i in txtArr) {
            temp = temp.replace('${txt' + i + '}', txtArr[i]);
        }
        return temp;
    }

    function setOrgUsers() {
        data = {
            list: $('#fm-search-username').val(),
            org: $('#fm-search-org-code').val()
        };
        $.ajax({
            url: ajaxGetData.orgs.urlsetu,
            type: 'post',
            data: data,
            dataType: 'json',
            complete: function(xhr, status) {
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error to add users.');
                    $('#qr-alert').modal('show');
                }
                $('#qr-fm-search').modal('hide');
            },
            success: function(result, status, xhr) {
                if (result.success) {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
    }

    function setData(type) {
        var data = {};
        switch (type) {
            case 'users':
                data = {
                    username: $('#fm-user-username').val(),
                    name: $('#fm-user-name').val(),
                    role: $('#fm-user-role').val(),
                    avatar: $('#fm-user-avatar').val(),
                    email: $('#fm-user-email').val(),
                    password: $('#fm-user-password').val(),
                    password2: $('#fm-user-password2').val()
                };
                break;
            case 'orgs':
                data = {
                    code: $('#fm-org-code').val(),
                    name: $('#fm-org-name').val()
                };
                break;
            case 'rooms':
                data = {
                    code: $('#fm-room-code').val(),
                    name: $('#fm-room-name').val(),
                    org: $('#fm-room-org').val()
                };
                break;
        }
        $.ajax({
            url: ajaxGetData[type].urlset,
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
                $('#qr-modal-form').modal('hide');
            },
            success: function(result, status, xhr) {
                if (result.success) {
                    $('#qr-alert .modal-body').html(result.msg);
                    getData(type);
                    $('#qr-alert').modal('show');
                } else {
                    $('#qr-alert .modal-body').html(result.msg);
                    $('#qr-alert').modal('show');
                }
            }
        });
    }

    function getData(type) {
        $('.chatbody table tbody').html('');
        $.ajax({
            url: ajaxGetData[type].urlget,
            type: 'get',
            dataType: 'json',
            complete: function(xhr, status) {
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('.chatbody table tbody').html('Error loading data.');
                }
                setTimeout(hideLoading, 1000);
            },
            success: function(result, status, xhr) {
                if (!result.success) {
                    $('.chatbody table tbody').html(result.msg);
                    return;
                }
                if (result.data.length > 0) {
                    for (var i in result.data) {
                        ajaxGetData[type].handle(result.data[i]);
                    }
                    subActions();
                } else {
                    $('.chatbody table tbody').html('There are no data to show.');
                }
            }
        });
    }

    function getSelectOrg() {
        $.ajax({
            url: ajaxGetData.orgs.urlget,
            type: 'get',
            complete: function(xhr, status) {
                if (xhr.status == 403) {
                    location.href = '/';
                    return;
                }
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error getting Organization data.');
                    $('#qr-alert').modal('show');
                }
            },
            success: function(result, status, xhr) {
                if (!result.success) {
                    $('#fm-room-org').html('<option value="">' + result.msg + '</option>');
                    // $('.chatbody table tbody').html(result.msg);
                    return;
                }
                if (result.data.length > 0) {
                    var selectHtml = '';
                    for (var i in result.data) {
                        selectHtml += '<option value="' + result.data[i].code + '">' + result.data[i].name + '</option>';
                    }
                    $('#fm-room-org').html(selectHtml);
                } else {
                    $('#fm-room-org').html('<option value="">No data found</option>');
                }
            }
        });
    }

    //---------------autocomplete input----------------

    function split(val) {
        return val.split(/,\s*/);
    }

    function extractLast(term) {
        return split(term).pop();
    }

    $("#fm-search-username")
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
                    url: ajaxGetData.users.urlsearch,
                    data: {
                        term: extractLast(request.term),
                        org: $('#fm-search-org-code').val()
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