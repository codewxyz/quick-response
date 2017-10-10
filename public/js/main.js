(function ($) {
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