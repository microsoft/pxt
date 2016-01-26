/// <reference path="../node_modules/typescript/lib/typescriptServices.d.ts"/>
/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../built/yelmlib.d.ts"/>
/// <reference path="../built/emitter.d.ts"/>


import * as fs from 'fs';

namespace yelm {
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
    
    function cmdBuild() {
        
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

    interface Command {
        n: string;
        f: () => void;
        a: string;
        d: string;
    }

    let cmds: Command[] = [
        { n: "login", f: cmdLogin, a: "ACCESS_TOKEN", d: "set access token config variable" },
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
}

yelm.main();
