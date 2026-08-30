/// <reference path="../../built/pxtcompiler.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import "mocha";
import * as chai from "chai";

import { asmChecks, externalCases } from "./asmchecks";

const testDir = path.join(process.cwd(), "tests", "thumb-test");
const casesDir = path.join(testDir, "cases");
const fixturePath = path.join(testDir, "fixtures", "microbit-mbcodal.json.gz");
const langTestPreludePath = path.join(process.cwd(), "tests", "compile-test",
    "lang-test0", "lang-test0.ts");

// Native compilation runs the whole emitter plus the in-process assembler.
const TIMEOUT_MS = 30000;

function initGlobals() {
    let g = global as any
    g.pxt = pxt;
    g.ts = ts;
    g.pxtc = pxtc;
    g.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
    g.atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}

initGlobals();

/**
 * The fixture holds a CompileOptions environment captured from a real native
 * build of the micro:bit target (see scripts/capture-fixture.js). It is kept as
 * text so each case can parse its own copy and mutate it freely; the compiler
 * writes back into the options it is given.
 */
function loadFixtureText(): string {
    chai.assert(fs.existsSync(fixturePath),
        "missing fixture " + fixturePath + " -- see tests/thumb-test/README.md");
    return zlib.gunzipSync(fs.readFileSync(fixturePath)).toString("utf8");
}

function optionsFor(fixtureText: string, programText: string): pxtc.CompileOptions {
    const opts: pxtc.CompileOptions = JSON.parse(fixtureText).options;

    opts.fileSystem[pxt.MAIN_TS] = programText;

    opts.target.isNative = true;
    opts.target.nativeType = pxtc.NATIVE_TYPE_THUMB;
    opts.target.switches = opts.target.switches || {};
    // Emits the code-size stats header at the top of the listing.
    opts.target.switches.size = true;

    return opts;
}

/**
 * The lang-test0 case files are written against the helpers in lang-test0.ts:
 * assert(), msg() and a few shared globals. That file is small and uses only
 * console.log, control.dmesg and core types, all of which the micro:bit
 * fixture provides, so it is prepended verbatim instead of being restated
 * here -- a hand-written stand-in would drift from the prelude the JS-side
 * suite actually runs against.
 */
function langTestPrelude(): string {
    chai.assert(fs.existsSync(langTestPreludePath),
        "missing lang-test0 prelude " + langTestPreludePath);
    return fs.readFileSync(langTestPreludePath, "utf8");
}

function describeDiagnostics(res: pxtc.CompileResult): string {
    return res.diagnostics.map(d => {
        const where = d.fileName ? d.fileName + "(" + (d.line + 1) + "," + (d.column + 1) + "): " : "";
        return where + "TS" + d.code + ": " + ts.flattenDiagnosticMessageText(d.messageText, "\n");
    }).join("\n");
}

describe("thumb codegen", () => {
    const fixtureText = loadFixtureText();

    const caseFiles = fs.readdirSync(casesDir)
        .filter(f => f[0] !== "." && f.substr(-3) === ".ts")
        .sort();

    chai.assert(caseFiles.length > 0, "no case programs in " + casesDir);

    caseFiles.forEach(caseFile => {
        it("compiles " + caseFile + " to thumb", function () {
            this.timeout(TIMEOUT_MS);

            const check = asmChecks[caseFile];
            chai.assert(!!check,
                "no expectation for " + caseFile + " -- add an entry to asmchecks.ts");

            const programText = fs.readFileSync(path.join(casesDir, caseFile), "utf8");
            const opts = optionsFor(fixtureText, programText);

            const res = pxtc.compile(opts);
            chai.assert(res.success,
                "native compile of " + caseFile + " failed:\n" + describeDiagnostics(res));

            const asm = res.outfiles[pxtc.BINARY_ASM];
            chai.assert(!!asm, "no " + pxtc.BINARY_ASM + " in compile result");

            check(asm, res);
        });
    });

    // Semantic case programs kept elsewhere in the tree; see externalCases.
    // They are compiled and assembled here, not executed.
    const externalPaths = Object.keys(externalCases).sort();

    externalPaths.forEach(relPath => {
        it("compiles " + relPath + " to thumb", function () {
            this.timeout(TIMEOUT_MS);

            const fullPath = path.join(process.cwd(), relPath);
            chai.assert(fs.existsSync(fullPath),
                "missing external case " + fullPath);

            const programText = langTestPrelude() + "\n" +
                fs.readFileSync(fullPath, "utf8");
            const opts = optionsFor(fixtureText, programText);

            const res = pxtc.compile(opts);
            chai.assert(res.success,
                "native compile of " + relPath + " failed:\n" + describeDiagnostics(res));

            const asm = res.outfiles[pxtc.BINARY_ASM];
            chai.assert(!!asm, "no " + pxtc.BINARY_ASM + " in compile result");

            externalCases[relPath](asm, res);
        });
    });
});
