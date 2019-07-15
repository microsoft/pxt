/// <reference path="./node_modules/monaco-editor/monaco.d.ts" />
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
        ],
        config: "{\n    \"name\": \"Untitled\",\n    \"dependencies\": {\n        \"core\": \"*\"\n    },\n    \"description\": \"\",\n    \"files\": [\n        \"main.blocks\",\n        \"main.ts\",\n        \"README.md\"\n    ]\n}"
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
        ],
        config: "{\n    \"name\": \"Untitled\",\n    \"dependencies\": {\n        \"device\": \"*\"\n    },\n    \"description\": \"\",\n    \"files\": [\n        \"main.blocks\",\n        \"main.ts\",\n        \"README.md\"\n    ],\n    \"preferredEditor\": \"blocksprj\"\n}"
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
        ],
        config: "{\n    \"name\": \"Untitled\",\n    \"dependencies\": {\n        \"circuit-playground\": \"*\"\n    },\n    \"description\": \"\",\n    \"files\": [\n        \"main.blocks\",\n        \"main.ts\",\n        \"README.md\"\n    ],\n    \"preferredEditor\": \"tsprj\"\n}"
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
        ],
        config: "{\n    \"name\": \"Untitled\",\n    \"dependencies\": {\n        \"core\": \"*\",\n        \"radio\": \"*\"\n    },\n    \"description\": \"\",\n    \"files\": [\n        \"main.blocks\",\n        \"main.ts\",\n        \"README.md\"\n    ],\n    \"preferredEditor\": \"blocksprj\"\n}"
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
        ],
        config: "{\n    \"name\": \"Untitled\",\n    \"dependencies\": {\n        \"ev3\": \"*\"\n    },\n    \"description\": \"\",\n    \"files\": [\n        \"main.blocks\",\n        \"main.ts\",\n        \"README.md\"\n    ]\n}"
    }
];
var selectedEndpoint;
var selectedConfig;
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
    var proj = createProject(md);
    sendMessage("importproject", proj);
});
window.addEventListener("message", receiveMessage, false);
function createProject(md) {
    return {
        "text": {
            "main.blocks": "<xml xmlns=\"http://www.w3.org/1999/xhtml\">\n  <block type=\"pxt-on-start\" id=\",{,HjW]u:lVGcDRS_Cu|\" x=\"-247\" y=\"113\"></block>\n</xml>",
            "main.ts": "\n",
            "README.md": " ",
            "pxt.json": selectedConfig
        },
        "header": createHeader(md)
    };
}
function createHeader(md) {
    var tutorialInfo = pxt.tutorial.parseTutorial(md);
    var tutorialOptions = {
        tutorial: "test",
        tutorialName: tutorialInfo.title || "filename",
        tutorialStep: 0,
        tutorialReady: true,
        tutorialHintCounter: 0,
        tutorialStepInfo: tutorialInfo.steps,
        tutorialMd: md,
        tutorialCode: tutorialInfo.code,
        tutorialRecipe: false,
        templateCode: tutorialInfo.templateCode
    };
    var header = {
        blobCurrent: false,
        editor: "blocksprj",
        githubCurrent: false,
        id: "2159df60-887b-4097-47d5-d0a45bb1ab01",
        meta: {},
        modificationTime: 1562968671,
        name: "test-project",
        path: "test-project",
        pubCurrent: false,
        pubId: "",
        recentUse: 1562968671,
        target: selectedId,
        tutorial: tutorialOptions
    };
    return header;
}
var pxt;
(function (pxt) {
    var tutorial;
    (function (tutorial) {
        function parseTutorial(tutorialmd) {
            var steps = parseTutorialSteps(tutorialmd);
            var title = parseTutorialTitle(tutorialmd);
            if (!steps)
                return undefined; // error parsing steps
            // collect code and infer editor
            var editor = undefined;
            var regex = /```(sim|block|blocks|filterblocks|spy|ghost|typescript|ts|js|javascript|template)?\s*\n([\s\S]*?)\n```/gmi;
            var code = '';
            var templateCode;
            // Concatenate all blocks in separate code blocks and decompile so we can detect what blocks are used (for the toolbox)
            tutorialmd
                .replace(/((?!.)\s)+/g, "\n")
                .replace(regex, function (m0, m1, m2) {
                switch (m1) {
                    case "block":
                    case "blocks":
                    case "filterblocks":
                        if (!checkTutorialEditor("blocksprj"))
                            return undefined;
                        break;
                    case "spy":
                        if (!checkTutorialEditor("pyprj"))
                            return undefined;
                        break;
                    case "typescript":
                    case "ts":
                    case "javascript":
                    case "js":
                        if (!checkTutorialEditor("tsprj"))
                            return undefined;
                        break;
                    case "template":
                        templateCode = m2;
                        break;
                }
                code += "\n { \n " + m2 + "\n } \n";
                return "";
            });
            return {
                editor: "",
                title: title,
                steps: steps,
                code: code,
                templateCode: templateCode
            };
            function checkTutorialEditor(expected) {
                if (editor && editor != expected) {
                    console.debug("tutorial ambiguous: contains snippets of different types");
                    return false;
                }
                else {
                    editor = expected;
                    return true;
                }
            }
        }
        tutorial.parseTutorial = parseTutorial;
        function parseTutorialTitle(tutorialmd) {
            var title = tutorialmd.match(/^#[^#](.*)$/mi);
            return title && title.length > 1 ? title[1] : null;
        }
        function parseTutorialSteps(tutorialmd) {
            var hiddenSnippetRegex = /```(filterblocks|package|ghost|config|template)\s*\n([\s\S]*?)\n```/gmi;
            var hintTextRegex = /(^[\s\S]*?\S)\s*((```|\!\[[\s\S]+?\]\(\S+?\))[\s\S]*)/mi;
            // Download tutorial markdown
            var steps = tutorialmd.split(/^##[^#].*$/gmi);
            var newAuthoring = true;
            if (steps.length <= 1) {
                // try again, using old logic.
                steps = tutorialmd.split(/^###[^#].*$/gmi);
                newAuthoring = false;
            }
            if (steps[0].indexOf("# Not found") == 0) {
                console.debug("tutorial not found");
                return undefined;
            }
            var stepInfo = [];
            tutorialmd.replace(newAuthoring ? /^##[^#](.*)$/gmi : /^###[^#](.*)$/gmi, function (f, s) {
                var info = {
                    fullscreen: /@(fullscreen|unplugged)/.test(s),
                    unplugged: /@unplugged/.test(s),
                    tutorialCompleted: /@tutorialCompleted/.test(s)
                };
                stepInfo.push(info);
                return "";
            });
            if (steps.length < 1)
                return undefined; // Promise.resolve();
            steps = steps.slice(1, steps.length); // Remove tutorial title
            for (var i = 0; i < steps.length; i++) {
                var stepContent = steps[i].trim();
                var contentLines = stepContent.split('\n');
                stepInfo[i].headerContentMd = contentLines[0];
                stepInfo[i].contentMd = stepContent;
                // everything after the first ``` section OR the first image is currently treated as a "hint"
                var hintText = stepContent.match(hintTextRegex);
                var blockSolution = void 0;
                if (hintText && hintText.length > 2) {
                    stepInfo[i].headerContentMd = hintText[1];
                    blockSolution = hintText[2];
                    if (blockSolution) {
                        // remove hidden snippets from the hint
                        blockSolution = blockSolution.replace(hiddenSnippetRegex, '');
                        stepInfo[i].blockSolution = blockSolution;
                    }
                }
                stepInfo[i].hasHint = blockSolution && blockSolution.length > 1;
            }
            return stepInfo;
        }
        function highlight(pre) {
            var text = pre.textContent;
            if (!/@highlight/.test(text)) // shortcut, nothing to do
                return;
            // collapse image python/js literales
            text = text.replace(/img\s*\(\s*"{3}(.|\n)*"{3}\s*\)/g, "\"\"\" \"\"\"");
            text = text.replace(/img\s*\(\s*`(.|\n)*`\s*\)/g, "img` `");
            // render lines
            pre.textContent = ""; // clear up and rebuild
            var lines = text.split('\n');
            for (var i = 0; i < lines.length; ++i) {
                var line = lines[i];
                if (/@highlight/.test(line)) {
                    // highlight next line
                    line = lines[++i];
                    if (line !== undefined) {
                        var span = document.createElement("span");
                        span.className = "highlight-line";
                        span.textContent = line;
                        pre.appendChild(span);
                    }
                }
                else {
                    pre.appendChild(document.createTextNode(line + '\n'));
                }
            }
        }
        tutorial.highlight = highlight;
    })(tutorial = pxt.tutorial || (pxt.tutorial = {}));
})(pxt || (pxt = {}));
var pendingMsgs = {};
function sendMessage(action, proj) {
    console.log('send ' + action);
    var msg = {
        type: "pxteditor",
        id: Math.random().toString(),
        action: action
    };
    if (action == 'importproject') {
        var prj = JSON.parse(JSON.stringify(proj));
        msg.project = prj;
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
function fixURL(url) {
    if (url.indexOf("http") === -1) {
        url = "https://" + url;
    }
    if (url.indexOf("#") !== -1) {
        url = url.split("#")[0];
    }
    if (url.indexOf("?") === -1) {
        url += "?";
    }
    if (url.indexOf("controller=1") === -1) {
        url += "controller=1";
    }
    return url;
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
    if (selectedConfig && selected === selectedEndpoint)
        return;
    for (var _i = 0, targets_2 = targets; _i < targets_2.length; _i++) {
        var target = targets_2[_i];
        for (var _a = 0, _b = target.endpoints; _a < _b.length; _a++) {
            var endpoint = _b[_a];
            if (!selected || selected === target.name + "-" + endpoint.name) {
                iframe.setAttribute("src", endpoint.url);
                selectedEndpoint = target.name + "-" + endpoint.name;
                selectedConfig = target.config;
                selectedId = target.id;
                return;
            }
        }
    }
    // Load first target
    loadIframe(null);
}
