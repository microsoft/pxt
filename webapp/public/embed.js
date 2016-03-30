(function() {
    if (window.ksRunnerInit) return;

    var appCdnRoot = "./";
    var simCdnRoot = "sim/";

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

    var ksCallbacks = []

    window.ksRunnerReady = function (f) {
        if (ksCallbacks == null) f()
        else ksCallbacks.push(f)
    }

    window.ksRunnerWhenLoaded = function() {
        ks.runner.initCallbacks = ksCallbacks
        ksCallbacks.push(function() {
            ksCallbacks = null
        })
        ks.runner.init({
            appCdnRoot: appCdnRoot,
            simCdnRoot: simCdnRoot,
        })
    }

    scripts.forEach(function(src) {
        var script = document.createElement('script');
        script.src = src;
        script.async = false;
        document.head.appendChild(script);
    })

} ())
