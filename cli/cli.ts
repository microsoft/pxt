/// <reference path="../typings/globals/node/index.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtcompiler.d.ts"/>
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
import * as build from './buildengine';
import * as electron from "./electron";
import * as commandParser from './commandparser';
import * as hid from './hid';
import * as serial from './serial';
import * as gdb from './gdb';
import * as clidbg from './clidbg';
import * as pyconv from './pyconv';

const rimraf: (f: string, opts: any, cb: () => void) => void = require('rimraf');

let forceCloudBuild = process.env["KS_FORCE_CLOUD"] === "yes"
let forceLocalBuild = process.env["PXT_FORCE_LOCAL"] === "yes"

const p = new commandParser.CommandParser();

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
        output += `${diagnostic.fileName}(${diagnostic.line + 1},${diagnostic.column + 1}): `;
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
    let atok: string = process.env["PXT_ACCESS_TOKEN"]
    if (fs.existsSync(configPath())) {
        let config = <UserConfig>readJson(configPath())
        globalConfig = config
        const token = passwordGet(PXT_KEY);
        if (!atok && token) {
            atok = token
        }
    }

    if (atok) {
        let mm = /^(https?:.*)\?access_token=([\w\.]+)/.exec(atok)
        if (!mm) {
            console.error("Invalid accessToken format, expecting something like 'https://example.com/?access_token=0abcd.XXXX'")
            return
        }
        Cloud.apiRoot = mm[1].replace(/\/$/, "").replace(/\/api$/, "") + "/api/"
        Cloud.accessToken = mm[2]
    }
}

interface KeyTar {
    replacePassword(service: string, account: string, password: string): void;
    getPassword(service: string, account: string): string;
    deletePassword(service: string, account: string): void;
}

function passwordGet(account: string): string {
    try {
        const keytar = require("keytar") as KeyTar;
        return keytar.getPassword("pxt/" + pxt.appTarget.id, account);
    } catch (e) {
        return undefined;
    }
}

function passwordDelete(account: string): void {
    try {
        const keytar = require("keytar") as KeyTar;
        keytar.deletePassword("pxt/" + pxt.appTarget.id, account);
    } catch (e) {
    }
}

function passwordUpdate(account: string, password: string) {
    try {
        const keytar = require("keytar") as KeyTar;
        keytar.replacePassword("pxt/" + pxt.appTarget.id, account, password);
    } catch (e) {
        console.error(e)
    }
}

const PXT_KEY = "pxt";
const GITHUB_KEY = "github";
const CROWDIN_KEY = "crowdin";
const LOGIN_PROVIDERS = [PXT_KEY, GITHUB_KEY, CROWDIN_KEY];
export function loginAsync(parsed: commandParser.ParsedCommand) {
    const service = parsed.arguments[0] as string;
    const token = parsed.arguments[1] as string;

    const usage = (msg: string) => {
        const root = Cloud.apiRoot.replace(/api\/$/, "")
        console.log(msg);
        console.log("USAGE:")
        console.log(`  pxt login <service> <token>`)
        console.log(`where service can be github, crowdin or pxt; and <token> is obtained from`)
        console.log(`* github: go to https://github.com/settings/tokens/new .`);
        console.log(`* crowdin: go to https://crowdin.com/project/kindscript/settings#api.`);
        console.log(`* pxt: go to ${root}oauth/gettoken.`)
        return fatal("Bad usage")
    }

    if (!service || LOGIN_PROVIDERS.indexOf(service) < 0)
        return usage("missing provider");
    if (!token)
        return usage("missing token");
    if (service == PXT_KEY && !/^https:\/\//.test(token))
        return usage("invalid token");

    passwordUpdate(service, token);
    console.log(`${service} password saved.`)
    return Promise.resolve()
}

export function logoutAsync() {
    LOGIN_PROVIDERS.forEach(key => passwordDelete(key));
    console.log('access tokens removed');
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
        pxt.log(`name: ${cfg.name}`)
        pxt.log(`description: ${cfg.description}`)
        if (pxt.appTarget.appTheme)
            pxt.log(`shareable url: ${pxt.appTarget.appTheme.embedUrl}#pub:gh/${parsed.fullName}${tag ? "#" + tag : ""}`)
    }

    return pxt.packagesConfigAsync()
        .then(config => {
            const status = pxt.github.repoStatus(parsed, config);
            pxt.log(`github org: ${parsed.owner}`);
            if (parsed.tag) pxt.log(`github tag: ${parsed.tag}`);
            pxt.log(`package status: ${status == pxt.github.GitRepoStatus.Approved ? "approved" : status == pxt.github.GitRepoStatus.Banned ? "banned" : "neutral"}`)
            if (parsed.tag)
                return pxt.github.downloadPackageAsync(repopath, config)
                    .then(pkg => {
                        let cfg: pxt.PackageConfig = JSON.parse(pkg.files[pxt.CONFIG_NAME])
                        pkgInfo(cfg, parsed.tag)
                        pxt.debug(`size: ${JSON.stringify(pkg.files).length}`)
                    })

            return pxt.github.pkgConfigAsync(parsed.fullName)
                .then(cfg => {
                    pkgInfo(cfg)
                    return pxt.github.listRefsAsync(repopath)
                        .then(tags => {
                            pxt.log("tags: " + tags.join(", "))
                            return pxt.github.listRefsAsync(repopath, "heads")
                        })
                        .then(heads => {
                            pxt.log("branches: " + heads.join(", "))
                        })
                })
        })
}

export function pokeRepoAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    const repo = parsed.arguments[0];

    let data = {
        repo: repo,
        getkey: false
    }
    if (parsed.flags["u"]) data.getkey = true
    return Cloud.privatePostAsync("pokerepo", data)
        .then(resp => {
            console.log(resp)
        })
}

