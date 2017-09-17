(function ($) {
    function hideBg() {
        $('.bg-waitting').css('display', 'none');
    }

    //after all is prepared, display the page
    setTimeout(hideBg, 2000);

    //logout of the app
    $('#do-logout').on('click', function () {
        $('#fm-logout').submit();
    });
})(jQuery)