/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtcompiler.d.ts"/>
/// <reference path="../../built/pxtpy.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import { TestHost } from "./testHost";

export function getFilesByExt(dir: string, ext: string): string[] {
    return fs.readdirSync(dir)
        .filter(f => f[0] != ".")
        .filter(f => f.substr(-ext.length) === ext)
        .map(f => path.join(dir, f))
}

export const testAppTarget: pxt.TargetBundle = {
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
    runtime: {
        pauseUntilBlock: { category: "Loops", color: "0x0000ff" },
        bannedCategories: ["banned"]
    },
    corepkg: undefined
}

export function compareBaselines(a: string, b: string): boolean {
    // Ignore whitespace
    a = a.replace(/\s/g, "");
    b = b.replace(/\s/g, "");

    // Strip encoded carriage-return from grey blocks
    a = a.replace(/&#13;/g, "");
    b = b.replace(/&#13;/g, "");

    // Ignore error messages in TS statement mutations
    a = a.replace(/error="[^"]*"/g, "");
    b = b.replace(/error="[^"]*"/g, "");

    // Ignore IDs
    a = a.replace(/id="[^"]*"/g, "");
    b = b.replace(/id="[^"]*"/g, "");

    return a === b;
}

export function replaceFileExtension(file: string, extension: string) {
    return file && file.substr(0, file.length - path.extname(file).length) + extension;
}

export interface TestPackageOpts {
    dependency?: string,
    mainFile?: string,
    stsPrelude?: string
}

// TODO merge into testHost?
class CompileHost extends TestHost {
    private fileText: string;
    private stsPrelude: string;
    static langTestText: string;

    constructor(mainFile?: string, stsPrelude?: string, dependency?: string) {
        super("test-pkg", "", dependency ? [dependency] : [], true);
        if (mainFile)
            this.fileText = fs.readFileSync(mainFile, "utf8");
        else
            this.fileText = "// no main function provided"
        this.stsPrelude = stsPrelude || ""
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
                return this.stsPrelude
            }
        }

        return super.readFile(module, filename);
    }
}

let cachedOpts: pxt.Map<pxtc.CompileOptions> = {}
export function getTestCompileOptsAsync(summary: TestPackageOpts): Promise<pxtc.CompileOptions> {
    let cacheKey = `${summary.dependency}${summary.mainFile}${summary.stsPrelude}`
    if (!cachedOpts[cacheKey]) {
        const pkg = new pxt.MainPackage(new CompileHost(summary.mainFile, summary.stsPrelude, summary.dependency));

        const target = pkg.getTargetOptions();
        target.isNative = false;

        return pkg.getCompileOptionsAsync(target)
            .then(opts => {
                opts.ast = true;
                opts.testMode = true;
                opts.ignoreFileResolutionErrors = true;
                return cachedOpts[cacheKey] = opts
            });
    }
    // Clone cached options so that tests can individually modify their own options copy
    let opts = JSON.parse(JSON.stringify(cachedOpts[cacheKey]))
    return Promise.resolve(opts);
}

export function ts2pyAsync(f: string): Promise<string> {
    return getTestCompileOptsAsync({})
        .then(opts => {
            const input = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
            let tsFile = "main.ts";
            opts.fileSystem[tsFile] = input;

            let program = pxtc.getTSProgram(opts);
            // TODO: if needed, we can re-use the CallInfo annotations the blockly decompiler can add
            // annotate(program, tsFile, target || (pxt.appTarget && pxt.appTarget.compile));
            const decompiled = (pxt as any).py.decompileToPythonHelper(program, tsFile);

            if (decompiled.success) {
                return decompiled.outfiles["main.py"];
            }
            else {
                return Promise.reject("Could not conver ts to py " + f + JSON.stringify(decompiled.diagnostics, null, 4));
            }
        })
}

export function py2tsAsync(f: string): Promise<string> {
    return getTestCompileOptsAsync({})
        .then(opts => {
            const input = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
            let pyFile = "main.py";
            opts.fileSystem[pyFile] = input;

            let { generated, diagnostics } = pxt.py.py2ts(opts)

            let success = diagnostics.length == 0

            if (success) {
                return opts.fileSystem["main.ts"];
            }
            else {
                return Promise.reject("Could not convert py to ts " + f + JSON.stringify(diagnostics, null, 4));
            }
        })
}

export function stsAsync(f: string, stsPrelude?: string): Promise<pxtc.CompileResult> {
    return getTestCompileOptsAsync({ mainFile: f, stsPrelude: stsPrelude })
        .then(opts => {
            const compiled = pxtc.compile(opts);
            if (compiled.success) {
                return compiled
            }
            else {
                return Promise.reject("Could not compile " + f + JSON.stringify(compiled.diagnostics, null, 4));
            }
        })
}