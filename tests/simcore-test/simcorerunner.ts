/// <reference path="../../built/pxtcompiler.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

import * as util from "../common/testUtils";
import { createVirtualHost, VirtualHost } from "./virtualhost";

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

const BROWSER_GLOBALS = ["window", "document", "navigator", "location", "self", "HTMLElement", "Element", "localStorage"];

/** A context with the JavaScript built-ins and timers, and none of the browser globals. */
function createHeadlessContext(): any {
    const sandbox: any = {
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        performance,
        TextEncoder,
        TextDecoder,
        URL,
        URLSearchParams,
    };
    const context = vm.createContext(sandbox);
    const corePath = path.resolve(process.cwd(), "built", "pxtsimcore.js");
    vm.runInContext(fs.readFileSync(corePath, "utf8"), context, { filename: corePath });
    return context;
}

function runProgramAsync(context: any, js: string, timeoutMs = 5000): Promise<string[]> {
    context.__js = js;
    context.__timeoutMs = timeoutMs;
    return vm.runInContext(`
        new Promise((resolve, reject) => {
            const serial = [];
            const timer = setTimeout(() => reject(new Error("Simulating code timed out")), __timeoutMs);
            pxsim.initCurrentRuntime = pxsim.initBareRuntime;
            pxsim.Runtime.messagePosted = msg => {
                if (msg.type === "bulkserial")
                    msg.data.forEach(m => serial.push(String(m.data).replace(/\\n$/, "")));
            };
            const runtime = new pxsim.Runtime({ type: "run", code: __js });
            runtime.errorHandler = e => { clearTimeout(timer); reject(e); };
            runtime.run(() => { clearTimeout(timer); resolve(serial); });
        })
    `, context);
}

describe("pxtsimcore in a context without browser globals", () => {
    it("loads and defines the runtime", () => {
        const context = createHeadlessContext();
        chai.expect(vm.runInContext("typeof pxsim.Runtime", context)).equals("function");
        chai.expect(vm.runInContext("typeof pxsim.initBareRuntime", context)).equals("function");
    });

    it("has no browser globals", () => {
        const context = createHeadlessContext();
        for (const name of BROWSER_GLOBALS)
            chai.expect(vm.runInContext(`typeof ${name}`, context), name).equals("undefined");
    });

    it("runs a compiled program on the bare board", async function () {
        this.timeout(20000);
        const compiled = await util.stsAsync(`
            let total = 0
            for (let i = 1; i <= 4; i++) total += i
            console.log("total " + total)
            pause(10)
        `);
        const context = createHeadlessContext();
        const serial = await runProgramAsync(context, compiled.outfiles[pxtc.BINARY_JS]);
        chai.expect(serial).deep.equals(["total 10"]);
    });
});

