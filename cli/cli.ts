/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../built/yelmlib.d.ts"/>


import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

Promise = require("bluebird");

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

function fatal(msg: string) {
    console.log("Fatal error:", msg)
    process.exit(1)
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
            if (!mm)
                fatal("Invalid accessToken format, expecting something like 'https://example.com/?access_token=0abcd.XXXX'")
            Cloud.apiRoot = mm[1].replace(/\/$/, "").replace(/\/api$/, "") + "/api/"
            Cloud.accessToken = mm[2]
        }
    }
}

let cmdArgs: string[];

function cmdLogin() {
    if (/^http/.test(cmdArgs[0])) {
        globalConfig.accessToken = cmdArgs[0]
        saveConfig()
    } else {
        let root = Cloud.apiRoot.replace(/api\/$/, "")
        console.log("USAGE:")
        console.log(`  yelm login https://example.com/?access_token=...`)
        console.log(`Go to ${root}oauth/gettoken to obtain the token.`)
        fatal("Bad usage")
    }
}

function cmdApi() {
    let dat = cmdArgs[1] ? eval("(" + cmdArgs[1] + ")") : null
    Cloud.privateRequestAsync({
        url: cmdArgs[0],
        data: dat
    })
        .then(resp => {
            console.log(resp.json)
        })
}

function cmdCompile() {
    let fileText: any = {}
    let fileNames = cmdArgs

    fileNames.forEach(fn => {
        fileText[fn] = fs.readFileSync(fn, "utf8")
    })

    let hexinfo = require("../generated/hexinfo.js");

    let res = ts.mbit.compile({
        fileSystem: fileText,
        sourceFiles: fileNames,
        hexinfo: hexinfo
    })

    Object.keys(res.outfiles).forEach(fn =>
        fs.writeFileSync("../built/" + fn, res.outfiles[fn], "utf8"))

    reportDiagnostics(res.diagnostics);

    process.exit(res.success ? 0 : 1)
}

let readFileAsync: any = Promise.promisify(fs.readFile)
let writeFileAsync: any = Promise.promisify(fs.writeFile)
let execAsync = Promise.promisify(child_process.exec)

function getBitDrivesAsync(): Promise<string[]> {
    if (process.platform == "win32")
        return execAsync("wmic PATH Win32_LogicalDisk get DeviceID, VolumeName, FileSystem")
            .then(buf => {
                let res: string[] = []
                buf.toString("utf8").split(/\n/).forEach(ln => {
                    let m = /^([A-Z]:).* MICROBIT/.exec(ln)
                    if (m) res.push(m[1] + "/")
                })
                return res
            })
    else return Promise.resolve([])
}

class Host
    implements yelm.Host {
    resolve(module: yelm.Package, filename: string) {
        if (module.level == 0)
            return "./" + filename
        else if (module.verProtocol() == "file")
            return module.verArgument() + "/" + filename
        else
            return "yelm_modules/" + module + "/" + filename
    }

    readFileAsync(module: yelm.Package, filename: string): Promise<string> {
        return (<Promise<string>>readFileAsync(this.resolve(module, filename), "utf8"))
            .then(txt => txt, err => {
                return null
            })
    }

    writeFileAsync(module: yelm.Package, filename: string, contents: string): Promise<void> {
        let p = this.resolve(module, filename)
        let check = (p: string) => {
            let dir = p.replace(/\/[^\/]+$/, "")
            if (dir != p) {
                check(dir)
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir)
            }
        }
        check(p)
        return writeFileAsync(p, contents, "utf8")
    }

    getHexInfoAsync() {
        return Promise.resolve(require(__dirname + "/../generated/hexinfo.js"))
    }

    downloadPackageAsync(pkg: yelm.Package) {
        let proto = pkg.verProtocol()

        if (proto == "pub")
            return Cloud.downloadScriptFilesAsync(pkg.verArgument())
                .then(resp =>
                    Util.mapStringMapAsync(resp, (fn: string, cont: string) => {
                        return pkg.host().writeFileAsync(pkg, fn, cont)
                    }))
                .then(() => { })
        else if (proto == "file") {
            console.log(`skip download of local pkg: ${pkg.version()}`)
            return Promise.resolve()
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }

    resolveVersionAsync(pkg: yelm.Package) {
        return Cloud.privateGetAsync(yelm.pkgPrefix + pkg.id).then(r => {
            let id = r["scriptid"]
            if (!id)
                Util.userError("scriptid no set on ptr for pkg " + pkg.id)
            return id
        })
    }

}

let mainPkg = new yelm.MainPackage(new Host())

function cmdInstall() {
    ensurePkgDir();
    if (cmdArgs[0])
        Promise.mapSeries(cmdArgs, n => mainPkg.installPkgAsync(n)).done()
    else
        mainPkg.installAllAsync().done()
}

function cmdInit() {
    mainPkg.initAsync(cmdArgs[0] || "")
        .then(() => mainPkg.installAllAsync())
        .done()
}

function cmdPublish() {
    ensurePkgDir();
    mainPkg.publishAsync().done()
}

function cmdDeploy() {
    cmdBuild(true)
}

function cmdRun() {
    cmdBuild(false, true)
}

function cmdService() {
    let fn = "built/response.json"
    mainPkg.serviceAsync(cmdArgs[0])
        .then(res => {
            if (res.errorMessage) {
                console.error("Error calling service:", res.errorMessage)
                process.exit(1)
                return Promise.resolve()
            } else {
                return mainPkg.host().writeFileAsync(mainPkg, fn, JSON.stringify(res, null, 1))
            }
        })
        .then(() => {
            console.log("wrote results to " + fn)
        })
}

