/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";
import * as util from "../common/testUtils";

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
pxt.setAppTarget(util.testAppTarget);

describe("decompiler", () => {
    const filenames: string[] = [];
    for (const file of fs.readdirSync(casesDir)) {
        if (file[0] == ".") {
            continue;
        }

        const filename = path.join(casesDir, file);
        if (file.substr(-3) === ".ts") {
            filenames.push(filename);
        }
    };

    filenames.forEach(filename => {
        it("should decompile " + path.basename(filename), () => {
            return decompileTestAsync(filename);
        });
    });
});

function fail(msg: string) {
    chai.assert(false, msg);
}

function compareBlocksBaselines(a: string, b: string): boolean {
    // Strip encoded carriage-return from grey blocks
    a = a.replace(/&#13;/g, "");
    b = b.replace(/&#13;/g, "");

    // Ignore error messages in TS statement mutations
    a = a.replace(/error="[^"]*"/g, "");
    b = b.replace(/error="[^"]*"/g, "");

    // Ignore IDs
    a = a.replace(/id="[^"]*"/g, "");
    b = b.replace(/id="[^"]*"/g, "");

    return util.compareBaselines(a, b)
}

function decompileTestAsync(filename: string) {
    return new Promise((resolve, reject) => {
        const basename = path.basename(filename);
        const baselineFile = path.join(baselineDir, util.replaceFileExtension(basename, ".blocks"))

        let baselineExists: boolean;
        try {
            const stats = fs.statSync(baselineFile)
            baselineExists = stats.isFile()
        }
        catch (e) {
            baselineExists = false
        }

        return decompileAsyncWorker(filename, testBlocksDir)
            .then(decompiled => {
                const outFile = path.join(util.replaceFileExtension(filename, ".local.blocks"));

                if (!baselineExists) {
                    fs.writeFileSync(outFile, decompiled)
                    fail(`no baseline found for ${basename}, output written to ${outFile}`);
                    return;
                }

                const baseline = fs.readFileSync(baselineFile, "utf8")
                if (!compareBlocksBaselines(decompiled, baseline)) {
                    fs.writeFileSync(outFile, decompiled)
                    fail(`${basename} did not match baseline, output written to ${outFile}`);
                }
            }, error => fail("Could not decompile: " + error.stack))
            .then(() => resolve(), reject);
    });
}

function decompileAsyncWorker(f: string, dependency?: string): Promise<string> {
    const tsMain = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    return util.getTestCompileOptsAsync(tsMain, dependency, true)
        .then(opts => {
            const decompiled = pxtc.decompile(opts, "main.ts", true);
            if (decompiled.success) {
                return decompiled.outfiles["main.blocks"];
            }
            else {
                return Promise.reject(new Error("Could not decompile " + f + JSON.stringify(decompiled.diagnostics, null, 4)));
            }
        })
}