/**
 * Loads the compile assets/js/binary.js file and executes it
 * in a #simframe iframe
 */
(function () {
    var code = "";
    var isReady = false;
    var simState = {}
    var simStateChanged = false
    var started = false;
    var meta = undefined;

    // hide scrollbar
    window.scrollTo(0, 1);
    // init runtime
    initSimState();
    fetchCode();

    // helpers
    function fetchCode() {
        sendReq("./assets/js/binary.js", function (c, status) {
            if (status != 200)
                return;
            code = c;
            // find metadata
            code.replace(/^\/\/\s+meta=([^\n]+)\n/m, function (m, metasrc) {
                meta = JSON.parse(metasrc);
            })
            // load simulator with correct version
            document.getElementById("simframe")
                .setAttribute("src", meta.simUrl);
        })
    }

    function startSim() {
        if (!code || !isReady || started)
            return
        setState("run");
        started = true;
        const runMsg = {
            type: "run",
            parts: [],
            code: code,
            partDefinitions: {},
            cdnUrl: meta.cdnUrl,
            version: meta.target,
            storedState: simState,
            frameCounter: 1,
            options: {
                "theme": "green",
                "player": ""
            },
            id: "green-" + Math.random()
        }
        postMessage(runMsg);
    }

    function stopSim() {
        setState("stopped");
        postMessage({
            type: "stop"
        });
        started = false;
    }

    window.addEventListener('message', function (ev) {
        var d = ev.data
        if (d.type == "ready") {
            var loader = document.getElementById("loader");
            if (loader)
                loader.remove();
            isReady = true;
            startSim();
        } else if (d.type == "simulator") {
            switch (d.command) {
                case "restart":
                    stopSim();
                    startSim();
                    break;
                case "setstate":
                    simState[d.stateKey] = d.stateValue
                    simStateChanged = true
                    break;
            }
        }
    }, false);

    // helpers
    function setState(st) {
        var r = document.getElementById("root");
        if (r)
            r.setAttribute("data-state", st);
    }

    function postMessage(msg) {
        const frame = document.getElementById("simframe");
        if (frame)
            frame.contentWindow.postMessage(msg, meta.simUrl);
    }

    function sendReq(url, cb) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (xhttp.readyState == 4) {
                cb(xhttp.responseText, xhttp.status)
            }
        };
        xhttp.open("GET", url, true);
        xhttp.send();
    }

    function initSimState() {
        try {
            simState = JSON.parse(localStorage["simstate"])
        } catch (e) {
            simState = {}
        }
        setInterval(function () {
            if (simStateChanged)
                localStorage["simstate"] = JSON.stringify(simState)
            simStateChanged = false
        }, 200)
    }
})();
