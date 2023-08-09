import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';
import * as nodeutil from './nodeutil';
import * as hid from './hid';
import * as net from 'net';
import * as crowdin from './crowdin';
import * as storage from './storage';

import { promisify } from "util";

import U = pxt.Util;
import Cloud = pxt.Cloud;

const userProjectsDirName = "projects";

let root = ""
let dirs = [""]
let docfilesdirs = [""]
let userProjectsDir = path.join(process.cwd(), userProjectsDirName);
let docsDir = ""
let packagedDir = ""
let localHexCacheDir = path.join("built", "hexcache");
let serveOptions: ServeOptions;

const webappNames = [
    "kiosk"
    // TODO: Add other webapp names here: "multiplayer", "skillmap", "authcode"
];

function setupDocfilesdirs() {
    docfilesdirs = [
        "docfiles",
        path.join(nodeutil.pxtCoreDir, "docfiles")
    ]
}

function setupRootDir() {
    root = nodeutil.targetDir
    console.log("Starting server in", root)
    console.log(`With pxt core at ${nodeutil.pxtCoreDir}`)
    dirs = [
        "built/web",
        path.join(nodeutil.targetDir, "docs"),
        path.join(nodeutil.targetDir, "built"),
        path.join(nodeutil.targetDir, "sim/public"),
        path.join(nodeutil.targetDir, "node_modules", `pxt-${pxt.appTarget.id}-sim`, "public"),
        path.join(nodeutil.pxtCoreDir, "built/web"),
        path.join(nodeutil.pxtCoreDir, "webapp/public"),
        path.join(nodeutil.pxtCoreDir, "common-docs"),
        path.join(nodeutil.pxtCoreDir, "docs"),
    ]
    docsDir = path.join(root, "docs")
    packagedDir = path.join(root, "built/packaged")
    setupDocfilesdirs()
    setupProjectsDir()

    pxt.debug(`docs dir:\r\n    ${docsDir}`)
    pxt.debug(`doc files dir: \r\n    ${docfilesdirs.join("\r\n    ")}`)
    pxt.debug(`dirs:\r\n    ${dirs.join('\r\n    ')}`)
    pxt.debug(`projects dir: ${userProjectsDir}`);
}

function setupProjectsDir() {
    nodeutil.mkdirP(userProjectsDir);
}

const statAsync = promisify(fs.stat)
const readdirAsync = promisify(fs.readdir)
const readFileAsync = promisify(fs.readFile)
const writeFileAsync: any = promisify(fs.writeFile)
const unlinkAsync: any = promisify(fs.unlink)

function existsAsync(fn: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        fs.exists(fn, resolve)
    })
}

function statOptAsync(fn: string): Promise<fs.Stats> {// or null
    return statAsync(fn)
        .then(st => st, err => null)
}

function throwError(code: number, msg: string = null) {
    let err = new Error(msg || "Error " + code);
    (err as any).statusCode = code
    throw err
}

type FsFile = pxt.FsFile;
type FsPkg = pxt.FsPkg;

function readAssetsAsync(logicalDirname: string): Promise<any> {
    let dirname = path.join(userProjectsDir, logicalDirname, "assets")
    let pref = "http://" + serveOptions.hostname + ":" + serveOptions.port + "/assets/" + logicalDirname + "/"
    return readdirAsync(dirname)
        .catch(err => [])
        .then(res => U.promiseMapAll(res, fn => statAsync(path.join(dirname, fn)).then(res => ({
            name: fn,
            size: res.size,
            url: pref + fn
        }))))
        .then(res => ({
            files: res
        }))
}

const HEADER_JSON = ".header.json"

async function readPkgAsync(logicalDirname: string, fileContents = false): Promise<FsPkg> {
    let dirname = path.join(userProjectsDir, logicalDirname)
    let buf = await readFileAsync(path.join(dirname, pxt.CONFIG_NAME))
    let cfg: pxt.PackageConfig = JSON.parse(buf.toString("utf8"))
    let r: FsPkg = {
        path: logicalDirname,
        config: cfg,
        header: null,
        files: []
    };

    for (let fn of pxt.allPkgFiles(cfg).concat([pxt.github.GIT_JSON, pxt.SIMSTATE_JSON])) {
        let st = await statOptAsync(path.join(dirname, fn))
        let ff: FsFile = {
            name: fn,
            mtime: st ? st.mtime.getTime() : null
        }

        let thisFileContents = st && fileContents

        if (!st && fn == pxt.SIMSTATE_JSON)
            continue

        if (fn == pxt.github.GIT_JSON) {
            // skip .git.json altogether if missing
            if (!st) continue
            thisFileContents = true
        }

        if (thisFileContents) {
            let buf = await readFileAsync(path.join(dirname, fn))
            ff.content = buf.toString("utf8")
        }

        r.files.push(ff)
    }

    if (await existsAsync(path.join(dirname, "icon.jpeg"))) {
        r.icon = "/icon/" + logicalDirname
    }

    // now try reading the header
    buf = await readFileAsync(path.join(dirname, HEADER_JSON))
        .then(b => b, err => null)

    if (buf && buf.length)
        r.header = JSON.parse(buf.toString("utf8"))

    return r
}

