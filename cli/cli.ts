/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtsim.d.ts"/>


(global as any).pxt = pxt;

import * as nodeutil from './nodeutil';
nodeutil.init();

import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import U = pxt.Util;
import Cloud = pxt.Cloud;

import * as server from './server';
import * as uploader from './uploader';

let forceCloudBuild = process.env["KS_FORCE_CLOUD"] === "yes"

function initTargetCommands() {
    let cmdsjs = nodeutil.targetDir + '/built/cmds.js';
    if (fs.existsSync(cmdsjs)) {
        console.log(`loading cli extensions...`)
        let cli = require(cmdsjs)
        if (cli.deployCoreAsync) {
            pxt.commands.deployCoreAsync = cli.deployCoreAsync
        }
    }
}

let prevExports = (global as any).savedModuleExports
if (prevExports) {
    module.exports = prevExports
}

export interface UserConfig {
    accessToken?: string;
    localToken?: string;
    noAutoBuild?: boolean;
    noAutoStart?: boolean;
    localBuild?: boolean;
}

let reportDiagnostic = reportDiagnosticSimply;

function reportDiagnostics(diagnostics: ts.pxt.KsDiagnostic[]): void {
    for (const diagnostic of diagnostics) {
        reportDiagnostic(diagnostic);
    }
}

function reportDiagnosticSimply(diagnostic: ts.pxt.KsDiagnostic): void {
    let output = "";

    if (diagnostic.fileName) {
        output += `${diagnostic.fileName}(${diagnostic.line + 1},${diagnostic.character + 1}): `;
    }

    const category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
    output += `${category} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
    console.log(output);
}

function fatal(msg: string): Promise<any> {
    console.log("Fatal error:", msg)
    throw new Error(msg)
}

let globalConfig: UserConfig = {}

function homePxtDir() {
    return path.join(process.env["HOME"] || process.env["UserProfile"], ".pxt")
}

function cacheDir() {
    return path.join(homePxtDir(), "cache")
}

function configPath() {
    return path.join(homePxtDir(), "config.json")
}

let homeDirsMade = false
function mkHomeDirs() {
    if (homeDirsMade) return
    homeDirsMade = true
    if (!fs.existsSync(homePxtDir()))
        fs.mkdirSync(homePxtDir())
    if (!fs.existsSync(cacheDir()))
        fs.mkdirSync(cacheDir())
}

function saveConfig() {
    mkHomeDirs()
    fs.writeFileSync(configPath(), JSON.stringify(globalConfig, null, 4) + "\n")
}

function initConfig() {
    let atok: string = process.env["CLOUD_ACCESS_TOKEN"]
    if (fs.existsSync(configPath())) {
        let config = <UserConfig>readJson(configPath())
        globalConfig = config
        if (!atok && config.accessToken) {
            atok = config.accessToken
        }
    }

    if (atok) {
        let mm = /^(https?:.*)\?access_token=([\w\.]+)/.exec(atok)
        if (!mm) {
            fatal("Invalid accessToken format, expecting something like 'https://example.com/?access_token=0abcd.XXXX'")
        }
        Cloud.apiRoot = mm[1].replace(/\/$/, "").replace(/\/api$/, "") + "/api/"
        Cloud.accessToken = mm[2]
    }
}

export function loginAsync(access_token: string) {
    if (/^http/.test(access_token)) {
        globalConfig.accessToken = access_token
        saveConfig()
        if (process.env["CLOUD_ACCESS_TOKEN"])
            console.log("You have $CLOUD_ACCESS_TOKEN set; this overrides what you've specified here.")
    } else {
        let root = Cloud.apiRoot.replace(/api\/$/, "")
        console.log("USAGE:")
        console.log(`  pxt login https://example.com/?access_token=...`)
        console.log(`Go to ${root}oauth/gettoken to obtain the token.`)
        return fatal("Bad usage")
    }

    return Promise.resolve()
}

export function apiAsync(path: string, postArguments?: string): Promise<void> {
    if (postArguments == "delete") {
        return Cloud.privateDeleteAsync(path)
            .then(resp => console.log(resp))
    }

    if (postArguments == "-") {
        return nodeutil.readResAsync(process.stdin)
            .then(buf => buf.toString("utf8"))
            .then(str => apiAsync(path, str))
    }

    let dat = postArguments ? JSON.parse(postArguments) : null
    if (dat)
        console.log("POST", "/api/" + path, JSON.stringify(dat, null, 2))

    return Cloud.privateRequestAsync({
        url: path,
        data: dat
    })
        .then(resp => {
            if (resp.json)
                console.log(JSON.stringify(resp.json, null, 2))
            else console.log(resp.text)
        })
}

function uploadFileAsync(path: string) {
    let buf = fs.readFileSync(path)
    let mime = U.getMime(path)
    console.log("Upload", path)
    return Cloud.privatePostAsync("upload/files", {
        filename: path,
        encoding: "base64",
        content: buf.toString("base64"),
        contentType: mime
    })
        .then(resp => {
            console.log(resp)
        })
}

export function ptrAsync(path: string, target?: string) {
    // in MinGW when you say 'pxt ptr /foo/bar' on command line you get C:/MinGW/msys/1.0/foo/bar instead of '/foo/bar'
    let mingwRx = /^[a-z]:\/.*?MinGW.*?1\.0\//i

    path = path.replace(mingwRx, "/")
    path = nodeutil.sanitizePath(path)

    if (!target) {
        return Cloud.privateGetAsync(nodeutil.pathToPtr(path))
            .then(r => {
                console.log(r)
                return r
            })
    }

    if (target == "delete") {
        return Cloud.privateDeleteAsync(nodeutil.pathToPtr(path))
            .then(() => {
                console.log("Pointer " + path + " deleted.")
            })
    }

    if (target == "refresh") {
        return Cloud.privatePostAsync(nodeutil.pathToPtr(path), {})
            .then(r => {
                console.log(r)
                return r
            })
    }

    let ptr = {
        path: path,
        releaseid: "",
        redirect: "",
        scriptid: "",
        artid: "",
        htmlartid: "",
        userplatform: ["pxt-cli"],
    }

    target = target.replace(mingwRx, "/")

    return (/^[a-z]+$/.test(target) ? Cloud.privateGetAsync(target) : Promise.reject(""))
        .then(r => {
            if (r.kind == "script")
                ptr.scriptid = target
            else if (r.kind == "art")
                ptr.artid = target
            else if (r.kind == "release")
                ptr.releaseid = target
            else {
                U.userError("Don't know how to set pointer to this publication type: " + r.kind)
            }
        }, e => {
            if (/^(\/|http)/.test(target)) {
                console.log("Assuming redirect for: " + target)
                ptr.redirect = target
            } else {
                U.userError("Don't know how to set pointer to: " + target)
            }
        })
        .then(() => Cloud.privatePostAsync("pointers", ptr))
        .then(r => {
            console.log(r)
            return r
        })
}

function allFiles(top: string, maxDepth = 4): string[] {
    let res: string[] = []
    for (let p of fs.readdirSync(top)) {
        if (p[0] == ".") continue;
        let inner = top + "/" + p
        let st = fs.statSync(inner)
        if (st.isDirectory()) {
            if (maxDepth > 1)
                U.pushRange(res, allFiles(inner, maxDepth - 1))
        } else {
            res.push(inner)
        }
    }
    return res
}

