import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';
import * as nodeutil from './nodeutil';

import U = ks.Util;
import Cloud = ks.Cloud;

let root = process.cwd()
let dirs = ["built", "sim/public", "node_modules/kindscript/built/web", "node_modules/kindscript/webapp/public"].map(p => path.join(root, p))
let fileDir = path.join(root, "libs")
let docsDir = path.join(root, "docs")
let tempDir = path.join(root, "built/docstmp")

let statAsync = Promise.promisify(fs.stat)
let readdirAsync = Promise.promisify(fs.readdir)
let readFileAsync = Promise.promisify(fs.readFile)
let writeFileAsync: any = Promise.promisify(fs.writeFile)

// provided by target
let deployCoreAsync: (r: ts.ks.CompileResult) => void = undefined;

function initTargetCommands() {
    let cmdsjs = path.resolve('built/cmds.js');
    if (fs.existsSync(cmdsjs)) {
        console.log(`loading cli extensions...`)
        let cli = require(cmdsjs)
        if (cli.deployCoreAsync) {
            console.log('imported deploy command')
            deployCoreAsync = cli.deployCoreAsync
        }
    }
}

function existsAsync(fn: string) {
    return new Promise((resolve, reject) => {
        fs.exists(fn, resolve)
    })
}

function statOptAsync(fn: string): Promise<fs.Stats> // or null
{
    return statAsync(fn)
        .then(st => st, err => null)
}

function throwError(code: number, msg: string = null) {
    let err = new Error(msg || "Error " + code);
    (err as any).statusCode = code
    throw err
}

type FsFile = ks.FsFile;
type FsPkg = ks.FsPkg;