export function execCrowdinAsync(cmd: string, ...args: string[]): Promise<void> {
    const prj = pxt.appTarget.appTheme.crowdinProject;
    if (!prj) {
        console.log(`crowdin operation skipped, crowdin project not specified in pxtarget.json`);
        return Promise.resolve();
    }
    const branch = pxt.appTarget.appTheme.crowdinBranch;
    const key = passwordGet(CROWDIN_KEY) || process.env[pxt.crowdin.KEY_VARIABLE] as string;
    if (!key) {
        console.log(`crowdin operation skipped, crowdin token or '${pxt.crowdin.KEY_VARIABLE}' variable missing`);
        return Promise.resolve();
    }

    if (!args[0]) throw new Error("filename missing");
    switch (cmd.toLowerCase()) {
        case "upload": return uploadCrowdinAsync(branch, prj, key, args[0], args[1]);
        case "download": {
            if (!args[1]) throw new Error("output path missing");
            const fn = path.basename(args[0]);
            return pxt.crowdin.downloadTranslationsAsync(branch, prj, key, args[0], { translatedOnly: true, validatedOnly: true })
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

function uploadCrowdinAsync(branch: string, prj: string, key: string, p: string, dir?: string): Promise<void> {
    let fn = path.basename(p);
    if (dir) fn = dir.replace(/[\\/]*$/g, '') + '/' + fn;
    const data = JSON.parse(fs.readFileSync(p, "utf8")) as Map<string>;
    console.log(`upload ${fn} (${Object.keys(data).length} strings) to https://crowdin.com/project/${prj}${branch ? `?branch=${branch}` : ''}`);
    return pxt.crowdin.uploadTranslationAsync(branch, prj, key, fn, JSON.stringify(data));
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

function uploadFileAsync(parsed: commandParser.ParsedCommand) {
    const path = parsed.arguments[0];
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

    const branch = process.env.TRAVIS_BRANCH || "local"
    const latest = branch == "master" ? "latest" : "git-" + branch
    // upload locs on build on master
    const uploadLocs = /^(master|v\d+\.\d+\.\d+)$/.test(process.env.TRAVIS_BRANCH)
        && /^false$/.test(process.env.TRAVIS_PULL_REQUEST);

    console.log("TRAVIS_TAG:", rel);
    console.log("TRAVIS_BRANCH:", process.env.TRAVIS_BRANCH);
    console.log("TRAVIS_PULL_REQUEST:", process.env.TRAVIS_PULL_REQUEST);
    console.log("uploadLocs:", uploadLocs);
    console.log("latest:", latest);

    let pkg = readJson("package.json")
    if (pkg["name"] == "pxt-core") {
        let p = npmPublish ? nodeutil.runNpmAsync("publish") : Promise.resolve();
        if (uploadLocs)
            p = p
                .then(() => execCrowdinAsync("upload", "built/strings.json"))
                .then(() => buildWebStringsAsync())
                .then(() => execCrowdinAsync("upload", "built/webstrings.json"))
                .then(() => internalUploadTargetTranslationsAsync(!!rel));
        return p;
    } else {
        return buildTargetAsync()
            .then(() => internalCheckDocsAsync(true))
            .then(() => npmPublish ? nodeutil.runNpmAsync("publish") : Promise.resolve())
            .then(() => {
                if (!process.env["PXT_ACCESS_TOKEN"]) {
                    // pull request, don't try to upload target
                    pxt.log('no token, skipping upload')
                    return Promise.resolve();
                }
                const trg = readLocalPxTarget()
                if (rel)
                    return uploadTargetAsync(trg.id + "/" + rel)
                        .then(() => uploadLocs ? internalUploadTargetTranslationsAsync(!!rel) : Promise.resolve());
                else
                    return uploadTargetAsync(trg.id + "/" + latest)
                        .then(() => uploadLocs ? internalUploadTargetTranslationsAsync(!!rel) : Promise.resolve());
            })
    }
}

function bumpPxtCoreDepAsync(): Promise<void> {
    let pkg = readJson("package.json")
    if (pkg["name"] == "pxt-core") return Promise.resolve(pkg)

    let gitPull = Promise.resolve();
    let commitMsg: string = "";

    ["pxt-core", "pxt-common-packages"].forEach(knownPackage => {
        const modulePath = path.join("node_modules", knownPackage)
        if (fs.existsSync(path.join(modulePath, ".git"))) {
            gitPull = gitPull.then(() => nodeutil.spawnAsync({
                cmd: "git",
                args: ["pull"],
                cwd: modulePath
            }))
        }

        // not referenced
        if (!fs.existsSync(path.join(modulePath, "package.json")))
            return;

        gitPull
            .then(() => {
                let kspkg = readJson(path.join(modulePath, "package.json"));
                let currVer = pkg["dependencies"][knownPackage]
                if (!currVer) return; // not referenced
                let newVer = kspkg["version"]
                if (currVer == newVer) {
                    console.log(`Referenced ${knownPackage} dep up to date: ${currVer}`)
                    return;
                }

                console.log(`Bumping ${knownPackage} dep version: ${currVer} -> ${newVer}`)
                if (currVer != "*" && pxt.semver.strcmp(currVer, newVer) > 0) {
                    U.userError(`Trying to downgrade ${knownPackage}.`)
                }
                if (currVer != "*" && pxt.semver.majorCmp(currVer, newVer) < 0) {
                    U.userError(`Trying to automatically update major version, please edit package.json manually.`)
                }
                pkg["dependencies"][knownPackage] = newVer
                fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n")
                commitMsg += `bump ${knownPackage} to ${newVer}, `;
            })
    })

    gitPull = gitPull
        .then(() => commitMsg ? nodeutil.runGitAsync("commit", "-m", commitMsg, "--", "package.json") : Promise.resolve());

    return gitPull;
}

function updateAsync() {
    return Promise.resolve()
        .then(() => nodeutil.runGitAsync("pull"))
        .then(() => bumpPxtCoreDepAsync())
        .then(() => nodeutil.runNpmAsync("install"));
}

function justBumpPkgAsync() {
    ensurePkgDir()
    return nodeutil.needsGitCleanAsync()
        .then(() => mainPkg.loadAsync())
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
        .then(() => nodeutil.runGitAsync("commit", "-a", "-m", mainPkg.config.version))
        .then(() => nodeutil.runGitAsync("tag", "v" + mainPkg.config.version))
}

function bumpAsync(parsed: commandParser.ParsedCommand) {
    const bumpPxt = parsed.flags["update"];
    const upload = parsed.flags["upload"];
    if (fs.existsSync(pxt.CONFIG_NAME)) {
        if (upload) throw U.userError("upload only supported on packages");

        return Promise.resolve()
            .then(() => nodeutil.runGitAsync("pull"))
            .then(() => justBumpPkgAsync())
            .then(() => nodeutil.runGitAsync("push", "--tags"))
            .then(() => nodeutil.runGitAsync("push"))
    }
    else if (fs.existsSync("pxtarget.json"))
        return Promise.resolve()
            .then(() => nodeutil.runGitAsync("pull"))
            .then(() => bumpPxt ? bumpPxtCoreDepAsync().then(() => nodeutil.runGitAsync("push")) : Promise.resolve())
            .then(() => nodeutil.runNpmAsync("version", "patch"))
            .then(() => nodeutil.runGitAsync("push", "--tags"))
            .then(() => nodeutil.runGitAsync("push"))
            .then(() => upload ? uploadTaggedTargetAsync() : Promise.resolve())
    else {
        throw U.userError("Couldn't find package or target JSON file; nothing to bump")
    }
}

function uploadTaggedTargetAsync() {
    forceCloudBuild = true
    const token = passwordGet(GITHUB_KEY);
    if (!token) {
        fatal("GitHub token not found, please use 'pxt login' to login with your GitHub account to push releases.");
        return Promise.resolve();
    }
    return nodeutil.needsGitCleanAsync()
        .then(() => Promise.all([
            nodeutil.currGitTagAsync(),
            nodeutil.gitInfoAsync(["rev-parse", "--abbrev-ref", "HEAD"]),
            nodeutil.gitInfoAsync(["rev-parse", "HEAD"])
        ]))
        // only build target after getting all the info
        .then(info =>
            buildTargetAsync()
                .then(() => internalCheckDocsAsync(true))
                .then(() => info))
        .then(info => {
            process.env["TRAVIS_TAG"] = info[0]
            process.env['TRAVIS_BRANCH'] = info[1]
            process.env['TRAVIS_COMMIT'] = info[2]
            let repoSlug = "microsoft/pxt-" + pxt.appTarget.id
            process.env['TRAVIS_REPO_SLUG'] = repoSlug
            process.env['PXT_RELEASE_REPO'] = "https://git:" + token + "@github.com/" + repoSlug + "-built"
            let v = pkgVersion()
            pxt.log("uploading " + v)
            return uploadCoreAsync({
                label: "v" + v,
                fileList: pxtFileList("node_modules/pxt-core/").concat(targetFileList()),
                pkgversion: v,
                githubOnly: true,
                fileContent: {}
            })
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
    let lst = onlyExts(nodeutil.allFiles("built"), [".js", ".css", ".json", ".webmanifest"])
        .concat(nodeutil.allFiles("sim/public"))
    pxt.debug(`target files (on disk): ${lst.join('\r\n    ')}`)
    return lst;
}

export function uploadTargetAsync(label: string) {
    return uploadCoreAsync({
        label,
        fileList: pxtFileList("node_modules/pxt-core/").concat(targetFileList()),
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
    githubOnly?: boolean;
    builtPackaged?: string;
    minify?: boolean;
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
    // normalize /, \ before filtering
    return p.replace(/\\/g, '\/')
        .replace(/^.*(built\/web\/|\w+\/public\/|built\/)/, "")
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
    if (!label) {
        console.log('no label; skip release upload');
        return Promise.resolve();
    }
    let tid = pxt.appTarget.id
    if (U.startsWith(label, tid + "/"))
        label = label.slice(tid.length + 1)
    if (!/^v\d/.test(label)) {
        console.log('label is not a version; skipping release upload');
        return Promise.resolve();
    }
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

    console.log(`create release ${label} in ${repoUrl}`);

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

    const cred = [
        "-c", "credential.helper=",
        "-c", "user.name=" + user,
        "-c", "user.email=" + user + "@build.pxt.io",
    ]
    const gitAsync = (args: string[]) => nodeutil.spawnAsync({
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
                return nodeutil.spawnAsync({
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

    fn = fn.replace(/^\.?\/*/, "/")
    return "@cdnUrl@/blob/" + gitHash(fs.readFileSync("docs" + fn)) + "" + fn;
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

    let targetEditorJs = "";
    if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.extendEditor)
        targetEditorJs = "@commitCdnUrl@editor.js";

    let replacements: Map<string> = {
        "/sim/simulator.html": "@simUrl@",
        "/sim/siminstructions.html": "@partsUrl@",
        "/sim/sim.webmanifest": "@relprefix@webmanifest",
        "/embed.js": "@targetUrl@@relprefix@embed",
        "/cdn/": "@commitCdnUrl@",
        "/doccdn/": "@commitCdnUrl@",
        "/sim/": "@commitCdnUrl@",
        "/blb/": "@blobCdnUrl@",
        "@timestamp@": "",
        "data-manifest=\"\"": "@manifest@",
        "var pxtConfig = null": "var pxtConfig = @cfg@",
        "@defaultLocaleStrings@": defaultLocale ? "@commitCdnUrl@" + "locales/" + defaultLocale + "/strings.json" : "",
        "@cachedHexFiles@": hexFiles.length ? hexFiles.join("\n") : "",
        "@targetEditorJs@": targetEditorJs
    }

    if (opts.localDir) {
        let cfg: pxt.WebConfig = {
            "relprefix": opts.localDir,
            "workerjs": opts.localDir + "worker.js",
            "tdworkerjs": opts.localDir + "tdworker.js",
            "monacoworkerjs": opts.localDir + "monacoworker.js",
            "pxtVersion": pxtVersion(),
            "pxtRelId": "",
            "pxtCdnUrl": opts.localDir,
            "commitCdnUrl": opts.localDir,
            "blobCdnUrl": opts.localDir,
            "cdnUrl": opts.localDir,
            "targetVersion": opts.pkgversion,
            "targetRelId": "",
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
            "/blb/": opts.localDir,
            "@monacoworkerjs@": `${opts.localDir}monacoworker.js`,
            "@workerjs@": `${opts.localDir}worker.js`,
            "@timestamp@": `# ver ${new Date().toString()}`,
            "data-manifest=\"\"": `manifest="${opts.localDir}release.manifest"`,
            "var pxtConfig = null": "var pxtConfig = " + JSON.stringify(cfg, null, 4),
            "@defaultLocaleStrings@": "",
            "@cachedHexFiles@": "",
            "@targetEditorJs@": targetEditorJs ? `${opts.localDir}editor.js` : ""
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

        const uglify = opts.minify ? require("uglify-js") : undefined;

        let fileName = uploadFileName(p)
        let mime = U.getMime(p)
        const minified = opts.minify && mime == "application/javascript" && fileName !== "target.js";

        pxt.log(`    ${p} -> ${fileName} (${mime})` + (minified ? ' minified' : ""));

        let isText = /^(text\/.*|application\/.*(javascript|json))$/.test(mime)
        let content = ""
        let data: Buffer;
        return rdf.then((rdata: Buffer) => {
            data = rdata;
            if (isText) {
                content = data.toString("utf8")
                if (fileName == "index.html") {
                    if (!opts.localDir) {
                        let m = pxt.appTarget.appTheme as Map<string>
                        for (let k of Object.keys(m)) {
                            if (/CDN$/.test(k))
                                m[k.slice(0, k.length - 3)] = m[k]
                        }
                    }
                    content = server.expandHtml(content)
                }

                if (/^sim/.test(fileName)) {
                    // just force blobs for everything in simulator manifest
                    content = content.replace(/\/(cdn|sim)\//g, "/blb/")
                }

                if (minified) {
                    const res = uglify.minify(content);
                    if (!res.error) {
                        content = res.code;
                    }
                    else {
                        pxt.log(`        Could not minify ${fileName} ${res.error}`)
                    }
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
                        data = new Buffer((isJs ? targetJsPrefix : '') + JSON.stringify(trg, null, 2), "utf8")
                    } else {
                        trg.appTheme.appLogo = uploadArtFile(trg.appTheme.appLogo);
                        trg.appTheme.cardLogo = uploadArtFile(trg.appTheme.cardLogo)
                        if (trg.simulator
                            && trg.simulator.boardDefinition
                            && trg.simulator.boardDefinition.visual) {
                            let boardDef = trg.simulator.boardDefinition.visual as pxsim.BoardImageDefinition;
                            if (boardDef.image) {
                                boardDef.image = uploadArtFile(boardDef.image);
                                if (boardDef.outlineImage) boardDef.outlineImage = uploadArtFile(boardDef.outlineImage);
                            }
                        }
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
                U.assert(!!opts.builtPackaged);
                let fn = path.join(opts.builtPackaged, opts.localDir, fileName)
                nodeutil.mkdirP(path.dirname(fn))
                return minified ? writeFileAsync(fn, content) : writeFileAsync(fn, data)
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
                pxt.log("Release files written to" + path.resolve(opts.builtPackaged, opts.localDir))
            })

    return Promise.map(opts.fileList, uploadFileAsync, { concurrency: 15 })
        .then(() =>
            opts.githubOnly
                ? uploadToGitRepoAsync(opts, uplReqs)
                : gitUploadAsync(opts, uplReqs))
}

function readLocalPxTarget() {
    if (!fs.existsSync("pxtarget.json")) {
        console.error("This command requires pxtarget.json in current directory.")
        process.exit(1)
    }
    nodeutil.setTargetDir(process.cwd())
    let cfg: pxt.TargetBundle = readJson("pxtarget.json")
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
        const host = new Host();
        const pkgPath = path.join(nodeutil.targetDir, dirname);
        pxt.debug(`building bundled package at ${pkgPath}`)

        // if the package is under node_modules/ , slurp any existing files
        const m = /node_modules[\\\/][^\\\/]*[\\\/]libs[\\\/](\w+)$/i.exec(pkgPath);
        if (m) {
            const bdir = m[1];
            const overridePath = path.join("libs", bdir);
            pxt.debug(`override with files from ${overridePath}`)
            if (nodeutil.existsDirSync(overridePath)) {
                host.fileOverrides = {};
                nodeutil.allFiles(overridePath)
                    .filter(f => fs.existsSync(f))
                    .forEach(f => host.fileOverrides[path.relative(overridePath, f)] = fs.readFileSync(f, "utf8"));

                pxt.log(`file overrides: ${Object.keys(host.fileOverrides).join(', ')}`)
            } else {
                pxt.debug(`override folder ${overridePath} not present`);
            }
        }

        process.chdir(pkgPath);
        mainPkg = new pxt.MainPackage(host)
        return f(mainPkg, dirname);
    })
        .finally(() => process.chdir(prev))
        .then(() => { });
}

function ghpSetupRepoAsync() {
    function getreponame() {
        let cfg = fs.readFileSync("gh-pages/.git/config", "utf8")
        let m = /^\s*url\s*=\s*.*github.*\/([^\/\s]+)$/mi.exec(cfg)
        if (!m) U.userError("cannot determine GitHub repo name")
        return m[1].replace(/\.git$/, "")
    }
    if (fs.existsSync("gh-pages")) {
        console.log("Skipping init of gh-pages; you can delete it first to get full re-init")
        return Promise.resolve(getreponame())
    }

    nodeutil.cpR(".git", "gh-pages/.git")
    return ghpGitAsync("checkout", "gh-pages")
        .then(() => getreponame())
}

function ghpGitAsync(...args: string[]) {
    return nodeutil.spawnAsync({
        cmd: "git",
        cwd: "gh-pages",
        args: args
    })
}

function ghpInitAsync() {
    if (fs.existsSync("gh-pages/.git"))
        return Promise.resolve();

    nodeutil.cpR(".git", "gh-pages/.git")
    return ghpGitAsync("checkout", "gh-pages")
        .then(() => Promise.resolve()) // branch already exists

        .catch((e: any) => ghpGitAsync("checkout", "--orphan", "gh-pages"))
        .then(() => ghpGitAsync("rm", "-rf", "."))
        .then(() => {
            fs.writeFileSync("gh-pages/index.html", "Under construction.")
            fs.writeFileSync("gh-pages/.gitattributes",
                `# enforce unix style line endings
*.ts text eol=lf
*.tsx text eol=lf
*.md text eol=lf
*.txt text eol=lf
*.js text eol=lf
*.json text eol=lf
*.xml text eol=lf
*.svg text eol=lf
*.yaml text eol=lf
*.css text eol=lf
*.html text eol=lf
*.py text eol=lf
*.exp text eol=lf
*.manifest text eol=lf

# do not enforce text for everything - it causes issues with random binary files

*.sln text eol=crlf

*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
`);
            return ghpGitAsync("add", ".")
        })
        .then(() => ghpGitAsync("commit", "-m", "Initial."))
        .then(() => ghpGitAsync("push", "--set-upstream", "origin", "gh-pages"))
}

export function ghpPushAsync(builtPackaged: string, minify = false) {
    let repoName = ""
    return ghpInitAsync()
        .then(() => ghpSetupRepoAsync())
        .then(name => internalStaticPkgAsync(builtPackaged, (repoName = name), minify))
        .then(() => nodeutil.cpR(path.join(builtPackaged, repoName), "gh-pages"))
        .then(() => ghpGitAsync("add", "."))
        .then(() => ghpGitAsync("commit", "-m", "Auto-push"))
        .then(() => ghpGitAsync("push"))
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
    if (pxt.appTarget.id == "core")
        return buildTargetCoreAsync()

    let initPromise: Promise<void>;

    const commonPackageDir = path.resolve("node_modules/pxt-common-packages")

    // Make sure to build common sim in case of a local clean. This will do nothing for
    // targets without pxt-common-packages installed.
    if (!inCommonPkg("built/common-sim.js") || !inCommonPkg("built/common-sim.d.ts")) {
        initPromise = buildCommonSimAsync();
    }
    else {
        initPromise = Promise.resolve();
    }

    if (nodeutil.existsDirSync("sim"))
        initPromise = initPromise.then(() => extractLocStringsAsync("sim-strings", ["sim"]));

    return initPromise
        .then(() => { copyCommonSim(); return simshimAsync() })
        .then(() => buildFolderAsync('sim', true, pxt.appTarget.id === 'common' ? 'common-sim' : 'sim'))
        .then(buildTargetCoreAsync)
        .then(() => buildFolderAsync('cmds', true))
        .then(() => buildSemanticUIAsync())
        .then(() => {
            if (fs.existsSync(path.join("editor", "tsconfig.json"))) {
                const tsConfig = JSON.parse(fs.readFileSync(path.join("editor", "tsconfig.json"), "utf8"));
                if (tsConfig.compilerOptions.module)
                    return buildFolderAndBrowserifyAsync('editor', true, 'editor');
                else
                    return buildFolderAsync('editor', true, 'editor');
            }
            return Promise.resolve();
        })
        .then(() => buildFolderAsync('server', true, 'server'))

    function inCommonPkg(p: string) {
        return fs.existsSync(path.join(commonPackageDir, p));
    }
}

function buildFolderAsync(p: string, optional?: boolean, outputName?: string): Promise<void> {
    if (!fs.existsSync(path.join(p, "tsconfig.json"))) {
        if (!optional) U.userError(`${p}/tsconfig.json not found`);
        return Promise.resolve()
    }

    const tsConfig = JSON.parse(fs.readFileSync(path.join(p, "tsconfig.json"), "utf8"));
    if (outputName && tsConfig.compilerOptions.out !== `../built/${outputName}.js`) {
        U.userError(`${p}/tsconfig.json expected compilerOptions.out:"../built/${outputName}.js", got "${tsConfig.compilerOptions.out}"`);
    }

    if (!fs.existsSync("node_modules/typescript")) {
        U.userError("Oops, typescript does not seem to be installed, did you run 'npm install'?");
    }

    pxt.log(`building ${p}...`)
    dirsToWatch.push(p)
    return nodeutil.spawnAsync({
        cmd: "node",
        args: ["../node_modules/typescript/bin/tsc"],
        cwd: p
    })
}

function copyCommonSim() {
    const p = "node_modules/pxt-common-packages/built";
    if (fs.existsSync(p)) {
        pxt.log(`copying common-sim...`)
        nodeutil.cp(path.join(p, "common-sim.js"), "built");
        nodeutil.cp(path.join(p, "common-sim.d.ts"), "built");
    }
}

function buildFolderAndBrowserifyAsync(p: string, optional?: boolean, outputName?: string): Promise<void> {
    if (!fs.existsSync(path.join(p, "tsconfig.json"))) {
        if (!optional) U.userError(`${p}/tsconfig.json not found`);
        return Promise.resolve()
    }

    const tsConfig = JSON.parse(fs.readFileSync(path.join(p, "tsconfig.json"), "utf8"));
    if (outputName && tsConfig.compilerOptions.outDir !== `../built/${outputName}`) {
        U.userError(`${p}/tsconfig.json expected compilerOptions.ourDir:"../built/${outputName}", got "${tsConfig.compilerOptions.outDir}"`);
    }

    if (!fs.existsSync("node_modules/typescript")) {
        U.userError("Oops, typescript does not seem to be installed, did you run 'npm install'?");
    }

    pxt.log(`building ${p}...`)
    dirsToWatch.push(p)
    return nodeutil.spawnAsync({
        cmd: "node",
        args: ["../node_modules/typescript/bin/tsc"],
        cwd: p
    }).then(() => {
        const browserify = require('browserify');
        let b = browserify();
        nodeutil.allFiles(`built/${outputName}`).forEach((f) => {
            if (f.match(/\.js$/)) {
                b.add(f);
            }
        });

        let outFile = fs.createWriteStream(`built/${outputName}.js`, 'utf8');
        b.bundle().pipe(outFile);

        return new Promise<void>((resolve, reject) => {
            outFile.on('finish', () => {
                resolve();
            });
            outFile.on('error', (err: any) => {
                reject(err);
            });
        });
    })
}

function buildPxtAsync(includeSourceMaps = false): Promise<string[]> {
    let ksd = "node_modules/pxt-core"
    if (!fs.existsSync(ksd + "/pxtlib/main.ts")) return Promise.resolve([]);

    console.log(`building ${ksd}...`);
    return nodeutil.spawnAsync({
        cmd: nodeutil.addCmd("jake"),
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
            pxt.debug(`importing ${fn}`)
            logos[k + "CDN"] = uploadArtFile(logos[k])
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

    if (fs.existsSync("built/templates.json")) {
        cfg.appTheme.htmlTemplates = readJson("built/templates.json")
    }

    // extract strings from theme for target
    const theme = cfg.appTheme;
    let targetStrings: pxt.Map<string> = {};
    if (theme.title) targetStrings[theme.title] = theme.title;
    if (theme.name) targetStrings[theme.name] = theme.name;
    if (theme.description) targetStrings[theme.description] = theme.description;
    function walkDocs(docs: pxt.DocMenuEntry[]) {
        if (!docs) return;
        docs.forEach(doc => {
            targetStrings[doc.name] = doc.name;
            walkDocs(doc.subitems);
        })
    }
    walkDocs(theme.docMenu);
    let targetStringsSorted: pxt.Map<string> = {};
    Object.keys(targetStrings).sort().map(k => targetStringsSorted[k] = k);

    // write files
    nodeutil.mkdirP("built");
    fs.writeFileSync("built/theme.json", JSON.stringify(cfg.appTheme, null, 2))
    fs.writeFileSync("built/target-strings.json", JSON.stringify(targetStringsSorted, null, 2))
}

function buildSemanticUIAsync(parsed?: commandParser.ParsedCommand) {
    const forceRedbuild = parsed && parsed.flags["force"] || false;
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

    if (!dirty && !forceRedbuild) return Promise.resolve();

    nodeutil.mkdirP(path.join("built", "web"));
    return nodeutil.spawnAsync({
        cmd: "node",
        args: ["node_modules/less/bin/lessc", "theme/style.less", "built/web/semantic.css", "--include-path=node_modules/semantic-ui-less:node_modules/pxt-core/theme:theme/foo/bar"]
    }).then(() => {
        const fontFile = fs.readFileSync("node_modules/semantic-ui-less/themes/default/assets/fonts/icons.woff")
        const url = "url(data:application/font-woff;charset=utf-8;base64,"
            + fontFile.toString("base64") + ") format('woff')"
        let semCss = fs.readFileSync('built/web/semantic.css', "utf8")
        semCss = semCss.replace('src: url("fonts/icons.eot");', "")
            .replace(/src:.*url\("fonts\/icons\.woff.*/g, "src: " + url + ";")
        fs.writeFileSync('built/web/semantic.css', semCss);
    }).then(() => {
        // generate blockly css
        if (!fs.existsSync(path.join("theme", "blockly.less")))
            return Promise.resolve();
        return nodeutil.spawnAsync({
            cmd: "node",
            args: ["node_modules/less/bin/lessc", "theme/blockly.less", "built/web/blockly.css", "--include-path=node_modules/semantic-ui-less:node_modules/pxt-core/theme:theme/foo/bar"]
        })
    }).then(() => {
        // run postcss with autoprefixer and rtlcss
        pxt.debug("running postcss");
        const postcss = require('postcss');
        const browserList = [
            "Chrome >= 38",
            "Firefox >= 31",
            "Edge >= 12",
            "ie >= 11",
            "Safari >= 9",
            "Opera >= 21",
            "iOS >= 9",
            "ChromeAndroid >= 59",
            "FirefoxAndroid >= 55"
        ]
        const cssnano = require('cssnano')({
            autoprefixer: {browsers: browserList, add: true}
        });
        const rtlcss = require('rtlcss');
        const files = ['semantic.css', 'blockly.css']
        files.forEach(cssFile => {
            fs.readFile(`built/web/${cssFile}`, "utf8", (err, css) => {
            postcss([cssnano])
                .process(css, { from: `built/web/${cssFile}`, to: `built/web/${cssFile}` }).then((result: any) => {
                    fs.writeFile(`built/web/${cssFile}`, result.css, (err2, css2) => {
                        // process rtl css
                        postcss([rtlcss])
                            .process(result.css, { from: `built/web/${cssFile}`, to: `built/web/rtl${cssFile}` }).then((result2: any) => {
                                fs.writeFile(`built/web/rtl${cssFile}`, result2.css);
                            });
                    });
                });
            })
        });
    })
}

function buildWebStringsAsync() {
    fs.writeFileSync("built/webstrings.json", JSON.stringify(webstringsJson(), null, 4))
    return Promise.resolve()
}

function thirdPartyNoticesAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    let tpn = `
/*!----------------- PXT ThirdPartyNotices -------------------------------------------------------

PXT uses third party material from the projects listed below.
The original copyright notice and the license under which Microsoft
received such third party material are set forth below. Microsoft
reserves all other rights not expressly granted, whether by
implication, estoppel or otherwise.

In the event that we accidentally failed to list a required notice, please
bring it to our attention. Post an issue or email us:

           makecode@microsoft.com

---------------------------------------------
Third Party Code Components
---------------------------------------------

    `;

    function lic(dep: string) {
        const license = path.join("node_modules", dep, "LICENSE");
        if (fs.existsSync(license))
            return fs.readFileSync(license, 'utf8');
        const readme = fs.readFileSync("README.md", "utf8");
        const lic = /## License([^#]+)/.exec(readme);
        if (lic)
            return lic[1];

        return undefined;
    }

    for (const dep of Object.keys(pkg.dependencies).concat(Object.keys(pkg.devDependencies))) {
        pxt.log(`scanning ${dep}`)
        const license = lic(dep);
        if (!license)
            pxt.log(`no license for ${dep} at ${license}`);
        else
            tpn += `
----------------- ${dep} -------------------

${license}

---------------------------------------------
`
    }

    tpn += `
------------- End of ThirdPartyNotices --------------------------------------------------- */`;

    fs.writeFileSync("THIRD-PARTY-NOTICES.txt", tpn, 'utf8');
    pxt.log('written THIRD-PARTY-NOTICES.txt');
    return Promise.resolve();
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
                    if (newProject.config.icon)
                        newProject.config.icon = uploadArtFile(newProject.config.icon);
                } else {
                    newProject.files[relativePath] = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
                }
            });

            (<any>cfg)[projectId] = newProject;
        });

    if (!cfg.tsprj && cfg.blocksprj) {
        let notBlock = (s: string) => !U.endsWith(s, ".blocks")
        cfg.tsprj = U.clone(cfg.blocksprj)
        cfg.tsprj.id = "tsprj"
        cfg.tsprj.config.files = cfg.tsprj.config.files.filter(notBlock)
        for (let k of Object.keys(cfg.tsprj.files)) {
            if (!notBlock(k)) delete cfg.tsprj.files[k]
        }
    }
}

function updateTOC(cfg: pxt.TargetBundle) {
    if (!cfg.appTheme) return; // no theme to update

    // Update Table of Contents from SUMMARY.md file
    const summaryMD = nodeutil.resolveMd(nodeutil.targetDir, "SUMMARY");
    if (!summaryMD) {
        pxt.log('no SUMMARY file found');
    } else {
        cfg.appTheme.TOC = pxt.docs.buildTOC(summaryMD)
    }
}

function buildTargetCoreAsync() {
    let cfg = readLocalPxTarget()
    updateDefaultProjects(cfg);
    updateTOC(cfg);
    cfg.bundledpkgs = {}
    pxt.setAppTarget(cfg);
    let statFiles: Map<number> = {}
    dirsToWatch = cfg.bundleddirs.slice()
    if (pxt.appTarget.id != "core") {
        if (fs.existsSync("theme")) {
            dirsToWatch.push("theme"); // simulator
            dirsToWatch.push(path.join("theme", "site", "globals")); // simulator
        }
        if (fs.existsSync("editor"))
            dirsToWatch.push("editor");
        if (fs.existsSync("sim")) {
            dirsToWatch.push("sim"); // simulator
            dirsToWatch = dirsToWatch.concat(
                fs.readdirSync("sim")
                    .map(p => path.join("sim", p))
                    .filter(p => fs.statSync(p).isDirectory()));
        }
    }

    let hexCachePath = path.resolve(process.cwd(), "built", "hexcache");
    nodeutil.mkdirP(hexCachePath);

    console.log(`building target.json in ${process.cwd()}...`)
    return forEachBundledPkgAsync((pkg, dirname) => {
        pxt.log(`building ${dirname}`);
        let isPrj = /prj$/.test(dirname);
        const config = JSON.parse(fs.readFileSync(pxt.CONFIG_NAME, "utf8")) as pxt.PackageConfig;
        if (config && config.additionalFilePath) {
            dirsToWatch.push(path.resolve(config.additionalFilePath));
        }

        return pkg.filesToBePublishedAsync(true)
            .then(res => {
                if (!isPrj)
                    cfg.bundledpkgs[path.basename(dirname)] = res
            })
            .then(() => testForBuildTargetAsync(isPrj))
            .then((compileOpts) => {
                // For the projects, we need to save the base HEX file to the offline HEX cache
                if (isPrj && pxt.appTarget.compile.hasHex) {
                    if (!compileOpts) {
                        console.error(`Failed to extract HEX image for project ${dirname}`);
                        return;
                    }

                    // Place the base HEX image in the hex cache if necessary
                    let sha = compileOpts.extinfo.sha;
                    let hex: string[] = compileOpts.hexinfo.hex;
                    let hexFile = path.join(hexCachePath, sha + ".hex");

                    if (fs.existsSync(hexFile)) {
                        pxt.debug(`.hex image already in offline cache for project ${dirname}`);
                    } else {
                        fs.writeFileSync(hexFile, hex.join(os.EOL));
                        pxt.debug(`created .hex image in offline cache for project ${dirname}: ${hexFile}`);
                    }
                }
            })
    }, /*includeProjects*/ true)
        .then(() => {
            let info = travisInfo()
            cfg.versions = {
                branch: info.branch,
                tag: info.tag,
                commits: info.commitUrl,
                target: readJson("package.json")["version"],
                pxt: pxtVersion(),
                pxtCrowdinBranch: pxtCrowdinBranch()
            }

            saveThemeJson(cfg)

            const webmanifest = buildWebManifest(cfg)
            const targetjson = JSON.stringify(cfg, null, 2)
            fs.writeFileSync("built/target.json", targetjson)
            fs.writeFileSync("built/target.js", targetJsPrefix + targetjson)
            pxt.setAppTarget(cfg) // make sure we're using the latest version
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

function pxtVersion(): string {
    return pxt.appTarget.id == "core" ?
        readJson("package.json")["version"] :
        readJson("node_modules/pxt-core/package.json")["version"];
}

function pxtCrowdinBranch(): string {
    return pxt.appTarget.id == "core" ?
        readJson("pxtarget.json").appTheme.crowdinBranch :
        readJson("node_modules/pxt-core/pxtarget.json").appTheme.crowdinBranch;
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
    if (!fs.existsSync("sim/tsconfig.json")) {
        console.log("No sim/tsconfig.json; assuming npm installed package")
        return Promise.resolve()
    }

    const hasCommonPackages = fs.existsSync(path.resolve("node_modules/pxt-common-packages"));

    let simDirectories: string[] = [];
    if (hasCommonPackages) {
        const libsdir = path.resolve("node_modules/pxt-common-packages/libs");
        simDirectories = fs.readdirSync(libsdir).map(fn => path.join(libsdir, fn, "sim"));
        simDirectories = simDirectories.filter(fn => fs.existsSync(fn));
    }

    return buildAndWatchAsync(() => buildPxtAsync(includeSourceMaps)
        .then(buildCommonSimAsync, e => buildFailed("common sim build failed: " + e.message, e))
        .then(() => buildTargetAsync().then(r => { }, e => {
            buildFailed("target build failed: " + e.message, e)
        }))
        .then(() => buildTargetDocsAsync(false, true).then(r => { }, e => {
            buildFailed("target build failed: " + e.message, e)
        }))
        .then(() => {
            let toWatch = [path.resolve("node_modules/pxt-core")].concat(dirsToWatch)
            if (hasCommonPackages) {
                toWatch = toWatch.concat(simDirectories);
            }
            return toWatch;
        }));
}

function buildCommonSimAsync() {
    const simPath = path.resolve("node_modules/pxt-common-packages/sim");
    if (fs.existsSync(simPath)) {
        return buildFolderAsync(simPath)
    }
    else {
        return Promise.resolve();
    }
}

function renderDocs(builtPackaged: string, localDir: string) {
    let dst = path.resolve(path.join(builtPackaged, localDir))

    nodeutil.cpR("node_modules/pxt-core/docfiles", path.join(dst, "/docfiles"))
    if (fs.existsSync("docfiles"))
        nodeutil.cpR("docfiles", dst + "/docfiles")

    let webpath = localDir
    let docsTemplate = server.expandDocFileTemplate("docs.html")
    docsTemplate = U.replaceAll(docsTemplate, "/cdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/doccdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/docfiles/", webpath + "docfiles/")
    docsTemplate = U.replaceAll(docsTemplate, "/--embed", webpath + "embed.js")

    const dirs: Map<boolean> = {}
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
            let html = ""
            if (U.endsWith(f, ".md"))
                html = pxt.docs.renderMarkdown({
                    template: docsTemplate,
                    markdown: str,
                    theme: pxt.appTarget.appTheme,
                    filepath: f,
                })
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

export function serveAsync(parsed: commandParser.ParsedCommand) {
    forceCloudBuild = false; // always use yotta

    let justServe = false
    let packaged = false
    let includeSourceMaps = false;
    let browser: string = parsed.flags["browser"] as string;

    if (parsed.flags["cloud"]) {
        forceCloudBuild = true
    }
    if (parsed.flags["just"]) {
        justServe = true
    } else if (parsed.flags["pkg"]) {
        justServe = true
        packaged = true
    }
    if (parsed.flags["noBrowser"]) {
        globalConfig.noAutoStart = true
    }
    if (parsed.flags["sourceMaps"]) {
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
            autoStart: !globalConfig.noAutoStart,
            electron: !!parsed.flags["electron"],
            localToken,
            packaged,
            electronHandlers,
            port: parsed.flags["port"] as number || 0,
            wsPort: parsed.flags["wsport"] as number || 0,
            hostname: parsed.flags["hostname"] as string || "",
            browser: parsed.flags["browser"] as string,
            serial: !parsed.flags["noSerial"]
        }))
}


const readFileAsync: any = Promise.promisify(fs.readFile)
const writeFileAsync: any = Promise.promisify(fs.writeFile)
const execAsync: (cmd: string, options?: { cwd?: string }) => Promise<Buffer> = Promise.promisify(child_process.exec)
const readDirAsync = Promise.promisify(fs.readdir)
const statAsync = Promise.promisify(fs.stat)
const rimrafAsync = Promise.promisify(rimraf);

let commonfiles: Map<string> = {}

class SnippetHost implements pxt.Host {
    //Global cache of module files
    files: Map<Map<string>> = {}

    constructor(public name: string, public main: string, public extraDependencies: string[], private includeCommon = false) { }

    resolve(module: pxt.Package, filename: string): string {
        return ""
    }

    readFile(module: pxt.Package, filename: string): string {
        if (this.files[module.id] && this.files[module.id][filename]) {
            return this.files[module.id][filename]
        }
        if (module.id == "this") {
            if (filename == "pxt.json") {
                return JSON.stringify(<pxt.PackageConfig>{
                    "name": this.name,
                    "dependencies": this.dependencies(),
                    "description": "",
                    "yotta": {
                        "ignoreConflicts": true
                    },
                    "files": this.includeCommon ? [
                        "main.blocks", //TODO: Probably don't want this
                        "main.ts",
                        "pxt-core.d.ts",
                        "pxt-helpers.ts"
                    ] : [
                            "main.blocks", //TODO: Probably don't want this
                            "main.ts",
                        ]
                })
            }
            else if (filename == "main.ts") {
                return this.main
            }
        } else if (pxt.appTarget.bundledpkgs[module.id] && filename === pxt.CONFIG_NAME) {
            return pxt.appTarget.bundledpkgs[module.id][pxt.CONFIG_NAME];
        } else {
            let ps = [
                path.join(module.id, filename),
                path.join('libs', module.id, filename),
                path.join('libs', module.id, 'built', filename),
            ];

            let contents: string = null
            if (!ps.some(p => {
                try {
                    contents = fs.readFileSync(p, 'utf8')
                    return true;
                }
                catch (e) {
                }
                return false;
            })) {
                // try additional package location
                if (pxt.appTarget.bundledpkgs[module.id]) {
                    const modpkg = JSON.parse(pxt.appTarget.bundledpkgs[module.id][pxt.CONFIG_NAME]) as pxt.PackageConfig;
                    if (modpkg.additionalFilePath) {
                        try {
                            const ad = path.join(modpkg.additionalFilePath.replace('../../', ''), filename);
                            pxt.debug(ad)
                            contents = fs.readFileSync(ad, 'utf8')
                        }
                        catch (e) {
                        }
                    }
                }
            }

            if (contents) {
                this.writeFile(module, filename, contents)
                return contents
            }
        }

        if (module.id === "this") {
            if (filename === "pxt-core.d.ts") {
                const contents = fs.readFileSync(path.join(this.getRepoDir(), "libs", "pxt-common", "pxt-core.d.ts"), 'utf8');
                this.writeFile(module, filename, contents);
                return contents;
            }
            else if (filename === "pxt-helpers.ts") {
                const contents = fs.readFileSync(path.resolve(this.getRepoDir(), "libs", "pxt-common", "pxt-helpers.ts"), 'utf8');
                this.writeFile(module, filename, contents);
                return contents;
            }
        }

        pxt.debug(`unresolved file ${module.id}/${filename}`)
        return ""
    }

    private getRepoDir() {
        const cwd = process.cwd();
        const i = cwd.lastIndexOf(path.sep + "pxt" + path.sep);
        return cwd.substr(0, i + 5);
    }

    writeFile(module: pxt.Package, filename: string, contents: string) {
        if (!this.files[module.id]) {
            this.files[module.id] = {}
        }
        this.files[module.id][filename] = contents
    }

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        return pxt.hex.getHexInfoAsync(this, extInfo)
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

    private dependencies(): Map<string> {
        let stdDeps: Map<string> = {}
        for (let extraDep of this.extraDependencies) {
            stdDeps[extraDep] = `file:../${extraDep}`
        }
        return stdDeps
    }
}

class Host
    implements pxt.Host {
    fileOverrides: Map<string> = {}

    resolve(module: pxt.Package, filename: string) {
        pxt.debug(`resolving ${module.level}:${module.id} -- ${filename} in ${path.resolve(".")}`)
        if (module.level == 0) {
            return "./" + filename
        } else if (module.verProtocol() == "file") {
            return module.verArgument() + "/" + filename
        } else {
            return "pxt_modules/" + module.id + "/" + filename
        }
    }

    readFile(module: pxt.Package, filename: string): string {
        const commonFile = U.lookup(commonfiles, filename)
        if (commonFile != null) return commonFile;

        const overFile = U.lookup(this.fileOverrides, filename)
        if (module.level == 0 && overFile != null) {
            pxt.debug(`found override for ${filename}`)
            return overFile;
        }

        const resolved = this.resolve(module, filename)
        try {
            pxt.debug(`reading ${path.resolve(resolved)}`)
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

        if (U.endsWith(filename, ".uf2"))
            fs.writeFileSync(p, contents, "base64")
        else if (U.endsWith(filename, ".elf"))
            fs.writeFileSync(p, contents, {
                encoding: "base64",
                mode: 0o777
            })
        else
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
                    pxt.log(`skipping download of local pkg: ${pkg.version()}`)
                    return Promise.resolve()
                } else {
                    return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
                }
            })
    }

}

let mainPkg = new pxt.MainPackage(new Host())

export function installAsync(parsed?: commandParser.ParsedCommand) {
    ensurePkgDir();
    const packageName = parsed && parsed.arguments.length ? parsed.arguments[0] : undefined;
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
    },
    "exclude": ["pxt_modules/**/*test.ts"]
}
`,

    "test.ts": `// tests go here; this will not be compiled when this package is used as a library
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
        "args": [""]
    }, {
        "taskName": "build",
        "isTestCommand": true,
        "problemMatcher": "$tsc",
        "args": [""]
    }, {
        "taskName": "clean",
        "isTestCommand": true,
        "problemMatcher": "$tsc",
        "args": [""]
    }, {
        "taskName": "serial",
        "isTestCommand": true,
        "problemMatcher": "$tsc",
        "args": [""]
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

export function addAsync(parsed: commandParser.ParsedCommand) {
    if (pxt.appTarget.compile.hasHex) {
        p.defineCommand({ name: "asm", help: "add assembly support" }, addAsmAsync);
        p.defineCommand({ name: "cpp", help: "add C++ extension support" }, addCppAsync);
    }
    return handleCommandAsync(parsed.arguments, loadPkgAsync)
}

export function initAsync(parsed: commandParser.ParsedCommand) {
    if (fs.existsSync(pxt.CONFIG_NAME))
        U.userError(`${pxt.CONFIG_NAME} already present`)

    let prj = pxt.appTarget.tsprj;
    let config = U.clone(prj.config);

    config.name = path.basename(path.resolve(".")).replace(/^pxt-/, "")
    // by default, projects are not public
    config.public = false

    let configMap: Map<string> = config as any

    if (!config.license) {
        config.license = "MIT"
    }
    if (!config.version) {
        config.version = "0.0.0"
    }


    let initPromise = Promise.resolve();
    if (!parsed.flags["useDefaults"]) {
        initPromise = Promise.mapSeries(["name", "description", "license"], f =>
            queryAsync(f, configMap[f])
                .then(r => {
                    configMap[f] = r
                })).then(() => { });
    }

    return initPromise
        .then(() => {
            const files: Map<string> = {};
            for (const f in defaultFiles)
                files[f] = defaultFiles[f];
            for (const f in prj.files)
                if (f != "README.md") // this one we need to keep
                    files[f] = prj.files[f];

            const pkgFiles = Object.keys(files).filter(s =>
                /\.(md|ts|asm|cpp|h)$/.test(s))

            const fieldsOrder = [
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
            const newCfg: any = {}
            for (const f of fieldsOrder) {
                if (configMap.hasOwnProperty(f))
                    newCfg[f] = configMap[f]
            }
            for (const f of Object.keys(configMap)) {
                if (!newCfg.hasOwnProperty(f))
                    newCfg[f] = configMap[f]
            }

            files[pxt.CONFIG_NAME] = JSON.stringify(newCfg, null, 4) + "\n"

            configMap = U.clone(configMap)
            configMap["target"] = pxt.appTarget.platformid || pxt.appTarget.id

            U.iterMap(files, (k, v) => {
                v = v.replace(/@([A-Z]+)@/g, (f, n) => configMap[n.toLowerCase()] || "")
                nodeutil.mkdirP(path.dirname(k))
                fs.writeFileSync(k, v)
            })
        })
        .then(() => installAsync())
        .then(() => {
            pxt.log("Package initialized.")
            pxt.log("Try 'pxt add' to add optional features.")
        })
}

enum BuildOption {
    JustBuild,
    Run,
    Deploy,
    Test,
    DebugSim,
    GenDocs,
}

export function serviceAsync(parsed: commandParser.ParsedCommand) {
    let fn = "built/response.json"
    return mainPkg.getCompileOptionsAsync()
        .then(opts => {
            pxtc.service.performOperation("reset", {})
            pxtc.service.performOperation("setOpts", { options: opts })
            return pxtc.service.performOperation(parsed.arguments[0], {})
        })
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

export function augmnetDocsAsync(parsed: commandParser.ParsedCommand) {
    let f0 = fs.readFileSync(parsed.arguments[0], "utf8")
    let f1 = fs.readFileSync(parsed.arguments[1], "utf8")
    console.log(pxt.docs.augmentDocs(f0, f1))
    return Promise.resolve()
}

export function timeAsync() {
    ensurePkgDir();
    let min: Map<number> = null;
    let loop = () =>
        mainPkg.getCompileOptionsAsync(mainPkg.getTargetOptions())
            .then(opts => pxtc.compile(opts))
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

export function formatAsync(parsed: commandParser.ParsedCommand) {
    let inPlace = !!parsed.flags["i"];
    let testMode = !!parsed.flags["t"];

    let fileList = Promise.resolve()
    let fileNames = parsed.arguments;
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
            if (msg.type == "serial") {
                let d = (msg as any).data
                if (typeof d == "string") d = d.replace(/\n$/, "")
                console.log("SERIAL:", d)
            }
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
    process.chdir("../..")
    if (!nodeutil.existsDirSync("sim")) return;

    let decls: Map<ts.Symbol> = {}

    if (!pkgOpts.extinfo || pkgOpts.extinfo.functions.length == 0) return

    pxt.log("checking for missing sim implementations...")

    const sources = ["built/sim.d.ts", "node_modules/pxt-core/built/pxtsim.d.ts"];
    if (fs.existsSync("built/common-sim.d.ts")) {
        sources.push("built/common-sim.d.ts")
    }

    let opts: pxtc.CompileOptions = {
        fileSystem: {},
        sourceFiles: sources,
        target: mainPkg.getTargetOptions(),
        ast: true,
        noEmit: true,
        hexinfo: null
    }

    opts.target.isNative = false

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
        if (pxtc.isBuiltinSimOp(shim))
            continue
        let simName = pxtc.shimToJs(shim)
        let sym = U.lookup(decls, simName)
        if (!sym) {
            pxt.log("missing in sim: " + simName)
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


function testForBuildTargetAsync(useNative: boolean): Promise<pxtc.CompileOptions> {
    let opts: pxtc.CompileOptions
    return mainPkg.loadAsync()
        .then(() => {
            copyCommonFiles();
            let target = mainPkg.getTargetOptions()
            if (target.hasHex)
                target.isNative = true
            if (!useNative)
                target.isNative = false
            return mainPkg.getCompileOptionsAsync(target)
        })
        .then(o => {
            opts = o
            opts.testMode = true
            opts.ast = true
            if (useNative)
                return pxtc.compile(opts)
            else {
                pxt.log("  skip native build of non-project")
                return null
            }
        })
        .then(res => {
            if (res) {
                reportDiagnostics(res.diagnostics);
                if (!res.success) U.userError("Compiler test failed")
                simulatorCoverage(res, opts)
            }
        })
        .then(() => opts);
}

function simshimAsync() {
    pxt.debug("looking for shim annotations in the simulator.")
    if (!nodeutil.existsDirSync("sim")) {
        pxt.debug("no sim folder, skipping.")
        return Promise.resolve();
    }
    let prog = pxtc.plainTsc("sim")
    let shims = pxt.simshim(prog)
    let filename = "sims.d.ts"
    for (const s of Object.keys(shims)) {
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
            pxt.debug(`updating ${fn}`)
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

function testConverterAsync(parsed: commandParser.ParsedCommand) {
    const url = parsed.arguments[0];
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

function testDirAsync(parsed: commandParser.ParsedCommand) {
    forceCloudBuild = true;

    const dir = path.resolve(parsed.arguments[0] || ".");
    let tests: TestInfo[] = []
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
                const host = mainPkg.host() as Host;
                host.fileOverrides = {}
                host.fileOverrides[fn] = ti.text
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

function replaceFileExtension(file: string, extension: string) {
    return file && file.substr(0, file.length - path.extname(file).length) + extension;
}

interface PackageConflictTestCase {
    id: number
    dependencies: string[];
    pkgToAdd: string;
    main: string;
    expectedConflicts: string[];
    expectedInUse: string[];
}

function testPkgConflictsAsync() {
    console.log("Package conflict tests");
    /*
    Fake bundled packages are as follows (see [pxt root]/tests/pkgconflicts/built/target.json):
        Project dependencies        Packages added by test cases, conflicts in parentheses
        A  B  C                     F(C)  G     H(C,D)      G has "configIsJustDefaults"
        | / \                       |     |     |           I has same setting values as installed dependencies
        D    E                      I     J(D)  K(C,E)
    */
    const testCases: PackageConflictTestCase[] = [
        { id: 1, dependencies: ["A", "B", "C"], pkgToAdd: "I", main: "D.test()", expectedConflicts: [], expectedInUse: [] },
        { id: 2, dependencies: ["A", "B"], pkgToAdd: "F", main: "test.test()", expectedConflicts: [], expectedInUse: [] },
        { id: 3, dependencies: ["B", "C"], pkgToAdd: "J", main: "C.test()", expectedConflicts: ["B", "D"], expectedInUse: [] },
        { id: 4, dependencies: ["A", "B", "C"], pkgToAdd: "G", main: "D.test()\nC.test()", expectedConflicts: ["A", "B", "D"], expectedInUse: ["D"] },
        { id: 5, dependencies: ["A", "B", "C"], pkgToAdd: "H", main: "C.test()\nD.test()\ntest.test()\E.test()", expectedConflicts: ["A", "B", "C", "D", "E"], expectedInUse: ["C", "D", "E"] },
        { id: 6, dependencies: ["A", "B", "C"], pkgToAdd: "F", main: "", expectedConflicts: ["C"], expectedInUse: [] },
    ];
    const failures: { testCase: number; reason: string }[] = [];
    const oldAppTarget = pxt.appTarget;

    nodeutil.setTargetDir(path.join(__dirname, "..", "tests", "pkgconflicts"));
    let trg = nodeutil.getPxtTarget();
    pxt.setAppTarget(trg);

    return Promise.mapSeries(testCases, (tc) => {
        let testFailed = (reason: string) => {
            failures.push({ testCase: tc.id, reason });
        };

        let mainPkg = new pxt.MainPackage(new SnippetHost("package conflict tests", tc.main, tc.dependencies));
        tc.expectedConflicts = tc.expectedConflicts.sort();
        tc.expectedInUse = tc.expectedInUse.sort();

        return mainPkg.installAllAsync()
            .then(() => mainPkg.findConflictsAsync(tc.pkgToAdd, "*"))
            .then((conflicts) => {
                let conflictNames = conflicts.map((c) => c.pkg0.id).sort();
                if (conflictNames.length !== tc.expectedConflicts.length || !conflictNames.every((cn, i) => conflictNames[i] === tc.expectedConflicts[i])) {
                    testFailed(`Mismatch on expected conflicts (found: [${conflictNames.join(", ")}], expected: [${tc.expectedConflicts.join(", ")}])`);
                } else {
                    let inUse = conflictNames.filter((cn) => mainPkg.isPackageInUse(cn));
                    if (inUse.length !== tc.expectedInUse.length || !inUse.every((cn, i) => inUse[i] === tc.expectedInUse[i])) {
                        testFailed(`Mismatch on expected in-use conflicts (found: [${inUse.join(", ")}], expected: [${tc.expectedInUse.join(", ")}])`);
                    }
                }

                pxt.log(`package conflict test OK: ${tc.id}`);
                return Promise.resolve();
            })
            .catch((e) => {
                pxt.log(`package conflict test FAILED: ${tc.id}`);
                testFailed("Uncaught exception during test: " + e.message || e);
            });
    })
        .then(() => {
            pxt.log(`${testCases.length - failures.length} passed, ${failures.length} failed`);

            if (failures.length) {
                pxt.log(failures.map((e) => `Failure in test case ${e.testCase}: ${e.reason}`).join("\n"));
                process.exit(1);
            }
        })
        .finally(() => {
            pxt.setAppTarget(oldAppTarget);
        });
}

function decompileAsync(parsed: commandParser.ParsedCommand) {
    return Promise.mapSeries(parsed.arguments, f => {
        const outFile = replaceFileExtension(f, ".blocks")
        return decompileAsyncWorker(f, parsed.flags["dep"] as string)
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
        const pkg = new pxt.MainPackage(new SnippetHost("decompile-pkg", input, dependency ? [dependency] : [], true));

        pkg.getCompileOptionsAsync()
            .then(opts => {
                opts.ast = true;
                const decompiled = pxtc.decompile(opts, "main.ts");
                if (decompiled.success) {
                    resolve(decompiled.outfiles["main.blocks"]);
                }
                else {
                    reject("Could not decompile " + f + JSON.stringify(decompiled.diagnostics, null, 4));
                }
            });
    });
}

function testSnippetsAsync(snippets: CodeSnippet[], re?: string): Promise<void> {
    let filenameMatch: RegExp;
    try {
        let pattern = re || '.*';
        filenameMatch = new RegExp(pattern);
    }
    catch (e) {
        console.log(`pattern could not be compiled as a regular expression, ignoring`);
        filenameMatch = new RegExp('.*')
    }
    snippets = snippets.filter(snippet => filenameMatch.test(snippet.name));
    let ignoreCount = 0

    const successes: string[] = []
    interface FailureInfo {
        filename: string
        diagnostics: pxtc.KsDiagnostic[]
    }
    const failures: FailureInfo[] = []
    const addSuccess = (s: string) => {
        successes.push(s)
    }
    const addFailure = (f: string, infos: pxtc.KsDiagnostic[]) => {
        failures.push({
            filename: f,
            diagnostics: infos
        })
        infos.forEach(info => pxt.log(`${f}:(${info.line},${info.start}): ${info.category} ${info.messageText}`));
    }
    return Promise.map(snippets, (snippet: CodeSnippet) => {
        const name = snippet.name;
        const fn = snippet.file || snippet.name;
        pxt.debug(`compiling ${fn} (${snippet.type})`);

        if (snippet.ext == "json") {
            try {
                const codecards = JSON.parse(snippet.code)
                if (!codecards || !Array.isArray(codecards))
                    throw new Error("codecards must be an JSON array")
                addSuccess(fn);
            } catch (e) {
                addFailure(fn, [{
                    code: 4242,
                    category: ts.DiagnosticCategory.Error,
                    messageText: "invalid JSON: " + e.message,
                    fileName: fn,
                    start: 1,
                    line: 1,
                    length: 1,
                    column: 1
                }]);
            }
            return Promise.resolve();
        }

        const pkg = new pxt.MainPackage(new SnippetHost(name, snippet.code, Object.keys(snippet.packages)));
        return pkg.getCompileOptionsAsync().then(opts => {
            opts.ast = true
            let resp = pxtc.compile(opts)

            if (resp.success) {
                if (/^block/.test(snippet.type)) {
                    //Similar to pxtc.decompile but allows us to get blocksInfo for round trip
                    const file = resp.ast.getSourceFile('main.ts');
                    const apis = pxtc.getApiInfo(resp.ast);
                    const blocksInfo = pxtc.getBlocksInfo(apis);
                    const bresp = pxtc.decompiler.decompileToBlocks(blocksInfo, file, { snippetMode: false })
                    const success = !!bresp.outfiles['main.blocks']
                    if (success) return addSuccess(name)
                    else return addFailure(fn, bresp.diagnostics)
                }
                else {
                    return addSuccess(fn)
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
                    fileName: fn,
                    start: 1,
                    line: 1,
                    length: 1,
                    column: 1
                }
            ])
        })
    }, { concurrency: 4 }).then((a: any) => {
        pxt.log(`${successes.length}/${successes.length + failures.length} snippets compiled to blocks, ${failures.length} failed`)
        if (ignoreCount > 0) {
            pxt.log(`Skipped ${ignoreCount} snippets`)
        }
    }).then(() => {
        if (failures.length > 0)
            U.userError(`${failures.length} snippets not compiling in the docs`)
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
            if (target.hasHex)
                target.isNative = true
            switch (mode) {
                case BuildOption.Run:
                case BuildOption.DebugSim:
                case BuildOption.GenDocs:
                    target.isNative = false
                    break
                default:
                    break
            }
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

function dbgTestAsync() {
    return buildCoreAsync({
        mode: BuildOption.JustBuild,
        debug: true
    })
        .then(clidbg.startAsync)
}

interface BuildCoreOptions {
    mode: BuildOption;

    debug?: boolean;

    // docs
    locs?: boolean;
    docs?: boolean;
    fileFilter?: string;
    createOnly?: boolean;
}

function buildCoreAsync(buildOpts: BuildCoreOptions): Promise<pxtc.CompileResult> {
    let compileOptions: pxtc.CompileOptions;
    let compileResult: pxtc.CompileResult;
    ensurePkgDir();
    return prepBuildOptionsAsync(buildOpts.mode)
        .then((opts) => {
            compileOptions = opts;
            opts.breakpoints = buildOpts.mode === BuildOption.DebugSim;
            if (buildOpts.debug) {
                opts.breakpoints = true
                opts.justMyCode = true
            }
            return pxtc.compile(opts);
        })
        .then((res): Promise<void | pxtc.CompileOptions> => {
            compileResult = res
            U.iterMap(res.outfiles, (fn, c) => {
                if (fn !== pxtc.BINARY_JS) {
                    mainPkg.host().writeFile(mainPkg, "built/" + fn, c);
                }
                else {
                    mainPkg.host().writeFile(mainPkg, "built/debug/" + fn, c);
                }
            });

            reportDiagnostics(res.diagnostics);
            if (!res.success) {
                process.exit(1)
            }

            if (buildOpts.mode === BuildOption.DebugSim) {
                mainPkg.host().writeFile(mainPkg, "built/debug/debugInfo.json", JSON.stringify({
                    usedParts: pxtc.computeUsedParts(res, true),
                    usedArguments: res.usedArguments,
                    breakpoints: res.breakpoints
                }));
            }

            console.log(`Package built; written to ${pxt.outputName()}; size: ${(res.outfiles[pxt.outputName()] || "").length}`)

            switch (buildOpts.mode) {
                case BuildOption.GenDocs:
                    const apiInfo = pxtc.getApiInfo(res.ast)
                    // keeps apis from this module only
                    for (const infok in apiInfo.byQName) {
                        const info = apiInfo.byQName[infok];
                        if (info.pkg &&
                            info.pkg != mainPkg.config.name) delete apiInfo.byQName[infok];
                    }
                    const md = pxtc.genMarkdown(mainPkg.config.name, apiInfo, {
                        package: mainPkg.config.name != pxt.appTarget.corepkg,
                        locs: buildOpts.locs,
                        docs: buildOpts.docs
                    })
                    if (buildOpts.fileFilter) {
                        const filterRx = new RegExp(buildOpts.fileFilter, "i");
                        Object.keys(md).filter(fn => !filterRx.test(fn)).forEach(fn => delete md[fn]);
                    }
                    mainPkg.host().writeFile(mainPkg, "built/apiinfo.json", JSON.stringify(apiInfo, null, 1))
                    for (const fn in md) {
                        const folder = /strings.json$/.test(fn) ? "_locales/" : /\.md$/.test(fn) ? "../../docs/" : "built/";
                        const ffn = path.join(folder, fn);
                        if (!buildOpts.createOnly || !fs.existsSync(ffn)) {
                            nodeutil.mkdirP(path.dirname(ffn));
                            mainPkg.host().writeFile(mainPkg, ffn, md[fn])
                            console.log(`generated ${ffn}; size=${md[fn].length}`)
                        }
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
            return compileResult;
        });
}


function crowdinCredentials(): { prj: string; key: string; branch: string; } {
    const prj = pxt.appTarget.appTheme.crowdinProject;
    if (!prj) {
        pxt.log(`crowdin upload skipped, Crowdin project missing in target theme`);
        return null;
    }
    const key = passwordGet(CROWDIN_KEY) || process.env[pxt.crowdin.KEY_VARIABLE] as string;
    if (!key) {
        pxt.log(`crowdin upload skipped, crowdin token or '${pxt.crowdin.KEY_VARIABLE}' variable missing`);
        return null;
    }
    const branch = pxt.appTarget.appTheme.crowdinBranch;
    return { prj, key, branch };
}

export function uploadTargetTranslationsAsync(parsed?: commandParser.ParsedCommand) {
    const uploadDocs = parsed && !!parsed.flags["docs"];
    return internalUploadTargetTranslationsAsync(uploadDocs);
}

function internalUploadTargetTranslationsAsync(uploadDocs: boolean) {
    const cred = crowdinCredentials();
    if (!cred) return Promise.resolve();
    const crowdinDir = pxt.appTarget.id;
    if (crowdinDir == "core") {
        if (!uploadDocs) {
            pxt.log('missing --docs flag, skipping')
            return Promise.resolve();
        }
        return uploadDocsTranslationsAsync("docs", crowdinDir, cred.branch, cred.prj, cred.key)
            .then(() => uploadDocsTranslationsAsync("common-docs", crowdinDir, cred.branch, cred.prj, cred.key))
    } else {
        return execCrowdinAsync("upload", "built/target-strings.json", crowdinDir)
            .then(() => execCrowdinAsync("upload", "built/sim-strings.json", crowdinDir))
            .then(() => uploadBundledTranslationsAsync(crowdinDir, cred.branch, cred.prj, cred.key))
            .then(() => uploadDocs
                ? uploadDocsTranslationsAsync("docs", crowdinDir, cred.branch, cred.prj, cred.key)
                    // scan for docs in bundled packages
                    .then(() => Promise.all(pxt.appTarget.bundleddirs
                        // there must be a folder under .../docs
                        .filter(pkgDir => nodeutil.existsDirSync(path.join(pkgDir, "docs")))
                        // upload to crowdin
                        .map(pkgDir => uploadDocsTranslationsAsync(path.join(pkgDir, "docs"), crowdinDir, cred.branch, cred.prj, cred.key)
                        )).then(() => { }))
                : Promise.resolve());
    }
}

function uploadDocsTranslationsAsync(srcDir: string, crowdinDir: string, branch: string, prj: string, key: string): Promise<void> {
    pxt.log(`uploading from ${srcDir} to ${crowdinDir} under project ${prj}/${branch || ""}`)

    const todo = nodeutil.allFiles(srcDir).filter(f => /\.md$/.test(f) && !/_locales/.test(f)).reverse();
    const knownFolders: Map<boolean> = {};
    const ensureFolderAsync = (crowdd: string) => {
        if (!knownFolders[crowdd]) {
            knownFolders[crowdd] = true;
            pxt.log(`creating folder ${crowdd}`);
            return pxt.crowdin.createDirectoryAsync(branch, prj, key, crowdd);
        }
        return Promise.resolve();
    }
    const nextFileAsync = (f: string): Promise<void> => {
        if (!f) return Promise.resolve();
        const crowdf = path.join(crowdinDir, f);
        const crowdd = path.dirname(crowdf);
        // check if directory has a .crowdinignore file
        if (nodeutil.fileExistsSync(path.join(path.dirname(f), ".crowdinignore"))) {
            pxt.log(`skpping ${f} because of .crowdinignore file`)
            return Promise.resolve();
        }

        const data = fs.readFileSync(f, 'utf8');
        pxt.log(`uploading ${f} to ${crowdf}`);
        return ensureFolderAsync(crowdd)
            .then(() => pxt.crowdin.uploadTranslationAsync(branch, prj, key, crowdf, data))
            .then(() => nextFileAsync(todo.pop()));
    }
    return ensureFolderAsync(path.join(crowdinDir, srcDir))
        .then(() => nextFileAsync(todo.pop()));
}

function uploadBundledTranslationsAsync(crowdinDir: string, branch: string, prj: string, key: string): Promise<void> {
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
        return pxt.crowdin.uploadTranslationAsync(branch, prj, key, crowdf, JSON.stringify(data))
            .then(nextFileAsync);
    }
    return nextFileAsync();
}

export function downloadTargetTranslationsAsync(parsed: commandParser.ParsedCommand) {
    const cred = crowdinCredentials();
    if (!cred) return Promise.resolve();

    const crowdinDir = pxt.appTarget.id;
    const name = parsed.arguments[0] || "";
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
        return pxt.crowdin.downloadTranslationsAsync(cred.branch, cred.prj, cred.key, crowdf, { translatedOnly: true, validatedOnly: true })
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

export function staticpkgAsync(parsed: commandParser.ParsedCommand) {
    const route = parsed.flags["route"] as string || "";
    const ghpages = parsed.flags["githubpages"];
    const builtPackaged = parsed.flags["output"] as string || "built/packaged";
    const minify = !!parsed.flags["minify"];

    pxt.log(`packaging editor to ${builtPackaged}`)

    let p = rimrafAsync(builtPackaged, {})
        .then(() => buildTargetAsync());
    if (ghpages) return p.then(() => ghpPushAsync(builtPackaged, minify));
    else return p.then(() => internalStaticPkgAsync(builtPackaged, route, minify));
}

function internalStaticPkgAsync(builtPackaged: string, label: string, minify: boolean) {
    const pref = path.resolve(builtPackaged);
    const localDir = label == "./" ? "./" : label ? "/" + label + "/" : "/"
    return uploadCoreAsync({
        label: label || "main",
        pkgversion: "0.0.0",
        fileList: pxtFileList("node_modules/pxt-core/").concat(targetFileList()),
        localDir,
        target: (pxt.appTarget.id || "unknownstatic"),
        builtPackaged,
        minify
    }).then(() => renderDocs(builtPackaged, localDir))
}

export function cleanAsync(parsed: commandParser.ParsedCommand) {
    pxt.log('cleaning built folders')
    return rimrafAsync("built", {})
        .then(() => rimrafAsync("libs/**/built", {}))
        .then(() => rimrafAsync("projects/**/built", {}))
        .then(() => { });
}

export function buildAsync(parsed: commandParser.ParsedCommand) {
    forceCloudBuild = !!parsed.flags["cloud"];

    let mode = BuildOption.JustBuild;
    if (parsed.flags["debug"]) {
        mode = BuildOption.DebugSim;
    }

    return buildCoreAsync({ mode })
        .then((compileOpts) => { });
}

export function gendocsAsync(parsed: commandParser.ParsedCommand) {
    return buildTargetDocsAsync(
        !!parsed.flags["docs"],
        !!parsed.flags["locs"],
        parsed.flags["files"] as string,
        !!parsed.flags["create"]
    );
}

export function buildTargetDocsAsync(docs: boolean, locs: boolean, fileFilter?: string, createOnly?: boolean): Promise<void> {
    const build = () => buildCoreAsync({
        mode: BuildOption.GenDocs,
        docs,
        locs,
        fileFilter,
        createOnly
    }).then((compileOpts) => { });
    // from target location?
    if (fs.existsSync("pxtarget.json"))
        return forEachBundledPkgAsync((pkg, dirname) => {
            pxt.log(`building docs in ${dirname}`);
            return build();
        });
    else return build();
}

export function deployAsync(parsed?: commandParser.ParsedCommand) {
    const serial = parsed && !!parsed.flags["serial"];
    return buildCoreAsync({ mode: BuildOption.Deploy })
        .then((compileOpts) => serial ? serialAsync(parsed) : Promise.resolve())
}

export function runAsync() {
    return buildCoreAsync({ mode: BuildOption.Run })
        .then((compileOpts) => { });
}

function runFloatAsync() {
    pxt.appTarget.compile.floatingPoint = true
    return runAsync()
}

export function testAsync() {
    return buildCoreAsync({ mode: BuildOption.Test })
        .then((compileOpts) => { });
}

export function serialAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    let buf: string = "";
    serial.monitorSerial((info, buffer) => {
        process.stdout.write(buffer);
    })
    return Promise.resolve();
}

export interface SavedProject {
    name: string;
    files: Map<string>;
}

export function extractAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    const vscode = !!parsed.flags["code"];
    const out = parsed.flags["code"] || '.';
    const filename = parsed.arguments[0];
    return extractAsyncInternal(filename, out as string, vscode);
}

function isScriptId(id: string) {
    return /^((_[a-zA-Z0-9]{12})|([\d\-]{20,}))$/.test(id)
}

function fetchTextAsync(filename: string): Promise<Buffer> {
    if (filename == "-" || !filename)
        return nodeutil.readResAsync(process.stdin)

    if (isScriptId(filename))
        filename = Cloud.apiRoot + filename + "/text"

    let m = /^(https:\/\/[^\/]+\/)([^\/]+)$/.exec(filename)
    let fn2 = ""

    if (m) {
        let id = m[2]
        if (/^api\//.test(id)) id = id.slice(4)
        if (isScriptId(id)) {
            fn2 = m[1] + "api/" + id + "/text"
        }
    }

    if (/^https?:/.test(filename)) {
        pxt.log(`fetching ${filename}...`)
        pxt.log(`compile log: ${filename.replace(/\.json$/i, ".log")}`)
        return U.requestAsync({ url: filename, allowHttpErrors: !!fn2 })
            .then(resp => {
                if (fn2 && (resp.statusCode != 200 || /html/.test(resp.headers["content-type"]))) {
                    pxt.log(`Trying also ${fn2}...`)
                    return U.requestAsync({ url: fn2 })
                } return resp
            })
            .then(resp => resp.buffer)
    } else
        return readFileAsync(filename)
}

function extractAsyncInternal(filename: string, out: string, vscode: boolean): Promise<void> {
    if (filename && nodeutil.existsDirSync(filename)) {
        pxt.log(`extracting folder ${filename}`);
        return Promise.all(fs.readdirSync(filename)
            .filter(f => /\.(hex|uf2)/.test(f))
            .map(f => extractAsyncInternal(path.join(filename, f), out, vscode)))
            .then(() => { });
    }

    return fetchTextAsync(filename)
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

    const unpackHexAsync = (buf: Buffer) =>
        pxt.cpp.unpackSourceFromHexAsync(buf as any)
            .then(data => {
                if (!data) return null
                if (!data.meta) data.meta = {} as any
                let id = data.meta.cloudId || "?"
                console.log(`.hex/uf2 cloudId: ${id}`)
                if (data.meta.targetVersions)
                    console.log(`target version: ${data.meta.targetVersions.target}, pxt ${data.meta.targetVersions.pxt}`);
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

    return Promise.resolve()
        .then(() => {
            let str = buf.toString("utf8")
            if (str[0] == ":") {
                console.log("Detected .hex file.")
                return unpackHexAsync(buf)
            } else if (str[0] == "U") {
                console.log("Detected .uf2 file.")
                return unpackHexAsync(buf)
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

export function hexdumpAsync(c: commandParser.ParsedCommand) {
    let filename = c.arguments[0]
    let buf = fs.readFileSync(filename)
    if (/^UF2\n/.test(buf.slice(0, 4).toString("utf8"))) {
        let r = pxtc.UF2.toBin(buf as any)
        if (r) {
            console.log("UF2 file detected.")
            console.log(pxtc.hex.hexDump(r.buf, r.start))
            return Promise.resolve()
        }
    }
    console.log("Binary file assumed.")
    console.log(pxtc.hex.hexDump(buf))
    return Promise.resolve()
}

export function hex2uf2Async(c: commandParser.ParsedCommand) {
    let filename = c.arguments[0]
    let buf = fs.readFileSync(filename, "utf8").split(/\r?\n/)
    if (buf[0][0] != ':') {
        console.log("Not a hex file: " + filename)
    } else {
        let f = pxtc.UF2.newBlockFile()
        pxtc.UF2.writeHex(f, buf)
        let uf2buf = new Buffer(pxtc.UF2.serializeFile(f), "binary")
        let uf2fn = filename.replace(/(\.hex)?$/i, ".uf2")
        fs.writeFileSync(uf2fn, uf2buf)
        console.log("Wrote: " + uf2fn)
    }
    return Promise.resolve()
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

function cherryPickAsync(parsed: commandParser.ParsedCommand) {
    const commit = parsed.arguments[0];
    const name = parsed.flags["name"] || commit.slice(0, 7);
    let majorVersion = parseInt(pxtVersion().split('.')[0]);
    const gitAsync = (args: string[]) => nodeutil.spawnAsync({
        cmd: "git",
        args
    })

    let branches: string[] = [];
    for (let i = majorVersion - 1; i >= 0; --i) branches.push("v" + i);
    pxt.log(`cherry picking ${commit} into ${branches.join(', ')}`)

    let p = gitAsync(["pull"]);
    branches.forEach(branch => {
        const pr = `cp/${branch}${name}`;
        p = p.then(() => gitAsync(["checkout", branch]))
            .then(() => gitAsync(["pull"]))
            .then(() => gitAsync(["checkout", "-b", pr]))
            .then(() => gitAsync(["cherry-pick", commit]))
            .then(() => gitAsync(["push", "--set-upstream", "origin", pr]));
    })

    return p.catch(() => gitAsync(["checkout", "master"]));
}

function checkDocsAsync(parsed?: commandParser.ParsedCommand): Promise<void> {
    return internalCheckDocsAsync(
        !!parsed.flags["snippets"],
        parsed.flags["re"] as string
    )
}

function internalCheckDocsAsync(compileSnippets?: boolean, re?: string): Promise<void> {
    if (!nodeutil.existsDirSync("docs"))
        return Promise.resolve();
    const docsRoot = nodeutil.targetDir;
    const summaryMD = nodeutil.resolveMd(docsRoot, "SUMMARY");

    if (!summaryMD) {
        pxt.log('no SUMMARY.md file found, skipping check docs');
        return Promise.resolve();
    }
    pxt.log(`checking docs`);

    const noTOCs: string[] = [];
    const todo: string[] = [];
    let urls: any = {};
    let checked = 0;
    let broken = 0;
    let snipCount = 0;
    let snippets: CodeSnippet[] = [];

    function pushUrl(url: string, toc: boolean) {
        // cache value
        if (!urls.hasOwnProperty(url)) {
            const specialPath = /^\/pkg\//.test(url) || /^\/--[a-z]+/.test(url);
            if (specialPath) {
                urls[url] = url;
                return;
            }
            const isResource = /\.[a-z]+$/i.test(url)
            if (!isResource && !toc) {
                pxt.debug(`link not in SUMMARY: ${url}`);
                noTOCs.push(url);
            }
            // TODO: correct resolution of static resources
            urls[url] = isResource
                ? nodeutil.fileExistsSync(path.join(docsRoot, "docs", url))
                : nodeutil.resolveMd(docsRoot, url);
            if (!isResource && urls[url])
                todo.push(url);
        }
    }

    function checkTOCEntry(entry: pxt.TOCMenuEntry) {
        if (entry.path && !/^https:\/\//.test(entry.path)) {
            pushUrl(entry.path, true);
            if (!urls[entry.path]) {
                pxt.log(`SUMMARY: broken link ${entry.path}`);
                broken++;
            }
        }
        // look for sub items
        if (entry.subitems)
            entry.subitems.forEach(checkTOCEntry);
    }

    const toc = pxt.docs.buildTOC(summaryMD);
    if (!toc) {
        pxt.log('unable to parse SUMMARY.md');
        return Promise.resolve();
    }
    toc.forEach(checkTOCEntry);

    // push entries from pxtarget
    const theme = pxt.appTarget.appTheme;
    if (theme) {
        if (theme.galleries)
            Object.keys(theme.galleries).forEach(gallery => todo.push(theme.galleries[gallery]));
        if (theme.sideDoc)
            todo.push(theme.sideDoc);
        if (theme.usbDocs)
            todo.push(theme.usbDocs);
    }

    while (todo.length) {
        checked++;
        const entrypath = todo.pop();
        pxt.debug(`checking ${entrypath}`)
        const md = (urls[entrypath] as string) || nodeutil.resolveMd(docsRoot, entrypath);
        // look for broken urls
        md.replace(/]\((\/[^)]+?)(\s+"[^"]+")?\)/g, (m) => {
            let url = /]\((\/[^)]+?)(\s+"[^"]+")?\)/.exec(m)[1];
            // remove hash
            url = url.replace(/#.*$/, '');
            pushUrl(url, false);
            if (!urls[url]) {
                pxt.log(`${entrypath}: broken link ${url}`);
                broken++;
            }
            return '';
        })

        // look for snippets
        getCodeSnippets(entrypath, md).forEach((snippet, snipIndex) => {
            snippets.push(snippet);
            const dir = path.join("built/docs/snippets", snippet.type);
            const fn = `${dir}/${entrypath.replace(/^\//, '').replace(/\//g, '-').replace(/\.\w+$/, '')}-${snipIndex}.${snippet.ext}`;
            nodeutil.mkdirP(dir);
            fs.writeFileSync(fn, snippet.code);
            snippet.file = fn;
        });
    }

    pxt.log(`checked ${checked} files: ${broken} broken links, ${noTOCs.length} not in SUMMARY, ${snippets.length} snippets`);
    fs.writeFileSync("built/noSUMMARY.md", noTOCs.sort().map(p => `${Array(p.split(/[\/\\]/g).length - 1).join('     ')}* [${pxt.Util.capitalize(p.split(/[\/\\]/g).reverse()[0].split('-').join(' '))}](${p})`).join('\n'), "utf8");

    let p = Promise.resolve();
    if (compileSnippets)
        p = p.then(() => testSnippetsAsync(snippets, re));
    return p.then(() => {
        if (broken > 0)
            U.userError(`${broken} broken links found in the docs`);
    })
}

function publishGistCoreAsync(forceNewGist: boolean = false): Promise<void> {
    const token = passwordGet(GITHUB_KEY);
    if (!token) {
        fatal("GitHub token not found, please use 'pxt login' to login with your GitHub account to push gists.");
        return Promise.resolve();
    }
    return mainPkg.loadAsync()
        .then(() => {
            const pxtConfig = U.clone(mainPkg.config);
            if (pxtConfig.gistId && !token && !forceNewGist) {
                console.warn("You are trying to update an existing project but no GitHub token was provided, publishing a new anonymous project instead.")
                forceNewGist = true;
            }
            const gistId = pxtConfig.gistId;
            const files: string[] = mainPkg.getFiles()
            const filesMap: Map<{ content: string; }> = {};

            files.forEach((fn) => {
                let fileContent = fs.readFileSync(fn, "utf8");
                if (fileContent) {
                    filesMap[fn] = {
                        "content": fileContent
                    }
                } else {
                    // Cannot publish empty files, go through and remove empty file references from pxt.json
                    if (pxtConfig.files && pxtConfig.files.indexOf(fn) > -1) {
                        pxtConfig.files.splice(pxtConfig.files.indexOf(fn), 1);
                    } else if (pxtConfig.testFiles && pxtConfig.testFiles.indexOf(fn) > -1) {
                        pxtConfig.testFiles.splice(pxtConfig.testFiles.indexOf(fn), 1);
                    }
                }
            })
            // Strip gist fields from config
            delete pxtConfig.gistId;
            // Add pxt.json
            filesMap['pxt.json'] = {
                "content": JSON.stringify(pxtConfig, null, 4)
            }
            pxt.log("Uploading....")
            return pxt.github.publishGistAsync(token, forceNewGist, filesMap, pxtConfig.name, gistId)
        })
        .then((published_id) => {
            pxt.log(`Success, view your gist at`);
            pxt.log(``)
            pxt.log(`    https://gist.github.com/${published_id}`);
            pxt.log(``)
            pxt.log(`To share your project, go to ${pxt.appTarget.appTheme.embedUrl}#pub:gh/gists/${published_id}`)
            if (!token) pxt.log(`Hint: Use "pxt login" with a GitHub token to publish gists under your GitHub account`);

            // Save gist id to pxt.json
            if (token) mainPkg.config.gistId = published_id;
            mainPkg.saveConfig();
        })
        .catch((e) => {
            if (e == '404') {
                console.error("Unable to access the existing project. --new to publish a new gist.")
            } else {
                console.error(e);
            }
        });
}

export function publishGistAsync(parsed: commandParser.ParsedCommand) {
    return publishGistCoreAsync(!!parsed.flags["new"]);
}

export interface SnippetInfo {
    type: string;
    code: string;
    ignore: boolean;
    index: number;
}

export function getSnippets(source: string): SnippetInfo[] {
    let snippets: SnippetInfo[] = []
    let re = /^`{3}([\S]+)?\s*\n([\s\S]+?)\n`{3}\s*?$/gm;
    let index = 0
    source.replace(re, (match, type, code) => {
        snippets.push({
            type: type ? type.replace(/-ignore$/i, "") : "pre",
            code: code,
            ignore: type ? /-ignore/g.test(type) : false,
            index: index
        })
        index++
        return ''
    })
    return snippets
}

export interface CodeSnippet {
    name: string;
    code: string;
    type: string;
    ext: string;
    packages: pxt.Map<string>;
    file?: string;
}

export function getCodeSnippets(fileName: string, md: string): CodeSnippet[] {
    const supported: pxt.Map<string> = {
        "blocks": "ts",
        "block": "ts",
        "typescript": "ts",
        "sig": "ts",
        "namespaces": "ts",
        "cards": "ts",
        "shuffle": "ts",
        "sim": "ts",
        "codecard": "json"
    }
    const snippets = getSnippets(md);
    const codeSnippets = snippets.filter(snip => !snip.ignore && !!supported[snip.type]);
    const pkgs: pxt.Map<string> = {
        "blocksprj": "*"
    }
    snippets.filter(snip => snip.type == "package")
        .map(snip => snip.code.split('\n'))
        .forEach(lines => lines
            .map(l => l.replace(/\s*$/, ''))
            .filter(line => !!line)
            .forEach(line => {
                pkgs[line] = "*";
            })
        );

    const pkgName = fileName.replace(/\\/g, '-').replace(/.md$/i, '');
    return codeSnippets.map((snip, i) => {
        return {
            name: `${pkgName}-${i}`,
            code: snip.code,
            type: snip.type,
            ext: supported[snip.type],
            packages: pkgs
        };
    })
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

function extractLocStringsAsync(output: string, dirs: string[]): Promise<void> {
    let prereqs: string[] = [];
    dirs.forEach(dir => prereqs = prereqs.concat(nodeutil.allFiles(dir, 20)));

    let errCnt = 0;
    let translationStrings: pxt.Map<string> = {}

    function processLf(filename: string) {
        if (!/\.(ts|tsx|html)$/.test(filename)) return
        if (/\.d\.ts$/.test(filename)) return

        pxt.debug(`extracting strings from${filename}`);
        fs.readFileSync(filename, "utf8").split('\n').forEach((line: string, idx: number) => {
            function err(msg: string) {
                console.log("%s(%d): %s", filename, idx, msg);
                errCnt++;
            }

            while (true) {
                let newLine = line.replace(/\blf(_va)?\s*\(\s*(.*)/, (all, a, args) => {
                    let m = /^("([^"]|(\\"))+")\s*[\),]/.exec(args)
                    if (m) {
                        try {
                            let str = JSON.parse(m[1])
                            translationStrings[str] = str;
                        } catch (e) {
                            err("cannot JSON-parse " + m[1])
                        }
                    } else {
                        if (!/util\.ts$/.test(filename))
                            err("invalid format of lf() argument: " + args)
                    }
                    return "BLAH " + args
                })
                if (newLine == line) return;
                line = newLine
            }
        })
    }

    let fileCnt = 0;
    prereqs.forEach(pth => {
        fileCnt++;
        processLf(pth);
    });

    let tr = Object.keys(translationStrings)
    tr.sort()
    let strings: pxt.Map<string> = {};
    tr.forEach(function (k) { strings[k] = k; });

    nodeutil.mkdirP('built');
    fs.writeFileSync(`built/${output}.json`, JSON.stringify(strings, null, 2));

    pxt.log("log strings: " + fileCnt + " files; " + tr.length + " strings -> " + output + ".json");
    if (errCnt > 0)
        pxt.log(`${errCnt} errors`);
    return Promise.resolve();
}

function initCommands() {
    // Top level commands
    simpleCmd("help", "display this message or info about a command", pc => {
        p.printHelp(pc.arguments, console.log)
        return Promise.resolve();
    }, "[all|command]");

    p.defineCommand({
        name: "deploy",
        help: "build and deploy current package",
        flags: {
            "serial": { description: "start serial monitor after deployment" }
        },
        onlineHelp: true
    }, deployAsync)
    simpleCmd("run", "build and run current package in the simulator", runAsync);
    advancedCommand("runfloat", "build and run current package in the simulator, forcing floating point mode", runFloatAsync);
    simpleCmd("update", "update pxt-core reference and install updated version", updateAsync, undefined, true);
    simpleCmd("install", "install new packages, or all package", installAsync, "[package1] [package2] ...");
    simpleCmd("add", "add a feature (.asm, C++ etc) to package", addAsync, "<arguments>");
    simpleCmd("serial", "listen and print serial commands to console", serialAsync);

    p.defineCommand({
        name: "login",
        help: "stores the PXT, GitHub or Crowdin access token",
        onlineHelp: true,
        argString: "<service> <token>",
        numArgs: 2
    }, loginAsync);

    simpleCmd("logout", "clears access tokens", logoutAsync);

    p.defineCommand({
        name: "bump",
        help: "bump target or package version",
        onlineHelp: true,
        flags: {
            update: { description: "(package only) Updates pxt-core reference to the latest release" },
            upload: { description: "(package only) Upload after bumping" }
        }
    }, bumpAsync);

    p.defineCommand({
        name: "build",
        help: "builds current package",
        onlineHelp: true,
        flags: {
            cloud: { description: "Force build to happen in the cloud" },
            debug: { description: "Emit debug information with build" }
        }
    }, buildAsync);

    simpleCmd("clean", "removes built folders", cleanAsync);
    p.defineCommand({
        name: "staticpkg",
        help: "packages the target into static HTML pages",
        onlineHelp: true,
        flags: {
            "route": {
                description: "route appended to generated files",
                argument: "route",
                type: "string",
                aliases: ["r"]
            },
            "githubpages": {
                description: "Generate a web site compatiable with GitHub pages",
                aliases: ["ghpages", "gh"]
            },
            "output": {
                description: "Specifies the output folder for the generated files",
                argument: "output",
                aliases: ["o"]
            },
            "minify": {
                description: "minify all generated js files",
                aliases: ["m", "uglify"]
            }
        }
    }, staticpkgAsync);

    p.defineCommand({
        name: "extract",
        help: "extract sources from .hex file, folder of .hex files, stdin (-), or URL",
        argString: "<path>",
        flags: {
            code: { description: "generate vscode project files" },
            out: {
                description: "directory to extract the project into",
                argument: "DIRNAME"
            }
        }
    }, extractAsync);

    p.defineCommand({
        name: "serve",
        help: "start web server for your local target",
        flags: {
            browser: {
                description: "set the browser to launch on web server start",
                argument: "name",
                possibleValues: ["chrome", "ie", "firefox", "safari"]
            },
            noBrowser: {
                description: "start the server without launching a browser",
                aliases: ["no-browser"]
            },
            noSerial: {
                description: "do not monitor serial devices",
                aliases: ["no-serial", "nos"]
            },
            sourceMaps: {
                description: "include source maps when building ts files",
                aliases: ["include-source-maps"]
            },
            pkg: { description: "serve packaged" },
            cloud: { description: "forces build to happen in the cloud" },
            just: { description: "just serve without building" },
            hostname: {
                description: "hostname to run serve, default localhost",
                aliases: ["h"],
                type: "string",
                argument: "hostname"
            },
            port: {
                description: "port to bind server, default 3232",
                aliases: ["p"],
                type: "number",
                argument: "port"
            },
            wsport: {
                description: "port to bind websocket server, default 3233",
                aliases: ["w"],
                type: "number",
                argument: "wsport"
            },
            electron: { description: "used to indicate that the server is being started in the context of an electron app" }
        }
    }, serveAsync);

    p.defineCommand({
        name: "gist",
        help: "publish current package to a gist",
        flags: {
            new: { description: "force the creation of a new gist" },
        }
    }, publishGistAsync)

    p.defineCommand({
        name: "electron",
        help: "SUBCOMMANDS: 'init': prepare target for running inside Electron app; 'run': runs current target inside Electron app; 'package': generates a packaged Electron app for current target",
        onlineHelp: true,
        flags: {
            appsrc: {
                description: "path to the root of the PXT Electron app in the pxt repo",
                aliases: ["a"],
                type: "string",
                argument: "appsrc"
            },
            installer: {
                description: "('package' only) Also build the installer / zip redistributable for the built app",
                aliases: ["i"]
            },
            just: {
                description: "During 'run': skips TS compilation of app; During 'package': skips npm install and rebuilding native modules",
                aliases: ["j"]
            },
            product: {
                description: "path to a product.json file to use instead of the target's default one",
                aliases: ["p"],
                type: "string",
                argument: "product"
            },
            release: {
                description: "('package' only) Instead of using the current local target, use the published target from NPM (value format: <Target's NPM package>[@<Package version>])",
                aliases: ["r"],
                type: "string",
                argument: "release"
            }
        },
        argString: "<subcommand>"
    }, electron.electronAsync);

    p.defineCommand({
        name: "init",
        help: "start new package (library) in current directory",
        flags: {
            useDefaults: { description: "Do not prompt for package information" },
        }
    }, initAsync)

    // Hidden commands
    advancedCommand("test", "run tests on current package", testAsync);
    advancedCommand("testassembler", "test the assemblers", testAssemblers);
    advancedCommand("testdir", "compile files in directory one by one", testDirAsync, "<dir>");
    advancedCommand("testconv", "test TD->TS converter", testConverterAsync, "<jsonurl>");
    advancedCommand("testpkgconflicts", "tests package conflict detection logic", testPkgConflictsAsync);
    advancedCommand("testdbg", "tests hardware debugger", dbgTestAsync);

    advancedCommand("buildtarget", "build pxtarget.json", buildTargetAsync);
    advancedCommand("uploadtrg", "upload target release", pc => uploadTargetAsync(pc.arguments[0]), "<label>");
    advancedCommand("uploadtt", "upload tagged release", uploadTaggedTargetAsync, "");
    advancedCommand("downloadtrgtranslations", "download translations from bundled projects", downloadTargetTranslationsAsync, "<package>");

    p.defineCommand({
        name: "checkdocs",
        onlineHelp: true,
        help: "check docs for broken links, typing errors, etc...",
        flags: {
            snippets: { description: "compile snippets" },
            re: {
                description: "regular expression that matches the snippets to test",
                argument: "regex"
            }
        }
    }, checkDocsAsync);

    advancedCommand("api", "do authenticated API call", pc => apiAsync(pc.arguments[0], pc.arguments[1]), "<path> [data]");
    advancedCommand("pokecloud", "same as 'api pokecloud {}'", () => apiAsync("pokecloud", "{}"));
    advancedCommand("travis", "upload release and npm package", travisAsync);
    advancedCommand("uploadfile", "upload file under <CDN>/files/PATH", uploadFileAsync, "<path>");
    advancedCommand("service", "simulate a query to web worker", serviceAsync, "<operation>");
    advancedCommand("time", "measure performance of the compiler on the current package", timeAsync);

    p.defineCommand({
        name: "buildcss",
        help: "build required css files",
        flags: {
            force: {
                description: "force re-compile of less files"
            }
        }
    }, buildSemanticUIAsync);

    advancedCommand("augmentdocs", "test markdown docs replacements", augmnetDocsAsync, "<temlate.md> <doc.md>");

    advancedCommand("crowdin", "upload, download files to/from crowdin", pc => execCrowdinAsync.apply(undefined, pc.arguments), "<cmd> <path> [output]")

    advancedCommand("hidlist", "list HID devices", hid.listAsync)
    advancedCommand("hidserial", "run HID serial forwarding", hid.serialAsync)
    advancedCommand("hiddmesg", "fetch DMESG buffer over HID and print it", hid.dmesgAsync)
    advancedCommand("hexdump", "dump UF2 or BIN file", hexdumpAsync, "<filename>")
    advancedCommand("hex2uf2", "convert .hex file to UF2", hex2uf2Async, "<filename>")
    advancedCommand("flashserial", "flash over SAM-BA", serial.flashSerialAsync, "<filename>")
    p.defineCommand({
        name: "pyconv",
        help: "convert from python",
        argString: "<package-directory> <support-directory>...",
        anyArgs: true,
        advanced: true,
    }, c => pyconv.convertAsync(c.arguments))

    advancedCommand("thirdpartynotices", "refresh third party notices", thirdPartyNoticesAsync);
    p.defineCommand({
        name: "cherrypick",
        aliases: ["cp"],
        help: "recursively cherrypicks and push branches",
        argString: "<commit>",
        advanced: true,
        flags: {
            "name": {
                description: "name of the branch",
                type: "string",
                argument: "name"
            }
        }
    }, cherryPickAsync);

    p.defineCommand({
        name: "decompile",
        help: "decompile typescript files",
        argString: "<file1.ts> <file2.ts> ...",
        advanced: true,
        flags: {
            dep: { description: "include specified path as a dependency to the project", type: "string", argument: "path" }
        }
    }, decompileAsync);

    p.defineCommand({
        name: "gdb",
        help: "attempt to start openocd and GDB",
        argString: "[GDB_ARGUMNETS...]",
        anyArgs: true,
        advanced: true
    }, gdb.startAsync);

    p.defineCommand({
        name: "pokerepo",
        help: "refresh repo, or generate a URL to do so",
        argString: "<repo>",
        flags: {
            u: { description: "" }
        },
        advanced: true
    }, pokeRepoAsync);

    p.defineCommand({
        name: "uploadtrgtranslations",
        help: "upload translations for target",
        flags: {
            docs: { description: "upload markdown docs folder as well" }
        },
        advanced: true
    }, uploadTargetTranslationsAsync);

    p.defineCommand({
        name: "format",
        help: " pretty-print TS files",
        argString: "<file1.ts> <file2.ts> ...",
        flags: {
            i: { description: "format files in-place" },
            t: { description: "test formatting" }
        },
        advanced: true
    }, formatAsync);

    p.defineCommand({
        name: "gendocs",
        help: "build current package and its docs",
        flags: {
            docs: { description: "produce docs files" },
            loc: { description: "produce localization files" },
            files: { description: "file name filter (regex)", type: "string", argument: "files" },
            create: { description: "only write new files" }
        },
        advanced: true
    }, gendocsAsync);

    function simpleCmd(name: string, help: string, callback: (c?: commandParser.ParsedCommand) => Promise<void>, argString?: string, onlineHelp?: boolean): void {
        p.defineCommand({ name, help, onlineHelp, argString }, callback);
    }

    function advancedCommand(name: string, help: string, callback: (c?: commandParser.ParsedCommand) => Promise<void>, argString?: string, onlineHelp = false) {
        p.defineCommand({ name, help, onlineHelp, argString, advanced: true }, callback);
    }
}

function handleCommandAsync(args: string[], preApply = () => Promise.resolve()) {
    return preApply().then(() => p.parseCommand(args))
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
        console.error(reason.stack)
        console.error("USER ERROR:", reason.message)
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

let electronHandlers: pxt.Map<server.ElectronHandler>;
// called from pxt npm package
export function mainCli(targetDir: string, args: string[] = process.argv.slice(2), handlers?: pxt.Map<server.ElectronHandler>): Promise<void> {
    process.on("unhandledRejection", errorHandler);
    process.on('uncaughtException', errorHandler);

    if (!targetDir) {
        console.error("Please upgrade your pxt CLI module.")
        console.error("   npm update -g pxt")
        process.exit(30)
        return Promise.resolve();
    }

    electronHandlers = handlers;
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

    pxt.HF2.enableLog()

    if (compileId != "none") {
        build.thisBuild = build.buildEngines[compileId]
        if (!build.thisBuild) U.userError("cannot find build engine: " + compileId)
    }

    if (process.env["PXT_DEBUG"]) {
        pxt.options.debug = true;
        pxt.debug = console.debug || console.log;
    }

    commonfiles = readJson(__dirname + "/pxt-common.json")

    initConfig();

    if (args[0] != "buildtarget") {
        initTargetCommands();
    }

    if (!pxt.commands.deployCoreAsync && build.thisBuild.deployAsync)
        pxt.commands.deployCoreAsync = build.thisBuild.deployAsync

    if (!args[0]) {
        if (pxt.commands.deployCoreAsync) {
            console.log("running 'pxt deploy' (run 'pxt help' for usage)")
            args = ["deploy"]
        } else {
            console.log("running 'pxt build' (run 'pxt help' for usage)")
            args = ["build"]
        }
    }

    return p.parseCommand(args)
        .then(() => {
            if (readlineCount)
                (process.stdin as any).unref();
        });
}

function initGlobals() {
    let g = global as any
    g.pxt = pxt;
    g.ts = ts;
    g.pxtc = pxtc;
}

initGlobals();
initCommands();

export function sendElectronMessage(message: server.ElectronMessage) {
    server.sendElectronMessage(message);
}

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
    mainCli(targetdir).done();
}
