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
import Map = pxt.Map;

import * as server from './server';
import * as uploader from './uploader';

let forceCloudBuild = process.env["KS_FORCE_CLOUD"] === "yes"

function initTargetCommands() {
    let cmdsjs = path.join(process.cwd(), nodeutil.targetDir, 'built/cmds.js');
    if (fs.existsSync(cmdsjs)) {
        pxt.debug(`loading cli extensions...`)
        let cli = require.main.require(cmdsjs)
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

function reportDiagnostics(diagnostics: pxtc.KsDiagnostic[]): void {
    for (const diagnostic of diagnostics) {
        reportDiagnostic(diagnostic);
    }
}

function reportDiagnosticSimply(diagnostic: pxtc.KsDiagnostic): void {
    let output = "";

    if (diagnostic.fileName) {
        output += `${diagnostic.fileName}(${diagnostic.line + 1},${diagnostic.character + 1}): `;
    }

    const category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
    output += `${category} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
    pxt.log(output);
}

function fatal(msg: string): Promise<any> {
    pxt.log("Fatal error: " + msg)
    throw new Error(msg)
}

export let globalConfig: UserConfig = {}

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

function searchAsync(...query: string[]) {
    return pxt.github.searchAsync(query.join(" "))
        .then(res => {
            for (let r of res.items) {
                console.log(`${r.full_name}: ${r.description}`)
            }
        })
}

function pkginfoAsync(repopath: string) {
    let parsed = pxt.github.parseRepoId(repopath)
    if (!parsed) {
        console.log('Unknown repo');
        return Promise.resolve();
    }

    let pkgInfo = (cfg: pxt.PackageConfig) => {
        console.log(`Name: ${cfg.name}`)
        console.log(`Description: ${cfg.description}`)
    }

    if (parsed.tag)
        return pxt.github.downloadPackageAsync(repopath)
            .then(pkg => {
                let cfg: pxt.PackageConfig = JSON.parse(pkg.files[pxt.configName])
                pkgInfo(cfg)
                console.log(`Size: ${JSON.stringify(pkg.files).length}`)
            })

    return pxt.github.pkgConfigAsync(parsed.repo)
        .then(cfg => {
            pkgInfo(cfg)
            return pxt.github.listRefsAsync(repopath)
                .then(tags => {
                    console.log("Tags: " + tags.join(", "))
                    return pxt.github.listRefsAsync(repopath, "heads")
                })
                .then(heads => {
                    console.log("Branches: " + heads.join(", "))
                })
        })
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

let readlineCount = 0
function readlineAsync() {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    readlineCount++
    return new Promise<string>((resolve, reject) => {
        process.stdin.once('data', (text: string) => {
            resolve(text)
        })
    })
}

export function queryAsync(msg: string, defl: string) {
    process.stdout.write(`${msg} [${defl}]: `)
    return readlineAsync()
        .then(text => {
            text = text.trim()
            if (!text) return defl
            else return text
        })
}

export function yesNoAsync(msg: string): Promise<boolean> {
    process.stdout.write(msg + " (y/n): ")
    return readlineAsync()
        .then(text => {
            if (text.trim().toLowerCase() == "y")
                return Promise.resolve(true)
            else if (text.trim().toLowerCase() == "n")
                return Promise.resolve(false)
            else return yesNoAsync(msg)
        })
}

function ptrcheckAsync(cmd: string) {
    let prefixIgnore: string[] = []
    let exactIgnore: Map<boolean> = {}

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
        .filter(e => /\.(md|html)$/.test(e))
        .map(e => {
            let s = e.slice(5).replace(/\.(md|html)$/, "")
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

            return yesNoAsync("Delete all these pointers?")
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

function allFiles(top: string, maxDepth = 8, allowMissing = false): string[] {
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
        .concat(allFiles(pref + "built/web/vs", 4))

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
            .then(() => uploader.checkDocsAsync())
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
            if (currVer != "*" && pxt.semver.strcmp(currVer, newVer) > 0) {
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

function justBumpPkgAsync() {
    ensurePkgDir()
    return Promise.resolve()
        .then(() => spawnWithPipeAsync({
            cmd: "git",
            args: ["status", "--porcelain", "--untracked-files=no"]
        }))
        .then(buf => {
            if (buf.length)
                U.userError("Please commit all files to git before running 'pxt bump'")
            return mainPkg.loadAsync()
        })
        .then(() => {
            let v = pxt.semver.parse(mainPkg.config.version)
            v.patch++
            return queryAsync("New version", pxt.semver.stringify(v))
        })
        .then(nv => {
            let v = pxt.semver.parse(nv)
            mainPkg.config.version = pxt.semver.stringify(v)
            mainPkg.saveConfig()
        })
        .then(() => runGitAsync("commit", "-a", "-m", mainPkg.config.version))
        .then(() => runGitAsync("tag", "v" + mainPkg.config.version))
}

function bumpAsync() {
    if (fs.existsSync(pxt.configName))
        return Promise.resolve()
            .then(() => runGitAsync("pull"))
            .then(() => justBumpPkgAsync())
            .then(() => runGitAsync("push", "--tags"))
            .then(() => runGitAsync("push"))
    else if (fs.existsSync("pxtarget.json"))
        return Promise.resolve()
            .then(() => runGitAsync("pull"))
            .then(() => bumpKsDepAsync())
            .then(() => runNpmAsync("version", "patch"))
            .then(() => runGitAsync("push", "--tags"))
            .then(() => runGitAsync("push"))
    else {
        throw U.userError("Couldn't find package or target JSON file; nothing to bump")
    }
}

function runGitAsync(...args: string[]) {
    return spawnAsync({
        cmd: "git",
        args: args,
        cwd: "."
    })
}

function runNpmAsync(...args: string[]) {
    console.log("npm", args);
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
    let fp = forkPref()
    let forkFiles = (name: string) => {
        if (fp)
            // make sure for the local files to follow fork files - this is the overriding order
            return allFiles(fp + name).concat(allFiles(name, 8, true))
        else
            return allFiles(name)
    }
    let lst = onlyExts(forkFiles("built"), [".js", ".css", ".json", ".webmanifest"])
        .concat(forkFiles("sim/public"))
    // the cloud only accepts *.json and sim* files in targets - TODO is this still true?
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
        fileList: pxtFileList(forkPref() + "node_modules/pxt-core/").concat(targetFileList()),
        pkgversion: pkgVersion(),
        fileContent: {}
    })
}

interface UploadOptions {
    fileList: string[];
    pkgversion: string;
    fileContent?: Map<string>;
    label?: string
    legacyLabel?: boolean;
    target?: string;
    localDir?: string;
}

function uploadFileName(p: string) {
    return p.replace(/^.*(built\/web\/|\w+\/public\/|built\/)/, "")
}

function uploadCoreAsync(opts: UploadOptions) {
    let liteId = "<none>"

    let replacements: Map<string> = {
        "/sim/simulator.html": "@simUrl@",
        "/sim/siminstructions.html": "@partsUrl@",
        "/sim/sim.webmanifest": "@relprefix@webmanifest",
        "/embed.js": "@targetUrl@@relprefix@embed",
        "/cdn/": "@pxtCdnUrl@",
        "/doccdn/": "@pxtCdnUrl@",
        "/sim/": "@targetCdnUrl@",
        "data-manifest=\"\"": "@manifest@",
        "var pxtConfig = null": "var pxtConfig = @cfg@",
    }


    if (opts.localDir) {
        let cfg: pxt.WebConfig = {
            "relprefix": opts.localDir,
            "workerjs": opts.localDir + "worker.js",
            "tdworkerjs": opts.localDir + "tdworker.js",
            "monacoworkerjs": opts.localDir + "monacoworker.js",
            "pxtVersion": opts.pkgversion,
            "pxtRelId": "",
            "pxtCdnUrl": opts.localDir,
            "targetVersion": opts.pkgversion,
            "targetRelId": "",
            "targetCdnUrl": opts.localDir,
            "targetUrl": "",
            "targetId": opts.target,
            "simUrl": opts.localDir + "simulator.html",
            "partsUrl": opts.localDir + "siminstructions.html",
            "runUrl": opts.localDir + "run.html",
            "docsUrl": opts.localDir + "docs.html",
            "isStatic": true,
        }
        replacements = {
            "/embed.js": opts.localDir + "embed.js",
            "/cdn/": opts.localDir,
            "/doccdn/": opts.localDir,
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
        "siminstructions.html",
        "release.manifest",
        "worker.js",
        "tdworker.js",
        "monacoworker.js",
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

        let fileName = uploadFileName(p)
        let mime = U.getMime(p)
        let isText = /^(text\/.*|application\/.*(javascript|json))$/.test(mime)
        let content = ""
        let data: Buffer;
        return rdf.then((rdata: Buffer) => {
                data = rdata;
                if (isText) {
                    content = data.toString("utf8")
                    if (fileName == "index.html") {
                        content = server.expandHtml(content)
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
                    } else if (fileName == "target.json") {
                        let trg: pxt.TargetBundle = JSON.parse(content)
                        if (opts.localDir) {
                            for (let e of trg.appTheme.docMenu)
                                if (e.path[0] == "/") {
                                    e.path = opts.localDir + "docs" + e.path + ".html"
                                }
                            trg.appTheme.logoUrl = opts.localDir
                            trg.appTheme.homeUrl = opts.localDir
                            data = new Buffer(JSON.stringify(trg, null, 2), "utf8")
                        } else {
                            // expand usb help pages
                            return Promise.all(
                                (trg.appTheme.usbHelp || []).filter(h => !!h.path)
                                    .map(h => uploader.uploadArtAsync(h.path, true)
                                        .then(blob => {
                                            console.log(`target.json patch:    ${h.path} -> ${blob}`)
                                            h.path = blob;
                                        }))
                            ).then(() => {
                                content = JSON.stringify(trg, null, 2);
                            })
                        }
                    }
                } else {
                    content = data.toString("base64")
                }
                return Promise.resolve()
            }).then(() => {

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
                }).then(resp => {
                    console.log(fileName, mime)
                })
            })
    }

    // only keep the last version of each uploadFileName()
    opts.fileList = U.values(U.toDictionary(opts.fileList, uploadFileName))

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
            if (!U.startsWith(opts.label, pxt.appTarget.id))
                opts.label = pxt.appTarget.id + "/" + opts.label
            if (opts.legacyLabel) return Cloud.privatePostAsync(liteId + "/label", { name: opts.label })
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
    if (forkPref()) {
        let cfgF: pxt.TargetBundle = readJson(forkPref() + "pxtarget.json")
        U.jsonMergeFrom(cfgF, cfg)
        return cfgF
    }
    return cfg
}

function forEachBundledPkgAsync(f: (pkg: pxt.MainPackage) => Promise<void>) {
    let prev = process.cwd()
    return Promise.mapSeries(pxt.appTarget.bundleddirs, (dirname) => {
        console.log("building in " + dirname)
        process.chdir(path.join(nodeutil.targetDir, dirname))
        mainPkg = new pxt.MainPackage(new Host())
        return f(mainPkg);
    })
        .finally(() => process.chdir(prev))
        .then(() => { })
}

export interface SpawnOptions {
    cmd: string;
    args: string[];
    cwd?: string;
    shell?: boolean;
    pipe?: boolean;
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
            env: process.env,
            stdio: opts.pipe ? [process.stdin, "pipe", process.stderr] : "inherit",
            shell: opts.shell || false
        } as any)
        let bufs: Buffer[] = []
        if (opts.pipe)
            ch.stdout.on('data', (buf: Buffer) => {
                bufs.push(buf)
                process.stdout.write(buf)
            })
        ch.on('close', (code: number) => {
            if (code != 0)
                reject(new Error("Exit code: " + code + " from " + info))
            resolve(Buffer.concat(bufs))
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
    if (pxt.appTarget.forkof || pxt.appTarget.id == "core")
        return buildTargetCoreAsync()
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

    if (!fs.existsSync("node_modules/typescript")) {
        U.userError("Oops, typescript does not seem to be installed, did you run 'npm install'?");
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

function buildPxtAsync(includeSourceMaps = false): Promise<string[]> {
    let ksd = "node_modules/pxt-core"
    if (!fs.existsSync(ksd + "/pxtlib/main.ts")) return Promise.resolve([]);

    console.log(`building ${ksd}...`);
    return spawnAsync({
        cmd: addCmd("jake"),
        args: includeSourceMaps ? ["sourceMaps=true"] : [],
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
    cfg.appTheme.description = cfg.description

    // expand logo
    let logos = (cfg.appTheme as any as Map<string>);
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

    cfg.appTheme.locales = {}

    let lpath = "docs/_locales"
    if (fs.existsSync(lpath)) {
        for (let loc of fs.readdirSync(lpath)) {
            let fn = lpath + "/" + loc + "/_theme.json"
            if (fs.existsSync(fn))
                cfg.appTheme.locales[loc.toLowerCase()] = readJson(fn)
        }
    }

    if (fs.existsSync("built/templates.json")) {
        cfg.appTheme.htmlTemplates = readJson("built/templates.json")
    }

    nodeutil.mkdirP("built");
    fs.writeFileSync("built/theme.json", JSON.stringify(cfg.appTheme, null, 2))
}

let forkPref = server.forkPref

function buildTargetCoreAsync() {
    let cfg = readLocalPxTarget()
    cfg.bundledpkgs = {}
    pxt.appTarget = cfg;
    let statFiles: Map<number> = {}
    let isFork = !!pxt.appTarget.forkof
    if (isFork)
        forceCloudBuild = true
    cfg.bundleddirs = cfg.bundleddirs.map(s => forkPref() + s)
    dirsToWatch = cfg.bundleddirs.slice()
    if (!isFork && pxt.appTarget.id != "core") {
        dirsToWatch.push("sim"); // simulator
        dirsToWatch = dirsToWatch.concat(
            fs.readdirSync("sim")
                .map(p => path.join("sim", p))
                .filter(p => fs.statSync(p).isDirectory()));
    }
    console.log(`building target.json in ${process.cwd()}...`)
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
                pxt: pxt.appTarget.id == "core" ?
                    readJson("package.json")["version"] :
                    readJson(forkPref() + "node_modules/pxt-core/package.json")["version"],
            }

            saveThemeJson(cfg)

            const webmanifest = buildWebManifest(cfg)
            const webmanifestjson = JSON.stringify(cfg, null, 2)
            fs.writeFileSync("built/target.json", webmanifestjson)
            pxt.appTarget = cfg; // make sure we're using the latest version
            let targetlight = U.flatClone(cfg)
            delete targetlight.bundleddirs
            delete targetlight.bundledpkgs
            delete targetlight.appTheme
            const targetlightjson = JSON.stringify(targetlight, null, 2);
            fs.writeFileSync("built/targetlight.json", targetlightjson)
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

function buildAndWatchTargetAsync(includeSourceMaps = false) {
    if (forkPref() && fs.existsSync("pxtarget.json")) {
        console.log("Assuming target fork; building once.")
        return buildTargetAsync()
    }

    if (!fs.existsSync("sim/tsconfig.json")) {
        console.log("No sim/tsconfig.json; assuming npm installed package")
        return Promise.resolve()
    }

    return buildAndWatchAsync(() => buildPxtAsync(includeSourceMaps)
        .then(() => buildTargetAsync().then(r => { }, e => {
            buildFailed("target build failed: " + e.message, e)
        }))
        .then(() => [path.resolve("node_modules/pxt-core")].concat(dirsToWatch)));
}

function cpR(src: string, dst: string, maxDepth = 8) {
    src = path.resolve(src)
    let files = allFiles(src, maxDepth)
    let dirs: Map<boolean> = {}
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
    let docsTemplate = server.expandDocFileTemplate("docs.html")
    docsTemplate = U.replaceAll(docsTemplate, "/cdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/doccdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/docfiles/", webpath + "docfiles/")
    docsTemplate = U.replaceAll(docsTemplate, "/--embed", webpath + "embed.js")

    let dirs: Map<boolean> = {}
    for (let f of allFiles("docs", 8)) {
        let dd = path.join(dst, f)
        let dir = path.dirname(dd)
        if (!U.lookup(dirs, dir)) {
            nodeutil.mkdirP(dir)
            dirs[dir] = true
        }
        let buf = fs.readFileSync(f)
        if (/\.(md|html)$/.test(f)) {
            let str = buf.toString("utf8")
            let path = f.slice(5).split(/\//)
            let bc = path.map((e, i) => {
                return {
                    href: "/" + path.slice(0, i + 1).join("/"),
                    name: e
                }
            })
            let html = ""
            if (U.endsWith(f, ".md"))
                html = pxt.docs.renderMarkdown(docsTemplate, str, pxt.appTarget.appTheme, null, bc, f)
            else
                html = server.expandHtml(str)
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
    let includeSourceMaps = false;
    if (arg == "-yt") {
        forceCloudBuild = false
    } else if (arg == "-cloud") {
        forceCloudBuild = true
    } else if (arg == "-just") {
        justServe = true
    } else if (arg == "-pkg") {
        justServe = true
        packaged = true
    } else if (arg == "-no-browser") {
        justServe = true
        globalConfig.noAutoStart = true
    } else if (arg == "-include-source-maps") {
        includeSourceMaps = true;
    }
    if (!globalConfig.localToken) {
        globalConfig.localToken = U.guidGen();
        saveConfig()
    }
    let localToken = globalConfig.localToken;
    if (!fs.existsSync("pxtarget.json")) {
        //Specifically when the target is being used as a library
        let targetDepLoc = nodeutil.targetDir
        if (fs.existsSync(path.join(targetDepLoc, "pxtarget.json"))) {
            console.log(`Going to ${targetDepLoc}`)
            process.chdir(targetDepLoc)
        }
        else {
            let upper = path.join(__dirname, "../../..")
            if (fs.existsSync(path.join(upper, "pxtarget.json"))) {
                console.log("going to " + upper)
                process.chdir(upper)
            } else {
                U.userError("Cannot find pxtarget.json to serve.")
            }
        }
    }
    return (justServe ? Promise.resolve() : buildAndWatchTargetAsync(includeSourceMaps))
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

let commonfiles: Map<string> = {}
let fileoverrides: Map<string> = {}

class SnippetHost implements pxt.Host {
    //Global cache of module files
    static files: Map<Map<string>> = {}

    constructor(public name: string, public main: string, public extraDependencies: string[]) { }

    resolve(module: pxt.Package, filename: string): string {
        return ""
    }

    readFile(module: pxt.Package, filename: string): string {
        if (SnippetHost.files[module.id] && SnippetHost.files[module.id][filename]) {
            return SnippetHost.files[module.id][filename]
        }
        if (module.id == "this") {
            if (filename == "pxt.json") {
                return JSON.stringify({
                    "name": this.name,
                    "dependencies": this.dependencies,
                    "description": "",
                    "files": [
                        "main.blocks", //TODO: Probably don't want this
                        "main.ts"
                    ]
                })
            }
            else if (filename == "main.ts") {
                return this.main
            }
        }
        else {
            let p1 = path.join('libs', module.id, filename)
            let p2 = path.join('libs', module.id, 'built', filename)

            let contents: string = null

            try {
                contents = fs.readFileSync(p1, 'utf8')
            }
            catch (e) {
                //console.log(e)
                try {
                    contents = fs.readFileSync(p2, 'utf8')
                }
                catch (e) {
                    //console.log(e)
                }
            }

            if (contents) {
                if (!SnippetHost.files[module.id]) {
                    SnippetHost.files[module.id] = {}
                }
                SnippetHost.files[module.id][filename] = contents
                return contents
            }
        }
        return ""
    }

    writeFile(module: pxt.Package, filename: string, contents: string) {
        SnippetHost.files[module.id][filename] = contents
    }

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<any> {
        //console.log(`getHexInfoAsync(${extInfo})`);
        return Promise.resolve()
    }

    cacheStoreAsync(id: string, val: string): Promise<void> {
        //console.log(`cacheStoreAsync(${id}, ${val})`)
        return Promise.resolve()
    }

    cacheGetAsync(id: string): Promise<string> {
        //console.log(`cacheGetAsync(${id})`)
        return Promise.resolve("")
    }

    downloadPackageAsync(pkg: pxt.Package): Promise<void> {
        //console.log(`downloadPackageAsync(${pkg.id})`)
        return Promise.resolve()
    }

    resolveVersionAsync(pkg: pxt.Package): Promise<string> {
        //console.log(`resolveVersionAsync(${pkg.id})`)
        return Promise.resolve("*")
    }

    private get dependencies(): { [key: string]: string } {
        let stdDeps: { [key: string]: string } = { }
        for (let extraDep of this.extraDependencies) {
            stdDeps[extraDep] = `file:../${extraDep}`
        }
        return stdDeps
    }
}

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
            if (module.config) {
                let addPath = module.config.additionalFilePath
                if (addPath) {
                    try {
                        return fs.readFileSync(path.join(addPath, resolved), "utf8")
                    } catch (e) {
                        return null
                    }
                }
            }
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

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<any> {
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
        return pkg.commonDownloadAsync()
            .then(resp => {
                if (resp) {
                    U.iterMap(resp, (fn: string, cont: string) => {
                        pkg.host().writeFile(pkg, fn, cont)
                    })
                    return Promise.resolve()
                }
                let proto = pkg.verProtocol()
                if (proto == "file") {
                    console.log(`skip download of local pkg: ${pkg.version()}`)
                    return Promise.resolve()
                } else {
                    return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
                }
            })
    }

}

let mainPkg = new pxt.MainPackage(new Host())

export function installAsync(packageName?: string) {
    ensurePkgDir();
    if (packageName) {
        let parsed = pxt.github.parseRepoId(packageName)
        return (parsed.tag
            ? Promise.resolve(parsed.tag)
            : pxt.github.latestVersionAsync(parsed.repo))
            .then(tag => { parsed.tag = tag })
            .then(() => pxt.github.pkgConfigAsync(parsed.repo, parsed.tag))
            .then(cfg => mainPkg.loadAsync()
                .then(() => {
                    let ver = pxt.github.stringifyRepo(parsed)
                    console.log(U.lf("Adding: {0}: {1}", cfg.name, ver))
                    mainPkg.config.dependencies[cfg.name] = ver
                    mainPkg.saveConfig()
                    mainPkg = new pxt.MainPackage(new Host())
                    return mainPkg.installAllAsync()
                }))
    } else {
        return mainPkg.installAllAsync()
            .then(() => {
                let tscfg = "tsconfig.json"
                if (!fs.existsSync(tscfg) && !fs.existsSync("../" + tscfg)) {
                    fs.writeFileSync(tscfg, defaultFiles[tscfg])
                }
            })
    }
}

const defaultFiles: Map<string> = {
    "tsconfig.json":
    `{
    "compilerOptions": {
        "target": "es5",
        "noImplicitAny": true,
        "outDir": "built",
        "rootDir": "."
    }
}
`,

    "tests.ts": `// tests go here; this will not be compiled when this package is used as a library
`,

    "Makefile": `all: deploy

build:
\tpxt build

deploy:
\tpxt deploy

test:
\tpxt test
`,

    "README.md": `# @NAME@
@DESCRIPTION@

## License
@LICENSE@

## Supported targets
* for PXT/@TARGET@
(The metadata above is needed for package search.)
`,

    ".gitignore":
    `built
node_modules
yotta_modules
yotta_targets
pxt_modules
*.db
*.tgz
`,
    ".vscode/settings.json":
    `{
    "editor.formatOnType": true,
    "files.autoSave": "afterDelay",
    "files.watcherExclude": {
        "**/.git/objects/**": true,
        "**/built/**": true,
        "**/node_modules/**": true,
        "**/yotta_modules/**": true,
        "**/yotta_targets": true,
        "**/pxt_modules/**": true
    },
    "search.exclude": {
        "**/built": true,
        "**/node_modules": true,
        "**/yotta_modules": true,
        "**/yotta_targets": true,
        "**/pxt_modules": true
    }
}`,
    ".vscode/tasks.json":
    `
// A task runner that calls the PXT compiler and
{
    "version": "0.1.0",

    // The command is pxt. Assumes that PXT has been installed using npm install -g pxt
    "command": "pxt",

    // The command is a shell script
    "isShellCommand": true,

    // Show the output window always.
    "showOutput": "always",

    "tasks": [{
        "taskName": "deploy",
        "isBuildCommand": true,
        "problemMatcher": "$tsc",
        "args": ["deploy"]
    }, {
        "taskName": "build",
        "isTestCommand": true,
        "problemMatcher": "$tsc",
        "args": ["build"]
    }, {
        "taskName": "publish",
        "problemMatcher": "$tsc",
        "args": ["publish"]
    }]
}
`
}

function addFile(name: string, cont: string) {
    let ff = mainPkg.getFiles()
    if (ff.indexOf(name) < 0) {
        mainPkg.config.files.push(name)
        mainPkg.saveConfig()
        console.log(U.lf("Added {0} to files in {1}.", name, pxt.configName))
    }

    if (!fs.existsSync(name)) {
        let vars: Map<string> = {}
        let cfg = mainPkg.config as any
        for (let k of Object.keys(cfg)) {
            if (typeof cfg[k] == "string")
                vars[k] = cfg
        }
        vars["ns"] = mainPkg.config.name.replace(/[^a-zA-Z0-9]/g, "_")
        cont = cont.replace(/@([a-z]+)@/g, (f, k) => U.lookup(vars, k) || "")
        fs.writeFileSync(name, cont)
        console.log(U.lf("Wrote {0}.", name))
    } else {
        console.log(U.lf("Not overwriting {0}.", name))
    }
}


function addAsmAsync() {
    addFile("helpers.asm", `; example helper function
@ns@_helper:
    push {lr}
    adds r0, r0, r1
    pop {pc}
`)

    addFile("helpers.ts",
        `namespace @ns@ {
    /**
     * Help goes here.
     */
    //% shim=@ns@_helper
    export function helper(x: number, y: number) {
        // Dummy implementation for the simulator.
        return x - y
    }
}
`)
    return Promise.resolve()
}

function addCppAsync() {
    addFile("extension.cpp",
        `#include "pxt.h"
using namespace pxt;
namespace @ns@ {
    //%
    int extfun(int x, int y) {
        return x + y;
    }
}
`)
    addFile("extension.ts",
        `namespace @ns@ {
    /**
     * Help goes here.
     */
    //% shim=@ns@::extfun
    export function extfun(x: number, y: number) {
        // Dummy implementation for the simulator.
        return x - y
    }
}
`)

    addFile("shims.d.ts", "// Will be auto-generated if needed.\n")
    addFile("enums.d.ts", "// Will be auto-generated if needed.\n")

    return Promise.resolve()
}

export function addAsync(...args: string[]) {
    cmds = []
    if (pxt.appTarget.compile.hasHex) {
        cmd("asm - add assembly support", addAsmAsync)
        cmd("cpp - add C++ extension support", addCppAsync)
    }
    return handleCommandAsync(args, loadPkgAsync)
}

export function initAsync() {
    if (fs.existsSync(pxt.configName))
        U.userError(`${pxt.configName} already present`)

    let prj = pxt.appTarget.tsprj;
    let config = U.clone(prj.config);

    config.name = path.basename(path.resolve(".")).replace(/^pxt-/, "")
    config.public = true

    let configMap: Map<string> = config as any

    if (!config.license)
        config.license = "MIT"
    if (!config.version)
        config.version = "0.0.0"

    // hack: remove microbit-radio, as we don't want it in all libraries
    delete config.dependencies["microbit-radio"]

    return Promise.mapSeries(["name", "description", "license"], f =>
        queryAsync(f, configMap[f])
            .then(r => {
                configMap[f] = r
            }))
        .then(() => {
            let files: Map<string> = {};
            for (let f in defaultFiles)
                files[f] = defaultFiles[f];
            for (let f in prj.files)
                files[f] = prj.files[f];

            let pkgFiles = Object.keys(files).filter(s =>
                /\.(md|ts|asm|cpp|h)$/.test(s))

            let fieldsOrder = [
                "name",
                "version",
                "description",
                "license",
                "dependencies",
                "files",
                "testFiles",
                "public"
            ]

            config.files = pkgFiles.filter(s => !/test/.test(s));
            config.testFiles = pkgFiles.filter(s => /test/.test(s));

            // make it look nice
            let newCfg: any = {}
            for (let f of fieldsOrder) {
                if (configMap.hasOwnProperty(f))
                    newCfg[f] = configMap[f]
            }
            for (let f of Object.keys(configMap)) {
                if (!newCfg.hasOwnProperty(f))
                    newCfg[f] = configMap[f]
            }

            files["pxt.json"] = JSON.stringify(newCfg, null, 4) + "\n"

            configMap = U.clone(configMap)
            configMap["target"] = pxt.appTarget.id

            U.iterMap(files, (k, v) => {
                v = v.replace(/@([A-Z]+)@/g, (f, n) => configMap[n.toLowerCase()] || "")
                nodeutil.mkdirP(path.dirname(k))
                fs.writeFileSync(k, v)
            })

            console.log("Package initialized.")
            console.log("Try 'pxt add' to add optional features.")
        })
        .then(() => installAsync())
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
    let min: Map<number> = null;
    let loop = () =>
        mainPkg.buildAsync(mainPkg.getTargetOptions())
            .then(res => {
                if (!min) {
                    min = res.times
                } else {
                    U.iterMap(min, (k, v) => {
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

function patchHexInfo(extInfo: pxtc.ExtensionInfo) {
    let infopath = ytPath + "/yotta_modules/" + pxt.appTarget.compileService.yottaCorePackage + "/generated/metainfo.json"

    let hexPath = ytPath + "/build/" + pxt.appTarget.compileService.yottaTarget + "/source/pxt-microbit-app-combined.hex"

    let hexinfo = readJson(infopath)
    hexinfo.hex = fs.readFileSync(hexPath, "utf8").split(/\r?\n/)

    return hexinfo
}

function buildHexAsync(extInfo: pxtc.ExtensionInfo) {
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

    U.iterMap(allFiles, (fn, v) => {
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
    let vals: Map<string> = {}
    let done: Map<string> = {}

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
        let fc: Map<string> = {}
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
                let tmp = pxtc.format(input, 0)
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

function runCoreAsync(res: pxtc.CompileResult) {
    let f = res.outfiles[pxtc.BINARY_JS]
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

function simulatorCoverage(pkgCompileRes: pxtc.CompileResult, pkgOpts: pxtc.CompileOptions) {
    let decls: Map<ts.Symbol> = {}

    if (!pkgOpts.extinfo || pkgOpts.extinfo.functions.length == 0) return

    let opts: pxtc.CompileOptions = {
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

    let simDeclRes = pxtc.compile(opts)
    reportDiagnostics(simDeclRes.diagnostics);
    let typechecker = simDeclRes.ast.getTypeChecker()
    let doSymbol = (sym: ts.Symbol) => {
        if (sym.getFlags() & ts.SymbolFlags.HasExports) {
            typechecker.getExportsOfModule(sym).forEach(doSymbol)
        }
        decls[pxtc.getFullName(typechecker, sym)] = sym
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
        let simName = pxtc.shimToJs(shim)
        let sym = U.lookup(decls, simName)
        if (!sym) {
            console.log("missing in sim:", simName)
        }
    }

    /*
    let apiInfo = pxtc.getApiInfo(pkgCompileRes.ast)
    for (let ent of U.values(apiInfo.byQName)) {
        let shim = ent.attributes.shim
        if (shim) {
            let simName = pxtc.shimToJs(shim)
            let sym = U.lookup(decls, simName)
            if (!sym) {
                console.log("missing in sim:", simName)
            }
        }
    }
    */
}

function testForBuildTargetAsync() {
    let opts: pxtc.CompileOptions
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
            return pxtc.compile(opts)
        })
        .then(res => {
            reportDiagnostics(res.diagnostics);
            if (!res.success) U.userError("Test failed")
            if (!pxt.appTarget.forkof)
                simulatorCoverage(res, opts)
        })
}

function simshimAsync() {
    console.log("Looking for shim annotations in the simulator.")
    let prog = pxtc.plainTsc("sim")
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

function patchOpts(opts: pxtc.CompileOptions, fn: string, content: string) {
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

function compilesOK(opts: pxtc.CompileOptions, fn: string, content: string) {
    let opts2 = patchOpts(opts, fn, content)
    let res = pxtc.compile(opts2)
    reportDiagnostics(res.diagnostics);
    if (!res.success) {
        console.log("ERRORS", fn)
    }
    return res.success
}

function getApiInfoAsync() {
    return prepBuildOptionsAsync(BuildOption.GenDocs)
        .then(pxtc.compile)
        .then(res => {
            return pxtc.getApiInfo(res.ast, true)
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
                        let res = pxtc.compile(opts)
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
                            fs.unlink(hexPath, (err) => { }) // ignore errors
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

function testDecompilerAsync(dir: string): Promise<void> {
    const filenames: string[] = [];

    const baselineDir = path.resolve(dir, "baselines")

    try {
        const stats = fs.statSync(baselineDir);
        if (!stats.isDirectory()) {
            console.error(baselineDir + " is not a directory; unable to run decompiler tests");
            process.exit(1);
        }
    }
    catch (e) {
        console.error(baselineDir + " does not exist; unable to run decompiler tests");
        process.exit(1);
    }

    for (const file of fs.readdirSync(dir)) {
        if (file[0] == ".") {
            continue;
        }

        const filename = path.join(dir, file)
        if (U.endsWith(file, ".ts")) {
            filenames.push(filename)
        }
    }

    const errors: string[] = [];

    return Promise.mapSeries(filenames, filename => {
        const basename = path.basename(filename);
        const baselineFile = path.join(baselineDir, replaceFileExtension(basename, ".blocks"))

        let baselineExists: boolean;
        try {
            const stats = fs.statSync(baselineFile)
            baselineExists = stats.isFile()
        }
        catch (e) {
            baselineExists = false
        }

        if (!baselineExists) {
            // Don't kill the promise chain, just push an error
            errors.push(`decompiler test FAILED; ${basename} does not have a baseline at ${baselineFile}`)
            return Promise.resolve()
        }

        return decompileAsyncWorker(filename)
            .then(decompiled => {
                const baseline = fs.readFileSync(baselineFile, "utf8")
                if (compareBaselines(decompiled, baseline)) {
                    console.log(`decompiler test OK: ${basename}`);
                }
                else {
                    const outFile = path.join(replaceFileExtension(filename, ".local.blocks"))
                    fs.writeFileSync(outFile, decompiled)
                    errors.push((`decompiler test FAILED; ${basename} did not match baseline, output written to ${outFile})`));
                }
            }, error => {
                errors.push((`decompiler test FAILED; ${basename} was unable to decompile due to: ${error}`))
            })
    })
        .then(() => {
            if (errors.length) {
                errors.forEach(e => console.log(e));
                console.error(`${errors.length} decompiler test failure(s)`);
                process.exit(1);
            }
            else {
                console.log(`${filenames.length} decompiler test(s) OK`);
            }
        });
}

function compareBaselines(a: string, b: string): boolean {
    // Ignore whitespace
    return a.replace(/\s/g, "") === b.replace(/\s/g, "")
}

function replaceFileExtension(file: string, extension: string) {
    return file && file.substr(0, file.length - path.extname(file).length) + extension;
}

function decompileAsync(...fileNames: string[]) {
    return Promise.mapSeries(fileNames, f => {
        const outFile = replaceFileExtension(f, ".blocks")
        return decompileAsyncWorker(f)
            .then(result => {
                fs.writeFileSync(outFile, result)
                console.log("Wrote " + outFile)
            })
    })
        .then(() => {
            console.log("Done")
        }, error => {
            console.log("Error: " + error)
        })
}

function decompileAsyncWorker(f: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const input = fs.readFileSync(f, "utf8")
        const pkg = new pxt.MainPackage(new SnippetHost("decompile-pkg", input, []));

        pkg.getCompileOptionsAsync()
            .then(opts => {
                opts.ast = true;
                const decompiled = pxtc.decompile(opts, "main.ts");
                if (decompiled.success) {
                    resolve(decompiled.outfiles["main.blocks"]);
                }
                else {
                    reject("Could not decompile " + f)
                }
            });
    });
}

function testSnippetsAsync(...args: string[]): Promise<void> {
    let filenameMatch = new RegExp('.*')
    let ignorePreviousSuccesses = false

    for (let i = 0; i < args.length; i++) {
        if (args[i] == "-i") {
            ignorePreviousSuccesses = true
        }
        else if (args[i] == "-re" && i < args.length - 1) {
            try {
                filenameMatch = new RegExp(args[i + 1])
                i++
            }
            catch (e) {
                console.log(`"${args[0]}" could not be compiled as a regular expression, ignoring`);
                filenameMatch = new RegExp('.*')
            }
        }
    }

    let ignoreSnippets: { [k: string]: boolean } = {} //NodeJS doesn't yet support sets
    const ignorePath = "built/docs/snippets/goodsnippets.txt"

    if (ignorePreviousSuccesses && fs.existsSync(ignorePath)) {
        let numberOfIgnoreSnippets = 0
        for (let line of fs.readFileSync(ignorePath, "utf8").split("\n")) {
            ignoreSnippets[line] = true
            numberOfIgnoreSnippets++
        }
        console.log(`Ignoring ${numberOfIgnoreSnippets} snippets previously believed to be good`)
    }

    let files = uploader.getFiles().filter(f => path.extname(f) == ".md" && filenameMatch.test(path.basename(f))).map(f => path.join("docs", f))
    console.log(`checking ${files.length} documentation files`)

    let ignoreCount = 0

    let successes: string[] = []

    interface FailureInfo {
        filename: string
        diagnostics: pxtc.KsDiagnostic[]
    }

    let failures: FailureInfo[] = []

    let addSuccess = (s: string) => {
        successes.push(s)
    }

    let addFailure = (f: string, infos: pxtc.KsDiagnostic[]) => {
        failures.push({
            filename: f,
            diagnostics: infos
        })
        infos.forEach(info => console.log(`${f}:(${info.line},${info.start}): ${info.category} ${info.messageText}`));
    }

    return Promise.map(files, (fname: string) => {
        let pkgName = fname.replace(/\\/g, '-').replace('.md', '')
        let source = fs.readFileSync(fname, 'utf8')
        let snippets = uploader.getSnippets(source)
        // [].concat.apply([], ...) takes an array of arrays and flattens it
        let extraDeps: string[] = [].concat.apply([], snippets.filter(s => s.type == "package").map(s => s.code.split('\n')))
        extraDeps.push("microbit")
        let ignoredTypes = ["Text", "sig", "pre", "codecard", "cards", "package", "namespaces"]
        let snippetsToCheck = snippets.filter(s => ignoredTypes.indexOf(s.type) < 0 && !s.ignore)
        ignoreCount += snippets.length - snippetsToCheck.length

        return Promise.map(snippetsToCheck, (snippet) => {
            let name = `${pkgName}-${snippet.index}`
            if (name in ignoreSnippets && ignoreSnippets[name]) {
                ignoreCount++
                return addSuccess(name)
            }
            let pkg = new pxt.MainPackage(new SnippetHost(name, snippet.code, extraDeps))
            return pkg.getCompileOptionsAsync().then(opts => {
                opts.ast = true
                let resp = pxtc.compile(opts)

                if (resp.success) {
                    if (/block/.test(snippet.type)) {
                        //Similar to pxtc.decompile but allows us to get blocksInfo for round trip
                        let file = resp.ast.getSourceFile('main.ts');
                        let apis = pxtc.getApiInfo(resp.ast);
                        let blocksInfo = pxtc.getBlocksInfo(apis);
                        let bresp = pxtc.decompiler.decompileToBlocks(blocksInfo, file)

                        let success = !!bresp.outfiles['main.blocks']

                        if (success) {
                            return addSuccess(name)
                        }
                        else {
                            return addFailure(name, bresp.diagnostics)
                        }
                    }
                    else {
                        return addSuccess(name)
                    }
                }
                else {
                    return addFailure(name, resp.diagnostics)
                }
            }).catch((e: Error) => {
                addFailure(name, [
                    {
                        code: 4242,
                        category: ts.DiagnosticCategory.Error,
                        messageText: e.message,
                        fileName: name,
                        start: 1,
                        line: 1,
                        length: 1,
                        character: 1
                    }
                ])
            })
        })
    }, { concurrency: 4 }).then((a: any) => {
        console.log(`${successes.length}/${successes.length + failures.length} snippets compiled to blocks, ${failures.length} failed`)
        if (ignoreCount > 0) {
            console.log(`Skipped ${ignoreCount} snippets`)
        }
        console.log('--------------------------------------------------------------------------------')
        for (let f of failures) {
            console.log(f.filename)
            for (let diag of f.diagnostics) {
                console.log(`  L ${diag.line}\t${diag.messageText}`)
            }
        }
        if (filenameMatch.source == '.*' && !ignorePreviousSuccesses) {
            let successData = successes.join("\n")
            if (!fs.existsSync(path.dirname(ignorePath))) {
                fs.mkdirSync(path.dirname(ignorePath))
            }
            fs.writeFileSync(ignorePath, successData)
        }
        else {
            console.log("Some files were ignored, therefore won't write success log")
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
        .then(pxtc.compile)
        .then(res => {
            U.iterMap(res.outfiles, (fn, c) =>
                mainPkg.host().writeFile(mainPkg, "built/" + fn, c))
            reportDiagnostics(res.diagnostics);
            if (!res.success) {
                process.exit(1)
            }

            console.log("Package built; hexsize=" + (res.outfiles[pxtc.BINARY_HEX] || "").length)

            if (mode == BuildOption.GenDocs) {
                let apiInfo = pxtc.getApiInfo(res.ast)
                // keeps apis from this module only
                for (let infok in apiInfo.byQName) {
                    let info = apiInfo.byQName[infok];
                    if (info.pkg &&
                        info.pkg != mainPkg.config.name) delete apiInfo.byQName[infok];
                }
                let md = pxtc.genMarkdown(mainPkg.config.name, apiInfo, { package: mainPkg.config.name != pxt.appTarget.corepkg })
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
    let info = travisInfo()
    if (info.tag || (info.branch && info.branch != "master"))
        return Promise.resolve()
    let cfg = readLocalPxTarget()
    uploader.saveThemeJson = () => saveThemeJson(cfg)
    return uploader.uploadDocsAsync(...args)
}

export interface SavedProject {
    name: string;
    files: Map<string>;
}

export function extractAsync(filename: string) {
    let oneFile = (src: string, editor: string) => {
        let files: any = {}
        files["main." + (editor || "td")] = src || ""
        return files
    }

    return (filename == "-" || !filename
        ? nodeutil.readResAsync(process.stdin)
        : /^https?:/.test(filename) ?
            U.requestAsync({ url: filename })
                .then(resp => {
                    let m = /^(https:\/\/[^\/]+\/)([a-z]+)$/.exec(filename)
                    if (m && /^<!doctype/i.test(resp.text))
                        return U.requestAsync({ url: m[1] + "api/" + m[2] + "/text" })
                    else return resp
                })
                .then(resp => resp.buffer)
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
                        let files: Map<string> = null
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

            if (json[pxt.configName]) {
                console.log("Raw JSON files.")
                let cfg: pxt.PackageConfig = JSON.parse(json[pxt.configName])
                let files = json
                json = {
                    projects: [{
                        name: cfg.name,
                        files: files
                    }]
                }
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
                    console.log("wrote " + fullname)
                }
                // add default files if not present
                for (let f in defaultFiles) {
                    if (prj.files[f]) continue;
                    let fullname = dirname + "/" + f
                    nodeutil.mkdirP(path.dirname(fullname))
                    fs.writeFileSync(fullname, defaultFiles[f])
                    console.log("wrote " + fullname)
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
    let m = /^(\S+)(\s*)(.*?)\s+- (.*)/.exec(desc)
    cmds.push({
        name: m[1],
        argDesc: m[3],
        desc: m[4],
        fn: cb,
        priority: priority
    })
}

cmd("help     [all]               - display this message", helpAsync)

cmd("init                         - start new package (library) in current directory", initAsync)
cmd("install  [PACKAGE...]        - install new packages, or all packages", installAsync)

cmd("build                        - build current package", buildAsync)
cmd("deploy                       - build and deploy current package", deployAsync)
cmd("run                          - build and run current package in the simulator", runAsync)
cmd("extract  [FILENAME]          - extract sources from .hex/.jsz file, stdin (-), or URL", extractAsync)
cmd("test                         - run tests on current package", testAsync, 1)
cmd("gendocs                      - build current package and its docs", gendocsAsync, 1)
cmd("format   [-i] file.ts...     - pretty-print TS files; -i = in-place", formatAsync, 1)
cmd("decompile file.ts...         - decompile ts files and produce similarly named .blocks files", decompileAsync, 1)
cmd("testdecompiler  DIR          - decompile files from DIR one-by-one and compare to baselines", testDecompilerAsync, 1)
cmd("testdir  DIR                 - compile files from DIR one-by-one", testDirAsync, 1)
cmd("testconv JSONURL             - test TD->TS converter", testConverterAsync, 2)
cmd("snippets [-re NAME] [-i]     - verifies that all documentation snippets compile to blocks", testSnippetsAsync)

cmd("serve    [-yt]               - start web server for your local target; -yt = use local yotta build", serveAsync)
cmd("update                       - update pxt-core reference and install updated version", updateAsync)
cmd("buildtarget                  - build pxtarget.json", () => buildTargetAsync().then(() => { }), 1)
cmd("bump                         - bump target or package version", bumpAsync)
cmd("uploadart FILE               - upload one art resource", uploader.uploadArtFileAsync, 1)
cmd("uploadtrg [LABEL]            - upload target release", uploadtrgAsync, 1)
cmd("uploaddoc [docs/foo.md...]   - push/upload docs to server", uploadDocsAsync, 1)
cmd("staticpkg [DIR]              - setup files for serving from simple file server", staticpkgAsync, 1)
cmd("checkdocs                    - check docs for broken links, typing errors, etc...", uploader.checkDocsAsync, 1)

cmd("ghpinit                      - setup GitHub Pages (create gh-pages branch) hosting for target", ghpInitAsync, 1)
cmd("ghppush                      - build static package and push to GitHub Pages", ghpPushAsync, 1)

cmd("login    ACCESS_TOKEN        - set access token config variable", loginAsync, 1)

cmd("add      ARGUMENTS...        - add a feature (.asm, C++ etc) to package", addAsync)
cmd("search   QUERY...            - search GitHub for a published package", searchAsync)
cmd("pkginfo  USER/REPO           - show info about named GitHub packge", pkginfoAsync)

cmd("api      PATH [DATA]         - do authenticated API call", apiAsync, 1)
cmd("pokecloud                    - same as 'api pokecloud {}'", () => apiAsync("pokecloud", "{}"), 2)
cmd("ptr      PATH [TARGET]       - get PATH, or set PATH to TARGET (publication id, redirect, or \"delete\")", ptrAsync, 1)
cmd("ptrcheck                     - check pointers in the cloud against ones in the repo", ptrcheckAsync, 1)
cmd("travis                       - upload release and npm package", travisAsync, 1)
cmd("uploadfile PATH              - upload file under <CDN>/files/PATH", uploadFileAsync, 1)
cmd("service  OPERATION           - simulate a query to web worker", serviceAsync, 2)
cmd("time                         - measure performance of the compiler on the current package", timeAsync, 2)

cmd("extension ADD_TEXT           - try compile extension", extensionAsync, 10)

function showHelp(showAll = true) {
    let f = (s: string, n: number) => {
        while (s.length < n) {
            s += " "
        }
        return s
    }
    let commandWidth = Math.max(10, 1 + Math.max(...cmds.map(cmd => cmd.name.length)))
    let argWidth = Math.max(20, 1 + Math.max(...cmds.map(cmd => cmd.argDesc.length)))
    cmds.forEach(cmd => {
        if (cmd.priority >= 10) return;
        if (showAll || !cmd.priority) {
            console.log(f(cmd.name, commandWidth) + f(cmd.argDesc, argWidth) + cmd.desc);
        }
    })
}

function handleCommandAsync(args: string[], preApply = () => Promise.resolve()) {
    let cmd = args[0]
    let cc = cmds.filter(c => c.name == cmd)[0]
    if (!cc) {
        console.log("Avaiable subcommands:")
        showHelp()
        process.exit(1)
        return Promise.resolve()
    } else {
        return preApply().then(() => cc.fn.apply(null, args.slice(1)))
    }
}

export function helpAsync(all?: string) {
    let showAll = all == "all"
    console.log("USAGE: pxt command args...")
    if (showAll) {
        console.log("All commands:")
    } else {
        console.log("Common commands (use 'pxt help all' to show all):")
    }
    showHelp(showAll)
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

function loadPkgAsync() {
    ensurePkgDir();
    return mainPkg.loadAsync()
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

export function mainCli(targetDir: string, args: string[] = process.argv.slice(2)) {
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
        let r = cc.fn.apply(null, args.slice(1))
        if (r)
            r.then(() => {
                if (readlineCount)
                    (process.stdin as any).unref();
            })
    }
}

function initGlobals() {
    let g = global as any
    g.pxt = pxt;
    g.ts = ts;
    g.pxtc = pxtc;
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