function cmdGenEmbed() {
    let fn = "built/yelmembed.js"
    mainPkg.filesToBePublishedAsync()
        .then(res => {
            return mainPkg.host().writeFileAsync(mainPkg, fn,
                "window.yelmEmbed = window.yelmEmbed || {};\n" +
                "window.yelmEmbed[" + JSON.stringify(mainPkg.config.name) + "] = " +
                JSON.stringify(res, null, 2) + "\n")
        })
        .then(() => {
            console.log("wrote results to " + fn)
        })
}


function cmdTime() {
    ensurePkgDir();
    let min:Util.StringMap<number> = null;
    let loop = () =>
        mainPkg.buildAsync()
            .then(res => {
                if (!min) min = res.times
                else {
                    Util.iterStringMap(min, (k, v) => {
                        min[k] = Math.min(v, res.times[k])
                    })
                }
                console.log(res.times)
            })
    loop()
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

function cmdFormat() {
    if (cmdArgs.length > 0) {
        for (let f of cmdArgs) {
            let t = fs.readFileSync(f, "utf8")
            t = ts.mbit.format(t)
            if (!t) {
                console.log("already formatted:", f)
            } else {
                let fn = "tmp/" + f
                fs.writeFileSync(fn, t, "utf8")
                console.log("written:", fn)
            }
        }
    } else {
        // TODO format files in current package
    }
}

function cmdBuild(deploy = false, run = false) {
    ensurePkgDir();
    mainPkg.buildAsync()
        .then(res => Util.mapStringMapAsync(res.outfiles, (fn, c) =>
            mainPkg.host().writeFileAsync(mainPkg, "built/" + fn, c))
            .then(() => {
                reportDiagnostics(res.diagnostics);
                if (!res.success) process.exit(1)
            })
            .then(() => deploy ? getBitDrivesAsync() : null)
            .then(drives => {
                if (!drives) return
                if (drives.length == 0)
                    console.log("cannot find any drives to deploy to")
                else
                    console.log("copy microbit.hex to " + drives.join(", "))
                Promise.map(drives, d =>
                    writeFileAsync(d + "microbit.hex", res.outfiles["microbit.hex"])
                        .then(() => {
                            console.log("wrote hex file to " + d)
                        }))
            })
            .then(() => {
                if (run) {
                    let f = res.outfiles["microbit.js"]
                    if (f) {
                        let r = new rt.Runtime(f)
                        r.run(() => {
                            console.log("DONE")
                            rt.dumpLivePointers();
                        })
                    }
                }
            })
        )
        .done()
}

interface Command {
    n: string;
    f: () => void;
    a: string;
    d: string;
    o?: number;
}

let cmds: Command[] = [
    { n: "login", f: cmdLogin, a: "ACCESS_TOKEN", d: "set access token config variable" },
    { n: "init", f: cmdInit, a: "PACKAGE_NAME", d: "start new package" },
    { n: "install", f: cmdInstall, a: "[PACKAGE...]", d: "install new packages, or all packages" },
    { n: "publish", f: cmdPublish, a: "", d: "publish current package" },
    { n: "build", f: cmdBuild, a: "", d: "build current package" },
    { n: "deploy", f: cmdDeploy, a: "", d: "build and deploy current package" },
    { n: "run", f: cmdRun, a: "", d: "build and run current package in the simulator" },
    { n: "service", f: cmdService, a: "OPERATION", d: "simulate a query to web worker" },
    { n: "genembed", f: cmdGenEmbed, a: "", d: "generate built/yelmembed.js from current package" },
    { n: "time", f: cmdTime, a: "", d: "measure performance of the compiler on the current package" },
    { n: "format", f: cmdFormat, a: "file.ts...", d: "pretty-print TS files" },
    { n: "help", f: usage, a: "", d: "display this message" },

    { n: "api", f: cmdApi, a: "PATH [DATA]", d: "do authenticated API call", o: 1 },
    { n: "compile", f: cmdCompile, a: "FILE...", d: "hex-compile given set of files", o: 1 },
]

function usage() {
    let f = (s: string, n: number) => {
        while (s.length < n) s += " "
        return s
    }
    let showAll = cmdArgs[0] == "all"
    console.log("USAGE: yelm command args...")
    if (showAll)
        console.log("All commands:")
    else
        console.log("Common commands (use 'yelm help all' to show all):")
    cmds.forEach(cmd => {
        if (showAll || !cmd.o)
            console.log(f(cmd.n, 10) + f(cmd.a, 20) + cmd.d);
    })
    process.exit(1)
}

function goToPkgDir() {
    let goUp = (s: string): string => {
        if (fs.existsSync(s + "/" + yelm.configName))
            return s
        let s2 = path.resolve(path.join(s, ".."))
        if (s != s2)
            return goUp(s2)
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

export function main() {
    // no, please, I want to handle my errors myself
    let async = (<any>Promise)._async
    async.fatalError = (e: any) => async.throwLater(e);
    process.on("unhandledRejection", errorHandler);
    process.on('uncaughtException', errorHandler);

    let args = process.argv.slice(2)
    cmdArgs = args.slice(1)

    initConfig();

    let cmd = args[0]
    if (!cmd) {
        console.log("running 'yelm deploy' (run 'yelm help' for usage)")
        cmd = "deploy"
    }

    let cc = cmds.filter(c => c.n == cmd)[0]
    if (!cc) usage()
    cc.f()
}

main();
