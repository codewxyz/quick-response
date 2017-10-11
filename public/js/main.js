(function ($) {

    //after all is prepared, display the page
    setTimeout(hideBg, 2000);

    function hideBg() {
        $('.bg-waitting').css('display', 'none');
    }
    //logout of the app
    $('#do-logout').on('click', function () {
        $('#fm-logout').submit();
    });
})(jQuery)