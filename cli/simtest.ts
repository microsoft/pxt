import * as fs from "fs";
import * as vm from "vm";

import { createVirtualHost, VirtualHost } from "./virtualhost";

export { createVirtualHost, DEFAULT_SEED, VirtualHost } from "./virtualhost";

/** The outcome of running one compiled program in a context that has no browser globals. */
export interface HeadlessRunResult {
    /** Lines written to the serial port or console, in order. */
    serial: string[];
    /** Every message the runtime posted other than serial output and status. */
    messages: any[];
    /** Set when the runtime reported an error. */
    error?: string;
    /** True when the run did not finish within the timeout. */
    timedOut: boolean;
}

export interface HeadlessRunOptions {
    /** Maximum real time, in milliseconds, for the whole run, settling included. */
    timeoutMs: number;
    /** Virtual milliseconds the program runs after its top-level code finishes, before the run ends. */
    settleMs: number;
    /** The virtual host to run on; a fresh one seeded with DEFAULT_SEED when omitted. */
    host?: VirtualHost;
}

/**
 * Runs compiled simulator JS in a fresh vm context that contains only the JavaScript built-ins and
 * timers, so that any use of the DOM by the loaded simulator code fails the run.
 *
 * The runtime runs on a virtual host: its clock, timers, frames and random numbers come from
 * `options.host`, so the run takes no real time for pauses and two runs of one program produce
 * the same output. The host is driven until the top-level code finishes, then advanced by
 * `settleMs`, and then the run ends, whatever the program still has scheduled. Only the timeout
 * watchdog, and anything the bundles schedule on the global timers, run on the sandbox's real
 * timers, which are cleared when the run finishes.
 * @param bundles simulator scripts to load, in order: pxtsimcore first, then the target's bundle
 */
export function runHeadlessAsync(js: string, bundles: string[], options: HeadlessRunOptions): Promise<HeadlessRunResult> {
    const host = options.host || createVirtualHost();
    const timeouts = new Set<any>();
    const intervals = new Set<any>();
    const clearTimers = () => {
        timeouts.forEach(timer => clearTimeout(timer));
        intervals.forEach(timer => clearInterval(timer));
        timeouts.clear();
        intervals.clear();
    };
    const sandbox: any = {
        console,
        setTimeout: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
            let timer: any;
            timer = setTimeout(() => {
                timeouts.delete(timer);
                callback(...args);
            }, delay);
            timeouts.add(timer);
            return timer;
        },
        clearTimeout: (timer: any) => {
            timeouts.delete(timer);
            clearTimeout(timer);
        },
        setInterval: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
            const timer = setInterval(callback, delay, ...args);
            intervals.add(timer);
            return timer;
        },
        clearInterval: (timer: any) => {
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
    } catch (e) {
        clearTimers();
        throw e;
    }

    let hasHeadlessRuntime: boolean;
    try {
        hasHeadlessRuntime = vm.runInContext("typeof pxsim.initHeadlessRuntime", context) === "function";
    } catch (e) {
        clearTimers();
        throw e;
    }
    if (!hasHeadlessRuntime) {
        clearTimers();
        return Promise.reject(new Error(`${bundles[bundles.length - 1]} does not set pxsim.initHeadlessRuntime`));
    }

    host.install(context);
    sandbox.__js = js;
    sandbox.__options = options;
    sandbox.__host = host;
    sandbox.__clearTimers = clearTimers;
    try {
        return vm.runInContext(`
        new Promise(resolve => {
            const result = { serial: [], messages: [], timedOut: false };
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
                __clearTimers();
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
    `, context).catch((e: any) => {
        clearTimers();
        throw e;
    });
    } catch (e) {
        clearTimers();
        return Promise.reject(e);
    }
}

/** Lines the test expects on the serial port, from leading `// @serial: text` comments. */
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
