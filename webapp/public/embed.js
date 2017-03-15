(function() {
    if (window.ksRunnerInit) return;

    // This line gets patched up by the cloud
    var pxtConfig = null;

    var scripts = [
        "/blob/highlight.js/highlight.pack.js",
        "/blob/bluebird.min.js",
        "/blob/typescript.js",
        "/blob/semantic.js",
        "/blob/marked/marked.min.js",
        "/blob/lzma/lzma_worker-min.js",
        "/blob/blockly/blockly_compressed.js",
        "/blob/blockly/blocks_compressed.js",
        "/blob/blockly/msg/js/en.js",
        "/blob/pxtlib.js",
        "/blob/pxtblocks.js",
        "/blob/pxteditor.js",
        "/blob/pxtsim.js",
        "/blob/target.js",
        "/blob/pxtrunner.js"
    ]

    if (typeof jQuery == "undefined")
        scripts.unshift("/blob/jquery.js")

    var pxtCallbacks = []

    window.ksRunnerReady = function(f) {
        if (pxtCallbacks == null) f()
        else pxtCallbacks.push(f)
    }

    window.ksRunnerWhenLoaded = function() {
        pxt.docs.requireHighlightJs = function() { return hljs; }
        pxt.setupWebConfig(pxtConfig || window.pxtWebConfig)
        pxt.runner.initCallbacks = pxtCallbacks
        pxtCallbacks.push(function() {
            pxtCallbacks = null
        })
        pxt.runner.init();
    }

    scripts.forEach(function(src) {
        var script = document.createElement('script');
        script.src = src;
        script.async = false;
        document.head.appendChild(script);
    })

} ())
