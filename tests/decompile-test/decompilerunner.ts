/// <reference path="../../built/pxtcompiler.d.ts"/>
/// <reference path="../../typings/globals/mocha/index.d.ts" />
/// <reference path="../../typings/modules/chai/index.d.ts" />
/// <reference path="../../typings/globals/node/index.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";

const casesDir = path.join(process.cwd(), "tests", "decompile-test", "cases");
const baselineDir = path.join(process.cwd(), "tests", "decompile-test", "baselines");
const testBlocksDir = path.relative(process.cwd(), path.join("tests", "decompile-test", "cases", "testBlocks"));

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
        floatingPoint: false
    },
    bundledpkgs: {},
    appTheme: {},
    tsprj: undefined,
    blocksprj: undefined,
    corepkg: undefined
});

describe("decompiler", () => {
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

    filenames.forEach(filename => {
        it("should decompile " + path.basename(filename), () => {
            return decompileTestAsync(filename)
        });
    });
});

function fail(msg: string) {
    chai.assert(false, msg);
}

function decompileTestAsync(filename: string) {
    return new Promise((resolve, reject) => {
        const basename = path.basename(filename);
        const baselineFile = path.join(baselineDir, replaceFileExtension(basename, ".blocks"))

        let baselineExists: boolean;
        try {
            const stats = fs.statSync(baselineFile)
            baselineExists = stats.isFile()
        }
        catch (e) {
            baselineExists = false
        }

        if (!baselineExists) {
            return reject("Baseline does not exist for " + basename);
        }

        return decompileAsyncWorker(filename, testBlocksDir)
            .then(decompiled => {
                const baseline = fs.readFileSync(baselineFile, "utf8")
                if (!compareBaselines(decompiled, baseline)) {
                    const outFile = path.join(replaceFileExtension(filename, ".local.blocks"))
                    fs.writeFileSync(outFile, decompiled)
                    fail(`${basename} did not match baseline, output written to ${outFile}`);
                }
            }, error => fail("Could not decompile: " +  error))
            .then(() => resolve(), reject)
    });
}

function compareBaselines(a: string, b: string): boolean {
    // Ignore whitespace
    return a.replace(/\s/g, "") === b.replace(/\s/g, "")
}

function replaceFileExtension(file: string, extension: string) {
    return file && file.substr(0, file.length - path.extname(file).length) + extension;
}

function decompileAsyncWorker(f: string, dependency?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const input = fs.readFileSync(f, "utf8")
        const pkg = new pxt.MainPackage(new TestHost("decompile-pkg", input, dependency ? [dependency] : [], true));

        pkg.getCompileOptionsAsync()
            .then(opts => {
                opts.ast = true;
                opts.ignoreFileResolutionErrors = true;
                const decompiled = pxtc.decompile(opts, "main.ts");
                if (decompiled.success) {
                    resolve(decompiled.outfiles["main.blocks"]);
                }
                else {
                    reject("Could not decompile " + f + JSON.stringify(decompiled.diagnostics, null, 4));
                }
            });
    });
}