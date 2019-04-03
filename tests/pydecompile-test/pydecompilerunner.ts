/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";

// uses the same test cases as the blocks decompiler tests
const casesDir = path.join(process.cwd(), "tests", "decompile-test", "cases");
const testPythonDir = path.relative(process.cwd(), path.join("tests", "decompile-test", "cases", "testBlocks"));

const baselineDir = path.join(process.cwd(), "tests", "pydecompile-test", "baselines");

function initGlobals() {
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
    runtime: {
        pauseUntilBlock: { category: "Loops", color: "0x0000ff" },
        bannedCategories: ["banned"]
    },
    corepkg: undefined
});

// TODO: deduplicate this code with decompilerrunner.ts
describe("pydecompiler", () => {
    let filenames: string[] = [];
    for (const file of fs.readdirSync(casesDir)) {
        if (file[0] == ".") {
            continue;
        }

        const filename = path.join(casesDir, file);
        if (file.substr(-3) === ".ts") {
            filenames.push(filename);
        }
    };

    // FYI: uncomment these lines to whitelist or blacklist tests for easier development
    // let whitelist = ["string_length", "game"]
    // let blacklist = [
    //     "shadowing",
    //     "always_decompile_renames",
    //     "always_decompile_renames_expressions",
    //     "always_unsupported_operators",
    // ]
    // filenames = filenames
    //     .filter(f => !blacklist.some(s => f.indexOf(s) > 0))
    //     .filter(f => whitelist.some(s => f.indexOf(s) > 0))

    filenames.forEach(filename => {
        it("should decompile " + path.basename(filename), () => {
            return pydecompileTestAsync(filename);
        });
    });
});

function fail(msg: string) {
    chai.assert(false, msg);
}

function pydecompileTestAsync(filename: string) {
    return new Promise((resolve, reject) => {
        const basename = path.basename(filename);
        const baselineFile = path.join(baselineDir, replaceFileExtension(basename, ".py"))

        let baselineExists: boolean;
        try {
            const stats = fs.statSync(baselineFile)
            baselineExists = stats.isFile()
        }
        catch (e) {
            baselineExists = false
        }

        return decompileAsyncWorker(filename, testPythonDir)
            .then(decompiled => {
                const outFile = path.join(replaceFileExtension(baselineFile, ".local.py"));

                if (!baselineExists) {
                    fs.writeFileSync(outFile, decompiled)
                    fail(`no baseline found for ${basename}, output written to ${outFile}`);
                    return;
                }

                const baseline = fs.readFileSync(baselineFile, "utf8")
                if (!compareBaselines(decompiled, baseline)) {
                    fs.writeFileSync(outFile, decompiled)
                    fail(`${basename} did not match baseline, output written to ${outFile}`);
                }
            }, error => {
                const outFile = path.join(replaceFileExtension(baselineFile, ".local.py"));
                fs.writeFileSync(outFile, error.stack)
                fail("Could not decompile: " + error.stack)
            })
            .then(() => resolve(), reject);
    });
}

function compareBaselines(a: string, b: string): boolean {
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

function replaceFileExtension(file: string, extension: string) {
    return file && file.substr(0, file.length - path.extname(file).length) + extension;
}

let cachedOpts: pxtc.CompileOptions;

function decompileAsyncWorker(f: string, dependency?: string): Promise<string> {
    return getOptsAsync(dependency)
        .then(opts => {
            const input = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
            let tsFile = "main.ts";
            opts.fileSystem[tsFile] = input;
            opts.ast = true;
            opts.testMode = true;
            opts.ignoreFileResolutionErrors = true;
            if (path.basename(f).indexOf("functions_v2") === 0) {
                opts.useNewFunctions = true;
            }
            // const decompiled = pxtc.pydecompile(opts, tsFile);

            let program = pxtc.getTSProgram(opts);
            // TODO: if needed, we can re-use the CallInfo annotations the blockly decompiler can add
            // annotate(program, tsFile, target || (pxt.appTarget && pxt.appTarget.compile));
            const decompiled = (pxt as any).py.decompileToPythonHelper(program, tsFile);

            if (decompiled.success) {
                return decompiled.outfiles["main.py"];
            }
            else {
                return Promise.reject("Could not decompile " + f + JSON.stringify(decompiled.diagnostics, null, 4));
            }
        })
}

function getOptsAsync(dependency: string) {
    if (!cachedOpts) {
        const pkg = new pxt.MainPackage(new TestHost("decompile-pkg", "// TODO", dependency ? [dependency] : [], true));

        return pkg.getCompileOptionsAsync()
            .then(opts => cachedOpts = opts);
    }
    return Promise.resolve(JSON.parse(JSON.stringify(cachedOpts))); // Clone cached options so that tests can individually modify their own options copy
}
