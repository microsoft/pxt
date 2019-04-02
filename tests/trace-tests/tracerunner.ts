/// <reference path="../../built/pxtcompiler.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";

const casesDir = path.join(process.cwd(), "tests", "trace-tests", "cases");

// TODO(dz): de-duplicate with compile-test

function initGlobals() {
    Promise = require("bluebird");
    let g = global as any
    g.pxt = pxt;
    g.ts = ts;
    g.pxtc = pxtc;
    g.btoa = (str: string) => new Buffer(str, "binary").toString("base64");
    g.atob = (str: string) => new Buffer(str, "base64").toString("binary");
}

initGlobals();

// Just needs to exist
pxt.setAppTarget({
    id: "core",
    name: "Microsoft MakeCode",
    title: "Microsoft MakeCode",
    versions: undefined,
    description: "A toolkit to build JavaScript Blocks editors.",
    bundleddirs: [],
    compile: {
        isNative: false,
        hasHex: false,
        jsRefCounting: true,
        switches: {}
    },
    bundledpkgs: {},
    appTheme: {},
    tsprj: undefined,
    blocksprj: undefined,
    corepkg: undefined
});


class CompileHost extends TestHost {
    private fileText: string;
    static langTestText: string;

    constructor(public filename: string) {
        super("trace-tests", "", [], true);
        this.fileText = fs.readFileSync(filename, "utf8");
    }

    readFile(module: pxt.Package, filename: string): string {
        if (module.id === "this") {
            if (filename === "pxt.json") {
                return JSON.stringify({
                    "name": this.name,
                    "dependencies": { "bare": "file:../bare" },
                    "description": "",
                    "files": [
                        "main.ts",
                        "sts_prelude.ts"
                    ]
                })
            }
            else if (filename === "main.ts") {
                return this.fileText;
            } else if (filename === "sts_prelude.ts") {
                return `
let console: any = {}
console.log = function(s: string): void {
    control.__log(s)
    control.__log("\\n")
    control.dmesg(s)
    //serial.writeString(s)
    //serial.writeString("\\n")
    //pause(50);
}
                `
            }
        }

        return super.readFile(module, filename);
    }
}

describe("ts compiler", () => {
    before(() => {
        pxsim.initCurrentRuntime = pxsim.initBareRuntime
    })
    const filenames: string[] = [];
    for (const file of fs.readdirSync(casesDir)) {
        if (file[0] == ".") {
            continue;
        }

        const filename = path.join(casesDir, file)
        if (file.substr(-3) === ".ts") {
            filenames.push(filename)
        }
    };

    describe("with floating point", () => {
        filenames.forEach(filename => {
            it("should compile and run " + path.basename(filename), async function () {
                this.timeout(10000)
                let stsTrace = await compileAndRunStsAsync(filename)
                console.log(stsTrace)
                let tsTrace = compileAndRunTsAsync(filename)
                console.log(tsTrace)
                // TODO
                // convert to py
                // run py
                // convert to ts
                // run ts
                return
            });
        });
    });
});

function fail(msg: string) {
    chai.assert(false, msg);
}


function compileAndRunTsAsync(filename: string): string {
    let compProg = compileTs(filename)

    // console.log("compProg")
    // console.log(compProg)

    // TODO don't use eval?
    let stout: string[] = []
    let console: any = {}
    console.log = function (str: string) {
        stout.push(str)
        return str
    }
    eval(compProg)

    return stout.join("\n")
}

function compileTs(filename: string): string {
    let fts = fs.readFileSync(filename, { flag: "r" }).toString()
    // console.log("fts")
    // console.log(fts)

    let cOpts: ts.CompilerOptions = {
        // TODO(dz): check these options
        noEmitOnError: true,
        noImplicitAny: true,
        target: ts.ScriptTarget.ES5,
        module: ts.ModuleKind.ES2015,
        // noLib: true,
        // skipLibCheck: true
    }
    const compilerHost = ts.createCompilerHost(cOpts);
    compilerHost.getDefaultLibFileName = () => "node_modules/typescript/lib/lib.d.ts"
    let program = ts.createProgram([filename], cOpts, compilerHost);
    let jsFile: string
    let emitResult = program.emit(program.getSourceFile(path.basename(filename)), (f) => {
        jsFile = f
    });
    let jsOut: string
    if (jsFile)
        jsOut = fs.readFileSync(jsFile, { flag: "r" }).toString()

    let allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);

    let diagMsgs: string[] = []
    allDiagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            diagMsgs.push(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}\n`)
        } else {
            diagMsgs.push(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`)
        }
    });

    let failed = emitResult.emitSkipped || !jsOut
    let res: string
    if (failed) {
        res = diagMsgs.join("\n")
    }
    else {
        res = jsOut
    }
    return res
}

function compileAndRunStsAsync(filename: string): Promise<string> {
    const pkg = new pxt.MainPackage(new CompileHost(filename));

    const target = pkg.getTargetOptions();
    target.isNative = false;

    return pkg.getCompileOptionsAsync(target)
        .then(opts => {
            opts.ast = true;
            const compiled = pxtc.compile(opts);
            if (compiled.success) {
                return runStsAsync(compiled)
            }
            else {
                return Promise.reject("Could not compile " + filename + JSON.stringify(compiled.diagnostics, null, 4));
            }
        })
}

function runStsAsync(res: pxtc.CompileResult): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let f = res.outfiles[pxtc.BINARY_JS]
        if (f) {
            let timeout = setTimeout(() => {
                reject(new Error("Simulating code timed out"))
            }, 5000);
            let r = new pxsim.Runtime({ type: "run", code: f })
            r.errorHandler = (e) => {
                clearTimeout(timeout);
                reject(e);
            }
            let trace = ""
            pxsim.Runtime.messagePosted = (msg) => {
                if (msg.type === "bulkserial") {
                    let smsg = msg as pxsim.SimulatorBulkSerialMessage
                    for (let m of smsg.data)
                        trace += `${m.data}\n`
                }
            }
            r.run(() => {
                clearTimeout(timeout);
                pxsim.dumpLivePointers();
                resolve(trace)
            })
        }
        else {
            reject(new Error("No compiled js"));
        }
    })
}