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
    // do not use pxt.appTarget in this function
    var tocMenu = document.querySelectorAll('#docsMobile div.ui.list.menuContainer.toc > div.item');
    var tocMenuArray = Array.prototype.slice.call(tocMenu)
    tocMenuArray.forEach(function(item) {
        // Sets each TOC parent item an accordion behaviour to match style
        item.className = 'ui accordion item visible';
        item.setAttribute('role','tree');
        var icon = item.firstElementChild;
        icon.className = 'dropdown icon chevron right';
        var anchor = icon.nextElementSibling;
        anchor.setAttribute('role','treeitem');
        anchor.setAttribute('aria-expanded', 'false');
        var menu = anchor.nextElementSibling;
        menu.className = 'content';
        var menuChildren = Array.prototype.slice.call(menu.children)
        menuChildren.forEach(function(el) {
            if (el.tagName == 'DIV'){
                el.setAttribute('role','');
                el.className = 'accordion item visible';
            }
        });
        var wrapper = document.createElement('div');
        wrapper.className = 'title';
        wrapper.appendChild(icon);
        wrapper.appendChild(anchor);
        item.insertBefore(wrapper, menu);
    });
    // Sets the SemanticUI sidebar behavior
    $('#togglesidebar').on('keydown', handleEnterKey);
    $('.ui.sidebar')
        .sidebar({
            dimPage: true,
            onShow: function () {
                // add proper responsive behaviour and animations on Show
                togglesidebar.setAttribute("aria-expanded", "true");
                document.querySelector('#togglesidebar > i').classList.remove('content');
                document.querySelector('#togglesidebar > i').classList.add('close');
                document.querySelector("#docs .ui.grid.mainbody").classList.remove('full-width');
                document.querySelector("#docs .ui.grid.mainbody").classList.add('content-width');
                // For mobile if user is at bottom scroll to top
                if (window.innerWidth < 970) {
                   document.body.scrollTop = 0;
                   if (window.navigator.userAgent.indexOf('Edge') !== -1) {
                        document.querySelector('#docs').scrollIntoView();
                    }
                }
            },
            onHidden: function () {
                // add proper responsive behaviour and animations on Hidden
                togglesidebar.setAttribute("aria-expanded", "false");
                document.querySelector('#togglesidebar > i').classList.remove('close');
                document.querySelector('#togglesidebar > i').classList.add('content');
                document.querySelector("#docs .ui.grid.mainbody").classList.remove('content-width');
                document.querySelector("#docs .ui.grid.mainbody").classList.add('full-width'); 
            },
            onVisible: function () {
                // add proper responsive behavior for Desktops and cancels it for mobile
                if (window.innerWidth > 970) { 
                     document.querySelector('.sticky-list') !== null ? document.querySelector('.sticky-list').style.display = 'none' : false;
                }
            },
            onHide: function () {
                // add proper responsive behavior for Desktops and cancels it for mobile
                if (window.innerWidth > 970) { 
                    document.querySelector('.sticky-list') !== null ? document.querySelector('.sticky-list').style.display = 'block' : false;
                }
            },
            context: $('#maincontent'),
            transition: 'push',
            mobileTransition: 'push'
        })
        .sidebar(
            'attach events', '#togglesidebar'
        )

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

    // Events for Search
    var searchIcons = document.getElementsByClassName("search link icon");
    for (var i = 0; i < searchIcons.length; i++) {
        searchIcons.item(i).onkeydown = handleEnterKey;
    }

}

function setupSemantic() {
    // do not use pxt.appTarget in this function
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
    if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.extendFieldEditors) {
        let opts = {};
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

    // sets menu for docs global navigation
    if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.docMenu && pxt.appTarget.appTheme.docMenu.length !== 0) {
        setupMenu(pxt.appTarget.appTheme.docMenu);
    }

    return promise;
}

