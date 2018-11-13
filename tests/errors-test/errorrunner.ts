/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";

interface TestInfo {
    filename: string;
    base: string;
    text: string;
}
const casesDir = path.join(process.cwd(), "tests", "errors-test", "cases");

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

describe("ts compiler errors", () => {
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
        it("should correctly check " + path.basename(filename), () => {
            return errorTestAsync(filename)
        });
    });
});

function errorTestAsync(filename: string) {
    const basename = path.basename(filename);
    const text = fs.readFileSync(filename, "utf8");
    const pkg = new pxt.MainPackage(new TestHost(basename, text, [], true));

    const target = pkg.getTargetOptions();

    return pkg.getCompileOptionsAsync(target)
        .then(opts => {
            opts.testMode = true
            let res = pxtc.compile(opts)
            let lines = text.split(/\r?\n/)
            let errCode = (s: string) => {
                if (!s) return 0
                let m = /\/\/\s*TS(\d\d\d\d\d?)/.exec(s)
                if (m) return parseInt(m[1])
                else return 0
            }
            let numErr = 0
            for (let diag of res.diagnostics) {
                chai.assert(errCode(lines[diag.line]) !== 0, "Error code on line " + diag.line + " is not valid " + JSON.stringify(res.diagnostics, undefined, 4))
            }
            let lineNo = 0
            for (let line of lines) {
                let code = errCode(line);

                chai.assert(!code || res.diagnostics.filter(d => d.line == lineNo && d.code == code).length != 0, `${basename}(${lineNo + 1}): expecting error TS${code} but got ${JSON.stringify(res.diagnostics, undefined, 4)}`)
                lineNo++
            }
        })
}
