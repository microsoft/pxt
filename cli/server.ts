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
let tempDir = ""
let packagedDir = ""

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
    docfilesdirs = ["docfiles", path.join(nodeutil.pxtCoreDir, "docfiles"), path.join(nodeutil.pxtCoreDir, "docfiles")]
    console.log('docfilesdir: ', docfilesdirs.join(', '))
}

function setupRootDir() {
    root = nodeutil.targetDir
    console.log("Starting server in", root)
    console.log(`With pxt core at ${nodeutil.pxtCoreDir}`)
    dirs = [path.join(nodeutil.pxtCoreDir, "built/web"), path.join(nodeutil.pxtCoreDir, "webapp/public")]
    simdirs = [path.join(nodeutil.targetDir, "built"), path.join(nodeutil.targetDir, "sim/public")]
    docsDir = path.join(root, "docs")
    tempDir = path.join(root, "built/docstmp")
    packagedDir = path.join(root, "built/packaged")
    setupDocfilesdirs()
    setupProjectsDir()
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

let statAsync = Promise.promisify(fs.stat)
let readdirAsync = Promise.promisify(fs.readdir)
let readFileAsync = Promise.promisify(fs.readFile)
let writeFileAsync: any = Promise.promisify(fs.writeFile)

// provided by target
let deployCoreAsync: (r: pxtc.CompileResult) => void = undefined;

function initTargetCommands() {
    let cmdsjs = path.resolve('built/cmds.js');
    if (fs.existsSync(cmdsjs)) {
        pxt.debug(`loading cli extensions...`)
        let cli = require(cmdsjs)
        if (cli.deployCoreAsync) {
            pxt.debug('imported deploy command')
            deployCoreAsync = cli.deployCoreAsync
        }
    }
}

function existsAsync(fn: string) {
    return new Promise((resolve, reject) => {
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
                    return {
                        path: logicalDirname,
                        config: cfg,
                        files: files
                    }
                })
        })
}

function writePkgAsync(logicalDirname: string, data: FsPkg) {
    let dirname = path.join(userProjectsDir, logicalDirname)

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

function handleApiAsync(req: http.IncomingMessage, res: http.ServerResponse, elts: string[]): Promise<any> {
    let opts: pxt.Map<string> = querystring.parse(url.parse(req.url).query)
    let innerPath = elts.slice(2).join("/").replace(/^\//, "")
    let filename = path.resolve(path.join(userProjectsDir, innerPath))
    let meth = req.method.toUpperCase()
    let cmd = meth + " " + elts[1]

    let readJsonAsync = () =>
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
    else if (cmd == "POST deploy" && deployCoreAsync)
        return readJsonAsync()
            .then(d => deployCoreAsync(d))
            .catch((e) => {
                throwError(404, "Board not found");
            });
    else throw throwError(400)
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
    let params: pxt.Map<string> = {}
    let m = /<title>([^<>]*)<\/title>/.exec(html)
    if (m) params["name"] = m[1]
    m = /<meta name="Description" content="([^"]*)"/.exec(html)
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
let serialPorts: pxt.Map<SerialPortInfo> = {}

function initSocketServer() {
    console.log('starting local ws server at 3233...')
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

    let wsserver = http.createServer();
    wsserver.on('upgrade', function (request: http.IncomingMessage, socket: WebSocket, body: any) {
        try {
            if (WebSocket.isWebSocket(request)) {
                console.log('ws connection at ' + request.url);
                if (request.url == "/" + serveOptions.localToken + "/serial")
                    startSerial(request, socket, body);
                else if (request.url == "/" + serveOptions.localToken + "/debug")
                    startDebug(request, socket, body);
                else console.log('refused connection at ' + request.url);
            }
        } catch (e) {
            console.log('upgrade failed...')
        }
    });

    wsserver.listen(3233, "127.0.0.1");
}

function initSerialMonitor() {
    if (!pxt.appTarget.serial || !pxt.appTarget.serial.log) return;

    console.log('serial: monitoring ports...')
    initSocketServer();

    const SerialPort = require("serialport");

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

function openUrl(startUrl: string) {
    if (!/^[a-z0-9A-Z#=\.\-\\\/%:\?_]+$/.test(startUrl)) {
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

    let cmd = cmds[process.platform];
    console.log(`opening ${startUrl}`)
    child_process.exec(`${cmd} ${startUrl}`);
}

export interface ServeOptions {
    localToken: string;
    autoStart: boolean;
    packaged?: boolean;
    electron?: boolean;
}

let serveOptions: ServeOptions;
export function serveAsync(options: ServeOptions) {
    serveOptions = options;

    setupRootDir();

    nodeutil.mkdirP(tempDir)

    initTargetCommands()
    initSerialMonitor();

    let server = http.createServer((req, res) => {
        let error = (code: number, msg: string = null) => {
            res.writeHead(code, { "Content-Type": "text/plain" })
            res.end(msg || "Error " + code)
        }

        let sendJson = (v: any) => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf8' })
            res.end(JSON.stringify(v))
        }

        let sendHtml = (s: string) => {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf8' })
            res.end(s)
        }

        let sendFile = (filename: string) => {
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

        if (!/\.js\.map$/.test(pathname)) {
            let dd = dirs
            if (U.startsWith(pathname, "/sim/")) {
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
    let serverjs = path.resolve(path.join(root, 'server.js'))
    if (fileExistsSync(serverjs)) {
        console.log('loading ' + serverjs)
        require(serverjs);
    }

    server.listen(3232, "127.0.0.1");

    let start = `http://localhost:3232/#local_token=${options.localToken}`;
    console.log(`---------------------------------------------`);
    console.log(``);
    console.log(`To launch the editor, open this URL:`);
    console.log(start);
    console.log(``);
    console.log(`---------------------------------------------`);
    if (options.autoStart)
        openUrl(start);

    return new Promise<void>((resolve, reject) => { })
}
