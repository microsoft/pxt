// @ts-ignore
const STORAGE_KEY = "SAVED_SAMPLE";
const ENDPOINT_KEY = "SAVED_ENDPOINT";
const existing = localStorage.getItem(STORAGE_KEY)

// @ts-ignore
const editor = monaco.editor.create(document.getElementById("container"), {
    value: existing || "",
    language: "typescript",
    minimap: { enabled: false }
});

interface TargetInfo {
    name: string;
    id: string;
    endpoints: TargetEndpoint[];
}

interface TargetEndpoint {
    name: string;
    url: string;
}

interface SampleInfo {
    chapter: string;
    name: string;
    id: string;
    path: string;
    js?: string;
}

// interface defined in pxteditor\workspace.ts
interface Project {
    header?: any;
    text?: { [ key: string ]: string };
}

const targets: TargetInfo[] = [
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
        ],
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
        ],
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
    }, {
        name: "micro:bit",
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
    }
];

const CUSTOM_FILE = "custom.ts";

let selectedEndpoint: string;
let selectedId: string;
let baseProjects: { [key: string] : Project } = {};

editor.onDidChangeModelContent(debounce(() => {
    localStorage.setItem(STORAGE_KEY, editor.getValue());
}, 500));
// @ts-ignore
monaco.languages?.typescript?.typescriptDefaults.setDiagnosticsOptions(
    { noSemanticValidation: true });

const iframe = document.createElement("iframe");
document.getElementById("makecode-editor").appendChild(iframe);
loadIframe(localStorage.getItem(ENDPOINT_KEY));

initEndpoints();
initSamples();

document.getElementById("run-button").addEventListener("click", () => {
    const ts = editor.getValue();
    sendMessage("importproject", ts);
})

window.addEventListener("message", receiveMessage, false);
window.addEventListener("resize", function() {
    const parent = document.getElementById("monaco-editor");
    editor.layout({ width: parent.clientWidth, height: parent.clientHeight });
});

function initEndpoints() {
    const s = document.getElementById("endpoint-select");

    for (const target of targets) {
        for (const endpoint of target.endpoints) {
            const opt = document.createElement("option");
            opt.value = `${target.name}-${endpoint.name}`;
            opt.innerText = `${target.name} ${endpoint.name}`;
            s.appendChild(opt);
        }
    }

    s.addEventListener("change", ev => {
        loadIframe((ev.target as HTMLOptionElement).value)
    });
}

let PLAY_SAMPLES: SampleInfo[]; // defined in /playground/samples/all.js
function initSamples() {
    const s = document.getElementById("sample-select") as HTMLSelectElement;

    // load sample names into dropdown
    let sampleChapter;
    PLAY_SAMPLES.forEach(function (sample) {
        if (!sampleChapter || sampleChapter.label !== sample.chapter) {
            sampleChapter = document.createElement('optgroup');
            sampleChapter.label = sample.chapter;
            s.appendChild(sampleChapter);
        }
        let sampleOption = document.createElement('option');
        sampleOption.value = sample.id;
        sampleOption.appendChild(document.createTextNode(sample.name));
        sampleChapter.appendChild(sampleOption);
    });

    // check if sample js loaded, otherwise send xhr
    function loadSample(sampleId, callback) {
        let sample = PLAY_SAMPLES.find(e => e.id == sampleId);
        if (!sample) {
            return callback(new Error('sample not found'));
        } else if (sample?.js) {
            return callback(null, sample);
        }

        let samplePath = 'static/playground/samples/' + sample.path;
        xhr(samplePath + '/sample.js', function() {
            sample.js = this.responseText;
            callback(null, sample);
        })
    }

    let currentToken = 0;
    function parseHash(firstTime) {
        let sampleId = window.location.hash.replace(/^#/, '');
        if (!sampleId) {
            sampleId = PLAY_SAMPLES[0].id;
        }

        if (firstTime) {
            for (let i = 0; i < s.options.length; i++) {
                let opt = s.options[i];
                if (opt.value === sampleId) {
                    s.selectedIndex = i;
                    break;
                }
            }
        }

        let myToken = (++currentToken);
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

    s.addEventListener("change", ev => {
        let sampleId = s.options[s.selectedIndex].value;
        window.location.hash = sampleId;
    });

    window.addEventListener("hashchange", parseHash);
    parseHash(true);
}

function loadIframe(selected: string) {
    if (selected === selectedEndpoint) return;

    for (const target of targets) {
        for (const endpoint of target.endpoints) {
            if (!selected || selected === `${target.name}-${endpoint.name}`) {
                iframe.setAttribute("src", endpoint.url);
                selectedEndpoint = `${target.name}-${endpoint.name}`;
                selectedId = target.id;
                return;
            }
        }
    }

    // Load first target
    loadIframe(null);
}

function sendMessage(action: string, ts?: string) {
    const msg: any = {
        type: "pxteditor",
        id: Math.random().toString(),
        action: action
    };

    let project = baseProjects[selectedEndpoint];
    if (action == 'importproject') {
        if (project) {
            // add custom file name to pxt.json
            const config = JSON.parse(project.text["pxt.json"]);
            if (config.files.indexOf(CUSTOM_FILE) < 0) {
                config.files.push(CUSTOM_FILE);
                project.text["pxt.json"] = JSON.stringify(config);
            }
            // add/update custom file
            project.text[CUSTOM_FILE] = ts;

            msg.project = project;
        }
    }
    iframe.contentWindow.postMessage(msg, "*")
}

function receiveMessage(ev: any) {
    const msg = ev.data;
    if (msg.type == "pxthost") {
        if (msg.action == "workspacesync") {
            // no project
            msg.projects = [];
            iframe.contentWindow.postMessage(msg, "*");
            return;
        } else if (msg.action == "workspacesave") {
            if (!baseProjects[selectedEndpoint])
                baseProjects[selectedEndpoint] = msg.project
            return;
        }
    }
}

function debounce(func: (...args: any[]) => any, wait: number, immediate?: boolean): any {
    let timeout: any;
    return function (this: any) {
        let context = this
        let args = arguments;
        let later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        let callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
        return timeout;
    };
}

function xhr(url, callback) {
    let req = new XMLHttpRequest();
    req.addEventListener("load", callback);
    req.open("GET", url);
    req.send();
}