describe("pxt simtest runner", () => {
    const simtest = require(path.resolve(process.cwd(), "built", "simtest.js")) as typeof import("../../built/simtest");
    const toyBundle = path.resolve(process.cwd(), "built", "tests", "simcore-test", "toybundle.js");

    before(() => {
        fs.mkdirSync(path.dirname(toyBundle), { recursive: true });
        fs.writeFileSync(toyBundle, `pxsim.initHeadlessRuntime = function (msg) {
            pxsim.initBareRuntime(msg);
            pxsim.runtime.startIdle();
            pxsim.runtime.board.kill = function () {
                pxsim.Runtime.messagePosted({ type: "boardcleanup" });
            };
        };`);
    });

    after(() => fs.unlinkSync(toyBundle));

    const core = path.resolve(process.cwd(), "built", "pxtsimcore.js");
    const options = { timeoutMs: 5000, settleMs: 300 };

    async function runAsync(source: string) {
        const compiled = await util.stsAsync(source);
        return simtest.runHeadlessAsync(compiled.outfiles[pxtc.BINARY_JS], [core, toyBundle], options);
    }

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

    it("clears timers for background fibers", async function () {
        this.timeout(20000);
        const compiled = await util.stsAsync(`control.runInBackground(() => pause(60000))`);
        const originalSetTimeout = global.setTimeout;
        const originalClearTimeout = global.clearTimeout;
        const originalSetInterval = global.setInterval;
        const originalClearInterval = global.clearInterval;
        const longTimers: any[] = [];
        const clearedTimers = new Set<any>();
        const intervalTimers: any[] = [];
        const clearedIntervals = new Set<any>();
        (global as any).setTimeout = (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
            let timer: any;
            timer = originalSetTimeout(() => callback(...args), delay);
            if (delay === 60000)
                longTimers.push(timer);
            return timer;
        };
        (global as any).clearTimeout = (timer: any) => {
            clearedTimers.add(timer);
            originalClearTimeout(timer);
        };
        (global as any).setInterval = (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
            const timer = originalSetInterval(() => callback(...args), delay);
            intervalTimers.push(timer);
            return timer;
        };
        (global as any).clearInterval = (timer: any) => {
            clearedIntervals.add(timer);
            originalClearInterval(timer);
        };
        try {
            const result = await simtest.runHeadlessAsync(compiled.outfiles[pxtc.BINARY_JS], [core, toyBundle], options);
            chai.expect(result.error).equals(undefined);
            chai.expect(longTimers.length).greaterThan(0);
            chai.expect(longTimers.every(timer => clearedTimers.has(timer))).equals(true);
            chai.expect(intervalTimers.length).greaterThan(0);
            chai.expect(intervalTimers.every(timer => clearedIntervals.has(timer))).equals(true);
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
        fs.writeFileSync(toyBundle, "");
        try {
            const compiled = await util.stsAsync(`pause(1)`);
            let message = "";
            await simtest.runHeadlessAsync(compiled.outfiles[pxtc.BINARY_JS], [core, toyBundle], options)
                .catch((e: Error) => message = e.message);
            chai.expect(message).includes("does not set pxsim.initHeadlessRuntime");
        } finally {
            fs.writeFileSync(toyBundle, "pxsim.initHeadlessRuntime = pxsim.initBareRuntime;");
        }
    });
});

/** Declares `control.millis` for programs on the bare board. Run those programs with `startVirtualProgram`, which provides it. */
const MILLIS_SHIM = `
declare namespace control {
    //% shim=control::millis
    function millis(): number;
}
`;

interface VirtualRun {
    /** Serial lines posted so far, without their trailing newline. */
    serial: string[];
    /** Runs the virtual host until idle and resolves once the top-level code has finished. */
    finishAsync(): Promise<string[]>;
}

/**
 * Starts a compiled program on the bare board in a context the virtual host is installed in.
 * The bare board gains `control.millis`, reading the runtime's running time.
 */
function startVirtualProgram(host: VirtualHost, context: any, js: string): VirtualRun {
    const serial: string[] = [];
    let finished = false;
    let failure: any;
    context.__js = js;
    context.__serial = serial;
    const done: Promise<void> = vm.runInContext(`
        new Promise((resolve, reject) => {
            pxsim.initCurrentRuntime = () => {
                pxsim.initBareRuntime();
                pxsim.control.millis = () => pxsim.runtime.runningTime();
            };
            pxsim.Runtime.messagePosted = msg => {
                if (msg.type === "bulkserial")
                    msg.data.forEach(m => __serial.push(String(m.data).replace(/\\n$/, "")));
            };
            const runtime = new pxsim.Runtime({ type: "run", code: __js });
            runtime.errorHandler = reject;
            runtime.run(() => resolve());
        })
    `, context);
    done.then(() => finished = true, e => failure = e || new Error("runtime error"));
    return {
        serial,
        finishAsync: async () => {
            await host.runUntilIdle();
            if (failure)
                throw failure;
            if (!finished)
                throw new Error("the program did not finish once the virtual host was idle");
            return serial;
        }
    };
}

/** A fresh context with a virtual host seeded with seed installed in it. */
function createVirtualContext(seed = 1) {
    const host = createVirtualHost(seed);
    const context = createHeadlessContext();
    host.install(context);
    return { host, context };
}

describe("pxtsimcore on a virtual host", () => {
    it("completes a pause without waiting for it in real time", async function () {
        this.timeout(20000);
        const compiled = await util.stsAsync(`
            pause(1000)
            console.log("done")
        `);
        const { host, context } = createVirtualContext();
        const start = Date.now();
        const serial = await startVirtualProgram(host, context, compiled.outfiles[pxtc.BINARY_JS]).finishAsync();
        const elapsed = Date.now() - start;
        chai.expect(serial).deep.equals(["done"]);
        chai.expect(host.now()).greaterThan(999);
        chai.expect(elapsed).lessThan(500);
    });

    it("reports virtual time through control.millis", async function () {
        this.timeout(20000);
        const compiled = await util.stsAsync(MILLIS_SHIM + `
            console.log("t" + control.millis())
            pause(1000)
            console.log("t" + control.millis())
        `);
        const { host, context } = createVirtualContext();
        const serial = await startVirtualProgram(host, context, compiled.outfiles[pxtc.BINARY_JS]).finishAsync();
        chai.expect(serial).deep.equals(["t0", "t1000"]);
    });

    it("draws the same random numbers from the same seed", async function () {
        this.timeout(20000);
        const compiled = await util.stsAsync(`
            for (let i = 0; i < 3; i++)
                console.log("r" + Math.randomRange(0, 1000))
        `);
        const runAsync = (seed: number) => {
            const { host, context } = createVirtualContext(seed);
            return startVirtualProgram(host, context, compiled.outfiles[pxtc.BINARY_JS]).finishAsync();
        };
        const first = await runAsync(42);
        const second = await runAsync(42);
        const other = await runAsync(7);
        chai.expect(first.length).equals(3);
        chai.expect(second).deep.equals(first);
        chai.expect(other).not.deep.equals(first);
    });

    it("plays instructions for the buffer's duration on the silent audio host", async function () {
        this.timeout(20000);
        const compiled = await util.stsAsync(MILLIS_SHIM + `
            namespace testAudio {
                //% promise shim=testAudio::playAsync
                export function play(): void { }
            }
            testAudio.play()
            console.log("t" + control.millis())
        `);
        // two 12-byte steps lasting 300 ms and 200 ms (UInt16LE duration at offset 4)
        const instructions = new Uint8Array(24);
        instructions[4] = 300 & 0xff;
        instructions[5] = 300 >> 8;
        instructions[12 + 4] = 200;
        const { host, context } = createVirtualContext();
        let resolvedAt: number;
        context.pxsim.testAudio = {
            playAsync: () => context.pxsim.audiohost.audio().playInstructionsAsync(instructions)
                .then(() => { resolvedAt = host.now(); })
        };
        const run = startVirtualProgram(host, context, compiled.outfiles[pxtc.BINARY_JS]);
        await host.advance(499);
        chai.expect(resolvedAt).equals(undefined);
        await host.advance(1);
        chai.expect(resolvedAt).equals(500);
        chai.expect(await run.finishAsync()).deep.equals(["t500"]);
    });
});
