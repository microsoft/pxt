import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as srceditor from "./srceditor"
import * as workeriface from "./workeriface"


import Cloud = pxt.Cloud;
import U = pxt.Util;

let iface: workeriface.Iface

export function init() {
    if (!iface) {
        iface = workeriface.makeWebWorker(pxt.webConfig.workerjs)
    }
}

function setDiagnostics(diagnostics: ts.pxt.KsDiagnostic[]) {
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
    background?: boolean; // not explicitely requested by user (hint for simulator)
}

export function compileAsync(options: CompileOptions = {}) {
    let trg = pkg.mainPkg.getTargetOptions()
    trg.isNative = options.native
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            if (options.debug) {
                opts.breakpoints = true
                opts.justMyCode = true
            }
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

function assembleCore(src: string): Promise<{ words: number[] }> {
    return workerOpAsync("assemble", { fileContent: src })
}

export function assemble(src: string) {
    let stackBase = 0x20004000
    return assembleCore(`.startaddr ${stackBase - 256}\n${src}`)
        .then(r => {
            return assembleCore(`.startaddr ${stackBase - (r.words.length + 1) * 4}\n${src}`)
            .then(rr => {
                U.assert(rr.words.length == r.words.length)
                return rr
            })
        })
}

function compileCoreAsync(opts: ts.pxt.CompileOptions): Promise<ts.pxt.CompileResult> {
    return workerOpAsync("compile", { options: opts })
}

export function decompileAsync(fileName: string) {
    let trg = pkg.mainPkg.getTargetOptions()
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            opts.ast = true;
            return decompileCoreAsync(opts, fileName)
        })
        .then(resp => {
            // TODO remove this
            pkg.mainEditorPkg().outputPkg.setFiles(resp.outfiles)
            setDiagnostics(resp.diagnostics)
            return resp
        })
}

function decompileCoreAsync(opts: ts.pxt.CompileOptions, fileName: string): Promise<ts.pxt.CompileResult> {
    return workerOpAsync("decompile", { options: opts, fileName: fileName })
}

export function workerOpAsync(op: string, arg: ts.pxt.service.OpArg) {
    init()
    return iface.opAsync(op, arg)
}

var firstTypecheck: Promise<void>;
var cachedApis: ts.pxt.ApisInfo;
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

export function getBlocksAsync(): Promise<ts.pxt.BlocksInfo> {
    return getApisInfoAsync()
        .then(info => ts.pxt.getBlocksInfo(info));
}

export function newProject() {
    firstTypecheck = null;
    cachedApis = null;
    workerOpAsync("reset", {}).done();
}