function onlyExts(files: string[], exts: string[]) {
    return files.filter(f => exts.indexOf(path.extname(f)) >= 0)
}

export function uploadrelAsync(label?: string) {
    return uploadCoreAsync({
        label: label,
        pkgversion: pkgVersion(),
        fileList: allFiles("webapp/public")
            .concat(onlyExts(allFiles("built/web", 1), [".js", ".css"]))
            .concat(allFiles("built/web/fonts", 1))
    })
}

function semverCmp(a: string, b: string) {
    let parse = (s: string) => {
        let v = s.split(/\./).map(parseInt)
        return v[0] * 100000000 + v[1] * 10000 + v[2]
    }
    return parse(a) - parse(b)
}

let readJson = nodeutil.readJson;

function travisAsync() {
    forceCloudBuild = true

    let rel = process.env.TRAVIS_TAG || ""
    let atok = process.env.NPM_ACCESS_TOKEN

    if (/^v\d/.test(rel) && atok) {
        let npmrc = path.join(process.env.HOME, ".npmrc")
        console.log(`Setting up ${npmrc}`)
        let cfg = "//registry.npmjs.org/:_authToken=" + atok + "\n"
        fs.writeFileSync(npmrc, cfg)
    }

    console.log("TRAVIS_TAG:", rel)

    let branch = process.env.TRAVIS_BRANCH || "local"
    let latest = branch == "master" ? "latest" : "git-" + branch

    let pkg = readJson("package.json")
    if (pkg["name"] == "pxt-core") {
        if (rel)
            return uploadrelAsync("release/" + rel)
                .then(() => runNpmAsync("publish"))
        else
            return uploadrelAsync("release/" + latest)
    } else {
        return buildTargetAsync()
            .then(() => {
                let trg = readLocalPxTarget()
                if (rel)
                    return uploadtrgAsync(trg.id + "/" + rel)
                        .then(() => runNpmAsync("publish"))
                else
                    return uploadtrgAsync(trg.id + "/" + latest, "release/latest")
            })
    }
}

function bumpKsDepAsync() {
    let pkg = readJson("package.json")
    if (pkg["name"] == "pxt-core") return Promise.resolve(pkg)

    let gitPull = Promise.resolve()

    if (fs.existsSync("node_modules/pxt-core/.git")) {
        gitPull = spawnAsync({
            cmd: "git",
            args: ["pull"],
            cwd: "node_modules/pxt-core"
        })
    }

    return gitPull
        .then(() => {
            let kspkg = readJson("node_modules/pxt-core/package.json")
            let currVer = pkg["dependencies"]["pxt-core"]
            let newVer = kspkg["version"]
            if (currVer == newVer) {
                console.log(`Referenced pxt-core dep up to date: ${currVer}`)
                return pkg
            }

            console.log(`Bumping pxt-core dep version: ${currVer} -> ${newVer}`)
            if (currVer != "*" && semverCmp(currVer, newVer) > 0) {
                U.userError("Trying to downgrade pxt-core.")
            }
            pkg["dependencies"]["pxt-core"] = newVer
            fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n")
            return runGitAsync("commit", "-m", `Bump pxt-core to ${newVer}`, "--", "package.json")
                .then(() => pkg)
        })
}

function bumpAsync() {
    return Promise.resolve()
        .then(() => runGitAsync("pull"))
        .then(() => bumpKsDepAsync())
        .then(() => runNpmAsync("version", "patch"))
        .then(() => runGitAsync("push", "--tags"))
        .then(() => runGitAsync("push"))
}

function runGitAsync(...args: string[]) {
    return spawnAsync({
        cmd: "git",
        args: args,
        cwd: "."
    })
}

function runNpmAsync(...args: string[]) {
    return spawnAsync({
        cmd: addCmd("npm"),
        args: args,
        cwd: "."
    })
}

function pkgVersion() {
    let ver = readJson("package.json")["version"]
    let info = travisInfo()
    if (!info.tag)
        ver += "-" + (info.commit ? info.commit.slice(0, 6) : "local")
    return ver
}

export function uploadtrgAsync(label?: string, apprel?: string) {
    if (!apprel) {
        let pkg = readJson("node_modules/pxt-core/package.json")
        apprel = "release/v" + pkg.version
    }
    return Promise.resolve()
        .then(() => Cloud.privateGetAsync(apprel))
        .then(r => r.kind == "release" ? r : null, e => null)
        .then(r => r || Cloud.privateGetAsync(nodeutil.pathToPtr(apprel))
            .then(ptr => Cloud.privateGetAsync(ptr.releaseid)))
        .then(r => r.kind == "release" ? r : null)
        .then<pxt.Cloud.JsonRelease>(r => r, e => {
            console.log("Cannot find release: " + apprel)
            process.exit(1)
        })
        .then(r => {
            console.log(`Uploading target against: ${apprel} /${r.id}`);
            let opts: UploadOptions = {
                label: label,
                fileList: onlyExts(allFiles("built", 1), [".js", ".css", ".json", ".webmanifest"])
                    .concat(allFiles("sim/public")),
                pkgversion: pkgVersion(),
                baserelease: r.id,
                fileContent: {}
            }

            // the cloud only accepts *.json and sim* files in targets
            opts.fileList = opts.fileList.filter(fn => /\.json$/.test(fn) || /[\/\\]sim[^\\\/]*$/.test(fn))

            return uploadCoreAsync(opts)
        })
}

interface UploadOptions {
    fileList: string[];
    pkgversion: string;
    baserelease?: string;
    fileContent?: U.Map<string>;
    label?: string
    legacyLabel?: boolean;
    target?: string;
}