function readPkgAsync(logicalDirname: string, fileContents = false): Promise<FsPkg> {
    let dirname = path.join(fileDir, logicalDirname)
    return readFileAsync(path.join(dirname, ks.configName))
        .then(buf => {
            let cfg: ks.PackageConfig = JSON.parse(buf.toString("utf8"))
            let files = [ks.configName].concat(cfg.files || []).concat(cfg.testFiles || [])
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
    let dirname = path.join(fileDir, logicalDirname)

    if (!directoryExistsSync(dirname))
        fs.mkdirSync(dirname)

    return Promise.map(data.files, f =>
        readFileAsync(path.join(dirname, f.name))
            .then(buf => {
                if (buf.toString("utf8") !== f.prevContent)
                    throwError(409)
            }, err => { }))
        // no conflict, proceed with writing
        .then(() => Promise.map(data.files, f =>
            writeFileAsync(path.join(dirname, f.name), f.content)))
        .then(() => readPkgAsync(logicalDirname, false))
}

function returnDirAsync(logicalDirname: string, depth: number): Promise<FsPkg[]> {
    logicalDirname = logicalDirname.replace(/^\//, "")
    let dirname = path.join(fileDir, logicalDirname)
    return existsAsync(path.join(dirname, ks.configName))
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

function handleApiAsync(req: http.IncomingMessage, res: http.ServerResponse, elts: string[]): Promise<any> {
    let opts: U.Map<string> = querystring.parse(url.parse(req.url).query)
    let innerPath = elts.slice(2).join("/").replace(/^\//, "")
    let filename = path.resolve(path.join(fileDir, innerPath))
    let meth = req.method.toUpperCase()
    let cmd = meth + " " + elts[1]

    let readJsonAsync = () =>
        nodeutil.readResAsync(req)
            .then(buf => JSON.parse(buf.toString("utf8")))

    if (cmd == "GET list")
        return returnDirAsync(innerPath, 3)
            .then<ks.FsPkgs>(lst => {
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
            .then(d => deployCoreAsync(d));
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

var docsTemplate: string = "@body@"
var appTarget: ks.AppTarget;

function setupTemplate() {
    let templatePath = path.join(tempDir, "template.html")
    if (fs.existsSync(templatePath)) {
        docsTemplate = fs.readFileSync(templatePath, "utf8")
    }

    let url = "https://www.kindscript.com/templates/docs"
    U.requestAsync({ url })
        .then(resp => {
            if (resp.text != docsTemplate) {
                console.log(`${url} updated`)
                docsTemplate = resp.text
                fs.writeFileSync(templatePath, docsTemplate)
            } else {
                console.log(`${url} unchanged`)
            }
        }, err => {
            console.log(`error downloading ${url}: ${err.message}`)
        })
        .done()

    appTarget = nodeutil.getWebTarget()
}

interface SerialPortInfo {
    comName: string;
    pnpId: string;
    manufacturer: string;

    opened?: boolean;
    port?: any;
}

let wsSerialClients: WebSocket[] = [];
let serialPorts: U.Map<SerialPortInfo> = {}

function initSocketServer() {
    console.log('starting local ws server at 3233...')
    const WebSocket = require('faye-websocket');

    function startSerial(request: any, socket: any, body: any) {
        console.log('ws connection at ' + request.url);
        let ws = new WebSocket(request, socket, body);
        wsSerialClients.push(ws);
        ws.on('message', function(event: any) {
            // ignore
        });
        ws.on('close', function(event: any) {
            console.log('ws connection closed')
            wsSerialClients.splice(wsSerialClients.indexOf(ws), 1)
            ws = null;
        });
        ws.on('error', function() {
            console.log('ws connection closed')
            wsSerialClients.splice(wsSerialClients.indexOf(ws), 1)
            ws = null;
        })
    }

    let wsserver = http.createServer();
    wsserver.on('upgrade', function(request: any, socket: any, body: any) {
        if (WebSocket.isWebSocket(request)) {
            if (/^\/serial/i.test(request.url))
                startSerial(request, socket, body);
        }
    });

    wsserver.listen(3233, "127.0.0.1");
}

function initSerialMonitor() {
    if (!appTarget.serial || !appTarget.serial.log) return;
    
    console.log('serial: monitoring ports...')
    initSocketServer();    
    
    const serialport = require("serialport");

    function close(info: SerialPortInfo) {
        console.log('serial: closing ' + info.pnpId);
        delete serialPorts[info.pnpId];
    }

    function open(info: SerialPortInfo) {
        console.log(`serial: connecting to ${info.comName} by ${info.manufacturer} (${info.pnpId})`);
        serialPorts[info.pnpId] = info;
        info.port = new serialport.SerialPort(info.comName, {
            baudrate: 115200
        }, false); // this is the openImmediately flag [default is true]
        info.port.open(function(error: any) {
            if (error) {
                console.log('failed to open: ' + error);
                close(info);
            } else {
                console.log(`serial: connected to ${info.comName} by ${info.manufacturer} (${info.pnpId})`);
                info.opened = true;
                info.port.on('data', function(buffer: Buffer) {
                    //console.log(`data received: ${buffer.length} bytes`);
                    if (wsSerialClients.length == 0) return;
                    // send it to ws clients
                    let msg = JSON.stringify({
                        type:'serial',
                        id: info.pnpId,
                        data: buffer.toString('utf8')
                    })
                    //console.log('sending ' + msg);
                    wsSerialClients.forEach(function(client: any) {
                        client.send(msg);
                    })
                });
                info.port.on('error', function() { close(info); });
                info.port.on('close', function() { close(info); });
            }
        });
    }

    let comNameRx = appTarget.serial.comNameFilter ? new RegExp(appTarget.serial.comNameFilter) : undefined;    
    let manufacturerRx = appTarget.serial.manufacturerFilter ? new RegExp(appTarget.serial.manufacturerFilter) : undefined;    
    function filterPort(info: SerialPortInfo) : boolean {
        return (comNameRx ? comNameRx.test(info.comName) : true)
            && (manufacturerRx ? manufacturerRx.test(info.manufacturer): true);
    }

    setInterval(() => {
        serialport.list(function(err: any, ports: SerialPortInfo[]) {
            ports.filter(filterPort)
                .filter(info => !serialPorts[info.pnpId])                
                .forEach((info) => open(info));
        });
    }, 2500);
}

export function serveAsync() {
    if (!fs.existsSync(tempDir))
        fs.mkdirSync(tempDir)

    setupTemplate()
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
            let stat = fs.statSync(filename);

            res.writeHead(200, {
                'Content-Type': U.getMime(filename),
                'Content-Length': stat.size
            });

            fs.createReadStream(filename).pipe(res);
        }

        let pathname = decodeURI(url.parse(req.url).pathname);

        if (pathname == "/") {
            res.writeHead(301, { location: '/index.html' })
            res.end()
            return
        }

        if (pathname.slice(0, appTarget.id.length + 2) == "/" + appTarget.id + "/") {
            res.writeHead(301, { location: req.url.slice(appTarget.id.length + 1) })
            res.end()
            return
        }

        let elts = pathname.split("/").filter(s => !!s)
        if (elts.some(s => s[0] == ".")) {
            return error(400, "Bad path :-(\n")
        }

        if (elts[0] == "api") {
            return handleApiAsync(req, res, elts)
                .then(sendJson, err => {
                    if (err.statusCode) {
                        error(err.statusCode)
                        console.log("Error " + err.statusCode)
                    }
                    else {
                        error(500)
                        console.log(err.stack)
                    }
                })
        }

        if (pathname == "/--embed") {
            // use microbit for now
            res.writeHead(302, { location: 'https://codemicrobit.com/--embed' })
            res.end()
            return
        }

        if (!/\.js\.map$/.test(pathname)) {
            for (let dir of dirs) {
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
                let html = ks.docs.renderMarkdown(docsTemplate, fs.readFileSync(webFile, "utf8"))
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

    console.log("Serving from http://127.0.0.1:3232/");

    return new Promise<void>((resolve, reject) => { })
}
