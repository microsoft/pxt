const STORAGE_KEY = "SAVED_TUTORIAL";
const ENDPOINT_KEY = "SAVED_ENDPOINT";
const existing = localStorage.getItem(STORAGE_KEY)

// @ts-ignore
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

interface ShareResponse {
    statusCode: number;
    headers: any;
    buffer: any;
    text: string;
    json?: any;
}

interface TargetInfo {
    name: string;
    id: string;
    shareUrl: string;
    endpoints: TargetEndpoint[];
}

interface TargetEndpoint {
    name: string;
    url: string;
}

const targets: TargetInfo[] = [
    {
        name: "micro:bit",
        id: "microbit",
        shareUrl: "https://makecode.microbit.org/",
        endpoints: [
            {
                name: "",
                url: "https://makecode.microbit.org/?controller=1"
            }
        ]
    }, {
        name: "Minecraft",
        id: "minecraft",
        shareUrl: "https://minecraft.makecode.com/",
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
        shareUrl: "https://arcade.makecode.com/",
        endpoints: [
            {
                name: "",
                url: "https://arcade.makecode.com/?controller=1"
            },
            {
                name: "beta",
                url: "https://arcade.makecode.com/beta?controller=1"
            }
        ]
    }, {
        name: "Adafruit Circuit Playground Express",
        id: "adafruit",
        shareUrl: "https://makecode.adafruit.com/",
        endpoints: [
            {
                name: "beta",
                url: "https://makecode.adafruit.com/beta?controller=1"
            }
        ]
    }, {
        name: "Calliope MINI",
        id: "calliopemini",
        shareUrl: "https://makecode.calliope.cc/",
        endpoints: [
            {
                name: "",
                url: "https://makecode.calliope.cc/?controller=1"
            }
        ]
    }, {
        name: "Maker",
        id: "maker",
        shareUrl: "https://maker.makecode.com/",
        endpoints: [
            {
                name: "",
                url: "https://maker.makecode.com/?controller=1"
            }
        ]
    }
    /* not supported
    , {
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
    } */
];

function shareScript(md, done) {
    function request(url, data) {
        let client = new XMLHttpRequest();
        let resolved = false;
        client.onreadystatechange = () => {
            if (resolved) return // Safari/iOS likes to call this thing more than once
            if (client.readyState == 4) {
                resolved = true;
                let resp: ShareResponse = {
                    statusCode: client.status,
                    headers: {},
                    buffer: (client as any).responseBody || client.response,
                    text: client.responseText
                }
                const allHeaders = client.getAllResponseHeaders();
                allHeaders.split(/\r?\n/).forEach(l => {
                    let m = /^\s*([^:]+): (.*)/.exec(l)
                    if (m) resp.headers[m[1].toLowerCase()] = m[2]
                })

                // resolve
                if ((resp.statusCode != 200 && resp.statusCode != 304)) {
                    let msg = `Bad HTTP status code: ${resp.statusCode} at ${url}; message: ${(resp.text || "").slice(0, 500)}`;
                    let err = new Error(msg)
                    done(undefined, err);
                } else {
                    if (resp.text && /application\/json/.test(resp.headers["content-type"]))
                        resp.json = JSON.parse(resp.text)
                    // show dialog
                    done(resp);
                }
            }
        }
        let buf = JSON.stringify(data)
        client.open("POST", url);
        client.setRequestHeader("content-type", "application/json; charset=utf8")
        client.send(buf);
    }

    const title = /^#\s([\s\w]*)$/m.exec(md);
    const name = title ? title[1] : "Tutorial";
    request("https://makecode.com/api/scripts", {
        name: name,
        target: selectedTarget.id,
        description: "Made with ❤️ in Microsoft MakeCode Arcade.",
        editor: "blocksprj",
        text: {
            "README.md": md,
            "main.blocks": "",
            "main.ts": "",
            "pxt.json": JSON.stringify({
                name: name,
                dependencies: {
                    "core": "*"
                },
                description: "",
                files: [
                    "main.blocks",
                    "main.ts",
                    "README.md"
                ]
            })
        },
        meta: {}
    });
}


let selectedEndpoint: string;
let selectedId: string;
let selectedTarget: TargetInfo;

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

document.getElementById("share-button").addEventListener("click", function () {
    var btn = document.getElementById("share-button");
    var out = document.getElementById("share-output") as HTMLInputElement;
    btn.className += " loading";
    var md = editor.getValue();
    shareScript(md, function (resp, err) {
        btn.className = btn.className.replace("loading", "");
        if (resp && resp.json) {
            out.value = selectedTarget.shareUrl + "#tutorial:" + resp.json.id;
            out.focus();
            out.select();
        } else if (err)
            out.value = err.message;
        else
            out.value = "Oops, something went wrong.";
    });
});

window.addEventListener("message", receiveMessage, false);

const pendingMsgs: { [index: string]: any } = {};

function sendMessage(action: string, md?: string) {
    console.log('send ' + action)

    const msg: any = {
        type: "pxteditor",
        id: Math.random().toString(),
        action: action
    };
    if (action == 'importtutorial') {
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

    if (msg.resp)
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
                selectedTarget = target;
                return;
            }
        }
    }

    // Load first target
    loadIframe(null);
}