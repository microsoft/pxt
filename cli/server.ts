/// <reference path="../typings/node/node.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';
import * as nodeutil from './nodeutil';
import * as child_process from 'child_process';
import * as os from 'os';
import * as util from 'util';

import U = pxt.Util;
import Cloud = pxt.Cloud;

const userProjectsDirName = "projects";

let root = ""
let dirs = [""]
let simdirs = [""]
let docfilesdirs = [""]
let userProjectsDir = path.join(process.cwd(), userProjectsDirName);
let docsDir = ""
let packagedDir = ""
let localHexDir = path.join("built", "hexcache");
let electronHandlers: pxt.Map<ElectronHandler> = {};

export function forkPref() {
    if (pxt.appTarget.forkof)
        return "node_modules/pxt-" + pxt.appTarget.forkof + "/"
    else
        return ""
}
function forkDirs(lst: string[]) {
    if (pxt.appTarget.id == "core") {
        lst = lst.map(s => s.replace(/node_modules\/pxt-core\//, ""))
    }
    let res = lst.map(p => path.join(root, p))
    let fp = forkPref()
    if (fp) {
        U.pushRange(res, lst.map(p => path.join(root, fp + p)))
    }
    return res
}

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
        path.join(nodeutil.pxtCoreDir, "built/web"),
        path.join(nodeutil.pxtCoreDir, "webapp/public")
    ]
    simdirs = [path.join(nodeutil.targetDir, "built"), path.join(nodeutil.targetDir, "sim/public")]
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
        const fmd = path.join(docsDir, innerPath.slice(pxt.appTarget.id.length + 1) + ".md");
        return existsAsync(fmd)
            .then(e => {
                if (!e) throw throwError(404);
                return readFileAsync(fmd).then(buffer => buffer.toString("utf8"));
            });
    }
    else throw throwError(400, `unknown command ${cmd.slice(0, 140)}`)
}

function directoryExistsSync(p: string): boolean {
    try {
        let stats = fs.lstatSync(p);
        return stats && stats.isDirectory();
    }
    catch (e) {
        return false;
    }
}

function fileExistsSync(p: string): boolean {
    try {
        let stats = fs.lstatSync(p);
        return stats && stats.isFile();
    }
    catch (e) {
        return false;
    }
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

interface SerialPortInfo {
    comName: string;
    pnpId: string;
    manufacturer: string;

    opened?: boolean;
    port?: any;
}

let wsSerialClients: WebSocket[] = [];
let serialPorts: pxt.Map<SerialPortInfo> = {};
let electronSocket: WebSocket = null;
let webappReady = false;
let electronPendingMessages: ElectronMessage[] = [];

function initSocketServer(wsPort: number) {
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
        wsserver.listen(wsPort, "127.0.0.1", () => resolve());
    });
}

function initSerialMonitor() {
    if (!pxt.appTarget.serial || !pxt.appTarget.serial.log) return;

    console.log('serial: monitoring ports...')

    let SerialPort: any;
    try {
        SerialPort = require("serialport");
    } catch (er) {
        console.warn('serial: failed to load, skipping...');
        return;
    }

    function close(info: SerialPortInfo) {
        console.log('serial: closing ' + info.pnpId);
        delete serialPorts[info.pnpId];
    }

    function open(info: SerialPortInfo) {
        console.log(`serial: connecting to ${info.comName} by ${info.manufacturer} (${info.pnpId})`);
        serialPorts[info.pnpId] = info;
        info.port = new SerialPort(info.comName, {
            baudrate: 115200,
            autoOpen: false
        }); // this is the openImmediately flag [default is true]
        info.port.open(function (error: any) {
            if (error) {
                console.log('failed to open: ' + error);
                close(info);
            } else {
                console.log(`serial: connected to ${info.comName} by ${info.manufacturer} (${info.pnpId})`);
                info.opened = true;
                info.port.on('data', function (buffer: Buffer) {
                    //console.log(`data received: ${buffer.length} bytes`);
                    if (wsSerialClients.length == 0) return;
                    // send it to ws clients
                    let msg = JSON.stringify({
                        type: 'serial',
                        id: info.pnpId,
                        data: buffer.toString('utf8')
                    })
                    //console.log('sending ' + msg);
                    wsSerialClients.forEach(function (client: any) {
                        client.send(msg);
                    })
                });
                info.port.on('error', function () { close(info); });
                info.port.on('close', function () { close(info); });
            }
        });
    }

    let manufacturerRx = pxt.appTarget.serial.manufacturerFilter ? new RegExp(pxt.appTarget.serial.manufacturerFilter, "i") : undefined;
    function filterPort(info: SerialPortInfo): boolean {
        return manufacturerRx ? manufacturerRx.test(info.manufacturer) : true;
    }

    setInterval(() => {
        SerialPort.list(function (err: any, ports: SerialPortInfo[]) {
            ports.filter(filterPort)
                .filter(info => !serialPorts[info.pnpId])
                .forEach((info) => open(info));
        });
    }, 5000);
}

