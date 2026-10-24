/// <reference path="../../built/pxtcompiler.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";

import * as util from "../common/testUtils";
import type { HeadlessRunOptions } from "../../built/simtest";

// setup
function initGlobals() {
    const g = global as any;
    g.pxt = pxt;
    g.ts = ts;
    g.pxtc = pxtc;
    g.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
    g.atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}
initGlobals();

pxt.setAppTarget(util.testAppTarget);

const simtest = require(path.resolve(process.cwd(), "built", "simtest.js")) as typeof import("../../built/simtest");

const BROWSER_GLOBALS = ["window", "document", "navigator", "location", "self", "HTMLElement", "Element", "localStorage"];

const core = path.resolve(process.cwd(), "built", "pxtsimcore.js");
const bundleDir = path.resolve(process.cwd(), "built", "tests", "simcore-test");

/** Where the toy bundle is written for a run. */
const toyBundle = path.join(bundleDir, "toybundle.js");
/**
 * The bare board with idle handlers, a cleanup message when the board is killed, `control.millis`
 * reading the runtime's running time, and `testAudio.playAsync`, which plays two silent
 * instruction steps lasting 300 ms and 200 ms and then posts a `testaudio` message carrying the
 * running time it resolved at. Its first message is a `probe` describing the context it loaded in.
 */
const TOY_BUNDLE = `pxsim.initHeadlessRuntime = function (msg) {
    pxsim.initBareRuntime(msg);
    pxsim.Runtime.postMessage({
        type: "probe",
        runtime: typeof pxsim.Runtime,
        bareRuntime: typeof pxsim.initBareRuntime,
        globals: { ${BROWSER_GLOBALS.map(name => `${name}: typeof ${name}`).join(", ")} }
    });
    pxsim.runtime.startIdle();
    pxsim.runtime.board.kill = function () {
        pxsim.Runtime.messagePosted({ type: "boardcleanup" });
    };
    pxsim.control.millis = function () { return pxsim.runtime.runningTime(); };
    // UInt16LE step duration at offset 4 of each 12-byte step
    const instructions = new Uint8Array(24);
    instructions[4] = 300 & 0xff;
    instructions[5] = 300 >> 8;
    instructions[12 + 4] = 200;
    pxsim.testAudio = {
        playAsync: function () {
            return pxsim.audiohost.audio().playInstructionsAsync(instructions).then(function () {
                pxsim.Runtime.postMessage({ type: "testaudio", resolvedAt: pxsim.runtime.runningTime() });
            });
        }
    };
};`;

/** An empty bundle, missing the `pxsim.initHeadlessRuntime` entry point. */
const emptyBundle = path.join(bundleDir, "emptybundle.js");

/** Declares `control.millis`, which the toy board provides. */
const MILLIS_SHIM = `
declare namespace control {
    //% shim=control::millis
    function millis(): number;
}
`;

const RANDOM_PROGRAM = `
    for (let i = 0; i < 3; i++)
        console.log("r" + Math.randomRange(0, 1000))
`;

const options = { timeoutMs: 5000, settleMs: 300 };

before(() => {
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(toyBundle, TOY_BUNDLE);
    fs.writeFileSync(emptyBundle, "");
});

after(() => {
    fs.unlinkSync(toyBundle);
    fs.unlinkSync(emptyBundle);
});

async function compileAsync(source: string) {
    return (await util.stsAsync(source)).outfiles[pxtc.BINARY_JS];
}

/** Runs compiled JS headless on the toy board, with `options` overridden by `overrides`. */
function runCompiledAsync(js: string, overrides: Partial<HeadlessRunOptions> = {}) {
    return simtest.runHeadlessAsync(js, [core, toyBundle], { ...options, ...overrides });
}

async function runAsync(source: string, overrides: Partial<HeadlessRunOptions> = {}) {
    return runCompiledAsync(await compileAsync(source), overrides);
}

describe("pxtsimcore in a context without browser globals", () => {
    it("loads and defines the runtime", async function () {
        this.timeout(20000);
        const result = await runAsync(`pause(1)`);
        const probe = result.messages.find(msg => msg.type === "probe");
        chai.expect(probe.runtime).equals("function");
        chai.expect(probe.bareRuntime).equals("function");
    });

    it("has no browser globals", async function () {
        this.timeout(20000);
        const result = await runAsync(`pause(1)`);
        const probe = result.messages.find(msg => msg.type === "probe");
        for (const name of BROWSER_GLOBALS)
            chai.expect(probe.globals[name], name).equals("undefined");
    });

    it("runs a compiled program on the bare board", async function () {
        this.timeout(20000);
        const result = await runAsync(`
            let total = 0
            for (let i = 1; i <= 4; i++) total += i
            console.log("total " + total)
            pause(10)
        `);
        chai.expect(result.error).equals(undefined);
        chai.expect(result.serial).deep.equals(["total 10"]);
    });
});