function uploadCoreAsync(opts: UploadOptions) {
    let liteId = "<none>"

    let replacements: U.Map<string> = {
        "/sim/simulator.html": "@simUrl@",
        "/sim/sim.webmanifest": "@relprefix@webmanifest",
        "/worker.js": "@workerjs@",
        "/tdworker.js": "@tdworkerjs@",
        "/embed.js": "@relprefix@embed",
        "/cdn/": "@pxtCdnUrl@",
        "/sim/": "@targetCdnUrl@",
        "data-manifest=\"\"": "@manifest@",
        "var pxtConfig = null": "var pxtConfig = @cfg@",
    }

    let replFiles = [
        "index.html",
        "embed.js",
        "run.html",
        "release.manifest",
        "worker.js",
        "tdworker.js",
        "simulator.html",
        "sim.manifest",
        "sim.webmanifest",
    ]

    nodeutil.mkdirP("built/uploadrepl")

    let uploadFileAsync = (p: string) => {
        let rdf: Promise<Buffer> = null
        if (opts.fileContent) {
            let s = U.lookup(opts.fileContent, p)
            if (s != null)
                rdf = Promise.resolve(new Buffer(s, "utf8"))
        }
        if (!rdf) {
            if (!fs.existsSync(p))
                return;
            rdf = readFileAsync(p)
        }

        return rdf
            .then((data: Buffer) => {
                // Strip the leading directory name, unless we are uploading a single file.
                let fileName = p.replace(/^(built\/web\/|\w+\/public\/|built\/)/, "")
                let mime = U.getMime(p)
                let isText = /^(text\/.*|application\/.*(javascript|json))$/.test(mime)
                let content = ""
                if (isText) {
                    content = data.toString("utf8")
                    if (replFiles.indexOf(fileName) >= 0) {
                        for (let from of Object.keys(replacements)) {
                            content = U.replaceAll(content, from, replacements[from])
                        }
                        // save it for developer inspection
                        fs.writeFileSync("built/uploadrepl/" + fileName, content)
                    }
                } else {
                    content = data.toString("base64")
                }
                return Cloud.privatePostAsync(liteId + "/files", {
                    encoding: isText ? "utf8" : "base64",
                    filename: fileName,
                    contentType: mime,
                    content,
                })
                    .then(resp => {
                        console.log(fileName, mime)
                    })
            })
    }

    let info = travisInfo()
    return Cloud.privatePostAsync("releases", {
        baserelease: opts.baserelease,
        pkgversion: opts.pkgversion,
        commit: info.commitUrl,
        branch: info.tag || info.branch,
        buildnumber: process.env['TRAVIS_BUILD_NUMBER'],
        target: pxt.appTarget ? pxt.appTarget.id : "",
        type: opts.baserelease ? "target" : "base",
    })
        .then(resp => {
            console.log(resp)
            liteId = resp.id
            return Promise.map(opts.fileList, uploadFileAsync, { concurrency: 15 })
        })
        .then(() => {
            if (!opts.label) return Promise.resolve()
            else if (opts.legacyLabel) return Cloud.privatePostAsync(liteId + "/label", { name: opts.label })
            else return Cloud.privatePostAsync("pointers", {
                path: nodeutil.sanitizePath(opts.label),
                releaseid: liteId
            })
                .then(() => {
                    // tag release/v0.1.2 also as release/beta
                    let beta = opts.label.replace(/\/v\d.*/, "/beta")
                    if (beta == opts.label) return Promise.resolve()
                    else {
                        console.log("Alos tagging with " + beta)
                        return Cloud.privatePostAsync("pointers", {
                            path: nodeutil.sanitizePath(beta),
                            releaseid: liteId
                        })
                    }
                })
        })
        .then(() => {
            console.log("All done; tagged with " + opts.label)
        })
}

function readLocalPxTarget() {
    if (!fs.existsSync("pxtarget.json")) {
        console.error("This command requires pxtarget.json in current directory.")
        process.exit(1)
    }
    nodeutil.targetDir = process.cwd()
    let cfg: pxt.TargetBundle = readJson("pxtarget.json")
    return cfg
}

function forEachBundledPkgAsync(f: (pkg: pxt.MainPackage) => Promise<void>) {
    let cfg = readLocalPxTarget()
    let prev = process.cwd()

    return Promise.mapSeries(cfg.bundleddirs, (dirname) => {
        process.chdir(path.join(nodeutil.targetDir, dirname))
        mainPkg = new pxt.MainPackage(new Host())
        return f(mainPkg);
    })
        .finally(() => process.chdir(prev))
        .then(() => { })
}

export function publishTargetAsync() {
    return forEachBundledPkgAsync((pkg) => {
        return pkg.publishAsync()
    })
}

export function spawnAsync(opts: {
    cmd: string,
    args: string[],
    cwd: string,
    shell?: boolean
}) {
    let info = opts.cmd + " " + opts.args.join(" ")
    if (opts.cwd != ".") info = "cd " + opts.cwd + "; " + info
    console.log("[run] " + info)
    return new Promise<void>((resolve, reject) => {
        let ch = child_process.spawn(opts.cmd, opts.args, {
            cwd: opts.cwd,
            env: process.env,
            stdio: "inherit",
            shell: opts.shell || false
        } as any)
        ch.on('close', (code: number) => {
            if (code != 0)
                reject(new Error("Exit code: " + code + " from " + info))
            resolve()
        });
    })
}

function maxMTimeAsync(dirs: string[]) {
    let max = 0
    return Promise.map(dirs, dn => readDirAsync(dn)
        .then(files => Promise.map(files, fn => statAsync(path.join(dn, fn))
            .then(st => {
                max = Math.max(st.mtime.getTime(), max)
            }))))
        .then(() => max)
}

export function buildTargetAsync(): Promise<void> {
    return buildFolderAsync('sim')
        .then(buildTargetCoreAsync)
        .then(() => buildFolderAsync('cmds', true))
        .then(() => buildFolderAsync('server', true))
}

function buildFolderAsync(p: string, optional?: boolean): Promise<void> {
    if (!fs.existsSync(p + "/tsconfig.json")) {
        if (!optional) U.userError(`${p}/tsconfig.json not found`);
        return Promise.resolve()
    }

    console.log(`building ${p}...`)
    dirsToWatch.push(p)
    return spawnAsync({
        cmd: "node",
        args: ["../node_modules/typescript/bin/tsc"],
        cwd: p
    })
}

function addCmd(name: string) {
    return name + (/win/.test(process.platform) ? ".cmd" : "")
}

function buildPxtAsync(): Promise<string[]> {
    let ksd = "node_modules/pxt-core"
    if (!fs.existsSync(ksd + "/pxtlib/main.ts")) return Promise.resolve([]);

    console.log(`building ${ksd}...`);
    return spawnAsync({
        cmd: addCmd("jake"),
        args: [],
        cwd: ksd
    }).then(() => {
        console.log("local pxt-core built.")
        return [ksd]
    }, e => {
        buildFailed("local pxt-core build FAILED")
        return [ksd]
    });
}

let dirsToWatch: string[] = []

function travisInfo() {
    return {
        branch: process.env['TRAVIS_BRANCH'],
        tag: process.env['TRAVIS_TAG'],
        commit: process.env['TRAVIS_COMMIT'],
        commitUrl: !process.env['TRAVIS_COMMIT'] ? undefined :
            "https://github.com/" + process.env['TRAVIS_REPO_SLUG'] + "/commits/" + process.env['TRAVIS_COMMIT'],
    }
}

function buildWebManifest(cfg: pxt.TargetBundle) {
    let webmanifest: any = {
        "lang": "en",
        "dir": "ltr",
        "name": cfg.name,
        "short_name": cfg.name,
        "icons": [
            {
                "src": "https://az851932.vo.msecnd.net/pub/zuxbkpza",
                "sizes": "128x128",
                "type": "image/png"
            }, {
                "src": "https://az851932.vo.msecnd.net/pub/hbcabbim",
                "sizes": "200x200",
                "type": "image/png"
            }
        ],
        "scope": "/",
        "start_url": "/",
        "display": "standalone",
        "orientation": "landscape"
    }
    let diskManifest: any = {}
    if (fs.existsSync("webmanifest.json"))
        diskManifest = nodeutil.readJson("webmanifest.json")
    U.jsonCopyFrom(webmanifest, diskManifest)
    return webmanifest;
}

