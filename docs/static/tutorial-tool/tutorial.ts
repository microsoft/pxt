
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
}

interface TargetEndpoint {
    name: string;
    url: string;
}

const targets: TargetInfo[] = [
    {
        name: "Minecraft",
        id: "minecraft",
        endpoints: [
            {
                name: "nether",
                url: "https://minecraft.makecode.com/beta?ipc=1&inGame=1&nether=1&controller=1",
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

let selectedEndpoint: string;
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

    sendMessage("importtutorial", md);
})

window.addEventListener("message", receiveMessage, false);

const pendingMsgs: {[index: string]: any} = {};

function sendMessage(action: string, md?: string) {
    console.log('send ' + action)

    const msg: any = {
        type: "pxteditor",
        id: Math.random().toString(),
        action: action
    };
    if(action == 'importtutorial') {
        msg.markdown = md;
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