import * as fs from "fs";
import * as vm from "vm";

/** The outcome of running one compiled program in a context that has no browser globals. */
export interface HeadlessRunResult {
    /** Lines written to the serial port or console, in order. */
    serial: string[];
    /** Every message the runtime posted other than serial output and status. */
    messages: any[];
    /** Set when the runtime reported an error. */
    error?: string;
    /** True when the program did not finish within the timeout. */
    timedOut: boolean;
}

export interface HeadlessRunOptions {
    /** Maximum time for the top-level code to finish. */
    timeoutMs: number;
    /** How long to keep running after the top-level code finishes, for events and background work. */
    settleMs: number;
}

/**
 * Runs compiled simulator JS in a fresh vm context that contains only the JavaScript built-ins and
 * timers, so that any use of the DOM by the loaded simulator code fails the run.
 * @param bundles simulator scripts to load, in order: pxtsimcore first, then the target's bundle
 */
export function runHeadlessAsync(js: string, bundles: string[], options: HeadlessRunOptions): Promise<HeadlessRunResult> {
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
    for (const bundle of bundles)
        vm.runInContext(fs.readFileSync(bundle, "utf8"), context, { filename: bundle });

    if (vm.runInContext("typeof pxsim.initHeadlessRuntime", context) !== "function")
        return Promise.reject(new Error(`${bundles[bundles.length - 1]} does not set pxsim.initHeadlessRuntime`));

    sandbox.__js = js;
    sandbox.__options = options;
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
                try { runtime && runtime.kill(); } catch (e) { }
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
            Promise.resolve()
                 .then(() => {
                     if (!finished)
                         return runtime.board.initAsync({ type: "run", code: __js });
                 })
                 .then(() => {
                     if (!finished)
                        runtime.run(() => {
                            clearTimeout(timer);
                            setTimeout(finish, __options.settleMs);
                        });
                 })
                 .catch(e => {
                     if (!finished) runtime.errorHandler(e);
                 });
        })
    `, context);
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
        return "timed out before the top-level code finished";
    if (expectedSerial.length && JSON.stringify(result.serial) !== JSON.stringify(expectedSerial))
        return `serial output mismatch\n  expected: ${JSON.stringify(expectedSerial)}\n  actual:   ${JSON.stringify(result.serial)}`;
    return undefined;
}
