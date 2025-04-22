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
    return pxt.Util.promiseMapAllSeries(fins, f => f())
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
                bufs.push(Buffer.from(c, "utf8"))
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
    // https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2
    if (os.platform() === "win32" && typeof opts.shell === "undefined") opts.shell = true
    if (opts.pipe === undefined) opts.pipe = true
    let info = opts.cmd + " " + opts.args.join(" ")
    if (opts.cwd && opts.cwd != ".") info = "cd " + opts.cwd + "; " + info
    //console.log("[run] " + info) // uncomment for debugging, but it can potentially leak secrets so do not check in
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

export async function getDefaultBranchAsync(): Promise<string> {
    const b = await gitInfoAsync(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], undefined, true);
    if (!b)
        Util.userError("no git remote branch found");
    return b.replace(/^origin\//, "");
}

export async function getCurrentBranchNameAsync(): Promise<string> {
    const b = await gitInfoAsync(["rev-parse", "--abbrev-ref", "HEAD"], undefined, true);
    if (!b)
        Util.userError("no git local branch found");
    return b;
}

export async function getGitHubTokenAsync(): Promise<string> {
    const outputBuf = await spawnWithPipeAsync({
        cmd: "git",
        args: ["credential", "fill"],
        input: "protocol=https\nhost=github.com\n\n",
        silent: true
    });

    const output = outputBuf.toString("utf8").trim();
    const lines = output.split("\n");
    const creds: Record<string, string> = {};
    for (const line of lines) {
        const [key, ...rest] = line.split("=");
        creds[key] = rest.join("=");
    }

    if (creds.password) {
        return creds.password;
    } else {
        Util.userError("No GitHub credentials found via git credential helper.");
    }
}

export async function getGitHubUserAsync(token: string): Promise<string> {
    const res = await Util.httpRequestCoreAsync({
        url: "https://api.github.com/user",
        method: "GET",
        headers: {
            Authorization: `token ${token}`,
        }
    });

    if (res.statusCode !== 200) {
        Util.userError(`Failed to get GitHub username: ${res.statusCode} ${res.text}`);
    }

    const data = await res.json;
    return data.login;
}

export async function getGitHubOwnerAndRepoAsync(): Promise<{ owner: string; repo: string }> {
    const remoteUrl = await gitInfoAsync(["config", "--get", "remote.origin.url"], undefined, true);
    if (!remoteUrl) {
        Util.userError("No remote origin URL found");
    }
    const match = remoteUrl.match(/github\.com[:\/](.+?)\/(.+?)(\.git)?$/);
    if (!match) {
        Util.userError("Invalid remote origin URL: " + remoteUrl);
    }
    const owner = match[1];
    const repo = match[2];
    return { owner, repo };
}

export async function createBranchAsync(branchName: string) {
    await spawnAsync({
        cmd: "git",
        args: ["checkout", "-b", branchName],
        silent: true,
    });
    await spawnAsync({
        cmd: "git",
        args: ["push", "--set-upstream", "origin", branchName],
        silent: true,
    });
}

export async function switchBranchAsync(branchName: string) {
    await spawnAsync({
        cmd: "git",
        args: ["checkout", branchName],
        silent: true,
    });
}

export async function getLocalTagPointingAtHeadAsync(): Promise<string | undefined> {
    try {
        const output = await spawnWithPipeAsync({
            cmd: "git",
            args: ["tag", "--points-at", "HEAD"],
            silent: true,
        });
        const result = output.toString("utf-8").trim();
        const tags = result.split("\n").map(t => t.trim()).filter(Boolean);
        const versionTag = tags.find(t => /^v\d+\.\d+\.\d+$/.test(t));
        return versionTag;
    } catch (e) {
        return undefined;
    }
}

export async function npmVersionBumpAsync(
    bumpType: "patch" | "minor" | "major" | string, tagCommit: boolean = true
): Promise<string> {
    const output = await spawnWithPipeAsync({
        cmd: addCmd("npm"),
        args: ["version", bumpType, "--message", `"[pxt-cli] bump version to %s"`, "--git-tag-version", tagCommit ? "true" : "false"],
        cwd: ".",
        silent: true,
    });
    const ver = output.toString("utf8").trim();
    // If not tagging, the `npm version` command will not commit the change to package.json, so we need to do it manually
    if (!tagCommit) {
        await spawnAsync({
            cmd: "git",
            args: ["add", "package.json"],
            cwd: ".",
            silent: true,
        });
        await spawnAsync({
            cmd: "git",
            args: ["commit", "-m", `"[pxt-cli] bump version to ${ver}"`],
            cwd: ".",
            silent: true,
        });
    }
    return ver;
}

