import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"

let tsWorker: Worker;
let initPromise: Promise<void>;
let pendingMsgs: Util.StringMap<(v: any) => void> = {}
let msgId = 0;

export function init() {
    initPromise = new Promise<void>((resolve, reject) => {
        pendingMsgs["ready"] = resolve;
    })
    tsWorker = new Worker("./worker.js")
    tsWorker.onmessage = ev => {
        if (pendingMsgs.hasOwnProperty(ev.data.id)) {
            let cb = pendingMsgs[ev.data.id]
            delete pendingMsgs[ev.data.id]
            cb(ev.data.result)
        }
    }
}

function setDiagnostics(resp: ts.mbit.CompileResult, isFull = false) {
    let mainPkg = pkg.mainEditorPkg();

    mainPkg.forEachFile(f => f.diagnostics = [])

    let output = "";

    for (let diagnostic of resp.diagnostics) {
        if (diagnostic.file) {
            const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
            const relativeFileName = diagnostic.file.fileName;
            output += `${relativeFileName}(${line + 1},${character + 1}): `;
            let localName = diagnostic.file.fileName.replace(/^yelm_modules\//, "")
            if (localName.indexOf('/') < 0) localName = "this/" + localName
            let f = mainPkg.lookupFile(localName)
            if (f)
                f.diagnostics.push(diagnostic)
        }

        const category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}\n`;
    }

    if (!output)
        output = Util.lf("Everything seems fine!\n")


    if (isFull)
        mainPkg.outputPkg.setFiles(resp.outfiles)

    let f = mainPkg.outputPkg.setFile("output.txt", output)
    // display total number of errors on the output file
    f.numDiagnosticsOverride = resp.diagnostics.length    

    return resp;
}

export function compileAsync() {
    return pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => compileCoreAsync(opts))
        .then(resp => {
            let hex = resp.outfiles["microbit.hex"]
            if (hex) {
                let fn = "microbit-" + pkg.mainEditorPkg().header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
                core.browserDownloadText(hex, fn, "application/x-microbit-hex")
            }

            return setDiagnostics(resp, true)
        })
}

function compileCoreAsync(opts: ts.mbit.CompileOptions): Promise<ts.mbit.CompileResult> {
    return workerOpAsync("compile", { options: opts })
}

function workerOpAsync(op: string, arg: ts.mbit.service.OpArg) {
    return initPromise
        .then(() => new Promise<any>((resolve, reject) => {
            let id = "" + msgId++
            pendingMsgs[id] = resolve
            tsWorker.postMessage({ id, op, arg })
        }))
}

export function typecheckAsync() {
    return pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => {
            opts.noEmit = true
            return compileCoreAsync(opts)
        })
        .then(setDiagnostics)
}