function saveThemeJson(cfg: pxt.TargetBundle) {
    cfg.appTheme.id = cfg.id
    cfg.appTheme.title = cfg.title
    cfg.appTheme.name = cfg.name

    // expand logo
    let logos = (cfg.appTheme as any as U.Map<string>);
    Object.keys(logos)
        .filter(k => /logo$/i.test(k) && /^\.\//.test(logos[k]))
        .forEach(k => {
            let fn = path.join('./docs', logos[k]);
            console.log(`importing ${fn}`)
            let b = fs.readFileSync(fn)
            logos[k] = b.toString('utf8');
        })

    cfg.appTheme.locales = {}

    let lpath = "docs/_locales"
    if (fs.existsSync(lpath)) {
        for (let loc of fs.readdirSync(lpath)) {
            let fn = lpath + "/" + loc + "/_theme.json"
            if (fs.existsSync(fn))
                cfg.appTheme.locales[loc.toLowerCase()] = readJson(fn)
        }
    }

    nodeutil.mkdirP("built");
    fs.writeFileSync("built/theme.json", JSON.stringify(cfg.appTheme, null, 2))
}

function buildTargetCoreAsync() {
    let cfg = readLocalPxTarget()
    cfg.bundledpkgs = {}
    pxt.appTarget = cfg;
    let statFiles: U.Map<number> = {}
    dirsToWatch = cfg.bundleddirs.slice()
    console.log("building target.json...")
    return forEachBundledPkgAsync(pkg =>
        pkg.filesToBePublishedAsync()
            .then(res => {
                cfg.bundledpkgs[pkg.config.name] = res
            })
            .then(testForBuildTargetAsync))
        .then(() => {
            let info = travisInfo()
            cfg.versions = {
                branch: info.branch,
                tag: info.tag,
                commits: info.commitUrl,
                target: readJson("package.json")["version"],
                pxt: readJson("node_modules/pxt-core/package.json")["version"],
            }

            saveThemeJson(cfg)

            let webmanifest = buildWebManifest(cfg)
            fs.writeFileSync("built/target.json", JSON.stringify(cfg, null, 2))
            pxt.appTarget = cfg; // make sure we're using the latest version
            let targetlight = U.flatClone(cfg)
            delete targetlight.bundleddirs
            delete targetlight.bundledpkgs
            delete targetlight.appTheme
            fs.writeFileSync("built/targetlight.json", JSON.stringify(targetlight, null, 2))
            fs.writeFileSync("built/sim.webmanifest", JSON.stringify(webmanifest, null, 2))
        })
        .then(() => {
            console.log("target.json built.")
        })
}

function buildAndWatchAsync(f: () => Promise<string[]>): Promise<void> {
    let currMtime = Date.now()
    return f()
        .then(dirs => {
            if (globalConfig.noAutoBuild) return
            console.log('watching ' + dirs.join(', ') + '...');
            let loop = () => {
                Promise.delay(1000)
                    .then(() => maxMTimeAsync(dirs))
                    .then(num => {
                        if (num > currMtime) {
                            currMtime = num
                            f()
                                .then(d => {
                                    dirs = d
                                    U.nextTick(loop)
                                })
                        } else {
                            U.nextTick(loop)
                        }
                    })
            }
            U.nextTick(loop)
        })

}

function buildFailed(msg: string) {
    console.log("")
    console.log("***")
    console.log("*** Build failed: " + msg)
    console.log("***")
    console.log("")
}

function buildAndWatchTargetAsync() {
    if (!fs.existsSync("sim/tsconfig.json")) {
        console.log("No sim/tsconfig.json; assuming npm installed package")
        return Promise.resolve()
    }

    return buildAndWatchAsync(() => buildPxtAsync()
        .then(() => buildTargetAsync().then(r => { }, e => {
            buildFailed(e.message)
        }))
        .then(() => uploader.checkDocsAsync())
        .then(() => [path.resolve("node_modules/pxt-core")].concat(dirsToWatch)));
}

export function serveAsync(arg?: string) {
    forceCloudBuild = !globalConfig.localBuild
    let justServe = false
    if (arg == "-yt") {
        forceCloudBuild = false
    } else if (arg == "-cloud") {
        forceCloudBuild = true
    } else if (arg == "-just") {
        justServe = true
    }
    if (!globalConfig.localToken) {
        globalConfig.localToken = U.guidGen();
        saveConfig()
    }
    let localToken = globalConfig.localToken;
    if (!fs.existsSync("pxtarget.json")) {
        let upper = path.join(__dirname, "../../..")
        if (fs.existsSync(path.join(upper, "pxtarget.json"))) {
            console.log("going to " + upper)
            process.chdir(upper)
        } else {
            U.userError("Cannot find pxtarget.json to serve.")
        }
    }
    return (justServe ? Promise.resolve() : buildAndWatchTargetAsync())
        .then(() => server.serveAsync({
            localToken: localToken,
            autoStart: !globalConfig.noAutoStart
        }))
}

function extensionAsync(add: string) {
    let dat = {
        "config": "ws",
        "tag": "v0",
        "replaceFiles": {
            "/generated/xtest.cpp": "namespace xtest {\n    GLUE void hello()\n    {\n        uBit.panic(123);\n " + add + "   }\n}\n",
            "/generated/extpointers.inc": "(uint32_t)(void*)::xtest::hello,\n",
            "/generated/extensions.inc": "#include \"xtest.cpp\"\n"
        },
        "dependencies": {}
    }
    let dat2 = { data: new Buffer(JSON.stringify(dat), "utf8").toString("base64") }
    return Cloud.privateRequestAsync({
        url: "compile/extension",
        data: dat2
    })
        .then(resp => {
            console.log(resp.json)
        })
}

let readFileAsync: any = Promise.promisify(fs.readFile)
let writeFileAsync: any = Promise.promisify(fs.writeFile)
let execAsync: (cmd: string, options?: { cwd?: string }) => Promise<Buffer> = Promise.promisify(child_process.exec)
let readDirAsync = Promise.promisify(fs.readdir)
let statAsync = Promise.promisify(fs.stat)

let commonfiles: U.Map<string> = {};

class Host
    implements pxt.Host {
    resolve(module: pxt.Package, filename: string) {
        if (module.level == 0) {
            return "./" + filename
        } else if (module.verProtocol() == "file") {
            return module.verArgument() + "/" + filename
        } else {
            return "pxt_modules/" + module.id + "/" + filename
        }
    }

    readFile(module: pxt.Package, filename: string): string {
        let commonFile = U.lookup(commonfiles, filename)
        if (commonFile != null) return commonFile;

        let resolved = this.resolve(module, filename)
        try {
            return fs.readFileSync(resolved, "utf8")
        } catch (e) {
            return null
        }
    }

    writeFile(module: pxt.Package, filename: string, contents: string): void {
        let p = this.resolve(module, filename)
        let check = (p: string) => {
            let dir = p.replace(/\/[^\/]+$/, "")
            if (dir != p) {
                check(dir)
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir)
                }
            }
        }
        check(p)
        fs.writeFileSync(p, contents, "utf8")
    }

    getHexInfoAsync(extInfo: ts.pxt.ExtensionInfo): Promise<any> {
        if (extInfo.onlyPublic || forceCloudBuild)
            return pxt.hex.getHexInfoAsync(this, extInfo)

        return buildHexAsync(extInfo)
            .then(() => patchHexInfo(extInfo))
    }

    cacheStoreAsync(id: string, val: string): Promise<void> {
        mkHomeDirs()
        return writeFileAsync(path.join(cacheDir(), id), val, "utf8")
    }

    cacheGetAsync(id: string): Promise<string> {
        return readFileAsync(path.join(cacheDir(), id), "utf8")
            .then((v: string) => v, (e: any) => null as string)
    }

    downloadPackageAsync(pkg: pxt.Package) {
        let proto = pkg.verProtocol()

        if (proto == "pub") {
            return Cloud.downloadScriptFilesAsync(pkg.verArgument())
                .then(resp =>
                    U.iterStringMap(resp, (fn: string, cont: string) => {
                        pkg.host().writeFile(pkg, fn, cont)
                    }))
        } else if (proto == "embed") {
            let resp = pxt.getEmbeddedScript(pkg.verArgument())
            U.iterStringMap(resp, (fn: string, cont: string) => {
                pkg.host().writeFile(pkg, fn, cont)
            })
            return Promise.resolve()
        } else if (proto == "file") {
            console.log(`skip download of local pkg: ${pkg.version()}`)
            return Promise.resolve()
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }

    resolveVersionAsync(pkg: pxt.Package) {
        return Cloud.privateGetAsync(pxt.pkgPrefix + pkg.id).then(r => {
            let id = r["scriptid"]
            if (!id) {
                U.userError("scriptid no set on ptr for pkg " + pkg.id)
            }
            return id
        })
    }

}