describe("pxt simtest runner", () => {
    it("parses serial expectations", () => {
        chai.expect(simtest.parseSerialExpectations("// @serial: a b\nlet x = 1\n  //@serial:c\n// @serial:")).deep.equals(["a b", "c", ""]);
    });

    it("collects serial lines from a program", async function () {
        this.timeout(20000);
        const result = await runAsync(`console.log("one"); console.log("two"); pause(10)`);
        chai.expect(result.serial).deep.equals(["one", "two"]);
        chai.expect(result.error).equals(undefined);
        chai.expect(result.messages.some(msg => msg.type === "boardcleanup")).equals(true);
        chai.expect(simtest.checkRun(result, ["one", "two"])).equals(undefined);
        chai.expect(simtest.checkRun(result, ["one"])).includes("serial output mismatch");
    });

    it("runs background fibers through virtual settle time and leaves no timer", async function () {
        this.timeout(20000);
        const js = await compileAsync(`control.runInBackground(() => { pause(60000); console.log("woke") })`);
        const originalSetTimeout = global.setTimeout;
        const originalClearTimeout = global.clearTimeout;
        const originalSetInterval = global.setInterval;
        const originalClearInterval = global.clearInterval;
        let created = 0;
        const pending = new Set<any>();
        (global as any).setTimeout = (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
            let timer: any;
            timer = originalSetTimeout(() => {
                pending.delete(timer);
                callback(...args);
            }, delay);
            created++;
            pending.add(timer);
            return timer;
        };
        (global as any).clearTimeout = (timer: any) => {
            pending.delete(timer);
            originalClearTimeout(timer);
        };
        (global as any).setInterval = (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
            const timer = originalSetInterval(() => callback(...args), delay);
            created++;
            pending.add(timer);
            return timer;
        };
        (global as any).clearInterval = (timer: any) => {
            pending.delete(timer);
            originalClearInterval(timer);
        };
        try {
            const start = Date.now();
            const result = await runCompiledAsync(js, { settleMs: 61000 });
            const elapsed = Date.now() - start;
            chai.expect(result.error).equals(undefined);
            chai.expect(result.timedOut).equals(false);
            chai.expect(result.serial).deep.equals(["woke"]);
            chai.expect(elapsed).lessThan(options.timeoutMs);
            chai.expect(created).greaterThan(0);
            chai.expect(pending.size).equals(0);
        } finally {
            global.setTimeout = originalSetTimeout;
            global.clearTimeout = originalClearTimeout;
            global.setInterval = originalSetInterval;
            global.clearInterval = originalClearInterval;
        }
    });

    it("reports a runtime error", async function () {
        this.timeout(20000);
        const result = await runAsync(`let a: number[] = null; console.log(a.length)`);
        chai.expect(result.messages.some(msg => msg.type === "boardcleanup")).equals(true);
        chai.expect(simtest.checkRun(result, [])).includes("runtime error");
    });

    it("fails when the bundle has no headless entry point", async function () {
        this.timeout(20000);
        const js = await compileAsync(`pause(1)`);
        let message = "";
        await simtest.runHeadlessAsync(js, [core, emptyBundle], options)
            .catch((e: Error) => message = e.message);
        chai.expect(message).includes("does not set pxsim.initHeadlessRuntime");
    });
});

describe("deterministic time and randomness", () => {
    it("completes a pause without waiting for it in real time", async function () {
        this.timeout(20000);
        const js = await compileAsync(`
            pause(1000)
            console.log("done")
        `);
        const host = simtest.createVirtualHost();
        const start = Date.now();
        const result = await runCompiledAsync(js, { host });
        const elapsed = Date.now() - start;
        chai.expect(result.serial).deep.equals(["done"]);
        chai.expect(host.now()).greaterThan(999);
        chai.expect(elapsed).lessThan(500);
    });

    it("reports virtual time through control.millis", async function () {
        this.timeout(20000);
        const result = await runAsync(MILLIS_SHIM + `
            console.log("t" + control.millis())
            pause(1000)
            console.log("t" + control.millis())
        `);
        chai.expect(result.serial).deep.equals(["t0", "t1000"]);
    });

    it("draws the same random numbers from the same seed", async function () {
        this.timeout(20000);
        const js = await compileAsync(RANDOM_PROGRAM);
        const first = (await runCompiledAsync(js, { host: simtest.createVirtualHost(42) })).serial;
        const second = (await runCompiledAsync(js, { host: simtest.createVirtualHost(42) })).serial;
        const other = (await runCompiledAsync(js, { host: simtest.createVirtualHost(7) })).serial;
        chai.expect(first.length).equals(3);
        chai.expect(second).deep.equals(first);
        chai.expect(other).not.deep.equals(first);
    });

    it("draws the same random numbers on every run without a seed", async function () {
        this.timeout(20000);
        const js = await compileAsync(RANDOM_PROGRAM);
        const first = (await runCompiledAsync(js)).serial;
        const second = (await runCompiledAsync(js)).serial;
        chai.expect(first.length).equals(3);
        chai.expect(second).deep.equals(first);
    });

    it("plays instructions for the buffer's duration on the silent audio host", async function () {
        this.timeout(20000);
        const result = await runAsync(MILLIS_SHIM + `
            namespace testAudio {
                //% promise shim=testAudio::playAsync
                export function play(): void { }
            }
            testAudio.play()
            console.log("t" + control.millis())
        `);
        const played = result.messages.find(msg => msg.type === "testaudio");
        chai.expect(played.resolvedAt).equals(500);
        chai.expect(result.serial).deep.equals(["t500"]);
    });

    it("times out a busy loop that never pauses", async function () {
        this.timeout(20000);
        const js = await compileAsync(`
            let x = 0
            while (true) { x++ }
        `);
        const start = Date.now();
        const result = await runCompiledAsync(js, { timeoutMs: 1000 });
        const elapsed = Date.now() - start;
        chai.expect(result.timedOut).equals(true);
        chai.expect(simtest.checkRun(result, [])).includes("timed out");
        chai.expect(elapsed).lessThan(3000);
    });
});
