
$(document).ready(function () {
    $(window).bind('scroll', function () {
        if ($(window).scrollTop() > 50) {
            $('#root').addClass('fix-top');
        } else {
            $('#root').removeClass('fix-top');
        }
    });
    $('a.launch.icon').click(function () {
        $('#makecode-sidebar')
            .sidebar('toggle')
            .sidebar('show', function () {
                $('#sidenav-about').focus();
            })
            ;
    })

    // Limit sidebar navigation to the list of menu elements
    $('#sidenav-about').keydown(function (e) {
        var charCode = (typeof e.which == "number") ? e.which : e.keyCode
        if (charCode == 9 && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
        }
    })
    $('#sidenav-contact').keydown(function (e) {
        var charCode = (typeof e.which == "number") ? e.which : e.keyCode
        if (charCode == 9 && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
        }
    })
    // Enable telemetry
    var ai = window.appInsights;
    tickEvent = function (id, data) {
        if (!ai) return;
        if (!data) ai.trackEvent(id);
        else {
            var props = {};
            var measures = {};
            for (const k in data)
                if (typeof data[k] == "string") props[k] = data[k];
                else measures[k] = data[k];
            ai.trackEvent(id, props, measures);
        }
    }
});

var fireClickOnEnter = function (e) {
    var charCode = (typeof e.which == "number") ? e.which : e.keyCode
    if (charCode === 13 || charCode === 32) { // Enter or Space key
        e.preventDefault();
        e.currentTarget.click();
    }
}