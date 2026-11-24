/// <reference path="../../built/pxtcompiler.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

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
/** Where the test project emits the compiled fixtures under fixtures/. */
const bundleDir = path.resolve(process.cwd(), "built", "tests", "simcore-test", "fixtures");

/**
 * The toy bundle, compiled with this test project from fixtures/toybundle.ts. Its `probe` message
 * reports the type of each name in BROWSER_GLOBALS.
 */
const toyBundle = path.join(bundleDir, "toybundle.js");

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

/** Creates a vm context with no browser globals and loads pxtsimcore.js alone into it. */
function createCoreContext() {
    const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, performance, btoa, atob, TextEncoder, TextDecoder, URL, URLSearchParams });
    vm.runInContext(fs.readFileSync(core, "utf8"), context, { filename: core });
    return context;
}

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
    it("has no browser globals", async function () {
        this.timeout(20000);
        const result = await runAsync(`pause(1)`);
        const probe = result.messages.find(msg => msg.type === "probe") as ProbeMessage;
        for (const name of BROWSER_GLOBALS)
            chai.expect(probe.globals[name], name).equals("undefined");
    });
});

describe("pxt simtest runner", () => {
    it("collects serial lines from a program", async function () {
        this.timeout(20000);
        const result = await runAsync(`console.log("one"); console.log("two"); pause(10)`);
        chai.expect(result.serial).deep.equals(["one", "two"]);
        chai.expect(result.error).equals(undefined);
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
            const result = await runCompiledAsync(js, { settleMs: 61000 });
            chai.expect(result.error).equals(undefined);
            chai.expect(result.timedOut).equals(false);
            chai.expect(result.serial).deep.equals(["woke"]);
            chai.expect(result.host.now()).at.least(61000);
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
});

describe("deterministic time and randomness", () => {
    it("advances a virtual host defined by pxtsimcore alone in a context without browser globals", async function () {
        this.timeout(20000);
        const context = createCoreContext();
        const result = JSON.parse(await vm.runInContext(`(async () => {
            const host = pxsim.host.createVirtualHost();
            const fired = [];
            host.timers.setTimeout(() => fired.push(host.now()), 100);
            await host.advance(150);
            return JSON.stringify({ fired, now: host.now() });
        })()`, context));
        chai.expect(result.fired).deep.equals([100]);
        chai.expect(result.now).equals(150);
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

    it("draws the same random numbers from the same seed, and a fixed sequence without one", async function () {
        this.timeout(20000);
        const js = await compileAsync(RANDOM_PROGRAM);
        const first = (await runCompiledAsync(js, { seed: 42 })).serial;
        const second = (await runCompiledAsync(js, { seed: 42 })).serial;
        const other = (await runCompiledAsync(js, { seed: 7 })).serial;
        chai.expect(first.length).equals(3);
        chai.expect(second).deep.equals(first);
        chai.expect(other).not.deep.equals(first);
        const unseeded = (await runCompiledAsync(js)).serial;
        const unseededAgain = (await runCompiledAsync(js)).serial;
        chai.expect(unseeded.length).equals(3);
        chai.expect(unseededAgain).deep.equals(unseeded);
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
        const played = result.messages.find(msg => msg.type === "testaudio") as TestAudioMessage;
        chai.expect(played.resolvedAt).equals(500);
        chai.expect(result.serial).deep.equals(["t500"]);
    });

    it("plays a song to its end on the silent audio host's metronome", async function () {
        this.timeout(20000);
        // 150 bpm at 4 ticks per beat is 100 ms per tick; 2 measures of 4 beats is 32 ticks
        const song: pxt.assets.music.Song = {
            measures: 2,
            beatsPerMeasure: 4,
            beatsPerMinute: 150,
            ticksPerBeat: 4,
            tracks: [{
                id: 0,
                instrument: {
                    waveform: 1,
                    ampEnvelope: { attack: 10, decay: 100, sustain: 500, release: 100, amplitude: 1024 }
                },
                notes: [{ startTick: 0, endTick: 4, notes: [{ note: 49, enharmonicSpelling: "normal" }] }]
            }]
        };
        const context = createCoreContext();
        const result = JSON.parse(await vm.runInContext(`(async () => {
            const host = pxsim.host.createVirtualHost();
            host.use();
            const sequencer = new pxsim.music.Sequencer();
            await sequencer.initAsync();
            let stoppedAt;
            sequencer.addEventListener("stop", () => stoppedAt = host.now());
            sequencer.start(${JSON.stringify(song)}, false);
            const duration = sequencer.duration();
            await host.advance(duration - 1);
            const before = { state: sequencer.state(), tick: sequencer.currentTick() };
            await host.advance(1);
            const after = { state: sequencer.state(), tick: sequencer.currentTick() };
            return JSON.stringify({ duration, maxTick: sequencer.maxTick(), before, after, stoppedAt });
        })()`, context));
        chai.expect(result.duration).equals(3200);
        chai.expect(result.maxTick).equals(32);
        chai.expect(result.before).deep.equals({ state: "play", tick: 31 });
        chai.expect(result.after).deep.equals({ state: "stop", tick: 32 });
        chai.expect(result.stoppedAt).equals(3200);
    });

    it("times out a busy loop that never pauses", async function () {
        this.timeout(20000);
        const js = await compileAsync(`
            let x = 0
            while (true) { x++ }
        `);
        const result = await runCompiledAsync(js, { timeoutMs: 1000 });
        chai.expect(result.timedOut).equals(true);
        chai.expect(simtest.checkRun(result, [])).includes("timed out");
    });
});
