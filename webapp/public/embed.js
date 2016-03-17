(function() {
    if (window.ksRunnerInit) return;

    var appCdnRoot = "./";
    var simCdnRoot = "./";

    var scripts = [
        "bluebird.min.js",
        "typescript.js",
        "blockly/blockly_compressed.js",
        "blockly/blocks_compressed.js",
        "blockly/msg/js/en.js",
        "hexinfo.js",
        "kindlib.js",
        "kindblocks.js",
        "kindrunner.js",
    ].map(s => appCdnRoot + s)

    if (typeof jQuery == "undefined")
        scripts.unshift(appCdnRoot + "jquery.js")

    var ksCallbacks = []

    window.ksRunnerReady = function (f) {
        if (ksCallbacks == null) f()
        else ksCallbacks.push(f)
    }

    window.ksRunnerWhenLoaded = () => {
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
        let script = document.createElement('script');
        script.src = src;
        script.async = false;
        document.head.appendChild(script);
    })

} ())
