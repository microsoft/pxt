/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

const casesDir = path.join(process.cwd(), "tests", "format-test", "cases");
const baselineDir = path.join(process.cwd(), "tests", "format-test", "baselines");

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
    corepkg: undefined
});

describe("ts formatting", () => {
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
        it("should correctly format " + path.basename(filename), () => {
            formatTest(filename)
        });
    });
});

function formatTest(filename: string) {
    const input = fs.readFileSync(filename, "utf8");
    const baselinePath = path.join(baselineDir, path.basename(filename));


    let baseline: string;
    let hasBaseline = false;
    try {
        baseline = fs.readFileSync(baselinePath, "utf8");
        hasBaseline = true;
    }
    catch (e) {
        // If there isn't a baseline, just use the input
    }

    baseline = baseline || input;

    const { formatted } = pxtc.format(input, 0);
    chai.assert(formatted === baseline, hasBaseline ? "Formatted code did not match baseline" : "No baseline found and formatted code did not preserve input");
}