let mainPkg = new pxt.MainPackage(new Host())

export function installAsync(packageName?: string) {
    ensurePkgDir();
    if (packageName) {
        return mainPkg.installPkgAsync(packageName)
    } else {
        return mainPkg.installAllAsync()
    }
}

export function initAsync(packageName: string) {
    return mainPkg.initAsync(packageName || "")
        .then(() => mainPkg.installAllAsync())
}

export function publishAsync() {
    ensurePkgDir();
    return mainPkg.publishAsync()
}

enum BuildOption {
    JustBuild,
    Run,
    Deploy,
    Test,
    GenDocs,
}

export function serviceAsync(cmd: string) {
    let fn = "built/response.json"
    return mainPkg.serviceAsync(cmd)
        .then(res => {
            if (res.errorMessage) {
                console.error("Error calling service:", res.errorMessage)
                process.exit(1)
            } else {
                mainPkg.host().writeFile(mainPkg, fn, JSON.stringify(res, null, 1))
                console.log("wrote results to " + fn)
            }
        })
}

export function timeAsync() {
    ensurePkgDir();
    let min: U.Map<number> = null;
    let loop = () =>
        mainPkg.buildAsync(mainPkg.getTargetOptions())
            .then(res => {
                if (!min) {
                    min = res.times
                } else {
                    U.iterStringMap(min, (k, v) => {
                        min[k] = Math.min(v, res.times[k])
                    })
                }
                console.log(res.times)
            })
    return loop()
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(loop)
        .then(() => console.log("MIN", min))
}

let ytPath = "built/yt"
let ytTarget = "bbc-microbit-classic-gcc"

interface BuildCache {
    sha?: string;
    modSha?: string;
}

function runYottaAsync(args: string[]) {
    let ypath: string = process.env["YOTTA_PATH"]
    let ytCommand = "yotta"
    let env = U.clone(process.env)
    if (/;[A-Z]:\\/.test(ypath)) {
        for (let pp of ypath.split(";")) {
            let q = path.join(pp, "yotta.exe")
            if (fs.existsSync(q)) {
                ytCommand = q
                env["PATH"] = env["PATH"] + ";" + ypath
                break
            }
        }
    }

    console.log("*** " + ytCommand + " " + args.join(" "))
    let child = child_process.spawn("yotta", args, {
        cwd: ytPath,
        stdio: "inherit",
        env: env
    })
    return new Promise<void>((resolve, reject) => {
        child.on("close", (code: number) => {
            if (code === 0) resolve()
            else reject(new Error("yotta " + args.join(" ") + ": exit code " + code))
        })
    })
}

function patchHexInfo(extInfo: ts.pxt.ExtensionInfo) {
    let infopath = ytPath + "/yotta_modules/pxt-microbit-core/generated/metainfo.json"

    let hexPath = ytPath + "/build/" + ytTarget + "/source/pxt-microbit-app-combined.hex"

    let hexinfo = readJson(infopath)
    hexinfo.hex = fs.readFileSync(hexPath, "utf8").split(/\r?\n/)

    return hexinfo
}

function buildHexAsync(extInfo: ts.pxt.ExtensionInfo) {
    let yottaTasks = Promise.resolve()
    let buildCachePath = ytPath + "/buildcache.json"
    let buildCache: BuildCache = {}
    if (fs.existsSync(buildCachePath)) {
        buildCache = readJson(buildCachePath)
    }

    if (buildCache.sha == extInfo.sha) {
        console.log("Skipping yotta build.")
        return yottaTasks
    }

    console.log("Writing yotta files to " + ytPath)

    let allFiles = U.clone(extInfo.generatedFiles)
    U.jsonCopyFrom(allFiles, extInfo.extensionFiles)

    U.iterStringMap(allFiles, (fn, v) => {
        fn = ytPath + fn
        nodeutil.mkdirP(path.dirname(fn))
        let existing: string = null
        if (fs.existsSync(fn))
            existing = fs.readFileSync(fn, "utf8")
        if (existing !== v)
            fs.writeFileSync(fn, v)
    })

    let saveCache = () => fs.writeFileSync(buildCachePath, JSON.stringify(buildCache, null, 4) + "\n")

    let modSha = U.sha256(extInfo.generatedFiles["/module.json"])
    if (buildCache.modSha !== modSha) {
        yottaTasks = yottaTasks
            .then(() => runYottaAsync(["target", ytTarget]))
            .then(() => runYottaAsync(["update"]))
            .then(() => {
                buildCache.sha = ""
                buildCache.modSha = modSha
                saveCache();
                buildDalConst(true);
            })
    } else {
        console.log("Skipping yotta update.")
    }

    yottaTasks = yottaTasks
        .then(() => runYottaAsync(["build"]))
        .then(() => {
            buildCache.sha = extInfo.sha
            saveCache()
        })

    return yottaTasks
}

let parseCppInt = pxt.cpp.parseCppInt;