export function gitPushAsync(followTags: boolean = true) {
    const args = ["push"];
    if (followTags) args.push("--follow-tags");
    args.push("origin", "HEAD");
    return spawnAsync({
        cmd: "git",
        args,
        cwd: ".",
        silent: true,
    });
}

export async function createPullRequestAsync(opts: {
    token: string,
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body: string
}): Promise<string> {
    const { token, owner, repo, title, head, base, body } = opts;
    const res = await Util.httpRequestCoreAsync({
        url: `https://api.github.com/repos/${owner}/${repo}/pulls`,
        method: "POST",
        headers: {
            Authorization: `token ${token}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        data: {
            title,
            head,
            base,
            body,
        },
    });

    if (res.statusCode !== 201) {
        Util.userError(`Failed to create pull request: ${res.statusCode} ${res.text}`);
    }

    const data = await res.json;
    return data.html_url as string;
}

export async function isBranchProtectedAsync(
    token: string,
    owner: string,
    repo: string,
    branch: string
): Promise<boolean> {
    const res = await Util.httpRequestCoreAsync({
        url: `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
        method: "GET",
        headers: {
            Authorization: `token ${token}`,
            "Accept": "application/vnd.github+json"
        }
    });

    if (res.statusCode !== 200) {
        Util.userError(`Failed to get branch info: ${res.statusCode} ${res.text}`);
    }

    const data = await res.json;

    const requiresPR = !!data.protection?.required_pull_request_reviews;
    const hasPushRestrictions = !!data.protection?.restrictions;

    return requiresPR || hasPushRestrictions;
}

export function timestamp(date = new Date()): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");
    const sec = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}-${hh}${min}${sec}`;
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

    let buf: Buffer = null;

    u.headers["accept-encoding"] = "gzip"
    u.headers["user-agent"] = "PXT-CLI"

    let gzipContent = false

    if (data != null) {
        if (Buffer.isBuffer(data)) {
            buf = data;
        } else if (typeof data == "object") {
            buf = Buffer.from(JSON.stringify(data), "utf8")
            u.headers["content-type"] = "application/json; charset=utf8"
            if (options.allowGzipPost) gzipContent = true
        } else if (typeof data == "string") {
            buf = Buffer.from(data, "utf8")
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
                let json: any = null
                try {
                    text = buf.toString("utf8")
                    json = JSON.parse(text)
                } catch (e) {
                }
                let resp: Util.HttpResponse = {
                    statusCode: res.statusCode,
                    headers: res.headers,
                    buffer: buf,
                    text: text,
                    json: json,
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
    require("promise.prototype.finally").shim();
    // Make unhandled async rejections throw
    process.on(
        'unhandledRejection',
        e => {
            throw e
        }
    );
    Util.isNodeJS = true;
    Util.httpRequestCoreAsync = nodeHttpRequestAsync;
    Util.sha256 = sha256;
    Util.cpuUs = () => {
        const p = process.cpuUsage()
        return p.system + p.user
    }
    Util.getRandomBuf = buf => {
        let tmp = crypto.randomBytes(buf.length)
        for (let i = 0; i < buf.length; ++i)
            buf[i] = tmp[i]
    }

    (global as any).btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
    (global as any).atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}

export function sanitizePath(path: string) {
    return path.replace(/[^\w@\/]/g, "-").replace(/^\/+/, "")
}

export function readJson(fn: string) {
    return JSON.parse(fs.readFileSync(fn, "utf8"))
}

export function readText(fn: string) {
    return fs.readFileSync(fn, "utf8");
}

export function readPkgConfig(dir: string) {
    //pxt.debug("readPkgConfig in " + dir)
    const fn = path.join(dir, pxt.CONFIG_NAME)
    const js: pxt.PackageConfig = readJson(fn)

    const ap = js.additionalFilePath
    if (ap) {
        let adddir = path.join(dir, ap);
        if (!existsDirSync(adddir))
            pxt.U.userError(`additional pxt.json not found: ${adddir} in ${dir} + ${ap}`)
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
    let files = allFiles(src, { maxDepth })
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

export function cp(srcFile: string, destDirectory: string, destName?: string) {
    mkdirP(destDirectory);
    let dest = path.resolve(destDirectory, destName || path.basename(srcFile));
    let buf = fs.readFileSync(path.resolve(srcFile));
    fs.writeFileSync(dest, buf);
}

interface AllFilesOpts {
    maxDepth?: number;
    allowMissing?: boolean;
    includeDirs?: boolean;
    ignoredFileMarker?: string;
    includeHiddenFiles?: boolean;
}
export function allFiles(top: string, opts: AllFilesOpts = {}) {
    const {
        maxDepth,
        allowMissing,
        includeDirs,
        ignoredFileMarker,
        includeHiddenFiles
    } = {
        maxDepth: 8,
        ...opts
    };

    let res: string[] = []
    if (allowMissing && !existsDirSync(top)) return res
    for (const p of fs.readdirSync(top)) {
        if (p[0] == "." && !includeHiddenFiles) continue;
        const inner = path.join(top, p)
        const st = fs.statSync(inner)
        if (st.isDirectory()) {
            // check for ingored folder marker
            if (ignoredFileMarker && fs.existsSync(path.join(inner, ignoredFileMarker)))
                continue;
            if (maxDepth > 1)
                Util.pushRange(res, allFiles(inner, { ...opts, maxDepth: maxDepth - 1 }))
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
export function resolveMd(root: string, pathname: string, md?: string): string {
    const docs = path.join(root, "docs");

    const tryRead = (fn: string) => {
        if (fileExistsSync(fn + ".md"))
            return fs.readFileSync(fn + ".md", "utf8")
        if (fileExistsSync(fn + "/index.md"))
            return fs.readFileSync(fn + "/index.md", "utf8")
        return null
    }

    const targetMd = md ? md : tryRead(path.join(docs, pathname))
    if (targetMd && !/^\s*#+\s+@extends/m.test(targetMd))
        return targetMd

    const dirs = [
        path.join(root, "/node_modules/pxt-core/common-docs"),
        ...getBundledPackagesDocs()
    ];

    for (const d of dirs) {
        const template = tryRead(path.join(d, pathname))
        if (template)
            return pxt.docs.augmentDocs(template, targetMd)
    }
    return undefined;
}

export function getBundledPackagesDocs(): string[] {
    const handledDirectories = {};
    const outputDocFolders: string[] = [];

    for (const bundledDir of pxt.appTarget.bundleddirs || []) {
        getPackageDocs(bundledDir, outputDocFolders, handledDirectories);
    }

    return outputDocFolders;

    /**
     * This needs to produce a topologically sorted array of the docs of `dir` and any required packages,
     * such that any package listed as a dependency / additionalFilePath of another
     * package is added to `folders` before the one that requires it.
     */
    function getPackageDocs(packageDir: string, folders: string[], resolvedDirs: pxt.Map<boolean>) {
        if (resolvedDirs[packageDir])
            return;
        resolvedDirs[packageDir] = true;

        const jsonDir = path.join(packageDir, "pxt.json");
        const pxtjson = fs.existsSync(jsonDir) && (readJson(jsonDir) as pxt.PackageConfig);

        // before adding this package, include the docs of any package this one depends upon.
        if (pxtjson) {
            /**
             * include the package this extends from first;
             * that may have dependencies that overlap with this one or that will later be
             * overwritten by this one
             **/
            if (pxtjson.additionalFilePath) {
                getPackageDocs(path.join(packageDir, pxtjson.additionalFilePath), folders, resolvedDirs);
            }

            if (pxtjson.dependencies) {
                Object.keys(pxtjson.dependencies).forEach(dep => {
                    const parts = /^file:(.+)$/i.exec(pxtjson.dependencies[dep]);
                    if (parts) {
                        getPackageDocs(path.join(packageDir, parts[1]), folders, resolvedDirs);
                    }
                });
            }
        }

        const docsDir = path.join(packageDir, "docs");

        if (fs.existsSync(docsDir)) {
            folders.push(docsDir);
        }
    }
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
}

export function stringify(content: any) {
    if (process.env["PXT_ENV"] === "production") {
        return JSON.stringify(content);
    }
    return JSON.stringify(content, null, 4);
}

export function matchesAny(input: string, patterns: (string | RegExp)[]): boolean {
    return patterns.some(pattern => {
        if (typeof pattern === "string") {
            return input === pattern;
        } else {
            return pattern.test(input);
        }
    });
}

init();
