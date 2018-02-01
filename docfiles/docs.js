function handleEnterKey(e) {
    var charCode = (typeof e.which == "number") ? e.which : e.keyCode
    if (charCode === 13 || charCode === 32) { // Enter or Space key
        e.preventDefault();
        e.currentTarget.click();
    }
}
function describePlural(value, unit) {
    return value + " " + unit + (value == 1 ? "" : "s")
}
function describetime(now, other) {
    var seconds = now - other
    if (isNaN(seconds)) return ""
    var timeString
    if (seconds < 0)
        return "now"
    else if (seconds < 10)
        return "a few seconds ago"
    else if (seconds < 60)
        return " " + describePlural(Math.floor(seconds), "second") + " ago"
    else if (seconds < 2 * 60)
        return "a minute ago"
    else if (seconds < 60 * 60)
        return " " + describePlural(Math.floor(seconds / 60), "minute") + " ago"
    else if (seconds < 2 * 60 * 60)
        return "an hour ago";
    else if (seconds < 60 * 60 * 24)
        return " " + describePlural(Math.floor(seconds / 60 / 60), "hour") + " ago"
    else if (seconds < 60 * 60 * 24 * 30)
        return " " + describePlural(Math.floor(seconds / 60 / 60 / 24), "day") + " ago"
    else if (seconds < 60 * 60 * 24 * 365)
        return " " + describePlural(Math.floor(seconds / 60 / 60 / 24 / 30), "month") + " ago"
    else
        return " " + describePlural(Math.floor(seconds / 60 / 60 / 24 / 365), "year") + " ago"
}
function isIE() {
    return /trident/i.test(navigator.userAgent);
}