function buildDalConst(force = false) {
    let constName = "dal.d.ts"
    let vals: U.Map<string> = {}
    let done: U.Map<string> = {}

    function isValidInt(v: string) {
        return /^-?(\d+|0[xX][0-9a-fA-F]+)$/.test(v)
    }

    function extractConstants(fileName: string, src: string, dogenerate = false): string {
        let lineNo = 0
        // let err = (s: string) => U.userError(`${fileName}(${lineNo}): ${s}\n`)
        let outp = ""
        let inEnum = false
        let enumVal = 0
        let defineVal = (n: string, v: string) => {
            v = v.trim()
            if (parseCppInt(v) != null) {
                let curr = U.lookup(vals, n)
                if (curr == null || curr == v) {
                    vals[n] = v
                    if (dogenerate && !done[n]) {
                        outp += `    ${n} = ${v},\n`
                        done[n] = v
                    }
                } else {
                    vals[n] = "?"
                    if (dogenerate && !/^MICROBIT_DISPLAY_(ROW|COLUMN)_COUNT$/.test(n))
                        console.log(`${fileName}(${lineNo}): #define conflict, ${n}`)
                }
            } else {
                vals[n] = "?" // just in case there's another more valid entry
            }
        }
        src.split(/\r?\n/).forEach(ln => {
            ++lineNo
            ln = ln.replace(/\/\/.*/, "").replace(/\/\*.*/g, "")
            let m = /^\s*#define\s+(\w+)\s+(.*)$/.exec(ln)
            if (m) {
                defineVal(m[1], m[2])
            }

            if (inEnum && /}/.test(ln))
                inEnum = false

            if (/^\s*enum\s+(\w+)/.test(ln)) {
                inEnum = true;
                enumVal = -1;
            }

            if (inEnum && (m = /^\s*(\w+)\s*(=\s*(.*?))?,?\s*$/.exec(ln))) {
                let v = m[3]
                if (v) {
                    enumVal = parseCppInt(v)
                    if (enumVal == null) {
                        console.log(`${fileName}(${lineNo}): invalid enum initializer, ${ln}`)
                        inEnum = false
                        return
                    }
                } else {
                    enumVal++
                    v = enumVal + ""
                }
                defineVal(m[1], v)
            }
        })
        return outp
    }

    if (mainPkg && mainPkg.getFiles().indexOf(constName) >= 0 &&
        (force || !fs.existsSync(constName))) {
        console.log(`rebuilding ${constName}...`)
        let incPath = ytPath + "/yotta_modules/microbit-dal/inc/"
        let files = allFiles(incPath).filter(fn => U.endsWith(fn, ".h"))
        files.sort(U.strcmp)
        let fc: U.Map<string> = {}
        for (let fn of files) {
            if (U.endsWith(fn, "Config.h")) continue
            fc[fn] = fs.readFileSync(fn, "utf8")
        }
        files = Object.keys(fc)

        // pre-pass - detect conflicts
        for (let fn of files) {
            extractConstants(fn, fc[fn])
        }

        let consts = "// Auto-generated. Do not edit.\ndeclare const enum DAL {\n"
        for (let fn of files) {
            consts += "    // " + fn + "\n"
            consts += extractConstants(fn, fc[fn], true)
        }
        consts += "}\n"
        fs.writeFileSync(constName, consts)
    }
}

export function formatAsync(...fileNames: string[]) {
    let inPlace = false
    let testMode = false

    if (fileNames[0] == "-i") {
        fileNames.shift()
        inPlace = true
    }

    if (fileNames[0] == "-t") {
        fileNames.shift()
        testMode = true
    }

    let fileList = Promise.resolve()
    if (fileNames.length == 0) {
        fileList = mainPkg
            .loadAsync()
            .then(() => {
                fileNames = mainPkg.getFiles().filter(f => U.endsWith(f, ".ts"))
            })
    }

    return fileList
        .then(() => {
            let numErr = 0
            for (let f of fileNames) {
                let input = fs.readFileSync(f, "utf8")
                let tmp = ts.pxt.format(input, 0)
                let formatted = tmp.formatted
                let expected = testMode && fs.existsSync(f + ".exp") ? fs.readFileSync(f + ".exp", "utf8") : null
                let fn = f + ".new"

                if (testMode) {
                    if (expected == null)
                        expected = input
                    if (formatted != expected) {
                        fs.writeFileSync(fn, formatted, "utf8")
                        console.log("format test FAILED; written:", fn)
                        numErr++;
                    } else {
                        fs.unlink(fn, err => { })
                        console.log("format test OK:", f)
                    }
                } else if (formatted == input) {
                    console.log("already formatted:", f)
                    if (!inPlace)
                        fs.unlink(fn, err => { })
                } else if (inPlace) {
                    fs.writeFileSync(f, formatted, "utf8")
                    console.log("replaced:", f)
                } else {
                    fs.writeFileSync(fn, formatted, "utf8")
                    console.log("written:", fn)
                }

            }

            if (numErr) {
                console.log(`${numErr} formatting test(s) FAILED.`)
                process.exit(1)
            } else {
                console.log(`${fileNames.length} formatting test(s) OK`)
            }
        })
}

function runCoreAsync(res: ts.pxt.CompileResult) {
    let f = res.outfiles["microbit.js"]
    if (f) {
        // TODO: non-microbit specific load
        pxsim.initCurrentRuntime = pxsim.initBareRuntime
        let r = new pxsim.Runtime(f)
        pxsim.Runtime.messagePosted = (msg) => {
            if (msg.type == "serial")
                console.log("SERIAL:", (msg as any).data)
        }
        r.errorHandler = (e) => {
            throw e;
        }
        r.run(() => {
            console.log("DONE")
            pxsim.dumpLivePointers();
        })
    }
    return Promise.resolve()
}

function simulatorCoverage(pkgCompileRes: ts.pxt.CompileResult, pkgOpts: ts.pxt.CompileOptions) {
    let decls: U.Map<ts.Symbol> = {}

    if (!pkgOpts.extinfo || pkgOpts.extinfo.functions.length == 0) return

    let opts: ts.pxt.CompileOptions = {
        fileSystem: {},
        sourceFiles: ["built/sim.d.ts", "node_modules/pxt-core/built/pxtsim.d.ts"],
        target: mainPkg.getTargetOptions(),
        ast: true,
        noEmit: true,
        hexinfo: null
    }

    for (let fn of opts.sourceFiles) {
        opts.fileSystem[fn] = fs.readFileSync(path.join(nodeutil.targetDir, fn), "utf8")
    }

    let simDeclRes = ts.pxt.compile(opts)
    reportDiagnostics(simDeclRes.diagnostics);
    let typechecker = simDeclRes.ast.getTypeChecker()
    let doSymbol = (sym: ts.Symbol) => {
        if (sym.getFlags() & ts.SymbolFlags.HasExports) {
            typechecker.getExportsOfModule(sym).forEach(doSymbol)
        }
        decls[ts.pxt.getFullName(typechecker, sym)] = sym
    }
    let doStmt = (stmt: ts.Statement) => {
        let mod = stmt as ts.ModuleDeclaration
        if (mod.name) {
            let sym = typechecker.getSymbolAtLocation(mod.name)
            if (sym) doSymbol(sym)
        }
    }
    for (let sf of simDeclRes.ast.getSourceFiles()) {
        sf.statements.forEach(doStmt)
    }

    for (let info of pkgOpts.extinfo.functions) {
        let shim = info.name
        let simName = "pxsim." + shim.replace(/::/g, ".")
        let sym = U.lookup(decls, simName)
        if (!sym) {
            console.log("missing in sim:", simName)
        }
    }

    /*
    let apiInfo = ts.pxt.getApiInfo(pkgCompileRes.ast)
    for (let ent of U.values(apiInfo.byQName)) {
        let shim = ent.attributes.shim
        if (shim) {
            let simName = "pxsim." + shim.replace(/::/g, ".")
            let sym = U.lookup(decls, simName)
            if (!sym) {
                console.log("missing in sim:", simName)
            }
        }
    }
    */
}