function writeScreenshotAsync(logicalDirname: string, screenshotUri: string, iconUri: string) {
    console.log('writing screenshot...');
    const dirname = path.join(userProjectsDir, logicalDirname)
    nodeutil.mkdirP(dirname)

    function writeUriAsync(name: string, uri: string) {
        if (!uri) return Promise.resolve();
        const m = uri.match(/^data:image\/(png|jpeg);base64,(.*)$/);
        if (!m) return Promise.resolve();
        const ext = m[1];
        const data = m[2];
        const fn = path.join(dirname, name + "." + ext);
        console.log(`writing ${fn}`)
        return writeFileAsync(fn, Buffer.from(data, 'base64'));
    }

    return Promise.all([
        writeUriAsync("screenshot", screenshotUri),
        writeUriAsync("icon", iconUri)
    ]).then(() => { });
}

function writePkgAssetAsync(logicalDirname: string, data: any) {
    const dirname = path.join(userProjectsDir, logicalDirname, "assets")

    nodeutil.mkdirP(dirname)
    return writeFileAsync(dirname + "/" + data.name, Buffer.from(data.data, data.encoding || "base64"))
        .then(() => ({
            name: data.name
        }))
}

function writePkgAsync(logicalDirname: string, data: FsPkg) {
    const dirname = path.join(userProjectsDir, logicalDirname)

    nodeutil.mkdirP(dirname)

    return U.promiseMapAll(data.files, f =>
        readFileAsync(path.join(dirname, f.name))
            .then(buf => {
                if (f.name == pxt.CONFIG_NAME) {
                    try {
                        if (!pxt.Package.parseAndValidConfig(f.content)) {
                            pxt.log("Trying to save invalid JSON config")
                            pxt.debug(f.content);
                            throwError(410)
                        }
                    } catch (e) {
                        pxt.log("Trying to save invalid format JSON config")
                        pxt.log(e)
                        pxt.debug(f.content);
                        throwError(410)
                    }
                }
                if (buf.toString("utf8") !== f.prevContent) {
                    pxt.log(`merge error for ${f.name}: previous content changed...`);
                    throwError(409)
                }
            }, err => { }))
        // no conflict, proceed with writing
        .then(() => U.promiseMapAll(data.files, f => {
            let d = f.name.replace(/\/[^\/]*$/, "")
            if (d != f.name)
                nodeutil.mkdirP(path.join(dirname, d))
            const fn = path.join(dirname, f.name)
            return f.content == null ? unlinkAsync(fn) : writeFileAsync(fn, f.content)
        }))
        .then(() => {
            if (data.header)
                return writeFileAsync(path.join(dirname, HEADER_JSON), JSON.stringify(data.header, null, 4))
        })
        .then(() => readPkgAsync(logicalDirname, false))
}

