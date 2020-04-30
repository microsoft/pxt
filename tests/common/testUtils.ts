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
        breakBlock: true,
        continueBlock: true,
        bannedCategories: ["banned"]
    },
    corepkg: undefined
}

export interface PyConverterResult {
    python: string;
    ts: string;
    diagnostics: pxtc.KsDiagnostic[];
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

let cachedOpts: pxt.Map<pxtc.CompileOptions> = {}
export function getTestCompileOptsAsync(packageFiles: pxt.Map<string> = { "main.ts": "// no main" }, dependency?: string, includeCommon = false): Promise<pxtc.CompileOptions> {
    let cacheStr = Object.keys(packageFiles).concat(pxt.Util.values(packageFiles)).join("~") + dependency + includeCommon
    let cacheKey = pxt.Util.codalHash16(cacheStr)
    if (!cachedOpts[cacheKey]) {
        const pkg = new pxt.MainPackage(new TestHost("test-pkg", packageFiles, dependency ? [dependency] : [], includeCommon));

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

export function ts2pyAsync(f: string, dependency?: string): Promise<string> {
    const tsMain = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    return getTestCompileOptsAsync({ "main.ts": tsMain }, dependency, !!dependency)
        .then(opts => {
            let program = pxtc.getTSProgram(opts);
            // TODO: if needed, we can re-use the CallInfo annotations the blockly decompiler can add
            // annotate(program, tsFile, target || (pxt.appTarget && pxt.appTarget.compile));
            const decompiled = pxt.py.decompileToPython(program, "main.ts");

            if (decompiled.success) {
                return decompiled.outfiles["main.py"];
            }
            else {
                return Promise.reject(new Error("Could not convert ts to py " + f + JSON.stringify(decompiled.diagnostics, null, 4)));
            }
        })
}

export function py2tsAsync(f: string, dependency = "bare", allowErrors = false): Promise<PyConverterResult> {
    const input = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    return getTestCompileOptsAsync({ "main.py": input, "main.ts": "// no main" }, dependency, true)
        .then(opts => {
            opts.target.preferredEditor = pxt.JAVASCRIPT_PROJECT_NAME
            let stsCompRes = pxtc.compile(opts);
            let apisInfo = pxtc.getApiInfo(stsCompRes.ast, opts.jres)
            if (!apisInfo || !apisInfo.byQName)
                throw Error("Failed to get apisInfo")
            opts.apisInfo = apisInfo

            opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME

            let { outfiles, diagnostics } = pxt.py.py2ts(opts)

            let success = diagnostics.length == 0

            if (success || allowErrors) {
                return {
                    python: input,
                    ts: opts.fileSystem["main.ts"],
                    diagnostics
                };
            }
            else {
                let partialOutput = outfiles["main.ts"]
                let errorStr = diagnostics.map(pxtc.getDiagnosticString).join()
                return Promise.reject(new Error(`Could not convert py to ts ${f}\n${errorStr}\n${partialOutput}`))
            }
        })
}

export function stsAsync(tsMain: string): Promise<pxtc.CompileResult> {
    return getTestCompileOptsAsync({ "main.ts": tsMain }, "bare")
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