function testForBuildTargetAsync() {
    let opts: ts.pxt.CompileOptions
    return mainPkg.loadAsync()
        .then(() => {
            copyCommonFiles();
            let target = mainPkg.getTargetOptions()
            if (target.hasHex)
                target.isNative = true
            return mainPkg.getCompileOptionsAsync(target)
        })
        .then(o => {
            opts = o
            opts.testMode = true
            opts.ast = true
            return ts.pxt.compile(opts)
        })
        .then(res => {
            reportDiagnostics(res.diagnostics);
            if (!res.success) U.userError("Test failed")
            simulatorCoverage(res, opts)
        })
}

function simshimAsync() {
    let prog = ts.pxt.plainTsc("sim")
    let shims = pxt.simshim(prog)
    for (let s of Object.keys(shims)) {
        fs.writeFileSync("libs/" + s, shims[s])
    }
    return Promise.resolve()
}

function copyCommonFiles() {
    for (let f of mainPkg.getFiles()) {
        if (U.lookup(commonfiles, f)) {
            mainPkg.host().writeFile(mainPkg, "built/" + f, commonfiles[f])
        }
    }
}

function testConverterAsync(configFile: string) {
    forceCloudBuild = true
    let cfg: {
        apiUrl: string,
        ids: string[]
    } = readJson(configFile)
    let cachePath = "built/cache/"
    nodeutil.mkdirP(cachePath)
    let tdev = require("./web/tdast")
    let errors: string[] = []
    return getApiInfoAsync()
        .then(astinfo => prepTestOptionsAsync()
            .then(opts => {
                fs.writeFileSync("built/apiinfo.json", JSON.stringify(astinfo, null, 1))
                return Promise.map(cfg.ids, (id) => (readFileAsync(cachePath + id, "utf8") as Promise<string>)
                    .then(v => v, (e: any) => "")
                    .then<string>(v => v ? Promise.resolve(v) :
                        U.httpGetTextAsync(cfg.apiUrl + id + "/text")
                            .then(v => writeFileAsync(cachePath + id, v)
                                .then(() => v)))
                    .then(v => {
                        let tdopts = {
                            text: v,
                            useExtensions: true,
                            apiInfo: astinfo
                        }
                        let r = tdev.AST.td2ts(tdopts)
                        let src: string = r.text
                        U.assert(!!src.trim(), "source is empty")
                        if (!compilesOK(opts, id + ".ts", src)) {
                            errors.push(id)
                            fs.writeFileSync("built/" + id + ".ts.fail", src)
                        }
                    })
                    .then(() => { }, err => {
                        console.log(`ERROR ${id}: ${err.message}`)
                        errors.push(id)
                    })
                    , { concurrency: 5 })
            }))
        .then(() => {
            if (errors.length) {
                console.log("Errors: " + errors.join(", "))
                process.exit(1)
            } else {
                console.log("All OK.")
            }
        })
}

function compilesOK(opts: ts.pxt.CompileOptions, fn: string, content: string) {
    console.log(`*** ${fn}, size=${content.length}`)
    let opts2 = U.flatClone(opts)
    opts2.fileSystem = U.flatClone(opts.fileSystem)
    opts2.sourceFiles = opts.sourceFiles.slice()
    opts2.sourceFiles.push(fn)
    opts2.fileSystem[fn] = content
    let res = ts.pxt.compile(opts2)
    reportDiagnostics(res.diagnostics);
    if (!res.success) {
        console.log("ERRORS", fn)
    }

    return res.success
}

function getApiInfoAsync() {
    return prepBuildOptionsAsync(BuildOption.GenDocs)
        .then(ts.pxt.compile)
        .then(res => {
            return ts.pxt.getApiInfo(res.ast)
        })
}

function prepTestOptionsAsync() {
    return prepBuildOptionsAsync(BuildOption.Test)
        .then(opts => {
            let tsFiles = mainPkg.getFiles().filter(fn => U.endsWith(fn, ".ts"))
            if (tsFiles.length != 1)
                U.userError("need exactly one .ts file in package to 'testdir'")

            let tsFile = tsFiles[0]
            delete opts.fileSystem[tsFile]
            opts.sourceFiles = opts.sourceFiles.filter(f => f != tsFile)
            return opts
        })
}

function testDirAsync(dir: string) {
    forceCloudBuild = true
    return prepTestOptionsAsync()
        .then(opts => {
            let errors: string[] = []

            for (let fn of fs.readdirSync(dir)) {
                if (!U.endsWith(fn, ".ts") || fn[0] == ".") continue;
                if (!compilesOK(opts, fn, fs.readFileSync(dir + "/" + fn, "utf8")))
                    errors.push(fn)
            }

            if (errors.length) {
                console.log("Errors: " + errors.join(", "))
                process.exit(1)
            } else {
                console.log("All OK.")
            }
        })
}

function prepBuildOptionsAsync(mode: BuildOption) {
    ensurePkgDir();
    return mainPkg.loadAsync()
        .then(() => {
            buildDalConst();
            copyCommonFiles();
            let target = mainPkg.getTargetOptions()
            if (target.hasHex && mode != BuildOption.Run)
                target.isNative = true
            return mainPkg.getCompileOptionsAsync(target)
        })
        .then(opts => {
            if (mode == BuildOption.Test)
                opts.testMode = true
            if (mode == BuildOption.GenDocs)
                opts.ast = true
            return opts;
        })
}

function buildCoreAsync(mode: BuildOption) {
    ensurePkgDir();
    return prepBuildOptionsAsync(mode)
        .then(ts.pxt.compile)
        .then(res => {
            U.iterStringMap(res.outfiles, (fn, c) =>
                mainPkg.host().writeFile(mainPkg, "built/" + fn, c))
            reportDiagnostics(res.diagnostics);
            if (!res.success) {
                process.exit(1)
            }

            console.log("Package built; hexsize=" + (res.outfiles["microbit.hex"] || "").length)

            if (mode == BuildOption.GenDocs) {
                let apiInfo = ts.pxt.getApiInfo(res.ast)
                let md = ts.pxt.genMarkdown(mainPkg.config.name, apiInfo)
                mainPkg.host().writeFile(mainPkg, "built/apiinfo.json", JSON.stringify(apiInfo, null, 1))
                for (let fn in md) {
                    let folder = /-strings.json$/.test(fn) ? "_locales/" : /\.md$/.test(fn) ? "../../docs/" : "built/";
                    let ffn = folder + fn;
                    mainPkg.host().writeFile(mainPkg, ffn, md[fn])
                    console.log(`generated ${ffn}; size=${md[fn].length}`)
                }
                return null
            } else if (mode == BuildOption.Deploy) {
                if (!pxt.commands.deployCoreAsync) {
                    console.log("no deploy functionality defined by this target")
                    return null;
                }
                return pxt.commands.deployCoreAsync(res);
            }
            else if (mode == BuildOption.Run)
                return runCoreAsync(res);
            else
                return null;
        })
}

