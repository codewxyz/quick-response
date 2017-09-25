(function($) {
    var ajaxGetData = {
        users: {
            urlget: '/admin/get/users',
            urlset: '/admin/set/user',
            handle: (user) => { insertUser(user) }
        },
        orgs: {
            urlget: '/admin/get/orgs',
            urlset: '/admin/set/org',
            handle: (user) => { insertOrg(user) }
        },
        rooms: {
            urlget: '/admin/get/rooms',
            urlset: '/admin/set/room',
            handle: (user) => { insertRoom(user) }
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

    function getSelectOrg() {
        $.ajax({
            url: ajaxGetData.orgs.urlget,
            type: 'get',
            complete: function(xhr, status) {
                console.log(xhr);
                console.log(status);
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error getting Organization data.');
                    $('#qr-alert').modal('show');
                }
            },
            success: function(result, status, xhr) {
                console.log(status);
                console.log(xhr);
                if (result != undefined && result.length > 0) {
                    var selectHtml = '';
                    for (var i in result) {
                        selectHtml += '<option value="' + result[i].code + '">' + result[i].name + '</option>';
                    }
                    $('#fm-room-org').html(selectHtml);
                } else {
                    $('#fm-room-org').html('<option value="">No data found</option>');
                }
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
        var temp = '<tr> \
                    <td class="avatar"><img src="' + user.avatar + '" /></td> \
                    <td class="display-msg"> \
                    <p>' + user.username + '</p> \
                    <p>Role: ' + user.role + '</p> \
                    </td> \
                    </tr>';
        $('.chatbody table tbody').append(temp);
    }

    function insertOrg(org) {
        var temp = '<tr> \
                    <td class="avatar"><img src="./images/logo.png" /></td> \
                    <td class="display-msg"> \
                    <p>' + org.name + 
                    '<button type="button" class="btn btn-default btn-xs btn-sub-action" title="add user to this organization" \
                    data-orgcode="'+org.code+'"><i class="fa fa-user"></i></button> \
                    <button type="button" class="btn btn-default btn-xs btn-sub-action" title="edit this organization" \
                    data-orgcode="'+org.code+'"><i class="fa fa-pencil"></i></button></p> \
                    <p>Code: ' + org.code + '</p> \
                    </td> \
                    </tr>';
        $('.chatbody table tbody').append(temp);
    }

    function insertRoom(room) {
        var temp = '<tr> \
                    <td class="avatar"><img src="' + room.avatar + '" /></td> \
                    <td class="display-msg"> \
                    <p>' + room.name + '</p> \
                    <p>Code: ' + room.code + '</p> \
                    </td> \
                    </tr>';
        $('.chatbody table tbody').append(temp);
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
            complete: function(xhr, status) {
                console.log(xhr);
                console.log(status);
                if (status == 'error') {
                    $('#qr-alert .modal-body').html('Error creating data.');
                    $('#qr-alert').modal('show');
                }
                $('#qr-modal-form').modal('hide');
            },
            success: function(result, status, xhr) {
                console.log(status);
                console.log(xhr);
                if (result != undefined && result.success) {
                    $('#qr-alert .modal-body').html('Created successfully.');
                    getData(type);
                    $('#qr-alert').modal('show');
                } else {
                    $('#qr-alert .modal-body').html('Cannot create data.');
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
            complete: function(xhr, status) {
                console.log(xhr);
                console.log(status);
                if (status == 'error') {
                    $('.chatbody table tbody').html('Error loading data.');
                }
                setTimeout(hideLoading, 1000);
            },
            success: function(result, status, xhr) {
                console.log(status);
                console.log(xhr);
                if (result != undefined && result.length > 0) {
                    for (var i in result) {
                        ajaxGetData[type]['handle'](result[i]);
                    }
                } else {
                    $('.chatbody table tbody').html('There are no data to show.');
                }
            }
        });
    }

})(jQuery)