/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";
import * as util from "../common/testUtils";

const casesDir = path.join(process.cwd(), "tests", "pyconverter-test", "cases");
const baselineDir = path.join(process.cwd(), "tests", "pyconverter-test", "baselines");
const errorsDir = path.join(process.cwd(), "tests", "pyconverter-test", "errors");
// uses the same test APIs as the blocks decompiler tests
const testBlocksDir = path.relative(process.cwd(), path.join("tests", "pyconverter-test", "testlib"));

interface PyErrorCase {
    code: number;
    line: number;
}

function initGlobals() {
    let g = global as any
    g.pxt = pxt;
    g.ts = ts;
    g.pxtc = pxtc;
    g.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
    g.atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}

initGlobals();

// Just needs to exist
pxt.setAppTarget(util.testAppTarget);

// TODO: deduplicate this code with decompilerrunner.ts
describe("pyconverter", () => {
    let filenames = util.getFilesByExt(casesDir, ".py")

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
        it("should convert " + path.basename(filename), () => {
            return pyconverterTestAsync(filename);
        });
    });

    describe("errors", () => {
        let errorFiles = util.getFilesByExt(errorsDir, ".py");

        errorFiles.forEach(filename => {
            it("should error " + path.basename(filename), () => {
                return pyerrorTest(filename);
            });
        });
    })
});

function fail(msg: string) {
    chai.assert(false, msg);
}

function pyconverterTestAsync(filename: string) {
    return new Promise((resolve, reject) => {
        const basename = path.basename(filename);
        const baselineFile = path.join(baselineDir, util.replaceFileExtension(basename, ".ts"))

        let baselineExists: boolean;
        try {
            const stats = fs.statSync(baselineFile)
            baselineExists = stats.isFile()
        }
        catch (e) {
            baselineExists = false
        }

        return util.py2tsAsync(filename, testBlocksDir)
            .then(res => {
                const outFile = path.join(util.replaceFileExtension(baselineFile, ".local.ts"));
                const decompiled = res.ts;

                if (!baselineExists) {
                    fs.writeFileSync(outFile, decompiled)
                    fail(`no baseline found for ${basename}, output written to ${outFile}`);
                    return;
                }

                const baseline = fs.readFileSync(baselineFile, "utf8")
                if (!util.compareBaselines(decompiled, baseline)) {
                    fs.writeFileSync(outFile, decompiled)
                    fail(`${basename} did not match baseline, output written to ${outFile}`);
                }
            }, error => {
                const outFile = path.join(util.replaceFileExtension(baselineFile, ".local.ts"));
                fs.writeFileSync(outFile, error.stack)
                fail("Could not decompile: " + error.stack)
            })
            .then(() => resolve(), reject);
    });
}

function pyerrorTest(filename: string) {
    return util.py2tsAsync(filename, testBlocksDir, true)
        .then(result => {
            const expected = getErrorCases(result.python);
            const failing = expected.filter(errorCase => {
                for (const d of result.diagnostics) {
                    if (d.code === errorCase.code && d.line === errorCase.line) {
                        return false;
                    }
                }

                return true;
            });

            if (failing.length) {
                fail("Missing errors: " + failing.map(i => JSON.stringify(i, null, 4)).join(", "));
            }
            else if (expected.length !== result.diagnostics.length) {
                fail("More errors than expected");
            }
        });
}

function getErrorCases(fileText: string) {
    const lines = fileText.split(/\n/);
    const res: PyErrorCase[] = [];

    for (let i = 0; i < lines.length; i++) {
        const match = /#\s*(\d\d\d\d)/.exec(lines[i]);

        if (match) {
            res.push({
                code: parseInt(match[1]),
                line: i
            });
        }
    }

    return res;
}