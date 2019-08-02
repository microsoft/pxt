var STORAGE_KEY = "SAVED_TUTORIAL";
var ENDPOINT_KEY = "SAVED_ENDPOINT";
var existing = localStorage.getItem(STORAGE_KEY);
var editor = monaco.editor.create(document.getElementById("container"), {
    value: existing ||
        "# My Tutorial\n\n## Step 1\n\nHere is some text.\n\n## Step 2\n\nCongratulations, you did it!\n    ",
    language: "markdown"
});
var targets = [
    {
        name: "Minecraft",
        id: "minecraft",
        endpoints: [
            {
                name: "nether",
                url: "https://minecraft.makecode.com/beta?ipc=1&inGame=1&nether=1&controller=1"
            },
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
var selectedEndpoint;
var selectedId;
editor.onDidChangeModelContent(debounce(function () {
    localStorage.setItem(STORAGE_KEY, editor.getValue());
}, 500));
var iframe = document.createElement("iframe");
document.getElementById("makecode-editor").appendChild(iframe);
loadIframe(localStorage.getItem(ENDPOINT_KEY));
initDropdown();
document.getElementById("run-button").addEventListener("click", function () {
    var md = editor.getValue();
    sendMessage("importtutorial", md);
});
window.addEventListener("message", receiveMessage, false);
var pendingMsgs = {};
function sendMessage(action, md) {
    console.log('send ' + action);
    var msg = {
        type: "pxteditor",
        id: Math.random().toString(),
        action: action
    };
    if (action == 'importtutorial') {
        msg.markdown = md;
        msg.response = true;
    }
    else if (action == 'renderblocks') {
        msg.response = true;
        msg.ts = 'while(true){ }';
    }
    else if (action == 'toggletrace') {
        msg.intervalSpeed = 1000;
    }
    else if (action == 'settracestate') {
        msg.enabled = true;
    }
    if (msg.response)
        pendingMsgs[msg.id] = msg;
    iframe.contentWindow.postMessage(msg, "*");
}
function receiveMessage(ev) {
    var msg = ev.data;
    console.log('received...');
    console.log(msg);
    if (msg.resp)
        console.log(JSON.stringify(msg.resp, null, 2));
    if (msg.type == "pxthost") {
        if (msg.action == "workspacesync") {
            // no project
            msg.projects = [];
            iframe.contentWindow.postMessage(msg, "*");
            return;
        }
        else if (msg.action == "workspacesave") {
            console.log(JSON.stringify(msg.project, null, 2));
        }
    }
    if (msg.type == "pxteditor") {
        var req = pendingMsgs[msg.id];
        if (req.action == "renderblocks") {
            var img = document.createElement("img");
            img.src = msg.resp;
        }
    }
    delete pendingMsgs[msg.id];
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
function initDropdown() {
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
