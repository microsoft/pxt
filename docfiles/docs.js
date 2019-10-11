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

function scrollActiveHeaderIntoView() {
    var activeHeaders = document.getElementsByClassName("header active");
    for (var i = 0; i < activeHeaders.length; ++i) {
        var activeHeader = activeHeaders.item(i);
        if (activeHeader.scrollIntoView)
            activeHeader.scrollIntoView()
    }
}

function setupSidebar() {
    // do not use pxt.appTarget in this function
    $('#togglesidebar').on('keydown', handleEnterKey);
    $('.ui.sidebar')
        .sidebar({
            dimPage: false,
            onShow: function () {
                togglesidebar.setAttribute("aria-expanded", "true");
                $(".sidebar .focused").focus();
                scrollActiveHeaderIntoView();
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
                trigger: '> .title'
            }
        });

    var accordions = document.getElementsByClassName("ui accordion");
    for (var i = 0; i < accordions.length; i++) {
        var nodes = accordions.item(i).getElementsByClassName("title");
        for (var j = 0; j < nodes.length; j++) {
            var menuItem = nodes.item(j);
            var hrefNode = menuItem.getElementsByTagName("a").item(0);
            var iNode = menuItem.getElementsByTagName("i").item(0);
            iNode.onclick = function (e) {
                if (hrefNode.hasAttribute("aria-expanded") && hrefNode.getAttribute("aria-expanded") === "true") {
                    hrefNode.setAttribute("aria-expanded", "false");
                } else {
                    hrefNode.setAttribute("aria-expanded", "true");
                }
            };
            if (!hrefNode) {
                hrefNode = menuItem;
                menuItem.setAttribute("tabindex", "0");
            }
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

    scrollActiveHeaderIntoView();
}

function setupSemantic() {
    // do not use pxt.appTarget in this function
    // don't show related videos
    $.fn.embed.settings.sources.youtube.url = '//www.youtube.com/embed/{id}?rel=0'

    //This is an adapted version of the original template code in Semantic UI
    $.fn.embed.settings.templates.placeholder = function (image, icon) {
        var html = '';
        if (icon) {
            html += '<i class="' + icon.replace(/[^\w ]*/g, '') + ' icon"></i>';
        }
        if (image) {
            //Remove the timestamp from the YouTube source URL
            image = image.replace(/\#t=([0-9]+m)?([0-9]+s)?/, "");

            html += `<div class="placeholder" style="
    background-image: url(${encodeURI(image)});
    background-size: cover;
    background-position: 50% 50%;
    width: 100%;
    height: 100%;
    position: absolute;
    top:  0;
    left:  0;
"></div>`
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
            + '<iframe src="' + encodeURI(src) + '"'
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

    $('#translatebtn').on("click", function () {
        window.location.href = window.location.href.replace(/#.*/, '') + (window.location.href.indexOf('?') > -1 ? "&" : "?") + "translate=1"
    })

    if (/browsers$/i.test(window.location.href))
        $('.ui.footer').append($('<div class="ui center aligned small container"/>').text('user agent: ' + navigator.userAgent))
}

function setupBlocklyAsync() {
    var promise = Promise.resolve();
    if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.extendFieldEditors) {
        var opts = {};
        promise = promise.then(function () {
            return pxt.BrowserUtils.loadScriptAsync("fieldeditors.js")
        }).then(function () {
            return pxt.editor.initFieldExtensionsAsync(opts)
        }).then(function (res) {
            if (res.fieldEditors)
                res.fieldEditors.forEach(function (fi) {
                    pxt.blocks.registerFieldEditor(fi.selector, fi.editor, fi.validator);
                })
        })
    }

    // backward compatibility: load editor
    if (pxt.appTarget.versions &&
        pxt.semver.strcmp(pxt.appTarget.versions.pxt, "3.9.0") < 0 &&
        pxt.appTarget.appTheme && pxt.appTarget.appTheme.extendEditor) {
        var opts = {};
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
    setupLangPicker();
    return promise;
}

function renderSnippets() {
    if (typeof ksRunnerReady === "undefined") return; // probably in pxt docs

    var path = window.location.href.split('/').pop().split(/[?#]/)[0];
    ksRunnerReady(function () {
        setupBlocklyAsync()
            .then(function () {
                return pxt.runner.renderAsync({
                    snippetClass: 'lang-blocks',
                    signatureClass: 'lang-sig',
                    blocksClass: 'lang-block',
                    staticPythonClass: 'lang-spy',
                    shuffleClass: 'lang-shuffle',
                    simulatorClass: 'lang-sim',
                    linksClass: 'lang-cards',
                    namespacesClass: 'lang-namespaces',
                    codeCardClass: 'lang-codecard',
                    packageClass: 'lang-package',
                    projectClass: 'lang-project',
                    snippetReplaceParent: true,
                    simulator: true,
                    showEdit: true,
                    hex: true,
                    hexName: path
                });
            }).done();
    });
}

function getCookieLang() {
    const cookiePropRegex = new RegExp(pxt.Util.escapeForRegex(pxt.Util.pxtLangCookieId)+ "=(.*?)(?:;|$)")
    const cookieValue = cookiePropRegex.exec(document.cookie);
    return cookieValue && cookieValue[1] || null;
}

function setCookieLang(langId) {
    if (!pxt.Util.allLanguages[langId]) {
        return;
    }
    if (langId !== getCookieLang()) {
        pxt.tickEvent("menu.lang.setcookielang." + langId);
        const expiration = new Date();
        expiration.setTime(expiration.getTime() + (pxt.Util.langCookieExpirationDays * 24 * 60 * 60 * 1000));
        document.cookie = pxt.Util.pxtLangCookieId + "=" + langId + ";expires=" + expiration.toUTCString();
    }
}

function languageOption(code) {
    var locale = pxt.Util.allLanguages[code];

    var headerEl = document.createElement('div');
    headerEl.className = 'header';
    headerEl.textContent = locale.localizedName;

    var descriptionEl = document.createElement('div');
    descriptionEl.className = 'description tall';
    descriptionEl.textContent = locale.englishName;

    var contentEl = document.createElement('div');
    contentEl.className = 'content';
    contentEl.appendChild(headerEl);
    contentEl.appendChild(descriptionEl);

    var cardEl = document.createElement('div');
    cardEl.className = 'ui card link card-selected langoption';
    cardEl.dataset.lang = code;
    cardEl.setAttribute('role', 'link');
    cardEl.setAttribute('aria-label', locale.englishName);
    cardEl.setAttribute('tabindex', '0');
    cardEl.appendChild(contentEl);

    return cardEl;
}

function setupLangPicker() {
    var appTheme = pxt.appTarget.appTheme
    var initialLang = pxt.Util.normalizeLanguageCode(getCookieLang())[0];

    if (appTheme.availableLocales && appTheme.selectLanguage) {
        var localesContainer = document.querySelector("#availablelocales");
        var locales = appTheme.availableLocales.map(function(e) { return languageOption(e) });
        locales.forEach(function(card) { localesContainer.appendChild(card) });

        var langPicker = document.querySelector("#langpicker");
        langPicker.onclick = function() {
            $('.ui.modal.lang').modal('show');
        }
        langPicker.onkeydown = handleEnterKey;

        var closeIcon = document.querySelector(".closeIcon");
        closeIcon.onclick = function() {
            $('.ui.modal.lang').modal('hide');
        }
        closeIcon.onkeydown = handleEnterKey;

        var langOptions = document.querySelectorAll(".langoption");

        for (var i = 0; i < langOptions.length; i++) {
            var currentOption = langOptions[i];
            currentOption.onclick =  function(e) {
                var langId = e.currentTarget.dataset.lang;
                if (!pxt.Util.allLanguages[langId]) {
                    return;
                }
                setCookieLang(langId);
                if (langId !== initialLang) {
                    pxt.tickEvent("menu.lang.changelang." + langId);
                    // In react app before reload we are using pxt.winrt.releaseAllDevicesAsync()
                    // In docs we currently don't have access to pxt.winrt
                    location.reload();
                } else {
                    pxt.tickEvent("menu.lang.samelang." + langId);
                    $('.ui.modal').modal('hide');
                }
            }
            currentOption.onkeydown = handleEnterKey;
        }
    } else {
        // TODO: Handle language when there is no availableLocales (makecode.com/docs)
        // For now just removing the button as it wouldn't do anything / feels broken
        $('#langpicker').remove();
    }
}

$(document).ready(function () {
    setupSidebar();
    setupSemantic();
    renderSnippets();
});