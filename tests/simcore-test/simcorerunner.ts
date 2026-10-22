/// <reference path="../../built/pxtcompiler.d.ts"/>

/* eslint-disable import/no-unassigned-import mocha-no-side-effect-code */
import "mocha";
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

import * as util from "../common/testUtils";

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
        fs.writeFileSync(toyBundle, "pxsim.initHeadlessRuntime = pxsim.initBareRuntime;");
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
        chai.expect(simtest.checkRun(result, ["one", "two"])).equals(undefined);
        chai.expect(simtest.checkRun(result, ["one"])).includes("serial output mismatch");
    });

    it("reports a runtime error", async function () {
        this.timeout(20000);
        const result = await runAsync(`let a: number[] = null; console.log(a.length)`);
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
