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

    return a === b;
}

export function replaceFileExtension(file: string, extension: string) {
    return file && file.substr(0, file.length - path.extname(file).length) + extension;
}

// TODO merge into testHost?
class CompileHost extends TestHost {
    private fileText: string;
    static langTestText: string;

    constructor(mainStr?: string, dependency?: string) {
        super("test-pkg", "", dependency ? [dependency] : [], true);
        this.fileText = mainStr || "// no main function provided"
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
                    ]
                })
            }
            else if (filename === "main.ts") {
                return this.fileText;
            }
        }

        return super.readFile(module, filename);
    }
}

let cachedOpts: pxt.Map<pxtc.CompileOptions> = {}
export function getTestCompileOptsAsync(tsMain: string = "// no main", dependency?: string, includeCommon = false): Promise<pxtc.CompileOptions> {
    let cacheKey = pxt.Util.codalHash16(tsMain + dependency)
    if (!cachedOpts[cacheKey]) {
        const pkg = new pxt.MainPackage(new TestHost("test-pkg", tsMain, dependency ? [dependency] : [], includeCommon));

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
    const tsMain = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    return getTestCompileOptsAsync(tsMain)
        .then(opts => {
            let program = pxtc.getTSProgram(opts);
            // TODO: if needed, we can re-use the CallInfo annotations the blockly decompiler can add
            // annotate(program, tsFile, target || (pxt.appTarget && pxt.appTarget.compile));
            const decompiled = (pxt as any).py.decompileToPythonHelper(program, "main.ts");

            if (decompiled.success) {
                return decompiled.outfiles["main.py"];
            }
            else {
                return Promise.reject(new Error("Could not conver ts to py " + f + JSON.stringify(decompiled.diagnostics, null, 4)));
            }
        })
}

export function py2tsAsync(f: string): Promise<string> {
    // TODO(dz): this doesn't work yet. Ask dazuniga and/or see dazuniga/py2ts_debug
    return getTestCompileOptsAsync()
        .then(opts => {
            opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME
            const input = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
            let pyFile = "main.py";
            opts.fileSystem[pyFile] = input;

            let { generated, diagnostics } = pxt.py.py2ts(opts)

            let success = diagnostics.length == 0

            if (success) {
                return opts.fileSystem["main.ts"];
            }
            else {
                return Promise.reject(new Error("Could not convert py to ts " + f + JSON.stringify(diagnostics, null, 4)))
            }
        })
}

export function stsAsync(tsMain: string): Promise<pxtc.CompileResult> {
    return getTestCompileOptsAsync(tsMain, "bare")
        .then(opts => {
            const compiled = pxtc.compile(opts);
            if (compiled.success) {
                return compiled
            }
            else {
                let errStr = compiled.diagnostics.map(pxtc.getDiagnosticString).join("")
                return Promise.reject(new Error("Static Typescript could not compile:\n" + tsMain + "\nbecause:\n" + errStr));
            }
        })
}