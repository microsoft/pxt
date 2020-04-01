/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import * as util from "../common/testUtils";

const casesDir = path.join(process.cwd(), "tests", "tutorial-test", "cases");
const baselineDir = path.join(process.cwd(), "tests", "tutorial-test", "baselines");

// Just needs to exist
pxt.setAppTarget(util.testAppTarget);

describe("tutorial test cases", () => {
    const filenames: string[] = [];
    for (const file of fs.readdirSync(casesDir)) {
        if (file[0] == ".") {
            continue;
        }

        const filename = path.join(casesDir, file)
        if (file.substr(-3) === ".md") {
            filenames.push(filename)
        }
    };

    filenames.forEach(filename => {
        it("should correctly parse " + path.basename(filename), () => {
            tutorialTest(filename)
        });
    });
});

function tutorialTest(filename: string) {
    const input = fs.readFileSync(filename, "utf8");
    const basename = path.basename(filename).slice(0, -3) + ".json";
    const baselinePath = path.join(baselineDir, basename);

    let info = pxt.tutorial.parseTutorial(input);
    let baseline;
    try {
        baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    }
    catch (e) {
        // If there isn't a baseline, generate one.
        let newBaseline = info;
        fs.writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 4));
    }

    baseline = baseline || info;

    let err = pxt.Util.deq(baseline, info);
    if (err) {
        fs.writeFileSync(baselinePath + ".original", JSON.stringify(baseline, null, 4));
        fs.writeFileSync(baselinePath, JSON.stringify(info, null, 4));
    }
    chai.assert(err === null, `Parsed tutorial did not match baseline. See ${basename} diff for details.`);
}