function returnDirAsync(logicalDirname: string, depth: number): Promise<FsPkg[]> {
    logicalDirname = logicalDirname.replace(/^\//, "")
    const dirname = path.join(userProjectsDir, logicalDirname)
    // load packages under /projects, 3 level deep
    return existsAsync(path.join(dirname, pxt.CONFIG_NAME))
        // read package if pxt.json exists
        .then(ispkg => Promise.all<FsPkg[]>([
            // current folder
            ispkg ? readPkgAsync(logicalDirname).then<FsPkg[]>(r => [r], err => undefined) : Promise.resolve<FsPkg[]>(undefined),
            // nested packets
            depth <= 1 ? Promise.resolve<FsPkg[]>(undefined)
                : readdirAsync(dirname).then(files => U.promiseMapAll(files, fn =>
                    statAsync(path.join(dirname, fn)).then<FsPkg[]>(st => {
                        if (fn[0] != "." && st.isDirectory())
                            return returnDirAsync(logicalDirname + "/" + fn, depth - 1)
                        else return undefined
                    })).then(U.concat)
                )
        ]))
        // drop empty arrays
        .then(rs => rs.filter(r => !!r))
        .then(U.concat);
}

function isAuthorizedLocalRequest(req: http.IncomingMessage): boolean {
    // validate token
    return req.headers["authorization"]
        && req.headers["authorization"] == serveOptions.localToken;
}

function getCachedHexAsync(sha: string): Promise<any> {
    if (!sha) {
        return Promise.resolve();
    }

    let hexFile = path.resolve(localHexCacheDir, sha + ".hex");

    return existsAsync(hexFile)
        .then((results) => {
            if (!results) {
                console.log(`offline HEX not found: ${hexFile}`);
                return Promise.resolve(null);
            }

            console.log(`serving HEX from offline cache: ${hexFile}`);
            return readFileAsync(hexFile)
                .then((fileContent) => {
                    return {
                        enums: [],
                        functions: [],
                        hex: fileContent.toString()
                    };
                });
        });
}

async function handleApiStoreRequestAsync(req: http.IncomingMessage, res: http.ServerResponse, elts: string[]): Promise<void> {
    const meth = req.method.toUpperCase();
    const container = decodeURIComponent(elts[0]);
    const key = decodeURIComponent(elts[1]);
    if (!container || !key) { throw throwError(400, "malformed api/store request: " + req.url); }
    const origin = req.headers['origin'] || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (meth === "GET") {
        const val = await storage.getAsync(container, key);
        if (val) {
            if (typeof val === "object") {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf8' });
                res.end(JSON.stringify(val));
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf8' });
                res.end(val.toString());
            }
        } else {
            res.writeHead(204);
            res.end();
        }
    } else if (meth === "POST") {
        const srec = (await nodeutil.readResAsync(req)).toString("utf8");
        const rec = JSON.parse(srec) as storage.Record;
        await storage.setAsync(container, key, rec);
        res.writeHead(200);
        res.end();
    } else if (meth === "DELETE") {
        await storage.delAsync(container, key);
        res.writeHead(200);
        res.end();
    } else if (meth === "OPTIONS") {
        const allowedHeaders = req.headers['access-control-request-headers'] || 'Content-Type';
        const allowedMethods = req.headers['access-control-request-method'] || 'GET, POST, DELETE';
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
        res.setHeader('Access-Control-Allow-Methods', allowedMethods);
        res.writeHead(200);
        res.end();
    } else {
        throw res.writeHead(400, "Unsupported HTTP method: " + meth);
    }
}

function handleApiAsync(req: http.IncomingMessage, res: http.ServerResponse, elts: string[]): Promise<any> {
    const opts: pxt.Map<string | string[]> = querystring.parse(url.parse(req.url).query)
    const innerPath = elts.slice(2).join("/").replace(/^\//, "")
    const filename = path.resolve(path.join(userProjectsDir, innerPath))
    const meth = req.method.toUpperCase()
    const cmd = meth + " " + elts[1]
    const readJsonAsync = () =>
        nodeutil.readResAsync(req)
            .then(buf => JSON.parse(buf.toString("utf8")))

    if (cmd == "GET list")
        return returnDirAsync(innerPath, 3)
            .then<pxt.FsPkgs>(lst => {
                return {
                    pkgs: lst
                }
            })
    else if (cmd == "GET stat")
        return statOptAsync(filename)
            .then(st => {
                if (!st) return {}
                else return {
                    mtime: st.mtime.getTime()
                }
            })
    else if (cmd == "GET pkg")
        return readPkgAsync(innerPath, true)
    else if (cmd == "POST pkg")
        return readJsonAsync()
            .then(d => writePkgAsync(innerPath, d))
    else if (cmd == "POST pkgasset")
        return readJsonAsync()
            .then(d => writePkgAssetAsync(innerPath, d))
    else if (cmd == "GET pkgasset")
        return readAssetsAsync(innerPath)
    else if (cmd == "POST deploy" && pxt.commands.hasDeployFn())
        return readJsonAsync()
            .then(pxt.commands.deployAsync)
            .then((boardCount) => {
                return {
                    boardCount: boardCount
                };
            });
    else if (cmd == "POST screenshot")
        return readJsonAsync()
            .then(d => writeScreenshotAsync(innerPath, d.screenshot, d.icon));
    else if (cmd == "GET compile")
        return getCachedHexAsync(innerPath)
            .then((res) => {
                if (!res) {
                    return {
                        notInOfflineCache: true
                    };
                }

                return res;
            });
    else if (cmd == "GET md" && pxt.appTarget.id + "/" == innerPath.slice(0, pxt.appTarget.id.length + 1)) {
        // innerpath start with targetid
        return readMdAsync(
            innerPath.slice(pxt.appTarget.id.length + 1),
            opts["lang"] as string);
    }
    else if (cmd == "GET config" && new RegExp(`${pxt.appTarget.id}\/targetconfig(\/v[0-9.]+)?$`).test(innerPath)) {
        // target config
        return readFileAsync("targetconfig.json").then(buf => JSON.parse(buf.toString("utf8")));
    }
    else throw throwError(400, `unknown command ${cmd.slice(0, 140)}`)
}

export function lookupDocFile(name: string) {
    if (docfilesdirs.length <= 1)
        setupDocfilesdirs()
    for (let d of docfilesdirs) {
        let foundAt = path.join(d, name)
        if (fs.existsSync(foundAt)) return foundAt
    }
    return null
}

export function expandHtml(html: string, params?: pxt.Map<string>, appTheme?: pxt.AppTheme) {
    let theme = U.flatClone(appTheme || pxt.appTarget.appTheme)
    html = expandDocTemplateCore(html)
    params = params || {};
    params["name"] = params["name"] || pxt.appTarget.appTheme.title;
    params["description"] = params["description"] || pxt.appTarget.appTheme.description;
    params["locale"] = params["locale"] || pxt.appTarget.appTheme.defaultLocale || "en"


    // page overrides
    let m = /<title>([^<>@]*)<\/title>/.exec(html)
    if (m) params["name"] = m[1]
    m = /<meta name="Description" content="([^"@]*)"/.exec(html)
    if (m) params["description"] = m[1]
    let d: pxt.docs.RenderData = {
        html: html,
        params: params,
        theme: theme,
        // Note that breadcrumb and filepath expansion are not supported in the cloud
        // so we don't do them here either.
    }
    pxt.docs.prepTemplate(d)
    return d.finish().replace(/@-(\w+)-@/g, (f, w) => "@" + w + "@")
}

export function expandDocTemplateCore(template: string) {
    template = template
        .replace(/<!--\s*@include\s+(\S+)\s*-->/g,
            (full, fn) => {
                return `
<!-- include ${fn} -->
${expandDocFileTemplate(fn)}
<!-- end include ${fn} -->
`
            })
    return template
}

export function expandDocFileTemplate(name: string) {
    let fn = lookupDocFile(name)
    let template = fn ? fs.readFileSync(fn, "utf8") : ""
    return expandDocTemplateCore(template)
}

let wsSerialClients: WebSocket[] = [];
let webappReady = false;