function dirAuto($el) {
    if ($el) {
        if (!isIE())
            $el.attr('dir', 'auto');
        else {
            var dir = /^[\s\.;:(+0-9]*[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/i.test($el.text()) ? "rtl" : "ltr";
            $el.attr('dir', dir);
        }
    }
    return $el;
}

function searchSubmit(form) {
    if (pxt && pxt.tickEvent) pxt.tickEvent("docs.search", { 'source': form.id }, { interactiveConsent: true })
}

function setupSidebar() {
    $('#togglesidebar').on('keydown', handleEnterKey);

    $('.ui.sidebar')
        .sidebar({
            dimPage: false,
            onShow: function () {
                togglesidebar.setAttribute("aria-expanded", "true");
                document.getElementsByClassName("sidebar").item(0).getElementsByClassName("focused").item(0).focus();
            },
            onHidden: function () {
                togglesidebar.setAttribute("aria-expanded", "false");
            }
        })
        .sidebar(
        'attach events', '#togglesidebar'
        );

    $('.ui.dropdown')
        .dropdown();

    $('.ui.accordion')
        .accordion({
            closeNested: true,
            selector: {
                trigger: '.title .icon'
            }
        });

    var accordions = document.getElementsByClassName("ui accordion");
    for (var i = 0; i < accordions.length; i++) {
        var nodes = accordions.item(i).getElementsByClassName("title");
        for (var j = 0; j < nodes.length; j++) {
            var hrefNode = nodes.item(j).getElementsByTagName("a").item(0);
            var iNode = nodes.item(j).getElementsByTagName("i").item(0);
            iNode.onclick = function (e) {
                if (hrefNode.hasAttribute("aria-expanded") && hrefNode.getAttribute("aria-expanded") === "true") {
                    hrefNode.setAttribute("aria-expanded", "false");
                } else {
                    hrefNode.setAttribute("aria-expanded", "true");
                }
            };
            hrefNode.onkeydown = function (e) {
                var charCode = (typeof e.which == "number") ? e.which : e.keyCode
                if (charCode === 39) { // Right key
                    $(e.target.parentElement.parentElement).accordion("open", 0);
                    e.target.setAttribute("aria-expanded", "true");
                } else if (charCode === 37) { // Left key
                    $(e.target.parentElement.parentElement).accordion("close", 0);
                    e.target.setAttribute("aria-expanded", "false");
                }
            };
        }
    }

    var searchIcons = document.getElementsByClassName("search link icon");
    for (var i = 0; i < searchIcons.length; i++) {
        searchIcons.item(i).onkeydown = handleEnterKey;
    }
}

function setupSemantic() {
    // don't show related videos
    $.fn.embed.settings.sources.youtube.url = '//www.youtube.com/embed/{id}?rel=0'

    //This is an adapted version of the original template code in Semantic UI
    $.fn.embed.settings.templates.placeholder = function (image, icon) {
        var html = '';
        if (icon) {
            html += '<i class="' + icon + ' icon"></i>';
        }
        if (image) {
            //Remove the timestamp from the YouTube source URL
            image = image.replace(/\#t=([0-9]+m)?([0-9]+s)?/, "");
            html += '<img class="placeholder" src="' + image + '">';
        }
        return html;
    };
    //Again, this is a slightly modified version of the original Semantic UI source to support timestamped YouTube videos
    $.fn.embed.settings.templates.iframe = function (url, parameters) {
        var src = url;
        //The following if statement is all that is different from the original implementation
        var matches = src.match(/\#t=(([0-9]+)m)?(([0-9]+)s)?/);
        if (matches) {
            var minutes = matches[2] != undefined ? parseInt(matches[2]) : 0;
            var seconds = matches[4] != undefined ? parseInt(matches[4]) : 0;
            var param = "start=" + (minutes * 60 + seconds).toString();
            if (parameters) {
                parameters = param + "&" + parameters;
            }
            else {
                parameters = param;
            }
            src = src.replace(/\#t=([0-9]+m)?([0-9]+s)?/, "");
        }
        if (parameters) {
            src += (/\?/.test(url) ? '&' : '?') + parameters;
        }
        return ''
            + '<iframe src="' + src + '"'
            + ' width="100%" height="100%"'
            + ' frameborder="0" scrolling="no" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>'
            ;
    };

    $('.ui.embed').embed();

    $('.md-video-link').on("click", function () {
        var name = $(this).data("playerurl") || $(this).data("videosrc");
        $(this).find("img").remove();
        $(this).find("svg").remove();
        var outer = $('<div />', {
            "class": 'embed-responsive embed-responsive-16by9'
        });
        outer.appendTo($(this));
        $('<iframe>', {
            class: 'embed-responsive-item',
            src: name,
            frameborder: 0,
            scrolling: 'no'
        }).appendTo(outer);
    });

    $('#printbtn').on("click", function () {
        window.print();
    })

    if (/browsers$/i.test(window.location.href))
        $('.ui.footer').append($('<div class="ui center aligned small container"/>').text('user agent: ' + navigator.userAgent))
}

function setupBlocklyAsync() {
    let promise = Promise.resolve();
    if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.extendEditor) {
        let opts = {};
        promise = promise.then(function () {
                return pxt.BrowserUtils.loadScriptAsync(pxt.webConfig.commitCdnUrl + "editor.js")
            }).then(function () {
                return pxt.editor.initExtensionsAsync(opts)
            }).then(function (res) {
                if (res.fieldEditors)
                    res.fieldEditors.forEach(function (fi) {
                        pxt.blocks.registerFieldEditor(fi.selector, fi.editor, fi.validator);
                    })
            })
    }
    return promise;
}

function renderSnippets() {
    var codeElems = $('code')
    for (var i = 0; i < codeElems.length; i++) {
        codeElems[i].className = codeElems[i].className.replace('-ignore', '')
    }

    var downloadScreenshots = /screenshots=1/i.test(window.location.href);
    var path = window.location.href.split('/').pop().split(/[?#]/)[0];
    ksRunnerReady(function () {
        setupSidebar();
        setupSemantic();
        setupBlocklyAsync()
        .then(function () {
            return pxt.runner.renderAsync({
                snippetClass: 'lang-blocks',
                signatureClass: 'lang-sig',
                blocksClass: 'lang-block',
                shuffleClass: 'lang-shuffle',
                simulatorClass: 'lang-sim',
                linksClass: 'lang-cards',
                namespacesClass: 'lang-namespaces',
                codeCardClass: 'lang-codecard',
                packageClass: 'lang-package',
                projectClass: 'lang-project',
                snippetReplaceParent: true,
                simulator: true,
                hex: true,
                hexName: path,
                downloadScreenshots: downloadScreenshots
            });
        }).done();
    });
}

$(document).ready(function () {
    renderSnippets();
});
