/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';

// tslint:disable:no-import-side-effect mocha-no-side-effect-code
import "mocha";
import * as chai from "chai";

import { TestHost } from "../common/testHost";
import * as util from "../common/testUtils";

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
    g.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
    g.atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}

initGlobals();

// Just needs to exist
pxt.setAppTarget(util.testAppTarget);

const tsFileNames: string[] = [];
const pyFileNames: string[] = [];

for (const file of fs.readdirSync(casesDir)) {
    if (file[0] == ".") {
        continue;
    }

    const filename = path.join(casesDir, file);
    if (/\.ts$/.test(file)) {
        tsFileNames.push(filename);
    } else if (/\.py$/.test(file)) {
        pyFileNames.push(filename);
    }
};

describe("ts compiler errors", () => {
    tsFileNames.forEach(filename => {
        it(
            "should correctly check " + path.basename(filename),
            () => stsErrorTestAsync(filename)
        );
    });
});

describe("py compiler errors", () => {
    pyFileNames.forEach(filename => {
        it(
            "should correctly check " + path.basename(filename),
            () => pyErrorTestAsync(filename)
        );
    });
});

async function stsErrorTestAsync(filename: string) {
    const basename = path.basename(filename);
    const text = fs.readFileSync(filename, "utf8");
    const pkg = new pxt.MainPackage(new TestHost(basename, { "main.ts": text }, [], true));

    const target = pkg.getTargetOptions();

    const opts = await pkg.getCompileOptionsAsync(target);
    opts.testMode = true;
    const res = pxtc.compile(opts);
    checkDiagnostics(res.diagnostics, basename, text);
}

async function pyErrorTestAsync(filename: string) {
    const basename = path.basename(filename);
    const text = fs.readFileSync(filename, "utf8");
    const res = await util.py2tsAsync(filename, "bare", /** allowErrors **/ true);
    checkDiagnostics(res.diagnostics, basename, text);
}

function checkDiagnostics(diagnostics: pxtc.KsDiagnostic[], baseName: string, fileText: string) {
    const lines = fileText.split(/\r?\n/);
    for (let diag of diagnostics) {
        chai.assert(
            errCode(lines[diag.line]) !== 0,
            `Error code on line ${diag.line} is not valid ${JSON.stringify(diagnostics, undefined, 4)}`
        );
    }

    lines.forEach((line: string, lineNo: number) => {
        const code = errCode(line);
        const errorsInLine = diagnostics.filter(d => d.line == lineNo);

        chai.assert(
            !code || errorsInLine.filter(d => d.code == code).length != 0,
            `${baseName}(${lineNo + 1}): expecting error TS${code} but got ${JSON.stringify(errorsInLine, undefined, 4)}`
        );
    });

    function errCode(s: string) {
        if (!s)
            return 0;
        let m = /(\/\/|#)\s*TS(\d\d\d\d\d?)/.exec(s);
        if (m)
            return parseInt(m[1]);
        else
            return 0;
    }
}
