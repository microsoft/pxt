import * as child_process from 'child_process';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as url from 'url';
import * as http from 'http';
import * as https from 'https';
import * as events from 'events';
import * as crypto from 'crypto';
import * as path from 'path';

Promise = require("bluebird");

import Util = pxt.Util;

export interface SpawnOptions {
    cmd: string;
    args: string[];
    cwd?: string;
    shell?: boolean;
    pipe?: boolean;
}

//This should be correct at startup when running from command line
//When running inside Electron it gets updated to the correct path
export var targetDir: string = process.cwd();
//When running the Electron app, this will be updated based on targetDir
export var pxtCoreDir: string = path.join(__dirname, "..");

export function setTargetDir(dir: string) {
    targetDir = dir;

    // The target should expose the path to its bundled pxt-core
    let fallback = false;
    let target: any;

    try {
        target = require(targetDir);
    }
    catch (e) {
        // If we can't require the target, fallback to default location
        fallback = true;
    }

    if (fallback || !target.pxtCoreDir || !fs.existsSync(target.pxtCoreDir)) {
        pxtCoreDir = path.join(__dirname, "..");

        if (pxtCoreDir !== targetDir) {
            pxt.log("Could not determine target's pxt-core location, falling back to default: " + pxtCoreDir);
        }
    } else {
        pxtCoreDir = target.pxtCoreDir;
    }
}

export function readResAsync(g: events.EventEmitter) {
    return new Promise<Buffer>((resolve, reject) => {
        let bufs: Buffer[] = []
        g.on('data', (c: any) => {
            if (typeof c === "string")
                bufs.push(new Buffer(c, "utf8"))
            else
                bufs.push(c)
        });

        g.on("error", (err: any) => reject(err))

        g.on('end', () => resolve(Buffer.concat(bufs)))
    })
}

export function spawnAsync(opts: SpawnOptions) {
    opts.pipe = false
    return spawnWithPipeAsync(opts)
        .then(() => { })
}

export function spawnWithPipeAsync(opts: SpawnOptions, silent: boolean = false) {
    if (opts.pipe === undefined) opts.pipe = true
    let info = opts.cmd + " " + opts.args.join(" ")
    if (opts.cwd && opts.cwd != ".") info = "cd " + opts.cwd + "; " + info
    console.log("[run] " + info)
    return new Promise<Buffer>((resolve, reject) => {
        let ch = child_process.spawn(opts.cmd, opts.args, {
            cwd: opts.cwd,
            env: process.env,
            stdio: opts.pipe ? [process.stdin, "pipe", process.stderr] : "inherit",
            shell: opts.shell || false
        } as any)
        let bufs: Buffer[] = []
        if (opts.pipe)
            ch.stdout.on('data', (buf: Buffer) => {
                bufs.push(buf)
                if (!silent) {
                    process.stdout.write(buf)
                }
            })
        ch.on('close', (code: number) => {
            if (code != 0)
                reject(new Error("Exit code: " + code + " from " + info))
            resolve(Buffer.concat(bufs))
        });
    })
}

export function addCmd(name: string) {
    return name + (/^win/.test(process.platform) ? ".cmd" : "")
}

export function runNpmAsync(...args: string[]) {
    return runNpmAsyncWithCwd(".", ...args);
}

export function runNpmAsyncWithCwd(cwd: string, ...args: string[]) {
    console.log("npm", args);
    return spawnAsync({
        cmd: addCmd("npm"),
        args: args,
        cwd
    });
}

export function runGitAsync(...args: string[]) {
    return spawnAsync({
        cmd: "git",
        args: args,
        cwd: "."
    })
}

export function gitInfoAsync(args: string[], cwd?: string, silent: boolean = false) {
    return Promise.resolve()
        .then(() => spawnWithPipeAsync({
            cmd: "git",
            args: args,
            cwd
        }, silent))
        .then(buf => buf.toString("utf8").trim())
}

export function currGitTagAsync() {
    return gitInfoAsync(["describe", "--tags", "--exact-match"])
        .then(t => {
            if (!t)
                Util.userError("no git tag found")
            return t
        })
}

export function needsGitCleanAsync() {
    return Promise.resolve()
        .then(() => spawnWithPipeAsync({
            cmd: "git",
            args: ["status", "--porcelain", "--untracked-files=no"]
        }))
        .then(buf => {
            if (buf.length)
                Util.userError("Please commit all files to git before running 'pxt bump'")
        })
}