function openUrl(startUrl: string, browser: string) {
    if (!/^[a-z0-9A-Z#=\.\-\\\/%:\?_&]+$/.test(startUrl)) {
        console.error("invalid URL to open: " + startUrl)
        return
    }
    let cmds: pxt.Map<string> = {
        darwin: "open",
        win32: "start",
        linux: "xdg-open"
    }
    if (/^win/.test(os.platform()) && !/^[a-z0-9]+:\/\//i.test(startUrl))
        startUrl = startUrl.replace('/', '\\');
    else
        startUrl = startUrl.replace('\\', '/');

    console.log(`opening ${startUrl}`)

    if (browser) {
        child_process.spawn(getBrowserLocation(browser), [startUrl]);
    }
    else {
        child_process.exec(`${cmds[process.platform]} ${startUrl}`);
    }
}

function getBrowserLocation(browser: string) {
    let browserPath: string;

    const normalizedBrowser = browser.toLowerCase();

    if (normalizedBrowser === "chrome") {
        switch (os.platform()) {
            case "win32":
            case "win64":
                browserPath = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
                break;
            case "darwin":
                browserPath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
                break;
            case "linux":
                browserPath = "/opt/google/chrome/chrome";
                break;
            default:
                break;
        }
    }
    else if (normalizedBrowser === "firefox") {
        browserPath = "C:/Program Files (x86)/Mozilla Firefox/firefox.exe";
        switch (os.platform()) {
            case "win32":
            case "win64":
                browserPath = "C:/Program Files (x86)/Mozilla Firefox/firefox.exe";
                break;
            case "darwin":
                browserPath = "/Applications/Firefox.app";
                break;
            case "linux":
            default:
                break;
        }
    }
    else if (normalizedBrowser === "ie") {
        browserPath = "C:/Program Files/Internet Explorer/iexplore.exe";
    }
    else if (normalizedBrowser === "safari") {
        browserPath = "/Applications/Safari.app/Contents/MacOS/Safari";
    }

    if (browserPath && fs.existsSync(browserPath)) {
        return browserPath;
    }

    return browser;
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

let serveOptions: ServeOptions;
export function serveAsync(options: ServeOptions) {
    serveOptions = options;
    if (!serveOptions.port) serveOptions.port = 3232;
    if (!serveOptions.wsPort) serveOptions.wsPort = 3233;
    setupRootDir();
    const wsServerPromise = initSocketServer(serveOptions.wsPort);
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
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf8' })
            res.end(JSON.stringify(v))
        }

        const sendHtml = (s: string) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf8' })
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
            if (fileExistsSync(filename)) {
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

        if (!/\.js\.map$/.test(pathname) || pathname == "/cdn/target.js") {
            let dd = dirs
            if (pathname == "/cdn/target.js") {
                pathname = pathname.slice(4)
                dd = simdirs
            } else if (U.startsWith(pathname, "/sim/")) {
                pathname = pathname.slice(4)
                dd = simdirs
            } else if (U.startsWith(pathname, "/parts/")) {
                dd = simdirs
            } else if (U.startsWith(pathname, "/cdn/")) {
                pathname = pathname.slice(4)
                dd = dirs
            } else if (U.startsWith(pathname, "/doccdn/")) {
                pathname = pathname.slice(7)
                dd = dirs
            } else if (U.startsWith(pathname, "/docfiles/")) {
                pathname = pathname.slice(10)
                dd = docfilesdirs
            }
            for (let dir of dd) {
                let filename = path.resolve(path.join(dir, pathname))
                if (fileExistsSync(filename)) {
                    sendFile(filename)
                    return;
                }
            }
        }

        let webFile = path.join(docsDir, pathname)
        if (!fileExistsSync(webFile)) {
            if (fileExistsSync(webFile + ".html")) {
                webFile += ".html"
                pathname += ".html"
            } else if (fileExistsSync(webFile + ".md")) {
                webFile += ".md"
                pathname += ".md"
            }
        }

        if (fileExistsSync(webFile)) {
            if (/\.md$/.test(webFile)) {
                let bc = elts.map((e, i) => {
                    return {
                        href: "/" + elts.slice(0, i + 1).join("/"),
                        name: e
                    }
                })
                let templ = expandDocFileTemplate("docs.html")
                let html = pxt.docs.renderMarkdown(templ, fs.readFileSync(webFile, "utf8"), pxt.appTarget.appTheme, null, bc, pathname)
                sendHtml(html)
            } else if (/\.html$/.test(webFile)) {
                let html = expandHtml(fs.readFileSync(webFile, "utf8"))
                sendHtml(html)
            } else {
                sendFile(webFile)
            }
            return
        }

        return error(404, "Not found :(\n")
    });

    // if user has a server.js file, require it
    const serverjs = path.resolve(path.join(root, 'built', 'server.js'))
    if (fileExistsSync(serverjs)) {
        console.log('loading ' + serverjs)
        require(serverjs);
    }

    const serverPromise = new Promise<void>((resolve, reject) => {
        server.on("error", reject);
        server.listen(serveOptions.port, "127.0.0.1", () => resolve());
    });

    return Promise.all([wsServerPromise, serverPromise])
        .then(() => {
            let start = `http://localhost:${serveOptions.port}/#ws=${serveOptions.wsPort}&local_token=${options.localToken}`;
            console.log(`---------------------------------------------`);
            console.log(``);
            console.log(`To launch the editor, open this URL:`);
            console.log(start);
            console.log(``);
            console.log(`---------------------------------------------`);

            if (options.autoStart) {
                openUrl(start, options.browser);
            }
        });
}
