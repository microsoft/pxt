/// <reference path="../built/pxtsim.d.ts"/>

import * as fs from "fs";
import * as vm from "vm";

/** The outcome of running one compiled program in a context that has no browser globals. */
export interface HeadlessRunResult {
    /** Lines written to the serial port or console, in order. */
    serial: string[];
    /** Every message the runtime posted other than serial output and status. */
    messages: pxsim.SimulatorMessage[];
    /** Set when the runtime reported an error. */
    error?: string;
    /** True when the run did not finish within the timeout. */
    timedOut: boolean;
    /** The virtual host the run ran on, stopped once the run finished; `now()` reads the virtual time it reached. */
    readonly host: pxsim.host.VirtualHost;
}

export interface HeadlessRunOptions {
    /** Maximum real time, in milliseconds, for the whole run, settling included. */
    timeoutMs: number;
    /** Virtual milliseconds the program runs after its top-level code finishes, before the run ends. */
    settleMs: number;
    /** The seed the virtual host's random source starts from; `pxsim.host.DEFAULT_SEED` when omitted. */
    seed?: number;
}

/**
 * Runs compiled simulator JS in a fresh vm context whose only globals besides the JavaScript
 * built-ins are `console`, `performance`, `TextEncoder`, `TextDecoder`, `URL`, `URLSearchParams`
 * and the timer functions, so that any use of the DOM by the loaded simulator code fails the run.
 *
 * The runtime runs on a virtual host made in the context with `pxsim.host.createVirtualHost`: its
 * clock, timers, frames and random numbers come from that host, seeded with `options.seed`, so the
 * run takes no real time for pauses and two runs of one program with one seed produce the same
 * output. The host is driven until the top-level code finishes, then advanced by
 * `settleMs`, and then the run ends, whatever the program still has scheduled. Only the timeout
 * watchdog, and anything the bundles schedule on the global timers, run on the sandbox's real
 * timers, which are cleared when the run finishes or fails.
 *
 * Errors thrown while stopping the runtime, the board and the board view at the end of the run are
 * dropped and never change the result. The returned promise rejects when a bundle fails to load or
 * the last bundle does not set `pxsim.initHeadlessRuntime`.
 * @param bundles simulator scripts to load, in order: pxtsimcore first, then the target's bundle
 */
export async function runHeadlessAsync(js: string, bundles: string[], options: HeadlessRunOptions): Promise<HeadlessRunResult> {
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const intervals = new Set<ReturnType<typeof setInterval>>();
    const sandbox: any = {
        console,
        setTimeout: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
            const timer = setTimeout(() => {
                timeouts.delete(timer);
                callback(...args);
            }, delay);
            timeouts.add(timer);
            return timer;
        },
        clearTimeout: (timer: ReturnType<typeof setTimeout>) => {
            timeouts.delete(timer);
            clearTimeout(timer);
        },
        setInterval: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
            const timer = setInterval(callback, delay, ...args);
            intervals.add(timer);
            return timer;
        },
        clearInterval: (timer: ReturnType<typeof setInterval>) => {
            intervals.delete(timer);
            clearInterval(timer);
        },
        performance,
        TextEncoder,
        TextDecoder,
        URL,
        URLSearchParams,
    };
    const context = vm.createContext(sandbox);
    try {
        for (const bundle of bundles)
            vm.runInContext(fs.readFileSync(bundle, "utf8"), context, { filename: bundle });

        if (vm.runInContext("typeof pxsim.initHeadlessRuntime", context) !== "function")
            throw new Error(`${bundles[bundles.length - 1]} does not set pxsim.initHeadlessRuntime`);

        sandbox.__seed = options.seed;
        sandbox.__yieldToEventLoop = () => new Promise<void>(resolve => setImmediate(resolve));
        sandbox.__host = vm.runInContext("pxsim.host.createVirtualHost({ seed: __seed, yieldToEventLoop: __yieldToEventLoop })", context);
        vm.runInContext("__host.use()", context);
        // a headless run plays sound on the silent audio host, whichever host the bundles registered
        vm.runInContext("pxsim.audiohost.setAudioHost({})", context);
        sandbox.__js = js;
        sandbox.__options = options;
        return await vm.runInContext(`
            new Promise(resolve => {
                const result = { serial: [], messages: [], timedOut: false, host: __host };
                let runtime;
                let finished = false;
                let serialBuffer = "";
                const finish = () => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timer);
                    __host.stop();
                    try { runtime && runtime.kill(); } catch (e) { }
                    try { runtime && runtime.board && runtime.board.kill(); } catch (e) { }
                    try { runtime && runtime.boardView && runtime.boardView.kill(); } catch (e) { }
                    if (serialBuffer) result.serial.push(serialBuffer);
                    resolve(result);
                };
                const timer = setTimeout(() => { result.timedOut = true; finish(); }, __options.timeoutMs);
                const addSerial = data => {
                    const lines = (serialBuffer + String(data)).split(/\\r?\\n/);
                    serialBuffer = lines.pop();
                    result.serial.push(...lines);
                };
                pxsim.initCurrentRuntime = pxsim.initHeadlessRuntime;
                pxsim.Runtime.messagePosted = msg => {
                    if (msg.type === "bulkserial")
                        msg.data.forEach(m => addSerial(m.data));
                    else if (msg.type === "serial")
                        addSerial(msg.data);
                    else if (msg.type !== "status")
                        result.messages.push(msg);
                };
                try {
                    runtime = new pxsim.Runtime({ type: "run", code: __js });
                } catch (e) {
                    result.error = String(e && e.stack || e);
                    return finish();
                }
                runtime.errorHandler = e => {
                    result.error = String(e && e.stack || e);
                    finish();
                };
                const fail = e => {
                    if (!finished) runtime.errorHandler(e);
                };
                Promise.resolve()
                    .then(() => {
                        if (!finished)
                            return runtime.board.initAsync({ type: "run", code: __js });
                    })
                    .then(() => {
                        if (finished) return;
                        let topLevelDone = false;
                        runtime.run(() => { topLevelDone = true; });
                        return __host.runUntil(() => topLevelDone);
                    })
                    .then(() => {
                        if (!finished)
                            return __host.advance(__options.settleMs);
                    })
                    .then(finish, fail);
            })
        `, context);
    } finally {
        timeouts.forEach(timer => clearTimeout(timer));
        intervals.forEach(timer => clearInterval(timer));
        timeouts.clear();
        intervals.clear();
    }
}

/** Lines the test expects on the serial port, from every line of source that is a `// @serial: text` comment, in order. */
export function parseSerialExpectations(source: string): string[] {
    const expected: string[] = [];
    const re = /^\s*\/\/\s*@serial:[ \t]?(.*?)\s*$/gm;
    let m: RegExpExecArray;
    while ((m = re.exec(source)))
        expected.push(m[1]);
    return expected;
}

/** Returns a description of why the run failed, or undefined when it passed. */
export function checkRun(result: HeadlessRunResult, expectedSerial: string[]): string | undefined {
    if (result.error)
        return `runtime error: ${result.error}`;
    if (result.timedOut)
        return "timed out before the run finished";
    if (expectedSerial.length && JSON.stringify(result.serial) !== JSON.stringify(expectedSerial))
        return `serial output mismatch\n  expected: ${JSON.stringify(expectedSerial)}\n  actual:   ${JSON.stringify(result.serial)}`;
    return undefined;
}
