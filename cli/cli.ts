/// <reference path="../node_modules/typescript/lib/typescriptServices.d.ts"/>
/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../built/yelmlib.d.ts"/>


import * as fs from 'fs';
import * as path from 'path';

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
        fatal("Usage: yelm login https://.../?access_token=...\nGo to https://www.touchdevelop.com/oauth/gettoken to obtain the token.")
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

class Host
    implements yelm.Host {
    resolve(module: string, filename: string) {
        if (module == "this")
            return "./" + filename
        else if (this.hasLocalPackage(module))
            return "../" + module + "/" + filename
        else
            return "yelm_modules/" + module + "/" + filename
    }

    readFileAsync(module: string, filename: string): Promise<string> {
        return (<Promise<string>>readFileAsync(this.resolve(module, filename), "utf8"))
            .then(txt => txt, err => {
                //console.log(err.message)
                return null
            })
    }

    writeFileAsync(module: string, filename: string, contents: string): Promise<void> {
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

    localPkgs: Util.StringMap<number> = null;

    hasLocalPackage(name: string) {
        if (!this.localPkgs) {
            this.localPkgs = {}
            let files = fs.readdirSync("..")
            if (files.indexOf("yelmlocal.json") >= 0) {
                files.forEach(f => {
                    if (fs.existsSync("../" + f + "/" + yelm.configName))
                        this.localPkgs[f] = 1;
                })
            }
        }
        return this.localPkgs.hasOwnProperty(name)
    }
}

let mainPkg = new yelm.MainPackage(new Host())

function cmdInstall() {
    if (cmdArgs[0])
        Promise.mapSeries(cmdArgs, n => mainPkg.installPkgAsync(n)).done()
    else
        mainPkg.installAllAsync().done()
}

function cmdInit() {
    mainPkg.initAsync(cmdArgs[0] || "").done()
}

function cmdPublish() {
    mainPkg.publishAsync().done()
}

function cmdBuild() {
    mainPkg.buildAsync()
        .then(res => {
            return Util.mapStringMapAsync(res.outfiles, (fn, c) =>
                mainPkg.host().writeFileAsync("this", "built/" + fn, c))
        })
        .done()
}

interface Command {
    n: string;
    f: () => void;
    a: string;
    d: string;
}

let cmds: Command[] = [
    { n: "login", f: cmdLogin, a: "ACCESS_TOKEN", d: "set access token config variable" },
    { n: "init", f: cmdInit, a: "PACKAGE_NAME", d: "start new package" },
    { n: "install", f: cmdInstall, a: "[PACKAGE...]", d: "install new packages, or all packages" },
    { n: "publish", f: cmdPublish, a: "", d: "publish current package" },
    { n: "build", f: cmdBuild, a: "", d: "build current package" },
    { n: "api", f: cmdApi, a: "PATH [DATA]", d: "do authenticated API call" },
    { n: "compile", f: cmdCompile, a: "FILE...", d: "hex-compile given set of files" },
]

function usage() {
    console.log("USAGE: yelm command args...")
    let f = (s: string, n: number) => {
        while (s.length < n) s += " "
        return s
    }
    cmds.forEach(cmd => {
        console.log(f(cmd.n, 10) + f(cmd.a, 20) + cmd.d);
    })
    process.exit(1)
}

export function main() {
    let args = process.argv.slice(2)
    cmdArgs = args.slice(1)

    initConfig();

    let cmd = args[0]
    if (!cmd)
        usage()
    let cc = cmds.filter(c => c.n == cmd)[0]
    if (!cc) usage()
    cc.f()
}

main();
