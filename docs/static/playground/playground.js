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
var CUSTOM_FILE = "custom.ts";
var PLAYGROUND_ID = "playground";
var endpoints;
var selectedEndpoint;
var baseProjects = {};
editor.onDidChangeModelContent(debounce(function () {
    localStorage.setItem(STORAGE_KEY, editor.getValue());
}, 500));
// @ts-ignore
(_b = (_a = monaco.languages) === null || _a === void 0 ? void 0 : _a.typescript) === null || _b === void 0 ? void 0 : _b.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });
var iframe = document.createElement("iframe");
document.getElementById("makecode-editor").appendChild(iframe);
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
    xhr("editors.json", function () {
        endpoints = JSON.parse(this.responseText);
        for (var _i = 0, _a = Object.keys(endpoints); _i < _a.length; _i++) {
            var name_1 = _a[_i];
            var endpoint = endpoints[name_1];
            if (supportedEndpoint(endpoint)) {
                var opt = document.createElement("option");
                opt.value = name_1;
                opt.innerText = endpoint.name;
                s.appendChild(opt);
            }
            else {
                delete endpoints[name_1];
            }
        }
        s.addEventListener("change", function (ev) {
            loadIframe(ev.target.value);
        });
        loadIframe(null);
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
    for (var _i = 0, _a = Object.keys(endpoints); _i < _a.length; _i++) {
        var name_2 = _a[_i];
        var endpoint = endpoints[name_2];
        if (!selected || selected === name_2) {
            var separator = endpoint.url.indexOf("?") >= 0 ? "&" : "?";
            iframe.setAttribute("src", "" + endpoint.url + separator + "controller=1");
            selectedEndpoint = name_2;
            return;
        }
    }
}
function supportedEndpoint(endpoint) {
    var _a;
    return !(((_a = endpoint.unsupported) === null || _a === void 0 ? void 0 : _a.indexOf(PLAYGROUND_ID)) >= 0);
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
