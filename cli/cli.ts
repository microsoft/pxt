/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtsim.d.ts"/>

(global as any).pxt = pxt;

import * as nodeutil from './nodeutil';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';

import U = pxt.Util;
import Cloud = pxt.Cloud;
import Map = pxt.Map;

import * as server from './server';
import * as build from './buildengine'

let forceCloudBuild = process.env["KS_FORCE_CLOUD"] === "yes"
let forceLocalBuild = process.env["PXT_FORCE_LOCAL"] === "yes"

function initTargetCommands() {
    let cmdsjs = path.join(nodeutil.targetDir, 'built/cmds.js');
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
const targetJsPrefix = "var pxtTargetBundle = "

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
    let atok: string = process.env["PXT_ACCESS_TOKEN"] || process.env["CLOUD_ACCESS_TOKEN"]
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

export function logoutAsync() {
    globalConfig.accessToken = undefined;
    saveConfig();
    console.log('access token removed');
    return Promise.resolve();
}

function searchAsync(...query: string[]) {
    return pxt.packagesConfigAsync()
        .then(config => pxt.github.searchAsync(query.join(" "), config))
        .then(res => {
            for (let r of res) {
                console.log(`${r.fullName}: ${r.description}`)
            }
        })
}

function pkginfoAsync(repopath: string) {
    let parsed = pxt.github.parseRepoId(repopath)
    if (!parsed) {
        console.log('Unknown repo');
        return Promise.resolve();
    }

    const pkgInfo = (cfg: pxt.PackageConfig, tag?: string) => {
        console.log(`name: ${cfg.name}`)
        console.log(`description: ${cfg.description}`)
        console.log(`shareable url: ${pxt.appTarget.appTheme.embedUrl || pxt.appTarget.appTheme.homeUrl}#pub:gh/${parsed.fullName}${tag ? "#" + tag : ""}`)
    }

    return pxt.packagesConfigAsync()
        .then(config => {
            const status = pxt.github.repoStatus(parsed, config);
            console.log(`github org: ${parsed.owner}`);
            if (parsed.tag) console.log(`github tag: ${parsed.tag}`);
            console.log(`package status: ${status == pxt.github.GitRepoStatus.Approved ? "approved" : status == pxt.github.GitRepoStatus.Banned ? "banned" : "neutral"}`)
            if (parsed.tag)
                return pxt.github.downloadPackageAsync(repopath, config)
                    .then(pkg => {
                        let cfg: pxt.PackageConfig = JSON.parse(pkg.files[pxt.CONFIG_NAME])
                        pkgInfo(cfg, parsed.tag)
                        console.log(`size: ${JSON.stringify(pkg.files).length}`)
                    })

            return pxt.github.pkgConfigAsync(parsed.fullName)
                .then(cfg => {
                    pkgInfo(cfg)
                    return pxt.github.listRefsAsync(repopath)
                        .then(tags => {
                            console.log("tags: " + tags.join(", "))
                            return pxt.github.listRefsAsync(repopath, "heads")
                        })
                        .then(heads => {
                            console.log("branches: " + heads.join(", "))
                        })
                })
        })
}

export function pokeRepoAsync(opt: string, repo: string): Promise<void> {
    if (!repo) repo = opt
    let data = {
        repo: repo,
        getkey: false
    }
    if (opt == "-u") data.getkey = true
    return Cloud.privatePostAsync("pokerepo", data)
        .then(resp => {
            console.log(resp)
        })
}

export function execCrowdinAsync(cmd: string, ...args: string[]): Promise<void> {
    const prj = process.env[pxt.crowdin.PROJECT_VARIABLE] as string;
    if (!prj) {
        console.log(`crowdin upload skipped, '${pxt.crowdin.PROJECT_VARIABLE}' variable missing`);
        return Promise.resolve();
    }
    const key = process.env[pxt.crowdin.KEY_VARIABLE] as string;
    if (!key) {
        console.log(`crowdin upload skipped, '${pxt.crowdin.KEY_VARIABLE}' variable missing`);
        return Promise.resolve();
    }

    if (!args[0]) throw new Error("filename missing");
    switch (cmd.toLowerCase()) {
        case "upload": return uploadCrowdinAsync(prj, key, args[0]);
        case "download": {
            if (!args[1]) throw new Error("output path missing");
            const fn = path.basename(args[0]);
            return pxt.crowdin.downloadTranslationsAsync(prj, key, args[0], { translatedOnly: true, validatedOnly: false })
                .then(r => {
                    Object.keys(r).forEach(k => {
                        const rtranslations = stringifyTranslations(r[k]);
                        if (!rtranslations) return;

                        nodeutil.mkdirP(path.join(args[1], k));
                        const outf = path.join(args[1], k, fn);
                        console.log(`writing ${outf}`)
                        fs.writeFileSync(
                            outf,
                            rtranslations,
                            "utf8");
                    })
                })
        }
        default: throw new Error("unknown command");
    }
}

function uploadCrowdinAsync(prj: string, key: string, p: string): Promise<void> {
    const fn = path.basename(p);
    const data = JSON.parse(fs.readFileSync(p, "utf8")) as Map<string>;
    console.log(`upload ${fn} (${Object.keys(data).length} strings) to https://crowdin.com/project/${prj}`);
    return pxt.crowdin.uploadTranslationAsync(prj, key, fn, JSON.stringify(data));
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

    if (postArguments && fs.existsSync(postArguments))
        postArguments = fs.readFileSync(postArguments, "utf8");

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

function onlyExts(files: string[], exts: string[]) {
    return files.filter(f => exts.indexOf(path.extname(f)) >= 0)
}

function pxtFileList(pref: string) {
    return nodeutil.allFiles(pref + "webapp/public")
        .concat(onlyExts(nodeutil.allFiles(pref + "built/web", 1), [".js", ".css"]))
        .concat(nodeutil.allFiles(pref + "built/web/fonts", 1))
        .concat(nodeutil.allFiles(pref + "built/web/vs", 4))

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

    const rel = process.env.TRAVIS_TAG || ""
    const atok = process.env.NPM_ACCESS_TOKEN
    const npmPublish = /^v\d+\.\d+\.\d+$/.exec(rel) && atok;

    if (npmPublish) {
        let npmrc = path.join(process.env.HOME, ".npmrc")
        console.log(`Setting up ${npmrc}`)
        let cfg = "//registry.npmjs.org/:_authToken=" + atok + "\n"
        fs.writeFileSync(npmrc, cfg)
    }

    console.log("TRAVIS_TAG:", rel)

    const branch = process.env.TRAVIS_BRANCH || "local"
    const latest = branch == "master" ? "latest" : "git-" + branch
    // upload locs on build on master
    const uploadLocs = /^master$/.test(process.env.TRAVIS_BRANCH) && /^false$/.test(process.env.TRAVIS_PULL_REQUEST);

    let pkg = readJson("package.json")
    if (pkg["name"] == "pxt-core") {
        let p = npmPublish ? runNpmAsync("publish") : Promise.resolve();
        if (uploadLocs)
            p = p.then(() => execCrowdinAsync("upload", "built/strings.json"));
        return p;
    } else {
        return buildTargetAsync()
            .then(() => checkDocsAsync())
            .then(() => testSnippetsAsync())
            .then(() => {
                if (!process.env.CLOUD_ACCESS_TOKEN) {
                    // pull request, don't try to upload target
                    pxt.log('no token, skipping upload')
                    return Promise.resolve();
                }
                let trg = readLocalPxTarget()
                if (rel)
                    return uploadTargetAsync(trg.id + "/" + rel)
                        .then(() => npmPublish ? runNpmAsync("publish") : Promise.resolve())
                        .then(() => uploadLocs ? uploadTargetTranslationsAsync() : Promise.resolve());
                else
                    return uploadTargetAsync(trg.id + "/" + latest)
                        .then(() => uploadLocs ? uploadTargetTranslationsAsync() : Promise.resolve());
            })
    }
}

function bumpPxtCoreDepAsync() {
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
        .then(() => bumpPxtCoreDepAsync())
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

function bumpAsync(...args: string[]) {
    const bumpPxt = args.indexOf("--noupdate") < 0;
    if (fs.existsSync(pxt.CONFIG_NAME))
        return Promise.resolve()
            .then(() => runGitAsync("pull"))
            .then(() => justBumpPkgAsync())
            .then(() => runGitAsync("push", "--tags"))
            .then(() => runGitAsync("push"))
    else if (fs.existsSync("pxtarget.json"))
        return Promise.resolve()
            .then(() => runGitAsync("pull"))
            .then(() => bumpPxt ? bumpPxtCoreDepAsync() : Promise.resolve())
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
            return nodeutil.allFiles(fp + name).concat(nodeutil.allFiles(name, 8, true))
        else
            return nodeutil.allFiles(name)
    }
    let lst = onlyExts(forkFiles("built"), [".js", ".css", ".json", ".webmanifest"])
        .concat(forkFiles("sim/public"))
    pxt.debug(`target files: ${lst.join('\r\n    ')}`)
    return lst;
}

export function uploadTargetAsync(label?: string) {
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

interface BlobReq {
    hash: string;
    content: string;
    encoding: string;
    filename: string; // comment only
    size: number; // ditto
}

type GitTree = Map<GitEntry>;
interface GitEntry {
    hash?: string;
    subtree?: GitTree;
}

interface CommitInfo {
    tree: GitTree;
    parents: string[];
    message: string;
    target: string;
}

function uploadFileName(p: string) {
    return p.replace(/^.*(built\/web\/|\w+\/public\/|built\/)/, "")
}

function gitUploadAsync(opts: UploadOptions, uplReqs: Map<BlobReq>) {
    let reqs = U.unique(U.values(uplReqs), r => r.hash)
    console.log("Asking for", reqs.length, "hashes")
    return Promise.resolve()
        .then(() => Cloud.privatePostAsync("upload/status", {
            hashes: reqs.map(r => r.hash)
        }))
        .then(resp => {
            let missing = U.toDictionary(resp.missing as string[], s => s)
            let missingReqs = reqs.filter(r => !!U.lookup(missing, r.hash))
            let size = 0
            for (let r of missingReqs) size += r.size
            console.log("files missing: ", missingReqs.length, size, "bytes")
            return Promise.map(missingReqs,
                r => Cloud.privatePostAsync("upload/blob", r)
                    .then(() => {
                        console.log(r.filename + ": OK," + r.size + " " + r.hash)
                    }))
        })
        .then(() => {
            let roottree: Map<GitEntry> = {}
            let get = (tree: GitTree, path: string): GitEntry => {
                let subt = U.lookup(tree, path)
                if (!subt)
                    subt = tree[path] = {}
                return subt
            }
            let lookup = (tree: GitTree, path: string): GitEntry => {
                let m = /^([^\/]+)\/(.*)/.exec(path)
                if (m) {
                    let subt = get(tree, m[1])
                    U.assert(!subt.hash)
                    if (!subt.subtree) subt.subtree = {}
                    return lookup(subt.subtree, m[2])
                } else {
                    return get(tree, path)
                }
            }
            for (let fn of Object.keys(uplReqs)) {
                let e = lookup(roottree, fn)
                e.hash = uplReqs[fn].hash
            }
            let info = travisInfo()
            let data: CommitInfo = {
                message: "Upload from " + info.commitUrl,
                parents: [],
                target: pxt.appTarget.id,
                tree: roottree,
            }
            console.log("Creating commit...")
            return Cloud.privatePostAsync("upload/commit", data)
        })
        .then(res => {
            console.log("Commit:", res)
            return uploadToGitRepoAsync(opts, uplReqs)
        })
}

function uploadToGitRepoAsync(opts: UploadOptions, uplReqs: Map<BlobReq>) {
    let label = opts.label
    if (!label) return Promise.resolve()
    let tid = pxt.appTarget.id
    if (U.startsWith(label, tid + "/"))
        label = label.slice(tid.length + 1)
    if (!/^v\d/.test(label))
        return Promise.resolve()
    let repoUrl = process.env["PXT_RELEASE_REPO"]
    if (!repoUrl) {
        console.log("no $PXT_RELEASE_REPO variable; not uploading label " + label)
        return Promise.resolve()
    }
    nodeutil.mkdirP("tmp")
    let trgPath = "tmp/releases"
    let mm = /^https:\/\/([^:]+):([^@]+)@([^\/]+)(.*)/.exec(repoUrl)
    if (!mm) {
        U.userError("wrong format for $PXT_RELEASE_REPO")
    }

    let user = mm[1]
    let pass = mm[2]
    let host = mm[3]
    let netRcLine = `machine ${host} login ${user} password ${pass}\n`
    repoUrl = `https://${user}@${host}${mm[4]}`

    let homePath = process.env["HOME"] || process.env["UserProfile"]
    let netRcPath = path.join(homePath, /^win/.test(process.platform) ? "_netrc" : ".netrc")
    let prevNetRc = fs.existsSync(netRcPath) ? fs.readFileSync(netRcPath, "utf8") : null
    let newNetRc = prevNetRc ? prevNetRc + "\n" + netRcLine : netRcLine
    console.log("Adding credentials to " + netRcPath)
    fs.writeFileSync(netRcPath, newNetRc, {
        encoding: "utf8",
        mode: '600'
    })

    let cuser = process.env["USER"] || ""
    if (cuser && !/travis/.test(cuser))
        user += "-" + cuser

    let cred = [
        "-c", "credential.helper=",
        "-c", "user.name=" + user,
        "-c", "user.email=" + user + "@build.pxt.io",
    ]
    let gitAsync = (args: string[]) => spawnAsync({
        cmd: "git",
        cwd: trgPath,
        args: cred.concat(args)
    })
    let info = travisInfo()
    return Promise.resolve()
        .then(() => {
            if (fs.existsSync(trgPath)) {
                let cfg = fs.readFileSync(trgPath + "/.git/config", "utf8")
                if (cfg.indexOf("url = " + repoUrl) > 0) {
                    return gitAsync(["pull", "--depth=3"])
                } else {
                    throw U.userError(trgPath + " already exists; please remove it")
                }
            } else {
                return spawnAsync({
                    cmd: "git",
                    args: cred.concat(["clone", "--depth", "3", repoUrl, trgPath]),
                    cwd: "."
                })
            }
        })
        .then(() => {
            for (let u of U.values(uplReqs)) {
                let fpath = path.join(trgPath, u.filename)
                nodeutil.mkdirP(path.dirname(fpath))
                fs.writeFileSync(fpath, u.content, u.encoding)
            }
            // make sure there's always something to commit
            fs.writeFileSync(trgPath + "/stamp.txt", new Date().toString())
        })
        .then(() => gitAsync(["add", "."]))
        .then(() => gitAsync(["commit", "-m", "Release " + label + " from " + info.commitUrl]))
        .then(() => gitAsync(["tag", label]))
        .then(() => gitAsync(["push"]))
        .then(() => gitAsync(["push", "--tags"]))
        .then(() => {
        })
        .finally(() => {
            if (prevNetRc == null) {
                console.log("Removing " + netRcPath)
                fs.unlinkSync(netRcPath)
            } else {
                console.log("Restoring " + netRcPath)
                fs.writeFileSync(netRcPath, prevNetRc, {
                    mode: '600'
                })
            }
        })
}

function uploadArtFile(fn: string): string {
    if (!fn || /^(https?|data):/.test(fn)) return fn; // nothing to do

    return "@pxtCdnUrl@/blob/" + gitHash(fs.readFileSync("docs" + fn)) + "" + fn;
}

function gitHash(buf: Buffer) {
    let hash = crypto.createHash("sha1")
    hash.update(new Buffer("blob " + buf.length + "\u0000"))
    hash.update(buf)
    return hash.digest("hex")
}

function uploadCoreAsync(opts: UploadOptions) {
    let liteId = "<none>"

    let targetConfig = readLocalPxTarget();
    let defaultLocale = targetConfig.appTheme.defaultLocale;
    let hexCache = path.join("built", "hexcache");
    let hexFiles: string[] = [];

    if (fs.existsSync(hexCache)) {
        hexFiles = fs.readdirSync(hexCache)
            .filter(f => /\.hex$/.test(f))
            .map((f) => `@cdnUrl@/compile/${f}`);
        pxt.log(`hex cache:\n\t${hexFiles.join('\n\t')}`)
    }

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
        "@defaultLocaleStrings@": defaultLocale ? "@pxtCdnUrl@" + "locales/" + defaultLocale + "/strings.json" : "",
        "@cachedHexFiles@": hexFiles.length ? hexFiles.join("\n") : ""
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
            "@defaultLocaleStrings@": "",
            "@cachedHexFiles@": ""
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

    let uplReqs: Map<BlobReq> = {}

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
                } else if (fileName == "target.json" || fileName == "target.js") {
                    let isJs = fileName == "target.js"
                    if (isJs) content = content.slice(targetJsPrefix.length)
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
                        (trg.appTheme.usbHelp || [])
                            .forEach(h => h.path = uploadArtFile(h.path));
                        trg.appTheme.appLogo = uploadArtFile(trg.appTheme.appLogo);
                        trg.appTheme.cardLogo = uploadArtFile(trg.appTheme.cardLogo)
                        content = JSON.stringify(trg, null, 2);
                        if (isJs)
                            content = targetJsPrefix + content
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

            let req = {
                encoding: isText ? "utf8" : "base64",
                content,
                hash: "",
                filename: fileName,
                size: 0
            }
            let buf = new Buffer(req.content, req.encoding)
            req.size = buf.length
            req.hash = gitHash(buf)
            uplReqs[fileName] = req
            return Promise.resolve()
        })
    }

    // only keep the last version of each uploadFileName()
    opts.fileList = U.values(U.toDictionary(opts.fileList, uploadFileName))

    if (opts.localDir)
        return Promise.map(opts.fileList, uploadFileAsync, { concurrency: 15 })
            .then(() => {
                console.log("Release files written to", path.resolve(builtPackaged + opts.localDir))
            })

    return Promise.map(opts.fileList, uploadFileAsync, { concurrency: 15 })
        .then(() => gitUploadAsync(opts, uplReqs))
}

