/* eslint-disable @typescript-eslint/no-for-in-array */

/// <reference path="../built/pxtlib.d.ts"/>
/// <reference path="../built/pxtcompiler.d.ts"/>
/// <reference path="../built/pxtpy.d.ts"/>
/// <reference path="../built/pxtsim.d.ts"/>

(global as any).pxt = pxt;

import * as nodeutil from './nodeutil';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import { promisify } from "util";

import U = pxt.Util;
import Cloud = pxt.Cloud;
import Map = pxt.Map;

import * as server from './server';
import * as build from './buildengine';
import * as commandParser from './commandparser';
import * as hid from './hid';
import * as gdb from './gdb';
import * as clidbg from './clidbg';
import * as pyconv from './pyconv';
import * as gitfs from './gitfs';
import * as crowdin from './crowdin';
import * as youtube from './youtube';

const rimraf: (f: string, opts: any, cb: (err: Error, res: any) => void) => void = require('rimraf');

pxt.docs.requireDOMSanitizer = () => require("sanitize-html");

let forceCloudBuild = process.env["KS_FORCE_CLOUD"] !== "no";
let forceLocalBuild = !!process.env["PXT_FORCE_LOCAL"];
let forceBuild = false; // don't use cache

Error.stackTraceLimit = 100;

function parseHwVariant(parsed: commandParser.ParsedCommand) {
    let hwvariant = parsed && parsed.flags["hwvariant"] as string;
    if (hwvariant) {
        // map known variants
        const knowVariants: pxt.Map<string> = {
            "f4": "stm32f401",
            "f401": "stm32f401",
            "d5": "samd51",
            "d51": "samd51",
            "p0": "rpi",
            "pi0": "rpi",
            "pi": "rpi"
        }
        hwvariant = knowVariants[hwvariant.toLowerCase()] || hwvariant;
        if (!/^hw---/.test(hwvariant)) hwvariant = 'hw---' + hwvariant;
    }
    return hwvariant;
}

function parseBuildInfo(parsed?: commandParser.ParsedCommand) {
    const cloud = parsed && parsed.flags["cloudbuild"];
    const local = parsed && parsed.flags["localbuild"];
    const hwvariant = parseHwVariant(parsed);
    forceBuild = parsed && !!parsed.flags["force"];
    if (cloud && local)
        U.userError("cannot specify local-build and cloud-build together");

    if (cloud) {
        forceCloudBuild = true;
        forceLocalBuild = false;
    }
    if (local) {
        forceCloudBuild = false;
        forceLocalBuild = true;
    }

    if (hwvariant) {
        pxt.log(`setting hardware variant to ${hwvariant}`);
        pxt.setHwVariant(hwvariant)
    }
}

const p = new commandParser.CommandParser();

