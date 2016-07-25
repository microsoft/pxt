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
        pxt.debug(`loading cli extensions...`)
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
    pxt.log(output);
}

function fatal(msg: string): Promise<any> {
    pxt.log("Fatal error:", msg)
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

function readlineAsync() {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    return new Promise<string>((resolve, reject) => {
        process.stdin.once('data', (text: string) => {
            resolve(text)
        })
    })
}

export function promptAsync(msg: string): Promise<boolean> {
    process.stdout.write(msg + " (y/n): ")
    return readlineAsync()
        .then(text => {
            if (text.trim().toLowerCase() == "y")
                return Promise.resolve(true)
            else if (text.trim().toLowerCase() == "n")
                return Promise.resolve(false)
            else return promptAsync(msg)
        })
}

function ptrcheckAsync(cmd: string) {
    let prefixIgnore: string[] = []
    let exactIgnore: U.Map<boolean> = {}

    if (fs.existsSync("ptrcheck-ignore")) {
        let ign = fs.readFileSync("ptrcheck-ignore", "utf8").split(/\r?\n/)
        for (let line of ign) {
            line = line.trim()
            if (line[0] == "#") continue
            if (line[line.length - 1] == "*") {
                prefixIgnore.push(line.slice(0, line.length - 1))
            } else {
                exactIgnore[line] = true
            }
        }
    }

    let path = "pointers"
    let isCore = pxt.appTarget.id == "core"
    if (!isCore)
        path += "/" + pxt.appTarget.id
    let elts: Cloud.JsonPointer[] = []
    let next = (cont: string): Promise<void> =>
        Cloud.privateGetAsync(path + "?count=500&continuation=" + cont)
            .then((resp: Cloud.JsonList) => {
                console.log("Query:", cont)
                for (let e of resp.items as Cloud.JsonPointer[]) {
                    if (isCore && /^ptr-([a-z]+)$/.exec(e.id) && e.releaseid) {
                        let tname = e.id.slice(4)
                        prefixIgnore.push(tname + "-")
                        exactIgnore[tname] = true
                        console.log("Target: " + e.id)
                    }
                    elts.push(e)
                }
                if (resp.continuation) return next(resp.continuation)
                else return Promise.resolve()
            })


    let files = U.toDictionary(allFiles("docs", 8)
        .filter(e => /\.md$/.test(e))
        .map(e => {
            let s = e.slice(5).replace(/\.md$/, "")
            let m = /^_locales\/([a-z]+)\/(.*)/.exec(s)
            if (m) s = m[2] + "@" + m[1]
            s = s.replace(/\//g, "-")
            return s
        }), x => x)

    return next("")
        .then(() => {
            let c0 = elts.length
            elts = elts.filter(e => {
                if (e.releaseid && /ptr-[a-z]+-v\d+-\d+-\d+$/.test(e.id))
                    return false
                let ename = e.id.slice(4)
                if (U.lookup(exactIgnore, ename))
                    return false
                for (let pref of prefixIgnore) {
                    if (pref == ename.slice(0, pref.length))
                        return false
                }
                if (e.redirect)
                    return false
                return true
            })

            console.log(`Got ${c0} pointers; have ${elts.length} after filtering. Core=${isCore}`)
            elts.sort((a, b) => U.strcmp(a.id, b.id))


            let toDel: string[] = []
            for (let e of elts) {
                let fn = e.id.slice(4)
                if (!isCore) fn = fn.replace(/^[a-z]+-/, "")
                if (!U.lookup(files, fn)) {
                    toDel.push(e.id)
                }
            }

            if (toDel.length == 0) {
                console.log("All OK, nothing excessive.")
                return Promise.resolve()
            }

            console.log(`Absent in docs/ ${toDel.length} items:`)
            for (let e of toDel)
                console.log(e.slice(4))

            if (cmd != "delete") {
                console.log("Use 'pxt ptrcheck delete' to delete these; you will be prompted")
                return Promise.resolve()
            }

            return promptAsync("Delete all these pointers?")
                .then(y => {
                    if (!y) return Promise.resolve()
                    return Promise.map(toDel,
                        e => Cloud.privateDeleteAsync(e)
                            .then(() => {
                                console.log("DELETE", e)
                            }),
                        { concurrency: 5 })
                        .then(() => { })
                })
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

function allFiles(top: string, maxDepth = 4, allowMissing = false): string[] {
    let res: string[] = []
    if (allowMissing && !fs.existsSync(top)) return res
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

function pxtFileList(pref: string) {
    return allFiles(pref + "webapp/public")
        .concat(onlyExts(allFiles(pref + "built/web", 1), [".js", ".css"]))
        .concat(allFiles(pref + "built/web/fonts", 1))

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
            return runNpmAsync("publish")
        else
            return Promise.resolve()
    } else {
        return buildTargetAsync()
            .then(() => {
                let trg = readLocalPxTarget()
                if (rel)
                    return uploadtrgAsync(trg.id + "/" + rel)
                        .then(() => runNpmAsync("publish"))
                else
                    return uploadtrgAsync(trg.id + "/" + latest)
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
            fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n")
            return runGitAsync("commit", "-m", `Bump pxt-core to ${newVer}`, "--", "package.json")
                .then(() => pkg)
        })
}

function updateAsync() {
    return Promise.resolve()
        .then(() => runGitAsync("pull"))
        .then(() => bumpKsDepAsync())
        .then(() => runNpmAsync("install"));
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

function targetFileList() {
    let lst = onlyExts(allFiles("built", 1), [".js", ".css", ".json", ".webmanifest"])
        .concat(allFiles("sim/public"))
    // the cloud only accepts *.json and sim* files in targets
    return lst.filter(fn => /\.json$/.test(fn) || /[\/\\]sim[^\\\/]*$/.test(fn))
}

export function staticpkgAsync(label?: string) {
    let dir = label ? "/" + label + "/" : "/"
    return Promise.resolve()
        .then(() => uploadCoreAsync({
            label: label || "main",
            pkgversion: "0.0.0",
            fileList: pxtFileList("node_modules/pxt-core/").concat(targetFileList()),
            localDir: dir
        }))
        .then(() => renderDocs(dir))
}

export function uploadtrgAsync(label?: string) {
    return uploadCoreAsync({
        label: label,
        fileList: pxtFileList("node_modules/pxt-core/").concat(targetFileList()),
        pkgversion: pkgVersion(),
        fileContent: {}
    })
}

interface UploadOptions {
    fileList: string[];
    pkgversion: string;
    fileContent?: U.Map<string>;
    label?: string
    legacyLabel?: boolean;
    target?: string;
    localDir?: string;
}

function uploadCoreAsync(opts: UploadOptions) {
    let liteId = "<none>"

    let replacements: U.Map<string> = {
        "/sim/simulator.html": "@simUrl@",
        "/sim/sim.webmanifest": "@relprefix@webmanifest",
        "/embed.js": "@relprefix@embed",
        "/cdn/": "@pxtCdnUrl@",
        "/sim/": "@targetCdnUrl@",
        "data-manifest=\"\"": "@manifest@",
        "var pxtConfig = null": "var pxtConfig = @cfg@",
    }


    if (opts.localDir) {
        let cfg: pxt.WebConfig = {
            "relprefix": opts.localDir,
            "workerjs": opts.localDir + "worker.js",
            "tdworkerjs": opts.localDir + "tdworker.js",
            "pxtVersion": opts.pkgversion,
            "pxtRelId": "",
            "pxtCdnUrl": opts.localDir,
            "targetVersion": opts.pkgversion,
            "targetRelId": "",
            "targetCdnUrl": opts.localDir,
            "targetId": opts.target,
            "simUrl": opts.localDir + "simulator.html",
            "runUrl": opts.localDir + "run.html",
            "docsUrl": opts.localDir + "docs.html",
            "isStatic": true,
        }
        replacements = {
            "/embed.js": opts.localDir + "embed.js",
            "/cdn/": opts.localDir,
            "/sim/": opts.localDir,
            "@workerjs@": `${opts.localDir}worker.js\n# ver ${new Date().toString()}`,
            //"data-manifest=\"\"": `manifest="${opts.localDir}release.manifest"`,
            "var pxtConfig = null": "var pxtConfig = " + JSON.stringify(cfg, null, 4),
        }
    }

    let replFiles = [
        "index.html",
        "embed.js",
        "run.html",
        "docs.html",
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
                let fileName = p.replace(/^.*(built\/web\/|\w+\/public\/|built\/)/, "")
                let mime = U.getMime(p)
                let isText = /^(text\/.*|application\/.*(javascript|json))$/.test(mime)
                let content = ""

                if (isText) {
                    content = data.toString("utf8")
                    if (fileName == "index.html") {
                        content = content
                            .replace(/<!--\s*@include\s+(\S+)\s*-->/g,
                            (full, fn) => {
                                let cont = ""
                                try {
                                    cont = fs.readFileSync("includes/" + fn, "utf8")
                                } catch (e) { }
                                return "<!-- include " + fn + " -->\n" + cont + "\n<!-- end include -->\n"
                            })
                            .replace(/@(\w+)@/g, (full, varname) => {
                                return (pxt.appTarget.appTheme as any)[varname] || ""
                            })
                    }

                    if (replFiles.indexOf(fileName) >= 0) {
                        for (let from of Object.keys(replacements)) {
                            content = U.replaceAll(content, from, replacements[from])
                        }
                        if (opts.localDir) {
                            data = new Buffer(content, "utf8")
                        } else {
                            // save it for developer inspection
                            fs.writeFileSync("built/uploadrepl/" + fileName, content)
                        }
                    } else if (fileName == "target.json" && opts.localDir) {
                        let trg: pxt.TargetBundle = JSON.parse(content)
                        for (let e of trg.appTheme.docMenu)
                            if (e.path[0] == "/") {
                                e.path = opts.localDir + "docs" + e.path + ".html"
                            }
                        trg.appTheme.logoUrl = opts.localDir
                        trg.appTheme.homeUrl = opts.localDir
                        data = new Buffer(JSON.stringify(trg, null, 2), "utf8")
                    }
                } else {
                    content = data.toString("base64")
                }

                if (opts.localDir) {
                    let fn = path.join(builtPackaged + opts.localDir, fileName)
                    nodeutil.mkdirP(path.dirname(fn))
                    return writeFileAsync(fn, data)
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

    if (opts.localDir)
        return Promise.map(opts.fileList, uploadFileAsync, { concurrency: 15 })
            .then(() => {
                console.log("Release files written to", path.resolve(builtPackaged + opts.localDir))
            })

    let info = travisInfo()
    return Cloud.privatePostAsync("releases", {
        pkgversion: opts.pkgversion,
        commit: info.commitUrl,
        branch: info.tag || info.branch,
        buildnumber: process.env['TRAVIS_BUILD_NUMBER'],
        target: pxt.appTarget ? pxt.appTarget.id : "",
        type: "fulltarget"
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
                        console.log("Also tagging with " + beta)
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
    cwd?: string,
    shell?: boolean
}) {
    let info = opts.cmd + " " + opts.args.join(" ")
    if (opts.cwd && opts.cwd != ".") info = "cd " + opts.cwd + "; " + info
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

function ghpSetupRepoAsync() {
    function getreponame() {
        let cfg = fs.readFileSync("built/gh-pages/.git/config", "utf8")
        let m = /^\s*url\s*=\s*.*github.*\/([^\/\s]+)$/mi.exec(cfg)
        if (!m) U.userError("cannot determine GitHub repo name")
        return m[1].replace(/\.git$/, "")
    }
    if (fs.existsSync("built/gh-pages")) {
        console.log("Skipping init of built/gh-pages; you can delete it first to get full re-init")
        return Promise.resolve(getreponame())
    }

    cpR(".git", "built/gh-pages/.git")
    return ghpGitAsync("checkout", "gh-pages")
        .then(() => getreponame(), (e: any) => {
            U.userError("No gh-pages branch. Try 'pxt ghpinit' first.")
        })
}

function ghpGitAsync(...args: string[]) {
    return spawnAsync({
        cmd: "git",
        cwd: "built/gh-pages",
        args: args
    })
}

export function ghpPushAsync() {
    let repoName = ""
    return ghpSetupRepoAsync()
        .then(name => staticpkgAsync((repoName = name)))
        .then(() => {
            cpR(builtPackaged + "/" + repoName, "built/gh-pages")
        })
        .then(() => ghpGitAsync("add", "."))
        .then(() => ghpGitAsync("commit", "-m", "Auto-push"))
        .then(() => ghpGitAsync("push"))
}

export function ghpInitAsync() {
    if (fs.existsSync("built/gh-pages"))
        U.userError("built/gh-pages already exists")
    cpR(".git", "built/gh-pages/.git")
    return ghpGitAsync("checkout", "gh-pages")
        .then(() => U.userError("gh-pages branch already exists"), (e: any) => { })
        .then(() => ghpGitAsync("checkout", "--orphan", "gh-pages"))
        .then(() => ghpGitAsync("rm", "-rf", "."))
        .then(() => {
            fs.writeFileSync("built/gh-pages/index.html", "Under construction.")
            return ghpGitAsync("add", ".")
        })
        .then(() => ghpGitAsync("commit", "-m", "Initial."))
        .then(() => ghpGitAsync("push", "--set-upstream", "origin", "gh-pages"))
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
    return simshimAsync()
        .then(() => buildFolderAsync('sim'))
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
    return name + (/^win/.test(process.platform) ? ".cmd" : "")
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
        buildFailed("local pxt-core build FAILED", e)
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
                "src": "\/static\/icons\/android-chrome-36x36.png",
                "sizes": "36x36",
                "type": "image\/png",
                "density": 0.75
            },
            {
                "src": "\/static\/icons\/android-chrome-48x48.png",
                "sizes": "48x48",
                "type": "image\/png",
                "density": 1
            },
            {
                "src": "\/static\/icons\/android-chrome-72x72.png",
                "sizes": "72x72",
                "type": "image\/png",
                "density": 1.5
            },
            {
                "src": "\/static\/icons\/android-chrome-96x96.png",
                "sizes": "96x96",
                "type": "image\/png",
                "density": 2
            },
            {
                "src": "\/static\/icons\/android-chrome-144x144.png",
                "sizes": "144x144",
                "type": "image\/png",
                "density": 3
            },
            {
                "src": "\/static\/icons\/android-chrome-192x192.png",
                "sizes": "192x192",
                "type": "image\/png",
                "density": 4
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
            let mimeType = '';
            if (/\.svg$/i.test(fn)) mimeType = "image/svg+xml";
            else if (/\.png$/i.test(fn)) mimeType = "image/png";
            else if (/\.jpe?g$/i.test(fn)) mimeType = "image/jpeg";
            if (mimeType) logos[k] = `data:${mimeType};base64,${b.toString('base64')}`;
            else logos[k] = b.toString('utf8');
        })

    if (!cfg.appTheme.htmlDocIncludes)
        cfg.appTheme.htmlDocIncludes = {}

    for (let fn of allFiles("node_modules/pxt-core/includes", 1, true).concat(allFiles("includes"))) {
        let m = /docs-(.*)\.html$/.exec(fn)
        if (m) {
            console.log("embed: " + fn)
            cfg.appTheme.htmlDocIncludes[m[1]] = fs.readFileSync(fn, "utf8")
        }
    }

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
    dirsToWatch.push("sim"); // simulator
    dirsToWatch.push("sim/public"); // simulator
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

function buildFailed(msg: string, e: any) {
    console.log("")
    console.log("***")
    console.log("*** Build failed: " + msg)
    console.log(e.stack)
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
            buildFailed("target build failed: " + e.message, e)
        }))
        .then(() => uploader.checkDocsAsync())
        .then(() => [path.resolve("node_modules/pxt-core")].concat(dirsToWatch)));
}

function cpR(src: string, dst: string, maxDepth = 8) {
    src = path.resolve(src)
    let files = allFiles(src, maxDepth)
    let dirs: U.Map<boolean> = {}
    for (let f of files) {
        let bn = f.slice(src.length)
        let dd = path.join(dst, bn)
        let dir = path.dirname(dd)
        if (!U.lookup(dirs, dir)) {
            nodeutil.mkdirP(dir)
            dirs[dir] = true
        }
        let buf = fs.readFileSync(f)
        fs.writeFileSync(dd, buf)
    }
}

let builtPackaged = "built/packaged"

function renderDocs(localDir: string) {
    let dst = path.resolve(builtPackaged + localDir)

    cpR("node_modules/pxt-core/docfiles", dst + "/docfiles")
    if (fs.existsSync("docfiles"))
        cpR("docfiles", dst + "/docfiles")

    let webpath = localDir
    let docsTemplate = fs.readFileSync(dst + "/docfiles/template.html", "utf8")
    docsTemplate = U.replaceAll(docsTemplate, "/cdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/docfiles/", webpath + "docfiles/")
    docsTemplate = U.replaceAll(docsTemplate, "/--embed", webpath + "embed.js")

    let dirs: U.Map<boolean> = {}
    for (let f of allFiles("docs", 8)) {
        let dd = path.join(dst, f)
        let dir = path.dirname(dd)
        if (!U.lookup(dirs, dir)) {
            nodeutil.mkdirP(dir)
            dirs[dir] = true
        }
        let buf = fs.readFileSync(f)
        if (/\.md$/.test(f)) {
            let str = buf.toString("utf8")
            let path = f.slice(5).split(/\//)
            let bc = path.map((e, i) => {
                return {
                    href: "/" + path.slice(0, i + 1).join("/"),
                    name: e
                }
            })
            let html = pxt.docs.renderMarkdown(docsTemplate, str, pxt.appTarget.appTheme, null, bc)
            html = html.replace(/(<a[^<>]*)\shref="(\/[^<>"]*)"/g, (f, beg, url) => {
                return beg + ` href="${webpath}docs${url}.html"`
            })
            buf = new Buffer(html, "utf8")
            dd = dd.slice(0, dd.length - 3) + ".html"
        }
        fs.writeFileSync(dd, buf)
    }
    console.log("Docs written.")
}

export function serveAsync(arg?: string) {
    forceCloudBuild = !globalConfig.localBuild
    let justServe = false
    let packaged = false
    if (arg == "-yt") {
        forceCloudBuild = false
    } else if (arg == "-cloud") {
        forceCloudBuild = true
    } else if (arg == "-just") {
        justServe = true
    } else if (arg == "-pkg") {
        justServe = true
        packaged = true
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
    if (!fs.existsSync("node_modules/typescript")) {
        U.userError("Oops, typescript does not seem to be installed, did you run 'npm install'?");
    }
    return (justServe ? Promise.resolve() : buildAndWatchTargetAsync())
        .then(() => server.serveAsync({
            localToken: localToken,
            autoStart: !globalConfig.noAutoStart,
            packaged: packaged
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

let commonfiles: U.Map<string> = {}
let fileoverrides: U.Map<string> = {}

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

        let overFile = U.lookup(fileoverrides, filename)
        if (module.level == 0 && overFile != null)
            return overFile

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

const ytPath = "built/yt"

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
    let infopath = ytPath + "/yotta_modules/" + pxt.appTarget.compileService.yottaCorePackage + "/generated/metainfo.json"

    let hexPath = ytPath + "/build/" + pxt.appTarget.compileService.yottaTarget + "/source/pxt-microbit-app-combined.hex"

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
            .then(() => runYottaAsync(["target", pxt.appTarget.compileService.yottaTarget]))
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
    let f = res.outfiles[ts.pxt.BINARY_JS]
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
    console.log("Looking for shim annotations in the simulator.")
    let prog = ts.pxt.plainTsc("sim")
    let shims = pxt.simshim(prog)
    let filename = "sims.d.ts"
    for (let s of Object.keys(shims)) {
        let cont = shims[s]
        if (!cont.trim()) continue
        cont = "// Auto-generated from simulator. Do not edit.\n" + cont +
            "\n// Auto-generated. Do not edit. Really.\n"
        let cfgname = "libs/" + s + "/" + pxt.configName
        let cfg: pxt.PackageConfig = readJson(cfgname)
        if (cfg.files.indexOf(filename) == -1)
            U.userError(U.lf("please add \"{0}\" to {1}", filename, cfgname))
        let fn = "libs/" + s + "/" + filename
        if (fs.readFileSync(fn, "utf8") != cont) {
            console.log(`updating ${fn}`)
            fs.writeFileSync(fn, cont)
        }
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

function getCachedAsync(url: string, path: string) {
    return (readFileAsync(path, "utf8") as Promise<string>)
        .then(v => v, (e: any) => {
            //console.log(`^^^ fetch ${id} ${Date.now() - start}ms`)
            return null
        })
        .then<string>(v => v ? Promise.resolve(v) :
            U.httpGetTextAsync(url)
                .then(v => writeFileAsync(path, v)
                    .then(() => v)))
}

function testConverterAsync(url: string) {
    forceCloudBuild = true
    let cachePath = "built/cache/"
    nodeutil.mkdirP(cachePath)
    let tdev = require("./web/tdast")
    let errors: string[] = []
    return getApiInfoAsync()
        .then(astinfo => prepTestOptionsAsync()
            .then(opts => {
                fs.writeFileSync("built/apiinfo.json", JSON.stringify(astinfo, null, 1))
                return getCachedAsync(url, cachePath + url.replace(/[^a-z0-9A-Z\.]/g, "-"))
                    .then(text => {
                        let srcs = JSON.parse(text)
                        for (let id of Object.keys(srcs)) {
                            let v = srcs[id]
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
                        }
                    })
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

function patchOpts(opts: ts.pxt.CompileOptions, fn: string, content: string) {
    console.log(`*** ${fn}, size=${content.length}`)
    let opts2 = U.flatClone(opts)
    opts2.fileSystem = U.flatClone(opts.fileSystem)
    opts2.sourceFiles = opts.sourceFiles.slice()
    opts2.sourceFiles.push(fn)
    opts2.fileSystem[fn] = content
    opts2.embedBlob = null
    opts2.embedMeta = null
    return opts2
}

function compilesOK(opts: ts.pxt.CompileOptions, fn: string, content: string) {
    let opts2 = patchOpts(opts, fn, content)
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

function findTestFile() {
    let tsFiles = mainPkg.getFiles().filter(fn => U.endsWith(fn, ".ts"))
    if (tsFiles.length != 1)
        U.userError("need exactly one .ts file in package to 'testdir'")
    return tsFiles[0]
}

function prepTestOptionsAsync() {
    return prepBuildOptionsAsync(BuildOption.Test)
        .then(opts => {
            let tsFile = findTestFile()
            delete opts.fileSystem[tsFile]
            opts.sourceFiles = opts.sourceFiles.filter(f => f != tsFile)
            return opts
        })
}

interface TestInfo {
    filename: string;
    base: string;
    text: string;
}

function testDirAsync(dir: string) {
    forceCloudBuild = true
    let tests: TestInfo[] = []

    dir = path.resolve(dir || ".")
    let outdir = dir + "/built/"

    nodeutil.mkdirP(outdir)

    for (let fn of fs.readdirSync(dir)) {
        if (fn[0] == ".") continue;
        let full = dir + "/" + fn
        if (U.endsWith(fn, ".ts")) {
            let text = fs.readFileSync(full, "utf8")
            let m = /^\s*\/\/\s*base:\s*(\S+)/m.exec(text)
            let base = m ? m[1] : "base"
            tests.push({
                filename: full,
                base: base,
                text: text
            })
        } else if (fs.existsSync(full + "/" + pxt.configName)) {
            tests.push({
                filename: full,
                base: fn,
                text: null
            })
        }
    }

    tests.sort((a, b) => {
        let r = U.strcmp(a.base, b.base)
        if (r == 0)
            if (a.text == null) return -1
            else if (b.text == null) return 1
            else return U.strcmp(a.filename, b.filename)
        else return r
    })

    let currBase = ""
    let errors: string[] = []

    return Promise.mapSeries(tests, (ti) => {
        let fn = path.basename(ti.filename)
        console.log(`--- ${fn}`)
        let hexPath = outdir + fn.replace(/\.ts$/, "") + ".hex"
        if (ti.text == null) {
            currBase = ti.base
            process.chdir(ti.filename)
            mainPkg = new pxt.MainPackage(new Host())
            return installAsync()
                .then(testAsync)
                .then(() => {
                    if (pxt.appTarget.compile.hasHex)
                        fs.writeFileSync(hexPath, fs.readFileSync("built/binary.hex"))
                })
        } else {
            let start = Date.now()
            if (currBase != ti.base) {
                throw U.userError("Base directory: " + ti.base + " not found.")
            } else {
                let tsf = findTestFile()
                let files = mainPkg.config.files
                let idx = files.indexOf(tsf)
                U.assert(idx >= 0)
                files[idx] = fn
                mainPkg.config.name = fn.replace(/\.ts$/, "")
                mainPkg.config.description = `Generated from ${ti.base} with ${fn}`
                fileoverrides = {}
                fileoverrides[fn] = ti.text
                return prepBuildOptionsAsync(BuildOption.Test, true)
                    .then(opts => {
                        let res = ts.pxt.compile(opts)
                        let lines = ti.text.split(/\r?\n/)
                        let errCode = (s: string) => {
                            if (!s) return 0
                            let m = /\/\/\s*TS(\d\d\d\d\d?)/.exec(s)
                            if (m) return parseInt(m[1])
                            else return 0
                        }
                        let numErr = 0
                        for (let diag of res.diagnostics) {
                            if (!errCode(lines[diag.line])) {
                                reportDiagnostics(res.diagnostics);
                                numErr++
                            }
                        }
                        let lineNo = 0
                        for (let line of lines) {
                            let code = errCode(line)
                            if (code && res.diagnostics.filter(d => d.line == lineNo && d.code == code).length == 0) {
                                numErr++
                                console.log(`${fn}(${lineNo + 1}): expecting error TS${code}`)
                            }
                            lineNo++
                        }
                        if (numErr) {
                            console.log("ERRORS", fn)
                            errors.push(fn)
                            fs.unlink(hexPath) // ignore errors
                        } else {
                            let hex = res.outfiles["binary.hex"]
                            if (hex) {
                                fs.writeFileSync(hexPath, hex)
                                console.log(`wrote hex: ${hexPath} ${hex.length} bytes; ${Date.now() - start}ms`)
                            }
                        }
                    })
            }
        }
    })
        .then(() => {
            if (errors.length) {
                console.log("Errors: " + errors.join(", "))
                process.exit(1)
            } else {
                console.log("All OK.")
            }
        })
}

function prepBuildOptionsAsync(mode: BuildOption, quick = false) {
    ensurePkgDir();
    return mainPkg.loadAsync()
        .then(() => {
            if (!quick) {
                buildDalConst();
                copyCommonFiles();
            }
            // TODO pass down 'quick' to disable the C++ extension work
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

            console.log("Package built; hexsize=" + (res.outfiles[ts.pxt.BINARY_HEX] || "").length)

            if (mode == BuildOption.GenDocs) {
                let apiInfo = ts.pxt.getApiInfo(res.ast)
                let md = ts.pxt.genMarkdown(mainPkg.config.name, apiInfo)
                mainPkg.host().writeFile(mainPkg, "built/apiinfo.json", JSON.stringify(apiInfo, null, 1))
                for (let fn in md) {
                    let folder = /strings.json$/.test(fn) ? "_locales/" : /\.md$/.test(fn) ? "../../docs/" : "built/";
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
    saveThemeJson(cfg)
    return uploader.uploadDocsAsync(...args)
}

export interface SavedProject {
    name: string;
    files: U.Map<string>;
}

export function extractAsync(filename: string) {
    let oneFile = (src: string, editor: string) => {
        let files: any = {}
        files["main." + (editor || "td")] = src || ""
        return files
    }

    return (filename == "-" || !filename
        ? nodeutil.readResAsync(process.stdin)
        : readFileAsync(filename) as Promise<Buffer>)
        .then(buf => {
            let str = buf.toString("utf8")
            if (str[0] == ":") {
                console.log("Detected .hex file.")
                return pxt.cpp.unpackSourceFromHexAsync(buf)
                    .then(data => {
                        if (!data) return null
                        if (!data.meta) data.meta = {} as any
                        let id = data.meta.cloudId || "?"
                        console.log(`.hex cloudId: ${id}`)
                        let files: U.Map<string> = null
                        try {
                            files = JSON.parse(data.source)
                        } catch (e) {
                            files = oneFile(data.source, data.meta.editor)
                        }
                        return {
                            projects: [
                                {
                                    name: data.meta.name,
                                    files: files
                                }
                            ]
                        }
                    })
            } else if (str[0] == "{") {  // JSON
                console.log("Detected .json file.")
                return JSON.parse(str)
            } else if (buf[0] == 0x5d) { // JSZ
                console.log("Detected .jsz file.")
                return pxt.lzmaDecompressAsync(buf as any)
                    .then(str => JSON.parse(str))
            } else
                return Promise.resolve(null)
        })
        .then(json => {
            if (!json) {
                console.log("Couldn't extract.")
                return
            }
            if (Array.isArray(json.scripts)) {
                console.log("Legacy TD workspace.")
                json.projects = json.scripts.map((scr: any) => ({
                    name: scr.header.name,
                    files: oneFile(scr.source, scr.header.editor)
                }))
                delete json.scripts
            }

            let prjs: SavedProject[] = json.projects

            if (!prjs) {
                console.log("No projects found.")
                return
            }

            for (let prj of prjs) {
                let dirname = prj.name.replace(/[^A-Za-z0-9_]/g, "-")
                nodeutil.mkdirP(dirname)
                for (let fn of Object.keys(prj.files)) {
                    fn = fn.replace(/[\/]/g, "-")
                    let fullname = dirname + "/" + fn
                    fs.writeFileSync(fullname, prj.files[fn])
                    console.log("Wrote " + fullname)
                }
            }
        })
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

cmd("help     [all]               - display this message", helpAsync)

cmd("init     PACKAGE_NAME        - start new package for a given target", initAsync)
cmd("install  [PACKAGE...]        - install new packages, or all packages", installAsync)

cmd("build                        - build current package", buildAsync)
cmd("deploy                       - build and deploy current package", deployAsync)
cmd("run                          - build and run current package in the simulator", runAsync)
cmd("publish                      - publish current package", publishAsync)
cmd("extract  [FILENAME]          - extract sources from .hex/.jsz file or stdin", extractAsync)
cmd("test                         - run tests on current package", testAsync, 1)
cmd("gendocs                      - build current package and its docs", gendocsAsync, 1)
cmd("format   [-i] file.ts...     - pretty-print TS files; -i = in-place", formatAsync, 1)
cmd("testdir  DIR                 - compile files from DIR one-by-one", testDirAsync, 1)
cmd("testconv JSONURL             - test TD->TS converter", testConverterAsync, 2)

cmd("serve    [-yt]               - start web server for your local target; -yt = use local yotta build", serveAsync)
cmd("update                       - update pxt-core reference and install updated version", updateAsync)
cmd("buildtarget                  - build pxtarget.json", () => buildTargetAsync().then(() => { }), 1)
cmd("pubtarget                    - publish all bundled target libraries", publishTargetAsync, 1)
cmd("bump                         - bump target patch version", bumpAsync, 1)
cmd("uploadart FILE               - upload one art resource", uploader.uploadArtFileAsync, 1)
cmd("uploadtrg [LABEL]            - upload target release", uploadtrgAsync, 1)
cmd("uploaddoc [docs/foo.md...]   - push/upload docs to server", uploadDocsAsync, 1)
cmd("staticpkg [DIR]              - setup files for serving from simple file server", staticpkgAsync, 1)
cmd("checkdocs                    - check docs for broken links, typing errors, etc...", uploader.checkDocsAsync, 1)

cmd("ghpinit                      - setup GitHub Pages (create gh-pages branch) hosting for target", ghpInitAsync, 1)
cmd("ghppush                      - build static package and push to GitHub Pages", ghpPushAsync, 1)

cmd("login    ACCESS_TOKEN        - set access token config variable", loginAsync)

cmd("api      PATH [DATA]         - do authenticated API call", apiAsync, 1)
cmd("pokecloud                    - same as 'api pokecloud {}'", () => apiAsync("pokecloud", "{}"), 2)
cmd("ptr      PATH [TARGET]       - get PATH, or set PATH to TARGET (publication id, redirect, or \"delete\")", ptrAsync, 1)
cmd("ptrcheck                     - check pointers in the cloud against ones in the repo", ptrcheckAsync, 1)
cmd("travis                       - upload release and npm package", travisAsync, 1)
cmd("uploadfile PATH              - upload file under <CDN>/files/PATH", uploadFileAsync, 1)
cmd("service  OPERATION           - simulate a query to web worker", serviceAsync, 2)
cmd("time                         - measure performance of the compiler on the current package", timeAsync, 2)

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

    if (!Cloud.accessToken && reason.statusCode == 403) {
        console.error("Got HTTP 403. Did you forget to 'pxt login' ?")
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

    process.stderr.write(`Using PXT/${trg.id} from ${targetDir}.\n`)

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
    let targetdir = process.cwd()
    while (true) {
        if (fs.existsSync(targetdir + "/pxtarget.json")) break;
        let newone = path.resolve(targetdir + "/..")
        if (newone == targetdir) {
            targetdir = path.resolve(path.join(__dirname, "../../.."))
            break
        } else {
            targetdir = newone
        }
    }
    if (!fs.existsSync(targetdir + "/pxtarget.json")) {
        targetdir = path.resolve(path.join(__dirname, ".."))
        if (!fs.existsSync(targetdir + "/pxtarget.json")) {
            console.error("Cannot find pxtarget.json")
            process.exit(1)
        }
    }
    mainCli(targetdir);
}