function renderSnippets() {
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

function setElementsVisibility() {
    // handles if certain elements (breadcrumbs, print button, 
    // quick jump list) should be visible or not depending on content.
    var breadcrumb = document.querySelector('#breadcrumb-container');
    var printBtn = document.querySelector('#printbtn');
    var stickyColumn = document.querySelector('#sticky-column');

    if (document.querySelector(".ui.hero") !== null){
        printBtn.style.display = 'none';
    }
    if (breadcrumb.children.length === 0){
        breadcrumb.style.display = 'none';
    }
    
    setStickyColumn();
    
    if (stickyColumn.children.length === 0){
        stickyColumn.style.display = 'none';
        var classString = document.querySelector('#content-column').className;
        document.querySelector('#content-column').className = classString.replace('ten', 'fourteen');
    } else {
        stickyColumn.style.display = 'block';
        var classString = document.querySelector('#content-column').className;
        document.querySelector('#content-column').className = classString.replace('fourteen', 'ten');
    }
    if (stickyColumn.children.length !== 0 && document.querySelector(".ui.hero") !== null) {
        stickyColumn.firstElementChild.style.top = '21rem';
    }
}

function setDocumentationMode(type) {
    // handles if the content should have a 100% width or has a sidebar present
    if (type === 0){
        document.querySelector('div.main.ui.grid.fluid.mainbody').classList.remove('content-width');
        document.querySelector('div.main.ui.grid.fluid.mainbody').classList.add('full-width');
    } else {
        document.querySelector('div.main.ui.grid.fluid.mainbody').classList.remove('full-width');
        document.querySelector('div.main.ui.grid.fluid.mainbody').classList.add('content-width');
    }
}

function setupMenu(menu) {   
    // creates the global menu based on the app.Target.appTheme.docMenu array
    // appends new elements to header menu
    var docsMenu = document.querySelector('#docs-type');
    menu.forEach(function(item) {
        var menuItem = document.createElement('a');
        menuItem.rel = 'noopener';
        menuItem.target = '_self';
        menuItem.className = 'item';
        menuItem.href = item.path;
        menuItem.textContent = item.name;
        docsMenu.appendChild(menuItem);
    });
    // appends new elements to the footer navigation menu
    var docnav = document.querySelector('.docnav');
    menu.forEach(function(item) {
        var menuItem = document.createElement('a');
        menuItem.rel = 'noopener';
        menuItem.target = '_self';
        menuItem.className = 'item';
        menuItem.href = item.path;
        menuItem.textContent = item.name;
        docnav.appendChild(menuItem);
    });
    // appends new elements to the mobile global menu
    var mobileMenu = document.querySelector('#docsMobile .activities');
    menu.forEach(function(item) {
        var menuItem = document.createElement('a');
        menuItem.rel = 'noopener';
        menuItem.target = '_self';
        menuItem.className = 'item';
        menuItem.href = item.path;
        menuItem.textContent = item.name;
        mobileMenu.appendChild(menuItem);
    });

    // handles the click behavior of the mobile searchbox
    var mobileSearchBox = document.querySelector('#tocsearch2');
    mobileSearchBox.click = function (e) { e.stopPropagation(); }
    mobileSearchBox.onscroll = function (e) { e.stopPropagation(); }
    var mobileSearchBtn= document.querySelector('#mobile-search-icon');
    mobileSearchBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.className !== 'mobile-only-close') {
            e.currentTarget.className = 'mobile-only-close';
            document.querySelector('#mobile-search-close').className = 'mobile-only-open';
            var searchBox = document.querySelector('#tocsearch2');
            searchBox.style.visibility = 'visible';
            searchBox.style.opacity = '1';
            document.querySelector('#sticky-btn').style.zIndex = 0;
            document.querySelector('.sticky-list').style.display = 'none';
        }  
    }
    // handles the close search button in mobile
    var closeMobileSearch= document.querySelector('#mobile-search-close');
    closeMobileSearch.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.className === 'mobile-only-open') {
            e.currentTarget.className = 'mobile-only-close';
            document.querySelector('#mobile-search-icon').className = 'mobile-only-open';
            var searchBox = document.querySelector('#tocsearch2');
            searchBox.style.visibility = 'hidden';
            searchBox.style.opacity = '0';
            document.querySelector('#sticky-btn').style.zIndex = 100;
        }
    }
}

function responsiveHideElements() {
    // Add Responsive Adjustments depending on screen size 
    window.addEventListener('resize', function() {
        // manages responsive behavior that media queries cannot
        responsiveElements();
    });
    // run the function at loading to get proper rendering in mobile, tablet or desktop
    responsiveElements();
}

