/// <reference path="../../built/pxtcompiler.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";
import * as util from "../common/testUtils";

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
pxt.setAppTarget(util.testAppTarget);

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
    const tsFiles = util.getFilesByExt(casesDir, ".ts")

    describe("with floating point", () => {
        tsFiles.forEach(tsFile => {
            it("should compile and run " + path.basename(tsFile), async function () {
                this.timeout(10000)
                let stsTrace = await compileAndRunStsAsync(tsFile)
                console.log(stsTrace)
                let tsTrace = compileAndRunTs(tsFile)
                console.log(tsTrace)
                let pyFile = await convertTs2Py(tsFile)
                console.dir(pyFile)
                let pyTrace = await runPyAsync(pyFile)
                console.log(pyTrace)
                let py2TsFile = await convertPy2Ts(pyFile)
                console.dir(py2TsFile)
                // convert to ts
                // run ts
                return
            });
        });
    });
});

function runPyAsync(pyFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(`python3 ${pyFile}`, (err, stdout, stderr) => {
            let trace = ""
            if (stdout)
                trace += stdout
            if (stderr)
                trace += stderr
            if (err)
                trace += `${err.name}: ${err.message}\n${err.stack}`
            resolve(trace)
        })
    });
}

async function convertTs2Py(tsFile: string): Promise<string> {
    let pyCode = await util.ts2pyAsync(tsFile)
    const pyFile = path.join(util.replaceFileExtension(tsFile, ".ts.py"));
    fs.writeFileSync(pyFile, pyCode)
    return pyFile
}

async function convertPy2Ts(pyFile: string): Promise<string> {
    let tsCode = await util.py2tsAsync(pyFile)
    const tsFile = path.join(util.replaceFileExtension(pyFile, ".py.ts"));
    fs.writeFileSync(tsFile, tsCode)
    return tsFile
}

function fail(msg: string) {
    chai.assert(false, msg);
}

function emitJsFiles(prog: ts.Program, file?: ts.SourceFile): string[] {
    let jsFiles: string[] = []
    prog.emit(file, (f, data) => {
        fs.writeFileSync(f, data)
        jsFiles.push(f)
    });
    return jsFiles
}

function compileTsToJs(filename: string): ts.Program {
    let cOpts: ts.CompilerOptions = {
        // TODO(dz): check these options
        noEmitOnError: true,
        noImplicitAny: true,
        target: ts.ScriptTarget.ES5,
        module: ts.ModuleKind.ES2015,
        // noLib: true,
        // skipLibCheck: true
    }
    return ts.pxtc.plainTscCompileFiles([filename], cOpts)
}
function evalJs(js: string): string {
    // TODO don't use eval?
    let stout: string[] = []
    let console: any = {}
    console.log = function (str: string) {
        stout.push(str)
        return str
    }
    eval(js)

    return stout.join("\n")
}
function compileAndRunTs(filename: string): string {
    let prog = compileTsToJs(filename)
    let diagnostics = ts.pxtc.getProgramDiagnostics(prog)
    let diagMsgs = diagnostics.map(ts.pxtc.getDiagnosticString)
    if (diagMsgs.length)
        return diagMsgs.join("\n")
    else {
        let fileSrc = prog.getSourceFile(path.basename(filename))
        let jsFiles = emitJsFiles(prog, fileSrc)
        let js = jsFiles
            .map(f => fs.readFileSync(f, { flag: "r" }))
            .map(f => f.toString())
            .join("\n\n")
        let trace = evalJs(js)
        return trace
    }
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