function initTargetCommands() {
    let cmdsjs = path.join(nodeutil.targetDir, 'built/cmds.js');
    if (fs.existsSync(cmdsjs)) {
        pxt.debug(`loading cli extensions...`)
        let cli = require.main.require(cmdsjs)
        if (cli.deployAsync) {
            pxt.commands.deployFallbackAsync = cli.deployAsync
        }
        if (cli.addCommands) {
            cli.addCommands(p)
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
    noSerial?: boolean;
}

interface TargetPackageInfo {
    options: pxtc.CompileOptions;
    api: pxtc.ApisInfo;
    sha: string;
}

let reportDiagnostic = reportDiagnosticSimply;
const targetJsPrefix = "var pxtTargetBundle = "

function reportDiagnostics(diagnostics: pxtc.KsDiagnostic[]): void {
    for (const diagnostic of diagnostics) {
        reportDiagnostic(diagnostic);
    }
}

function reportDiagnosticSimply(diagnostic: pxtc.KsDiagnostic): void {
    let output = pxtc.getDiagnosticString(diagnostic)
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
    nodeutil.writeFileSync(configPath(), JSON.stringify(globalConfig, null, 4) + "\n")
}

function initConfigAsync(): Promise<void> {
    let p = Promise.resolve();
    let atok: string = process.env["PXT_ACCESS_TOKEN"]
    if (fs.existsSync(configPath())) {
        let config = <UserConfig>readJson(configPath())
        globalConfig = config;
    }

    p.then(() => {
        if (atok) {
            let mm = /^(https?:.*)\?access_token=([\w\-\.]+)/.exec(atok)
            if (!mm) {
                console.error("Invalid accessToken format, expecting something like 'https://example.com/?access_token=0.abcd.XXXX'")
                return
            }
            Cloud.apiRoot = mm[1].replace(/\/$/, "").replace(/\/api$/, "") + "/api/"
            Cloud.accessToken = mm[2]
        }
    });
    return p;
}


function loadGithubToken() {
    if (!pxt.github.token)
        pxt.github.token = process.env["GITHUB_ACCESS_TOKEN"] || process.env["GITHUB_TOKEN"];
    pxt.github.db = new FileGithubDb(pxt.github.db);
}

/**
 * Caches github releases under pxt_modules/.githubcache/...
 */
class FileGithubDb implements pxt.github.IGithubDb {
    constructor(public readonly db: pxt.github.IGithubDb) {

    }

    private loadAsync<T>(repopath: string, tag: string, suffix: string,
        loader: (r: string, t: string) => Promise<T>): Promise<T> {
        // only cache releases
        if (!/^v\d+\.\d+\.\d+$/.test(tag))
            return loader(repopath, tag);

        const dir = path.join(`pxt_modules`, `.githubcache`, ...repopath.split(/\//g), tag);
        const fn = path.join(dir, suffix + ".json");
        // cache hit
        if (fs.existsSync(fn)) {
            const json = fs.readFileSync(fn, "utf8");
            const p = pxt.Util.jsonTryParse(json) as T;
            if (p) {
                pxt.debug(`cache hit ${fn}`)
                return Promise.resolve(p);
            }
        }

        // download and cache
        return loader(repopath, tag)
            .then(p => {
                if (p) {
                    pxt.debug(`cached ${fn}`)
                    nodeutil.mkdirP(dir);
                    fs.writeFileSync(fn, JSON.stringify(p), "utf8");
                }
                return p;
            })
    }

    latestVersionAsync(repopath: string, config: pxt.PackagesConfig): Promise<string> {
        return this.db.latestVersionAsync(repopath, config)
    }

    loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig> {
        return this.loadAsync(repopath, tag, "pxt", (r, t) => this.db.loadConfigAsync(r, t));
    }

    loadPackageAsync(repopath: string, tag: string): Promise<pxt.github.CachedPackage> {
        return this.loadAsync(repopath, tag, "pkg", (r, t) => this.db.loadPackageAsync(r, t));
    }
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

export function pokeRepoAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    const repo = parsed.args[0];

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
    const path = parsed.args[0];
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
        .concat(onlyExts(nodeutil.allFiles(pref + "built/web", { maxDepth: 1 }), [".js", ".css"]))
        .concat(nodeutil.allFiles(pref + "built/web/fonts", { maxDepth: 1 }))
        .concat(nodeutil.allFiles(pref + "built/web/vs", { maxDepth: 4 }))
        .concat(nodeutil.allFiles(pref + "built/web/skillmap", { maxDepth: 4 }))
        .concat(nodeutil.allFiles(pref + "built/web/authcode", { maxDepth: 4 }))
        .concat(nodeutil.allFiles(pref + "built/web/multiplayer", { maxDepth: 4 }))
        .concat(nodeutil.allFiles(pref + "built/web/kiosk", { maxDepth: 4 }))
}

function semverCmp(a: string, b: string) {
    let parse = (s: string) => {
        let v = s.split(/\./).map(parseInt)
        return v[0] * 100000000 + v[1] * 10000 + v[2]
    }
    return parse(a) - parse(b)
}

function checkIfTaggedCommitAsync() {
    let currentCommit: string;

    return nodeutil.gitInfoAsync(["rev-parse", "HEAD"])
        .then(info => {
            currentCommit = info.trim();
            return nodeutil.gitInfoAsync(["ls-remote", "--tags"], undefined, true)
        })
        .then(info => {
            const tagCommits = info.split("\n")
                .map(line => {
                    const match = /^([a-fA-F0-9]+)\s+refs\/tags\/v\d+\.\d+\.\d+\^\{\}$/.exec(line);
                    return match && match[1]
                });

            return tagCommits.some(t => t === currentCommit)
        });
}

let readJson = nodeutil.readJson;

function ciAsync() {
    forceCloudBuild = true;
    const buildInfo = ciBuildInfo();
    pxt.log(`ci build using ${buildInfo.ci}`);
    if (!buildInfo.tag)
        buildInfo.tag = "";
    if (!buildInfo.branch)
        buildInfo.branch = "local"

    const { tag, branch, pullRequest } = buildInfo
    const atok = process.env.NPM_ACCESS_TOKEN
    const npmPublish = /^v\d+\.\d+\.\d+$/.exec(tag) && atok;

    if (npmPublish) {
        let npmrc = path.join(process.env.HOME, ".npmrc")
        pxt.log(`setting up ${npmrc}`)
        let cfg = "//registry.npmjs.org/:_authToken=" + atok + "\n"
        fs.writeFileSync(npmrc, cfg)
    }

    process.env["PXT_ENV"] = "production";

    const latest = branch == "master" ? "latest" : "git-" + branch
    // upload locs on build on master
    const masterOrReleaseBranchRx = /^(master|v\d+\.\d+\.\d+)$/;
    const apiStringBranchRx = pxt.appTarget.uploadApiStringsBranchRx
        ? new RegExp(pxt.appTarget.uploadApiStringsBranchRx)
        : masterOrReleaseBranchRx;
    const uploadDocs = !pullRequest
        && !!pxt.appTarget.uploadDocs
        && masterOrReleaseBranchRx.test(branch);
    const uploadApiStrings = !pullRequest
        && (!!pxt.appTarget.uploadDocs || pxt.appTarget.uploadApiStringsBranchRx)
        && apiStringBranchRx.test(branch);

    pxt.log(`tag: ${tag}`);
    pxt.log(`branch: ${branch}`);
    pxt.log(`latest: ${latest}`);
    pxt.log(`pull request: ${pullRequest}`);
    pxt.log(`upload api strings: ${uploadApiStrings}`);
    pxt.log(`upload docs: ${uploadDocs}`);

    lintJSONInDirectory(path.resolve("."));
    lintJSONInDirectory(path.resolve("docs"));

    function npmPublishAsync() {
        if (!npmPublish) return Promise.resolve();
        return nodeutil.runNpmAsync("publish");
    }

    let pkg = readJson("package.json")
    if (pkg["name"] == "pxt-core") {
        pxt.log("pxt-core build");
        return checkIfTaggedCommitAsync()
            .then(isTaggedCommit => {
                pxt.log(`is tagged commit: ${isTaggedCommit}`);
                let p = npmPublishAsync();
                if (branch === "master" && isTaggedCommit) {
                    if (uploadDocs)
                        p = p
                            .then(() => buildWebStringsAsync())
                            .then(() => crowdin.execCrowdinAsync("upload", "built/webstrings.json"))
                            .then(() => crowdin.execCrowdinAsync("upload", "built/skillmap-strings.json"))
                            .then(() => crowdin.execCrowdinAsync("upload", "built/authcode-strings.json"))
                            .then(() => crowdin.execCrowdinAsync("upload", "built/multiplayer-strings.json"))
                            .then(() => crowdin.execCrowdinAsync("upload", "built/kiosk-strings.json"));
                    if (uploadApiStrings)
                        p = p.then(() => crowdin.execCrowdinAsync("upload", "built/strings.json"))
                    if (uploadDocs || uploadApiStrings)
                        p = p.then(() => crowdin.internalUploadTargetTranslationsAsync(uploadApiStrings, uploadDocs));
                }
                return p;
            });
    } else {
        pxt.log("target build");
        return internalBuildTargetAsync()
            .then(() => internalCheckDocsAsync(true))
            .then(() => blockTestsAsync())
            .then(() => npmPublishAsync())
            .then(() => {
                if (!process.env["PXT_ACCESS_TOKEN"]) {
                    // pull request, don't try to upload target
                    pxt.log('no token, skipping upload')
                    return Promise.resolve();
                }
                const trg = readLocalPxTarget();
                const label = `${trg.id}/${tag || latest}`;
                pxt.log(`uploading target with label ${label}...`);
                return uploadTargetAsync(label);
            })
            .then(() => {
                pxt.log("target uploaded");
                if (uploadDocs || uploadApiStrings) {
                    return crowdin.internalUploadTargetTranslationsAsync(uploadApiStrings, uploadDocs)
                        .then(() => pxt.log("translations uploaded"));
                } else {
                    pxt.log("skipping translations upload");
                    return Promise.resolve();
                }
            });
    }
}

function lintJSONInDirectory(dir: string) {
    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        if (file.endsWith(".json")) {
            const contents = fs.readFileSync(fullPath, "utf8");
            try {
                JSON.parse(contents)
            }
            catch (e) {
                console.log("Could not parse " + fullPath)
                process.exit(1);
            }
        }
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
                nodeutil.writeFileSync("package.json", nodeutil.stringify(pkg) + "\n")
                commitMsg += `${commitMsg ? ", " : ""}bump ${knownPackage} to ${newVer}`;
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

function tagReleaseAsync(parsed: commandParser.ParsedCommand) {
    const tag = parsed.args[0] as string;
    const version = parsed.args[1] as string;
    const npm = !!parsed.flags["npm"];

    // check that ...-ref.json exists for that tag
    const fn = path.join('docs', tag + "-ref.json");
    pxt.log(`checking ${fn}`)
    if (!fn)
        U.userError(`file ${fn} does not exist`);
    const v = pxt.semver.normalize(version);
    const npmPkg = `pxt-${pxt.appTarget.id}`;
    if (!pxt.appTarget.appTheme.githubUrl)
        U.userError('pxtarget theme missing "githubUrl" entry');
    // check that tag exists in github
    pxt.log(`checking github ${pxt.appTarget.appTheme.githubUrl} tag v${v}`);
    return U.requestAsync({
        url: pxt.appTarget.appTheme.githubUrl.replace(/\/$/, '') + "/releases/tag/v" + v,
        method: "GET"
    })
        // check that release exists in npm
        .then(() => {
            if (!npm) return Promise.resolve();
            pxt.log(`checking npm ${npmPkg} release`)
            return nodeutil.npmRegistryAsync(npmPkg)
                .then(registry => {
                    // verify that npm version exists
                    if (!registry.versions[v])
                        U.userError(`cannot find npm package ${npmPkg}@${v}`);
                    const npmTag = tag == "index" ? "latest" : tag;
                    return nodeutil.runNpmAsync(`dist-tag`, `add`, `${npmPkg}@v${v}`, npmTag);
                })
        })
        // all good update ref file
        .then(() => {
            // update index file
            nodeutil.writeFileSync(fn, JSON.stringify({
                "appref": "v" + v
            }, null, 4))
            // TODO commit changes
            console.log(`please commit ${fn} changes`);
        })
}

function bumpAsync(parsed?: commandParser.ParsedCommand) {
    const bumpPxt = parsed && parsed.flags["update"];
    const upload = parsed && parsed.flags["upload"];
    if (fs.existsSync(pxt.CONFIG_NAME)) {
        if (upload) throw U.userError("upload only supported on targets");

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
    if (!pxt.github.token) {
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
            internalBuildTargetAsync()
                .then(() => internalCheckDocsAsync(true))
                .then(() => info))
        .then(info => {
            const repoSlug = "microsoft/pxt-" + pxt.appTarget.id
            setCiBuildInfo(info[0], info[1], info[2], repoSlug)
            process.env['PXT_RELEASE_REPO'] = "https://git:" + pxt.github.token + "@github.com/" + repoSlug + "-built"
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
    const info = ciBuildInfo()
    if (!info.tag)
        ver += "-" + (info.commit ? info.commit.slice(0, 6) : "local")
    return ver
}

function targetFileList() {
    let lst = onlyExts(nodeutil.allFiles("built"), [".js", ".css", ".json", ".webmanifest"])
        .concat(nodeutil.allFiles(path.join(simDir(), "public")));
    if (simDir() != "sim")
        lst = lst.concat(nodeutil.allFiles(path.join("sim", "public"), { maxDepth: 5, allowMissing: true }))
    pxt.debug(`target files (on disk): ${lst.join('\r\n    ')}`)
    return lst;
}

function uploadTargetAsync(label: string) {
    return uploadCoreAsync({
        label,
        fileList: pxtFileList("node_modules/pxt-core/").concat(targetFileList()),
        pkgversion: pkgVersion(),
        fileContent: {}
    })
}

export function uploadTargetReleaseAsync(parsed?: commandParser.ParsedCommand) {
    parseBuildInfo(parsed);
    const label = parsed.args[0];
    const rebundle = !!parsed.flags["rebundle"];
    return (rebundle ? rebundleAsync() : internalBuildTargetAsync())
        .then(() => {
            return uploadTargetAsync(label);
        });
}

export function uploadTargetRefsAsync(repoPath: string) {
    if (repoPath) process.chdir(repoPath);
    return nodeutil.needsGitCleanAsync()
        .then(() => Promise.all([
            nodeutil.gitInfoAsync(["rev-parse", "HEAD"]),
            nodeutil.gitInfoAsync(["config", "--get", "remote.origin.url"])
        ]))
        .then(info => {
            return gitfs.uploadRefs(info[0], info[1])
                .then(() => {
                    return Promise.resolve();
                });
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
    noAppCache?: boolean;
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
            return U.promiseMapAll(missingReqs,
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
            const info = ciBuildInfo()
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
        console.log(`label "${label}" is not a version; skipping release upload`);
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
    const info = ciBuildInfo()
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
                fs.writeFileSync(fpath, u.content, { encoding: u.encoding })
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

function uploadedArtFileCdnUrl(fn: string): string {
    if (!fn || /^(https?|data):/.test(fn)) return fn; // nothing to do

    fn = fn.replace(/^\.?\/*/, "/")
    const cdnBlobUrl = "@cdnUrl@/blob/" + gitHash(fs.readFileSync("docs" + fn)) + "" + fn;
    return cdnBlobUrl;
}

function gitHash(buf: Buffer) {
    let hash = crypto.createHash("sha1")
    hash.update(Buffer.from("blob " + buf.length + "\u0000", "utf8"))
    hash.update(buf)
    return hash.digest("hex")
}

function uploadCoreAsync(opts: UploadOptions) {
    const targetConfig = readLocalPxTarget();
    const defaultLocale = targetConfig.appTheme.defaultLocale;
    const hexCache = path.join("built", "hexcache");
    let hexFiles: string[] = [];

    if (fs.existsSync(hexCache)) {
        hexFiles = fs.readdirSync(hexCache)
            .filter(f => /\.hex$/.test(f))
            .filter(f => fs.readFileSync(path.join(hexCache, f), { encoding: "utf8" }) != "SKIP")
            .map((f) => `@cdnUrl@/compile/${f}`);
        pxt.log(`hex cache:\n\t${hexFiles.join('\n\t')}`)
    }

    const targetUsedImages: pxt.Map<string> = {};
    const cdnCachedAppTheme = replaceStaticImagesInJsonBlob(readLocalPxTarget(), fn => {
        const fp = path.join("docs", fn);
        if (!targetUsedImages[fn] && !opts.fileList.includes(fp)) {
            opts.fileList.push(fp);
        }

        targetUsedImages[fn] = uploadedArtFileCdnUrl(fn);

        return targetUsedImages[fn];
    }).appTheme;

    const targetImagePaths = Object.keys(targetUsedImages);
    const targetImagesHashed = Object.values(targetUsedImages);

    let targetEditorJs = "";
    if (pxt.appTarget.appTheme?.extendEditor)
        targetEditorJs = "@commitCdnUrl@editor.js";
    let targetFieldEditorsJs = "";
    if (pxt.appTarget.appTheme?.extendFieldEditors)
        targetFieldEditorsJs = "@commitCdnUrl@fieldeditors.js";

    let replacements: Map<string> = {
        "/sim/simulator.html": "@simUrl@",
        "/sim/siminstructions.html": "@partsUrl@",
        "/sim/sim.webmanifest": "@relprefix@webmanifest",
        "/embed.js": "@targetUrl@@relprefix@embed",
        "/cdn/": "@commitCdnUrl@",
        "/doccdn/": "@commitCdnUrl@",
        "/sim/": "@commitCdnUrl@",
        "/blb/": "@blobCdnUrl@",
        "/trgblb/": "@targetBlobUrl@",
        "@timestamp@": "",
        "data-manifest=\"\"": "@manifest@",
        "var pxtConfig = null": "var pxtConfig = @cfg@",
        "var pxtConfig=null": "var pxtConfig = @cfg@",
        "@defaultLocaleStrings@": defaultLocale ? "@commitCdnUrl@" + "locales/" + defaultLocale + "/strings.json" : "",
        "@cachedHexFiles@": hexFiles.length ? hexFiles.join("\n") : "",
        "@cachedHexFilesEncoded@": encodeURLs(hexFiles),
        "@targetEditorJs@": targetEditorJs,
        "@targetFieldEditorsJs@": targetFieldEditorsJs,
        "@targetImages@": targetImagesHashed.length ? targetImagesHashed.join('\n') : '',
        "@targetImagesEncoded@": targetImagesHashed.length ? encodeURLs(targetImagesHashed) : ""
    }

    if (opts.localDir) {
        let cfg: pxt.WebConfig = {
            "relprefix": opts.localDir,
            "verprefix": "",
            "workerjs": opts.localDir + "worker.js",
            "monacoworkerjs": opts.localDir + "monacoworker.js",
            "gifworkerjs": opts.localDir + "gifjs/gif.worker.js",
            "serviceworkerjs": opts.localDir + "serviceworker.js",
            "typeScriptWorkerJs": opts.localDir + "tsworker.js",
            "pxtVersion": pxtVersion(),
            "pxtRelId": "localDirRelId",
            "pxtCdnUrl": opts.localDir,
            "commitCdnUrl": opts.localDir,
            "blobCdnUrl": opts.localDir,
            "cdnUrl": opts.localDir,
            "targetVersion": opts.pkgversion,
            "targetRelId": "",
            "targetUrl": "",
            "targetId": opts.target,
            "simUrl": opts.localDir + "simulator.html",
            "simserviceworkerUrl": opts.localDir + "simulatorserviceworker.js",
            "simworkerconfigUrl": opts.localDir + "workerConfig.js",
            "partsUrl": opts.localDir + "siminstructions.html",
            "runUrl": opts.localDir + "run.html",
            "docsUrl": opts.localDir + "docs.html",
            "multiUrl": opts.localDir + "multi.html",
            "asseteditorUrl": opts.localDir + "asseteditor.html",
            "skillmapUrl": opts.localDir + "skillmap.html",
            "authcodeUrl": opts.localDir + "authcode.html",
            "multiplayerUrl": opts.localDir + "multiplayer.html",
            "kioskUrl": opts.localDir + "kiosk.html",
            "isStatic": true,
        }
        const targetImageLocalPaths = targetImagePaths.map(k =>
            `${opts.localDir}${path.join('./docs', k)}`);

        replacements = {
            "/embed.js": opts.localDir + "embed.js",
            "/cdn/": opts.localDir,
            "/doccdn/": opts.localDir,
            "/sim/": opts.localDir,
            "/blb/": opts.localDir,
            "/trgblb/": opts.localDir,
            "@monacoworkerjs@": `${opts.localDir}monacoworker.js`,
            "@gifworkerjs@": `${opts.localDir}gifjs/gif.worker.js`,
            "@workerjs@": `${opts.localDir}worker.js`,
            "@serviceworkerjs@": `${opts.localDir}serviceworker.js`,
            "@timestamp@": `# ver ${new Date().toString()}`,
            "var pxtConfig = null": "var pxtConfig = " + JSON.stringify(cfg, null, 4),
            "@defaultLocaleStrings@": "",
            "@cachedHexFiles@": "",
            "@cachedHexFilesEncoded@": "",
            "@targetEditorJs@": targetEditorJs ? `${opts.localDir}editor.js` : "",
            "@targetFieldEditorsJs@": targetFieldEditorsJs ? `${opts.localDir}fieldeditors.js` : "",
            "@targetImages@": targetImagePaths.length ? targetImageLocalPaths.join('\n') : '',
            "@targetImagesEncoded@": targetImagePaths.length ? encodeURLs(targetImageLocalPaths) : ''
        }
        if (!opts.noAppCache) {
            replacements["data-manifest=\"\""] = `manifest="${opts.localDir}release.manifest"`;
        }
    }

    const replFiles = [
        "index.html",
        "embed.js",
        "run.html",
        "docs.html",
        "siminstructions.html",
        "codeembed.html",
        "release.manifest",
        "worker.js",
        "serviceworker.js",
        "simulatorserviceworker.js",
        "monacoworker.js",
        "simulator.html",
        "sim.manifest",
        "sim.webmanifest",
        "workerConfig.js",
        "multi.html",
        "asseteditor.html",
        "skillmap.html",
        "authcode.html",
        "multiplayer.html",
        "kiosk.html",
    ]

    // expandHtml is manually called on these files before upload
    // runs <!-- @include --> substitutions, fills in locale, etc
    const expandFiles = [
        "index.html",
        "skillmap.html",
        "authcode.html",
        "multiplayer.html",
        "kiosk.html",
    ]

    nodeutil.mkdirP("built/uploadrepl")

    function encodeURLs(urls: string[]) {
        return urls.map(url => encodeURIComponent(url)).join(";")
    }

    const uplReqs: Map<BlobReq> = {}
    const uglify = opts.minify ? require("uglify-js") : undefined;

    const uploadFileAsync = async (p: string) => {
        let rdata: Buffer = null
        if (opts.fileContent) {
            let s = U.lookup(opts.fileContent, p)
            if (s != null)
                rdata = Buffer.from(s, "utf8");
        }
        if (!rdata) {
            if (!fs.existsSync(p))
                return undefined;
            rdata = await readFileAsync(p)
        }


        let fileName = uploadFileName(p)
        let mime = U.getMime(p)
        const minified = opts.minify && mime == "application/javascript" && fileName !== "target.js";

        pxt.log(`    ${p} -> ${fileName} (${mime})` + (minified ? ' minified' : ""));

        let isText = /^(text\/.*|application\/.*(javascript|json))$/.test(mime)
        let content = ""
        let data = rdata;
        if (isText) {
            content = data.toString("utf8")
            if (expandFiles.indexOf(fileName) >= 0) {
                if (!opts.localDir) {
                    let m = pxt.appTarget.appTheme as Map<string>
                    for (let k of Object.keys(m)) {
                        if (/CDN$/.test(k))
                            m[k.slice(0, k.length - 3)] = m[k];
                    }
                }
                content = server.expandHtml(content, undefined, cdnCachedAppTheme);
            }

            if (/^sim/.test(fileName) || /^workerConfig/.test(fileName)) {
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
                    data = Buffer.from(content, "utf8")
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
                            e.path = opts.localDir + "docs" + e.path;
                        }
                    trg.appTheme.homeUrl = opts.localDir
                    // patch icons in bundled packages
                    Object.keys(trg.bundledpkgs).forEach(pkgid => {
                        const res = trg.bundledpkgs[pkgid];
                        // path config before storing
                        const config = JSON.parse(res[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                        if (/^\//.test(config.icon)) config.icon = opts.localDir + "docs" + config.icon;
                        res[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(config);
                    })
                    data = Buffer.from((isJs ? targetJsPrefix : '') + nodeutil.stringify(trg), "utf8")
                } else {
                    if (trg.simulator?.boardDefinition?.visual) {
                        let boardDef = trg.simulator.boardDefinition.visual as pxsim.BoardImageDefinition;
                        if (boardDef.image) {
                            boardDef.image = uploadedArtFileCdnUrl(boardDef.image);
                            if (boardDef.outlineImage) boardDef.outlineImage = uploadedArtFileCdnUrl(boardDef.outlineImage);
                        }
                    }
                    // patch icons in bundled packages
                    Object.keys(trg.bundledpkgs).forEach(pkgid => {
                        const res = trg.bundledpkgs[pkgid];
                        // patch config before storing
                        const config = JSON.parse(res[pxt.CONFIG_NAME]) as pxt.PackageConfig;
                        if (config.icon) config.icon = uploadedArtFileCdnUrl(config.icon);
                        res[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(config);
                    })
                    content = nodeutil.stringify(trg);
                    if (isJs)
                        content = targetJsPrefix + content

                    // save it for developer inspection
                    fs.writeFileSync("built/uploadrepl/" + fileName, content)
                }
            }
        } else {
            content = data.toString("base64")
        }

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

        let buf = Buffer.from(req.content, req.encoding)
        req.size = buf.length
        req.hash = gitHash(buf)
        uplReqs[fileName] = req
    }

    // only keep the last version of each uploadFileName()
    opts.fileList = U.values(U.toDictionary(opts.fileList, uploadFileName))

    // check size
    const maxSize = checkFileSize(opts.fileList);
    if (maxSize > 30000000) // 30Mb max
        U.userError(`file too big for upload`);
    pxt.log('');

    if (opts.localDir)
        return U.promisePoolAsync(15, opts.fileList, uploadFileAsync)
            .then(() => {
                pxt.log("Release files written to " + path.join(opts.builtPackaged, opts.localDir))
            })

    return U.promisePoolAsync(15, opts.fileList, uploadFileAsync)
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
    const pkg = readJson("package.json");
    const cfg: pxt.TargetBundle = readJson("pxtarget.json");
    cfg.versions = {
        target: pkg["version"],
        pxt: (pxt.appTarget.versions && pxt.appTarget.versions.pxt) || pkg["dependencies"]["pxt-core"]
    };

    return cfg
}

function forEachBundledPkgAsync(f: (pkg: pxt.MainPackage, dirname: string) => Promise<void>, includeProjects: boolean = false) {
    let prev = process.cwd()
    let folders = pxt.appTarget.bundleddirs;
    if (includeProjects) {
        let projects = nodeutil.allFiles("libs", { maxDepth: 1, includeDirs: true }).filter(f => /prj$/.test(f));
        folders = folders.concat(projects);
    }

    return U.promiseMapAllSeries(folders, (dirname) => {
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

                pxt.debug(`file overrides: ${Object.keys(host.fileOverrides).join(', ')}`)
            } else {
                pxt.debug(`override folder ${overridePath} not present`);
            }
        }

        process.chdir(pkgPath);
        mainPkg = new pxt.MainPackage(host);
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
            nodeutil.writeFileSync("gh-pages/index.html", "Under construction.")
            nodeutil.writeFileSync("gh-pages/.gitattributes",
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

async function maxMTimeAsync(dirs: string[], maxDepth: number) {
    let max = 0
    await U.promiseMapAll(dirs, async dir => {
        const files = nodeutil.allFiles(dir, { allowMissing: true, maxDepth });
        await U.promiseMapAll(files, async file => {
            const st = await statAsync(file);
            max = Math.max(st.mtime.getTime(), max);
        });
    });
    return max;
}

export interface BuildTargetOptions {
    localDir?: boolean;
    packaged?: boolean;
    skipCore?: boolean;
    quick?: boolean;
    rebundle?: boolean;
}

export function buildTargetAsync(parsed?: commandParser.ParsedCommand): Promise<void> {
    parseBuildInfo(parsed);
    const opts: BuildTargetOptions = {};
    if (parsed && parsed.flags["skipCore"])
        opts.skipCore = true;
    const clean = parsed && parsed.flags["clean"];
    return (clean ? cleanAsync() : Promise.resolve())
        .then(() => internalBuildTargetAsync(opts));
}

export function internalBuildTargetAsync(options: BuildTargetOptions = {}): Promise<void> {
    if (pxt.appTarget.id == "core")
        return buildTargetCoreAsync(options)

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

    if (nodeutil.existsDirSync(simDir()))
        initPromise = initPromise.then(() => extractLocStringsAsync("sim-strings", [simDir()]));

    return initPromise
        .then(() => { copyCommonSim(); return simshimAsync() })
        .then(() => buildFolderAsync('compiler', true, 'compiler'))
        .then(() => fillInCompilerExtension(pxt.appTarget))
        .then(() => options.rebundle ? buildTargetCoreAsync({ quick: true }) : buildTargetCoreAsync(options))
        .then(() => buildSimAsync())
        .then(() => buildFolderAsync('cmds', true))
        .then(() => buildSemanticUIAsync())
        .then(() => buildEditorExtensionAsync("editor", "extendEditor"))
        .then(() => buildEditorExtensionAsync("fieldeditors", "extendFieldEditors"))
        .then(() => buildFolderAsync('server', true, 'server'))

    function inCommonPkg(p: string) {
        return fs.existsSync(path.join(commonPackageDir, p));
    }
}

function buildEditorExtensionAsync(dirname: string, optionName: string) {
    if (pxt.appTarget.appTheme && (pxt.appTarget.appTheme as any)[optionName] &&
        fs.existsSync(path.join(dirname, "tsconfig.json"))) {
        const tsConfig = JSON.parse(fs.readFileSync(path.join(dirname, "tsconfig.json"), "utf8"));
        let p: Promise<void>;
        if (tsConfig.compilerOptions.module)
            p = buildFolderAndBrowserifyAsync(dirname, true, dirname);
        else
            p = buildFolderAsync(dirname, true, dirname);
        return p.then(() => {
            const prepends = nodeutil.allFiles(path.join(dirname, "prepend"), { maxDepth: 1, allowMissing: true })
                .filter(f => /\.js$/.test(f));
            if (prepends && prepends.length) {
                const editorjs = path.join("built", dirname + ".js");
                prepends.push(editorjs);
                pxt.log(`bundling ${prepends.join(', ')}`);
                const bundled = prepends.map(f => fs.readFileSync(f, "utf8")).join("\n");
                fs.writeFileSync(editorjs, bundled, "utf8");
            }
        })
    }
    return Promise.resolve();
}

function buildFolderAsync(p: string, optional?: boolean, outputName?: string): Promise<void> {
    if (!fs.existsSync(path.join(p, "tsconfig.json"))) {
        if (!optional) U.userError(`${p}/tsconfig.json not found`);
        return Promise.resolve()
    }

    const tsConfig = JSON.parse(fs.readFileSync(path.join(p, "tsconfig.json"), "utf8"));
    let isNodeModule = false;
    if (outputName && tsConfig.compilerOptions.outFile !== `../built/${outputName}.js`) {
        // Special case to support target sim as an NPM package
        if (/^node_modules[\/\\]+pxt-.*?-sim$/.test(p)) {
            // Allow the out dir be inside the folder being built, and manually copy the result to ./built afterwards
            if (tsConfig.compilerOptions.outFile !== `./built/${outputName}.js`) {
                U.userError(`${p}/tsconfig.json expected compilerOptions.outFile:"./built/${outputName}.js", got "${tsConfig.compilerOptions.outFile}"`);
            }
            isNodeModule = true;
        } else {
            U.userError(`${p}/tsconfig.json expected compilerOptions.outFile:"../built/${outputName}.js", got "${tsConfig.compilerOptions.outFile}"`);
        }
    }

    if (!fs.existsSync("node_modules/typescript")) {
        U.userError("Oops, typescript does not seem to be installed, did you run 'npm install'?");
    }

    pxt.log(`building ${p}...`)
    dirsToWatch.push(p)
    return nodeutil.spawnAsync({
        cmd: "node",
        args: [`../${isNodeModule ? "" : "node_modules/"}typescript/bin/tsc`],
        cwd: p
    }).then(() => {
        if (tsConfig.prepend) {
            let files: string[] = tsConfig.prepend
            files.push(tsConfig.compilerOptions.outFile)
            let s = ""
            for (let f of files) {
                s += fs.readFileSync(path.resolve(p, f), "utf8") + "\n"
            }
            fs.writeFileSync(path.resolve(p, tsConfig.compilerOptions.outFile), s)
        }

        if (isNodeModule) {
            const content = fs.readFileSync(path.resolve(p, tsConfig.compilerOptions.outFile), "utf8");
            fs.writeFileSync(path.resolve("built", path.basename(tsConfig.compilerOptions.outFile)), content);
        }
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
        U.userError(`${p}/tsconfig.json expected compilerOptions.outDir:"../built/${outputName}", got "${tsConfig.compilerOptions.outDir}"`);
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

        let outFile = fs.createWriteStream(`built/${outputName}.js`, { encoding: 'utf8' });
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

let dirsToWatch: string[] = []

interface CiBuildInfo {
    ci: "travis" | "githubactions" | "local"
    branch: string;
    tag: string;
    commit: string;
    commitUrl: string;
    pullRequest?: boolean;
}

function isTravis() {
    return process.env.TRAVIS === "true";
}

function isGithubAction() {
    return !!process.env.GITHUB_ACTIONS;
}

function isAzurePipelines() {
    return process.env.TF_BUILD === "True";
}

function isLocalBuild() {
    return !(isTravis() || isGithubAction() || isAzurePipelines());
}

function ciBuildInfo(): CiBuildInfo {
    if (isTravis()) return travisInfo();
    else if (isGithubAction()) return githubActionInfo();
    else if (isAzurePipelines()) return travisInfo(); // azure pipelines uses same info
    else {
        // local build
        return {
            ci: "local",
            branch: undefined,
            tag: undefined,
            commit: undefined,
            commitUrl: undefined
        }
    }

    function travisInfo(): CiBuildInfo {
        const commit = process.env.TRAVIS_COMMIT;
        const pr = process.env.TRAVIS_PULL_REQUEST;
        const repoSlug = process.env.TRAVIS_REPO_SLUG;
        return {
            ci: "travis",
            branch: process.env.TRAVIS_BRANCH,
            tag: process.env.TRAVIS_TAG,
            commit,
            commitUrl: !commit ? undefined :
                "https://github.com/" + repoSlug + "/commits/" + commit,
            pullRequest: pr !== "false"
        }
    }

    function githubActionInfo(): CiBuildInfo {
        // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/using-environment-variables#default-environment-variables
        const repoSlug = process.env.GITHUB_REPOSITORY;
        const commit = process.env.GITHUB_SHA;
        const ref = process.env.GITHUB_REF;
        // branch build refs/heads/...
        // tag build res/tags/...
        const branch = ref.replace(/^refs\/(heads|tags)\//, '');
        const tag = /^refs\/tags\//.test(ref) ? branch : undefined;
        const eventName = process.env.GITHUB_EVENT_NAME;

        pxt.log(`event name: ${eventName}`);

        // PR: not on master or not a release number
        return {
            ci: "githubactions",
            branch,
            tag,
            commit,
            commitUrl: "https://github.com/" + repoSlug + "/commits/" + commit,
            pullRequest: !(branch == "master" || /^v\d+\.\d+\.\d+$/.test(tag))
        }
    }
}

function setCiBuildInfo(tag: string, branch: string, commit: string, repoSlug: string) {
    // travis
    process.env["TRAVIS"] = "1";
    process.env["TRAVIS_TAG"] = tag;
    process.env['TRAVIS_BRANCH'] = branch;
    process.env['TRAVIS_COMMIT'] = commit;
    process.env['TRAVIS_REPO_SLUG'] = repoSlug;
}

function buildWebManifest(cfg: pxt.TargetBundle) {
    let webmanifest: any = {
        "lang": "en",
        "dir": "ltr",
        "name": cfg.name,
        "short_name": cfg.nickname || cfg.name,
        "background_color": "#FAFAFA",
        "icons": [],
        "scope": "/",
        "start_url": "/",
        "display": "fullscreen",
        "orientation": "any"
    }
    if (cfg.appTheme) {
        if (cfg.appTheme.accentColor)
            webmanifest["theme_color"] = cfg.appTheme.accentColor;
        if (cfg.appTheme.backgroundColor)
            webmanifest["background_color"] = cfg.appTheme.backgroundColor;
    }
    [192, 512].forEach(sz => {
        const fn = `/static/icons/android-chrome-${sz}x${sz}.png`;
        if (fs.existsSync(path.join('docs', fn))) {
            webmanifest.icons.push({
                "src": uploadedArtFileCdnUrl(fn),
                "sizes": `${sz}x${sz}`,
                "types": `image/png`
            })
        }
    });
    let diskManifest: any = {}
    if (fs.existsSync("webmanifest.json"))
        diskManifest = nodeutil.readJson("webmanifest.json")
    U.jsonCopyFrom(webmanifest, diskManifest);
    return webmanifest;
}

function processLf(filename: string, translationStrings: pxt.Map<string>): void {
    if (!/\.(ts|tsx|html)$/.test(filename)) return
    if (/\.d\.ts$/.test(filename)) return

    pxt.debug(`extracting strings from ${filename}`);
    fs.readFileSync(filename, { encoding: "utf8" })
        .split('\n').forEach((line, idx) => {
            function err(msg: string) {
                console.error(`${filename}(${idx + 1}): ${msg}`);
            }

            if (/@ignorelf@/.test(line))
                return;

            while (true) {
                const newLine = line.replace(/\blf(_va)?\s*\(\s*(.*)/, (all, a, args) => {
                    const m = /^("([^"]|(\\"))+")\s*[\),]/.exec(args)
                    if (m) {
                        try {
                            const str = JSON.parse(m[1])
                            translationStrings[str] = str;
                        } catch (e) {
                            err("cannot JSON-parse " + m[1])
                        }
                    } else {
                        if (!/util\.ts$/.test(filename))
                            err("invalid format of lf() argument: " + args) // @ignorelf@
                    }
                    return "BLAH " + args
                })
                if (newLine == line) return;
                line = newLine
            }
        })
}

function getGalleryUrl(props: pxt.GalleryProps | string): string {
    return typeof props === "string" ? props : props.url
}

function replaceStaticImagesInJsonBlob(cfg: any, staticAssetHandler: (fileLocation: string) => string): any {
    return pxt.replaceStringsInJsonBlob(cfg, /^\.?\/static\/.+\.(png|gif|jpeg|jpg|svg|mp4|ico)$/i, staticAssetHandler);
}

function saveThemeJson(cfg: pxt.TargetBundle, localDir?: boolean, packaged?: boolean) {
    cfg.appTheme.id = cfg.id
    cfg.appTheme.title = cfg.title
    cfg.appTheme.name = cfg.name
    cfg.appTheme.description = cfg.description

    if (packaged) {
        cfg = replaceStaticImagesInJsonBlob(
            cfg,
            fn => path.join('./docs', fn).replace(/\\/g, "/")
        );
    } else if (!localDir) {
        cfg = replaceStaticImagesInJsonBlob(
            cfg,
            fn => uploadedArtFileCdnUrl(fn)
        );
    }

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
    if (theme.homeScreenHero && typeof theme.homeScreenHero != "string") {
        const heroBannerCard = theme.homeScreenHero;
        if (heroBannerCard.title) targetStrings[heroBannerCard.title] = heroBannerCard.title;
        if (heroBannerCard.description) targetStrings[heroBannerCard.description] = heroBannerCard.description;
        if (heroBannerCard.buttonLabel) targetStrings[heroBannerCard.buttonLabel] = heroBannerCard.buttonLabel;
    }

    // add the labels for the target contributed types that appear in the block function create dialog
    if (cfg.runtime?.functionsOptions?.extraFunctionEditorTypes?.length) {
        cfg.runtime.functionsOptions.extraFunctionEditorTypes.forEach(extraType => {
            if (extraType.label) {
                targetStrings[`{id:type}${extraType.label}`] = extraType.label;
            }

            if (extraType.defaultName) {
                targetStrings[`{id:var}${extraType.defaultName}`] = extraType.defaultName;
            }
        });
    }

    // walk options in pxt.json
    // patch icons in bundled packages
    Object.keys(cfg.bundledpkgs).forEach(pkgid => {
        const res = cfg.bundledpkgs[pkgid];
        // path config before storing
        const config = JSON.parse(res[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        if (config.description) targetStrings[config.description] = config.description;
        if (config.yotta && config.yotta.userConfigs) {
            config.yotta.userConfigs
                .filter(userConfig => userConfig.description)
                .forEach(userConfig => targetStrings[userConfig.description] = userConfig.description);
        }
    })

    // extract strings from docs
    function walkDocs(docs: pxt.DocMenuEntry[]) {
        if (!docs) return;
        docs.forEach(doc => {
            targetStrings[doc.name] = doc.name;
            walkDocs(doc.subitems);
        })
    }
    walkDocs(theme.docMenu);
    if (nodeutil.fileExistsSync("targetconfig.json")) {
        const targetConfig = nodeutil.readJson("targetconfig.json") as pxt.TargetConfig;
        if (targetConfig?.galleries) {
            const docsRoot = nodeutil.targetDir;
            let gcards: pxt.CodeCard[] = [];
            let tocmd: string =
                `# Projects

`;
            Object.keys(targetConfig.galleries).forEach(k => {
                targetStrings[k] = k;
                const galleryUrl = getGalleryUrl(targetConfig.galleries[k])
                const gallerymd = nodeutil.resolveMd(docsRoot, galleryUrl);
                const gallery = pxt.gallery.parseGalleryMardown(gallerymd);
                const gurl = `/${galleryUrl.replace(/^\//, '')}`;
                tocmd +=
                    `* [${k}](${gurl})
`;
                const gcard: pxt.CodeCard = {
                    name: k,
                    url: gurl
                };
                gcards.push(gcard)
                gallery.forEach(cards => cards.cards
                    .forEach(card => {
                        if (card.imageUrl && !gcard.imageUrl)
                            gcard.imageUrl = card.imageUrl;
                        if (card.largeImageUrl && !gcard.largeImageUrl)
                            gcard.largeImageUrl = card.largeImageUrl;
                        if (card.videoUrl && !gcard.videoUrl)
                            gcard.videoUrl = card.videoUrl;
                        const url = card.url || card.learnMoreUrl || card.buyUrl || (card.youTubeId && `https://youtu.be/${card.youTubeId}`);
                        tocmd += `  * [${card.name || card.title}](${url})
`;
                        if (card.tags)
                            card.tags.forEach(tag => targetStrings[tag] = tag);
                    }))
            });

            nodeutil.writeFileSync(path.join(docsRoot, "docs/projects/SUMMARY.md"), tocmd, { encoding: "utf8" });
            nodeutil.writeFileSync(path.join(docsRoot, "docs/projects.md"),
                `# Projects

\`\`\`codecard
${JSON.stringify(gcards, null, 4)}
\`\`\`

## See Also

${gcards.map(gcard => `[${gcard.name}](${gcard.url})`).join(',\n')}

`, { encoding: "utf8" });
        }
        const multiplayerGames = targetConfig?.multiplayer?.games;
        for (const game of (multiplayerGames ?? [])) {
            if (game.title) targetStrings[`{id:game-title}${game.title}`] = game.title;
            if (game.subtitle) targetStrings[`{id:game-subtitle}${game.subtitle}`] = game.subtitle;
        }

        const kioskGames = targetConfig?.kiosk?.games;
        for (const game of (kioskGames ?? [])) {
            if (game.name) targetStrings[`{id:game-name}${game.name}`] = game.name;
            if (game.description)  targetStrings[`{id:game-description}${game.description}`] = game.description;
        }

        const approvedRepoLib = targetConfig?.packages?.approvedRepoLib;
        for (const [extension, repoData] of Object.entries(approvedRepoLib ?? {})) {
            for (const tag of (repoData.tags ?? [])) {
                targetStrings[`{id:extension-tag}${tag}`] = tag;
            }
        }

        const builtinExtensionLib = targetConfig?.packages?.builtinExtensionsLib;
        for (const [extension, repoData] of Object.entries(builtinExtensionLib ?? {})) {
            for (const tag of (repoData.tags ?? [])) {
                targetStrings[`{id:extension-tag}${tag}`] = tag;
            }
        }

        const hardwareOptions = targetConfig?.hardwareOptions;
        for (const opt of (hardwareOptions ?? [])) {
            // Not translating hardware name, as that is typically a brand name / etc.
            if (opt.description)
                targetStrings[`{id:hardware-description}${opt.description}`] = opt.description;
        }
    }
    // extract strings from editor
    ["editor", "fieldeditors", "cmds"]
        .filter(d => nodeutil.existsDirSync(d))
        .forEach(d => nodeutil.allFiles(d)
            .forEach(f => processLf(f, targetStrings))
        );
    let targetStringsSorted: pxt.Map<string> = {};
    Object.keys(targetStrings).sort().map(k => targetStringsSorted[k] = targetStrings[k]);

    // write files
    nodeutil.mkdirP("built");
    nodeutil.writeFileSync("built/theme.json", nodeutil.stringify(cfg.appTheme))
    nodeutil.writeFileSync("built/target-strings.json", nodeutil.stringify(targetStringsSorted))
    pxt.log(`target-strings.json built`)
}

function lessFilePaths() {
    return [
        "node_modules/semantic-ui-less",
        "node_modules/pxt-core/theme",
        "theme/foo/bar",
        "theme",
        "node_modules/pxt-core/react-common/styles",
        "react-common/styles",
        "node_modules/@fortawesome",
        "node_modules/pxt-core/node_modules/@fortawesome"
    ];
}

async function buildSemanticUIAsync(parsed?: commandParser.ParsedCommand) {
    if (!fs.existsSync(path.join("theme", "style.less")) || !fs.existsSync(path.join("theme", "theme.config"))) {
        return;
    }

    const pkg = readJson("package.json");
    const isPxtCore = pkg["name"] === "pxt-core";

    nodeutil.mkdirP(path.join("built", "web"));
    const lessPath = require.resolve('less');
    const lessCPath = path.join(path.dirname(lessPath), '/bin/lessc');
    const lessIncludePaths = lessFilePaths().join(":");

    // Build semantic css
    await nodeutil.spawnAsync({
        cmd: "node",
        args: [
            lessCPath,
            "theme/style.less",
            "built/web/semantic.css",
            "--include-path=" + lessIncludePaths
        ]
    })
    let fontAwesomeSource = "node_modules/@fortawesome/fontawesome-free/webfonts/";
    if (!fs.existsSync(fontAwesomeSource)) {
        fontAwesomeSource = "node_modules/pxt-core/" + fontAwesomeSource;
    }

    // Inline all of our icon fonts
    let semCss = await readFileAsync('built/web/semantic.css', "utf8");
    semCss = await linkFontAsync("icons", semCss);
    semCss = await linkFontAsync("outline-icons", semCss);
    semCss = await linkFontAsync("brand-icons", semCss);
    semCss = await linkFontAsync("fa-solid-900", semCss, fontAwesomeSource, "\\.\\.\\/webfonts\\/");
    semCss = await linkFontAsync("fa-regular-400", semCss, fontAwesomeSource, "\\.\\.\\/webfonts\\/");

    // Append icons.css to semantic.css (custom pxt icons)
    const iconsFile = isPxtCore ? 'built/web/icons.css' : 'node_modules/pxt-core/built/web/icons.css';
    const iconsCss = await readFileAsync(iconsFile, "utf8");

    semCss = semCss + "\n" + iconsCss;
    nodeutil.writeFileSync('built/web/semantic.css', semCss);

    // Generate blockly css
    if (fs.existsSync(path.join("theme", "blockly.less"))) {
        await nodeutil.spawnAsync({
            cmd: "node",
            args: [
                lessCPath,
                "theme/blockly.less",
                "built/web/blockly.css",
                "--include-path=" + lessIncludePaths
            ]
        });
    }

    async function generateReactCommonCss(app: string) {
        const appFile = isPxtCore ? `react-common/styles/react-common-${app}-core.less` :
            `node_modules/pxt-core/react-common/styles/react-common-${app}.less`;
        await nodeutil.spawnAsync({
            cmd: "node",
            args: [
                lessCPath,
                appFile,
                `built/web/react-common-${app}.css`,
                "--include-path=" + lessIncludePaths
            ]
        });

        let appCss = await readFileAsync(`built/web/react-common-${app}.css`, "utf8");
        appCss = await linkFontAsync("fa-solid-900", appCss, fontAwesomeSource, "\\.\\.\\/webfonts\\/");
        appCss = await linkFontAsync("fa-regular-400", appCss, fontAwesomeSource, "\\.\\.\\/webfonts\\/");
        await writeFileAsync(`built/web/react-common-${app}.css`, appCss, "utf8");
    }

    // Generate react-common css for skillmap, authcode, and multiplayer (but not kiosk yet)
    await Promise.all([
        generateReactCommonCss("skillmap"),
        generateReactCommonCss("authcode"),
        generateReactCommonCss("multiplayer")
    ]);

    // Run postcss with autoprefixer and rtlcss
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
    ];

    const cssnano = require("cssnano")({
        zindex: false,
        autoprefixer: { browsers: browserList, add: true }
    });

    const rtlcss = require("rtlcss");
    const files = [
        "semantic.css",
        "blockly.css",
        "react-common-skillmap.css",
        "react-common-authcode.css",
        "react-common-multiplayer.css"
    ];

    for (const cssFile of files) {
        const css = await readFileAsync(`built/web/${cssFile}`, "utf8");
        const processed = await postcss([cssnano])
            .process(css, { from: `built/web/${cssFile}`, to: `built/web/${cssFile}` });

        await writeFileAsync(`built/web/${cssFile}`, processed.css);

        const processedRtl = await postcss([rtlcss])
            .process(processed.css, { from: `built/web/${cssFile}`, to: `built/web/rtl${cssFile}` });

        await writeFileAsync(`built/web/rtl${cssFile}`, processedRtl.css, "utf8");
    }

    if (!isPxtCore) {
        // This is just to support the local skillmap/cra-app serve for development
        nodeutil.cp("built/web/react-common-skillmap.css", "node_modules/pxt-core/skillmap/public/blb");
        nodeutil.cp("built/web/react-common-authcode.css", "node_modules/pxt-core/authcode/public/blb");
        nodeutil.cp("built/web/semantic.css", "node_modules/pxt-core/skillmap/public/blb");
        nodeutil.cp("built/web/semantic.css", "node_modules/pxt-core/authcode/public/blb");
    }
}

async function linkFontAsync(font: string, semCss: string, sourceDir = "node_modules/semantic-ui-less/themes/default/assets/fonts/", refDir = "fonts\\/") {
    const fontFile = await readFileAsync(sourceDir + font + ".woff")
    const url = "url(data:application/font-woff;charset=utf-8;base64,"
        + fontFile.toString("base64") + ") format('woff')"
    const r = new RegExp(`src:.*url\\((?:"|')${refDir + font}\\.woff.*`, "g")

    semCss = semCss.replace('src: url("' + refDir + font + '.eot");', "")
        .replace('src: url(' + refDir + font + '.eot);', "")
        .replace(r, "src: " + url + ";")
    return semCss;
}

function buildWebStringsAsync() {
    if (pxt.appTarget.id != "core") return Promise.resolve();

    nodeutil.writeFileSync("built/webstrings.json", nodeutil.stringify(webstringsJson()))
    return Promise.resolve()
}

function buildReactAppAsync(app: string, parsed: commandParser.ParsedCommand, opts?: {
    copyAssets?: boolean,
    includePxtSim?: boolean,
    // this requires pxt serve to have completed before serving app, as it relies on
    // packing of pxtarget in buildTargetCoreAsync (mainly the chunk in the forEachBundledPkgAsync)
    expandedPxtTarget?: boolean,
    includePdfLib?: boolean,
}) {
    opts = opts || {
        copyAssets: true
    };
    // local serve
    const appRoot = `node_modules/pxt-core/${app}`;
    const docsPath = parsed.flags["docs"];
    return rimrafAsync(`${appRoot}/public/blb`, {})
        .then(() => rimrafAsync(`${appRoot}/build/assets`, {}))
        .then(() => rimrafAsync(`${appRoot}/public/docs`, {}))
        .then(() => rimrafAsync(`${appRoot}/public/static`, {}))
        .then(() => {
            if (!opts.expandedPxtTarget) {
                // read pxtarget.json, save into 'pxtTargetBundle' global variable
                let cfg = readLocalPxTarget();
                nodeutil.writeFileSync(`${appRoot}/public/blb/target.js`, "// eslint-disable-next-line \n" + targetJsPrefix + JSON.stringify(cfg));
            } else {
                nodeutil.cp("built/target.js", `${appRoot}/public/blb`);
            }

            // This will be missing when serving without a cloned / linked repo
            if (opts.includePdfLib
                && fs.existsSync("node_modules/pxt-core/webapp/public/pdf-lib/pdf-lib.min.js")) {
                nodeutil.cp(
                    "node_modules/pxt-core/webapp/public/pdf-lib/pdf-lib.min.js",
                    `${appRoot}/public/blb/pdf-lib`
                );
            }

            nodeutil.cp("targetconfig.json", `${appRoot}/public/blb`);
            nodeutil.cp("node_modules/pxt-core/built/pxtlib.js", `${appRoot}/public/blb`);
            if (opts.includePxtSim) {
                nodeutil.cp("node_modules/pxt-core/built/pxtsim.js", `${appRoot}/public/blb`);
                nodeutil.cp("node_modules/pxt-core/built/web/worker.js", `${appRoot}/public/blb`);
                nodeutil.cp("node_modules/pxt-core/built/web/pxtworker.js", `${appRoot}/public/blb`);
            }
            nodeutil.cp("built/web/semantic.css", `${appRoot}/public/blb`);
            nodeutil.cp("node_modules/pxt-core/built/web/icons.css", `${appRoot}/public/blb`);
            nodeutil.cp(`node_modules/pxt-core/built/web/react-common-${app}.css`, `${appRoot}/public/blb`);

            if (opts.copyAssets) {
                // copy 'assets' over from docs/static
                nodeutil.cpR(`docs/static/${app}/assets`, `${appRoot}/public/assets`);
            }

            if (docsPath) {
                // copy docs over from specified path
                nodeutil.cpR(`docs/${docsPath}`, `${appRoot}/public/docs/${docsPath}`);
                nodeutil.cpR(`docs/static/${docsPath}`, `${appRoot}/public/static/${docsPath}`);
            }

            return nodeutil.spawnAsync({
                cmd: os.platform() === "win32" ? "npm.cmd" : "npm",
                args: ["run-script", "start"],
                cwd: appRoot,
                shell: true
            })
        });
}

function buildSkillMapAsync(parsed: commandParser.ParsedCommand) {
    return buildReactAppAsync(
        "skillmap",
        parsed,
        {
            includePdfLib: true,
            copyAssets: true
        }
    );
}

function buildAuthcodeAsync(parsed: commandParser.ParsedCommand) {
    return buildReactAppAsync("authcode", parsed, { copyAssets: false });
}

function updateDefaultProjects(cfg: pxt.TargetBundle) {
    let defaultProjects = [
        pxt.BLOCKS_PROJECT_NAME,
        pxt.JAVASCRIPT_PROJECT_NAME
    ];

    nodeutil.allFiles("libs", { maxDepth: 1, includeDirs: true })
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

                if (fileName === pxt.CONFIG_NAME) {
                    newProject.config = nodeutil.readPkgConfig(projectPath);
                    U.iterMap(newProject.config.dependencies, (k, v) => {
                        if (/^file:/.test(v)) {
                            newProject.config.dependencies[k] = "*";
                        }
                    });
                    if (newProject.config.icon)
                        newProject.config.icon = uploadedArtFileCdnUrl(newProject.config.icon);
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

function rebundleAsync() {
    return buildTargetCoreAsync({ quick: true })
        .then(() => buildSimAsync());
}

function buildSimAsync() {
    return buildFolderAsync(simDir(), true, pxt.appTarget.id === "common" ? "common-sim" : "sim");
}

function compressApiInfo(inf: Map<pxt.PackageApiInfo>) {
    function leanSymbol(sym: pxtc.SymbolInfo) {
        const isEmpty = (v: any) => !v || Object.keys(v).length == 0
        let attrs: pxtc.CommentAttrs = U.clone(sym.attributes || ({} as any))
        if (attrs.callingConvention == 0)
            delete attrs.callingConvention
        if (isEmpty(attrs.paramDefl))
            delete attrs.paramDefl
        if (isEmpty(attrs.paramHelp))
            delete attrs.paramHelp
        if (!attrs.jsDoc)
            delete attrs.jsDoc
        if (attrs.iconURL && attrs.jres) {
            delete attrs.iconURL;
        }
        delete attrs._source
        // keep shim=ENUM_GET etc
        if (!attrs.shim || attrs.shim.indexOf("::") > 0)
            delete attrs.shim
        delete attrs._name
        if (isEmpty(attrs))
            attrs = undefined
        const kind = sym.snippet !== undefined ? -sym.kind : sym.kind
        const pyQName = sym.pyQName !== sym.qName ? sym.pyQName : undefined
        return {
            kind: kind == 7 ? undefined : kind,
            retType: sym.retType == "void" ? undefined : sym.retType,
            attributes: attrs,
            extendsTypes: sym.extendsTypes,
            parameters: sym.parameters ? sym.parameters.map(p => ({
                name: p.name,
                description: p.description || undefined,
                type: p.type == "number" ? undefined : p.type,
                initializer: p.initializer,
                default: p.default,
                options: isEmpty(p.options) ? undefined : p.options,
                isEnum: p.isEnum || undefined,
                handlerParameters: p.handlerParameters
            })) : undefined,
            isInstance: sym.isInstance || undefined,
            isReadOnly: sym.isReadOnly || undefined,
            pyQName: pyQName
        } as pxtc.SymbolInfo;
    }

    inf = U.clone(inf)

    for (const pkgName of Object.keys(inf)) {
        const byQName = inf[pkgName].apis.byQName
        for (const apiName of Object.keys(byQName)) {
            if (/^DAL\./.test(apiName))
                delete byQName[apiName]
            else
                byQName[apiName] = leanSymbol(byQName[apiName])
        }
    }

    return inf
}

async function buildTargetCoreAsync(options: BuildTargetOptions = {}) {
    let cfg = readLocalPxTarget()
    updateDefaultProjects(cfg);
    updateTOC(cfg);

    cfg.bundledpkgs = {}
    pxt.setAppTarget(cfg);
    pxt.reloadAppTargetVariant();
    dirsToWatch = cfg.bundleddirs.slice()
    if (pxt.appTarget.id != "core") {
        if (fs.existsSync("theme")) {
            dirsToWatch.push("theme"); // simulator
            dirsToWatch.push(path.join("theme", "site", "globals")); // simulator
        }
        if (fs.existsSync("editor"))
            dirsToWatch.push("editor");
        if (fs.existsSync("fieldeditors"))
            dirsToWatch.push("fieldeditors");
        if (fs.existsSync(simDir())) {
            dirsToWatch.push(simDir()); // simulator
            dirsToWatch = dirsToWatch.concat(
                fs.readdirSync(simDir())
                    .map(p => path.join(simDir(), p))
                    .filter(p => path.basename(p) !== "built" && fs.statSync(p).isDirectory()));
        }
    }

    const hexCachePath = path.resolve(process.cwd(), "built", "hexcache");
    nodeutil.mkdirP(hexCachePath);

    pxt.log(`building target.json in ${process.cwd()}...`)

    let builtInfo: pxt.Map<pxt.PackageApiInfo> = {};

    let coreDependencies: string[];
    const corepkg = "libs/" + pxt.appTarget.corepkg;

    // use staticpkgdirs if defined, otherwise fall back to bundledirs
    const packageDirs = (pxt.appTarget.staticpkgdirs?.extensions || pxt.appTarget.bundleddirs).map(dir => path.resolve(dir));
    const rootDir = process.cwd();

    await buildWebStringsAsync();
    if (!options.quick) await internalGenDocsAsync(false, true)
    if (pxt.appTarget.cacheusedblocksdirs) cfg.tutorialInfo = await internalCacheUsedBlocksAsync();

    await forEachBundledPkgAsync(async (pkg, dirname) => {
        pxt.log(`building bundled ${dirname}`);
        let isPrj = /prj$/.test(dirname);
        const isHw = /hw---/.test(dirname);
        const config = nodeutil.readPkgConfig(".")
        const isCore = !!config.core;
        for (let p of config.additionalFilePaths)
            dirsToWatch.push(path.resolve(p));

        const publishFiles = await pkg.filesToBePublishedAsync(true);
        if (!isPrj) {
            cfg.bundledpkgs[path.basename(dirname)] = publishFiles
        }
        if (isHw || (isCore && pxt.appTarget.simulator && pxt.appTarget.simulator.dynamicBoardDefinition)) {
            isPrj = true
        }

        let res: TargetPackageInfo = null;
        if (!options.quick) {
            res = await testForBuildTargetAsync(isPrj || (!options.skipCore && isCore), builtInfo[dirname] && builtInfo[dirname].sha);
        }

        if (!res) return;

        const { options: pkgOptions, api, sha: packageSha } = res;

        if (pkgOptions && api) {
            // JRES is already included in the target bundle
            api.jres = undefined;
            builtInfo[dirname] = {
                apis: api,
                sha: packageSha
            };

            if (dirname === corepkg) {
                coreDependencies = mainPkg.sortedDeps().map(p => p.config.name).filter(n => n !== pxt.appTarget.corepkg);
            }
        }

        // For the projects, we need to save the base HEX file to the offline HEX cache
        if (isPrj && pxt.appTarget.compile?.hasHex) {
            if (!pkgOptions) {
                pxt.debug(`Failed to extract native image for project ${dirname}`);
                return;
            }

            const hexFileExtInfo = [pkgOptions.extinfo, ...(pkgOptions.otherMultiVariants?.map(el => el.extinfo) || [])];
            for (const extinfo of hexFileExtInfo) {
                // Place the base HEX image in the hex cache if necessary
                let sha = extinfo.sha;
                let hex: string[] = extinfo.hexinfo.hex;
                let hexFile = path.join(hexCachePath, sha + ".hex");

                if (fs.existsSync(hexFile)) {
                    pxt.debug(`native image already in offline cache for project ${dirname}: ${hexFile}`);
                } else {
                    nodeutil.writeFileSync(hexFile, hex.join(os.EOL));
                    pxt.debug(`created native image in offline cache for project ${dirname}: ${hexFile}`);
                }
            }

            if (!options.packaged) return;
            if (pxt.appTarget.staticpkgdirs && pxt.appTarget.staticpkgdirs.base.indexOf(dirname) === -1) return;

            // We want to cache a hex file for each of the native packages in case they are added to a project.
            // This won't cover the whole matrix, but handles the common case of projects that add one extra
            // extension in the offline app.
            const allDeps = pkg.sortedDeps(true)
                .map(dep => path.resolve(path.join(dirname, dep.verArgument())))
                .map(dep => path.resolve(dep).replace(/---.*/, "")); // keep path format (/ vs \\) consistent, trim --- suffix to avoid duplicate imports.
            const config = nodeutil.readPkgConfig(dirname);
            const host = pkg.host() as Host;

            const pkgsToBuildWith = packageDirs.filter(dirname => !allDeps.some(el => el.indexOf(dirname.replace(/---.*/, "")) !== -1));
            pxt.log(`Dependencies of base pkgs: ${allDeps.map(el => path.basename(el)).join(", ")}`);
            for (const extraPackage of pkgsToBuildWith) {
                const extraPathBaseName = path.basename(extraPackage);
                process.chdir(path.join(rootDir, dirname));
                const deps: pxt.Map<string> = {
                    ...config.dependencies,
                    [extraPathBaseName]: "file:" + path.relative(path.resolve("."), extraPackage)
                }
                host.fileOverrides["pxt.json"] = JSON.stringify({
                    ...config,
                    dependencies: deps
                })
                pxt.log(`Building hex cache for ${extraPathBaseName} with dependencies:`)
                console.dir(deps);
                mainPkg = new pxt.MainPackage(host);

                try {
                    const extraRes = await testForBuildTargetAsync(true, null);

                    if (extraRes) {
                        const hexFileExtInfo = [extraRes.options.extinfo, ...(extraRes.options.otherMultiVariants?.map(el => el.extinfo) || [])];
                        for (const extinfo of hexFileExtInfo) {
                            // Place the base HEX image in the hex cache if necessary
                            let sha = extinfo.sha;
                            let hex: string[] = extinfo.hexinfo.hex;
                            let hexFile = path.join(hexCachePath, sha + ".hex");

                            if (fs.existsSync(hexFile)) {
                                pxt.debug(`native image already in offline cache for project ${dirname}: ${hexFile}`);
                            } else {
                                nodeutil.writeFileSync(hexFile, hex.join(os.EOL));
                                pxt.log(`created native image in offline cache for project ${dirname}: ${hexFile}`);
                            }
                        }
                    }
                }
                catch (e) {
                    // We're not being smart and verifying that the packages are actually compatible, so
                    // we might get some errors. Ignore them and keep going.
                    // -- This will likely happen if you have any packages listed that have hw specific versions,
                    // e.g. serial && serial---linux
                    pxt.debug(`Unable to cache hex for project ${dirname} with '${extraPackage}'`);
                }
            }
        }
    }, true);

    // patch icons in bundled packages
    Object.keys(cfg.bundledpkgs).forEach(pkgid => {
        const res = cfg.bundledpkgs[pkgid];
        // path config before storing
        const config = JSON.parse(res[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        if (!config.icon)
            // try known location
            ['png', 'jpg'].map(ext => `/static/libs/${config.name}.${ext}`)
                .filter(ip => fs.existsSync("docs" + ip))
                .forEach(ip => config.icon = ip);

        res[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(config);
    })

    // Trim redundant API info from packages
    const coreInfo = builtInfo[corepkg];

    if (coreInfo) {
        // Don't bother with dependencies of the core package
        if (coreDependencies) {
            coreDependencies
                .map(dep => builtInfo["libs/" + dep])
                .filter(bi => !!bi)
                .forEach(bi => bi.apis.byQName = {});
        }

        Object.keys(builtInfo).filter(k => k !== corepkg).map(k => builtInfo[k]).forEach(info => {
            deleteRedundantSymbols(coreInfo.apis.byQName, info.apis.byQName)
        });
    }

    const compressedBuiltInfo = compressApiInfo(builtInfo);
    cfg.apiInfo = compressedBuiltInfo;

    const info = ciBuildInfo()
    cfg.versions = {
        branch: info.branch,
        tag: info.tag,
        commits: info.commitUrl,
        target: readJson("package.json")["version"],
        pxt: pxtVersion(),
        pxtCrowdinBranch: pxtCrowdinBranch(),
        targetCrowdinBranch: targetCrowdinBranch()
    }
    saveThemeJson(cfg, options.localDir, options.packaged)
    fillInCompilerExtension(cfg);

    const webmanifest = buildWebManifest(cfg)
    cfg = U.clone(cfg)
    cfg.compile.switches = {} // otherwise we leak the switches set with PXT_COMPILE_SWITCHES=
    const targetjson = nodeutil.stringify(cfg)
    nodeutil.writeFileSync("built/target.json", targetjson)
    nodeutil.writeFileSync("built/target.js", targetJsPrefix + targetjson)
    pxt.setAppTarget(cfg) // make sure we're using the latest version
    let targetlight = U.flatClone(cfg)
    delete targetlight.bundleddirs;
    delete targetlight.bundledpkgs;
    delete targetlight.appTheme;
    delete targetlight.apiInfo;
    delete targetlight.tutorialInfo;
    if (targetlight.compile)
        delete targetlight.compile.compilerExtension;
    const targetlightjson = nodeutil.stringify(targetlight);
    nodeutil.writeFileSync("built/targetlight.json", targetlightjson)
    nodeutil.writeFileSync("built/sim.webmanifest", nodeutil.stringify(webmanifest))

    console.log("target.json built.");
}

function fillInCompilerExtension(cfg: pxt.TargetBundle) {
    const compPath = path.join(nodeutil.targetDir, "built/compiler.js")
    if (fs.existsSync(compPath)) {
        const src = fs.readFileSync(compPath, "utf8");
        // remove top-level namespace declarations, so it evals() correctly
        cfg.compile.compilerExtension = src.replace(/^var \w+;$/gm, "");
    }
}

function deleteRedundantSymbols(core: pxt.Map<pxtc.SymbolInfo | pxt.JRes>, trg: pxt.Map<pxtc.SymbolInfo | pxt.JRes>) {
    const ignoredKeys = ["fileName", "pkg"]

    for (const key of Object.keys(trg)) {
        if (flatJSONEquals(core[key], trg[key])) delete trg[key];
    }

    function flatJSONEquals(a: any, b: any) {
        if (a === b) return true;

        const tp = typeof a;
        if (tp !== typeof b || tp !== "object") return false;

        const keysa = Object.keys(a).filter(k => ignoredKeys.indexOf(k) === -1);
        const keysb = Object.keys(b).filter(k => ignoredKeys.indexOf(k) === -1);

        if (keysa.length !== keysb.length) return false;

        for (const key of keysa) {
            if (keysb.indexOf(key) === -1) return false;
            if (!flatJSONEquals(a[key], b[key])) return false;
        }

        return true;
    }
}

function pxtVersion(): string {
    return pxt.appTarget.id == "core" ?
        readJson("package.json")["version"] :
        readJson("node_modules/pxt-core/package.json")["version"];
}

function pxtCrowdinBranch(): string {
    const theme = pxt.appTarget.id == "core" ?
        readJson("pxtarget.json").appTheme :
        readJson("node_modules/pxt-core/pxtarget.json").appTheme;
    return theme ? theme.crowdinBranch : undefined;
}

function targetCrowdinBranch(): string {
    const theme = readJson("pxtarget.json").appTheme;
    return theme ? theme.crowdinBranch : undefined;
}

function buildAndWatchAsync(f: () => Promise<string[]>, maxDepth: number): Promise<void> {
    let currMtime = Date.now()
    return f()
        .then(dirs => {
            if (globalConfig.noAutoBuild) return
            pxt.debug('watching ' + dirs.join(', ') + '...');
            let loop = () => {
                U.delay(1000)
                    .then(() => maxMTimeAsync(dirs, maxDepth))
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

async function buildAndWatchTargetAsync(includeSourceMaps: boolean, rebundle: boolean) {
    if (fs.existsSync("pxt.json") &&
        !(fs.existsSync(path.join(simDir(), "tsconfig.json")) || nodeutil.existsDirSync(path.join(simDir(), "public")))) {
        console.log("No sim/tsconfig.json nor sim/public/; assuming npm installed package")
        return Promise.resolve()
    }

    const hasCommonPackages = fs.existsSync(path.resolve("node_modules/pxt-common-packages"));

    let simDirectories: string[] = [];
    if (hasCommonPackages) {
        const libsdir = path.resolve("node_modules/pxt-common-packages/libs");
        simDirectories = fs.readdirSync(libsdir).map(fn => path.join(libsdir, fn, "sim"));
        simDirectories = simDirectories.filter(fn => fs.existsSync(fn));
    }

    const buildTarget = async () => {
        let currentlyBuilding = "common sim";
        try {
            await buildCommonSimAsync();
            currentlyBuilding = "target";
            await internalBuildTargetAsync({ localDir: true, rebundle });
        } catch (e) {
            buildFailed(`${currentlyBuilding} build failed: ${e?.message}`, e);
        }

        let toWatch = dirsToWatch.slice();
        if (hasCommonPackages) {
            toWatch = toWatch.concat(simDirectories);
        }
        return toWatch.filter(d => fs.existsSync(d));
    }

    const lessFiles = lessFilePaths().filter(p => fs.existsSync(p));
    // css build already occurs midway through internalBuildTargetAsync, so skip first rerun
    let skipFirstCssBuild = true;
    const buildCss = async () => {
        if (skipFirstCssBuild) {
            skipFirstCssBuild = false;
        } else {
            console.log("rebuilding css");
            await buildSemanticUIAsync();
            console.log("css build complete");
        }
        return lessFiles;
    };

    // some of the watched targets for buildTarget include nested built files,
    // such as libs/game/_locales/*, so can't just grab subdirectories
    await buildAndWatchAsync(buildTarget, 1);
    await buildAndWatchAsync(buildCss, 6);
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
    const dst = path.resolve(path.join(builtPackaged, localDir))

    nodeutil.cpR("node_modules/pxt-core/docfiles", path.join(dst, "/docfiles"))
    if (fs.existsSync("docfiles"))
        nodeutil.cpR("docfiles", dst + "/docfiles")

    const webpath = localDir
    let docsTemplate = server.expandDocFileTemplate("docs.html")
    docsTemplate = U.replaceAll(docsTemplate, "/cdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/doccdn/", webpath)
    docsTemplate = U.replaceAll(docsTemplate, "/docfiles/", webpath + "docfiles/")
    docsTemplate = U.replaceAll(docsTemplate, "/--embed", webpath + "embed.js")

    const validatedDirs: Map<boolean> = {}

    const docFolders = ["node_modules/pxt-core/common-docs"];

    if (fs.existsSync("node_modules/pxt-common-packages/docs")) {
        docFolders.push("node_modules/pxt-common-packages/docs");
    }

    docFolders.push(...nodeutil.getBundledPackagesDocs());
    docFolders.push("docs");

    for (const docFolder of docFolders) {
        for (const f of nodeutil.allFiles(docFolder, { maxDepth: 8 })) {
            pxt.log(`rendering ${f}`)
            const pathUnderDocs = f.slice(docFolder.length + 1);
            let outputFile = path.join(dst, "docs", pathUnderDocs);

            const outputDir = path.dirname(outputFile);
            if (!validatedDirs[outputDir]) {
                nodeutil.mkdirP(outputDir);
                validatedDirs[outputDir] = true;
            }

            let buf = fs.readFileSync(f);
            if (/\.(md|html)$/.test(f)) {
                const fileData = buf.toString("utf8");
                let html = "";
                if (U.endsWith(f, ".md")) {
                    const md = nodeutil.resolveMd(
                        ".",
                        pathUnderDocs.slice(0, -3),
                        fileData
                    );
                    // patch any /static/... url to /docs/static/...
                    const patchedMd = md.replace(/\"\/static\//g, `"/docs/static/`);
                    nodeutil.writeFileSync(outputFile, patchedMd, { encoding: "utf8" });

                    html = pxt.docs.renderMarkdown({
                        template: docsTemplate,
                        markdown: patchedMd,
                        theme: pxt.appTarget.appTheme,
                        filepath: path.join("docs", pathUnderDocs),
                    });

                    // replace .md with .html for rendered page drop
                    outputFile = outputFile.slice(0, -3) + ".html";
                } else {
                    html = server.expandHtml(fileData);
                }

                html = html.replace(/(<a[^<>]*)\shref="(\/[^<>"]*)"/g, (f, beg, url) => {
                    return beg + ` href="${webpath}docs${url}.html"`
                });
                buf = Buffer.from(html, "utf8");
            }

            nodeutil.writeFileSync(outputFile, buf)
        }
        pxt.log(`All docs written from ${docFolder}.`);
    }
    pxt.log(`All docs written.`);
}

export function serveAsync(parsed: commandParser.ParsedCommand) {
    // always use a cloud build
    // in most cases, the user machine is not properly setup to
    // build a native binary and our CLI just looks broken
    // use --localbuild to force localbuild
    parseBuildInfo(parsed);

    let justServe = false
    let packaged = false
    let includeSourceMaps = false;

    if (parsed.flags["just"]) {
        justServe = true
    } else if (parsed.flags["pkg"]) {
        justServe = true
        packaged = true
    }
    const rebundle = !!parsed.flags["rebundle"];
    if (parsed.flags["noBrowser"]) {
        globalConfig.noAutoStart = true
    }
    if (parsed.flags["sourceMaps"]) {
        includeSourceMaps = true;
    }
    if (!globalConfig.localToken) {
        globalConfig.localToken = ts.pxtc.Util.guidGen();
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
    return (justServe ? Promise.resolve() : buildAndWatchTargetAsync(includeSourceMaps, rebundle))
        .then(() => server.serveAsync({
            autoStart: !globalConfig.noAutoStart,
            localToken,
            packaged,
            port: parsed.flags["port"] as number || 0,
            wsPort: parsed.flags["wsport"] as number || 0,
            hostname: parsed.flags["hostname"] as string || "",
            browser: parsed.flags["browser"] as string,
            serial: !parsed.flags["noSerial"] && !globalConfig.noSerial,
            noauth: parsed.flags["noauth"] as boolean || false,
        }))
}


const readFileAsync: any = promisify(fs.readFile)
const writeFileAsync: any = promisify(fs.writeFile)
const readDirAsync = promisify(fs.readdir)
const statAsync = promisify(fs.stat)
const rimrafAsync = promisify(rimraf);

let commonfiles: Map<string> = {}

class SnippetHost implements pxt.Host {
    //Global cache of module files
    files: Map<Map<string>> = {}
    cache: pxt.Map<string> = {};

    constructor(public name: string, public packageFiles: Map<string>, public extraDependencies: pxt.Map<string>, private includeCommon = false) { }

    resolve(module: pxt.Package, filename: string): string {
        pxt.log(`resolve ${module.id}. ${filename}`)
        return ""
    }

    readFile(module: pxt.Package, filename: string): string {
        if (filename == pxt.github.GIT_JSON)
            return null;

        if (this.files[module.id] && this.files[module.id][filename]) {
            return this.files[module.id][filename]
        }
        if (module.id == "this") {
            if (filename == "pxt.json") {
                let commonFiles = this.includeCommon ? [
                    "pxt-core.d.ts",
                    "pxt-helpers.ts",
                ] : []
                let packageFileNames = Object.keys(this.packageFiles)
                return JSON.stringify(<pxt.PackageConfig>{
                    "name": this.name.replace(/[^a-zA-z0-9]/g, ''),
                    "dependencies": this.dependencies(),
                    "description": "",
                    "public": true,
                    "yotta": {
                        "ignoreConflicts": true
                    },
                    "files": packageFileNames.concat(commonFiles)
                })
            }
            else if (filename in this.packageFiles) {
                return this.packageFiles[filename]
            }
        } else if (pxt.appTarget.bundledpkgs[module.id] && filename === pxt.CONFIG_NAME) {
            return pxt.appTarget.bundledpkgs[module.id][pxt.CONFIG_NAME];
        } else {
            const readFile = (filename: string) => {
                let ps = [
                    path.join(module.id, filename),
                    path.join('libs', module.id, filename),
                    path.join('libs', module.id, 'built', filename),
                ];
                for (let p of ps) {
                    try {
                        return fs.readFileSync(p, 'utf8')
                    }
                    catch (e) {
                    }
                }
                return null
            }

            let contents = readFile(filename)
            if (contents == null) {
                // try additional package location
                if (pxt.appTarget.bundledpkgs[module.id]) {
                    let f = readFile(pxt.CONFIG_NAME)
                    const modpkg = JSON.parse(f || "{}") as pxt.PackageConfig;
                    // TODO this seems to be dead code, additionalFilePath is removed from bundledpkgs
                    // why not just use bundledpkgs also for files?
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
            else if (filename === "pxt-python.d.ts" || filename === "pxt-python-helpers.ts") {
                const contents = fs.readFileSync(path.resolve(this.getRepoDir(), "libs", "pxt-python", filename), 'utf8');
                this.writeFile(module, filename, contents);
                return contents;
            }
        }

        // might be ok
        return null;
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
        return pxt.hexloader.getHexInfoAsync(this, extInfo)
    }

    cacheStoreAsync(id: string, val: string): Promise<void> {
        this.cache[id] = val;
        return Promise.resolve()
    }

    cacheGetAsync(id: string): Promise<string> {
        return Promise.resolve(this.cache[id] || "")
    }

    downloadPackageAsync(pkg: pxt.Package): Promise<void> {
        return pkg.commonDownloadAsync()
            .then(resp => {
                if (resp) {
                    U.iterMap(resp, (fn: string, cont: string) => {
                        this.writeFile(pkg, fn, cont)
                    })
                }
            })
    }

    resolveVersionAsync(pkg: pxt.Package): Promise<string> {
        if (!/^file:/.test(pkg._verspec))
            pxt.log(`resolveVersionAsync(${pkg.id})`)
        return Promise.resolve("*")
    }

    private dependencies(): Map<string> {
        let stdDeps: Map<string> = {}
        for (const extraDep in this.extraDependencies) {
            const ver = this.extraDependencies[extraDep];
            stdDeps[extraDep] = ver == "*" ? `file:../${extraDep}` : ver;
        }
        return stdDeps
    }
}

class Host
    implements pxt.Host {
    fileOverrides: Map<string> = {}

    resolve(module: pxt.Package, filename: string) {
        //pxt.debug(`resolving ${module.level}:${module.id} -- ${filename} in ${path.resolve(".")}`)
        if (module.level == 0) {
            return "./" + filename
        } else if (module.verProtocol() == "file") {
            let fn = module.verArgument() + "/" + filename
            if (module.level > 1 && module.addedBy[0])
                fn = this.resolve(module.addedBy[0], fn)
            return fn
        } else {
            return "pxt_modules/" + module.id + "/" + filename
        }
    }

    readFile(module: pxt.Package, filename: string, skipAdditionalFiles?: boolean): string {
        const commonFile = U.lookup(commonfiles, filename)
        if (commonFile != null) return commonFile;

        const overFile = U.lookup(this.fileOverrides, filename)
        if (module.level == 0 && overFile != null) {
            pxt.debug(`found override for ${filename}`)
            return overFile;
        }

        const resolved = this.resolve(module, filename)
        // check dir of pxt.json, since other files can be in sub-folders
        const dir = path.dirname(this.resolve(module, pxt.CONFIG_NAME))
        if (filename == pxt.CONFIG_NAME)
            try {
                return nodeutil.stringify(nodeutil.readPkgConfig(dir))
            } catch (e) {
                return null
            }

        try {
            // pxt.debug(`reading ${resolved}`)
            return fs.readFileSync(resolved, "utf8")
        } catch (e) {
            if (!skipAdditionalFiles && module.config) {
                for (let addPath of module.config.additionalFilePaths || []) {
                    try {
                        // pxt.debug(`try read: '${dir}' '${addPath}' '${filename}' ${path.join(dir, addPath, filename)}`)
                        return fs.readFileSync(path.join(dir, addPath, filename), "utf8")
                    } catch (e) {
                    }
                }
            }
            pxt.debug(`resolve failure ${filename}`)
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
        if (U.endsWith(filename, ".uf2") || U.endsWith(filename, ".pxt64") || U.endsWith(filename, ".bin"))
            nodeutil.writeFileSync(p, contents, { encoding: "base64" })
        else if (U.endsWith(filename, ".elf"))
            nodeutil.writeFileSync(p, contents, {
                encoding: "base64",
                mode: 0o777
            })
        else
            nodeutil.writeFileSync(p, contents, { encoding: "utf8" })
    }

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        if (process.env["PXT_LOCAL_DOCKER_TEST"] === "yes") {
            const compileReq = JSON.parse(Buffer.from(extInfo.compileData, "base64").toString("utf8"))
            const mappedFiles =
                Object.keys(compileReq.replaceFiles).map(k => {
                    return {
                        name: k.replace(/^\/+/, ""),
                        text: compileReq.replaceFiles[k]
                    }
                })
            const cs = pxt.appTarget.compileService
            const dockerReq = {
                op: "buildex",
                files: mappedFiles,
                gittag: compileReq.tag,
                empty: true,
                hexfile: "build/" + cs.codalBinary + ".hex",
                platformio: false,
                clone: "https://github.com/" + cs.githubCorePackage,
                buildcmd: "python build.py",
                image: "pext/yotta:latest"
            }

            const fn = "built/dockerreq.json"
            nodeutil.writeFileSync(fn, JSON.stringify(dockerReq, null, 4))
        }

        if (pxt.options.debug) {
            const compileReq = JSON.parse(Buffer.from(extInfo.compileData, "base64").toString("utf8"))
            const replLong = (m: any) => {
                for (let k of Object.keys(m)) {
                    let v = m[k]
                    if (typeof v == "string" && v.length > 200) {
                        m[k] = v.slice(0, 100) + " ... " + U.sha256(v).slice(0, 10)
                    } else if (v && typeof v == "object") {
                        replLong(v)
                    }
                }
            }
            replLong(compileReq)
            nodeutil.writeFileSync("built/cpp.json", nodeutil.stringify(compileReq))
        }

        if (!forceBuild) {
            const cachedPath = path.resolve(nodeutil.targetDir, "built", "hexcache", extInfo.sha + ".hex");
            pxt.debug("trying " + cachedPath)
            try {
                const lines = fs.readFileSync(cachedPath, "utf8").split(/\r?\n/)
                pxt.debug(`Using hexcache: ${extInfo.sha}`)
                return Promise.resolve({ hex: lines })
            } catch (e) { }
        }

        if (!forceLocalBuild && (extInfo.onlyPublic || forceCloudBuild))
            return pxt.hexloader.getHexInfoAsync(this, extInfo)

        setBuildEngine()
        return build.buildHexAsync(build.thisBuild, mainPkg, extInfo, forceBuild)
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
                    pxt.debug(`skipping download of local pkg: ${pkg.version()}`)
                    return Promise.resolve()
                } else if (proto == "invalid") {
                    pxt.log(`skipping invalid pkg ${pkg.id}`);
                    return Promise.resolve();
                } else {
                    return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
                }
            })
    }

}

let mainPkg = new pxt.MainPackage(new Host())

function installPackageNameAsync(packageName: string): Promise<void> {
    if (!packageName) return Promise.resolve();

    // builtin?
    if (pxt.appTarget.bundledpkgs[packageName])
        return addDepAsync(packageName, "*", false);

    // github?
    const parsed = pxt.github.parseRepoId(packageName)
    if (parsed && parsed.fullName)
        return pxt.packagesConfigAsync()
            .then(config => (parsed.tag ? Promise.resolve(parsed.tag) : pxt.github.latestVersionAsync(parsed.slug, config))
                .then(tag => { parsed.tag = tag })
                .then(() => pxt.github.pkgConfigAsync(parsed.fullName, parsed.tag, config))
                .then(cfg => mainPkg.loadAsync(true)
                    .then(() => {
                        let ver = pxt.github.stringifyRepo(parsed)
                        return addDepAsync(cfg.name, ver, false);
                    })));
    // shared url?
    let sharedId = pxt.Cloud.parseScriptId(packageName);
    if (sharedId)
        return addDepAsync(sharedId, packageName, false);

    // don't know
    U.userError(lf("unknown package {0}", packageName))
    return Promise.resolve();
}

export function installAsync(parsed?: commandParser.ParsedCommand): Promise<void> {
    pxt.log("installing dependencies...");
    ensurePkgDir();
    const packageName = parsed && parsed.args.length ? parsed.args[0] : undefined;
    const hwvariant = parseHwVariant(parsed);
    const lnk = parsed.flags["link"] as string
    if (lnk && !fs.existsSync(lnk))
        U.userError(`folder not found: ${lnk}`)
    return installPackageNameAsync(packageName)
        .then(() => addDepsAsync())
        .then(() => mainPkg.installAllAsync())
        .then(() => {
            let tscfg = "tsconfig.json"
            if (!fs.existsSync(tscfg) && !fs.existsSync("../" + tscfg)) {
                nodeutil.writeFileSync(tscfg, pxt.template.TS_CONFIG)
            }
        })
        .then(() => {
            if (!lnk) return
            const mod = "pxt_modules"
            for (const folder of fs.readdirSync(mod)) {
                const fullfolder = path.join(mod, folder)
                if (fs.existsSync(path.join(lnk, folder, pxt.CONFIG_NAME))) {
                    pxt.log(`link ${fullfolder}`)
                    for (const fn of fs.readdirSync(fullfolder))
                        fs.unlinkSync(path.join(fullfolder, fn))
                    fs.writeFileSync(path.join(fullfolder, pxt.CONFIG_NAME), JSON.stringify({
                        additionalFilePath: path.join("..", "..", lnk, folder)
                    }, null, 4))
                } else {
                    pxt.log(`skip ${fullfolder}`)
                }
            }
        })

    function addDepsAsync() {
        return hwvariant ? addDepAsync(hwvariant, "*", true) : Promise.resolve();
    }
}

function addDepAsync(name: string, ver: string, hw: boolean) {
    console.log(U.lf("adding {0}: {1}", name, ver))
    return mainPkg.loadAsync(true)
        .then(() => {
            if (hw) {
                // remove other hw variants
                Object.keys(mainPkg.config.dependencies)
                    .filter(k => /^hw---/.test(k))
                    .forEach(k => delete mainPkg.config.dependencies[k]);
            }
            mainPkg.config.dependencies[name] = ver;
            mainPkg.saveConfig()
            mainPkg = new pxt.MainPackage(new Host())
        })
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
        nodeutil.writeFileSync(name, cont)
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
    return handleCommandAsync(parsed.args, loadPkgAsync)
}

export function initAsync(parsed: commandParser.ParsedCommand) {
    if (fs.existsSync(pxt.CONFIG_NAME))
        U.userError(`${pxt.CONFIG_NAME} already present`)

    const files = pxt.template.packageFiles(path.basename(path.resolve(".")).replace(/^pxt-/, ""))

    let configMap: Map<string> = JSON.parse(files[pxt.CONFIG_NAME])
    let initPromise = Promise.resolve();
    if (!parsed.flags["useDefaults"]) {
        initPromise = U.promiseMapAllSeries(["name", "description", "license"], f =>
            queryAsync(f, configMap[f])
                .then(r => {
                    configMap[f] = r
                })).then(() => { });
    }

    return initPromise
        .then(() => {
            files[pxt.CONFIG_NAME] = nodeutil.stringify(configMap);

            pxt.template.packageFilesFixup(files)

            U.iterMap(files, (k, v) => {
                nodeutil.mkdirP(path.dirname(k))
                nodeutil.writeFileSync(k, v)
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
            pxtc.service.performOperation("setOptions", { options: opts })
            return pxtc.service.performOperation(parsed.args[0] as keyof pxtc.service.ServiceOps, {})
        })
        .then(res => {
            if (pxtc.service.IsOpErr(res)) {
                console.error("Error calling service:", res.errorMessage)
                process.exit(1)
            } else {
                mainPkg.host().writeFile(mainPkg, fn, nodeutil.stringify(res))
                console.log("wrote results to " + fn)
            }
        })
}

export function augmnetDocsAsync(parsed: commandParser.ParsedCommand) {
    let f0 = fs.readFileSync(parsed.args[0], "utf8")
    let f1 = fs.readFileSync(parsed.args[1], "utf8")
    console.log(pxt.docs.augmentDocs(f0, f1))
    return Promise.resolve()
}

export function timeAsync() {
    ensurePkgDir();
    let min: Map<number[]> = {};
    let t0 = 0, t1 = 0
    let loop = () =>
        Promise.resolve()
            .then(() => {
                t0 = U.cpuUs()
                const opts = mainPkg.getTargetOptions()
                // opts.isNative = true
                return mainPkg.getCompileOptionsAsync(opts)
            })
            .then(copts => {
                t1 = U.cpuUs()
                return pxtc.compile(copts)
            })
            .then(res => {
                res.times["options"] = t1 - t0
                U.iterMap(res.times, (k, v) => {
                    v = Math.round(v / 1000)
                    res.times[k] = v
                    if (!min[k]) min[k] = []
                    min[k].push(v)
                })
                console.log(res.times)
            })
    return Promise.resolve()
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
        .then(() => {
            U.iterMap(min, (k, v) => {
                v.sort((a, b) => a - b)
            })
            console.log(min)
        })
}

export function exportCppAsync(parsed: commandParser.ParsedCommand) {
    ensurePkgDir();
    return mainPkg.loadAsync()
        .then(() => {
            setBuildEngine();
            let target = mainPkg.getTargetOptions()
            if (target.hasHex)
                target.isNative = true
            target.keepCppFiles = true
            return mainPkg.getCompileOptionsAsync(target)
        })
        .then(opts => {
            for (let s of Object.keys(opts.extinfo.extensionFiles)) {
                let s2 = s.replace("/pxtapp/", "")
                if (s2 == s) continue
                if (s2 == "main.cpp") continue
                const trg = path.join(parsed.args[0], s2)
                nodeutil.mkdirP(path.dirname(trg))
                fs.writeFileSync(trg, opts.extinfo.extensionFiles[s])
            }
        })
}

export function downloadPlaylistsAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    const fn = (parsed.args[0] as string || "playlists.json");
    if (!nodeutil.fileExistsSync(fn))
        U.userError(`File ${fn} not found`);
    const playlists = nodeutil.readJson(fn);
    return youtube.renderPlaylistsAsync(playlists);
}

export async function validateAndFixPkgConfig(parsed: commandParser.ParsedCommand): Promise<void> {
    const file = fs.readFileSync("pxt.json", { encoding: "utf8" });
    const cfg = pxt.Package.parseAndValidConfig(file);

    if (cfg) {
        pxt.log("Validating pxt.json");
    } else {
        U.userError("Could not parse pxt.json");
    }

    const trimmedFiles = validateFileList("files", cfg.files);
    if (trimmedFiles) {
        cfg.files = trimmedFiles;
    }

    const trimmedTestFiles = validateFileList("testFiles", cfg.testFiles);
    if (trimmedTestFiles) {
        cfg.testFiles = trimmedTestFiles;
    }

    const dependentFiles = cfg.fileDependencies && Object.keys(cfg.fileDependencies);
    const validFilesInFileDependencies = validateFileList("fileDependencies", dependentFiles);
    if (validFilesInFileDependencies) {
        for (const key of dependentFiles) {
            if (validFilesInFileDependencies.indexOf(key) === -1) {
                delete cfg.fileDependencies[key];
            }
        }
    }

    if (trimmedFiles || trimmedTestFiles || validFilesInFileDependencies) {
        pxt.log("Updating pxt.json");
        fs.writeFileSync('pxt.json', JSON.stringify(cfg, undefined, 4));
        pxt.log("Successfully updated pxt.json");
    } else {
        pxt.log("No errors identified in pxt.json");
    }

    function validateFileList(field: string, files: string[]) {
        pxt.log(`Checking ${field}`);
        const missing: string[] = [];
        const existing: string[] = [];

        for (const file of (files || [])) {
            if (fs.existsSync(file)) {
                existing.push(file);
            } else {
                missing.push(file);
            }
        }

        if (missing.length) {
            pxt.log(`pxt.json lists ${field} that are missing:
    ${missing.join(",\n    ")}
`);
            return existing;
        }

        return undefined;
    }
}

export function downloadDiscourseTagAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    const tag = parsed.args[0] as string;
    if (!tag)
        U.userError("Missing tag")
    const out = parsed.flags["out"] as string || "temp";
    const outmd = parsed.flags["md"] as string;
    const discourseRoot = pxt.appTarget.appTheme
        && pxt.appTarget.appTheme.socialOptions
        && pxt.appTarget.appTheme.socialOptions.discourse;
    if (!discourseRoot)
        U.userError("Target not configured for discourse");
    if (outmd && !fs.existsSync(outmd))
        U.userError(`${outmd} file not found`)
    const md: string = outmd && fs.readFileSync(outmd, { encoding: "utf8" });
    const title = md && /^# (.*)$/m.exec(md)?.[1];

    nodeutil.mkdirP(out);
    let n = 0;
    let newcards = 0;
    let cards: pxt.CodeCard[] = [];
    let lastCard: pxt.CodeCard = undefined;
    // parse existing cards
    if (md) {
        cards = pxt.gallery.parseGalleryMardown(md);
        lastCard = cards.pop();
    }
    return pxt.discourse.topicsByTag(discourseRoot, tag)
        .then(topics => U.promiseMapAllSeries(topics, topic => {
            pxt.log(`  ${topic.title}`)
            return pxt.discourse.extractSharedIdFromPostUrl(topic.url)
                .then(id => {
                    if (!id) {
                        pxt.log(`  --> unknown project id`)
                        return Promise.resolve();
                    }
                    n++;
                    return extractAsyncInternal(id, out, false)
                        .then(() => {
                            // does the current card have an image?
                            let card = cards.filter(c => c.url == topic.url)[0];
                            if (card && card.imageUrl) {
                                pxt.log(`${card.name} already in markdown`)
                                return Promise.resolve(); // already handled
                            }

                            newcards++;
                            card = topic;
                            card.name = topic.title;
                            delete card.title;
                            card.name = card.name
                                .replace(/^\s*(introducing|presenting):?\s*/i, '');
                            card.description = "";
                            cards.push(card);

                            const pfn = `./docs/static/discourse/${id}.`;
                            if (md && !["png", "jpg", "gif"].some(ext => nodeutil.fileExistsSync(pfn + ext))) {
                                return downloadImageAsync(id, topic, `https://makecode.com/api/${id}/thumb`)
                                    .catch(e => {
                                        // no image
                                        pxt.debug(`no thumb ${e}`);
                                        // use image from forum
                                        if (topic.imageUrl && !/\.svg$/.test(topic.imageUrl))
                                            return downloadImageAsync(id, topic, topic.imageUrl);
                                        else
                                            throw e; // bail out
                                    })
                            }
                            return Promise.resolve();
                        }).catch(e => {
                            pxt.log(`error: project ${id} could not be loaded or no image`);
                        });
                })
        }))
        .then(() => {
            if (md) {
                // inject updated cards
                if (lastCard)
                    cards.push(lastCard);
                cards.forEach(card => delete (card as any).id);
                const newmd = `# ${title || "Community"}

${pxt.gallery.codeCardsToMarkdown(cards)}

`
                nodeutil.writeFileSync(outmd, newmd, { encoding: "utf8" });
            }
            pxt.log(`downloaded ${n} programs (${newcards} new) from tag ${tag}`)
        })

    function downloadImageAsync(id: string, topic: pxt.CodeCard, url: string): Promise<void> {
        return pxt.Util.requestAsync({
            url: `https://makecode.com/api/${id}/thumb`,
            method: "GET",
            responseArrayBuffer: true,
            headers: {
                "accept": "image/*"
            }
        }).then(resp => {
            if (resp.buffer) {
                const m = /image\/(png|jpeg|gif)/.exec(resp.headers["content-type"] as string);
                if (!m) {
                    pxt.log(`unknown image type: ${resp.headers["content-type"]}`);
                } else {
                    let ext = m[1];
                    if (ext == "jpeg") ext = "jpg";
                    const ifn = `/static/discourse/${id}.${ext}`;
                    const localifn = "./docs" + ifn;
                    nodeutil.writeFileSync(localifn, new Buffer(resp.buffer as ArrayBuffer));
                    if (/\.(jpg|png)/.test(ifn))
                        topic.imageUrl = ifn;
                    else if (/\.gif/.test(ifn)) {
                        topic.largeImageUrl = ifn;
                        topic.imageUrl = `/static/discourse/${id}.png`;
                        // render png
                        nodeutil.spawnAsync({
                            cmd: "magick",
                            cwd: `./docs/static/discourse`,
                            args: [`${id}.gif[0]`, `${id}.png`]
                        })
                    }
                }
            }
        });
    }
}

export function formatAsync(parsed: commandParser.ParsedCommand) {
    let inPlace = !!parsed.flags["i"];
    let testMode = !!parsed.flags["t"];

    let fileList = Promise.resolve()
    let fileNames = parsed.args;
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
                        nodeutil.writeFileSync(fn, formatted, { encoding: "utf8" })
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
                    nodeutil.writeFileSync(f, formatted, { encoding: "utf8" })
                    console.log("replaced:", f)
                } else {
                    nodeutil.writeFileSync(fn, formatted, { encoding: "utf8" })
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
        pxsim.initCurrentRuntime = pxsim.initBareRuntime
        let r = new pxsim.Runtime({
            type: "run",
            code: f
        })
        pxsim.Runtime.messagePosted = (msg) => {
            switch (msg.type) {
                case "serial":
                    {
                        const m = <pxsim.SimulatorSerialMessage>msg;
                        let d = m.data;
                        if (typeof d == "string") d = d.replace(/\n$/, "")
                        console.log("serial: ", d);
                    }
                    break;
                case "bulkserial":
                    {
                        const m = <pxsim.SimulatorBulkSerialMessage>msg;
                        let d = m.data;
                        if (Array.isArray(d)) {
                            d.forEach(datum => {
                                if (typeof datum.data == "string") datum.data = datum.data.replace(/\n$/, "")
                                console.log("serial: ", datum.data);
                            })
                        }
                    }
                    break;
                case "i2c":
                    {
                        const m = <pxsim.SimulatorI2CMessage>msg;
                        let d = m.data;
                        if (d)
                            console.log(`i2c: ${d}`);
                    }
                    break;
                default:
                    {
                        const m = <pxsim.SimulatorMessage>msg;
                        console.log(`${m.type}: ${JSON.stringify(m)}`);
                    }
                    break;
            }
        }
        r.errorHandler = (e) => {
            throw e;
        }
        r.run(() => {
            console.log("-- done")
            pxsim.dumpLivePointers();
        })
    }
    return Promise.resolve()
}

function simulatorCoverage(pkgCompileRes: pxtc.CompileResult, pkgOpts: pxtc.CompileOptions) {
    process.chdir("../..")
    if (!nodeutil.existsDirSync(simDir())) return;

    let decls: Map<ts.Symbol> = {}

    if (!pkgOpts.extinfo || pkgOpts.extinfo.functions.length == 0) return

    pxt.debug("checking for missing sim implementations...")

    const sources = ["built/sim.d.ts", "node_modules/pxt-core/built/pxtsim.d.ts"];
    if (fs.existsSync("built/common-sim.d.ts")) {
        sources.push("built/common-sim.d.ts")
    }

    if (!fs.existsSync(sources[0]))
        return // simulator not yet built; will try next time

    let opts: pxtc.CompileOptions = {
        fileSystem: {},
        sourceFiles: sources,
        target: mainPkg.getTargetOptions(),
        ast: true,
        noEmit: true
    }

    opts.target.isNative = false

    for (let fn of opts.sourceFiles) {
        opts.fileSystem[fn] = fs.readFileSync(path.join(nodeutil.targetDir, fn), "utf8")
    }

    let simDeclRes = pxtc.compile(opts)

    // The program we compiled was missing files, so filter out those errors
    reportDiagnostics(simDeclRes.diagnostics.filter(d => d.code != 5012 /* file not found */ && d.code != 2318/* missing global type */));

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
    return Promise.resolve();
}


function testForBuildTargetAsync(useNative: boolean, cachedSHA: string): Promise<TargetPackageInfo> {
    let opts: pxtc.CompileOptions
    let api: pxtc.ApisInfo;

    let sha: string;

    return mainPkg.loadAsync()
        .then(() => {
            mainPkg.ignoreTests = true
            copyCommonFiles();
            setBuildEngine();
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

            sha = pxtc.U.sha256(JSON.stringify(opts.fileSystem) + pxt.appTarget.versions.pxt);
            if (useNative)
                return pxtc.compile(opts)
            else {
                pxt.debug("  skip native build of non-project")

                if (cachedSHA !== sha && !pxt.appTarget.appTheme.disableAPICache) {
                    pxt.log(`Updating cached API info for ${opts.name}`);
                    const res = pxtc.compile(opts);
                    api = pxtc.getApiInfo(res.ast, opts.jres);
                }
                return null
            }
        })
        .then(res => {
            if (res) {
                reportDiagnostics(res.diagnostics);
                if (!res.success) U.userError("Compiler test failed")
                simulatorCoverage(res, opts)

                if (cachedSHA !== sha && !pxt.appTarget.appTheme.disableAPICache) {
                    pxt.log(`Updating cached API info for ${opts.name}`);
                    api = pxtc.getApiInfo(res.ast, opts.jres);
                }
            }
        })
        .then(() => ({ options: opts, api: api, sha }));
}

function simshimAsync() {
    pxt.debug("looking for shim annotations in the simulator.")
    if (pxt.appTarget.noSimShims) {
        return Promise.resolve();
    }
    if (!fs.existsSync(path.join(simDir(), "tsconfig.json"))) {
        pxt.debug("no sim/tsconfig.json; skipping")
        return Promise.resolve();
    }
    let prog = pxtc.plainTscCompileDir(path.resolve(simDir()))
    let shims = pxt.simshim(prog, path.parse)
    let filename = "sims.d.ts"
    for (const s of Object.keys(shims)) {
        let cont = shims[s]
        if (!cont.trim()) continue
        cont = "// Auto-generated from simulator. Do not edit.\n" + cont +
            "\n// Auto-generated. Do not edit. Really.\n"
        let cfgname = "libs/" + s + "/" + pxt.CONFIG_NAME
        let cfg = nodeutil.readPkgConfig("libs/" + s)
        if (cfg.files.indexOf(filename) == -1) {
            if (pxt.appTarget.variants)
                return Promise.resolve() // this is fine - there are native variants that generate shims
            U.userError(U.lf("please add \"{0}\" to {1}", filename, cfgname))
        }
        let fn = "libs/" + s + "/" + filename
        if (fs.readFileSync(fn, "utf8") != cont) {
            pxt.debug(`updating ${fn}`)
            nodeutil.writeFileSync(fn, cont)
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
        .then(opts => {
            let res = pxtc.compile(opts);
            return pxtc.getApiInfo(res.ast, opts.jres, true)
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

    const dir = path.resolve(parsed.args[0] || ".");
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

    return U.promiseMapAllSeries(tests, (ti) => {
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
                        nodeutil.writeFileSync(hexPath, fs.readFileSync(`built/binary.${pxt.appTarget.compile.useUF2 ? "uf2" : "hex"}`))
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
                                nodeutil.writeFileSync(hexPath, hex)
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

    return U.promiseMapAllSeries(testCases, (tc) => {
        let testFailed = (reason: string) => {
            failures.push({ testCase: tc.id, reason });
        };

        const dep: pxt.Map<string> = {};
        tc.dependencies.forEach(d => dep[d] = "*");
        let mainPkg = new pxt.MainPackage(new SnippetHost("package conflict tests", { [pxt.MAIN_TS]: tc.main }, dep));
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
    return U.promiseMapAllSeries(parsed.args, f => {
        const outFile = replaceFileExtension(f, ".blocks")
        return decompileAsyncWorker(f, parsed.flags["dep"] as string)
            .then(result => {
                nodeutil.writeFileSync(outFile, result)
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
        const dep: pxt.Map<string> = {};
        if (dependency)
            dep[dependency] = "*";
        let inPackages = { [pxt.MAIN_TS]: input, [pxt.MAIN_PY]: "" }
        const pkg = new pxt.MainPackage(new SnippetHost("decompile-pkg", inPackages, dep, true));

        pkg.installAllAsync()
            .then(() => pkg.getCompileOptionsAsync())
            .then(opts => {
                opts.ast = true;
                const decompiled = pxtc.decompile(pxtc.getTSProgram(opts), opts, pxt.MAIN_TS);
                if (decompiled.success) {
                    resolve(decompiled.outfiles[pxt.MAIN_BLOCKS]);
                }
                else {
                    reject("Could not decompile " + f + JSON.stringify(decompiled.diagnostics, null, 4));
                }
            });
    });
}

async function testSnippetsAsync(snippets: CodeSnippet[], re?: string, pyStrictSyntaxCheck?: boolean): Promise<void> {
    console.log(`### TESTING ${snippets.length} CodeSnippets`);
    const isLocal = isLocalBuild();
    pxt.github.forceProxy = true; // avoid throttling in CI machines
    let filenameMatch: RegExp;
    try {
        let pattern = re || '.*';
        filenameMatch = new RegExp(pattern);
    }
    catch (e) {
        pxt.log(`pattern could not be compiled as a regular expression, ignoring`);
        filenameMatch = new RegExp('.*')
    }
    snippets = snippets.filter(snippet => filenameMatch.test(snippet.name));
    let ignoreCount = 0
    const ghExtensionCache: pxt.Map<string> = {};
    type CompileResources = {
        host: SnippetHost;
        pkg: pxt.MainPackage;
        opts: pxtc.CompileOptions;
    }

    const compileOptsCache: pxt.Map<pxtc.CompileOptions> = {};
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
        infos.forEach(info => pxt.log(`${f}:(${info.line},${info.column}): ${info.category} ${info.messageText}`));
    }

    // sort such that all snippets with the same packages are next to eachother, then snippet name so it's stable
    // if we add a 'missing package' upgrade rule, it may cause things to become misordered.
    const sortedSnippets = snippets.sort(
        (a, b) => getCompileOptsKey(a.packages).localeCompare(getCompileOptsKey(b.packages)) || a.name.localeCompare(b.name)
    );
    let codeSnippetCount = 0;

    // If completion time becomes an issue here again,
    // we can likely use node worker threads as it is HEAVILY cpu bound.
    // This would require bumping up the minimum node version to 11.7+ / maybe 12+ though.
    await U.promiseMapAllSeries(sortedSnippets, async (snippet: CodeSnippet) => {
        const name = snippet.name;
        const fn = snippet.file || snippet.name;
        pxt.log(`  ${fn} (${snippet.type})`);

        if (snippet.ext == "json") {
            try {
                const codecards = JSON.parse(snippet.code)
                if (!codecards || !Array.isArray(codecards))
                    throw new Error("codecards must be an JSON array")
                addSuccess(fn);
            } catch (e) {
                addFailure(
                    snippet.src,
                    [createKsDiagnostic(`invalid JSON: ${e.message}`, fn)]
                );
            }
            return;
        }

        const isPy = snippet.ext === "py";
        const inFiles: pxt.Map<string> = {
            [pxt.MAIN_TS]: isPy ? "" : snippet.code,
            [pxt.MAIN_PY]: isPy ? snippet.code : "",
            [pxt.MAIN_BLOCKS]: "",
            ...(snippet.extraFiles || {}),
        };

        const { pkg, opts } = await getCompileResources(inFiles, snippet.packages);

        try {
            let resp = tsServiceCompile(opts, true);
            if (isPy) {
                opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME;
                const { ast } = resp;

                const { outfiles, diagnostics, success } = pxtc.service.performOperation("py2ts", { options: opts }) as pxtc.transpile.TranspileResult;
                resp = {
                    outfiles,
                    success,
                    diagnostics,
                    ast,
                    times: {},
                };
            }

            if (resp.outfiles && snippet.file && isLocal) {
                const dir = snippet.file
                    .replace(/\.ts$/, '')
                    .replace(/\.py$/, '');
                nodeutil.mkdirP(dir);
                nodeutil.mkdirP(path.join(dir, "built"));
                Object.keys(resp.outfiles).forEach(outfile => {
                    const ofn = path.join(dir, "built", outfile);
                    pxt.debug(`writing ${ofn}`);
                    nodeutil.writeFileSync(ofn, resp.outfiles[outfile], 'utf8');
                })
                pkg.filesToBePublishedAsync()
                    .then(files => {
                        Object.keys(files).forEach(f => {
                            const fn = path.join(dir, f);
                            pxt.debug(`writing ${fn}`);
                            nodeutil.writeFileSync(fn, files[f], 'utf8');
                        })
                    })
            }

            if (!resp.success || resp.diagnostics?.length) {
                return addFailure(snippet.src, resp.diagnostics);
            }

            if (!/^block/.test(snippet.type)) {
                return addSuccess(fn);
            }

            // ensure decompile to blocks works
            const bresp = pxtc.service.performOperation("decompile", {
                fileName: pxt.MAIN_TS,
                options: opts,
            }) as pxtc.CompileResult;

            if (!bresp.success) {
                return addFailure(snippet.src, bresp.diagnostics);
            }

            // decompile to python
            const decompiled = pxtc.service.performOperation("pydecompile", {
                options: opts,
                fileName: pxt.MAIN_TS,
            }) as pxtc.transpile.TranspileResult;

            const py = decompiled.outfiles[pxt.MAIN_PY];
            const pySuccess = !!py && decompiled.success;
            if (!pySuccess) {
                console.log("ts2py error");
                return addFailure(snippet.src, decompiled.diagnostics);
            }
            opts.fileSystem[pxt.MAIN_PY] = py;

            // py to ts
            const ts1 = opts.fileSystem[pxt.MAIN_TS];
            opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME;
            let ts2Res = pxtc.service.performOperation("py2ts", {
                options: opts,
            }) as pxtc.transpile.TranspileResult;

            let ts2 = ts2Res.outfiles[pxt.MAIN_TS];

            if (!ts2) {
                console.log("py2ts error!");
                console.dir(ts2Res);
                let errs = ts2Res.diagnostics.map(pxtc.getDiagnosticString).join();
                if (errs)
                    console.log(errs);
                return addFailure(snippet.src, ts2Res.diagnostics);
            }

            if (pyStrictSyntaxCheck) {
                let cmp1 = pyComparisonString(ts1);
                let cmp2 = pyComparisonString(ts2);
                if (cmp1 != cmp2) {
                    console.log(`Mismatch. Original:`);
                    console.log(cmp1);
                    console.log("decompiled->compiled:");
                    console.log(cmp2);
                    console.log("TS mismatch :/");
                    // TODO: generate more helpful diags
                    return addFailure(snippet.src, []);
                } else {
                    console.log("TS same :)");
                }
            }

            // NOTE: neither of these decompile steps checks that the resulting code is correct or that
            // when the code is compiled back to ts it'll behave the same. This could be validated in
            // the future.

            return addSuccess(name)
        } catch (e) {
            console.dir(e);
            addFailure(
                snippet.src,
                [createKsDiagnostic(e.message, fn)]
            );
        }
    });

    pxt.log(`${successes.length}/${successes.length + failures.length} snippets compiled to blocks and python (and back), ${failures.length} failed`);
    if (ignoreCount > 0) {
        pxt.log(`Skipped ${ignoreCount} snippets`);
    }
    if (failures.length > 0) {
        const msg = `${failures.length} snippets not compiling in the docs`
        pxt.log(`${msg}:`);

        failures.forEach(failure => {
            pxt.log(`-- in ${failure.filename}:`)
            failure.diagnostics.forEach(diag => {
                pxt.log(`    ${pxtc.getDiagnosticString(diag)}`);
            });
        });

        if (!pxt.appTarget.ignoreDocsErrors) U.userError(msg);
    }

    function tsServiceCompile(options: pxtc.CompileOptions, retryOnError?: boolean): pxtc.CompileResult {
        let resp = tryCompile(options);
        if (retryOnError && (!resp.success || resp.diagnostics.length)) {
            pxt.log("Compile failed; resetting incremental compile.");
            cleanService();
            resp = tryCompile(options);
        }
        return resp as pxtc.CompileResult;

        function tryCompile(options: pxtc.CompileOptions): pxtc.CompileResult {
            const resp = pxtc.service.performOperation("compile", { options }) as pxtc.CompileResult;
            if ((resp as any).errorMessage) {
                resp.success = false;
                if (!resp.diagnostics) {
                    resp.diagnostics = [];
                }
                resp.diagnostics.push(createKsDiagnostic((resp as any).errorMessage));
            }
            return resp;
        }
    }

    async function getCompileResources(snippetFiles: pxt.Map<string>, pkgs: pxt.Map<string>): Promise<CompileResources> {
        const host = new SnippetHost("codesnippet", snippetFiles, pkgs);
        host.cache = ghExtensionCache;

        const pkg = new pxt.MainPackage(host);
        await pkg.installAllAsync();

        const key = getCompileOptsKey(pkg.dependencies());
        if (!compileOptsCache[key]) {
            const targ = pkg.getTargetOptions();
            targ.isNative = false;
            const newOpts = await pkg.getCompileOptionsAsync(targ);
            newOpts.ast = true;
            // TODO: this being necessary implies a bug somewhere in the incremental compile
            // that is resulting in erroneous compile errors.
            newOpts.clearIncrBuildAndRetryOnError = true;
            newOpts.errorOnGreyBlocks = true;
            newOpts.snippetMode = false;
            compileOptsCache[key] = newOpts;
        }

        const inFileNames = pkg.getFiles();
        const opts = compileOptsCache[key];
        opts.target.preferredEditor = pxt.JAVASCRIPT_PROJECT_NAME;
        opts.sourceFiles = inFileNames.concat(opts.sourceFiles.filter(f => pxtc.isPxtModulesFilename(f)));

        for (const f of inFileNames) {
            opts.fileSystem[f] = pkg.readFile(f);
        }

        opts.jres = pkg.getJRes();

        return {
            host,
            pkg,
            opts
        };
    }

    function cleanService() {
        pxtc.service.performOperation("reset", {});
        codeSnippetCount = 0;
    }

    function createKsDiagnostic(message: string, fn = "?", code = 4242) {
        return {
            code,
            category: ts.DiagnosticCategory.Error,
            messageText: message,
            fileName: fn,
            start: 1,
            line: 1,
            length: 1,
            column: 1
        }
    }

    function getCompileOptsKey(pkgs: pxt.Map<string>) {
        const keys = Object.keys(pkgs).sort();
        return keys.reduce(
            (prv, curr) => `${prv},${curr}:${pkgs[curr]}`,
            ""
        );
    }

    function pyComparisonString(s: string): string {
        return s.split("\n")
            // ignore function names e.g. function foobar() {} => function () {}
            .map(l => l.replace(/function(.+)\(/g, "function ("))
            // ignore type annotations on assignment statements (these tend to get erased) let foo: number = 7 => let foo = 7
            .map(l => l.replace(/(.+):[^=,)]+([=,)])/g, (m, start, op) => start + op))
            // ignore whitespace, semi-colons
            .map(l => l.replace(/[\s;]/mg, ""))
            .filter(l => l)
            .join("");
    }
}

function setBuildEngine() {
    const cs = pxt.appTarget.compileService
    if (cs) {
        const engine = cs.buildEngine || "yotta"
        build.setThisBuild(build.buildEngines[engine]);
        if (!build.thisBuild)
            U.userError("cannot find build engine: " + engine)
    }
}

function prepBuildOptionsAsync(mode: BuildOption, quick = false, ignoreTests = false) {
    ensurePkgDir();
    mainPkg.ignoreTests = ignoreTests;
    return mainPkg.loadAsync()
        .then(() => {
            if (!quick) {
                build.buildDalConst(build.thisBuild, mainPkg);
                copyCommonFiles();
                setBuildEngine();
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

            if (pxt.appTarget.compile.postProcessSymbols && (mode == BuildOption.Deploy || mode == BuildOption.JustBuild)) {
                opts.computeUsedSymbols = true
                opts.ast = true
            }

            if (opts.target.preferredEditor == pxt.PYTHON_PROJECT_NAME) {
                pxt.debug("pre-compiling apisInfo for Python")
                pxt.prepPythonOptions(opts)
                if (process.env["PXT_SAVE_APISINFO"])
                    fs.writeFileSync("built/apisinfo.json", nodeutil.stringify(opts.apisInfo))
                pxt.debug("done pre-compiling apisInfo for Python")
            }

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
    ignoreTests?: boolean;

    // docs
    locs?: boolean;
    docs?: boolean;
    fileFilter?: string;
    createOnly?: boolean;
}

function gdbAsync(c: commandParser.ParsedCommand) {
    ensurePkgDir()
    setBuildEngine();
    return mainPkg.loadAsync()
        .then(() => {
            setBuildEngine();
            return gdb.startAsync(c.args)
        })
}

function hwAsync(c: commandParser.ParsedCommand) {
    ensurePkgDir()
    return mainPkg.loadAsync()
        .then(() => {
            setBuildEngine()
            return gdb.hwAsync(c.args)
        })
}

function dumplogAsync(c: commandParser.ParsedCommand) {
    ensurePkgDir()
    return mainPkg.loadAsync()
        .then(() => {
            setBuildEngine()
            return gdb.dumplogAsync()
        })
}

function dumpheapAsync(c: commandParser.ParsedCommand) {
    ensurePkgDir()
    return mainPkg.loadAsync()
        .then(() => gdb.dumpheapAsync(c.args[0]))
}

function dumpmemAsync(c: commandParser.ParsedCommand) {
    ensurePkgDir()
    return mainPkg.loadAsync()
        .then(() => gdb.dumpMemAsync(c.args))
}

async function buildDalDTSAsync(c: commandParser.ParsedCommand) {
    forceLocalBuild = true;
    forceBuild = true; // make sure we actually build
    forceCloudBuild = false;
    const clean = !!c.flags["clean"];

    function prepAsync() {
        let p = Promise.resolve();
        if (clean)
            p = p.then(() => cleanAsync())

        p = p.then(() => buildCoreAsync({ mode: BuildOption.JustBuild }))
            .then(() => { });
        return p;
    }

    if (fs.existsSync("pxtarget.json")) {
        pxt.log(`generating dal.d.ts for packages`)
        return rebundleAsync()
            .then(() => forEachBundledPkgAsync((f, dir) => {
                return f.loadAsync()
                    .then(() => {
                        if (f.config.dalDTS && f.config.dalDTS.corePackage) {
                            console.log(`  ${dir}`)
                            return prepAsync()
                                .then(() => build.buildDalConst(build.thisBuild, f, true, true));
                        }
                        return Promise.resolve();
                    })
            }));
    } else {
        ensurePkgDir()
        await mainPkg.loadAsync()
        setBuildEngine();
        build.buildDalConst(build.thisBuild, mainPkg, true, true)
        await prepAsync()
        build.buildDalConst(build.thisBuild, mainPkg, true, true)
    }
}

function buildCoreAsync(buildOpts: BuildCoreOptions): Promise<pxtc.CompileResult> {
    let compileOptions: pxtc.CompileOptions;
    let compileResult: pxtc.CompileResult;
    ensurePkgDir();
    pxt.log(`building ${process.cwd()}`)
    const config = nodeutil.readPkgConfig(process.cwd());
    return prepBuildOptionsAsync(buildOpts.mode, false, buildOpts.ignoreTests)
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
                    pxt.debug(`package written to ${"built/" + fn}`);
                }
                else {
                    mainPkg.host().writeFile(mainPkg, "built/debug/" + fn, c);
                    pxt.debug(`package written to ${"built/debug/" + fn}`);
                }
            });

            const shouldExit = !res.success && buildOpts.mode != BuildOption.GenDocs
            if (shouldExit || !config.partial)
                reportDiagnostics(res.diagnostics);
            if (shouldExit) {
                process.exit(1)
            }

            if (buildOpts.mode === BuildOption.DebugSim) {
                mainPkg.host().writeFile(mainPkg, "built/debug/debugInfo.json", JSON.stringify({
                    usedParts: pxtc.computeUsedParts(res, "ignorebuiltin"),
                    usedArguments: res.usedArguments,
                    breakpoints: res.breakpoints
                }));
            }

            if (res.usedSymbols && compileOptions.computeUsedSymbols) {
                const apiInfo = pxtc.getApiInfo(res.ast, compileOptions.jres)
                for (let k of Object.keys(res.usedSymbols)) {
                    res.usedSymbols[k] = apiInfo.byQName[k] || null
                }
            }

            if (pxt.appTarget.compile.switches.time)
                console.log(compileResult.times)

            switch (buildOpts.mode) {
                case BuildOption.GenDocs:
                    const apiInfo = pxtc.getApiInfo(res.ast, compileOptions.jres)
                    // keeps apis from this module only
                    for (const infok in apiInfo.byQName) {
                        const info = apiInfo.byQName[infok];
                        if (info.pkg &&
                            info.pkg != mainPkg.config.name) delete apiInfo.byQName[infok];
                    }
                    // Look for and read pxt snippets file
                    const pxtsnippet = pxt.Util.jsonTryParse(mainPkg.readFile('pxtsnippets.json')) as pxt.SnippetConfig[];
                    pxt.debug(`generating api docs (${Object.keys(apiInfo.byQName).length})`);
                    const md = pxtc.genDocs(mainPkg.config.name, apiInfo, {
                        package: mainPkg.config.name != pxt.appTarget.corepkg && !mainPkg.config.core,
                        locs: buildOpts.locs,
                        docs: buildOpts.docs,
                        pxtsnippet: pxtsnippet,
                    })
                    if (buildOpts.fileFilter) {
                        const filterRx = new RegExp(buildOpts.fileFilter, "i");
                        Object.keys(md).filter(fn => !filterRx.test(fn)).forEach(fn => delete md[fn]);
                    }
                    for (const fn in md) {
                        const folder = /strings.json$/.test(fn) ? "_locales/" : /\.md$/.test(fn) ? "../../docs/" : "built/";
                        const ffn = path.join(folder, fn);
                        if (!buildOpts.createOnly || !fs.existsSync(ffn)) {
                            nodeutil.mkdirP(path.dirname(ffn));
                            mainPkg.host().writeFile(mainPkg, ffn, md[fn])
                            pxt.debug(`generated ${ffn}; size=${md[fn].length}`)
                        }
                    }
                    return null
                case BuildOption.Deploy:
                    if (pxt.commands.hasDeployFn())
                        return pxt.commands.deployAsync(res)
                    else {
                        pxt.log("no deploy functionality defined by this target")
                        return null;
                    }
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

export async function staticpkgAsync(parsed: commandParser.ParsedCommand) {
    const route = parsed.flags["route"] as string || "/";
    const ghpages = parsed.flags["githubpages"];
    const builtPackaged = parsed.flags["output"] as string || "built/packaged";
    const minify = !!parsed.flags["minify"];
    const bump = !!parsed.flags["bump"];
    const disableAppCache = !!parsed.flags["no-appcache"];
    const locsSrc = parsed.flags["locs-src"] as string;
    const locs = !!locsSrc || !!parsed.flags["locs"];
    if (parsed.flags["cloud"]) forceCloudBuild = true;
    if (minify && process.env["PXT_ENV"] === undefined) {
        process.env["PXT_ENV"] = "production";
    }

    pxt.log(`packaging editor to ${builtPackaged}`)

    await rimrafAsync(builtPackaged, {});

    if (bump) {
        await bumpAsync();
    }

    if (locs) {
        await internalGenDocsAsync(false, true);
        if (locsSrc) {
            const languages = pxt.appTarget?.appTheme?.availableLocales
                .filter(langId => nodeutil.existsDirSync(path.join(locsSrc, langId)));

            await crowdin.buildAllTranslationsAsync(async (fileName: string) => {
                const output: pxt.Map<pxt.Map<string>> = {};

                for (const langId of languages) {
                    const srcFilePath = path.join(locsSrc, langId, fileName);
                    if (nodeutil.fileExistsSync(srcFilePath)) {
                        output[langId] = pxt.Util.jsonTryParse(fs.readFileSync(srcFilePath, { encoding: "utf8" }));
                    }
                }

                return output;
            });
        } else {
            await crowdin.downloadTargetTranslationsAsync();
        }
    }

    await internalBuildTargetAsync({ packaged: true });

    if (ghpages) {
        await ghpPushAsync(builtPackaged, minify)
    } else {
        await internalStaticPkgAsync(builtPackaged, route, minify, disableAppCache);
    }
}

function internalStaticPkgAsync(builtPackaged: string, label: string, minify: boolean, noAppCache?: boolean) {
    const pref = path.resolve(builtPackaged);
    const localDir = !label ? "./" : `${U.startsWith(label, ".") || U.startsWith(label, "/") ? "" : "/"}${label}${U.endsWith(label, "/") ? "" : "/"}`;
    return uploadCoreAsync({
        label: label || "main",
        pkgversion: "0.0.0",
        fileList: pxtFileList("node_modules/pxt-core/")
            .concat(targetFileList())
            .concat(["targetconfig.json"])
            .concat(nodeutil.allFiles("built/hexcache")),
        localDir,
        target: (pxt.appTarget.id || "unknownstatic"),
        builtPackaged,
        minify,
        noAppCache
    }).then(() => renderDocs(builtPackaged, localDir))
}

export function cleanAsync(parsed?: commandParser.ParsedCommand) {
    pxt.log('cleaning built folders')
    return rimrafAsync("built", {})
        .then(() => rimrafAsync("temp", {}))
        .then(() => rimrafAsync("libs/**/built", {}))
        .then(() => rimrafAsync("projects/**/built", {}))
        .then(() => { });
}

export function cleanGenAsync(parsed: commandParser.ParsedCommand) {
    pxt.log('cleaning generated files')
    return Promise.resolve()
        .then(() => rimrafAsync("libs/**/enums.d.ts", {}))
        .then(() => rimrafAsync("libs/**/shims.d.ts", {}))
        .then(() => rimrafAsync("libs/**/_locales", {}))
        .then(() => { });
}

export function npmInstallNativeAsync() {
    pxt.log('installing npm native dependencies')
    const deps = nodeutil.lazyDependencies();
    const mods = Object.keys(deps).map(k => `${k}@${deps[k]}`);
    function nextAsync() {
        const mod = mods.pop();
        if (!mod) return Promise.resolve();

        return nodeutil.runNpmAsync("install", mod);
    }
    return nextAsync();
}

interface PNGImage {
    width: number;
    height: number;
    depth: number; // 8
    colorType: number; // 6
    data: Buffer;
}

interface SpriteGlobalMeta {
    star: pxt.JRes;
    basename?: string;
    width?: number;
    height?: number;
    blockIdentity: string;
    creator: string;
    tags?: string;
    standaloneSprites?: string[];
}

interface SpriteInfo {
    width?: number;
    height?: number;
    xSpacing?: number;
    ySpacing?: number;
    tags?: string;
    frames?: string[];
    blockIdentity?: string;
    animation?: boolean,
    animations?: AnimationInfo[];
}

interface AnimationInfo {
    frames: number[];
    flippedHorizontal: boolean;
    name: string;
}



export function buildJResSpritesAsync(parsed: commandParser.ParsedCommand) {
    ensurePkgDir()
    return loadPkgAsync()
        .then(() => buildJResSpritesCoreAsync(parsed))
}

function buildJResSpritesCoreAsync(parsed: commandParser.ParsedCommand) {
    const dir = parsed.args[0];

    if (!dir)
        U.userError("missing directory argument");
    if (!nodeutil.existsDirSync(dir))
        U.userError(`directory '${dir}' does not exist`);

    const promises = fs.readdirSync(dir)
        .map(filename => path.join(dir, filename))
        .filter(filename => nodeutil.existsDirSync(filename))
        .concat([dir])
        .filter(filename => nodeutil.fileExistsSync(path.join(filename, "meta.json")))
        .map(buildJResSpritesDirectoryAsync);

    return Promise.all(promises)
        .then(() => { })
}

function buildJResSpritesDirectoryAsync(dir: string) {
    const PNG: any = require("pngjs").PNG;

    // create meta.json file if needed
    const metaInfoPath = path.join(dir, "meta.json");
    if (!fs.existsSync(metaInfoPath)) {
        pxt.log(`${metaInfoPath} not found, creating new one`);
        fs.writeFileSync(metaInfoPath, JSON.stringify({
            "width": 16,
            "height": 16,
            "blockIdentity": "image.__imagePicker",
            "creator": "image.ofBuffer",
            "star": {
                "namespace": `sprites.${dir.toLowerCase()}`,
                "mimeType": "image/x-mkcd-f4"
            }
        }, null, 4));
    }

    const metaInfo: SpriteGlobalMeta = nodeutil.readJson(metaInfoPath)
    const jresources: pxt.Map<pxt.JRes> = {}
    const star = metaInfo.star

    jresources["*"] = metaInfo.star

    let bpp = 4

    if (/-f1/.test(star.mimeType))
        bpp = 1

    if (!metaInfo.star)
        U.userError(`invalid meta.json`)

    if (!metaInfo.basename) metaInfo.basename = star.namespace

    if (!metaInfo.basename)
        U.userError(`invalid meta.json`)

    star.dataEncoding = star.dataEncoding || "base64"

    if (!pxt.appTarget.runtime || !pxt.appTarget.runtime.palette)
        U.userError(`palette not defined in pxt.json`)

    const palette = pxt.appTarget.runtime.palette.map(s => {
        let v = parseInt(s.replace(/#/, ""), 16)
        return [(v >> 16) & 0xff, (v >> 8) & 0xff, (v >> 0) & 0xff]
    })

    let ts = `namespace ${metaInfo.star.namespace} {\n`

    for (let fn of nodeutil.allFiles(dir, { maxDepth: 1 })) {
        fn = fn.replace(/\\/g, "/")
        let m = /(.*\/)(.*)\.png$/i.exec(fn)
        if (!m) continue
        let bn = m[2]
        let jn = m[1] + m[2] + ".json"
        bn = bn.replace(/-1bpp/, "").replace(/[^\w]/g, "_")
        const standalone = metaInfo.standaloneSprites && metaInfo.standaloneSprites.indexOf(bn) !== -1;
        processImage(bn, fn, jn, standalone)
    }

    ts += "}\n"

    pxt.log(`save ${metaInfo.basename}.jres and .ts`)
    nodeutil.writeFileSync(metaInfo.basename + ".jres", nodeutil.stringify(jresources));
    nodeutil.writeFileSync(metaInfo.basename + ".ts", ts);

    return Promise.resolve()

    // use geometric distance on colors
    function scale(v: number) {
        return v * v
    }

    function closestColor(buf: Buffer, pix: number, alpha = true) {
        if (alpha && buf[pix + 3] < 100)
            return 0 // transparent
        let mindelta = 0
        let idx = -1
        for (let i = alpha ? 1 : 0; i < palette.length; ++i) {
            let delta = scale(palette[i][0] - buf[pix + 0]) + scale(palette[i][1] - buf[pix + 1]) + scale(palette[i][2] - buf[pix + 2])
            if (idx < 0 || delta < mindelta) {
                idx = i
                mindelta = delta
            }
        }
        return idx
    }

    function processImage(basename: string, pngName: string, jsonName: string, standalone: boolean) {
        let info: SpriteInfo = {}
        if (nodeutil.fileExistsSync(jsonName))
            info = nodeutil.readJson(jsonName)
        if (!info.width) info.width = metaInfo.width
        if (!info.height) info.height = metaInfo.height

        let sheet = PNG.sync.read(fs.readFileSync(pngName)) as PNGImage
        let imgIdx = 0

        // add alpha channel
        if (sheet.colorType == 0) {
            sheet.colorType = 6
            sheet.depth = 8
            for (let i = 0; i < sheet.data.length; i += 4) {
                if (closestColor(sheet.data, i, false) == 0)
                    sheet.data[i + 3] = 0x00
            }
        }

        if (sheet.colorType != 6)
            U.userError(`only RGBA png images supported`)
        if (sheet.depth != 8)
            U.userError(`only 8 bit per channel png images supported`)
        if (sheet.width > 255 || sheet.height > 255)
            U.userError(`PNG image too big`)

        if (standalone) {
            // Image contains a single sprite
            info.width = sheet.width;
            info.height = sheet.height;
        }
        else {
            if (!info.width || info.width > sheet.width) info.width = sheet.width
            if (!info.height || info.height > sheet.height) info.height = sheet.height
        }

        if (!info.xSpacing) info.xSpacing = 0;
        if (!info.ySpacing) info.ySpacing = 0;

        let nx = (sheet.width / info.width) | 0
        let ny = (sheet.height / info.height) | 0
        let numSprites = nx * ny
        const frameQNames: string[] = [];

        for (let y = 0; y + info.height - 1 < sheet.height; y += info.height + info.ySpacing) {
            for (let x = 0; x + info.width - 1 < sheet.width; x += info.width + info.xSpacing) {
                if (info.frames && imgIdx >= info.frames.length) return;

                let img = U.flatClone(sheet)
                img.data = Buffer.alloc(info.width * info.height * 4)
                img.width = info.width
                img.height = info.height
                for (let i = 0; i < info.height; ++i) {
                    let src = x * 4 + (y + i) * sheet.width * 4
                    sheet.data.copy(img.data, i * info.width * 4, src, src + info.width * 4)
                }
                let key = basename + imgIdx
                if (info.frames && info.frames[imgIdx]) {
                    let suff = info.frames[imgIdx]
                    if (/^[a-z]/.test(suff))
                        suff = "_" + suff
                    key = basename + suff
                } else if (numSprites == 1) {
                    key = basename
                }

                let hasNonTransparent = false;
                let hex = pxtc.f4EncodeImg(img.width, img.height, bpp, (x, y) => {
                    const col = closestColor(img.data, 4 * (x + y * img.width));
                    if (col)
                        hasNonTransparent = true;
                    return col;
                });

                if (!hasNonTransparent)
                    continue;

                let data = Buffer.from(hex, "hex").toString(star.dataEncoding)

                let storeIcon = false

                // These are space-separated lists of tags
                let tags = `${info.tags || ""} ${metaInfo.tags || ""}`.split(" ").filter(t => !!t);

                const isTile = tags.some(t => t === "tile" || t === "?tile");

                if (storeIcon || isTile) {
                    let jres = jresources[key]
                    if (!jres) {
                        jres = jresources[key] = {} as any
                    }
                    jres.data = data

                    if (storeIcon) {
                        jres.icon = 'data:image/png;base64,' + PNG.sync.write(img).toString('base64');
                    }
                    if (isTile) {
                        jres.tilemapTile = true;
                    }
                } else {
                    // use the short form
                    jresources[key] = data as any
                }

                ts += `    //% fixedInstance jres blockIdentity=${info.blockIdentity || metaInfo.blockIdentity}\n`
                if (tags.length) {
                    ts += `    //% tags="${tags.join(" ")}"\n`;
                }
                ts += `    export const ${key} = ${metaInfo.creator}(hex\`\`);\n`

                pxt.log(`add ${key}; ${JSON.stringify(jresources[key]).length} bytes`)
                frameQNames.push((metaInfo.star.namespace) + "." + key);

                imgIdx++
            }
        }

        if (info.animation) {
            processAnimation(basename, frameQNames.map((name, i) => i));
        }

        if (info.animations) {
            for (const animation of info.animations) {
                processAnimation(animation.name, animation.frames, animation.flippedHorizontal);
            }
        }

        function processAnimation(name: string, frames: number[], flippedHorizontal = false) {
            jresources[name] = {
                mimeType: "application/mkcd-animation",
                dataEncoding: "json",
                data: JSON.stringify({
                    frames: frames.map(frameIndex => frameQNames[frameIndex]),
                    flippedHorizontal
                })
            } as any
        }
    }
}

export function buildJResAsync(parsed: commandParser.ParsedCommand) {
    ensurePkgDir();
    nodeutil.allFiles(".")
        .filter(f => /\.jres$/i.test(f))
        .forEach(f => {
            pxt.log(`expanding jres resources in ${f}`);
            const jresources = nodeutil.readJson(f) as pxt.Map<pxt.JRes>;
            const oldjr = nodeutil.stringify(jresources);
            const dir = path.join('jres', path.basename(f, '.jres'));
            // update existing fields
            const star = jresources["*"];
            if (!star.dataEncoding) star.dataEncoding = 'base64';
            Object.keys(jresources).filter(k => k != "*").forEach(k => {
                const jres = jresources[k];
                const mime = jres.mimeType || star.mimeType;
                pxt.log(`expanding ${k}`);
                // try to slurp icon
                const iconn = path.join(dir, k + '-icon.png');
                pxt.debug(`looking for ${iconn}`)
                if (nodeutil.fileExistsSync(iconn)) {
                    pxt.log(`importing ${iconn}`);
                    jres.icon = 'data:image/png;base64,' + fs.readFileSync(iconn, 'base64');
                }
                // try to find file
                if (mime) {
                    const ext = mime.replace(/^.*\//, '');
                    let fn = path.join(dir, k + '-data.' + ext);
                    pxt.debug(`looking for ${fn}`)
                    if (nodeutil.fileExistsSync(fn)) {
                        pxt.log(`importing ${fn}`);
                        jres.data = fs.readFileSync(fn, 'base64');
                    } else {
                        let fn = path.join(dir, k + '.' + ext);
                        pxt.debug(`looking for ${fn}`)
                        if (nodeutil.fileExistsSync(fn)) {
                            pxt.log(`importing ${fn}`);
                            jres.data = fs.readFileSync(fn, 'base64');
                        }
                    }
                }
            })

            const newjr = nodeutil.stringify(jresources);
            if (oldjr != newjr) {
                pxt.log(`updating ${f}`)
                nodeutil.writeFileSync(f, newjr);
            }
        })
    return Promise.resolve();
}

export function buildAsync(parsed: commandParser.ParsedCommand) {
    let mode = BuildOption.JustBuild;
    if (parsed && parsed.flags["debug"])
        mode = BuildOption.DebugSim;
    else if (parsed && parsed.flags["deploy"])
        mode = BuildOption.Deploy;
    const clean = parsed && parsed.flags["clean"];
    const ignoreTests = parsed && !!parsed.flags["ignoreTests"];
    const install = parsed && !!parsed.flags["install"];

    return (clean ? cleanAsync() : Promise.resolve())
        .then(() => install ? installAsync(parsed) : Promise.resolve())
        .then(() => {
            parseBuildInfo(parsed);
            return buildCoreAsync({ mode, ignoreTests })
        }).then((compileOpts) => { });
}

export async function buildShareSimJsAsync(parsed: commandParser.ParsedCommand) {
    const id = parsed.args[0];
    console.log(`Building sim js for ${id}`);
    const cwd = process.cwd();
    const builtFolder = path.join("temp", id);
    nodeutil.mkdirP(builtFolder);
    process.chdir(builtFolder);

    const mainPkg = new pxt.MainPackage(new Host());
    mainPkg._verspec = `pub:${id}`;

    await mainPkg.host().downloadPackageAsync(mainPkg);
    await mainPkg.installAllAsync();
    const opts = await mainPkg.getCompileOptionsAsync();
    const compileResult = pxtc.compile(opts);
    if (compileResult.diagnostics && compileResult.diagnostics.length > 0) {
        compileResult.diagnostics.forEach(diag => {
            console.error(diag.messageText)
        })
        throw new Error(`Failed to compile share id: ${id}`);
    }

    const builtJsInfo = pxtc.buildSimJsInfo(compileResult);

    const outdir = parsed.flags["output"] as string || path.join(cwd, "docs", "static", "builtjs");
    nodeutil.mkdirP(outdir);
    const outputLocation = path.join(outdir, `${id}v${pxt.appTarget.versions.target}.json`);
    fs.writeFileSync(
        outputLocation,
        JSON.stringify(builtJsInfo)
    );

    process.chdir(cwd);
    console.log(`saved prebuilt ${id} to ${outputLocation}`);
}

export function gendocsAsync(parsed: commandParser.ParsedCommand) {
    const docs = !!parsed.flags["docs"];
    const locs = !!parsed.flags["locs"];
    const fileFilter = parsed.flags["files"] as string;
    const createOnly = !!parsed.flags["create"];
    return internalGenDocsAsync(docs, locs, fileFilter, createOnly);
}

function internalGenDocsAsync(docs: boolean, locs: boolean, fileFilter?: string, createOnly?: boolean) {
    const buildAsync = () => buildCoreAsync({
        mode: BuildOption.GenDocs,
        docs,
        locs,
        fileFilter,
        createOnly,
        ignoreTests: true
    }).then((compileOpts) => { });

    // from target location?
    if (fs.existsSync("pxtarget.json") && !!readJson("pxtarget.json").appTheme)
        return forEachBundledPkgAsync((pkg, dirname) => {
            pxt.debug(`building docs in ${dirname}`);
            return buildAsync();
        });
    else // from a project build
        return buildAsync();
}

export function consoleAsync(parsed?: commandParser.ParsedCommand): Promise<void> {
    pxt.log(`monitoring console.log`)
    if (!hid.isInstalled()) {
        pxt.log(`console support not installed, did you run "pxt npminstallnative"?`)
        return Promise.resolve();
    }
    return hid.serialAsync();
}

export function deployAsync(parsed?: commandParser.ParsedCommand) {
    parseBuildInfo(parsed);
    const serial = parsed && !!parsed.flags["console"];
    return buildCoreAsync({ mode: BuildOption.Deploy })
        .then((compileOpts) => serial ? consoleAsync(parsed) : Promise.resolve())
}

export function runAsync(parsed?: commandParser.ParsedCommand) {
    parseBuildInfo(parsed);
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

export function extractAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    const vscode = !!parsed.flags["code"];
    const out = parsed.flags["code"] || '.';
    const filename = parsed.args[0];
    return extractAsyncInternal(filename, out as string, vscode)
        .then(() => { });
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
        if (/\.json$/i.test(filename)) pxt.log(`compile log: ${filename.replace(/\.json$/i, ".log")}`)
        return U.requestAsync({ url: filename, allowHttpErrors: !!fn2 })
            .then(resp => {
                if (fn2 && (resp.statusCode != 200 || /html/.test(resp.headers["content-type"] as string))) {
                    pxt.log(`Trying also ${fn2}...`)
                    return U.requestAsync({ url: fn2 })
                } return resp
            })
            .then(resp => resp.buffer)
    } else
        return readFileAsync(filename)
}

function extractAsyncInternal(filename: string, out: string, vscode: boolean): Promise<string[]> {
    if (filename && nodeutil.existsDirSync(filename)) {
        pxt.log(`extracting folder ${filename}`);
        return Promise.all(fs.readdirSync(filename)
            .filter(f => /\.(hex|uf2)/.test(f))
            .map(f => extractAsyncInternal(path.join(filename, f), out, vscode)))
            .then(() => [filename]);
    }

    return fetchTextAsync(filename)
        .then(buf => extractBufferAsync(buf, out))
        .then(dirs => {
            if (dirs && vscode) {
                pxt.debug('launching code...')
                dirs.forEach(dir => openVsCode(dir));
            }
            return dirs;
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
                pxt.debug("Detected .hex file.")
                return unpackHexAsync(buf)
            } else if (str[0] == "U") {
                pxt.debug("Detected .uf2 file.")
                return unpackHexAsync(buf)
            } else if (str[0] == "{") {  // JSON
                pxt.debug("Detected .json file.")
                return JSON.parse(str)
            } else if (buf[0] == 0x5d) { // JSZ
                pxt.debug("Detected .jsz/.pxt file.")
                return pxt.lzmaDecompressAsync(buf as any)
                    .then(str => JSON.parse(str))
            } else
                return Promise.resolve(null)
        })
        .then(json => {
            if (!json) {
                pxt.log("Couldn't extract.")
                return undefined;
            }
            if (json.meta && json.source) {
                json = typeof json.source == "string" ? JSON.parse(json.source) : json.source
            }
            if (Array.isArray(json.scripts)) {
                pxt.debug("Legacy TD workspace.")
                json.projects = json.scripts.map((scr: any) => ({
                    name: scr.header.name,
                    files: oneFile(scr.source, scr.header.editor)
                }))
                delete json.scripts
            }

            if (json[pxt.CONFIG_NAME]) {
                pxt.debug("Raw JSON files.")
                let cfg: pxt.PackageConfig = pxt.Package.parseAndValidConfig(json[pxt.CONFIG_NAME])
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
                pxt.log("No projects found.")
                return undefined;
            }
            const dirs = writeProjects(prjs, outDir)
            return dirs;
        })
}

export function hexdumpAsync(c: commandParser.ParsedCommand) {
    let filename = c.args[0]
    let buf = fs.readFileSync(filename)
    if (/^UF2\n/.test(buf.slice(0, 4).toString("utf8"))) {
        for (let b of pxtc.UF2.parseFile(buf)) {
            console.log(`UF2 Block: ${b.blockNo}/${b.numBlocks} family:${b.familyId.toString(16)} flags:${b.flags.toString(16)}\n` +
                pxtc.hexDump(b.data, b.targetAddr))
        }
        return Promise.resolve()
    }
    console.log("Binary file assumed.")
    console.log(pxtc.hexDump(buf))
    return Promise.resolve()
}

export function hex2uf2Async(c: commandParser.ParsedCommand) {
    let filename = c.args[0]
    let buf = fs.readFileSync(filename, "utf8").split(/\r?\n/)
    if (buf[0][0] != ':') {
        console.log("Not a hex file: " + filename)
    } else {
        let f = pxtc.UF2.newBlockFile()
        pxtc.UF2.writeHex(f, buf)
        let uf2buf = Buffer.from(pxtc.UF2.serializeFile(f), "binary")
        let uf2fn = filename.replace(/(\.hex)?$/i, ".uf2")
        nodeutil.writeFileSync(uf2fn, uf2buf)
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
        const dirname = prj.name.replace(/[^A-Za-z0-9_]/g, "-")
        const fdir = path.join(outDir, dirname);
        nodeutil.mkdirP(fdir);
        for (let fn of Object.keys(prj.files)) {
            fn = fn.replace(/[\/]/g, "-")
            const fullname = path.join(fdir, fn)
            nodeutil.mkdirP(path.dirname(fullname));
            nodeutil.writeFileSync(fullname, prj.files[fn])
        }
        // add default files if not present
        const files = pxt.template.packageFiles(prj.name);
        pxt.template.packageFilesFixup(files);
        for (let fn in files) {
            if (prj.files[fn]) continue;
            const fullname = path.join(fdir, fn)
            nodeutil.mkdirP(path.dirname(fullname));
            const src = files[fn];
            nodeutil.writeFileSync(fullname, src)
        }

        // start installing in the background
        child_process.exec(`pxt install`, { cwd: dirname });

        dirs.push(dirname);
    }
    return dirs;
}

function cherryPickAsync(parsed: commandParser.ParsedCommand) {
    const commit = parsed.args[0];
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
        true,
        parsed.flags["re"] as string,
        !!parsed.flags["fix"],
        !!parsed.flags["pycheck"]
    )
}

function checkFileSize(files: string[]): number {
    if (!pxt.appTarget.cloud)
        return 0;

    pxt.log('checking for file sizes');
    const mb = 1e6;
    const warnSize = pxt.appTarget.cloud.warnFileSize || (1 * mb);
    let maxSize = 0;
    files.forEach(f => {
        const stats = fs.statSync(f);
        if (stats.size > warnSize)
            pxt.log(`  ${f} - ${stats.size / mb}Mb`);
        maxSize = Math.max(maxSize, stats.size);
    });
    return maxSize;
}

function internalCheckDocsAsync(compileSnippets?: boolean, re?: string, fix?: boolean, pycheck?: boolean): Promise<void> {
    if (!nodeutil.existsDirSync("docs"))
        return Promise.resolve();
    const docsRoot = nodeutil.targetDir;
    const docsTemplate = server.expandDocFileTemplate("docs.html")
    pxt.log(`checking docs`);
    const ignoredFoldersKey = ".checkdocs-ignore";
    const ignoredFolders = nodeutil.allFiles("docs", { includeHiddenFiles: true })
        .filter(el => el.endsWith(ignoredFoldersKey))
        .map(el => path.dirname(path.join(el.substring(4))) + path.sep);
    if (ignoredFolders.length)
        pxt.log(`Ignoring folders [${ignoredFolders.join(", ")}]`);

    const noTOCs: string[] = [];
    const todo: string[] = [];
    let urls: any = {};
    let checked = 0;
    let broken = 0;
    // only check each snippet once.
    const existingSnippets: pxt.Map<boolean> = {};
    let snippets: CodeSnippet[] = [];

    const maxFileSize = checkFileSize(nodeutil.allFiles("docs", { maxDepth: 10, allowMissing: true, includeDirs: true, ignoredFileMarker: ".ignorelargefiles" }));
    if (!pxt.appTarget.ignoreDocsErrors
        && maxFileSize > (pxt.appTarget.cloud.maxFileSize || (5000000)))
        U.userError(`files too big in docs folder`);

    // scan and fix image links
    nodeutil.allFiles("docs", { ignoredFileMarker: ignoredFoldersKey })
        .filter(f => /\.md/.test(f))
        .forEach(f => {
            let md = fs.readFileSync(f, { encoding: "utf8" });
            let newmd = md.replace(/]\((\/static\/[^)]+?)\.(png|jpg)(\s+"[^"]+")?\)/g, (m: string, p: string, ext: string, comment: string) => {
                let fn = path.join(docsRoot, "docs", `${p}.${ext}`);
                if (fs.existsSync(fn))
                    return m;
                // try finding other file
                let next = ext == "png" ? "jpg" : "png";
                const exists = fs.existsSync(path.join(docsRoot, "docs", `${p}.${next}`));
                if (exists && fix)
                    return `](${p}.${next}${comment ? " " : ""}${comment || ""})`;

                // broken image or resources
                broken++;
                pxt.log(`missing file ${p}.${ext}`)
                return m;
            });
            if (fix && md != newmd) {
                pxt.log(`patching ${f}`)
                nodeutil.writeFileSync(f, newmd, { encoding: "utf8" })
            }
        });

    function addSnippet(snippet: CodeSnippet, entryPath: string, snipIndex: number, src: string) {
        const key = `${src}${snipIndex}`;
        if (existingSnippets[key])
            return;
        snippets.push(snippet);
        const dir = path.join("temp/snippets", snippet.type);
        const fn = `${dir}/${entryPath.replace(/^\//, '').replace(/[\/\s]/g, '-').replace(/\.\w+$/, '')}-${snipIndex}.${snippet.ext}`;
        if (isLocalBuild()) {
            nodeutil.mkdirP(dir);
            nodeutil.writeFileSync(fn, snippet.code);
        }
        snippet.file = fn;
        snippet.src = src;
        existingSnippets[key] = true;
    }

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
            const pathedUrl = path.join(url)
            if (ignoredFolders.some(el => pathedUrl.startsWith(el)))
                return;
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

    // check over TOCs
    nodeutil.allFiles("docs", { maxDepth: 5, ignoredFileMarker: ignoredFoldersKey })
        .filter(f => /SUMMARY\.md$/.test(f))
        .forEach(summaryFile => {
            const summaryPath = path.join(path.dirname(summaryFile), 'SUMMARY').replace(/^docs[\/\\]/, '');
            pxt.log(`looking for ${summaryPath}`);
            const summaryMD = nodeutil.resolveMd(docsRoot, summaryPath);
            const toc = pxt.docs.buildTOC(summaryMD);
            if (!toc) {
                pxt.log(`invalid SUMMARY`);
                broken++;
            } else {
                toc.forEach(checkTOCEntry);
            }
        });

    // push entries from pxtarget
    const theme = pxt.appTarget.appTheme;
    if (theme) {
        if (theme.sideDoc)
            todo.push(theme.sideDoc);
        if (theme.usbDocs)
            todo.push(theme.usbDocs);
    }

    // push galleries for targetconfig
    if (fs.existsSync("targetconfig.json")) {
        const targeConfig = nodeutil.readJson("targetconfig.json") as pxt.TargetConfig;
        if (targeConfig.galleries)
            Object.keys(targeConfig.galleries)
                .forEach(gallery => {
                    const url = getGalleryUrl(targeConfig.galleries[gallery])
                    todo.push(url)
                });
    }

    // push files from targetconfig checkdocsdirs
    const mdRegex = /\.md$/;
    const targetDirs = pxt.appTarget.checkdocsdirs;
    if (targetDirs) {
        targetDirs.forEach(dir => {
            pxt.log(`looking for markdown files in ${dir}`);
            nodeutil.allFiles(path.join("docs", dir), { maxDepth: 3, ignoredFileMarker: ".checkdocs-ignore" })
                .filter(f => mdRegex.test(f))
                .forEach(md => {
                    pushUrl(md.slice(5).replace(mdRegex, ""), true);
                });
        })
    }

    while (todo.length) {
        checked++;
        const entrypath = todo.pop();
        pxt.debug(`checking ${entrypath}`)
        let md = (urls[entrypath] as string) || nodeutil.resolveMd(docsRoot, entrypath);
        if (!md) {
            pxt.log(`unable to resolve ${entrypath}`)
            broken++;
            continue;
        }
        // look for broken urls
        md.replace(/]\( (\/[^)]+?)(\s+"[^"]+")?\)/g, (m) => {
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

        // look for broken macros
        try {
            const r = pxt.docs.renderMarkdown({
                template: docsTemplate,
                markdown: md,
                theme: pxt.appTarget.appTheme,
                throwOnError: true
            });
        } catch (e) {
            pxt.log(`${entrypath}: ${e}`);
            broken++;
        }

        // look for snippets
        getCodeSnippets(entrypath, md).forEach((snippet, snipIndex) => addSnippet(snippet, entrypath, snipIndex, entrypath));
    }

    nodeutil.mkdirP("temp");
    nodeutil.writeFileSync("temp/noSUMMARY.md", noTOCs.sort().map(p => `${Array(p.split(/[\/\\]/g).length - 1).join('     ')}* [${pxt.Util.capitalize(p.split(/[\/\\]/g).reverse()[0].split('-').join(' '))}](${p})`).join('\n'), { encoding: "utf8" });

    // test targetconfig
    if (nodeutil.fileExistsSync("targetconfig.json")) {
        const targetConfig = nodeutil.readJson("targetconfig.json") as pxt.TargetConfig;
        if (targetConfig?.packages?.approvedRepoLib) {
            for (const repoSlug of Object.keys(targetConfig.packages.approvedRepoLib)) {
                if (repoSlug !== repoSlug.toLocaleLowerCase()) {
                    U.userError(`targetconfig.json: repo slugs in approvedRepoLib must be lowercased.\n\tError: ${repoSlug}`);
                }
            }
        }
        if (targetConfig && targetConfig.galleries) {
            Object.keys(targetConfig.galleries).forEach(k => {
                pxt.log(`gallery ${k}`);
                const galleryUrl = getGalleryUrl(targetConfig.galleries[k])
                let gallerymd = nodeutil.resolveMd(docsRoot, galleryUrl);
                if (!gallerymd) {
                    pxt.log(`unable to resolve ${galleryUrl}`)
                    broken++;
                    return;
                }
                let gallery = pxt.gallery.parseGalleryMardown(gallerymd);
                pxt.debug(`found ${gallery.length} galleries`);
                gallery.forEach(gal => gal.cards.forEach((card, cardIndex) => {
                    pxt.debug(`card ${card.shortName || card.name}`);
                    switch (card.cardType) {
                        case "tutorial": {
                            let urls = [card.url]
                            if (card.otherActions) card.otherActions.forEach(a => { if (a.url) urls.push(a.url) });
                            for (let url of urls) {
                                const pathedUrl = path.join(url)
                                if (ignoredFolders.some(el => pathedUrl.startsWith(el)))
                                    return;
                                const tutorialMd = nodeutil.resolveMd(docsRoot, url);
                                if (!tutorialMd) {
                                    pxt.log(`unable to resolve ${url}`)
                                    broken++;
                                    continue;
                                }
                                const tutorial = pxt.tutorial.parseTutorial(tutorialMd);
                                const pkgs: pxt.Map<string> = { "blocksprj": "*" };
                                pxt.Util.jsonMergeFrom(pkgs, pxt.gallery.parsePackagesFromMarkdown(tutorialMd) || {});

                                let extraFiles: Map<string> = null;

                                if (tutorial.jres) {
                                    extraFiles = {
                                        [pxt.TILEMAP_JRES]: tutorial.jres,
                                        [pxt.TILEMAP_CODE]: pxt.emitTilemapsFromJRes(JSON.parse(tutorial.jres))
                                    };
                                }

                                // Handles tilemaps, spritekinds
                                if (tutorial.code.some(tut => tut.indexOf("namespace") !== -1)
                                    // Handles ```python``` snippets
                                    || (tutorial.language == "python")) {
                                    tutorial.steps
                                        .filter(step => !!step.contentMd)
                                        .forEach((step, stepIndex) => getCodeSnippets(`${card.name}-step${stepIndex}`, step.contentMd)
                                            .forEach((snippet, snippetIndex) => {
                                                snippet.packages = pkgs;
                                                snippet.extraFiles = extraFiles;
                                                const indexInStep = snippetIndex ? `-${snippetIndex}` : "";
                                                addSnippet(
                                                    snippet,
                                                    `tutorial/${card.name}-${indexInStep}step`,
                                                    stepIndex,
                                                    url + (indexInStep)
                                                )
                                            })
                                        );
                                }
                                else {
                                    addSnippet(<CodeSnippet>{
                                        name: card.name,
                                        code: tutorial.code.join("\n"),
                                        type: "blocks",
                                        ext: "ts",
                                        packages: pkgs,
                                        extraFiles: extraFiles
                                    }, "tutorial" + gal.name, cardIndex, url);
                                }
                            }

                            break;
                        }
                        case "example": {
                            let urls = [card.url]
                            if (card.otherActions) card.otherActions.forEach(a => { if (a.url) urls.push(a.url) });
                            for (let url of urls) {
                                const pathedUrl = path.join(url)
                                if (ignoredFolders.some(el => pathedUrl.startsWith(el)))
                                    return;
                                const exMd = nodeutil.resolveMd(docsRoot, url);
                                if (!exMd) {
                                    pxt.log(`unable to resolve ${url}`)
                                    broken++;
                                    continue;
                                }
                                const prj = pxt.gallery.parseExampleMarkdown(card.name, exMd);
                                const pkgs: pxt.Map<string> = { "blocksprj": "*" };
                                pxt.U.jsonMergeFrom(pkgs, prj.dependencies);

                                let extraFiles: Map<string> = undefined;

                                if (prj.filesOverride[pxt.TILEMAP_CODE] && prj.filesOverride[pxt.TILEMAP_JRES]) {
                                    extraFiles = {
                                        [pxt.TILEMAP_CODE]: prj.filesOverride[pxt.TILEMAP_CODE],
                                        [pxt.TILEMAP_JRES]: prj.filesOverride[pxt.TILEMAP_JRES]
                                    };
                                }
                                addSnippet(<CodeSnippet>{
                                    name: card.name,
                                    code: prj.filesOverride[pxt.MAIN_TS],
                                    type: "blocks",
                                    ext: "ts",
                                    extraFiles,
                                    packages: pkgs
                                }, `example/${url}`, 0, url);
                            }
                            break;
                        }
                    }
                }));
            })
        }
    }

    pxt.log(`checked ${checked} files: ${broken} broken links, ${noTOCs.length} not in SUMMARY, ${snippets.length} snippets`);
    let p = Promise.resolve();
    if (compileSnippets)
        p = p.then(() => testSnippetsAsync(snippets, re, pycheck));
    return p.then(() => {
        if (broken > 0) {
            const msg = `${broken} broken links found in the docs`;
            if (pxt.appTarget.ignoreDocsErrors) pxt.log(msg)
            else U.userError(msg);
        }
    })
}

async function upgradeCardsAsync(): Promise<void> {
    const docsRoot = nodeutil.targetDir;
    // markdowns with cards
    const mds = nodeutil.allFiles(docsRoot, { maxDepth: 10 })
        .filter(fn => /\.md$/.test(fn))
        .map(fn => ({ filename: fn, content: nodeutil.readText(fn) }))
        .filter(f => /```codecard/.test(f.content));

    mds.forEach(({ filename, content }) => {
        pxt.log(`patching ${filename}`)
        const updated = content.replace(/```codecard([^`]+)```/g, (m, c: string) => {
            const cards = pxt.gallery.parseCodeCards(c);
            return pxt.gallery.codeCardsToMarkdown(cards);
        })
        nodeutil.writeFileSync(filename, updated);
    })
}

interface TutorialInfo extends pxt.tutorial.TutorialInfo {
    path: string;
    pkgs?: Map<string>
}

function cacheUsedBlocksAsync() {
    return internalCacheUsedBlocksAsync()
        .then((usedBlocks) => {
            nodeutil.writeFileSync(path.resolve(process.cwd(), "built", "tutorial-info-cache.json"), JSON.stringify(usedBlocks));
        })
}

function internalCacheUsedBlocksAsync(): Promise<Map<pxt.BuiltTutorialInfo>> {
    pxt.github.forceProxy = true; // avoid throttling in CI machines
    const mdPaths: string[] = [];
    const mdRegex = /\.md$/;
    const targetDirs = pxt.appTarget.cacheusedblocksdirs;
    const builtTututorialInfo: Map<pxt.BuiltTutorialInfo> = {};
    if (targetDirs) {
        targetDirs.forEach(dir => {
            pxt.log(`looking for tutorial markdown in ${dir}`);
            nodeutil.allFiles(path.join("docs", dir), { maxDepth: 3 }).filter(f => mdRegex.test(f))
                .forEach(md => {
                    mdPaths.push(md.slice(5).replace(mdRegex, ""));
                });
        })
    }
    const tutorialInfo: Map<TutorialInfo> = {}
    for (let i = 0; i < mdPaths.length; i++) {
        const path = mdPaths[i];
        let md = nodeutil.resolveMd(nodeutil.targetDir, path);
        if (!md) {
            pxt.log(`error resolving tutorial markdown at ${path}`);
        }
        const tutorial = pxt.tutorial.parseTutorial(md) as TutorialInfo;
        const pkgs: pxt.Map<string> = { "blocksprj": "*" };
        pxt.Util.jsonMergeFrom(pkgs, pxt.gallery.parsePackagesFromMarkdown(md) || {});
        tutorial.pkgs = pkgs;
        tutorial.path = path;

        const hash = pxt.BrowserUtils.getTutorialCodeHash(tutorial.code);
        tutorialInfo[hash] = tutorial;
    }

    const namespaceRegex = /^\s*namespace\s+[^\s]+\s*{([\S\s]*)}\s*$/im;
    return U.promiseMapAll(Object.keys(tutorialInfo), (hash: string) => {
        const info = tutorialInfo[hash];
        const cache: Map<string> = {};
        let isPy = info.language === "python"
        let inFiles;
        if (isPy) {
            let extra: Map<string> = {};
            info.code.forEach((snippet, i) => extra["snippet_" + i + ".py"] = snippet);
            inFiles = { [pxt.MAIN_TS]: "", [pxt.MAIN_PY]: "", [pxt.MAIN_BLOCKS]: "", ...extra }
        } else {
            inFiles = { [pxt.MAIN_TS]: "", [pxt.MAIN_PY]: "", [pxt.MAIN_BLOCKS]: "" }
        }

        const host = new SnippetHost("usedblocks", inFiles, info.pkgs);
        host.cache = cache;
        const pkg = new pxt.MainPackage(host);
        return pkg.installAllAsync()
            .then(() => pkg.getCompileOptionsAsync().then(opts => {
                opts.ast = true;
                // convert python to ts
                let sourceTexts = []
                if (isPy) {
                    opts.target.preferredEditor = pxt.JAVASCRIPT_PROJECT_NAME
                    const stsCompRes = pxtc.compile(opts);
                    const apisInfo = pxtc.getApiInfo(stsCompRes.ast, opts.jres)
                    if (!apisInfo || !apisInfo.byQName)
                        throw Error("Failed to get apisInfo")

                    opts.apisInfo = apisInfo
                    opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME
                    const { outfiles } = pxt.py.py2ts(opts)

                    for (let f of Object.keys(outfiles)) {
                        if (f.match(/^snippet/)) {
                            let match = outfiles[f].match(namespaceRegex);
                            if (match && match[1]) sourceTexts.push(match[1]);
                        }
                    }
                } else {
                    sourceTexts = info.code;
                }

                // convert ts to blocks
                try {
                    opts.sourceTexts = sourceTexts;
                    const decompiled = pxtc.decompileSnippets(pxtc.getTSProgram(opts), opts, false);
                    if (decompiled?.length > 0) {
                        // scrape block IDs matching <block type="block_id">
                        let builtInfo: pxt.BuiltTutorialInfo = builtTututorialInfo[hash] || { usedBlocks: {}, snippetBlocks: {}, highlightBlocks: {}, validateBlocks: {} };
                        const blockIdRegex = /<\s*block(?:[^>]*)? type="([^ ]*)"/ig;
                        for (let i = 0; i < decompiled.length; i++) {
                            const blocksXml = decompiled[i];
                            const snippetHash = pxt.BrowserUtils.getTutorialCodeHash([opts.sourceTexts[i]])
                            blocksXml.replace(blockIdRegex, (m0, m1) => {
                                if (!builtInfo.snippetBlocks[snippetHash]) builtInfo.snippetBlocks[snippetHash] = {};
                                builtInfo.snippetBlocks[snippetHash][m1] = 1;
                                builtInfo.usedBlocks[m1] = 1;
                                //TODO: Fill builtInfo.HighlightedBlocks and builtInfo.validateBlocks
                                return m0;
                            })
                        }
                        builtTututorialInfo[hash] = builtInfo;
                    }
                } catch {
                    pxt.log(`error decompiling ${info.path}`)
                }
            }))
            .catch((err) => pxt.log(err));
    }).then(() => {
        pxt.log("cached tutorial used blocks");
        return builtTututorialInfo
    })
}

export interface SnippetInfo {
    type: string;
    code: string;
    ignore: boolean;
    index: number;
}

export function getSnippets(source: string): SnippetInfo[] {
    let snippets: SnippetInfo[] = []
    let re = /^`{3} *([\S]+)?\s*\n([\s\S]+?)\n`{3}\s*?$/gm;
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
    extraFiles?: pxt.Map<string>;
    type: string;
    ext: string;
    packages: pxt.Map<string>;
    file?: string;
    src?: string;
}

export function getCodeSnippets(fileName: string, md: string): CodeSnippet[] {
    const supported: pxt.Map<string> = {
        "blocks": "ts",
        "block": "ts",
        "typescript": "ts",
        "sig": "ts",
        "namespaces": "ts",
        "cards": "ts",
        "sim": "ts",
        "ghost": "ts",
        "codecard": "json",
        "python": "py"
    }
    let snippets = getSnippets(md);
    const codeSnippets = snippets.filter(snip => !snip.ignore && !!supported[snip.type]);
    const jres = snippets.filter(snip => snip.type === "jres")[0];

    let extraFiles: Map<string> = null;

    if (jres) {
        extraFiles = {
            [pxt.TILEMAP_JRES]: jres.code,
            [pxt.TILEMAP_CODE]: pxt.emitTilemapsFromJRes(JSON.parse(jres.code))
        };
    }


    const pkgs: pxt.Map<string> = {
        "blocksprj": "*"
    }
    snippets.filter(snip => snip.type == "package")
        .map(snip => snip.code.split('\n'))
        .forEach(lines => lines
            .map(l => l.replace(/\s*$/, ''))
            .filter(line => !!line)
            .forEach(line => {
                const i = line.indexOf('=');
                if (i < 0) pkgs[line] = "*";
                else pkgs[line.substring(0, i)] = line.substring(i + 1);
            })
        );

    const pkgName = fileName.replace(/\\/g, '-').replace(/.md$/i, '');
    return codeSnippets.map((snip, i) => {
        return {
            name: `${pkgName}-${i}`,
            code: snip.code,
            type: snip.type,
            extraFiles: extraFiles,
            ext: supported[snip.type],
            packages: pkgs
        };
    })
}

function webstringsJson() {
    let missing: Map<string> = {}
    const files = onlyExts(nodeutil.allFiles("docfiles"), [".html"])
        .concat(onlyExts(nodeutil.allFiles("docs"), [".html"]))
    for (let fn of files) {
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
    dirs.forEach(dir => prereqs = prereqs.concat(nodeutil.allFiles(dir, { maxDepth: 20 })));

    let errCnt = 0;
    let translationStrings: pxt.Map<string> = {}

    function processLf(filename: string) {
        if (!/\.(ts|tsx|html)$/.test(filename)) return
        if (/\.d\.ts$/.test(filename)) return

        pxt.debug(`extracting strings from${filename}`);
        fs.readFileSync(filename, "utf8").split('\n').forEach((line: string, idx: number) => {
            function err(msg: string) {
                console.log("%s(%d): %s", filename, idx + 1, msg);
                errCnt++;
            }

            if (/@ignorelf@/.test(line))
                return;

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
                            err("invalid format of lf() argument: " + args) // @ignorelf@
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
    nodeutil.writeFileSync(`built/${output}.json`, nodeutil.stringify(strings));

    pxt.log("log strings: " + fileCnt + " files; " + tr.length + " strings -> " + output + ".json");
    if (errCnt > 0)
        pxt.log(`${errCnt} errors`);
    return Promise.resolve();
}

function testGithubPackagesAsync(parsed: commandParser.ParsedCommand): Promise<void> {
    pxt.log(`-- testing github packages-- `);
    pxt.github.forceProxy = true;
    if (!Cloud.accessToken)
        U.userError('pxt token PXT_ACCESS_TOKEN missing')
    if (!fs.existsSync("targetconfig.json")) {
        pxt.log(`targetconfig.json not found`);
        return Promise.resolve();
    }
    parseBuildInfo(parsed);
    const fast = !!parsed.flags["fast"];
    const clean = !!parsed.flags["clean"];
    const filterRx = parsed.args["filter"] && new RegExp(parsed.flags["filter"] as string);
    const targetConfig = nodeutil.readJson("targetconfig.json") as pxt.TargetConfig;
    const packages = targetConfig.packages;
    if (!packages) {
        pxt.log(`packages section not found in targetconfig.json`)
    }
    const pkgsroot = path.join("temp", "ghpkgs");
    const logfile = path.join(pkgsroot, "log.txt");
    const errorfile = path.join(pkgsroot, "error.txt");
    nodeutil.writeFileSync(logfile, ""); // reset file
    nodeutil.writeFileSync(errorfile, ""); // reset file

    function pxtAsync(dir: string, args: string[]) {
        return nodeutil.spawnAsync({
            cmd: "pxt",
            args,
            cwd: dir
        })
    }

    let errorCount = 0;
    let warningCount = 0;
    function reportWarning(er: { repo: string; title: string; body: string; }) {
        reportLog(`warning: https://github.com/${er.repo} ${er.title}`)
        const msg = `- [ ] warning: [${er.repo}](https://github.com/${er.repo}) ${er.title} / [new issue](https://github.com/${er.repo}/issues/new?title=${encodeURIComponent(er.title)}&body=${encodeURIComponent(er.body)})`;
        fs.appendFileSync(errorfile, msg + "\n");
        warningCount++;
    }

    function reportError(er: { repo: string; title: string; body: string; }) {
        reportLog(`error: https://github.com/${er.repo} ${er.title}`)
        const msg = `- [ ] error:  [${er.repo}](https://github.com/${er.repo}) ${er.title} / [new issue](https://github.com/${er.repo}/issues/new?title=${encodeURIComponent(er.title)}&body=${encodeURIComponent(er.body)})`;
        fs.appendFileSync(errorfile, msg + "\n");
        errorCount++;
    }
    function reportLog(msg: any) {
        pxt.log(msg);
        fs.appendFileSync(logfile, msg + "\n");
    }

    function resolveTagAsync(fullname: string): Promise<string> {
        return pxt.github.listRefsAsync(fullname)
            .then(tags => {
                let tag = pxt.semver.sortLatestTags(tags)[0];
                if (!tag) {
                    reportWarning({ repo: fullname, title: "create a release", body: "You need to create a release in this repository. Follow the instructions at https://makecode.com/extensions/versioning." });
                    tag = "master";
                }
                else {
                    reportLog(`  release: ${tag}`)
                }
                return tag;
            });
    }

    function buildAsync(pkgpgh: string, tag: string): Promise<void> {
        // clone or sync package
        const buildArgs = ["build", "--ignoreTests"];
        if (forceLocalBuild) buildArgs.push("--localbuild");
        const pkgdir = path.join(pkgsroot, pkgpgh);
        const buildlog = path.join(pkgdir, "built", "success.txt");
        const buildkey = `${pxt.appTarget.id}-${pxt.appTarget.versions.targetId}-${pkgpgh}-${tag}`;
        // check if already built with success
        if (nodeutil.fileExistsSync(buildlog) &&
            fs.readFileSync(buildlog, "utf8") === buildkey) {
            reportLog(`  already built ${tag}`)
            return Promise.resolve();
        }

        return pxt.github.db.loadPackageAsync(pkgpgh, tag)
            .then(cp => {
                Object.keys(cp.files)
                    .forEach(fn => nodeutil.writeFileSync(path.join(pkgdir, fn), cp.files[fn], "utf8"));
                return pxtAsync(pkgdir, ["clean"]);
            })
            .then(() => pxtAsync(pkgdir, ["install"]))
            .then(() => pxtAsync(pkgdir, buildArgs))
            .then(() => {
                // already built with success
                nodeutil.writeFileSync(buildlog, buildkey);
            });
    }

    function nextAsync(fullname: string) {
        pxt.log('')
        reportLog(`${fullname}`)

        const pkgdir = path.join(pkgsroot, fullname);
        const buildlog = path.join(pkgdir, "built", "success.txt");
        const errorlog = path.join(pkgdir, "built", "error.txt");
        if (fast) {
            if (nodeutil.fileExistsSync(buildlog)) {
                reportLog(`${fullname} built already`);
                return Promise.resolve();
            }

            if (nodeutil.fileExistsSync(errorlog)) {
                reportError({ repo: fullname, title: "build error", body: nodeutil.readText(errorlog) })
                return Promise.resolve();
            }
        }

        let delay = 1000;
        let retry = 0;
        return workAsync();

        function workAsync(): Promise<void> {
            return resolveTagAsync(fullname)
                .then(tag => buildAsync(fullname, tag))
                .catch(e => {
                    if (e.statusCode == 429 && retry++ < 6) {
                        delay *= 2;
                        pxt.log(`retrying in ${delay / 1000} secs...`)
                        return U.delay(delay)
                            .then(() => workAsync());
                    }
                    reportError({ repo: fullname, title: "build error", body: e.message })
                    nodeutil.writeFileSync(errorlog, e.message);
                    return Promise.resolve();
                });
        }
    }

    // 1. collect packages
    return (clean ? rimrafAsync(pkgsroot, {}) : Promise.resolve())
        .then(() => nodeutil.mkdirP(pkgsroot))
        .then(() => pxt.github.searchAsync("", packages))
        .then(ghrepos => ghrepos.filter(ghrepo => ghrepo.status == pxt.github.GitRepoStatus.Approved)
            .map(ghrepo => ghrepo.fullName).concat(Object.keys(packages.approvedRepoLib || {})))
        .then(fullnames => {
            // remove dups
            fullnames = U.unique(fullnames, f => f.toLowerCase());
            // filter out
            if (filterRx)
                fullnames = fullnames.filter(fn => filterRx.test(fn))
            reportLog(`found ${fullnames.length} approved extensions`);
            reportLog(nodeutil.stringify(fullnames));
            return U.promiseMapAllSeries(fullnames, nextAsync);
        })
        .then(() => {
            if (errorCount > 0) {
                reportLog(`${errorCount} errors, ${warningCount} warnings`);
                process.exit(1);
            }
        })
}

interface BlockTestCase {
    packageName: string;
    testFiles: { testName: string, contents: string }[];
}

function blockTestsAsync(parsed?: commandParser.ParsedCommand) {
    let cmd = karmaPath();
    if (!cmd) {
        console.error("Karma not found, did you run npm install?");
        return Promise.reject(new Error("Karma not found"));
    }

    const args = ["start", path.resolve("node_modules/pxt-core/tests/blocks-test/karma.conf.js")];

    if (parsed && parsed.flags["debug"]) {
        args.push("--no-single-run");
    }

    if (process.env.GITHUB_ACTIONS) {
        args.unshift(cmd);
        args.unshift("--auto-servernum");
        cmd = "xvfb-run"
    }

    return writeBlockTestJSONAsync()
        .then(() => nodeutil.spawnAsync({
            cmd,
            envOverrides: {
                "KARMA_TARGET_DIRECTORY": process.cwd()
            },
            args
        }), (e: Error) => console.log("Skipping blocks tests: " + e.message))

    function getBlocksFilesAsync(libsDirectory: string): Promise<BlockTestCase[]> {
        return readDirAsync(libsDirectory)
            .then(dirs => U.promiseMapAll(dirs, dir => {
                const dirPath = path.resolve(libsDirectory, dir, "blocks-test");
                const configPath = path.resolve(libsDirectory, dir, "pxt.json");
                let packageName: string;
                let testFiles: { testName: string, contents: string }[] = [];

                if (fs.existsSync(path.resolve(configPath)) && nodeutil.existsDirSync(dirPath)) {
                    return readFileAsync(configPath, "utf8")
                        .then((configText: string) => {
                            packageName = (JSON.parse(configText) as pxt.PackageConfig).name;
                            return readDirAsync(dirPath)
                                .then(files => U.promiseMapAll(files.filter(f => U.endsWith(f, ".blocks") && f != pxt.MAIN_BLOCKS), fn =>
                                    readFileAsync(path.join(dirPath, fn), "utf8")
                                        .then((contents: string) => testFiles.push({ testName: fn, contents }))))
                        })
                        .then(() => { return ({ packageName, testFiles } as BlockTestCase) })
                }
                return Promise.resolve(undefined);
            }))
            .then((allCases: BlockTestCase[]) => allCases.filter(f => !!f && f.testFiles.length && f.packageName));
    }

    function writeBlockTestJSONAsync() {
        let libsTests: BlockTestCase[];
        let commonTests: BlockTestCase[];
        return getBlocksFilesAsync(path.resolve("libs"))
            .then(files => {
                libsTests = files;
                const commonLibs = path.resolve("node_modules/pxt-common-packages/libs");
                if (nodeutil.existsDirSync(commonLibs))
                    return getBlocksFilesAsync(commonLibs)
                else {
                    return Promise.resolve([]);
                }
            })
            .then(files => {
                commonTests = files;

                if (!commonTests.length && !libsTests.length) return Promise.reject(new Error("No test cases found"));

                return writeFileAsync(path.resolve("built/block-tests.js"), "var testJSON = " + JSON.stringify({
                    libsTests, commonTests
                }), "utf8")
            })
    }

    function karmaPath() {
        const karmaCommand = os.platform() === "win32" ? "karma.cmd" : "karma";
        const localModule = path.resolve("node_modules", ".bin", karmaCommand);
        const coreModule = path.resolve("node_modules", "pxt-core", "node_modules", ".bin", karmaCommand);

        if (fs.existsSync(localModule)) {
            return localModule;
        }
        else if (fs.existsSync(coreModule)) {
            return coreModule;
        }
        return undefined;
    }
}

async function buildShimsAsync() {
    pxt.log(`building shims.d.ts, enum.d.ts files`)

    await mainPkg.loadAsync()
    setBuildEngine();
    const target = mainPkg.getTargetOptions()
    target.isNative = true
    target.keepCppFiles = true
    await mainPkg.getCompileOptionsAsync(target)
}

function initCommands() {
    // Top level commands
    simpleCmd("help", "display this message or info about a command", pc => {
        p.printHelp(pc.args, console.log)
        console.log(`
The following environment variables modify the behavior of the CLI when set to
non-empty string:

PXT_DEBUG            - display extensive logging info
PXT_USE_HID          - use webusb or hid to flash device
PXT_COMPILE_SWITCHES - same as ?compile=... in the webapp, interesting options
   PXT_COMPILE_SWITCHES=profile - enable profiling
   PXT_COMPILE_SWITCHES=time    - print-out compilation times
   PXT_COMPILE_SWITCHES=rawELF  - generate ELF files for Linux, without UF2 continer
PXT_FORCE_GITHUB_PROXY - always using backend cloud to download github repositories

These apply to the C++ runtime builds:

PXT_FORCE_LOCAL  - compile C++ on the local machine, not the cloud service
PXT_NODOCKER     - don't use Docker image, and instead use host's
                   arm-none-eabi-gcc (doesn't apply to Linux targets unless set to 'force')
PXT_RUNTIME_DEV  - always rebuild the C++ runtime, allowing for modification
                   in the lower level runtime if any
PXT_ASMDEBUG     - embed additional information in generated binary.asm file
PXT_ACCESS_TOKEN - pxt access token
PXT_IGNORE_BMP   - don't search for Black Magic Probe debugger
PXT_PYOCD        - use pyocd not openocd; requires 'pyocd gdbserver' running
GITHUB_ACCESS_TOKEN/GITHUB_TOKEN - github access token
${pxt.crowdin.KEY_VARIABLE} - crowdin key
`)
        return Promise.resolve();
    }, "[all|command]");

    p.defineCommand({
        name: "deploy",
        help: "build and deploy current package",
        flags: {
            "console": { description: "start console monitor after deployment", aliases: ["serial"] },
            cloudbuild: {
                description: "(deprecated) forces build to happen in the cloud",
                aliases: ["cloud", "cloud-build", "cb"]
            },
            localbuild: {
                description: "Build native image using local toolchains",
                aliases: ["local", "l", "local-build", "lb"]
            },
            force: {
                description: "skip cache lookup and force build",
                aliases: ["f"]
            },
            hwvariant: {
                description: "specify Hardware variant used for this compilation",
                argument: "hwvariant",
                type: "string",
                aliases: ["hw"]
            },
            install: {
                description: "install any missing package before build",
                aliases: ["i"]
            }
        },
        onlineHelp: true
    }, deployAsync)
    simpleCmd("run", "build and run current package in the simulator", runAsync);
    simpleCmd("console", "monitor console messages", consoleAsync, null, true);
    simpleCmd("update", "update pxt-core reference and install updated version", updateAsync, undefined, true);
    simpleCmd("add", "add a feature (.asm, C++ etc) to package", addAsync, "<arguments>");

    p.defineCommand({
        name: "install",
        help: "install dependencies",
        argString: "[package]",
        aliases: ["i"],
        onlineHelp: true,
        flags: {
            link: {
                description: "link to local version of libraries",
                argument: "libs-directory",
                type: "string",
                aliases: ["l"]
            },
            hwvariant: {
                description: "specify hardware variant",
                argument: "hwvariant",
                type: "string",
                aliases: ["hw"]
            }
        }
    }, installAsync);

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
        name: "tag",
        help: "tags a release",
        argString: "<tag> <version>",
        flags: {
            npm: { description: "updates tags on npm packages as well" }
        }
    }, tagReleaseAsync);

    p.defineCommand({
        name: "build",
        help: "builds current package",
        onlineHelp: true,
        flags: {
            cloudbuild: {
                description: "(deprecated) forces build to happen in the cloud",
                aliases: ["cloud", "cloud-build", "cb"]
            },
            localbuild: {
                description: "Build native image using local toolchains",
                aliases: ["local", "l", "local-build", "lb"]
            },
            force: {
                description: "skip cache lookup and force build",
                aliases: ["f"]
            },
            hwvariant: {
                description: "specify Hardware variant used for this compilation",
                argument: "hwvariant",
                type: "string",
                aliases: ["hw"]
            },
            debug: { description: "Emit debug information with build" },
            deploy: { description: "Deploy to device if connected" },
            ignoreTests: { description: "Ignores tests in compilation", aliases: ["ignore-tests", "ignoretests", "it"] },
            clean: { description: "Clean before build" },
            install: {
                description: "install any missing package before build",
                aliases: ["i"]
            }
        }
    }, buildAsync);

    p.defineCommand({
        name: "buildsimjs",
        help: "build sim js for a share link",
        argString: "<share id>",
        flags: {
            output: {
                description: "Specifies the output folder for the generated files",
                argument: "output",
                type: "string",
                aliases: ["o"]
            },
        },
    }, buildShareSimJsAsync)

    simpleCmd("clean", "removes built folders", cleanAsync);
    advancedCommand("cleangen", "remove generated files", cleanGenAsync);
    simpleCmd("npminstallnative", "install native dependencies", npmInstallNativeAsync);

    p.defineCommand({
        name: "staticpkg",
        help: "packages the target into static HTML pages",
        onlineHelp: true,
        flags: {
            route: {
                description: "route appended to generated files",
                argument: "route",
                type: "string",
                aliases: ["r"]
            },
            githubpages: {
                description: "Generate a web site compatible with GitHub pages",
                aliases: ["ghpages", "gh"]
            },
            output: {
                description: "Specifies the output folder for the generated files",
                argument: "output",
                aliases: ["o"]
            },
            minify: {
                description: "minify all generated js files",
                aliases: ["m", "uglify"]
            },
            bump: {
                description: "bump version number prior to package"
            },
            cloudbuild: {
                description: "(deprecated) forces build to happen in the cloud",
                aliases: ["cloud", "cloud-build", "cb"]
            },
            localbuild: {
                description: "Build native image using local toolchains",
                aliases: ["local", "l", "local-build", "lb"]
            },
            locs: {
                description: "Download localization files and bundle them",
                aliases: ["locales", "crowdin"]
            },
            "locs-src": {
                description: "Bundle localization files that have already been downloaded to a given directory",
                argument: "locs-src",
                type: "string"
            },
            "no-appcache": {
                description: "Disables application cache"
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
                aliases: ["no-browser", "nb"]
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
            cloudbuild: {
                description: "(deprecated) forces build to happen in the cloud",
                aliases: ["cloud", "cloud-build", "cb"]
            },
            localbuild: {
                description: "Build native image using local toolchains",
                aliases: ["local", "l", "local-build", "lb"]
            },
            just: { description: "just serve without building" },
            rebundle: { description: "rebundle when change is detected", aliases: ["rb"] },
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
            noauth: {
                description: "disable localtoken-based authentication",
                aliases: ["na"],
            }
        }
    }, serveAsync);

    p.defineCommand({
        name: "buildjres",
        aliases: ["jres"],
        help: "embeds resources into jres files"
    }, buildJResAsync);

    p.defineCommand({
        name: "buildsprites",
        help: "collects sprites into a .jres file",
        argString: "<directory>",
    }, buildJResSpritesAsync);

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
    advancedCommand("testpkgconflicts", "tests package conflict detection logic", testPkgConflictsAsync);
    advancedCommand("testdbg", "tests hardware debugger", dbgTestAsync);

    p.defineCommand({
        name: "buildtarget",
        aliases: ["buildtrg", "bt", "build-target", "buildtrg"],
        advanced: true,
        help: "Builds the current target",
        flags: {
            cloudbuild: {
                description: "(deprecated) forces build to happen in the cloud",
                aliases: ["cloud", "cloud-build", "cb"]
            },
            localbuild: {
                description: "Build native image using local toolchains",
                aliases: ["local", "l", "local-build", "lb"]
            },
            force: {
                description: "skip cache lookup and force build",
                aliases: ["f"]
            },
            skipCore: {
                description: "skip native build of core packages",
                aliases: ["skip-core", "skipcore", "sc"]
            },
            clean: {
                description: "clean build before building"
            }
        }
    }, buildTargetAsync);
    p.defineCommand({
        name: "uploadtarget",
        aliases: ["uploadtrg", "ut", "upload-target", "upload-trg"],
        help: "Upload target release",
        argString: "<label>",
        advanced: true,
        flags: {
            cloudbuild: {
                description: "(deprecated) forces build to happen in the cloud",
                aliases: ["cloud", "cloud-build", "cb"]
            },
            localbuild: {
                description: "Build native image using local toolchains",
                aliases: ["local", "l", "local-build", "lb"]
            },
            force: {
                description: "skip cache lookup and force build",
                aliases: ["f"]
            },
            rebundle: {
                description: "skip build and just rebundle",
            }
        }
    }, uploadTargetReleaseAsync);
    p.defineCommand({
        name: "uploadrefs",
        aliases: [],
        help: "Upload refs directly to the cloud",
        argString: "<repo>",
        advanced: true,
    }, pc => uploadTargetRefsAsync(pc.args[0]));
    advancedCommand("uploadtt", "upload tagged release", uploadTaggedTargetAsync, "");
    advancedCommand("downloadtrgtranslations", "download translations from bundled projects", crowdin.downloadTargetTranslationsAsync, "<package>");

    p.defineCommand({
        name: "checkdocs",
        onlineHelp: true,
        help: "check docs for broken links, typing errors, etc...",
        flags: {
            snippets: { description: "(obsolete) compile snippets", deprecated: true },
            re: {
                description: "regular expression that matches the snippets to test",
                argument: "regex"
            },
            fix: {
                description: "Fix links if possible"
            },
            pycheck: {
                description: "Check code snippets by round-tripping to .py and comparing the "
                    + "original and result .ts. This will generate lots of false positives but can "
                    + "still be useful for searching for semantic issues."
            }
        }
    }, checkDocsAsync);
    advancedCommand("upgradecards", "convert JSON codecard to markdown format", upgradeCardsAsync, "");

    p.defineCommand({
        name: "usedblocks",
        help: "extract list of block ids used in each tutorial"
    }, cacheUsedBlocksAsync);

    advancedCommand("api", "do authenticated API call", pc => apiAsync(pc.args[0], pc.args[1]), "<path> [data]");
    advancedCommand("pokecloud", "same as 'api pokecloud {}'", () => apiAsync("pokecloud", "{}"));
    p.defineCommand({
        name: "ci",
        help: "run automated build in a continuous integration environment",
        aliases: ["travis", "githubactions", "buildci"]
    }, ciAsync);
    advancedCommand("uploadfile", "upload file under <CDN>/files/PATH", uploadFileAsync, "<path>");
    advancedCommand("service", "simulate a query to web worker", serviceAsync, "<operation>");
    advancedCommand("time", "measure performance of the compiler on the current package", timeAsync);

    p.defineCommand({
        name: "buildcss",
        help: "build required css files",
        flags: {
            force: {
                description: "deprecated; now on by default"
            }
        }
    }, buildSemanticUIAsync);

    p.defineCommand({
        name: "buildskillmap",
        aliases: ["skillmap"],
        advanced: true,
        help: "Serves the skill map webapp",
        flags: {
            serve: {
                description: "Serve the skill map locally after building (npm start)"
            },
            docs: {
                description: "Path to local docs folder to copy into skillmap",
                type: "string",
                argument: "docs"
            }
        }
    }, buildSkillMapAsync);

    p.defineCommand({
        name: "buildauthcode",
        aliases: ["authcode"],
        advanced: true,
        help: "Serves the authcode webapp",
        flags: {
            serve: {
                description: "Serve the authcode app locally after building (npm start)"
            },
            docs: {
                description: "Path to local docs folder to copy into authcode",
                type: "string",
                argument: "docs"
            }
        }
    }, buildAuthcodeAsync);

    advancedCommand("augmentdocs", "test markdown docs replacements", augmnetDocsAsync, "<temlate.md> <doc.md>");

    advancedCommand("crowdin", "upload, download, clean, stats files to/from crowdin", pc => crowdin.execCrowdinAsync.apply(undefined, pc.args), "<cmd> <path> [output]")

    advancedCommand("hidlist", "list HID devices", hid.listAsync)
    advancedCommand("hidserial", "run HID serial forwarding", hid.serialAsync, undefined, true);
    advancedCommand("hiddmesg", "fetch DMESG buffer over HID and print it", hid.dmesgAsync, undefined, true);
    advancedCommand("hexdump", "dump UF2 or BIN file", hexdumpAsync, "<filename>")
    advancedCommand("hex2uf2", "convert .hex file to UF2", hex2uf2Async, "<filename>")
    p.defineCommand({
        name: "pyconv",
        help: "convert from python",
        argString: "<package-directory> <support-directory>...",
        advanced: true,
        flags: {
            internal: {
                description: "use internal Python parser",
                aliases: ["i"]
            }
        }
    }, c => pyconv.convertAsync(c.args, !!c.flags["internal"]))

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
        advanced: true,
        onlineHelp: true
    }, gdbAsync);

    p.defineCommand({
        name: "hw",
        help: "apply hardware operation (via BMP)",
        argString: "reset|boot",
        anyArgs: true,
        advanced: true,
    }, hwAsync);

    p.defineCommand({
        name: "dmesg",
        help: "attempt to dump DMESG log using openocd",
        argString: "",
        aliases: ["dumplog"],
        advanced: true,
    }, dumplogAsync);

    p.defineCommand({
        name: "heap",
        help: "attempt to dump GC and codal heap log using openocd",
        argString: "[<memdump-file.bin>]",
        aliases: ["dumpheap"],
        advanced: true,
    }, dumpheapAsync);

    p.defineCommand({
        name: "memdump",
        help: "attempt to dump raw memory image using openocd",
        argString: "[startAddr stopAddr] <memdump-file.bin>",
        aliases: ["dumpmem"],
        advanced: true,
    }, dumpmemAsync);

    p.defineCommand({
        name: "builddaldts",
        help: "build dal.d.ts in current directory or target (might be generated in a separate folder)",
        advanced: true,
        aliases: ["daldts"],
        flags: {
            clean: { description: "clean and build" }
        }
    }, buildDalDTSAsync);

    p.defineCommand({
        name: "rebundle",
        help: "update packages embedded in target.json (quick version of 'pxt bt')",
        advanced: true
    }, rebundleAsync);

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
            apis: { description: "upload api strings" },
            docs: { description: "upload markdown docs folder as well" },
            test: { description: "test run, do not upload files to crowdin" }
        },
        advanced: true
    }, crowdin.uploadTargetTranslationsAsync);

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
            docs: { description: "produce docs files", aliases: ["doc"] },
            locs: { description: "produce localization files", aliases: ["loc"] },
            files: { description: "file name filter (regex)", type: "string", argument: "files" },
            create: { description: "only write new files" }
        },
        advanced: true
    }, gendocsAsync);

    p.defineCommand({
        name: "testghpkgs",
        help: "Download and build approved github packages",
        flags: {
            cloudbuild: {
                description: "(deprecated) forces build to happen in the cloud",
                aliases: ["cloud", "cloud-build", "cb"]
            },
            localbuild: {
                description: "Build native image using local toolchains",
                aliases: ["local", "l", "local-build", "lb"]
            },
            clean: { description: "delete all previous repos" },
            fast: { description: "don't check tag" },
            filter: { description: "regex filter for the package name", type: "string", argument: "filter" }
        },
    }, testGithubPackagesAsync);

    p.defineCommand({
        name: "testblocks",
        help: "Test blocks files in target and common libs in a browser. See https://makecode.com/develop/blockstests",
        advanced: true,
        flags: {
            debug: { description: "Keeps the browser open to debug tests" }
        }
    }, blockTestsAsync);

    p.defineCommand({
        name: "exportcpp",
        help: "Export all generated C++ files to given directory",
        advanced: true,
        argString: "<target-directory>"
    }, exportCppAsync);

    p.defineCommand({
        name: "downloaddiscoursetag",
        aliases: ["ddt"],
        help: "Download program for a discourse tag",
        advanced: true,
        argString: "<tag>",
        flags: {
            out: {
                description: "output folder, default is temp",
                argument: "out",
                type: "string"
            },
            md: {
                description: "path of the markdown file to generate",
                argument: "out",
                type: "string"
            }
        }
    }, downloadDiscourseTagAsync)

    p.defineCommand({
        name: "downloadplaylists",
        aliases: ["playlists"],
        help: "Download YouTube playlists and generate markdown",
        advanced: true,
        argString: "<list>"
    }, downloadPlaylistsAsync)

    p.defineCommand({
        name: "checkpkgcfg",
        help: "Validate and attempt to fix common pxt.json issues",
    }, validateAndFixPkgConfig);

    advancedCommand("buildshims", "Regenerate shims.d.ts, enums.d.ts", buildShimsAsync)

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
        console.error(`Are you in a package directory?`)
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
    if (pxt.options.debug)
        console.debug(reason)
    if (reason.isUserError) {
        if (pxt.options.debug)
            console.error(reason.stack)
        console.error("error:", reason.message)
        process.exit(1)
    }

    if (!Cloud.accessToken && reason.statusCode == 403) {
        console.error("Got HTTP 403. Did you forget to 'pxt login' ?")
        process.exit(1)
    }

    let msg = reason.stack || reason.message || reason.statusMessage || (reason + "")
    console.error("INTERNAL ERROR:", msg)
    process.exit(20)
}

let cachedSimDir: string = "";
function simDir() {
    const dirSim = "sim";
    const npmSim = `node_modules/pxt-${pxt.appTarget.id}-sim`;
    if (!cachedSimDir) {
        if (nodeutil.existsDirSync(dirSim) && fs.existsSync(path.join(dirSim, "tsconfig.json"))) {
            cachedSimDir = dirSim;
        } else if (fs.existsSync(npmSim) && fs.existsSync(path.join(npmSim, "tsconfig.json"))) {
            cachedSimDir = npmSim;
        }
    }

    return cachedSimDir;
}

// called from pxt npm package
export function mainCli(targetDir: string, args: string[] = process.argv.slice(2)): Promise<void> {
    process.on("unhandledRejection", errorHandler);
    process.on('uncaughtException', errorHandler);

    if (!targetDir) {
        console.error("Please upgrade your pxt CLI module.")
        console.error("   npm update -g pxt")
        process.exit(30)
        return Promise.resolve();
    }

    nodeutil.setTargetDir(targetDir);

    let trg = nodeutil.getPxtTarget()
    fillInCompilerExtension(trg)
    pxt.setAppTarget(trg)

    pxt.github.forceProxy = !!process.env["PXT_FORCE_GITHUB_PROXY"];
    pxt.setCompileSwitches(process.env["PXT_COMPILE_SWITCHES"])
    trg = pxt.appTarget

    let compileId = "none"
    if (trg.compileService) {
        compileId = trg.compileService.buildEngine || "yotta"
    }

    const versions = pxt.appTarget.versions || ({ target: "", pxt: "" } as pxt.TargetVersions);
    pxt.log(`Using target ${trg.id} with build engine ${compileId}`)
    pxt.log(`  target: v${versions.target} ${nodeutil.targetDir}`)
    pxt.log(`  pxt-core: v${versions.pxt} ${nodeutil.pxtCoreDir}`)

    loadGithubToken();
    pxt.HF2.enableLog()

    if (compileId != "none") {
        build.setThisBuild(build.buildEngines[compileId]);
        if (!build.thisBuild) U.userError("cannot find build engine: " + compileId)
    }

    if (process.env["PXT_DEBUG"]) {
        pxt.options.debug = true;
        pxt.debug = pxt.log;
    }

    if (process.env["PXT_ASMDEBUG"]) {
        ts.pxtc.assembler.debug = true
    }

    commonfiles = readJson(__dirname + "/pxt-common.json")

    return initConfigAsync()
        .then(() => {

            if (args[0] != "buildtarget") {
                initTargetCommands();
            }

            if (!pxt.commands.deployFallbackAsync && build.thisBuild.deployAsync)
                pxt.commands.deployFallbackAsync = build.thisBuild.deployAsync

            if (!args[0]) {
                if (pxt.commands.deployFallbackAsync) {
                    pxt.log("running 'pxt deploy' (run 'pxt help' for usage)")
                    args = ["deploy"]
                } else {
                    pxt.log("running 'pxt build' (run 'pxt help' for usage)")
                    args = ["build"]
                }
            }

            return p.parseCommand(args)
                .then(() => {
                    if (readlineCount)
                        (process.stdin as any).unref();
                    return nodeutil.runCliFinalizersAsync()
                });
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