function nodeHttpRequestAsync(options: Util.HttpRequestOptions): Promise<Util.HttpResponse> {
    let isHttps = false

    let u = <http.RequestOptions><any>url.parse(options.url)

    if (u.protocol == "https:") isHttps = true
    else if (u.protocol == "http:") isHttps = false
    else return Promise.reject("bad protocol: " + u.protocol)

    u.headers = Util.clone(options.headers) || {}
    let data = options.data
    u.method = options.method || (data == null ? "GET" : "POST");

    let mod = isHttps ? https : http;

    let buf: Buffer = null;

    u.headers["accept-encoding"] = "gzip"
    u.headers["user-agent"] = "PXT-CLI"

    let gzipContent = false

    if (data != null) {
        if (Buffer.isBuffer(data)) {
            buf = data;
        } else if (typeof data == "object") {
            buf = new Buffer(JSON.stringify(data), "utf8")
            u.headers["content-type"] = "application/json; charset=utf8"
            if (options.allowGzipPost) gzipContent = true
        } else if (typeof data == "string") {
            buf = new Buffer(data, "utf8")
            if (options.allowGzipPost) gzipContent = true
        } else {
            Util.oops("bad data")
        }
    }

    if (gzipContent) {
        buf = zlib.gzipSync(buf)
        u.headers['content-encoding'] = "gzip"
    }

    if (buf)
        u.headers['content-length'] = buf.length

    return new Promise<Util.HttpResponse>((resolve, reject) => {
        let req = mod.request(u, res => {
            let g: events.EventEmitter = res;
            if (/gzip/.test(res.headers['content-encoding'])) {
                let tmp = zlib.createUnzip();
                res.pipe(tmp);
                g = tmp;
            }

            resolve(readResAsync(g).then(buf => {
                let text: string = null
                try {
                    text = buf.toString("utf8")
                } catch (e) {
                }
                let resp: Util.HttpResponse = {
                    statusCode: res.statusCode,
                    headers: res.headers,
                    buffer: buf,
                    text: text
                }
                return resp;
            }))
        })
        req.on('error', (err: any) => reject(err))
        req.end(buf)
    })
}

function sha256(hashData: string): string {
    let sha: string;
    let hash = crypto.createHash("sha256");
    hash.update(hashData, "utf8");
    sha = hash.digest().toString("hex").toLowerCase();
    return sha;
}


function init() {
    // no, please, I want to handle my errors myself
    let async = (<any>Promise)._async
    async.fatalError = (e: any) => async.throwLater(e);

    Util.isNodeJS = true;
    Util.httpRequestCoreAsync = nodeHttpRequestAsync;
    Util.sha256 = sha256;
    Util.getRandomBuf = buf => {
        let tmp = crypto.randomBytes(buf.length)
        for (let i = 0; i < buf.length; ++i)
            buf[i] = tmp[i]
    }

    (global as any).btoa = (str: string) => new Buffer(str, "binary").toString("base64");
    (global as any).atob = (str: string) => new Buffer(str, "base64").toString("binary");
}

export function sanitizePath(path: string) {
    return path.replace(/[^\w@\/]/g, "-").replace(/^\/+/, "")
}

export function readJson(fn: string) {
    return JSON.parse(fs.readFileSync(fn, "utf8"))
}

export function getPxtTarget(): pxt.TargetBundle {
    if (fs.existsSync(targetDir + "/built/target.json")) {
        let res: pxt.TargetBundle = readJson(targetDir + "/built/target.json")
        if (res.id && res.bundledpkgs) return res;
    }
    let raw: pxt.TargetBundle = readJson(targetDir + "/pxtarget.json")
    raw.bundledpkgs = {}
    return raw
}

export function pathToPtr(path: string) {
    return "ptr-" + sanitizePath(path.replace(/^ptr-/, "")).replace(/[^\w@]/g, "-")
}

export function mkdirP(thePath: string) {
    if (thePath == ".") return;
    if (!fs.existsSync(thePath)) {
        mkdirP(path.dirname(thePath))
        fs.mkdirSync(thePath)
    }
}

export function cpR(src: string, dst: string, maxDepth = 8) {
    src = path.resolve(src)
    let files = allFiles(src, maxDepth)
    let dirs: pxt.Map<boolean> = {}
    for (let f of files) {
        let bn = f.slice(src.length)
        let dd = path.join(dst, bn)
        let dir = path.dirname(dd)
        if (!Util.lookup(dirs, dir)) {
            mkdirP(dir)
            dirs[dir] = true
        }
        let buf = fs.readFileSync(f)
        fs.writeFileSync(dd, buf)
    }
}

export function allFiles(top: string, maxDepth = 8, allowMissing = false, includeDirs = false): string[] {
    let res: string[] = []
    if (allowMissing && !fs.existsSync(top)) return res
    for (const p of fs.readdirSync(top)) {
        if (p[0] == ".") continue;
        const inner = path.join(top, p)
        const st = fs.statSync(inner)
        if (st.isDirectory()) {
            if (maxDepth > 1)
                Util.pushRange(res, allFiles(inner, maxDepth - 1))
            if (includeDirs)
                res.push(inner);
        } else {
            res.push(inner)
        }
    }
    return res
}

export function existDirSync(name: string): boolean {
    return fs.existsSync(name) && fs.statSync(name).isDirectory();
}

init();