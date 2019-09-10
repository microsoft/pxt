import vm = require("vm");
import fs = require("fs");
import mkc = require("./mkc");




const prep = `

`

export interface CompileOptions {
    fileSystem: pxt.Map<string>;
    testMode?: boolean;
    sourceFiles?: string[];
    generatedFiles?: string[];
    jres?: pxt.Map<pxt.JRes>;
    noEmit?: boolean;
    forceEmit?: boolean;
    ast?: boolean;
    breakpoints?: boolean;
    trace?: boolean;
    justMyCode?: boolean;
    computeUsedSymbols?: boolean;
    name?: string;
    warnDiv?: boolean; // warn when emitting division operator
    bannedCategories?: string[];
    skipPxtModulesTSC?: boolean; // skip re-checking of pxt_modules/*
    skipPxtModulesEmit?: boolean; // skip re-emit of pxt_modules/*
    embedMeta?: string;
    embedBlob?: string; // base64
}

export interface CompileResult {
    outfiles: pxt.Map<string>;
    // diagnostics: KsDiagnostic[];
    success: boolean;
    times: pxt.Map<number>;
    // breakpoints?: Breakpoint[];
    usedArguments?: pxt.Map<string[]>;
}

export class Ctx {
    sandbox: any;

    constructor(public editor: mkc.DownloadedEditor) {
        this.sandbox = {
            eval: undefined,
            Function: undefined,
            setTimeout: setTimeout,
            clearInterval: clearInterval,
            clearTimeout: clearTimeout,
            setInterval: setInterval,
            clearImmediate: clearImmediate,
            setImmediate: setImmediate,
            Buffer: Buffer,
            pxtTargetBundle: {},
            scriptText: {},
            global: null,
            console: {
                log: (s: string) => console.log(s)
            }
        };

        this.sandbox.global = this.sandbox;
        (vm as any).createContext(this.sandbox, {
            codeGeneration: {
                strings: false,
                wasm: false
            }
        });

        const ed = this.editor
        this.sandbox.pxtTargetBundle = ed.targetJson
        this.runScript(ed.pxtWorkerJs, ed.website + "/pxtworker.js")
        this.runScript(prep, "prep")
        this.runSync("pxt.setupSimpleCompile()")
    }

    runScript(content: string, filename: string) {
        const scr = new vm.Script(content, {
            filename: filename
        })
        scr.runInContext(this.sandbox)
    }

    private runWithCb(code: string, cb: (err: any, res: any) => void) {
        this.sandbox._gcb = cb;
        const src = "(() => { const _cb = _gcb; _gcb = null; " + code + " })()"
        const scr = new vm.Script(src)
        scr.runInContext(this.sandbox)
    }

    runAsync(code: string) {
        const src = `Promise.resolve().then(() => ${code})` +
            `.then(v => _cb(null, v), err => _cb(err.stack || "" + err, null))`
        return new Promise<any>((resolve, reject) =>
            this.runWithCb(src, (err, res) => err ? reject(new Error(err)) : resolve(res)))
    }

    runSync(code: string): any {
        const src = `try { _cb(null, ${code}) } ` +
            `catch (err) { _cb(err.stack || "" + err, null) }`
        let errRes = null
        let normRes = null
        this.runWithCb(src, (err, res) => err ? errRes = err : normRes = res)
        if (errRes)
            throw new Error(errRes)
        return normRes
    }

    async simpleCompileAsync(prj: mkc.Package): Promise<CompileResult> {
        const opts = await this.getOptions(prj)
        // opts.breakpoints = true
        this.serviceOp("reset", {})
        return this.serviceOp("compile", { options: opts })
    }

    getOptions(prj: mkc.Package, simpleOpts: any = {}): Promise<CompileOptions> {
        this.sandbox._opts = simpleOpts
        this.sandbox._scriptText = prj.files
        return this.runAsync("pxt.simpleGetCompileOptionsAsync(_scriptText, _opts)")
    }

    serviceOp(op: string, data: any) {
        this.sandbox._data = data
        this.sandbox._op = op
        return this.runSync("pxtc.service.performOperation(_op, _data)")
    }
}