function initSocketServer(wsPort: number, hostname: string) {
    console.log(`starting local ws server at ${wsPort}...`)
    const WebSocket = require('faye-websocket');

    function startSerial(request: any, socket: any, body: any) {
        let ws = new WebSocket(request, socket, body);
        wsSerialClients.push(ws);
        ws.on('message', function (event: any) {
            // ignore
        });
        ws.on('close', function (event: any) {
            console.log('ws connection closed')
            wsSerialClients.splice(wsSerialClients.indexOf(ws), 1)
            ws = null;
        });
        ws.on('error', function () {
            console.log('ws connection closed')
            wsSerialClients.splice(wsSerialClients.indexOf(ws), 1)
            ws = null;
        })
    }

    function objToString(obj: any) {
        if (obj == null)
            return "null"
        let r = "{\n"
        for (let k of Object.keys(obj)) {
            r += "   " + k + ": "
            let s = JSON.stringify(obj[k])
            if (!s) s = "(null)"
            if (s.length > 60) s = s.slice(0, 60) + "..."
            r += s + "\n"
        }
        r += "}"
        return r
    }

    let hios: pxt.Map<Promise<pxt.HF2.Wrapper>> = {};
    function startHID(request: http.IncomingMessage, socket: WebSocket, body: any) {
        let ws = new WebSocket(request, socket, body);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: "ready" }))
        })
        ws.on('message', function (event: any) {
            try {
                let msg = JSON.parse(event.data);
                pxt.debug(`hid: msg ${msg.op}`) // , objToString(msg.arg))

                // check that HID is installed
                if (!hid.isInstalled(true)) {
                    if (!ws) return;
                    ws.send(JSON.stringify({
                        result: {
                            errorMessage: "node-hid not installed",
                        },
                        op: msg.op,
                        id: msg.id
                    }))
                    return;
                }

                Promise.resolve()
                    .then(() => {
                        let hio = hios[msg.arg.path]
                        if (!hio && msg.arg.path)
                            hios[msg.arg.path] = hio = hid.hf2ConnectAsync(msg.arg.path, !!msg.arg.raw)
                        return hio
                    })
                    .then(hio => {
                        switch (msg.op) {
                            case "disconnect":
                                return hio.disconnectAsync()
                                    .then(() => ({}))
                            case "init":
                                return hio.reconnectAsync()
                                    .then(() => {
                                        hio.io.onEvent = v => {
                                            if (!ws) return
                                            ws.send(JSON.stringify({
                                                op: "event",
                                                result: {
                                                    path: msg.arg.path,
                                                    data: U.toHex(v),
                                                }
                                            }))
                                        }
                                        if (hio.rawMode)
                                            hio.io.onData = hio.io.onEvent
                                        hio.onSerial = (v, isErr) => {
                                            if (!ws) return
                                            ws.send(JSON.stringify({
                                                op: "serial",
                                                result: {
                                                    isError: isErr,
                                                    path: msg.arg.path,
                                                    data: U.toHex(v),
                                                }
                                            }))
                                        }
                                        return {}
                                    })
                            case "send":
                                if (!hio.rawMode)
                                    return null
                                return hio.io.sendPacketAsync(U.fromHex(msg.arg.data))
                                    .then(() => ({}))
                            case "talk":
                                return U.promiseMapAllSeries(msg.arg.cmds, (obj: any) => {
                                    pxt.debug(`hid talk ${obj.cmd}`)
                                    return hio.talkAsync(obj.cmd, U.fromHex(obj.data))
                                        .then(res => ({ data: U.toHex(res) }))
                                });
                            case "sendserial":
                                return hio.sendSerialAsync(U.fromHex(msg.arg.data), msg.arg.isError);
                            case "list":
                                return hid.getHF2DevicesAsync()
                                    .then(devices => { return { devices } as any; });
                            default: // unknown message
                                pxt.log(`unknown hid message ${msg.op}`)
                                return null;
                        }
                    })
                    .then(resp => {
                        if (!ws) return;
                        pxt.debug(`hid: resp ${objToString(resp)}`)
                        ws.send(JSON.stringify({
                            op: msg.op,
                            id: msg.id,
                            result: resp
                        }))
                    }, error => {
                        pxt.log(`hid: error  ${error.message}`)
                        if (!ws) return;
                        ws.send(JSON.stringify({
                            result: {
                                errorMessage: error.message || "Error",
                                errorStackTrace: error.stack,
                            },
                            op: msg.op,
                            id: msg.id
                        }))
                    })
            } catch (e) {
                console.log("ws hid error", e.stack)
            }
        });
        ws.on('close', function (event: any) {
            console.log('ws hid connection closed')
            ws = null;
        });
        ws.on('error', function () {
            console.log('ws hid connection closed')
            ws = null;
        })
    }

    let openSockets: pxt.Map<net.Socket> = {};
    function startTCP(request: http.IncomingMessage, socket: WebSocket, body: any) {
        let ws = new WebSocket(request, socket, body);
        let netSockets: net.Socket[] = []
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: "ready" }))
        })
        ws.on('message', function (event: any) {
            try {
                let msg = JSON.parse(event.data);
                pxt.debug(`tcp: msg ${msg.op}`) // , objToString(msg.arg))

                Promise.resolve()
                    .then(() => {
                        let sock = openSockets[msg.arg.socket]
                        switch (msg.op) {
                            case "close":
                                sock.end();
                                let idx = netSockets.indexOf(sock)
                                if (idx >= 0)
                                    netSockets.splice(idx, 1)
                                return {}
                            case "open":
                                return new Promise((resolve, reject) => {
                                    const newSock = new net.Socket()
                                    netSockets.push(newSock)
                                    const id = pxt.U.guidGen()
                                    newSock.on('error', err => {
                                        if (ws)
                                            ws.send(JSON.stringify({ op: "error", result: { socket: id, error: err.message } }))
                                    })
                                    newSock.connect(msg.arg.port, msg.arg.host, () => {
                                        openSockets[id] = newSock
                                        resolve({ socket: id })
                                    })
                                    newSock.on('data', d => {
                                        if (ws)
                                            ws.send(JSON.stringify({ op: "data", result: { socket: id, data: d.toString("base64"), encoding: "base64" } }))
                                    })
                                    newSock.on('close', () => {
                                        if (ws)
                                            ws.send(JSON.stringify({ op: "close", result: { socket: id } }))
                                    })
                                })

                            case "send":
                                sock.write(Buffer.from(msg.arg.data, msg.arg.encoding || "utf8"))
                                return {}
                            default: // unknown message
                                pxt.log(`unknown tcp message ${msg.op}`)
                                return null;
                        }
                    })
                    .then(resp => {
                        if (!ws) return;
                        pxt.debug(`hid: resp ${objToString(resp)}`)
                        ws.send(JSON.stringify({
                            op: msg.op,
                            id: msg.id,
                            result: resp
                        }))
                    }, error => {
                        pxt.log(`hid: error  ${error.message}`)
                        if (!ws) return;
                        ws.send(JSON.stringify({
                            result: {
                                errorMessage: error.message || "Error",
                                errorStackTrace: error.stack,
                            },
                            op: msg.op,
                            id: msg.id
                        }))
                    })
            } catch (e) {
                console.log("ws tcp error", e.stack)
            }
        });
        function closeAll() {
            console.log('ws tcp connection closed')
            ws = null;
            for (let s of netSockets) {
                try {
                    s.end()
                } catch (e) { }
            }
        }
        ws.on('close', closeAll);
        ws.on('error', closeAll);
    }

    function startDebug(request: http.IncomingMessage, socket: WebSocket, body: any) {
        let ws = new WebSocket(request, socket, body);
        let dapjs: any

        ws.on('open', () => {
            ws.send(JSON.stringify({ id: "ready" }))
        })

        ws.on('message', function (event: any) {
            try {
                let msg = JSON.parse(event.data);
                if (!dapjs) dapjs = require("dapjs")
                let toHandle = msg.arg
                toHandle.op = msg.op
                console.log("DEBUGMSG", objToString(toHandle))
                Promise.resolve()
                    .then(() => dapjs.handleMessageAsync(toHandle))
                    .then(resp => {
                        if (resp == null || typeof resp != "object")
                            resp = { response: resp }
                        console.log("DEBUGRESP", objToString(resp))
                        ws.send(JSON.stringify({
                            op: msg.op,
                            id: msg.id,
                            result: resp
                        }))
                    }, error => {
                        console.log("DEBUGERR", error.stack)
                        ws.send(JSON.stringify({
                            result: {
                                errorMessage: error.message || "Error",
                                errorStackTrace: error.stack,
                            },
                            op: msg.op,
                            id: msg.id
                        }))
                    })
            } catch (e) {
                console.log("ws debug error", e.stack)
            }
        });
        ws.on('close', function (event: any) {
            console.log('ws debug connection closed')
            ws = null;
        });
        ws.on('error', function () {
            console.log('ws debug connection closed')
            ws = null;
        })
    }

    let wsserver = http.createServer();
    wsserver.on('upgrade', function (request: http.IncomingMessage, socket: WebSocket, body: any) {
        try {
            if (WebSocket.isWebSocket(request)) {
                console.log('ws connection at ' + request.url);
                if (request.url == "/" + serveOptions.localToken + "/serial")
                    startSerial(request, socket, body);
                else if (request.url == "/" + serveOptions.localToken + "/debug")
                    startDebug(request, socket, body);
                else if (request.url == "/" + serveOptions.localToken + "/hid")
                    startHID(request, socket, body);
                else if (request.url == "/" + serveOptions.localToken + "/tcp")
                    startTCP(request, socket, body);
                else {
                    console.log('refused connection at ' + request.url);
                    socket.close(403);
                }
            }
        } catch (e) {
            console.log('upgrade failed...')
        }
    });

    return new Promise<void>((resolve, reject) => {
        wsserver.on("Error", reject);
        wsserver.listen(wsPort, hostname, () => resolve());
    });
}