function readLocalPxTarget() {
    if (!fs.existsSync("pxtarget.json")) {
        console.error("This command requires pxtarget.json in current directory.")
        process.exit(1)
    }
    nodeutil.setTargetDir(process.cwd())
    let cfg: pxt.TargetBundle = readJson("pxtarget.json")
    if (forkPref()) {
        let cfgF: pxt.TargetBundle = readJson(forkPref() + "pxtarget.json")
        U.jsonMergeFrom(cfgF, cfg)
        return cfgF
    }
    return cfg
}

function forEachBundledPkgAsync(f: (pkg: pxt.MainPackage, dirname: string) => Promise<void>, includeProjects: boolean = false) {
    let prev = process.cwd()
    let folders = pxt.appTarget.bundleddirs;

    if (includeProjects) {
        let projects = nodeutil.allFiles("libs", 1, /*allowMissing*/ false, /*includeDirs*/ true).filter(f => /prj$/.test(f));
        folders = folders.concat(projects);
    }

    return Promise.mapSeries(folders, (dirname) => {
        process.chdir(path.join(nodeutil.targetDir, dirname))
        mainPkg = new pxt.MainPackage(new Host())
        return f(mainPkg, dirname);
    })
        .finally(() => process.chdir(prev))
        .then(() => { });
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
        .then(buildSemanticUIAsync)
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

function buildSemanticUIAsync() {
    if (!fs.existsSync(path.join("theme", "style.less")) ||
        !fs.existsSync(path.join("theme", "theme.config")))
        return Promise.resolve();

    let dirty = !fs.existsSync("built/web/semantic.css");
    if (!dirty) {
        const csstime = fs.statSync("built/web/semantic.css").mtime;
        dirty = nodeutil.allFiles("theme")
            .map(f => fs.statSync(f))
            .some(stat => stat.mtime > csstime);
    }

    if (!dirty) return Promise.resolve();

    nodeutil.mkdirP(path.join("built", "web"));
    return spawnAsync({
        cmd: "node",
        args: ["node_modules/less/bin/lessc", "theme/style.less", "built/web/semantic.css", "--include-path=node_modules/semantic-ui-less:node_modules/pxt-core/theme:theme/foo/bar"]
    }).then(() => {
        let fontFile = fs.readFileSync("node_modules/semantic-ui-less/themes/default/assets/fonts/icons.woff")
        let url = "url(data:application/font-woff;charset=utf-8;base64,"
            + fontFile.toString("base64") + ") format('woff')"
        let semCss = fs.readFileSync('built/web/semantic.css', "utf8")
        semCss = semCss.replace('src: url("fonts/icons.eot");', "")
            .replace(/src:.*url\("fonts\/icons\.woff.*/g, "src: " + url + ";")
        fs.writeFileSync('built/web/semantic.css', semCss)
    })
}

function buildWebStringsAsync() {
    fs.writeFileSync("built/webstrings.json", JSON.stringify(webstringsJson(), null, 4))
    return Promise.resolve()
}

function updateDefaultProjects(cfg: pxt.TargetBundle) {
    let defaultProjects = [
        pxt.BLOCKS_PROJECT_NAME,
        pxt.JAVASCRIPT_PROJECT_NAME
    ];

    nodeutil.allFiles("libs", 1, /*allowMissing*/ false, /*includeDirs*/ true)
        .filter((f) => {
            return defaultProjects.indexOf(path.basename(f)) !== -1;
        })
        .forEach((projectPath) => {
            let projectId = path.basename(projectPath);
            let newProject: pxt.ProjectTemplate = {
                id: projectId,
                config: {
                    name: "",
                    dependencies: {},
                    files: []
                },
                files: {}
            };

            nodeutil.allFiles(projectPath).forEach((f) => {
                let relativePath = path.relative(projectPath, f); // nodeutil.allFiles returns libs/blocksprj/path_to_file, this removes libs/blocksprj/
                let fileName = path.basename(relativePath);

                if (/^((built)|(pxt_modules)|(node_modules))[\/\\]/.test(relativePath) || fileName === "tsconfig.json") {
                    return;
                }

                if (fileName === "pxt.json") {
                    newProject.config = nodeutil.readJson(f);
                    U.iterMap(newProject.config.dependencies, (k, v) => {
                        if (/^file:/.test(v)) {
                            newProject.config.dependencies[k] = "*";
                        }
                    });
                } else {
                    newProject.files[relativePath] = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
                }
            });

            (<any>cfg)[projectId] = newProject;
        });
}

function buildTargetCoreAsync() {
    let previousForceCloudBuild = forceCloudBuild;
    let cfg = readLocalPxTarget()
    updateDefaultProjects(cfg);
    cfg.bundledpkgs = {}
    pxt.setAppTarget(cfg);
    let statFiles: Map<number> = {}
    let isFork = !!pxt.appTarget.forkof
    if (isFork)
        forceCloudBuild = true
    cfg.bundleddirs = cfg.bundleddirs.map(s => forkPref() + s)
    dirsToWatch = cfg.bundleddirs.slice()
    if (!isFork && pxt.appTarget.id != "core") {
        dirsToWatch.push("sim"); // simulator
        if (fs.existsSync("theme")) {
            dirsToWatch.push("theme"); // simulator
            dirsToWatch.push(path.join("theme", "site", "globals")); // simulator
        }
        dirsToWatch = dirsToWatch.concat(
            fs.readdirSync("sim")
                .map(p => path.join("sim", p))
                .filter(p => fs.statSync(p).isDirectory()));
    }

    let hexCachePath = path.resolve(process.cwd(), "built", "hexcache");
    nodeutil.mkdirP(hexCachePath);

    console.log(`building target.json in ${process.cwd()}...`)
    return forEachBundledPkgAsync((pkg, dirname) => {
        pxt.log(`building in ${dirname}`);
        let isPrj = /prj$/.test(dirname);

        if (isPrj) {
            forceCloudBuild = true;
        } else {
            forceCloudBuild = previousForceCloudBuild;
        }

        return pkg.filesToBePublishedAsync(true)
            .then(res => {
                cfg.bundledpkgs[path.basename(dirname)] = res
            })
            .then(testForBuildTargetAsync)
            .then((compileOpts) => {
                // For the projects, we need to save the base HEX file to the offline HEX cache
                if (isPrj) {
                    if (!compileOpts) {
                        console.error(`Failed to extract HEX image for project ${dirname}`);
                        return;
                    }

                    // Place the base HEX image in the hex cache if necessary
                    let sha = compileOpts.extinfo.sha;
                    let hex: string[] = compileOpts.hexinfo.hex;
                    let hexFile = path.join(hexCachePath, sha + ".hex");

                    if (fs.existsSync(hexFile)) {
                        pxt.log(`HEX image already in offline cache for project ${dirname}`);
                    } else {
                        fs.writeFileSync(hexFile, hex.join(os.EOL));
                        pxt.log(`Created HEX image in offline cache for project ${dirname}: ${hexFile}`);
                    }
                }
            })
    }, /*includeProjects*/ true)
        .finally(() => {
            forceCloudBuild = previousForceCloudBuild;
        })
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
            const targetjson = JSON.stringify(cfg, null, 2)
            fs.writeFileSync("built/target.json", targetjson)
            fs.writeFileSync("built/target.js", targetJsPrefix + targetjson)
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
        .then(() => buildTargetDocsAsync(false, true).then(r => { }, e => {
            buildFailed("target build failed: " + e.message, e)
        }))
        .then(() => [path.resolve("node_modules/pxt-core")].concat(dirsToWatch)));
}

let builtPackaged = "built/packaged"

function renderDocs(localDir: string) {
    let dst = path.resolve(builtPackaged + localDir)

    nodeutil.cpR("node_modules/pxt-core/docfiles", dst + "/docfiles")
    if (fs.existsSync("docfiles"))
        nodeutil.cpR("docfiles", dst + "/docfiles")

    let webpath = localDir
    let docsTemplate = server.expandDocFileTemplate("docs.html")
    docsTemplate = U.replaceAll(docsTemplate, "/cdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/doccdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/docfiles/", webpath + "docfiles/")
    docsTemplate = U.replaceAll(docsTemplate, "/--embed", webpath + "embed.js")

    let dirs: Map<boolean> = {}
    for (const f of nodeutil.allFiles("docs", 8)) {
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

export function serveAsync(...args: string[]) {
    forceCloudBuild = !globalConfig.localBuild
    let trimmedArgs = args.map((arg) => {
        return arg.replace(/^-*/, "");
    });
    let hasArg = (arg: string): boolean => {
        return trimmedArgs && trimmedArgs.length && trimmedArgs.indexOf(arg) !== -1;
    };

    let argValue = (arg: string): string => {
        if (trimmedArgs && trimmedArgs.length) {
            const i = trimmedArgs.indexOf(arg);
            if (i !== -1 && i < trimmedArgs.length - 1) {
                return trimmedArgs[i + 1];
            }
        }
        return undefined;
    };

    let justServe = false
    let packaged = false
    let includeSourceMaps = false;
    let browser: string = argValue("browser");

    if (hasArg("yt")) {
        forceCloudBuild = false
    } else if (hasArg("cloud")) {
        forceCloudBuild = true
    }
    if (hasArg("just")) {
        justServe = true
    } else if (hasArg("pkg")) {
        justServe = true
        packaged = true
    } else if (hasArg("no-browser")) {
        justServe = true
        globalConfig.noAutoStart = true
    }
    if (hasArg("include-source-maps")) {
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
            packaged: packaged,
            electron: hasArg("electron"),
            browser
        }))
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
            let p0 = path.join(module.id, filename);
            let p1 = path.join('libs', module.id, filename)
            let p2 = path.join('libs', module.id, 'built', filename)

            let contents: string = null

            try {
                contents = fs.readFileSync(p0, 'utf8')
            }
            catch (e) {
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

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        //console.log(`getHexInfoAsync(${extInfo})`);
        return Promise.resolve<any>(null)
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
        let stdDeps: { [key: string]: string } = {}
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
        if (!forceLocalBuild && (extInfo.onlyPublic || forceCloudBuild))
            return pxt.hex.getHexInfoAsync(this, extInfo)

        return build.buildHexAsync(build.thisBuild, mainPkg, extInfo)
            .then(() => build.thisBuild.patchHexInfo(extInfo))
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
        return pxt.packagesConfigAsync()
            .then(config => (parsed.tag ? Promise.resolve(parsed.tag) : pxt.github.latestVersionAsync(parsed.fullName, config))
                .then(tag => { parsed.tag = tag })
                .then(() => pxt.github.pkgConfigAsync(parsed.fullName, parsed.tag))
                .then(cfg => mainPkg.loadAsync()
                    .then(() => {
                        let ver = pxt.github.stringifyRepo(parsed)
                        console.log(U.lf("Adding: {0}: {1}", cfg.name, ver))
                        mainPkg.config.dependencies[cfg.name] = ver
                        mainPkg.saveConfig()
                        mainPkg = new pxt.MainPackage(new Host())
                        return mainPkg.installAllAsync()
                    }))
            );
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
    }]
}
`
}

function addFile(name: string, cont: string) {
    let ff = mainPkg.getFiles()
    if (ff.indexOf(name) < 0) {
        mainPkg.config.files.push(name)
        mainPkg.saveConfig()
        console.log(U.lf("Added {0} to files in {1}.", name, pxt.CONFIG_NAME))
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
    if (fs.existsSync(pxt.CONFIG_NAME))
        U.userError(`${pxt.CONFIG_NAME} already present`)

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

function testAssemblers(): Promise<void> {
    console.log("- testing Thumb")
    let thumb = new pxtc.thumb.ThumbProcessor();
    thumb.testAssembler();
    console.log("- done testing Thumb");
    console.log("- testing AVR")
    let avr = new pxtc.avr.AVRProcessor();
    avr.testAssembler();
    console.log("- done testing AVR");
    return Promise.resolve();
}


function testForBuildTargetAsync(): Promise<pxtc.CompileOptions> {
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
            if (!res.success) U.userError("Compiler test failed")
            if (!pxt.appTarget.forkof)
                simulatorCoverage(res, opts)
        })
        .then(() => opts);
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
        let cfgname = "libs/" + s + "/" + pxt.CONFIG_NAME
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
        } else if (fs.existsSync(full + "/" + pxt.CONFIG_NAME)) {
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

    const testBlocksDir = path.relative(process.cwd(), path.join(dir, "testBlocks"));
    let testBlocksDirExists = false;
    try {
        const stats = fs.statSync(testBlocksDir);
        testBlocksDirExists = stats.isDirectory();
    }
    catch (e) { }

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

        return decompileAsyncWorker(filename, testBlocksDirExists ? testBlocksDir : undefined)
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

function testDecompilerErrorsAsync(dir: string) {
    const filenames: string[] = [];
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
    let totalCases = 0;

    return Promise.mapSeries(filenames, filename => {
        const basename = path.basename(filename);
        let fullText: string;

        try {
            fullText = fs.readFileSync(filename, "utf8");
        }
        catch (e) {
            errors.push("Could not read " + filename)
            process.exit(1)
        }

        const cases = getCasesFromFile(fullText);
        totalCases += cases.length;

        let success = true;

        if (cases.length === 0) {
            errors.push(`decompiler error test FAILED; ${basename} contains no test cases`)
            success = false;
        }

        return Promise.mapSeries(cases, testCase => {
            const pkg = new pxt.MainPackage(new SnippetHost("decompile-error-pkg", testCase.text, []));

            return pkg.getCompileOptionsAsync()
                .then(opts => {
                    opts.ast = true;
                    try {
                        const decompiled = pxtc.decompile(opts, "main.ts");
                        if (decompiled.success) {
                            errors.push(`decompiler error test FAILED; ${basename} case "${testCase.name}" expected a decompilation error but got none`);
                            success = false;
                        }
                    }
                    catch (e) {
                        errors.push(`decompiler error test FAILED; ${basename} case "${testCase.name}" generated an exception: ${e}`);
                        success = false
                    }
                });
        })
            .then(() => {
                if (success) {
                    console.log(`decompiler error test OK: ${basename}`);
                }
            })
    })
        .then(() => {
            if (errors.length) {
                errors.forEach(e => console.log(e));
                console.error(`${errors.length} decompiler error test failure(s)`);
                process.exit(1);
            }
            else {
                console.log(`${totalCases} decompiler error test(s) OK`);
            }
        })
}

interface DecompilerErrorTestCase {
    name: string,
    text: string
}

const testCaseSeperatorRegex = /\/\/\s+@case:\s*([a-zA-z ]+)$/

function getCasesFromFile(fileText: string): DecompilerErrorTestCase[] {
    const result: DecompilerErrorTestCase[] = [];

    const lines = fileText.split("\n")

    let currentCase: DecompilerErrorTestCase;

    for (const line of lines) {
        const match = testCaseSeperatorRegex.exec(line)
        if (match) {
            if (currentCase) {
                result.push(currentCase)
            }
            currentCase = {
                name: match[1],
                text: ""
            };
        }
        else if (currentCase) {
            currentCase.text += line + "\n"
        }
    }

    if (currentCase) {
        result.push(currentCase)
    }

    return result;
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

function decompileAsyncWorker(f: string, dependency?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const input = fs.readFileSync(f, "utf8")
        const pkg = new pxt.MainPackage(new SnippetHost("decompile-pkg", input, dependency ? [dependency] : []));

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
        if (args[i] == "--i") {
            ignorePreviousSuccesses = true
        }
        else if (args[i] == "--re" && i < args.length - 1) {
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

    let files = getFiles().filter(f => path.extname(f) == ".md" && filenameMatch.test(path.basename(f))).map(f => path.join("docs", f))
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
        let snippets = getSnippets(source)
        // [].concat.apply([], ...) takes an array of arrays and flattens it
        let extraDeps: string[] = [].concat.apply([], snippets.filter(s => s.type == "package").map(s => s.code.split('\n')))
        extraDeps.push("core")
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
                    if (/^block/.test(snippet.type)) {
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
            nodeutil.mkdirP(path.dirname(ignorePath));
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
                build.buildDalConst(build.thisBuild, mainPkg);
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

interface BuildCoreOptions {
    mode: BuildOption;

    // docs
    locs?: boolean;
    docs?: boolean;
}

function buildCoreAsync(buildOpts: BuildCoreOptions): Promise<pxtc.CompileOptions> {
    let compileOptions: pxtc.CompileOptions;
    ensurePkgDir();
    return prepBuildOptionsAsync(buildOpts.mode)
        .then((opts) => {
            compileOptions = opts;
            return pxtc.compile(opts);
        })
        .then((res): Promise<void | pxtc.CompileOptions> => {
            U.iterMap(res.outfiles, (fn, c) =>
                mainPkg.host().writeFile(mainPkg, "built/" + fn, c))
            reportDiagnostics(res.diagnostics);
            if (!res.success) {
                process.exit(1)
            }

            console.log("Package built; hexsize=" + (res.outfiles[pxtc.BINARY_HEX] || "").length)

            switch (buildOpts.mode) {
                case BuildOption.GenDocs:
                    let apiInfo = pxtc.getApiInfo(res.ast)
                    // keeps apis from this module only
                    for (let infok in apiInfo.byQName) {
                        let info = apiInfo.byQName[infok];
                        if (info.pkg &&
                            info.pkg != mainPkg.config.name) delete apiInfo.byQName[infok];
                    }
                    let md = pxtc.genMarkdown(mainPkg.config.name, apiInfo, {
                        package: mainPkg.config.name != pxt.appTarget.corepkg,
                        locs: buildOpts.locs,
                        docs: buildOpts.docs
                    })
                    mainPkg.host().writeFile(mainPkg, "built/apiinfo.json", JSON.stringify(apiInfo, null, 1))
                    for (let fn in md) {
                        let folder = /strings.json$/.test(fn) ? "_locales/" : /\.md$/.test(fn) ? "../../docs/" : "built/";
                        let ffn = folder + fn;
                        mainPkg.host().writeFile(mainPkg, ffn, md[fn])
                        console.log(`generated ${ffn}; size=${md[fn].length}`)
                    }
                    return null
                case BuildOption.Deploy:
                    if (!pxt.commands.deployCoreAsync) {
                        console.log("no deploy functionality defined by this target")
                        return null;
                    }
                    return pxt.commands.deployCoreAsync(res);
                case BuildOption.Run:
                    return runCoreAsync(res);
                default:
                    return Promise.resolve();
            }
        })
        .then(() => {
            return compileOptions;
        });
}


function crowdinCredentials(): { prj: string; key: string; } {
    const prj = process.env[pxt.crowdin.PROJECT_VARIABLE] as string;
    if (!prj) {
        pxt.log(`crowdin upload skipped, '${pxt.crowdin.PROJECT_VARIABLE}' variable missing`);
        return null;
    }
    const key = process.env[pxt.crowdin.KEY_VARIABLE] as string;
    if (!key) {
        pxt.log(`crowdin upload skipped, '${pxt.crowdin.KEY_VARIABLE}' variable missing`);
        return null;
    }
    return { prj, key };
}

export function uploadTargetTranslationsAsync(...args: string[]) {
    const cred = crowdinCredentials();
    if (!cred) return Promise.resolve();
    const uploadDocs = /^--?docs$/i.test(args[0]);
    const crowdinDir = pxt.appTarget.id;
    return uploadBundledTranslationsAsync(crowdinDir, cred.prj, cred.key)
        .then(() => uploadDocs ? uploadDocsTranslationsAsync(crowdinDir, cred.prj, cred.key) : Promise.resolve());

}

function uploadDocsTranslationsAsync(crowdinDir: string, prj: string, key: string): Promise<void> {
    const todo = nodeutil.allFiles("docs").filter(f => /\.md$/.test(f) && !/_locales/.test(f));
    const knownFolders: Map<boolean> = {};
    const ensureFolderAsync = (crowdd: string) => {
        if (!knownFolders[crowdd]) {
            knownFolders[crowdd] = true;
            pxt.log(`creating folder ${crowdd}`);
            return pxt.crowdin.createDirectoryAsync(prj, key, crowdd);
        }
        return Promise.resolve();
    }
    const nextFileAsync = (): Promise<void> => {
        const f = todo.pop();
        if (!f) return Promise.resolve();
        const data = fs.readFileSync(f, 'utf8');
        const crowdf = path.join(crowdinDir, f);
        const crowdd = path.dirname(crowdf);
        pxt.log(`uploading ${f} to ${crowdf}`);
        return ensureFolderAsync(crowdd)
            .then(() => pxt.crowdin.uploadTranslationAsync(prj, key, crowdf, data))
            .then(nextFileAsync);
    }
    return ensureFolderAsync(path.join(crowdinDir, "docs"))
        .then(nextFileAsync);
}

function uploadBundledTranslationsAsync(crowdinDir: string, prj: string, key: string): Promise<void> {
    const todo: string[] = [];
    pxt.appTarget.bundleddirs.forEach(dir => {
        const locdir = path.join(dir, "_locales");
        if (fs.existsSync(locdir))
            fs.readdirSync(locdir)
                .filter(f => /strings\.json$/i.test(f))
                .forEach(f => todo.push(path.join(locdir, f)))
    });

    pxt.log(`uploading ${todo.length} files to crowdin`);
    const nextFileAsync = (): Promise<void> => {
        const f = todo.pop();
        if (!f) return Promise.resolve();
        const data = JSON.parse(fs.readFileSync(f, 'utf8')) as Map<string>;
        const crowdf = path.join(crowdinDir, path.basename(f));
        pxt.log(`uploading ${f} to ${crowdf}`);
        return pxt.crowdin.uploadTranslationAsync(prj, key, crowdf, JSON.stringify(data))
            .then(nextFileAsync);
    }
    return nextFileAsync();
}

export function downloadTargetTranslationsAsync(...args: string[]) {
    const prj = process.env[pxt.crowdin.PROJECT_VARIABLE] as string;
    if (!prj) {
        pxt.log(`crowdin upload skipped, '${pxt.crowdin.PROJECT_VARIABLE}' variable missing`);
        return Promise.resolve();
    }
    const key = process.env[pxt.crowdin.KEY_VARIABLE] as string;
    if (!key) {
        pxt.log(`crowdin upload skipped, '${pxt.crowdin.KEY_VARIABLE}' variable missing`);
        return Promise.resolve();
    }
    const crowdinDir = pxt.appTarget.id;
    const name = args[0] || "";
    const todo: string[] = [];
    pxt.appTarget.bundleddirs
        .filter(dir => !name || dir == "libs/" + name)
        .forEach(dir => {
            const locdir = path.join(dir, "_locales");
            if (fs.existsSync(locdir))
                fs.readdirSync(locdir)
                    .filter(f => /\.json$/i.test(f))
                    .forEach(f => todo.push(path.join(locdir, f)))
        });

    const nextFileAsync = (): Promise<void> => {
        const f = todo.pop();
        if (!f) return Promise.resolve();

        const fn = path.basename(f);
        const crowdf = path.join(crowdinDir, fn);
        const locdir = path.dirname(f);
        const projectdir = path.dirname(locdir);
        pxt.log(`downloading ${crowdf}`);
        pxt.log(`projectdir: ${projectdir}`)
        const locFiles: Map<string> = {};
        return pxt.crowdin.downloadTranslationsAsync(prj, key, crowdf, { translatedOnly: true, validatedOnly: true })
            .then(data => {
                Object.keys(data)
                    .filter(lang => Object.keys(data[lang]).some(k => !!data[lang][k]))
                    .forEach(lang => {
                        const langTranslations = stringifyTranslations(data[lang]);
                        if (!langTranslations) return;

                        const tfdir = path.join(locdir, lang);
                        const tf = path.join(tfdir, fn);
                        nodeutil.mkdirP(tfdir)
                        pxt.log(`writing ${tf}`);
                        fs.writeFile(tf, langTranslations, "utf8");

                        locFiles[path.relative(projectdir, tf).replace(/\\/g, '/')] = "1";
                    })
                // update pxt.json
                const pxtJsonf = path.join(projectdir, "pxt.json");
                const pxtJsons = fs.readFileSync(pxtJsonf, "utf8");
                const pxtJson = JSON.parse(pxtJsons) as pxt.PackageConfig;
                Object.keys(locFiles).filter(f => pxtJson.files.indexOf(f) < 0).forEach(f => pxtJson.files.push(f));
                const pxtJsonn = JSON.stringify(pxtJson, null, 4);
                if (pxtJsons != pxtJsonn) {
                    pxt.log(`writing ${pxtJsonf}`);
                    fs.writeFileSync(pxtJsonf, pxtJsonn, "utf8");
                }
                return nextFileAsync()
            });
    }
    return nextFileAsync();
}

function stringifyTranslations(strings: pxt.Map<string>): string {
    const trg: pxt.Map<string> = {};
    Object.keys(strings).sort().forEach(k => {
        const v = strings[k].trim();
        if (v) trg[k] = v;
    })
    if (Object.keys(trg).length == 0) return undefined;
    else return JSON.stringify(trg, null, 2);
}

export function buildAsync(arg?: string) {
    if (arg && arg.replace(/-*/g, "") === "cloud") {
        forceCloudBuild = true;
    }

    return buildCoreAsync({ mode: BuildOption.JustBuild })
        .then((compileOpts) => { });
}

export function gendocsAsync(...args: string[]) {
    const locs = args.length == 0 || args.indexOf("--locs") > -1;
    const docs = args.indexOf("--docs") > -1;
    return buildTargetDocsAsync(docs, locs);
}

export function buildTargetDocsAsync(docs: boolean, locs: boolean): Promise<void> {
    const build = () => buildCoreAsync({
        mode: BuildOption.GenDocs,
        docs,
        locs
    }).then((compileOpts) => { });
    // from target location?
    if (fs.existsSync("pxtarget.json"))
        return forEachBundledPkgAsync((pkg, dirname) => {
            pxt.log(`building in ${dirname}`);
            return build();
        });
    else return build();
}

export function deployAsync() {
    return buildCoreAsync({ mode: BuildOption.Deploy })
        .then((compileOpts) => { });
}

export function runAsync() {
    return buildCoreAsync({ mode: BuildOption.Run })
        .then((compileOpts) => { });
}

export function testAsync() {
    return buildCoreAsync({ mode: BuildOption.Test })
        .then((compileOpts) => { });
}

export interface SavedProject {
    name: string;
    files: Map<string>;
}

export function extractAsync(...args: string[]): Promise<void> {
    let vscode = false;
    let out = '.';
    console.log(args)
    if (/^--?code/i.test(args[0])) {
        vscode = true;
        args.shift();
    }
    if (/^--?out/i.test(args[0])) {
        out = args[1];
        args.shift(); args.shift();
        pxt.debug(`extracting in ${out}`);
    }
    const filename = args[0];
    return extractAsyncInternal(filename, out, vscode);
}

function extractAsyncInternal(filename: string, out: string, vscode: boolean): Promise<void> {
    if (filename && nodeutil.existDirSync(filename)) {
        pxt.log(`extracting folder ${filename}`);
        return Promise.all(fs.readdirSync(filename)
            .filter(f => /\.hex/.test(f))
            .map(f => extractAsyncInternal(path.join(filename, f), out, vscode)))
            .then(() => { });
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
        .then(buf => extractBufferAsync(buf, out))
        .then(dirs => {
            if (dirs && vscode) {
                pxt.debug('launching code...')
                dirs.forEach(dir => openVsCode(dir));
            }
        })
}

function extractBufferAsync(buf: Buffer, outDir: string): Promise<string[]> {
    const oneFile = (src: string, editor: string) => {
        let files: any = {}
        files["main." + (editor || "td")] = src || ""
        return files
    }

    return Promise.resolve()
        .then(() => {
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
                console.log("Detected .jsz/.pxt file.")
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

            if (json[pxt.CONFIG_NAME]) {
                console.log("Raw JSON files.")
                let cfg: pxt.PackageConfig = JSON.parse(json[pxt.CONFIG_NAME])
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
            const dirs = writeProjects(prjs, outDir)
            return dirs;
        })
}

function openVsCode(dirname: string) {
    child_process.exec(`code -g main.ts ${dirname}`); // notice this without a callback..                    
}

function writeProjects(prjs: SavedProject[], outDir: string): string[] {
    const dirs: string[] = [];
    for (let prj of prjs) {
        let dirname = prj.name.replace(/[^A-Za-z0-9_]/g, "-")
        for (let fn of Object.keys(prj.files)) {
            fn = fn.replace(/[\/]/g, "-")
            const fdir = path.join(outDir, dirname);
            const fullname = path.join(fdir, fn)
            nodeutil.mkdirP(path.dirname(fullname));
            fs.writeFileSync(fullname, prj.files[fn])
            console.log("wrote " + fullname)
        }
        // add default files if not present
        for (let fn in defaultFiles) {
            if (prj.files[fn]) continue;
            const fdir = path.join(outDir, dirname);
            nodeutil.mkdirP(fdir);
            const fullname = path.join(fdir, fn)
            nodeutil.mkdirP(path.dirname(fullname));
            fs.writeFileSync(fullname, defaultFiles[fn])
            console.log("wrote " + fullname)
        }

        // start installing in the background
        child_process.exec(`pxt install`, { cwd: dirname });

        dirs.push(dirname);
    }
    return dirs;
}

function getFiles(): string[] {
    let res: string[] = []
    function loop(path: string) {
        for (let fn of fs.readdirSync(path)) {
            if (fn[0] == "." || fn[0] == "_") continue;
            let fp = path + "/" + fn
            let st = fs.statSync(fp)
            if (st.isDirectory()) loop(fp)
            else if (st.isFile()) res.push(fp.replace(/^docs/, ""))
        }
    }
    loop("docs")
    if (fs.existsSync("docs/_locales"))
        loop("docs/_locales")
    return res
}

function checkDocsAsync(...args: string[]): Promise<void> {
    console.log(`checking docs`);
    let files = getFiles();

    // known urls
    let urls: Map<string> = {};
    files.forEach(f => urls[f.replace(/\.md$/i, '')] = f);

    let checked = 0;
    let broken = 0;
    let snipCount = 0;
    files.filter(f => /\.md$/i.test(f)).forEach(f => {
        let header = false;
        let contentType = U.getMime(f)
        if (!contentType || !/^text/.test(contentType))
            return;
        checked++;
        let text = fs.readFileSync("docs" + f).toString("utf8");
        // look for broken urls
        text.replace(/]\((\/[^)]+?)(\s+"[^"]+")?\)/g, (m) => {
            let url = /]\((\/[^)]+?)(\s+"[^"]+")?\)/.exec(m)[1];
            if (!urls[url]) {
                console.error(`${f}: broken link ${url}`);
                broken++;
            }
            return '';
        })

        let snippets = getSnippets(text)
        snipCount += snippets.length
        for (let snipIndex = 0; snipIndex < snippets.length; snipIndex++) {
            let dir = "built/docs/snippets/" + snippets[snipIndex].type;
            let fn = `${dir}/${f.replace(/^\//, '').replace(/\//g, '-').replace(/\.\w+$/, '')}-${snipIndex}.ts`;
            nodeutil.mkdirP(dir);
            fs.writeFileSync(fn, snippets[snipIndex].code);
        }
    });

    console.log(`checked ${checked} files: ${broken} broken links, ${snipCount} snippets`);
    return Promise.resolve();
}

