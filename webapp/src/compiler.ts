import * as pkg from "./package";
import * as core from "./core";
import * as workspace from "./workspace";

import U = pxt.Util;

function setDiagnostics(diagnostics: pxtc.KsDiagnostic[]) {
    let mainPkg = pkg.mainEditorPkg();

    mainPkg.forEachFile(f => f.diagnostics = [])

    let output = "";

    for (let diagnostic of diagnostics) {
        if (diagnostic.fileName) {
            output += `${diagnostic.category == ts.pxtc.DiagnosticCategory.Error ? lf("error") : diagnostic.category == ts.pxtc.DiagnosticCategory.Warning ? lf("warning") : lf("message")}: ${diagnostic.fileName}(${diagnostic.line + 1},${diagnostic.column + 1}): `;
            let f = mainPkg.filterFiles(f => f.getTypeScriptName() == diagnostic.fileName)[0]
            if (f)
                f.diagnostics.push(diagnostic)
        }

        const category = ts.pxtc.DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${ts.pxtc.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}\n`;
    }

    if (output) // helpful for debugging
        pxt.debug(output);

    if (!output)
        output = U.lf("Everything seems fine!\n")


    let f = mainPkg.outputPkg.setFile("output.txt", output)
    // display total number of errors on the output file
    f.numDiagnosticsOverride = diagnostics.filter(d => d.category == ts.pxtc.DiagnosticCategory.Error).length
}

let noOpAsync = new Promise<any>(() => { })

function catchUserErrorAndSetDiags(r: any) {
    return (v: any) => {
        if (v.isUserError) {
            core.errorNotification(v.message)
            let mainPkg = pkg.mainEditorPkg();
            let f = mainPkg.outputPkg.setFile("output.txt", v.message)
            f.numDiagnosticsOverride = 1
            return r
        } else return Promise.reject(v)
    }
}

export interface CompileOptions {
    trace?: boolean;
    native?: boolean;
    debug?: boolean;
    background?: boolean; // not explicitly requested by user (hint for simulator)
    forceEmit?: boolean;
    clickTrigger?: boolean;
}

export let emptyProgram =
    `'use strict';
__this.setupPerfCounters([]);
entryPoint = function (s) {
    // START
    __this.kill()
    return leave(s, s.r0)
}
setupDebugger(1)
`

export function emptyCompileResult(): pxtc.CompileResult {
    return {
        success: true,
        diagnostics: [],
        times: {},
        breakpoints: [],
        outfiles: {
            "binary.js": emptyProgram
                .replace("// START", pxt.appTarget.simulator.emptyRunCode || "")
        },
    }
}

export function compileAsync(options: CompileOptions = {}): Promise<pxtc.CompileResult> {
    let trg = pkg.mainPkg.getTargetOptions()
    trg.isNative = options.native
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            if (options.debug) {
                opts.breakpoints = true;
                opts.justMyCode = true;
                opts.testMode = true;
            }
            if (options.trace) {
                opts.breakpoints = true;
                opts.justMyCode = true;
                opts.trace = true;
            }
            opts.computeUsedSymbols = true;
            if (options.forceEmit)
                opts.forceEmit = true;
            if (/test=1/i.test(window.location.href))
                opts.testMode = true;
            return opts;
        })
        .then(compileCoreAsync)
        .then(resp => {
            let outpkg = pkg.mainEditorPkg().outputPkg

            // keep the assembly file - it is only generated when user hits "Download"
            // and is usually overwritten by the autorun very quickly, so it's impossible to see it
            let prevasm = outpkg.files[pxtc.BINARY_ASM]
            if (prevasm && !resp.outfiles[pxtc.BINARY_ASM]) {
                resp.outfiles[pxtc.BINARY_ASM] = prevasm.content
            }

            pkg.mainEditorPkg().outputPkg.setFiles(resp.outfiles)
            setDiagnostics(resp.diagnostics)

            return ensureApisInfoAsync()
                .then(() => {
                    if (!resp.usedSymbols || !cachedApis) return resp
                    for (let k of Object.keys(resp.usedSymbols)) {
                        resp.usedSymbols[k] = U.lookup(cachedApis.byQName, k)
                    }
                    return resp
                })
        })
        .catch(catchUserErrorAndSetDiags(noOpAsync))
}

function assembleCore(src: string): Promise<{ words: number[] }> {
    return workerOpAsync("assemble", { fileContent: src })
}

export function assembleAsync(src: string) {
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

function compileCoreAsync(opts: pxtc.CompileOptions): Promise<pxtc.CompileResult> {
    return workerOpAsync("compile", { options: opts })
}

export function py2tsAsync(): Promise<{ generated: pxt.Map<string>, diagnostics: pxtc.KsDiagnostic[] }> {
    let trg = pkg.mainPkg.getTargetOptions()
    return waitForFirstTypecheckAsync()
        .then(() => pkg.mainPkg.getCompileOptionsAsync(trg))
        .then(opts => {
            opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME
            return workerOpAsync("py2ts", { options: opts })
        })
}

export function completionsAsync(fileName: string, position: number, fileContent?: string): Promise<pxtc.CompletionInfo> {
    return workerOpAsync("getCompletions", {
        fileName,
        fileContent,
        position
    });
}

export function syntaxInfoAsync(infoType: pxtc.InfoType, fileName: string, position: number, fileContent: string): Promise<pxtc.SyntaxInfo> {
    return workerOpAsync("syntaxInfo", {
        fileName,
        fileContent,
        position,
        infoType
    });
}

export function decompileAsync(fileName: string, blockInfo?: ts.pxtc.BlocksInfo, oldWorkspace?: Blockly.Workspace, blockFile?: string): Promise<pxtc.CompileResult> {
    let trg = pkg.mainPkg.getTargetOptions()
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            opts.ast = true;
            opts.testMode = true;
            opts.alwaysDecompileOnStart = pxt.appTarget.runtime && pxt.appTarget.runtime.onStartUnDeletable;
            return decompileCoreAsync(opts, fileName)
        })
        .then(resp => {
            // try to patch event locations
            if (resp.success && blockInfo && oldWorkspace && blockFile) {
                const newXml = pxt.blocks.layout.patchBlocksFromOldWorkspace(blockInfo, oldWorkspace, resp.outfiles[blockFile]);
                resp.outfiles[blockFile] = newXml;
            }
            pkg.mainEditorPkg().outputPkg.setFiles(resp.outfiles)
            setDiagnostics(resp.diagnostics)
            return resp
        })
}

export function decompileSnippetAsync(code: string, blockInfo?: ts.pxtc.BlocksInfo): Promise<string> {
    const snippetTs = "main.ts";
    const snippetBlocks = "main.blocks";
    let trg = pkg.mainPkg.getTargetOptions()
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            opts.fileSystem[snippetTs] = code;
            opts.fileSystem[snippetBlocks] = "";

            if (opts.sourceFiles.indexOf(snippetTs) === -1) {
                opts.sourceFiles.push(snippetTs);
            }
            if (opts.sourceFiles.indexOf(snippetBlocks) === -1) {
                opts.sourceFiles.push(snippetBlocks);
            }

            opts.ast = true;
            return decompileCoreAsync(opts, snippetTs)
        }).then(resp => {
            return resp.outfiles[snippetBlocks]
        })
}

function decompileCoreAsync(opts: pxtc.CompileOptions, fileName: string): Promise<pxtc.CompileResult> {
    return workerOpAsync("decompile", { options: opts, fileName: fileName, blocks: blocksOptions() })
}

export function pyDecompileAsync(fileName: string): Promise<pxtc.CompileResult> {
    let trg = pkg.mainPkg.getTargetOptions()
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            opts.ast = true;
            opts.testMode = true;
            opts.alwaysDecompileOnStart = pxt.appTarget.runtime && pxt.appTarget.runtime.onStartUnDeletable;
            return pyDecompileCoreAsync(opts, fileName)
        })
        .then(resp => {
            pkg.mainEditorPkg().outputPkg.setFiles(resp.outfiles)
            setDiagnostics(resp.diagnostics)
            return resp
        })
}

function pyDecompileCoreAsync(opts: pxtc.CompileOptions, fileName: string): Promise<pxtc.CompileResult> {
    return workerOpAsync("pydecompile", { options: opts, fileName: fileName })
}

export function workerOpAsync(op: string, arg: pxtc.service.OpArg) {
    const startTm = Date.now()
    pxt.debug("worker op: " + op)
    return pxt.worker.getWorker(pxt.webConfig.workerjs)
        .opAsync(op, arg)
        .then(res => {
            if (pxt.appTarget.compile.switches.time) {
                pxt.log(`Worker perf: ${op} ${Date.now() - startTm}ms`)
                if (res.times)
                    console.log(res.times)
            }
            pxt.debug("worker op done: " + op)
            return res
        })
}

let firstTypecheck: Promise<void>;
let cachedApis: pxtc.ApisInfo;
let cachedBlocks: pxtc.BlocksInfo;
let refreshApis = false;

function waitForFirstTypecheckAsync() {
    if (firstTypecheck) return firstTypecheck;
    else return typecheckAsync();
}

function ensureApisInfoAsync(): Promise<void> {
    if (refreshApis || !cachedApis)
        return workerOpAsync("apiInfo", {})
            .then(apis => {
                if (Object.keys(apis).length === 0) return undefined;
                refreshApis = false;
                return ts.pxtc.localizeApisAsync(apis, pkg.mainPkg);
            }).then(apis => {
                cachedApis = apis;
            })
    else return Promise.resolve()
}

export function apiSearchAsync(searchFor: pxtc.service.SearchOptions) {
    return ensureApisInfoAsync()
        .then(() => {
            searchFor.localizedApis = cachedApis;
            searchFor.localizedStrings = pxt.Util.getLocalizedStrings();
            return workerOpAsync("apiSearch", { search: searchFor, blocks: blocksOptions() });
        });
}

export function projectSearchAsync(searchFor: pxtc.service.ProjectSearchOptions) {
    return ensureApisInfoAsync()
        .then(() => {
            return workerOpAsync("projectSearch", { projectSearch: searchFor });
        });
}

export function projectSearchClear() {
    return ensureApisInfoAsync()
        .then(() => {
            return workerOpAsync("projectSearchClear", {});
        });
}

export function formatAsync(input: string, pos: number) {
    return workerOpAsync("format", { format: { input: input, pos: pos } });
}

export function snippetAsync(qName: string, python?: boolean) {
    return workerOpAsync("snippet", { snippet: { qName, python } });
}

export function typecheckAsync() {
    let p = pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => {
            opts.testMode = true // show errors in all top-level code
            return workerOpAsync("setOptions", { options: opts })
        })
        .then(() => workerOpAsync("allDiags", {}))
        .then(setDiagnostics)
        .then(ensureApisInfoAsync)
        .catch(catchUserErrorAndSetDiags(null))
    if (!firstTypecheck) firstTypecheck = p;
    return p;
}

export function getApisInfoAsync() {
    return waitForFirstTypecheckAsync()
        .then(() => cachedApis)
}

export function getBlocksAsync(): Promise<pxtc.BlocksInfo> {
    return cachedBlocks
        ? Promise.resolve(cachedBlocks)
        : getApisInfoAsync().then(info => {
            cachedBlocks = pxtc.getBlocksInfo(info);
            return cachedBlocks;
        });
}

export interface UpgradeResult {
    success: boolean;
    editor?: string;
    patchedFiles?: pxt.Map<string>;
    errorCodes?: pxt.Map<number>;
}

export function applyUpgradesAsync(): Promise<UpgradeResult> {
    const mainPkg = pkg.mainPkg;
    const epkg = pkg.getEditorPkg(mainPkg);
    const pkgVersion = pxt.semver.parse(epkg.header.targetVersion || "0.0.0");
    const trgVersion = pxt.semver.parse(pxt.appTarget.versions.target);

    if (pkgVersion.major === trgVersion.major && pkgVersion.minor === trgVersion.minor) {
        pxt.debug("Skipping project upgrade")
        return Promise.resolve({
            success: true
        });
    }

    const upgradeOp = epkg.header.editor !== pxt.BLOCKS_PROJECT_NAME ? upgradeFromTSAsync : upgradeFromBlocksAsync;

    let projectNeverCompiled = false;

    return checkPatchAsync()
        .catch(() => projectNeverCompiled = true)
        .then(upgradeOp)
        .then(result => {
            if (!result.success) {
                pxt.tickEvent("upgrade.failed", {
                    projectEditor: epkg.header.editor,
                    preUpgradeVersion: epkg.header.targetVersion || "unknown",
                    errors: JSON.stringify(result.errorCodes),
                    projectNeverCompiled: "" + projectNeverCompiled
                });

                pxt.debug("Upgrade failed; bailing out and leaving project as-is");

                return Promise.resolve(result);
            }

            pxt.tickEvent("upgrade.success", {
                projectEditor: epkg.header.editor,
                upgradedEditor: result.editor,
                preUpgradeVersion: epkg.header.targetVersion || "unknown",
                projectNeverCompiled: "" + projectNeverCompiled
            });

            pxt.debug("Upgrade successful!");

            return patchProjectFilesAsync(epkg, result.patchedFiles, result.editor)
                .then(() => result);
        })
}

function upgradeFromBlocksAsync(): Promise<UpgradeResult> {
    const mainPkg = pkg.mainPkg;
    const project = pkg.getEditorPkg(mainPkg);
    const targetVersion = project.header.targetVersion;

    const fileText = project.files["main.blocks"] ? project.files["main.blocks"].content : `<block type="${ts.pxtc.ON_START_TYPE}"></block>`;
    let ws: Blockly.Workspace;
    let patchedFiles: pxt.Map<string> = {};

    pxt.debug("Applying upgrades to blocks")

    return pxt.BrowserUtils.loadBlocklyAsync()
        .then(() => getBlocksAsync())
        .then(info => {
            ws = new Blockly.Workspace();
            const text = pxt.blocks.importXml(targetVersion, fileText, info, true);

            const xml = Blockly.Xml.textToDom(text);
            pxt.blocks.domToWorkspaceNoEvents(xml, ws);
            patchedFiles["main.blocks"] = text;
            return pxt.blocks.compileAsync(ws, info)
        })
        .then(res => {
            patchedFiles["main.ts"] = res.source;
            return checkPatchAsync(patchedFiles);
        })
        .then(() => {
            return {
                success: true,
                editor: pxt.BLOCKS_PROJECT_NAME,
                patchedFiles
            };
        })
        .catch(() => {
            pxt.debug("Block upgrade failed, falling back to TS");
            return upgradeFromTSAsync();
        });
}

function upgradeFromTSAsync(): Promise<UpgradeResult> {
    const mainPkg = pkg.mainPkg;
    const project = pkg.getEditorPkg(mainPkg);
    const targetVersion = project.header.targetVersion;

    const patchedFiles: pxt.Map<string> = {};
    pxt.Util.values(project.files).filter(isTsFile).forEach(file => {
        const patched = pxt.patching.patchJavaScript(targetVersion, file.content);
        if (patched != file.content) {
            patchedFiles[file.name] = patched;
        }
    });

    pxt.debug("Applying upgrades to TypeScript")

    return checkPatchAsync(patchedFiles)
        .then(() => {
            return {
                success: true,
                editor: pxt.JAVASCRIPT_PROJECT_NAME,
                patchedFiles
            };
        })
        .catch(e => {
            return {
                success: false,
                errorCodes: e.errorCodes
            };
        });
}

interface UpgradeError extends Error {
    errorCodes?: pxt.Map<number>;
}

function checkPatchAsync(patchedFiles?: pxt.Map<string>) {
    const mainPkg = pkg.mainPkg;
    return mainPkg.getCompileOptionsAsync()
        .then(opts => {
            if (patchedFiles) {
                Object.keys(opts.fileSystem).forEach(fileName => {
                    if (patchedFiles[fileName]) {
                        opts.fileSystem[fileName] = patchedFiles[fileName];
                    }
                });
            }
            return compileCoreAsync(opts);
        })
        .then(res => {
            if (!res.success) {
                const errorCodes: pxt.Map<number> = {};
                if (res.diagnostics) {
                    res.diagnostics.forEach(d => {
                        const code = "TS" + d.code;
                        errorCodes[code] = (errorCodes[code] || 0) + 1;
                    });
                }

                const error = new Error("Compile failed on updated package") as UpgradeError;
                error.errorCodes = errorCodes;
                return Promise.reject(error);
            }
            return Promise.resolve();
        });
}

function patchProjectFilesAsync(project: pkg.EditorPackage, patchedFiles: pxt.Map<string>, editor: string) {
    Object.keys(patchedFiles).forEach(name => project.setFile(name, patchedFiles[name]));
    project.header.targetVersion = pxt.appTarget.versions.target;
    project.header.editor = editor;
    return project.saveFilesAsync();
}

function isTsFile(file: pkg.File) {
    return pxt.Util.endsWith(file.getName(), ".ts");
}

export function updatePackagesAsync(packages: pkg.EditorPackage[], token?: pxt.Util.CancellationToken): Promise<boolean> {
    const epkg = pkg.mainEditorPkg();
    let backup: pxt.workspace.Header;
    let completed = 0;
    if (token) token.startOperation();

    return workspace.getTextAsync(epkg.header.id)
        .then(files => workspace.makeBackupAsync(epkg.header, files))
        .then(newHeader => {
            backup = newHeader;
            epkg.header.backupRef = backup.id;

            return workspace.saveAsync(epkg.header);
        })
        .then(() => Promise.each(packages, p => {
            if (token) token.throwIfCancelled();
            return epkg.updateDepAsync(p.getPkgId())
                .then(() => {
                    ++completed;
                    if (token && !token.isCancelled()) token.reportProgress(completed, packages.length);
                })
        })
        )
        .then(() => pkg.loadPkgAsync(epkg.header.id))
        .then(() => newProjectAsync())
        .then(() => checkPatchAsync())
        .then(() => {
            if (token) token.throwIfCancelled();
            delete epkg.header.backupRef;
            return workspace.saveAsync(epkg.header)
        })
        .then(() => /* Success! */ true)
        .catch(() => {
            // Something went wrong or we broke the project, so restore the backup
            return workspace.restoreFromBackupAsync(epkg.header)
                .then(() => false);
        })
        .finally(() => {
            // Clean up after
            let cleanupOperation = Promise.resolve();
            if (backup) {
                backup.isDeleted = true;
                cleanupOperation = workspace.saveAsync(backup)
            }

            return cleanupOperation
                .finally(() => {
                    if (token) token.resolveCancel();
                });
        });
}


export function newProjectAsync() {
    firstTypecheck = null;
    cachedApis = null;
    cachedBlocks = null;
    return workerOpAsync("reset", {});
}

export function getPackagesWithErrors(): pkg.EditorPackage[] {
    const badPackages: pxt.Map<pkg.EditorPackage> = {};

    const topPkg = pkg.mainEditorPkg();
    if (topPkg) {
        const corePkgs = pxt.Package.corePackages().map(pkg => pkg.name);

        topPkg.forEachFile(file => {
            if (file.diagnostics && file.diagnostics.length && file.epkg && corePkgs.indexOf(file.epkg.getPkgId()) === -1 && !file.epkg.isTopLevel() &&
                file.diagnostics.some(d => d.category === ts.pxtc.DiagnosticCategory.Error)) {
                badPackages[file.epkg.getPkgId()] = file.epkg;
            }
        });
    }
    return pxt.Util.values(badPackages);
}

function blocksOptions(): pxtc.service.BlocksOptions {
    if (pxt.appTarget && pxt.appTarget.runtime && pxt.appTarget.runtime.bannedCategories && pxt.appTarget.runtime.bannedCategories.length) {
        return { bannedCategories: pxt.appTarget.runtime.bannedCategories };
    }
    return undefined;
}