function sendSerialMsg(msg: string) {
    //console.log('sending ' + msg);
    wsSerialClients.forEach(function (client: any) {
        client.send(msg);
    })
}

function initSerialMonitor() {
    // TODO HID
}

export interface ServeOptions {
    localToken: string;
    autoStart: boolean;
    packaged?: boolean;
    browser?: string;
    port?: number;
    hostname?: string;
    wsPort?: number;
    serial?: boolean;
}

// can use http://localhost:3232/streams/nnngzlzxslfu for testing
function streamPageTestAsync(id: string) {
    return Cloud.privateGetAsync(id)
        .then((info: pxt.streams.JsonStream) => {
            let html = pxt.docs.renderMarkdown({
                template: expandDocFileTemplate("stream.html"),
                markdown: "",
                theme: pxt.appTarget.appTheme,
                pubinfo: info as any,
                filepath: "/" + id
            })
            return html
        })
}

function certificateTestAsync(): Promise<string> {
    return Promise.resolve(expandDocFileTemplate("certificates.html"));
}

// use http://localhost:3232/45912-50568-62072-42379 for testing
function scriptPageTestAsync(id: string) {
    return Cloud.privateGetAsync(pxt.Cloud.parseScriptId(id))
        .then((info: Cloud.JsonScript) => {
            // if running against old cloud, infer 'thumb' field
            // can be removed after new cloud deployment
            if (info.thumb !== undefined)
                return info
            return Cloud.privateGetTextAsync(id + "/thumb")
                .then(_ => {
                    info.thumb = true
                    return info
                }, _ => {
                    info.thumb = false
                    return info
                })
        })
        .then((info: Cloud.JsonScript) => {
            let infoA = info as any
            infoA.cardLogo = info.thumb
                ? Cloud.apiRoot + id + "/thumb"
                : pxt.appTarget.appTheme.thumbLogo || pxt.appTarget.appTheme.cardLogo
            let html = pxt.docs.renderMarkdown({
                template: expandDocFileTemplate(pxt.appTarget.appTheme.leanShare
                    ? "leanscript.html" : "script.html"),
                markdown: "",
                theme: pxt.appTarget.appTheme,
                pubinfo: info as any,
                filepath: "/" + id
            })
            return html
        });
}