interface SnippetInfo {
    type: string
    code: string
    ignore: boolean
    index: number
}

function getSnippets(source: string): SnippetInfo[] {
    let snippets: SnippetInfo[] = []
    let re = /^`{3}([\S]+)?\s*\n([\s\S]+?)\n`{3}\s*?$/gm;
    let index = 0
    source.replace(re, (match, type, code) => {
        snippets.push({
            type: type ? type.replace("-ignore", "") : "pre",
            code: code,
            ignore: type ? /-ignore/g.test(type) : false,
            index: index
        })
        index++
        return ''
    })
    return snippets
}

function webstringsJson() {
    let missing: Map<string> = {}
    for (let fn of onlyExts(nodeutil.allFiles("docfiles"), [".html"])) {
        let res = pxt.docs.translate(fs.readFileSync(fn, "utf8"), {})
        U.jsonCopyFrom(missing, res.missing)
    }
    U.iterMap(missing, (k, v) => {
        missing[k] = k
    })
    missing = U.sortObjectFields(missing)
    return missing
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

cmd("build    [--cloud]            - build current package, --cloud forces a build in the cloud", buildAsync)
cmd("deploy                       - build and deploy current package", deployAsync)
cmd("run                          - build and run current package in the simulator", runAsync)
cmd("extract [--code] [--out DIRNAME]  [FILENAME] - extract sources from .hex file, folder of .hex files, stdin (-), or URL", extractAsync)
cmd("test                         - run tests on current package", testAsync, 1)
cmd("gendocs [--locs] [--docs]    - build current package and its docs. --locs produce localization files, --docs produce docs files", gendocsAsync, 1)
cmd("format   [-i] file.ts...     - pretty-print TS files; -i = in-place", formatAsync, 1)
cmd("testassembler                - test the assemblers", testAssemblers, 1)
cmd("decompile file.ts...         - decompile ts files and produce similarly named .blocks files", decompileAsync, 1)
cmd("testdecompiler  DIR          - decompile files from DIR one-by-one and compare to baselines", testDecompilerAsync, 1)
cmd("testdecompilererrors  DIR    - decompile unsupported files from DIR one-by-one and check for errors", testDecompilerErrorsAsync, 1)
cmd("testdir  DIR                 - compile files from DIR one-by-one", testDirAsync, 1)
cmd("testconv JSONURL             - test TD->TS converter", testConverterAsync, 2)
cmd("snippets [--re NAME] [--i]     - verifies that all documentation snippets compile to blocks", testSnippetsAsync)

cmd("serve [-yt] [-browser NAME]  - start web server for your local target; -yt = use local yotta build", serveAsync)
cmd("update                       - update pxt-core reference and install updated version", updateAsync)
cmd("buildtarget                  - build pxtarget.json", () => buildTargetAsync().then(() => { }), 1)
cmd("bump [--noupdate]            - bump target or package version", bumpAsync)
cmd("uploadtrg [LABEL]            - upload target release", uploadTargetAsync, 1)
cmd("uploadtrgtranslations [--docs] - upload translations for target, --docs uploads markdown as well", uploadTargetTranslationsAsync, 1)
cmd("downloadtrgtranslations [PACKAGE] - download translations from bundled projects", downloadTargetTranslationsAsync, 1)
cmd("checkdocs                    - check docs for broken links, typing errors, etc...", checkDocsAsync, 1)

cmd("login    ACCESS_TOKEN        - set access token config variable", loginAsync, 1)
cmd("logout                       - clears access token", logoutAsync, 1)

cmd("add      ARGUMENTS...        - add a feature (.asm, C++ etc) to package", addAsync)
cmd("search   QUERY...            - search GitHub for a published package", searchAsync)
cmd("pkginfo  USER/REPO           - show info about named GitHub packge", pkginfoAsync)

cmd("api      PATH [DATA]         - do authenticated API call", apiAsync, 1)
cmd("pokecloud                    - same as 'api pokecloud {}'", () => apiAsync("pokecloud", "{}"), 2)
cmd("pokerepo [-u] REPO           - refresh repo, or generate a URL to do so", pokeRepoAsync, 2)
cmd("travis                       - upload release and npm package", travisAsync, 1)
cmd("uploadfile PATH              - upload file under <CDN>/files/PATH", uploadFileAsync, 1)
cmd("service  OPERATION           - simulate a query to web worker", serviceAsync, 2)
cmd("time                         - measure performance of the compiler on the current package", timeAsync, 2)
cmd("buildcss                     - build required css files", buildSemanticUIAsync, 10)
cmd("buildwebstrings              - build webstrings.json", buildWebStringsAsync, 10)

cmd("crowdin CMD PATH [OUTPUT]    - upload, download files to/from crowdin", execCrowdinAsync, 2);

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
        if (fs.existsSync(s + "/" + pxt.CONFIG_NAME)) {
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
        console.error(`Cannot find ${pxt.CONFIG_NAME} in any of the parent directories.`)
        process.exit(1)
    } else {
        if (dir != process.cwd()) {
            console.log(`Going up to ${dir} which has ${pxt.CONFIG_NAME}`)
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

    nodeutil.setTargetDir(targetDir);

    let trg = nodeutil.getPxtTarget()
    pxt.setAppTarget(trg)

    let compileId = "none"
    if (trg.compileService) {
        compileId = trg.compileService.buildEngine || "yotta"
    }

    pxt.log(`Using target PXT/${trg.id} with build engine ${compileId}`)
    pxt.log(`  Target dir:   ${nodeutil.targetDir}`)
    pxt.log(`  PXT Core dir: ${nodeutil.pxtCoreDir}`)

    if (compileId != "none") {
        build.thisBuild = build.buildEngines[compileId]
        if (!build.thisBuild) U.userError("cannot find build engine: " + compileId)
    }

    if (process.env["PXT_DEBUG"]) {
        pxt.options.debug = true;
        pxt.debug = console.log;
    }

    commonfiles = readJson(__dirname + "/pxt-common.json")

    initConfig();

    let cmd = args[0]

    if (cmd != "buildtarget") {
        initTargetCommands();
    }

    if (!pxt.commands.deployCoreAsync && build.thisBuild.deployAsync) {
        pxt.commands.deployCoreAsync = build.thisBuild.deployAsync
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
