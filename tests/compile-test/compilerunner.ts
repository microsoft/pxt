/// <reference path="../../built/pxtcompiler.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";


const casesDir = path.join(process.cwd(), "tests", "compile-test", "lang-test0");
const bareDir = path.relative(process.cwd(), path.join("tests", "compile-test", "bare"));

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
    private basename: string;
    private fileText: string;
    static langTestText: string;

    constructor(public filename: string) {
        super("compile-test", "", [], true);
        this.basename = path.basename(filename);
        this.fileText = fs.readFileSync(filename, "utf8");

        if (!CompileHost.langTestText) {
            CompileHost.langTestText = fs.readFileSync(path.join(casesDir, "lang-test0.ts"), "utf8");
        }
    }

    readFile(module: pxt.Package, filename: string): string {
        if (module.id === "this") {
            if (filename === "pxt.json") {
                return JSON.stringify({
                        "name": this.name,
                        "dependencies": { "bare": "file:" + bareDir },
                        "description": "",
                        "files": [
                            "lang-test0.ts",
                            "main.ts",
                        ]
                    })
            }
            else if (filename === "main.ts") {
                return this.fileText;
            }
            else if (filename === "lang-test0.ts") {
                return CompileHost.langTestText;
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
        if (file[0] == "." || file == "lang-test0.ts") {
            continue;
        }

        const filename = path.join(casesDir, file)
        if (file.substr(-3) === ".ts") {
            filenames.push(filename)
        }
    };

    describe("with floating point", () => {
        filenames.forEach(filename => {
            it("should compile and run " + path.basename(filename), function() {
                this.timeout(10000)
                return compileTestAsync(filename)
            });
        });
    });
});

function fail(msg: string) {
    chai.assert(false, msg);
}

function compileTestAsync(filename: string) {
    const pkg = new pxt.MainPackage(new CompileHost(filename));

    const target = pkg.getTargetOptions();
    target.isNative = false;

    return pkg.getCompileOptionsAsync(target)
        .then(opts => {
            opts.ast = true;
            const compiled = pxtc.compile(opts);
            if (compiled.success) {
                return runCoreAsync(compiled)
            }
            else {
                return Promise.reject("Could not compile " + filename + JSON.stringify(compiled.diagnostics, null, 4));
            }
        })
}

function runCoreAsync(res: pxtc.CompileResult) {
    return new Promise<void>((resolve, reject) => {
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
            r.run(() => {
                clearTimeout(timeout);
                pxsim.dumpLivePointers();
                resolve()
            })
        }
        else {
            reject(new Error("No compiled js"));
        }
    })
}