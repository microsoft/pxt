import * as child_process from 'child_process';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as url from 'url';
import * as http from 'http';
import * as https from 'https';
import * as events from 'events';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';

Promise = require("bluebird");

import Util = pxt.Util;

export interface SpawnOptions {
    cmd: string;
    args: string[];
    cwd?: string;
    shell?: boolean;
    pipe?: boolean;
    input?: string;
    silent?: boolean;
    envOverrides?: pxt.Map<string>;
    allowNonZeroExit?: boolean;
}

//This should be correct at startup when running from command line
export let targetDir: string = process.cwd();
export let pxtCoreDir: string = path.join(__dirname, "..");

export let cliFinalizers: (() => Promise<void>)[] = [];

export function addCliFinalizer(f: () => Promise<void>) {
    cliFinalizers.push(f)
}

export function runCliFinalizersAsync() {
    let fins = cliFinalizers
    cliFinalizers = []
    return Promise.mapSeries(fins, f => f())
        .then(() => { })
}

export function setTargetDir(dir: string) {
    targetDir = dir;
    (<any>module).paths.push(path.join(targetDir, "node_modules"));
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

export function spawnWithPipeAsync(opts: SpawnOptions) {
    if (opts.pipe === undefined) opts.pipe = true
    let info = opts.cmd + " " + opts.args.join(" ")
    if (opts.cwd && opts.cwd != ".") info = "cd " + opts.cwd + "; " + info
    console.log("[run] " + info)
    return new Promise<Buffer>((resolve, reject) => {
        let ch = child_process.spawn(opts.cmd, opts.args, {
            cwd: opts.cwd,
            env: opts.envOverrides ? extendEnv(process.env, opts.envOverrides) : process.env,
            stdio: opts.pipe ? [opts.input == null ? process.stdin : "pipe", "pipe", process.stderr] : "inherit",
            shell: opts.shell || false
        } as any)
        let bufs: Buffer[] = []
        if (opts.pipe)
            ch.stdout.on('data', (buf: Buffer) => {
                bufs.push(buf)
                if (!opts.silent) {
                    process.stdout.write(buf)
                }
            })
        ch.on('close', (code: number) => {
            if (code != 0 && !opts.allowNonZeroExit)
                reject(new Error("Exit code: " + code + " from " + info))
            resolve(Buffer.concat(bufs))
        });
        if (opts.input != null)
            ch.stdin.end(opts.input, "utf8")
    })
}

function extendEnv(base: any, overrides: any) {
    let res: any = {};
    Object.keys(base).forEach(key => res[key] = base[key])
    Object.keys(overrides).forEach(key => res[key] = overrides[key])
    return res;
}

export function addCmd(name: string) {
    return name + (/^win/.test(process.platform) ? ".cmd" : "")
}

export function runNpmAsync(...args: string[]) {
    return runNpmAsyncWithCwd(".", ...args);
}

export interface NpmRegistry {
    _id: string;
    _name: string;
    "dist-tags": pxt.Map<string>;
    "versions": pxt.Map<any>;
}

export function npmRegistryAsync(pkg: string): Promise<NpmRegistry> {
    // TODO: use token if available
    return Util.httpGetJsonAsync(`https://registry.npmjs.org/${pkg}`);
}

export function runNpmAsyncWithCwd(cwd: string, ...args: string[]) {
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
            cwd,
            silent
        }))
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
    /* tslint:disable:no-http-string */
    else if (u.protocol == "http:") isHttps = false
    /* tslint:enable:no-http-string */
    else return Promise.reject("bad protocol: " + u.protocol)

    u.headers = Util.clone(options.headers) || {}
    let data = options.data
    u.method = options.method || (data == null ? "GET" : "POST");

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
        const handleResponse = (res: http.IncomingMessage) => {
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
        };

        const req = isHttps ? https.request(u, handleResponse) : http.request(u, handleResponse);
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

