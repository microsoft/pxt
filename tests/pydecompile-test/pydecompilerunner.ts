/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";
import * as util from "../common/testUtils";

// uses the same test cases as the blocks decompiler tests
const decompilerCases = path.join(process.cwd(), "tests", "decompile-test", "cases");
const decompilerBaselines = path.join(process.cwd(), "tests", "pydecompile-test", "decompiler-baselines");
const pydecompilerCases = path.join(process.cwd(), "tests", "pydecompile-test", "cases");
const pydecompilerBaselines = path.join(process.cwd(), "tests", "pydecompile-test", "baselines");

const testBlocksDir = path.relative(process.cwd(), path.join("tests", "decompile-test", "cases", "testBlocks"));

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
describe("pydecompiler", () => {
    it("preserves identifiers behind localized block display labels through a Python round trip", async () => {
        const rawTypescript = `
let myTile = 0
let kinds = [
    SpriteKind.Player,
    SpriteKind.Projectile,
    SpriteKind.Food,
    SpriteKind.Enemy
]
`;
        const python = await util.ts2pyAsync(rawTypescript, testBlocksDir, false, "localized display identity");

        chai.expect(python).to.contain("myTile = 0");
        for (const kind of ["player", "projectile", "food", "enemy"]) {
            chai.expect(python).to.contain(`SpriteKind.${kind}`);
        }
        for (const localized of ["min_flise", "spiller", "projektil", "mad", "fjende"]) {
            chai.expect(python.toLowerCase()).not.to.contain(localized.toLowerCase());
        }

        const roundTrip = await util.py2tsAsync(python, testBlocksDir, false, false, "localized display identity");
        chai.expect(roundTrip.ts).to.contain("myTile");
        for (const kind of ["Player", "Projectile", "Food", "Enemy"]) {
            chai.expect(roundTrip.ts).to.contain(`SpriteKind.${kind}`);
        }
        for (const localized of ["minFlise", "Spiller", "Projektil", "Mad", "Fjende"]) {
            chai.expect(roundTrip.ts).not.to.contain(localized);
        }
    });

    let decompilerBaselineFiles = util.getFilesByExt(decompilerBaselines, ".py")
    decompilerBaselineFiles = decompilerBaselineFiles.filter(f => f.indexOf(".local.py") === -1);

    decompilerBaselineFiles.forEach(filename => {
        it("should decompile " + path.basename(filename), () => {
            return testDecompilerBaselineAsync(filename);
        });
    });

    let filenames = util.getFilesByExt(pydecompilerCases, ".ts")

    filenames.forEach(filename => {
        it("should decompile " + path.basename(filename), () => {
            return pydecompileTestAsync(filename);
        });
    });
});

function fail(msg: string) {
    chai.assert(false, msg);
}

function testDecompilerBaselineAsync(baselineFile: string) {
    const basename = path.basename(baselineFile);
    const filename = path.join(decompilerCases, util.replaceFileExtension(basename, ".ts"))

    return pydecompileTestCoreAsync(filename, baselineFile);
}

function pydecompileTestAsync(caseFile: string) {
    const basename = path.basename(caseFile);
    const baselineFile = path.join(pydecompilerBaselines, util.replaceFileExtension(basename, ".py"))

    return pydecompileTestCoreAsync(caseFile, baselineFile);
}

function pydecompileTestCoreAsync(tsFilename: string, baselineFile: string) {
    return new Promise<void>((resolve, reject) => {
        const basename = path.basename(baselineFile);

        let baselineExists: boolean;
        try {
            const stats = fs.statSync(baselineFile)
            baselineExists = stats.isFile()
        }
        catch (e) {
            baselineExists = false
        }

        const tsMainRaw = fs.readFileSync(tsFilename, "utf8").replace(/\r\n/g, "\n");
        const [tsMain, compareOpts] = util.getAndStripComparisonOptions(tsMainRaw, false)

        return util.ts2pyAsync(tsMain, testBlocksDir, false, tsFilename)
            .then(decompiled => {
                const outFile = path.join(util.replaceFileExtension(baselineFile, ".local.py"));

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
                const outFile = path.join(util.replaceFileExtension(baselineFile, ".local.py"));
                fs.writeFileSync(outFile, error.stack)
                fail("Could not decompile: " + error.stack)
            })
            .then(() => resolve(), reject);
    });
}
