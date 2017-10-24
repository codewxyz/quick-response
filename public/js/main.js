(function ($) {
	responsiveSupport();

	$('.chatbody').tooltip({
		container: 'body',
		selector: '.display-msg-header-time'
	});
	//multi task
	$('.page-multi-task-close').on('click', function (event) {
		var deviceHeight = $(window).height();
		$('.page-multi-task').fadeToggle(500);
		$('.page-multi-task').css('height', deviceHeight/2);
		$('.page-multi-task iframe').css('height', deviceHeight/2-34);
	});
	$('.page-multi-task-full').on('click', function (event) {
		var deviceHeight = $(window).height();
		if (parseInt($('.page-multi-task').css('height')) == Math.ceil(deviceHeight/2)) {
			$('.page-multi-task').css('height', deviceHeight);
			$('.page-multi-task iframe').css('height', deviceHeight-34);
		} else {
			$('.page-multi-task').css('height', deviceHeight/2);
			$('.page-multi-task iframe').css('height', deviceHeight/2-34);
		}
	});

	//add shortcut keyboard for more features
	$('body').on('keydown', function (event) {
		//press F1
		//lock screen
		if (event.keyCode == 115) {
			$('.page-multi-task').fadeToggle(500);
		}

		//press F2
		//auto focus message input
		if (event.keyCode == 113) {
			$('.input-chat-msg').focus();
		}
	});

	//recalculate chat content height
	$(window).on('resize', function () {
		responsiveSupport();
	});

    //after all is prepared, display the page
    setTimeout(hideBg, 2000);

    function hideBg() {
        $('.bg-waitting').css('display', 'none');
        $('#page-main').css('invisibility', 'invisible');

		//load first iframe
		// $('.page-multi-task iframe').attr('src', 'http://mazii.net/');
    }

    function responsiveSupport(argument) {
    	
		var headerHeight = $('.navbar-header').parents().find('.row').height();
		var deviceHeight = $(window).height();
		var deviceWidth = $(window).width();

		//20px margin bottom of message input
		var mainContentHeight = deviceHeight-headerHeight-20;
		//70px message input + 20px margin top input 
		var chatBodyHeight = mainContentHeight-70-20;
		//mobile device support
		//chat room show/hide
		if (deviceWidth < 768) {
			$('#collapse-chat-room-list-btn').removeClass('hidden');
			$('#collapse-chat-room-list').removeClass('in');
			//40px room list action buttons
			chatBodyHeight -= 40;
		} else {
			$('#collapse-chat-room-list-btn').addClass('hidden');
			$('#collapse-chat-room-list').addClass('in');
			$('#collapse-chat-room-list').css('height', mainContentHeight-40);
		}
		//70px nav  + 20px margin
		//20px margin after chatbody
		//40px chat room button list
		$('.chatbody').css('height', chatBodyHeight);

		$('.page-multi-task').css('height', deviceHeight/2);
		$('.page-multi-task iframe').css('height', deviceHeight/2-34);

		$('.chatbody').trigger('qrsheightchange', [chatBodyHeight]);

    }
    //logout of the app
    $('#do-logout').on('click', function () {
        $('#fm-logout').submit();
    });
})(jQuery);