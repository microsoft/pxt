import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"

import Cloud = ks.Cloud;
import U = ks.Util;

let tsWorker: Worker;
let pendingMsgs: U.StringMap<(v: any) => void> = {}
let msgId = 0;
let q: U.PromiseQueue;

export function init() {
    q = new U.PromiseQueue();
    let initPromise = new Promise<void>((resolve, reject) => {
        pendingMsgs["ready"] = resolve;
    })
    q.enqueue("main", () => initPromise)

    let workerJs = "./worker.js"

    let cfg = (window as any).tdConfig
    if (cfg && cfg.relid) {
        workerJs = "/app/worker.js?r=" + cfg.relid
    }

    tsWorker = new Worker(workerJs)
    tsWorker.onmessage = ev => {
        if (pendingMsgs.hasOwnProperty(ev.data.id)) {
            let cb = pendingMsgs[ev.data.id]
            delete pendingMsgs[ev.data.id]
            cb(ev.data.result)
        }
    }
}

function setDiagnostics(diagnostics: ts.ks.KsDiagnostic[]) {
    let mainPkg = pkg.mainEditorPkg();

    mainPkg.forEachFile(f => f.diagnostics = [])

    let output = "";

    for (let diagnostic of diagnostics) {
        if (diagnostic.fileName) {
            output += `${diagnostic.fileName}(${diagnostic.line + 1},${diagnostic.character + 1}): `;
            let f = mainPkg.filterFiles(f => f.getTypeScriptName() == diagnostic.fileName)[0]
            if (f)
                f.diagnostics.push(diagnostic)
        }

        const category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}\n`;
    }

    if (!output)
        output = U.lf("Everything seems fine!\n")


    let f = mainPkg.outputPkg.setFile("output.txt", output)
    // display total number of errors on the output file
    f.numDiagnosticsOverride = diagnostics.length
}

export interface CompileOptions {
    native?: boolean;
    debug?: boolean;
}

export function compileAsync(options: CompileOptions = {}) {
    let trg = pkg.mainPkg.getTargetOptions()
    trg.isNative = options.native
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            if (options.debug)
                opts.breakpoints = true
            return opts
        })
        .then(compileCoreAsync)
        .then(resp => {
            // TODO remove this
            pkg.mainEditorPkg().outputPkg.setFiles(resp.outfiles)
            setDiagnostics(resp.diagnostics)
            return resp
        })
}

function compileCoreAsync(opts: ts.ks.CompileOptions): Promise<ts.ks.CompileResult> {
    return workerOpAsync("compile", { options: opts })
}

export function workerOpAsync(op: string, arg: ts.ks.service.OpArg) {
    return q.enqueue("main", () => new Promise<any>((resolve, reject) => {
        let id = "" + msgId++
        pendingMsgs[id] = v => {
            if (!v) {
                ks.reportError("no worker response", null)
                reject(new Error("no response"))
            } else if (v.errorMessage) {
                ks.reportError("worker response: " + v.errorMessage, null)
                reject(new Error(v.errorMessage))
            } else {
                resolve(v)
            }
        }
        tsWorker.postMessage({ id, op, arg })
    }))
}

var firstTypecheck: Promise<void>;
var cachedApis: ts.ks.ApisInfo;
var refreshApis = false;

function waitForFirstTypecheckAsync() {
    if (firstTypecheck) return firstTypecheck;
    else return typecheckAsync();
}

export function typecheckAsync() {
    let p = pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => workerOpAsync("setOptions", { options: opts }))
        .then(() => workerOpAsync("allDiags", {}))
        .then(setDiagnostics)
        .then(() => {
            if (refreshApis || !cachedApis)
                return workerOpAsync("apiInfo", {})
                    .then(apis => {
                        refreshApis = false;
                        cachedApis = apis;
                    })
            else return Promise.resolve()
        })
    if (!firstTypecheck) firstTypecheck = p;
    return p;
}

export function getApisInfoAsync() {
    return waitForFirstTypecheckAsync()
        .then(() => cachedApis)
}

export function getBlocksAsync(): Promise<ts.ks.BlocksInfo> {
    return getApisInfoAsync()
        .then(info => ts.ks.getBlocksInfo(info));
}

export function newProject() {
    firstTypecheck = null;
    cachedApis = null;
    workerOpAsync("reset", {}).done();
}
