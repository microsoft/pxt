/// <reference path="../typings/globals/node/index.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';
import * as nodeutil from './nodeutil';
import * as child_process from 'child_process';
import * as os from 'os';
import * as util from 'util';
import * as hid from './hid';
import * as serial from './serial';

import U = pxt.Util;
import Cloud = pxt.Cloud;

const userProjectsDirName = "projects";

let root = ""
let dirs = [""]
let docfilesdirs = [""]
let userProjectsDir = path.join(process.cwd(), userProjectsDirName);
let docsDir = ""
let packagedDir = ""
let localHexDir = path.join("built", "hexcache");
let electronHandlers: pxt.Map<ElectronHandler> = {};

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
        path.join(nodeutil.targetDir, "built"),
        path.join(nodeutil.targetDir, "sim/public"),
        path.join(nodeutil.pxtCoreDir, "built/web"),
        path.join(nodeutil.pxtCoreDir, "webapp/public")
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
    if (serveOptions && serveOptions.electron) {
        let projectsRootDir = process.cwd();

        if (/^win/.test(os.platform())) {
            // Use registry to query path of My Documents folder
            let regQueryResult = "";

            try {
                let regQueryResult = child_process.execSync("reg query \"HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders\" /v Personal").toString();
                let documentsPath = /personal(?:\s+\w+)\s+(.*)/gmi.exec(regQueryResult)[1];

                if (documentsPath) {
                    projectsRootDir = documentsPath;
                } else {
                    projectsRootDir = os.homedir();
                }
            } catch (e) {
                // Fallback to Home directory
                projectsRootDir = os.homedir();
            }
        } else {
            projectsRootDir = os.homedir();
        }

        userProjectsDir = path.join(projectsRootDir, userProjectsDirName, pxt.appTarget.appTheme.id);
    }

    nodeutil.mkdirP(userProjectsDir);
}

const statAsync = Promise.promisify(fs.stat)
const readdirAsync = Promise.promisify(fs.readdir)
const readFileAsync = Promise.promisify(fs.readFile)
const writeFileAsync: any = Promise.promisify(fs.writeFile)

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

function readPkgAsync(logicalDirname: string, fileContents = false): Promise<FsPkg> {
    let dirname = path.join(userProjectsDir, logicalDirname)
    let r: FsPkg = undefined;
    return readFileAsync(path.join(dirname, pxt.CONFIG_NAME))
        .then(buf => {
            let cfg: pxt.PackageConfig = JSON.parse(buf.toString("utf8"))
            let files = [pxt.CONFIG_NAME].concat(cfg.files || []).concat(cfg.testFiles || [])
            return Promise.map(files, fn =>
                statOptAsync(path.join(dirname, fn))
                    .then<FsFile>(st => {
                        let r: FsFile = {
                            name: fn,
                            mtime: st ? st.mtime.getTime() : null
                        }
                        if (st == null || !fileContents)
                            return r
                        else
                            return readFileAsync(path.join(dirname, fn))
                                .then(buf => {
                                    r.content = buf.toString("utf8")
                                    return r
                                })
                    }))
                .then(files => {
                    r = {
                        path: logicalDirname,
                        config: cfg,
                        files: files
                    };
                    return existsAsync(path.join(dirname, "icon.jpeg"));
                }).then(icon => {
                    r.icon = icon ? "/icon/" + logicalDirname : undefined;
                    return r;
                })
        })
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
        return writeFileAsync(fn, new Buffer(data, 'base64'));
    }

    return Promise.all([
        writeUriAsync("screenshot", screenshotUri),
        writeUriAsync("icon", iconUri)
    ]).then(() => { });
}

function writePkgAsync(logicalDirname: string, data: FsPkg) {
    const dirname = path.join(userProjectsDir, logicalDirname)

    nodeutil.mkdirP(dirname)

    return Promise.map(data.files, f =>
        readFileAsync(path.join(dirname, f.name))
            .then(buf => {
                if (f.name == pxt.CONFIG_NAME) {
                    try {
                        let cfg: pxt.PackageConfig = JSON.parse(f.content)
                        if (!cfg.name) {
                            console.log("Trying to save invalid JSON config")
                            throwError(410)
                        }
                    } catch (e) {
                        console.log("Trying to save invalid format JSON config")
                        throwError(410)
                    }
                }
                if (buf.toString("utf8") !== f.prevContent) {
                    console.log(`merge error for ${f.name}: previous content changed...`);
                    throwError(409)
                }
            }, err => { }))
        // no conflict, proceed with writing
        .then(() => Promise.map(data.files, f =>
            writeFileAsync(path.join(dirname, f.name), f.content)))
        .then(() => readPkgAsync(logicalDirname, false))
}