export function buildAsync() {
    return buildCoreAsync(BuildOption.JustBuild)
}

export function gendocsAsync() {
    return buildCoreAsync(BuildOption.GenDocs)
}

export function deployAsync() {
    return buildCoreAsync(BuildOption.Deploy)
}

export function runAsync() {
    return buildCoreAsync(BuildOption.Run)
}

export function testAsync() {
    return buildCoreAsync(BuildOption.Test)
}

export function uploadDocsAsync(...args: string[]): Promise<void> {
    let cfg = readLocalPxTarget()
    if (cfg.id == "core")
        saveThemeJson(cfg)
    return uploader.uploadDocsAsync(...args)
}

interface Command {
    name: string;
    fn: () => void;
    argDesc: string;
    desc: string;
    priority?: number;
}

let cmds: Command[] = []


function cmd(desc: string, cb: (...args: string[]) => Promise<void>, priority = 0) {
    let m = /^(\S+)(\s+)(.*?)\s+- (.*)/.exec(desc)
    cmds.push({
        name: m[1],
        argDesc: m[3],
        desc: m[4],
        fn: cb,
        priority: priority
    })
}

cmd("help                         - display this message", helpAsync)

cmd("init     PACKAGE_NAME        - start new package for a given target", initAsync)
cmd("install  [PACKAGE...]        - install new packages, or all packages", installAsync)

cmd("build                        - build current package", buildAsync)
cmd("deploy                       - build and deploy current package", deployAsync)
cmd("run                          - build and run current package in the simulator", runAsync)
cmd("publish                      - publish current package", publishAsync)
cmd("test                         - run tests on current package", testAsync, 1)
cmd("gendocs                      - build current package and its docs", gendocsAsync, 1)
cmd("format   [-i] file.ts...     - pretty-print TS files; -i = in-place", formatAsync, 1)
cmd("testdir  DIR                 - compile files from DIR one-by-one replacing the main file of current package", testDirAsync, 1)
cmd("testconv JSONCONFIG          - test TD->TS converter", testConverterAsync, 2)

cmd("serve    [-yt]               - start web server for your local target; -yt = use local yotta build", serveAsync)
cmd("buildtarget                  - build pxtarget.json", () => buildTargetAsync().then(() => { }), 1)
cmd("pubtarget                    - publish all bundled target libraries", publishTargetAsync, 1)
cmd("bump                         - bump target patch version", bumpAsync, 1)
cmd("uploadrel [LABEL]            - upload web app release", uploadrelAsync, 1)
cmd("uploadtrg [LABEL]            - upload target release", uploadtrgAsync, 1)
cmd("uploaddoc [docs/foo.md...]   - push/upload docs to server", uploadDocsAsync, 1)
cmd("checkdocs                    - check docs for broken links, typing errors, etc...", uploader.checkDocsAsync, 1)

cmd("login    ACCESS_TOKEN        - set access token config variable", loginAsync)

cmd("api      PATH [DATA]         - do authenticated API call", apiAsync, 1)
cmd("ptr      PATH [TARGET]       - get PATH, or set PATH to TARGET (publication id, redirect, or \"delete\")", ptrAsync, 1)
cmd("travis                       - upload release and npm package", travisAsync, 1)
cmd("uploadfile PATH              - upload file under <CDN>/files/PATH", uploadFileAsync, 1)
cmd("service  OPERATION           - simulate a query to web worker", serviceAsync, 2)
cmd("time                         - measure performance of the compiler on the current package", timeAsync, 2)
cmd("simshim                      - test shim generation from simulator", simshimAsync, 2)

cmd("extension ADD_TEXT           - try compile extension", extensionAsync, 10)

export function helpAsync(all?: string) {
    let f = (s: string, n: number) => {
        while (s.length < n) {
            s += " "
        }
        return s
    }
    let showAll = all == "all"
    console.log("USAGE: pxt command args...")
    if (showAll) {
        console.log("All commands:")
    } else {
        console.log("Common commands (use 'pxt help all' to show all):")
    }
    cmds.forEach(cmd => {
        if (cmd.priority >= 10) return;
        if (showAll || !cmd.priority) {
            console.log(f(cmd.name, 10) + f(cmd.argDesc, 20) + cmd.desc);
        }
    })
    return Promise.resolve()
}

function goToPkgDir() {
    let goUp = (s: string): string => {
        if (fs.existsSync(s + "/" + pxt.configName)) {
            return s
        }
        let s2 = path.resolve(path.join(s, ".."))
        if (s != s2) {
            return goUp(s2)
        }
        return null
    }
    let dir = goUp(process.cwd())
    if (!dir) {
        console.error(`Cannot find ${pxt.configName} in any of the parent directories.`)
        process.exit(1)
    } else {
        if (dir != process.cwd()) {
            console.log(`Going up to ${dir} which has ${pxt.configName}`)
            process.chdir(dir)
        }
    }
}

function ensurePkgDir() {
    goToPkgDir();
}

function errorHandler(reason: any) {
    if (reason.isUserError) {
        console.error("ERROR:", reason.message)
        process.exit(1)
    }

    let msg = reason.stack || reason.message || (reason + "")
    console.error("INTERNAL ERROR:", msg)
    process.exit(20)
}

export function mainCli(targetDir: string) {
    process.on("unhandledRejection", errorHandler);
    process.on('uncaughtException', errorHandler);

    if (!targetDir) {
        console.error("Please upgrade your pxt CLI module.")
        console.error("   npm update -g pxt")
        process.exit(30)
    }

    nodeutil.targetDir = targetDir;

    let trg = nodeutil.getPxtTarget()
    pxt.appTarget = trg;
    console.log(`Using PXT/${trg.id} from ${targetDir}.`)

    commonfiles = readJson(__dirname + "/pxt-common.json")

    let args = process.argv.slice(2)

    initConfig();

    let cmd = args[0]

    if (cmd != "buildtarget") {
        initTargetCommands();
    }

    if (!cmd) {
        if (pxt.commands.deployCoreAsync) {
            console.log("running 'pxt deploy' (run 'pxt help' for usage)")
            cmd = "deploy"
        } else {
            console.log("running 'pxt build' (run 'pxt help' for usage)")
            cmd = "build"
        }
    }

    let cc = cmds.filter(c => c.name == cmd)[0]
    if (!cc) {
        helpAsync()
            .then(() => process.exit(1))
    } else {
        cc.fn.apply(null, args.slice(1))
    }
}

function initGlobals() {
    let g = global as any
    g.pxt = pxt;
    g.ts = ts;
}

initGlobals();

if (require.main === module) {
    let targetdir = path.resolve(path.join(__dirname, "../../.."))
    if (!fs.existsSync(targetdir + "/pxtarget.json")) {
        targetdir = path.resolve(path.join(__dirname, ".."))
        if (!fs.existsSync(targetdir + "/pxtarget.json")) {
            console.error("Cannot find pxtarget.json")
            process.exit(1)
        }
    }
    mainCli(targetdir);
}
