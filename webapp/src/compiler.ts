import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"

let tsWorker: Worker;
let pendingMsgs: Util.StringMap<(v: any) => void> = {}
let msgId = 0;
let q: workspace.PromiseQueue;

export function init() {
    q = new workspace.PromiseQueue();
    let initPromise = new Promise<void>((resolve, reject) => {
        pendingMsgs["ready"] = resolve;
    })
    q.enqueue("main", () => initPromise)

    tsWorker = new Worker("./worker.js")
    tsWorker.onmessage = ev => {
        if (pendingMsgs.hasOwnProperty(ev.data.id)) {
            let cb = pendingMsgs[ev.data.id]
            delete pendingMsgs[ev.data.id]
            cb(ev.data.result)
        }
    }
}

function setDiagnostics(diagnostics: ts.Diagnostic[]) {
    let mainPkg = pkg.mainEditorPkg();

    mainPkg.forEachFile(f => f.diagnostics = [])

    let output = "";

    for (let diagnostic of diagnostics) {
        if (diagnostic.file) {
            const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
            const relativeFileName = diagnostic.file.fileName;
            output += `${relativeFileName}(${line + 1},${character + 1}): `;
            let f = mainPkg.filterFiles(f => f.getTypeScriptName() == diagnostic.file.fileName)[0]
            if (f)
                f.diagnostics.push(diagnostic)
        }

        const category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}\n`;
    }

    if (!output)
        output = Util.lf("Everything seems fine!\n")


    let f = mainPkg.outputPkg.setFile("output.txt", output)
    // display total number of errors on the output file
    f.numDiagnosticsOverride = diagnostics.length
}

export function getBlocksAsync() {
    return typecheckAsync()
        .then(() => workerOpAsync("blocks", {}))
        .then(v => v as ts.mbit.BlockInfo)
}

export function compileAsync() {
    return pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => compileCoreAsync(opts))
        .then(resp => {
            // TODO remove this
            pkg.mainEditorPkg().outputPkg.setFiles(resp.outfiles)
            setDiagnostics(resp.diagnostics)
            return resp
        })
}

function compileCoreAsync(opts: ts.mbit.CompileOptions): Promise<ts.mbit.CompileResult> {
    return workerOpAsync("compile", { options: opts })
}

export function workerOpAsync(op: string, arg: ts.mbit.service.OpArg) {
    return q.enqueue("main", () => new Promise<any>((resolve, reject) => {
        let id = "" + msgId++
        pendingMsgs[id] = v => {
            if (!v) {
                console.error("No worker response")
                reject(new Error("no response"))
            } else if (v.errorMessage) {
                console.error("Worker response", v.errorMessage)
                reject(new Error(v.errorMessage))
            } else {
                resolve(v)
            }
        }
        tsWorker.postMessage({ id, op, arg })
    }))
}

export function typecheckAsync() {
    return pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => workerOpAsync("setOptions", { options: opts }))
        .then(() => workerOpAsync("allDiags", {}))
        .then(setDiagnostics)
}

export function newProject() {
    workerOpAsync("reset", {}).done()
}