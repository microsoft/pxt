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

function renderSnippets() {
    var codeElems = $('code')
    for (var i = 0; i < codeElems.length; i++) {
        codeElems[i].className = codeElems[i].className.replace('-ignore', '')
    }

    var path = window.location.href.split('/').pop().split(/[?#]/)[0];
    ksRunnerReady(function() {        
        pxt.runner.renderAsync({ 
            snippetClass: 'lang-blocks',
            signatureClass: 'lang-sig',
            blocksClass:'lang-block',
            shuffleClass: 'lang-shuffle',
            simulatorClass: 'lang-sim',
            linksClass: 'lang-cards',     
            namespacesClass: 'lang-namespaces',       
            codeCardClass: 'lang-codecard',
            packageClass: 'lang-package',
            snippetReplaceParent: true,
            simulator: true,
            hex: true,
            hexName: path
        }).done();
    });    
}