export function readPkgConfig(dir: string) {
    pxt.debug("readPkgConfig in " + dir)
    const fn = path.join(dir, pxt.CONFIG_NAME)
    const js: pxt.PackageConfig = readJson(fn)

    const ap = js.additionalFilePath
    if (ap) {
        const adddir = path.join(dir, ap)
        pxt.debug("additional pxt.json: " + adddir)
        const js2 = readPkgConfig(adddir)
        for (let k of Object.keys(js2)) {
            if (!js.hasOwnProperty(k)) {
                (js as any)[k] = (js2 as any)[k]
            }
        }
        js.additionalFilePaths = [ap].concat(js2.additionalFilePaths.map(d => path.join(ap, d)))
    } else {
        js.additionalFilePaths = []
    }
    // don't inject version number
    // as they get serialized later on
    // if (!js.targetVersions) js.targetVersions = pxt.appTarget.versions;
    return js
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
    if (thePath == "." || !thePath) return;
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

export function cp(srcFile: string, destDirectory: string) {
    mkdirP(destDirectory);
    let dest = path.resolve(destDirectory, path.basename(srcFile));
    let buf = fs.readFileSync(path.resolve(srcFile));
    fs.writeFileSync(dest, buf);
}

export function allFiles(top: string, maxDepth = 8, allowMissing = false, includeDirs = false): string[] {
    let res: string[] = []
    if (allowMissing && !existsDirSync(top)) return res
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

export function existsDirSync(name: string): boolean {
    try {
        const stats = fs.lstatSync(name);
        return stats && stats.isDirectory();
    }
    catch (e) {
        return false;
    }
}

export function writeFileSync(p: string, data: any, options?: { encoding?: string | null; mode?: number | string; flag?: string; } | string | null) {
    mkdirP(path.dirname(p));
    fs.writeFileSync(p, data, options);
    if (pxt.options.debug) {
        const stats = fs.statSync(p);
        pxt.log(`  + ${p} ${stats.size > 1000000 ? (stats.size / 1000000).toFixed(2) + ' m' : stats.size > 1000 ? (stats.size / 1000).toFixed(2) + 'k' : stats.size}b`)
    }
}

export function openUrl(startUrl: string, browser: string) {
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
        child_process.spawn(getBrowserLocation(browser), [startUrl], { detached: true });
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

export function fileExistsSync(p: string): boolean {
    try {
        let stats = fs.lstatSync(p);
        return stats && stats.isFile();
    }
    catch (e) {
        return false;
    }
}

export let lastResolveMdDirs: string[] = []

// returns undefined if not found
export function resolveMd(root: string, pathname: string): string {

    const docs = path.join(root, "docs");

    let tryRead = (fn: string) => {
        if (fileExistsSync(fn + ".md"))
            return fs.readFileSync(fn + ".md", "utf8")
        if (fileExistsSync(fn + "/index.md"))
            return fs.readFileSync(fn + "/index.md", "utf8")
        return null
    }

    let targetMd = tryRead(path.join(docs, pathname))
    if (targetMd && !/^\s*#+\s+@extends/m.test(targetMd))
        return targetMd

    let dirs = [
        path.join(root, "/node_modules/pxt-core/common-docs"),
    ]
    lastResolveMdDirs = dirs
    for (let pkg of pxt.appTarget.bundleddirs) {
        let d = path.join(pkg, "docs");
        if (!path.isAbsolute(d)) d = path.join(root, d);
        dirs.push(d)

        let cfg = readPkgConfig(path.join(d, ".."))
        for (let add of cfg.additionalFilePaths)
            dirs.push(path.join(d, "..", add, "docs"))
    }
    for (let d of dirs) {
        let template = tryRead(path.join(d, pathname))
        if (template)
            return pxt.docs.augmentDocs(template, targetMd)
    }
    return undefined;
}

export function lazyDependencies(): pxt.Map<string> {
    // find pxt-core package
    const deps: pxt.Map<string> = {};
    [path.join("node_modules", "pxt-core", "package.json"), "package.json"]
        .filter(f => fs.existsSync(f))
        .map(f => readJson(f))
        .forEach(config => config && config.lazyDependencies && Util.jsonMergeFrom(deps, config.lazyDependencies))
    return deps;
}

export function lazyRequire(name: string, install = false): any {
    /* tslint:disable:non-literal-require */
    let r: any;
    try {
        r = require(name);
    } catch (e) {
        pxt.debug(e);
        pxt.debug((<any>require.resolve).paths(name));
        r = undefined;
    }
    if (!r && install)
        pxt.log(`package "${name}" failed to load, run "pxt npminstallnative" to install native depencencies`)
    return r;
    /* tslint:enable:non-literal-require */
}

init();
