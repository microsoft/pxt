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

const isDisabled = (file: string): boolean =>
    path.basename(file).indexOf("TODO_") >= 0
const isWhitelisted = (file: string): boolean =>
    path.basename(file).indexOf("ONLY_") >= 0

// TODO: deduplicate this code with decompilerrunner.ts
describe("pyconverter", () => {
    let filenames = util.getFilesByExt(casesDir, ".py")

    // diable files using a "TODO_" prefix
    let disabledTests = filenames.filter(f => isDisabled(f))
    for (let d of disabledTests) {
        console.warn("Skiping disabled test: " + d)
    }
    filenames = filenames.filter(f => !isDisabled(f))

    // whitelist files using a "ONLY_" prefix
    let whitelisted = filenames.filter(isWhitelisted)
    if (whitelisted.length) {
        filenames = whitelisted
        console.warn("Skipping all tests except:\n" + filenames.join("\n"))
    }

    filenames.forEach(filename => {
        it("should convert " + path.basename(filename), () => {
            return pyconverterTestAsync(filename);
        });
    });

});

describe("errors", () => {
    let filenames = util.getFilesByExt(casesDir, ".py")
    let errFilenames = util.getFilesByExt(errorsDir, ".py");

    // disable files using a "TODO_" prefix
    let disabledTests = errFilenames.filter(f => isDisabled(f))
    for (let d of disabledTests) {
        console.warn("Skiping disabled test: " + d)
    }
    errFilenames = errFilenames.filter(f => !isDisabled(f))

    // whitelist files using a "ONLY_" prefix
    let whitelisted = errFilenames.filter(isWhitelisted)
    let regWhitelisted = filenames.filter(isWhitelisted)
    if (whitelisted.length || regWhitelisted.length) {
        errFilenames = whitelisted
        console.warn("Skipping all error tests except:\n" + errFilenames.join("\n"))
    }

    errFilenames.forEach(filename => {
        it("should error " + path.basename(filename), () => {
            return pyerrorTest(filename);
        });
    });
})

function fail(msg: string) {
    chai.assert(false, msg);
}

function pyconverterTestAsync(pyFilename: string) {
    return new Promise<void>((resolve, reject) => {
        const basename = path.basename(pyFilename);
        let baselineFile = path.join(baselineDir, util.replaceFileExtension(basename, ".ts"))
        baselineFile = baselineFile.replace("ONLY_", "")
        baselineFile = baselineFile.replace("TODO_", "")

        let baselineExists: boolean;
        try {
            const stats = fs.statSync(baselineFile)
            baselineExists = stats.isFile()
        }
        catch (e) {
            baselineExists = false
        }

        const pyInputRaw = fs.readFileSync(pyFilename, "utf8").replace(/\r\n/g, "\n");
        const [pyInput, compareOpts] = util.getAndStripComparisonOptions(pyInputRaw, true);

        return util.py2tsAsync(pyInput, testBlocksDir, true, false, pyFilename)
            .then(res => {
                const outFile = path.join(util.replaceFileExtension(baselineFile, ".local.ts"));
                const decompiled = res.ts;

                if (!baselineExists) {
                    fs.writeFileSync(outFile, decompiled)
                    fail(`no baseline found for ${basename}, output written to ${outFile}`);
                    return;
                }

                const baseline = fs.readFileSync(baselineFile, "utf8")
                if (!util.compareBaselines(decompiled, baseline, compareOpts)) {
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
    const pyInput = fs.readFileSync(filename, "utf8").replace(/\r\n/g, "\n");
    return util.py2tsAsync(pyInput, testBlocksDir, true, true, filename)
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