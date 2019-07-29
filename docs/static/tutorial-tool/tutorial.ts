
const STORAGE_KEY = "SAVED_TUTORIAL";
const ENDPOINT_KEY = "SAVED_ENDPOINT";
const existing = localStorage.getItem(STORAGE_KEY)

const editor = monaco.editor.create(document.getElementById("container"), {
    value: existing ||
`# My Tutorial

## Step 1

Here is some text.

## Step 2

Congratulations, you did it!
    `,
    language: "markdown"
});

interface TargetInfo {
    name: string;
    id: string;
    endpoints: TargetEndpoint[];
    config: string;
}

interface TargetEndpoint {
    name: string;
    url: string;
    config?: string;
}

const targets: TargetInfo[] = [
    {
        name: "Minecraft",
        id: "minecraft",
        endpoints: [
            {
                name: "nether",
                url: "https://minecraft.makecode.com/beta?ipc=1&inGame=1&nether=1&controller=1",
                config: "{\n    \"name\": \"Untitled\",\n    \"dependencies\": {\n        \"core\": \"*\",\n        \"builder\": \"*\",\n        \"nether\": \"*\"\n    },\n    \"description\": \"\",\n    \"files\": [\n        \"main.blocks\",\n        \"main.ts\",\n        \"README.md\"\n    ],\n    \"preferredEditor\": \"blocksprj\"\n}"
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

let selectedEndpoint: string;
let selectedConfig: string;
let selectedId: string;

editor.onDidChangeModelContent(debounce(() => {
    localStorage.setItem(STORAGE_KEY, editor.getValue());
}, 500));

const iframe = document.createElement("iframe");
document.getElementById("makecode-editor").appendChild(iframe);
loadIframe(localStorage.getItem(ENDPOINT_KEY));

initDropdown();

document.getElementById("run-button").addEventListener("click", () => {
    const md = editor.getValue();
    const proj = createProject(md);

    sendMessage("importproject", proj);
})

window.addEventListener("message", receiveMessage, false);

function createProject(md: string) {
    return {
        "text": {
            "main.blocks": "<xml xmlns=\"http://www.w3.org/1999/xhtml\">\n  <block type=\"pxt-on-start\" id=\",{,HjW]u:lVGcDRS_Cu|\" x=\"-247\" y=\"113\"></block>\n</xml>",
            "main.ts": "\n",
            "README.md": " ",
            "pxt.json": selectedConfig
          },
        "header": createHeader(md)
    }
}

function createHeader(md: string) {
    const tutorialOptions = {
        tutorial: "test",
        tutorialName: "filename",
        tutorialMd: md,
        tutorialRecipe: false,
    };

    const header = {
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

const pendingMsgs: {[index: string]: any} = {};

function sendMessage(action: string, proj?: any) {
    console.log('send ' + action)

    const msg: any = {
        type: "pxteditor",
        id: Math.random().toString(),
        action: action
    };
    if(action == 'importproject') {
        const prj = JSON.parse(JSON.stringify(proj));
        msg.project = prj;
        msg.response = true;
    } else if (action == 'renderblocks') {
        msg.response = true;
        msg.ts = 'while(true){ }'
    } else if (action == 'toggletrace') {
        msg.intervalSpeed = 1000;
    }
    else if (action == 'settracestate') {
        msg.enabled = true;
    }
    if (msg.response)
        pendingMsgs[msg.id] = msg;
    iframe.contentWindow.postMessage(msg, "*")
}

function receiveMessage(ev: any) {
    const msg = ev.data;
    console.log('received...')
    console.log(msg)

    if(msg.resp)
        console.log(JSON.stringify(msg.resp, null, 2))

    if (msg.type == "pxthost") {
        if (msg.action == "workspacesync") {
            // no project
            msg.projects = [];
            iframe.contentWindow.postMessage(msg, "*")
            return;
        } else if (msg.action == "workspacesave") {
            console.log(JSON.stringify(msg.project, null, 2))
        }
    }
    if (msg.type == "pxteditor") {
        const req = pendingMsgs[msg.id];
        if (req.action == "renderblocks") {
            const img = document.createElement("img");
            img.src = msg.resp;
        }
    }
    delete pendingMsgs[msg.id];
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


function fixURL(url: string) {
    if (url.indexOf("http") === -1) {
        url = "https://" + url;
    }

    if (url.indexOf("#") !== -1) {
        url = url.split("#")[0];
    }

    if (url.indexOf("?") === -1) {
        url += "?"
    }

    if (url.indexOf("controller=1") === -1) {
        url += "controller=1";
    }

    return url;
}

function initDropdown() {
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

function loadIframe(selected: string) {
    if (selectedConfig && selected === selectedEndpoint) return;

    for (const target of targets) {
        for (const endpoint of target.endpoints) {
            if (!selected || selected === `${target.name}-${endpoint.name}`) {
                iframe.setAttribute("src", endpoint.url);
                selectedEndpoint = `${target.name}-${endpoint.name}`;
                selectedConfig = endpoint.config || target.config;
                selectedId = target.id;
                return;
            }
        }
    }

    // Load first target
    loadIframe(null);
}