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

/** The toy bundle, compiled with this test project from fixtures/toybundle.ts; its `probe` message reports the type of each name in BROWSER_GLOBALS. */
const toyBundle = path.join(bundleDir, "toybundle.js");

/** The empty bundle, compiled with this test project from fixtures/emptybundle.ts; it sets no `pxsim.initHeadlessRuntime`. */
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


/** Creates a vm context with no browser globals and loads pxtsimcore.js alone into it. */
function createCoreContext() {
    const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, performance, TextEncoder, TextDecoder, URL, URLSearchParams });
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

    it("completes a pause without waiting for it in real time", async function () {
        this.timeout(20000);
        const js = await compileAsync(`
            pause(1000)
            console.log("done")
        `);
        const start = Date.now();
        const result = await runCompiledAsync(js);
        const elapsed = Date.now() - start;
        chai.expect(result.serial).deep.equals(["done"]);
        chai.expect(result.host.now()).greaterThan(999);
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
        const first = (await runCompiledAsync(js, { seed: 42 })).serial;
        const second = (await runCompiledAsync(js, { seed: 42 })).serial;
        const other = (await runCompiledAsync(js, { seed: 7 })).serial;
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

    it("ticks the silent audio host's metronome on virtual time", async function () {
        this.timeout(20000);
        const context = createCoreContext();
        const result = JSON.parse(await vm.runInContext(`(async () => {
            const host = pxsim.host.createVirtualHost();
            host.use();
            const metronome = pxsim.audiohost.audio().createMetronome();
            await metronome.initAsync();
            const ticks = [];
            metronome.addTickListener(() => ticks.push(host.now()));
            metronome.start(100);
            await host.advance(350);
            const started = ticks.slice();
            metronome.setInterval(50);
            await host.advance(100);
            const restarted = ticks.slice();
            metronome.stop();
            await host.advance(500);
            const stopped = ticks.slice();
            metronome.setInterval(50);
            await host.advance(500);
            const setWhileStopped = ticks.slice();
            metronome.start(100);
            metronome.dispose();
            await host.advance(500);
            return JSON.stringify({ started, restarted, stopped, setWhileStopped, disposed: ticks });
        })()`, context));
        chai.expect(result.started).deep.equals([100, 200, 300]);
        chai.expect(result.restarted).deep.equals([100, 200, 300, 400, 450]);
        chai.expect(result.stopped).deep.equals(result.restarted);
        chai.expect(result.setWhileStopped).deep.equals(result.restarted);
        chai.expect(result.disposed).deep.equals(result.restarted);
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

    it("plays queued instructions after their delay on the silent audio host", async function () {
        this.timeout(20000);
        const context = createCoreContext();
        const result = JSON.parse(await vm.runInContext(`(async () => {
            const host = pxsim.host.createVirtualHost();
            host.use();
            const events = [];
            pxsim.audiohost.setSoundEventHandler((ev, data) => events.push({ ev, at: host.now(), data: data && Array.from(data) }));
            const buf = new Uint8Array(pxsim.music.INSTRUCTION_STEP_BYTES);
            buf[0] = 3;
            pxsim.audiohost.queuePlayInstructions(300, buf);
            await host.advance(299);
            const before = events.slice();
            await host.advance(1);
            return JSON.stringify({ before, after: events, buf: Array.from(buf) });
        })()`, context));
        chai.expect(result.before).deep.equals([]);
        chai.expect(result.after).deep.equals([{ ev: "playinstructions", at: 300, data: result.buf }]);
    });

    it("cancels queued instructions on stopAll on the silent audio host", async function () {
        this.timeout(20000);
        const context = createCoreContext();
        const result = JSON.parse(await vm.runInContext(`(async () => {
            const host = pxsim.host.createVirtualHost();
            host.use();
            const events = [];
            pxsim.audiohost.setSoundEventHandler(ev => events.push({ ev, at: host.now() }));
            pxsim.audiohost.queuePlayInstructions(300, new Uint8Array(pxsim.music.INSTRUCTION_STEP_BYTES));
            await host.advance(100);
            pxsim.audiohost.audio().stopAll();
            await host.advance(500);
            return JSON.stringify({ events });
        })()`, context));
        chai.expect(result.events).deep.equals([{ ev: "muteallchannels", at: 100 }]);
    });

    it("runs onStopAll listeners on stopAll on the silent audio host", async function () {
        this.timeout(20000);
        const context = createCoreContext();
        const result = JSON.parse(vm.runInContext(`(() => {
            const calls = [];
            const audio = pxsim.audiohost.audio();
            audio.onStopAll(() => calls.push("first"));
            audio.onStopAll(() => calls.push("second"));
            audio.stopAll();
            audio.stopAll();
            return JSON.stringify({ calls });
        })()`, context));
        chai.expect(result.calls).deep.equals(["first", "second", "first", "second"]);
    });

    it("hands out an inert audio element from the silent audio host", async function () {
        this.timeout(20000);
        const context = createCoreContext();
        const result = JSON.parse(await vm.runInContext(`(async () => {
            const element = pxsim.audiohost.audio().createAudioElement("data:,", 0, 1);
            const listener = () => { };
            element.addEventListener("ended", listener);
            const played = await element.play().then(() => "resolved");
            element.pause();
            element.removeEventListener("ended", listener);
            return JSON.stringify({
                played,
                playbackRate: element.playbackRate,
                preservesPitch: element.preservesPitch,
                currentTime: element.currentTime
            });
        })()`, context));
        chai.expect(result).deep.equals({ played: "resolved", playbackRate: 1, preservesPitch: true, currentTime: 0 });
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