function responsiveElements() {
    // Desktop default (loading) state
    if (window.innerWidth > 970){
        document.querySelector('#printbtn') !== null && document.querySelector(".ui.hero") === null ? document.querySelector('#printbtn').style.display = 'block' : false;
        document.querySelector('#tocsearch2').style.display = 'none';
        document.querySelector('.sticky-close') !== null ? document.querySelector('.sticky-close').style.display = 'none' : false;
        document.querySelector('#sticky-btn').style.zIndex = 0;
        document.querySelector('.sticky-list') !== null ? document.querySelector('.sticky-list').style.display = 'block' : false;
        document.querySelector('.article-inner').insertBefore(document.querySelector('#breadcrumb-container'), this.document.querySelector('.mainbody'));  
    }
    // Mobile default (loading) state
    if (window.innerWidth < 970){
        document.querySelector('#printbtn') !== null && document.querySelector(".ui.hero") !== null ? document.querySelector('#printbtn').style.display = 'none' : false;
        document.querySelector('#tocsearch2').style.display = 'block';
        document.querySelector('#mobile-search-icon').className = 'mobile-only-open';
        document.querySelector('#mobile-search-close').className = 'mobile-only-close';
        document.querySelector('#sticky-btn').style.zIndex = 100;
        document.querySelector('.sticky-list') !== null ? document.querySelector('.sticky-list').style.display = 'none' : false;
        document.querySelector('#root').insertBefore(document.querySelector('#breadcrumb-container'),document.querySelector('#docs-header'));
    }
}

// Handles the behavior of the quick jump sticky list in content
function setStickyColumn() {
        // it takes only h2 headings from markdown to make the list
        var headings = document.querySelectorAll('.ui.text > h2');
        if (headings.length > 2) {
        var stickyColumn = document.querySelector('#sticky-column');
        var linkList = document.createElement('ul');
        var title = document.createElement('h3');
        title.textContent = "Content";
        title.className = 'title';
        linkList.appendChild(title);
        var headingsArray = Array.prototype.slice.call(headings)
        headingsArray.forEach(function(heading) {
            var item = document.createElement('a');
            item.textContent = heading.textContent;
            item.onclick = function(e) {
                e.preventDefault();
                $("html, body").stop().animate({
                    scrollTop: $(heading).offset().top
                }, 1000);
                if (window.navigator.userAgent.indexOf('Edge') !== -1) {
                    heading.scrollIntoView();
                }
                // resets default style for mobile behavior
                if (window.innerWidth < 970) {
                document.querySelector('#sticky-btn').style.zIndex = 100;
                document.querySelector('.sticky-list').style.display = 'none';
                }
            }
            linkList.appendChild(item);
        });
        var wrapper = document.createElement('div');
        wrapper.className = 'sticky-list';
        // mobile sticky close button
        var closeBtn = document.createElement('button');
        var closeBtnIcon = document.createElement('i');
        closeBtnIcon.className = 'icon close';
        closeBtn.appendChild(closeBtnIcon);
        closeBtn.style.display = 'none';
        closeBtn.className = 'sticky-close';
        closeBtn.onclick = function () {
            // resets default style for mobile behavior
            document.querySelector('#sticky-btn').style.zIndex = 100;
            document.querySelector('.sticky-list').style.display = 'none';
        }
        wrapper.appendChild(closeBtn);
        wrapper.appendChild(linkList);
        var div = document.createElement('div');
        stickyColumn.appendChild(div);
        document.querySelector('#root').appendChild(wrapper);

        // click event for sticky close button (mobile)
        var stickyBtn = document.querySelector('#sticky-btn');
        stickyBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.style.zIndex = 0;
            var stickyList = document.querySelector('.sticky-list');
            var stickyCloseBtn = document.querySelector('.sticky-close');
            if (stickyList !== null && stickyCloseBtn !== null) {
            stickyList.style.display = 'block';
            stickyCloseBtn.style.display = 'block';
            }
        }
    } else {
        //For mobile disable ellipsis button
        document.querySelector('#sticky-btn').setAttribute('disabled', true);
    }
        
}

$(document).ready(function () {
    setupSidebar();
    setupSemantic();
    renderSnippets();
    setElementsVisibility();
    responsiveHideElements();
});