function returnDirAsync(logicalDirname: string, depth: number): Promise<FsPkg[]> {
    logicalDirname = logicalDirname.replace(/^\//, "")
    let dirname = path.join(userProjectsDir, logicalDirname)
    return existsAsync(path.join(dirname, pxt.CONFIG_NAME))
        .then(ispkg =>
            ispkg ? readPkgAsync(logicalDirname).then(r => [r], err => []) :
                depth <= 1 ? [] :
                    readdirAsync(dirname)
                        .then(files =>
                            Promise.map(files, fn =>
                                statAsync(path.join(dirname, fn))
                                    .then<FsPkg[]>(st => {
                                        if (fn[0] != "." && st.isDirectory())
                                            return returnDirAsync(logicalDirname + "/" + fn, depth - 1)
                                        else return []
                                    })))
                        .then(U.concat))
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

    let hexFile = path.resolve(localHexDir, sha + ".hex");

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

function handleApiAsync(req: http.IncomingMessage, res: http.ServerResponse, elts: string[]): Promise<any> {
    const opts: pxt.Map<string> = querystring.parse(url.parse(req.url).query)
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
    else if (cmd == "POST deploy" && pxt.commands.deployCoreAsync)
        return readJsonAsync()
            .then(pxt.commands.deployCoreAsync)
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
        return Promise.resolve(readMd(innerPath.slice(pxt.appTarget.id.length + 1)))
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

export function expandHtml(html: string) {
    let theme = U.flatClone(pxt.appTarget.appTheme)
    html = expandDocTemplateCore(html)
    let params: pxt.Map<string> = {
        name: pxt.appTarget.appTheme.title,
        description: pxt.appTarget.appTheme.description,
        locale: pxt.appTarget.appTheme.defaultLocale || "en"
    };

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
let electronSocket: WebSocket = null;
let webappReady = false;
let electronPendingMessages: ElectronMessage[] = [];

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
    function startHID(request: any, socket: any, body: any) {
        let ws = new WebSocket(request, socket, body);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: "ready" }))
        })
        ws.on('message', function (event: any) {
            try {
                let msg = JSON.parse(event.data);
                pxt.debug(`hid: msg ${msg.op}`) // , objToString(msg.arg))
                Promise.resolve()
                    .then(() => {
                        let hio = hios[msg.arg.path]
                        if (!hio && msg.arg.path)
                            hios[msg.arg.path] = hio = hid.hf2ConnectAsync(msg.arg.path)
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
                            case "talk":
                                return Promise.mapSeries(msg.arg.cmds, (obj: any) => {
                                    pxt.debug(`hid talk ${obj.cmd}`)
                                    return hio.talkAsync(obj.cmd, U.fromHex(obj.data))
                                        .then(res => ({ data: U.toHex(res) }))
                                });
                            case "sendserial":
                                return hio.sendSerialAsync(U.fromHex(msg.arg.data), msg.arg.isError)
                            case "list":
                                return { devices: hid.getHF2Devices() } as any
                        }
                    })
                    .done(resp => {
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

    function startDebug(request: any, socket: any, body: any) {
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

    function startElectronChannel(request: any, socket: any, body: any) {
        electronSocket = new WebSocket(request, socket, body);
        electronSocket.onmessage = function (event: any) {
            let messageInfo = JSON.parse(event.data) as ElectronMessage;

            if (messageInfo.type === "ready") {
                webappReady = true;
                electronPendingMessages.forEach((m) => {
                    sendElectronMessage(m);
                });
            } else if (electronHandlers[messageInfo.type]) {
                electronHandlers[messageInfo.type](messageInfo.args);
            }
        };
        electronSocket.onclose = function (event: any) {
            console.log('Electron socket connection closed')
            electronSocket = null;
        };
        electronSocket.onerror = function () {
            console.log('Electron socket connection closed')
            electronSocket = null;
        };
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
                else if (request.url == "/" + serveOptions.localToken + "/electron")
                    startElectronChannel(request, socket, body);
                else console.log('refused connection at ' + request.url);
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
    serial.monitorSerial(function (info, buffer) {
        //console.log(`data received: ${buffer.length} bytes`);
        if (wsSerialClients.length == 0) return;
        // send it to ws clients
        let msg = JSON.stringify({
            type: 'serial',
            id: info.pnpId,
            data: buffer.toString('utf8')
        })
        sendSerialMsg(msg)
    })
}

export interface ElectronMessage {
    type: string;
    args?: any
}
export interface ElectronHandler { (args?: any): void }

export interface ServeOptions {
    localToken: string;
    autoStart: boolean;
    packaged?: boolean;
    electron?: boolean;
    browser?: string;
    electronHandlers?: pxt.Map<ElectronHandler>;
    port?: number;
    hostname?: string;
    wsPort?: number;
    serial?: boolean;
}

export function sendElectronMessage(message: ElectronMessage) {
    if (!webappReady) {
        electronPendingMessages.push(message);
        return;
    }

    electronSocket.send(JSON.stringify(message));
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

// use http://localhost:3232/45912-50568-62072-42379 for testing
function scriptPageTestAsync(id: string) {
    return Cloud.privateGetAsync(id)
        .then((info: Cloud.JsonScript) => {
            let html = pxt.docs.renderMarkdown({
                template: expandDocFileTemplate("script.html"),
                markdown: "",
                theme: pxt.appTarget.appTheme,
                pubinfo: info as any,
                filepath: "/" + id
            })
            return html
        })
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

function readMd(pathname: string): string {
    const content = nodeutil.resolveMd(root, pathname);
    if (content) return content;
    return "# Not found\nChecked:\n" + [docsDir].concat(dirs).concat(nodeutil.lastResolveMdDirs).map(s => "* ``" + s + "``\n").join("")
}

let serveOptions: ServeOptions;
export function serveAsync(options: ServeOptions) {
    serveOptions = options;
    if (!serveOptions.port) serveOptions.port = 3232;
    if (!serveOptions.wsPort) serveOptions.wsPort = 3233;
    if (!serveOptions.hostname) serveOptions.hostname = "localhost";
    setupRootDir();
    const wsServerPromise = initSocketServer(serveOptions.wsPort, serveOptions.hostname);
    if (serveOptions.serial)
        initSerialMonitor();
    if (serveOptions.electronHandlers) {
        electronHandlers = serveOptions.electronHandlers;
    }

    const server = http.createServer((req, res) => {
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
            res.end(s)
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

        let pathname = decodeURI(url.parse(req.url).pathname);

        if (pathname == "/") {
            res.writeHead(301, { location: '/index.html' })
            res.end()
            return
        }

        let elts = pathname.split("/").filter(s => !!s)
        if (elts.some(s => s[0] == ".")) {
            return error(400, "Bad path :-(\n")
        }

        if (elts[0] == "api") {
            if (elts[1] == "streams") {
                let trg = Cloud.apiRoot + req.url.slice(5)
                res.setHeader("Location", trg)
                error(302, "Redir: " + trg)
                return
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

        if (pathname == "/--embed") {
            sendFile(path.join(publicDir, 'embed.js'));
            return
        }

        if (pathname == "/--run") {
            sendFile(path.join(publicDir, 'run.html'));
            return
        }

        if (pathname == "/--docs") {
            sendFile(path.join(publicDir, 'docs.html'));
            return
        }

        if (/^\/(\d\d\d\d[\d-]+)$/.test(pathname)) {
            scriptPageTestAsync(pathname.slice(1))
                .then(sendHtml)
            return
        }

        if (/^\/(pkg|package)\/.*$/.test(pathname)) {
            pkgPageTestAsync(pathname.replace(/^\/[^\/]+\//, ""))
                .then(sendHtml)
            return
        }

        if (elts[0] == "streams") {
            streamPageTestAsync(elts[0] + "/" + elts[1])
                .then(sendHtml)
            return
        }

        if (/\.js\.map$/.test(pathname)) {
            error(404, "map files disabled")
        }

        let dd = dirs
        let mm = /^\/(cdn|parts|sim|doccdn|blb)(\/.*)/.exec(pathname)
        if (mm) {
            pathname = mm[2]
        } else if (U.startsWith(pathname, "/docfiles/")) {
            pathname = pathname.slice(10)
            dd = docfilesdirs
        }
        for (let dir of dd) {
            let filename = path.resolve(path.join(dir, pathname))
            if (nodeutil.fileExistsSync(filename)) {
                sendFile(filename)
                return;
            }
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
                let html = expandHtml(fs.readFileSync(webFile, "utf8"))
                sendHtml(html)
            } else {
                sendFile(webFile)
            }
        } else {
            let md = readMd(pathname)
            let html = pxt.docs.renderMarkdown({
                template: expandDocFileTemplate("docs.html"),
                markdown: md,
                theme: pxt.appTarget.appTheme,
                filepath: pathname
            })
            sendHtml(html, U.startsWith(md, "# Not found") ? 404 : 200)
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
