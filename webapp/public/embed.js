(function() {
    if (window.ksRunnerInit) return;

    var appCdnRoot = "./";
    var simCdnRoot = "sim/";
    var simUrl = "/sim/simulator.html";

    var scripts = [
        "bluebird.min.js",
        "typescript.js",
        "lzma/lzma_worker-min.js",
        "blockly/blockly_compressed.js",
        "blockly/blocks_compressed.js",
        "blockly/msg/js/en.js",
        "kindlib.js",
        "kindblocks.js",
        "kindsim.js",
        "kindrunner.js"
    ].map(function(s) { return appCdnRoot + s; })

    if (typeof jQuery == "undefined")
        scripts.unshift(appCdnRoot + "jquery.js")

    var pxtCallbacks = []

    window.ksRunnerReady = function (f) {
        if (pxtCallbacks == null) f()
        else pxtCallbacks.push(f)
    }

    window.ksRunnerWhenLoaded = function() {
        pxt.runner.initCallbacks = pxtCallbacks
        pxtCallbacks.push(function() {
            pxtCallbacks = null
        })
        pxt.runner.init({
            appCdnRoot: appCdnRoot,
            simCdnRoot: simCdnRoot,
            simUrl: simUrl,
        })
    }

    scripts.forEach(function(src) {
        var script = document.createElement('script');
        script.src = src;
        script.async = false;
        document.head.appendChild(script);
    })

} ())
