var _a, _b;
// @ts-ignore
var STORAGE_KEY = "SAVED_SAMPLE";
var ENDPOINT_KEY = "SAVED_ENDPOINT";
var existing = localStorage.getItem(STORAGE_KEY);
// @ts-ignore
var editor = monaco.editor.create(document.getElementById("container"), {
    value: existing || "",
    language: "typescript",
    minimap: { enabled: false }
});
var targets = [
    {
        name: "Arcade",
        id: "arcade",
        endpoints: [
            {
                name: "beta",
                url: "https://arcade.makecode.com/beta?controller=1"
            },
            {
                name: "released",
                url: "https://arcade.makecode.com?controller=1"
            }
        ]
    }, {
        name: "Minecraft",
        id: "minecraft",
        endpoints: [
            {
                name: "beta",
                url: "https://minecraft.makecode.com/beta?ipc=1&inGame=1&controller=1"
            },
            {
                name: "released",
                url: "https://minecraft.makecode.com?ipc=1&inGame=1&controller=1"
            }
        ]
    }, {
        name: "Adafruit",
        id: "adafruit",
        endpoints: [
            {
                name: "beta",
                url: "https://makecode.adafruit.com/beta?controller=1"
            },
            {
                name: "released",
                url: "https://makecode.adafruit.com?controller=1"
            }
        ]
    }, {
        name: "Micro:bit",
        id: "microbit",
        endpoints: [
            {
                name: "beta",
                url: "https://makecode.microbit.org/beta?controller=1"
            },
            {
                name: "released",
                url: "https://makecode.microbit.org?controller=1"
            }
        ]
    }, {
        name: "LEGO EV3",
        id: "ev3",
        endpoints: [
            {
                name: "beta",
                url: "https://makecode.mindstorms.com/beta?controller=1"
            },
            {
                name: "released",
                url: "https://makecode.mindstorms.com?controller=1"
            }
        ]
    }
];
var CUSTOM_FILE = "_custom.ts";
var selectedEndpoint;
var selectedId;
var baseProjects = {};
editor.onDidChangeModelContent(debounce(function () {
    localStorage.setItem(STORAGE_KEY, editor.getValue());
}, 500));
// @ts-ignore
(_b = (_a = monaco.languages) === null || _a === void 0 ? void 0 : _a.typescript) === null || _b === void 0 ? void 0 : _b.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });
var iframe = document.createElement("iframe");
document.getElementById("makecode-editor").appendChild(iframe);
loadIframe(localStorage.getItem(ENDPOINT_KEY));
initEndpoints();
initSamples();
document.getElementById("run-button").addEventListener("click", function () {
    var ts = editor.getValue();
    sendMessage("importproject", ts);
});
window.addEventListener("message", receiveMessage, false);
window.addEventListener("resize", function () {
    var parent = document.getElementById("monaco-editor");
    editor.layout({ width: parent.clientWidth, height: parent.clientHeight });
});
function initEndpoints() {
    var s = document.getElementById("endpoint-select");
    for (var _i = 0, targets_1 = targets; _i < targets_1.length; _i++) {
        var target = targets_1[_i];
        for (var _a = 0, _b = target.endpoints; _a < _b.length; _a++) {
            var endpoint = _b[_a];
            var opt = document.createElement("option");
            opt.value = target.name + "-" + endpoint.name;
            opt.innerText = target.name + " " + endpoint.name;
            s.appendChild(opt);
        }
    }
    s.addEventListener("change", function (ev) {
        loadIframe(ev.target.value);
    });
}
var PLAY_SAMPLES; // defined in /playground/samples/all.js
function initSamples() {
    var s = document.getElementById("sample-select");
    // load sample names into dropdown
    var sampleChapter;
    PLAY_SAMPLES.forEach(function (sample) {
        if (!sampleChapter || sampleChapter.label !== sample.chapter) {
            sampleChapter = document.createElement('optgroup');
            sampleChapter.label = sample.chapter;
            s.appendChild(sampleChapter);
        }
        var sampleOption = document.createElement('option');
        sampleOption.value = sample.id;
        sampleOption.appendChild(document.createTextNode(sample.name));
        sampleChapter.appendChild(sampleOption);
    });
    // check if sample js loaded, otherwise send xhr
    function loadSample(sampleId, callback) {
        var _a;
        var sample = PLAY_SAMPLES.find(function (e) { return e.id == sampleId; });
        if (!sample) {
            return callback(new Error('sample not found'));
        }
        else if ((_a = sample) === null || _a === void 0 ? void 0 : _a.js) {
            return callback(null, sample);
        }
        var samplePath = 'static/playground/samples/' + sample.path;
        xhr(samplePath + '/sample.js', function () {
            sample.js = this.responseText;
            callback(null, sample);
        });
    }
    var currentToken = 0;
    function parseHash(firstTime) {
        var sampleId = window.location.hash.replace(/^#/, '');
        if (!sampleId) {
            sampleId = PLAY_SAMPLES[0].id;
        }
        if (firstTime) {
            for (var i = 0; i < s.options.length; i++) {
                var opt = s.options[i];
                if (opt.value === sampleId) {
                    s.selectedIndex = i;
                    break;
                }
            }
        }
        var myToken = (++currentToken);
        loadSample(sampleId, function (err, sample) {
            if (err) {
                alert('Sample not found! ' + err.message);
                return;
            }
            if (myToken !== currentToken) {
                return;
            }
            editor.setValue(sample.js);
            editor.setScrollTop(0);
            sendMessage("importproject", sample.js);
        });
    }
    s.addEventListener("change", function (ev) {
        var sampleId = s.options[s.selectedIndex].value;
        window.location.hash = sampleId;
    });
    window.addEventListener("hashchange", parseHash);
    parseHash(true);
}
function loadIframe(selected) {
    if (selected === selectedEndpoint)
        return;
    for (var _i = 0, targets_2 = targets; _i < targets_2.length; _i++) {
        var target = targets_2[_i];
        for (var _a = 0, _b = target.endpoints; _a < _b.length; _a++) {
            var endpoint = _b[_a];
            if (!selected || selected === target.name + "-" + endpoint.name) {
                iframe.setAttribute("src", endpoint.url);
                selectedEndpoint = target.name + "-" + endpoint.name;
                selectedId = target.id;
                return;
            }
        }
    }
    // Load first target
    loadIframe(null);
}
function sendMessage(action, ts) {
    var msg = {
        type: "pxteditor",
        id: Math.random().toString(),
        action: action
    };
    var project = baseProjects[selectedEndpoint];
    if (action == 'importproject') {
        if (project) {
            // add custom file name to pxt.json
            var config = JSON.parse(project.text["pxt.json"]);
            if (config.files.indexOf(CUSTOM_FILE) < 0) {
                config.files.push(CUSTOM_FILE);
                project.text["pxt.json"] = JSON.stringify(config);
            }
            // add/update custom file
            project.text[CUSTOM_FILE] = ts;
            msg.project = project;
        }
    }
    iframe.contentWindow.postMessage(msg, "*");
}
function receiveMessage(ev) {
    var msg = ev.data;
    if (msg.type == "pxthost") {
        if (msg.action == "workspacesync") {
            // no project
            msg.projects = [];
            iframe.contentWindow.postMessage(msg, "*");
            return;
        }
        else if (msg.action == "workspacesave") {
            if (!baseProjects[selectedEndpoint])
                baseProjects[selectedEndpoint] = msg.project;
            return;
        }
    }
}
function debounce(func, wait, immediate) {
    var timeout;
    return function () {
        var context = this;
        var args = arguments;
        var later = function () {
            timeout = null;
            if (!immediate)
                func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow)
            func.apply(context, args);
        return timeout;
    };
}
function xhr(url, callback) {
    var req = new XMLHttpRequest();
    req.addEventListener("load", callback);
    req.open("GET", url);
    req.send();
}
