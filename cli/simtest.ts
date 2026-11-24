/// <reference path="../built/pxtsim.d.ts"/>

import * as fs from "fs";
import * as vm from "vm";

/** The outcome of running one compiled program in a context that has no browser globals. */
export interface HeadlessRunResult {
    /** Lines written to the serial port or console, in order. */
    serial: string[];
    /** Every message the runtime posted other than serial output and status. */
    messages: pxsim.SimulatorMessage[];
    error?: string;
    timedOut: boolean;
    /**
     * The virtual host the program ran on, already stopped. Its `now()` returns the virtual time
     * the run reached.
     */
    readonly host: pxsim.host.VirtualHost;
}

export interface HeadlessRunOptions {
    /** Maximum real time, in milliseconds, for the whole run, settling included. */
    timeoutMs: number;
    /** Virtual milliseconds the program runs after its top-level code finishes, before the run ends. */
    settleMs: number;
    /** Seed for the virtual host's random numbers. Defaults to `pxsim.host.DEFAULT_SEED`. */
    seed?: number;
}

/**
 * Runs a compiled program headless in a fresh vm context. The context has the JavaScript
 * built-ins plus a few Node globals, such as `console`, `performance`, the timers and
 * `TextEncoder`, but no DOM. Any use of the DOM by the simulator code fails the run.
 *
 * The program runs on a virtual host from `pxsim.host.createVirtualHost`, which supplies the
 * clock, timers, frames and random numbers. Pauses take no real time, and two runs of the same
 * program with the same seed produce the same output. The run goes until the top-level code
 * finishes, then for `settleMs` more virtual milliseconds, and then it ends.
 *
 * Errors while shutting down the runtime and board are ignored. Rejects if a bundle fails to load
 * or the last bundle does not set `pxsim.initHeadlessRuntime`.
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
        btoa,
        atob,
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
        // Headless runs always use the silent audio host, even if a bundle registered another one.
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

/** Returns the serial lines a test expects, taken from its `// @serial: text` comments. */
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