// use http://localhost:3232/pkg/microsoft/pxt-neopixel for testing
function pkgPageTestAsync(id: string) {
    return pxt.packagesConfigAsync()
        .then(config => pxt.github.repoAsync(id, config))
        .then(repo => {
            if (!repo)
                return "Not found"
            return Cloud.privateGetAsync("gh/" + id + "/text")
                .then((files: pxt.Map<string>) => {
                    let info = JSON.parse(files["pxt.json"])
                    info["slug"] = id
                    info["id"] = "gh/" + id
                    if (repo.status == pxt.github.GitRepoStatus.Approved)
                        info["official"] = "yes"
                    else
                        info["official"] = ""
                    const html = pxt.docs.renderMarkdown({
                        template: expandDocFileTemplate("package.html"),
                        markdown: files["README.md"] || "No `README.md`",
                        theme: pxt.appTarget.appTheme,
                        pubinfo: info,
                        filepath: "/pkg/" + id,
                        repo: { name: repo.name, fullName: repo.fullName, tag: "v" + info.version }
                    })
                    return html
                })
        })
}

function readMdAsync(pathname: string, lang: string): Promise<string> {
    if (!lang || lang == "en") {
        const content = nodeutil.resolveMd(root, pathname);
        if (content) return Promise.resolve(content);
        return Promise.resolve(`# Not found ${pathname}\nChecked:\n` + [docsDir].concat(dirs).concat(nodeutil.lastResolveMdDirs).map(s => "* ``" + s + "``\n").join(""));
    } else {
        // ask makecode cloud for translations
        const mdpath = pathname.replace(/^\//, '');
        return pxt.Cloud.markdownAsync(mdpath, lang);
    }
}

function resolveTOC(pathname: string): pxt.TOCMenuEntry[] {
    // find summary.md
    let summarydir = pathname.replace(/^\//, '');
    let presummarydir = "";
    while (summarydir !== presummarydir) {
        const summaryf = path.join(summarydir, "SUMMARY");
        // find "closest summary"
        const summaryMd = nodeutil.resolveMd(root, summaryf)
        if (summaryMd) {
            try {
                return pxt.docs.buildTOC(summaryMd);
            } catch (e) {
                pxt.log(`invalid ${summaryf} format - ${e.message}`)
                pxt.log(e.stack);
            }
            break;
        }
        presummarydir = summarydir;
        summarydir = path.dirname(summarydir);
    }
    // not found
    pxt.log(`SUMMARY.md not found`)
    return undefined;
}

const compiledCache: pxt.Map<string> = {}
export async function compileScriptAsync(id: string) {
    if (compiledCache[id])
        return compiledCache[id]
    const scrText = await Cloud.privateGetAsync(id + "/text")
    const res = await pxt.simpleCompileAsync(scrText, {})
    let r = ""
    if (res.errors)
        r = `throw new Error(${JSON.stringify(res.errors)})`
    else
        r = res.outfiles["binary.js"]
    compiledCache[id] = r
    return r
}

export function serveAsync(options: ServeOptions) {
    serveOptions = options;
    if (!serveOptions.port) serveOptions.port = 3232;
    if (!serveOptions.wsPort) serveOptions.wsPort = 3233;
    if (!serveOptions.hostname) serveOptions.hostname = "localhost";
    setupRootDir();
    const wsServerPromise = initSocketServer(serveOptions.wsPort, serveOptions.hostname);
    if (serveOptions.serial)
        initSerialMonitor();

    const server = http.createServer(async (req, res) => {
        const error = (code: number, msg: string = null) => {
            res.writeHead(code, { "Content-Type": "text/plain" })
            res.end(msg || "Error " + code)
        }

        const sendJson = (v: any) => {
            if (typeof v == "string") {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf8' })
                res.end(v)
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf8' })
                res.end(JSON.stringify(v))
            }
        }

        const sendHtml = (s: string, code = 200) => {
            res.writeHead(code, { 'Content-Type': 'text/html; charset=utf8' })
            res.end(s.replace(
                /(<img [^>]* src=")(?:\/docs|\.)\/static\/([^">]+)"/g,
                function (f, pref, addr) { return pref + '/static/' + addr + '"'; }
            ))
        }

        const sendFile = (filename: string) => {
            try {
                let stat = fs.statSync(filename);

                res.writeHead(200, {
                    'Content-Type': U.getMime(filename),
                    'Content-Length': stat.size
                });

                fs.createReadStream(filename).pipe(res);
            } catch (e) {
                error(404, "File missing: " + filename)
            }
        }

        let uri = url.parse(req.url);
        let pathname = decodeURI(uri.pathname);
        const opts: pxt.Map<string | string[]> = querystring.parse(url.parse(req.url).query);
        const htmlParams: pxt.Map<string> = {};
        if (opts["lang"] || opts["forcelang"])
            htmlParams["locale"] = (opts["lang"] as string || opts["forcelang"] as string);

        if (pathname == "/") {
            res.writeHead(301, { location: '/index.html' })
            res.end()
            return
        }

        if (pathname == "/oauth-redirect") {
            res.writeHead(301, { location: '/oauth-redirect.html' })
            res.end()
            return
        }

        let elts = pathname.split("/").filter(s => !!s)
        if (elts.some(s => s[0] == ".")) {
            return error(400, "Bad path :-(\n")
        }

        // Strip leading version number
        if (elts.length && /^v\d+/.test(elts[0])) {
            elts.shift();
        }

        // Rebuild pathname without leading version number
        pathname = "/" + elts.join("/");

        const expandWebappHtml = (appname: string, html: string) => {
            // Expand templates
            html = expandHtml(html);
            // Rewrite application resource references
            html = html.replace(/src="(\/static\/js\/[^"]*)"/, (m, f) => `src="/${appname}${f}"`);
            html = html.replace(/src="(\/static\/css\/[^"]*)"/, (m, f) => `src="/${appname}${f}"`);
            return html;
        };

        const serveWebappFile = (webappName: string, webappPath: string) => {
            const webappUri = url.parse(`http://localhost:3000/${webappPath}${uri.search || ""}`);
            http.get(webappUri, r => {
                let body = "";
                r.on("data", (chunk) => {
                    body += chunk;
                });
                r.on("end", () => {
                    if (!webappPath || webappPath === "index.html") {
                        body = expandWebappHtml(webappName, body);
                    }
                    res.writeHead(200);
                    res.write(body);
                    res.end();
                });
            });
        };

        const webappIdx = webappNames.findIndex(s => new RegExp(`^-{0,3}${s}$`).test(elts[0] || ''));
        if (webappIdx >= 0) {
            const webappName = webappNames[webappIdx];
            const webappPath = pathname.split("/").slice(2).join('/'); // remove /<webappName>/ from path
            return serveWebappFile(webappName, webappPath);
        }

        if (elts[0] == "api") {
            if (elts[1] == "streams") {
                let trg = Cloud.apiRoot + req.url.slice(5)
                res.setHeader("Location", trg)
                error(302, "Redir: " + trg)
                return
            }

            if (elts[1] == "immreader") {
                let trg = Cloud.apiRoot + elts[1];
                res.setHeader("Location", trg)
                error(302, "Redir: " + trg)
                return
            }

            if (elts[1] == "store") {
                return await handleApiStoreRequestAsync(req, res, elts.slice(2));
            }

            if (/^\d\d\d[\d\-]*$/.test(elts[1]) && elts[2] == "js") {
                return compileScriptAsync(elts[1])
                    .then(data => {
                        res.writeHead(200, { 'Content-Type': 'application/javascript' })
                        res.end(data)
                    }, err => {
                        error(500)
                        console.log(err.stack)
                    })
            }

            if (!isAuthorizedLocalRequest(req)) {
                error(403);
                return null;
            }

            return handleApiAsync(req, res, elts)
                .then(sendJson, err => {
                    if (err.statusCode) {
                        error(err.statusCode, err.message || "");
                        console.log("Error " + err.statusCode);
                    }
                    else {
                        error(500)
                        console.log(err.stack)
                    }
                })
        }

        if (elts[0] == "icon") {
            const name = path.join(userProjectsDir, elts[1], "icon.jpeg");
            return existsAsync(name)
                .then(exists => exists ? sendFile(name) : error(404));
        }

        if (elts[0] == "assets") {
            if (/^[a-z0-9\-_]/.test(elts[1]) && !/[\/\\]/.test(elts[1]) && !/^[.]/.test(elts[2])) {
                let filename = path.join(userProjectsDir, elts[1], "assets", elts[2])
                if (nodeutil.fileExistsSync(filename)) {
                    return sendFile(filename)
                } else {
                    return error(404, "Asset not found")
                }
            } else {
                return error(400, "Invalid asset path")
            }
        }

        if (options.packaged) {
            let filename = path.resolve(path.join(packagedDir, pathname))
            if (nodeutil.fileExistsSync(filename)) {
                return sendFile(filename)
            } else {
                return error(404, "Packaged file not found")
            }
        }

        if (pathname.slice(0, pxt.appTarget.id.length + 2) == "/" + pxt.appTarget.id + "/") {
            res.writeHead(301, { location: req.url.slice(pxt.appTarget.id.length + 1) })
            res.end()
            return
        }

        let publicDir = path.join(nodeutil.pxtCoreDir, "webapp/public")

        if (pathname == "/--embed" || pathname === "/---embed") {
            sendFile(path.join(publicDir, 'embed.js'));
            return
        }

        if (pathname == "/--run") {
            sendFile(path.join(publicDir, 'run.html'));
            return
        }

        if (pathname == "/--multi") {
            sendFile(path.join(publicDir, 'multi.html'));
            return
        }

        if (pathname == "/--asseteditor") {
            sendFile(path.join(publicDir, 'asseteditor.html'));
            return
        }

        if (pathname == "/--skillmap") {
            sendFile(path.join(publicDir, 'skillmap.html'));
            return
        }

        if (pathname == "/--authcode") {
            sendFile(path.join(publicDir, 'authcode.html'));
            return
        }

        if (pathname == "/--multiplayer") {
            sendFile(path.join(publicDir, 'multiplayer.html'));
            return
        }

        if (/\/-[-]*docs.*$/.test(pathname)) {
            sendFile(path.join(publicDir, 'docs.html'));
            return
        }

        if (pathname == "/--codeembed") {
            // http://localhost:3232/--codeembed#pub:20467-26471-70207-51013
            sendFile(path.join(publicDir, 'codeembed.html'));
            return
        }

        if (!!pxt.Cloud.parseScriptId(pathname)) {
            scriptPageTestAsync(pathname)
                .then(sendHtml)
                .catch(() => error(404, "Script not found"));
            return
        }

        if (/^\/(pkg|package)\/.*$/.test(pathname)) {
            pkgPageTestAsync(pathname.replace(/^\/[^\/]+\//, ""))
                .then(sendHtml)
                .catch(() => error(404, "Packaged file not found"));
            return
        }

        if (elts[0] == "streams") {
            streamPageTestAsync(elts[0] + "/" + elts[1])
                .then(sendHtml)
            return
        }

        if (elts[0] == "certificates") {
            certificateTestAsync().then(sendHtml);
            return;
        }

        if (/\.js\.map$/.test(pathname)) {
            error(404, "map files disabled")
            return;
        }

        let dd = dirs
        let mm = /^\/(cdn|parts|sim|doccdn|blb|trgblb)(\/.*)/.exec(pathname)
        if (mm) {
            pathname = mm[2]
        } else if (U.startsWith(pathname, "/docfiles/")) {
            pathname = pathname.slice(10)
            dd = docfilesdirs
        }
        for (let dir of dd) {
            let filename = path.resolve(path.join(dir, pathname))
            if (nodeutil.fileExistsSync(filename)) {
                if (/\.html$/.test(filename)) {
                    let html = expandHtml(fs.readFileSync(filename, "utf8"), htmlParams)
                    sendHtml(html)
                } else {
                    sendFile(filename)
                }
                return;
            }
        }

        if (/simulator\.html/.test(pathname)) {
            // Special handling for missing simulator: redirect to the live sim
            res.writeHead(302, { location: `https://trg-${pxt.appTarget.id}.userpxt.io/---simulator` });
            res.end();
            return;
        }

        // redirect
        let redirectFile = path.join(docsDir, pathname + "-ref.json");
        if (nodeutil.fileExistsSync(redirectFile)) {
            const redir = nodeutil.readJson(redirectFile);
            res.writeHead(301, { location: redir["redirect"] })
            res.end()
            return;
        }

        let webFile = path.join(docsDir, pathname)
        if (!nodeutil.fileExistsSync(webFile)) {
            if (nodeutil.fileExistsSync(webFile + ".html")) {
                webFile += ".html"
                pathname += ".html"
            } else {
                webFile = ""
            }
        }

        if (webFile) {
            if (/\.html$/.test(webFile)) {
                let html = expandHtml(fs.readFileSync(webFile, "utf8"), htmlParams)
                sendHtml(html)
            } else {
                sendFile(webFile)
            }
        } else {
            const m = /^\/(v\d+)(.*)/.exec(pathname);
            if (m) pathname = m[2];
            const lang = (opts["translate"] && ts.pxtc.Util.TRANSLATION_LOCALE)
                || opts["lang"] as string
                || opts["forcelang"] as string;
            readMdAsync(pathname, lang)
                .then(md => {
                    const mdopts = <pxt.docs.RenderOptions>{
                        template: expandDocFileTemplate("docs.html"),
                        markdown: md,
                        theme: pxt.appTarget.appTheme,
                        filepath: pathname,
                        TOC: resolveTOC(pathname),
                        pubinfo: {
                            locale: lang,
                            crowdinproject: pxt.appTarget.appTheme.crowdinProject
                        }
                    };
                    if (opts["translate"])
                        mdopts.pubinfo["incontexttranslations"] = "1";
                    const html = pxt.docs.renderMarkdown(mdopts)
                    sendHtml(html, U.startsWith(md, "# Not found") ? 404 : 200)
                });
        }
        return
    });

    // if user has a server.js file, require it
    const serverjs = path.resolve(path.join(root, 'built', 'server.js'))
    if (nodeutil.fileExistsSync(serverjs)) {
        console.log('loading ' + serverjs)
        require(serverjs);
    }

    const serverPromise = new Promise<void>((resolve, reject) => {
        server.on("error", reject);
        server.listen(serveOptions.port, serveOptions.hostname, () => resolve());
    });

    return Promise.all([wsServerPromise, serverPromise])
        .then(() => {
            const start = `http://${serveOptions.hostname}:${serveOptions.port}/#local_token=${options.localToken}&wsport=${serveOptions.wsPort}`;
            console.log(`---------------------------------------------`);
            console.log(``);
            console.log(`To launch the editor, open this URL:`);
            console.log(start);
            console.log(``);
            console.log(`---------------------------------------------`);

            if (options.autoStart) {
                nodeutil.openUrl(start, options.browser);
            }
        });
}
