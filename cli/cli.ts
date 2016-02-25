/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../built/yelmlib.d.ts"/>


import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import Util = yelm.Util;
import Cloud = yelm.Cloud;

let prevExports = (global as any).savedModuleExports
if (prevExports) {
    module.exports = prevExports
}

export interface UserConfig {
    accessToken?: string;
}

let reportDiagnostic = reportDiagnosticSimply;

function reportDiagnostics(diagnostics: ts.Diagnostic[]): void {
    for (const diagnostic of diagnostics) {
        reportDiagnostic(diagnostic);
    }
}

function reportDiagnosticSimply(diagnostic: ts.Diagnostic): void {
    let output = "";

    if (diagnostic.file) {
        const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
        const relativeFileName = diagnostic.file.fileName;
        output += `${relativeFileName}(${line + 1},${character + 1}): `;
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

function configPath() {
    let home = process.env["HOME"] || process.env["UserProfile"]
    return home + "/.yelm/config.json"
}

function saveConfig() {
    let path = configPath();
    try {
        fs.mkdirSync(path.replace(/config.json$/, ""))
    } catch (e) { }
    fs.writeFileSync(path, JSON.stringify(globalConfig, null, 4) + "\n")
}

function initConfig() {
    if (fs.existsSync(configPath())) {
        let config = <UserConfig>JSON.parse(fs.readFileSync(configPath(), "utf8"))
        globalConfig = config
        if (config.accessToken) {
            let mm = /^(https?:.*)\?access_token=([\w\.]+)/.exec(config.accessToken)
            if (!mm) {
                fatal("Invalid accessToken format, expecting something like 'https://example.com/?access_token=0abcd.XXXX'")
            }
            Cloud.apiRoot = mm[1].replace(/\/$/, "").replace(/\/api$/, "") + "/api/"
            Cloud.accessToken = mm[2]
        }
    }
}

export function loginAsync(access_token: string) {
    if (/^http/.test(access_token)) {
        globalConfig.accessToken = access_token
        saveConfig()
    } else {
        let root = Cloud.apiRoot.replace(/api\/$/, "")
        console.log("USAGE:")
        console.log(`  yelm login https://example.com/?access_token=...`)
        console.log(`Go to ${root}oauth/gettoken to obtain the token.`)
        return fatal("Bad usage")
    }

    return Promise.resolve()
}

export function apiAsync(path: string, postArguments?: string) {
    let dat = postArguments ? eval("(" + postArguments + ")") : null
    return Cloud.privateRequestAsync({
        url: path,
        data: dat
    })
        .then(resp => {
            console.log(resp.json)
        })
}

function extensionAsync(add: string) {
    let dat = {
        "config": "ws",
        "tag": "v74",
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

export function compileAsync(...fileNames: string[]) {
    let fileText: any = {}

    fileNames.forEach(fn => {
        fileText[fn] = fs.readFileSync(fn, "utf8")
    })

    let hexinfo = require("../generated/hexinfo.js");

    let res = ts.yelm.compile({
        fileSystem: fileText,
        sourceFiles: fileNames,
        hexinfo: hexinfo
    })

    Object.keys(res.outfiles).forEach(fn =>
        fs.writeFileSync("../built/" + fn, res.outfiles[fn], "utf8"))

    reportDiagnostics(res.diagnostics);

    if (!res.success)
        return Promise.reject(new Error("Errors compiling"))

    return Promise.resolve()
}

let readFileAsync: any = Promise.promisify(fs.readFile)
let writeFileAsync: any = Promise.promisify(fs.writeFile)
let execAsync = Promise.promisify(child_process.exec)

function getBitDrivesAsync(): Promise<string[]> {
    if (process.platform == "win32") {
        return execAsync("wmic PATH Win32_LogicalDisk get DeviceID, VolumeName, FileSystem")
            .then(buf => {
                let res: string[] = []
                buf.toString("utf8").split(/\n/).forEach(ln => {
                    let m = /^([A-Z]:).* MICROBIT/.exec(ln)
                    if (m) {
                        res.push(m[1] + "/")
                    }
                })
                return res
            })
    } else {
        return Promise.resolve([])
    }
}

class Host
    implements yelm.Host {
    resolve(module: yelm.Package, filename: string) {
        if (module.level == 0) {
            return "./" + filename
        } else if (module.verProtocol() == "file") {
            return module.verArgument() + "/" + filename
        } else {
            return "yelm_modules/" + module + "/" + filename
        }
    }

    readFile(module: yelm.Package, filename: string): string {
        let resolved = this.resolve(module, filename)
        try {
            return fs.readFileSync(resolved, "utf8")
        } catch (e) {
            return null
        }
    }

    writeFile(module: yelm.Package, filename: string, contents: string): void {
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

    getHexInfoAsync() {
        return Promise.resolve(require(__dirname + "/../generated/hexinfo.js"))
    }

    downloadPackageAsync(pkg: yelm.Package) {
        let proto = pkg.verProtocol()

        if (proto == "pub") {
            return Cloud.downloadScriptFilesAsync(pkg.verArgument())
                .then(resp =>
                    Util.iterStringMap(resp, (fn: string, cont: string) => {
                        pkg.host().writeFile(pkg, fn, cont)
                    }))
        } else if (proto == "file") {
            console.log(`skip download of local pkg: ${pkg.version()}`)
            return Promise.resolve()
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }

    resolveVersionAsync(pkg: yelm.Package) {
        return Cloud.privateGetAsync(yelm.pkgPrefix + pkg.id).then(r => {
            let id = r["scriptid"]
            if (!id) {
                Util.userError("scriptid no set on ptr for pkg " + pkg.id)
            }
            return id
        })
    }

}

let mainPkg = new yelm.MainPackage(new Host())

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
    Deploy
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

export function genembedAsync() {
    let fn = "built/yelmembed.js"
    return mainPkg.filesToBePublishedAsync()
        .then(res => {
            mainPkg.host().writeFile(mainPkg, fn,
                "window.yelmEmbed = window.yelmEmbed || {};\n" +
                "window.yelmEmbed[" + JSON.stringify(mainPkg.config.name) + "] = " +
                JSON.stringify(res, null, 2) + "\n")
            console.log("wrote results to " + fn)
        })
}

export function timeAsync() {
    ensurePkgDir();
    let min: Util.StringMap<number> = null;
    let loop = () =>
        mainPkg.buildAsync()
            .then(res => {
                if (!min) {
                    min = res.times
                } else {
                    Util.iterStringMap(min, (k, v) => {
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
    if (fileNames[0] == "-i") {
        fileNames.shift()
        inPlace = true
    }

    if (fileNames.length > 0) {
        for (let f of fileNames) {
            let t = fs.readFileSync(f, "utf8")
            t = ts.yelm.format(t)
            let fn = f + ".new"
            if (!t) {
                console.log("already formatted:", f)
                if (!inPlace)
                    fs.unlink(fn, err => { })
            } else {
                if (inPlace) {
                    fs.writeFileSync(f, t, "utf8")
                    console.log("replaced:", f)
                } else {
                    fs.writeFileSync(fn, t, "utf8")
                    console.log("written:", fn)
                }
            }
        }
    } else {
        // TODO format files in current package
    }

    return Promise.resolve()
}

function deployCoreAsync(res: ts.yelm.CompileResult) {
    return getBitDrivesAsync()
        .then(drives => {
            if (drives.length == 0) {
                console.log("cannot find any drives to deploy to")
            } else {
                console.log("copy microbit.hex to " + drives.join(", "))
            }
            return Promise.map(drives, d =>
                writeFileAsync(d + "microbit.hex", res.outfiles["microbit.hex"])
                    .then(() => {
                        console.log("wrote hex file to " + d)
                    }))
        })
        .then(() => { })
}

function runCoreAsync(res: ts.yelm.CompileResult) {
    let f = res.outfiles["microbit.js"]
    if (f) {
        let r = new yelm.rt.Runtime(f)
        r.run(() => {
            console.log("DONE")
            yelm.rt.dumpLivePointers();
        })
    }
    return Promise.resolve()
}

function buildCoreAsync(mode: BuildOption) {
    ensurePkgDir();
    return mainPkg.buildAsync()
        .then(res => {
            Util.iterStringMap(res.outfiles, (fn, c) =>
                mainPkg.host().writeFile(mainPkg, "built/" + fn, c))
            reportDiagnostics(res.diagnostics);
            if (!res.success) {
                process.exit(1)
            }

            if (mode == BuildOption.Deploy)
                return deployCoreAsync(res);
            else if (mode == BuildOption.Run)
                return runCoreAsync(res);
            else
                return null;
        })
}

export function buildAsync() {
    return buildCoreAsync(BuildOption.JustBuild)
}

export function deployAsync() {
    return buildCoreAsync(BuildOption.Deploy)
}

export function runAsync() {
    return buildCoreAsync(BuildOption.Run)
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

cmd("login    ACCESS_TOKEN    - set access token config variable", loginAsync)
cmd("init     PACKAGE_NAME    - start new package", initAsync)
cmd("install  [PACKAGE...]    - install new packages, or all packages", installAsync)
cmd("publish                  - publish current package", publishAsync)
cmd("build                    - build current package", buildAsync)
cmd("deploy                   - build and deploy current package", deployAsync)
cmd("run                      - build and run current package in the simulator", runAsync)
cmd("format   [-i] file.ts... - pretty-print TS files; -i = in-place", formatAsync)
cmd("help                     - display this message", helpAsync)

cmd("api      PATH [DATA]     - do authenticated API call", apiAsync, 1)
cmd("genembed                 - generate built/yelmembed.js from current package", genembedAsync, 1)
cmd("service  OPERATION       - simulate a query to web worker", serviceAsync, 2)
cmd("compile  FILE...         - hex-compile given set of files", compileAsync, 2)
cmd("time                     - measure performance of the compiler on the current package", timeAsync, 2)

cmd("extension ADD_TEXT       - try compile extension", extensionAsync, 10)

export function helpAsync(all?: string) {
    let f = (s: string, n: number) => {
        while (s.length < n) {
            s += " "
        }
        return s
    }
    let showAll = all == "all"
    console.log("USAGE: yelm command args...")
    if (showAll) {
        console.log("All commands:")
    } else {
        console.log("Common commands (use 'yelm help all' to show all):")
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
        if (fs.existsSync(s + "/" + yelm.configName)) {
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
        console.error(`Cannot find ${yelm.configName} in any of the parent directories.`)
        process.exit(1)
    } else {
        if (dir != process.cwd()) {
            console.log(`Going up to ${dir} which has ${yelm.configName}`)
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

export function mainCli() {
    process.on("unhandledRejection", errorHandler);
    process.on('uncaughtException', errorHandler);

    let args = process.argv.slice(2)

    initConfig();

    let cmd = args[0]
    if (!cmd) {
        console.log("running 'yelm deploy' (run 'yelm help' for usage)")
        cmd = "deploy"
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
    g.yelm = yelm;
    g.ts = ts;
}

initGlobals();

if (require.main === module) {
    mainCli();
}
