import * as pkg from "./package";
import * as core from "./core";
import * as workspace from "./workspace";

import U = pxt.Util;

function setDiagnostics(diagnostics: pxtc.KsDiagnostic[], sourceMap?: pxtc.SourceInterval[]) {
    let mainPkg = pkg.mainEditorPkg();

    mainPkg.forEachFile(f => f.diagnostics = [])

    let output = "";

    // If we have source map information, then prepare a function for converting
    //  TS errors to PY
    let tsErrToPyLoc: (err: pxtc.LocationInfo) => pxtc.LocationInfo = undefined;
    if (diagnostics.length > 0
        && mainPkg.files["main.ts"]
        && mainPkg.files["main.py"]
        && sourceMap) {
        const tsFile = mainPkg.files["main.ts"].content
        const pyFile = mainPkg.files["main.py"].content
        const helpers = pxtc.BuildSourceMapHelpers(sourceMap, tsFile, pyFile)
        tsErrToPyLoc = helpers.ts.locToLoc
    }

    for (let diagnostic of diagnostics) {
        if (diagnostic.fileName) {
            output += `${diagnostic.category == ts.pxtc.DiagnosticCategory.Error ? lf("error") : diagnostic.category == ts.pxtc.DiagnosticCategory.Warning ? lf("warning") : lf("message")}: ${diagnostic.fileName}(${diagnostic.line + 1},${diagnostic.column + 1}): `;
            let f = mainPkg.filterFiles(f => f.getTextFileName() == diagnostic.fileName)[0]
            if (f) {
                f.diagnostics.push(diagnostic)

                if (tsErrToPyLoc && diagnostic.fileName === "main.ts") {
                    let pyLoc = tsErrToPyLoc(diagnostic)
                    if (pyLoc) {
                        let pyError = { ...diagnostic, ...pyLoc }
                        let pyFile = mainPkg.files["main.py"]
                        pyFile.diagnostics.push(pyError)
                    }
                }
            }
        }

        const category = ts.pxtc.DiagnosticCategory[diagnostic.category].toLowerCase();
        output += `${category} TS${diagnostic.code}: ${ts.pxtc.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}\n`;
    }

    // people often ask about where to look for errors, and many will look in the console
    // the output.txt has usability issues
    if (output)
        pxt.log(output);

    if (!output)
        output = U.lf("Everything seems fine!\n")


    let f = mainPkg.outputPkg.setFile("output.txt", output)
    // display total number of errors on the output file
    const errors = diagnostics.filter(d => d.category == ts.pxtc.DiagnosticCategory.Error);
    f.numDiagnosticsOverride = errors.length
    reportDiagnosticErrors(errors);
}

let lastErrorCounts: string = "";
function reportDiagnosticErrors(errors: pxtc.KsDiagnostic[]) {
    // report to analytics;
    if (errors && errors.length) {
        const counts: pxt.Map<number> = {};
        errors.filter(err => err.code).forEach(err => counts[err.code] = (counts[err.code] || 0) + 1);
        const errorCounts = JSON.stringify(errors);
        if (errorCounts !== lastErrorCounts) {
            pxt.tickEvent("diagnostics", counts);
            lastErrorCounts = errorCounts;
        }
    } else {
        lastErrorCounts = "";
    }
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
    debugExtensionCode?: boolean;
    background?: boolean; // not explicitly requested by user (hint for simulator)
    forceEmit?: boolean;
    clickTrigger?: boolean;
    jsMetaVersion?: string;
}

export let emptyProgram =
    `(function (ectx) {
'use strict';
ectx.runtime.setupPerfCounters([]);
ectx.setupDebugger(1)
return function (s) {
    // START
    ectx.runtime.kill()
    return ectx.leave(s, s.r0)
}
})
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
                opts.justMyCode = !options.debugExtensionCode;
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

            // add metadata about current build
            if (options.jsMetaVersion && resp.outfiles[pxtc.BINARY_JS]) {
                const meta: any = {
                    simUrl: pxt.webConfig.simUrl.replace(/\/[^\-]*---simulator/, `/v${pxt.appTarget.versions.target}/---simulator`),
                    cdnUrl: pxt.webConfig.cdnUrl,
                    version: options.jsMetaVersion,
                    target: pxt.appTarget.id,
                    targetVersion: pxt.appTarget.versions.target
                };
                const gitJson = pkg.mainPkg.readGitJson();
                if (gitJson)
                    meta.repo = pxt.github.parseRepoId(gitJson.repo).fullName;
                resp.outfiles[pxtc.BINARY_JS] =
                    `// meta=${JSON.stringify(meta)}
${resp.outfiles[pxtc.BINARY_JS]}`;
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

export function py2tsAsync(force = false): Promise<pxtc.transpile.TranspileResult> {
    let trg = pkg.mainPkg.getTargetOptions()
    return waitForFirstTypecheckAsync()
        .then(() => pkg.mainPkg.getCompileOptionsAsync(trg))
        .then(opts => {
            opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME

            return workerOpAsync("py2ts", { options: opts })
        })
}

export function completionsAsync(fileName: string, position: number, wordStartPos: number, wordEndPos: number, fileContent?: string): Promise<pxtc.CompletionInfo> {
    return workerOpAsync("getCompletions", {
        fileName,
        fileContent,
        position,
        wordStartPos,
        wordEndPos,
        runtime: pxt.appTarget.runtime
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

// TS -> blocks, load blocs before calling this api
export function decompileBlocksSnippetAsync(code: string, blockInfo?: ts.pxtc.BlocksInfo, dopts?: { snippetMode?: boolean }): Promise<pxtc.CompileResult> {
    const snippetTs = "main.ts";
    const snippetBlocks = "main.blocks";
    const trg = pkg.mainPkg.getTargetOptions()
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            opts.fileSystem[snippetTs] = code;
            opts.fileSystem[snippetBlocks] = "";
            opts.snippetMode = (dopts && dopts.snippetMode) || false;

            if (opts.sourceFiles.indexOf(snippetTs) === -1) {
                opts.sourceFiles.push(snippetTs);
            }
            if (opts.sourceFiles.indexOf(snippetBlocks) === -1) {
                opts.sourceFiles.push(snippetBlocks);
            }
            opts.ast = true;
            return decompileCoreAsync(opts, snippetTs)
        });
}

// Py -> blocks
export function pySnippetToBlocksAsync(code: string, blockInfo?: ts.pxtc.BlocksInfo): Promise<pxtc.CompileResult> {
    const snippetPy = "main.py";
    const snippetTs = "main.ts";
    const snippetBlocks = "main.blocks";
    let trg = pkg.mainPkg.getTargetOptions()
    return waitForFirstTypecheckAsync()
        .then(() => pkg.mainPkg.getCompileOptionsAsync(trg))
        .then(opts => {
            opts.fileSystem[snippetPy] = code;
            opts.fileSystem[snippetBlocks] = "";

            if (opts.sourceFiles.indexOf(snippetPy) === -1) {
                opts.sourceFiles.push(snippetPy);
            }
            if (opts.sourceFiles.indexOf(snippetBlocks) === -1) {
                opts.sourceFiles.push(snippetBlocks);
            }
            return workerOpAsync("py2ts", { options: opts });
        })
        .then(res => {
            return decompileBlocksSnippetAsync(res.outfiles[snippetTs], blockInfo)
        });
}

function decompileCoreAsync(opts: pxtc.CompileOptions, fileName: string): Promise<pxtc.CompileResult> {
    return workerOpAsync("decompile", { options: opts, fileName: fileName })
}

// TS -> Py
export function pyDecompileAsync(fileName: string): Promise<pxtc.transpile.TranspileResult> {
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

// TS -> Py
export function decompilePythonSnippetAsync(code: string): Promise<string> {
    const snippetTs = "main.ts";
    const snippetPy = "main.py";
    let trg = pkg.mainPkg.getTargetOptions()
    return pkg.mainPkg.getCompileOptionsAsync(trg)
        .then(opts => {
            opts.fileSystem[snippetTs] = code;
            opts.fileSystem[snippetPy] = "";

            if (opts.sourceFiles.indexOf(snippetTs) === -1) {
                opts.sourceFiles.push(snippetTs);
            }
            if (opts.sourceFiles.indexOf(snippetPy) === -1) {
                opts.sourceFiles.push(snippetPy);
            }
            opts.ast = true;
            return pyDecompileCoreAsync(opts, snippetTs)
        }).then(resp => {
            return resp.outfiles[snippetPy]
        })
}

function pyDecompileCoreAsync(opts: pxtc.CompileOptions, fileName: string): Promise<pxtc.transpile.TranspileResult> {
    return workerOpAsync("pydecompile", { options: opts, fileName: fileName })
}

export function workerOpAsync<T extends keyof pxtc.service.ServiceOps>(op: T, arg: pxtc.service.OpArg): Promise<any> {
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
            return workerOpAsync("apiSearch", {
                search: searchFor,
                blocks: blocksOptions()
            });
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

export function snippetAsync(qName: string, python?: boolean): Promise<string> {
    let initStep = Promise.resolve();
    if (python) {
        // To make sure that the service is working with the most recent version of the file,
        // run a typecheck
        initStep = typecheckAsync().then(() => { })
    }
    return initStep.then(() => workerOpAsync("snippet", {
        snippet: { qName, python },
        runtime: pxt.appTarget.runtime
    })).then(res => res as string)
}

export function typecheckAsync() {
    let p = pkg.mainPkg.getCompileOptionsAsync()
        .then(opts => {
            opts.testMode = true // show errors in all top-level code
            return workerOpAsync("setOptions", { options: opts })
        })
        .then(() => workerOpAsync("allDiags", {}) as Promise<pxtc.CompileResult>)
        .then(r => setDiagnostics(r.diagnostics, r.sourceMap))
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
    if (!cachedBlocks) {
        // Used packaged info
        const bannedCategories = pkg.mainPkg.resolveBannedCategories();
        return getCachedApiInfoAsync(pkg.mainEditorPkg(), pxt.getBundledApiInfo())
            .then(apis => {
                if (apis) {
                    return ts.pxtc.localizeApisAsync(apis, pkg.mainPkg)
                        .then(apis => {
                            return cachedBlocks = pxtc.getBlocksInfo(apis, bannedCategories)
                        });
                }
                else {
                    return getApisInfoAsync().then(info => {
                        const bannedCategories = pkg.mainPkg.resolveBannedCategories();
                        cachedBlocks = pxtc.getBlocksInfo(info, bannedCategories);

                        return cacheApiInfoAsync(pkg.mainEditorPkg(), info);
                    }).then(() => cachedBlocks)
                }
            })
    }

    return Promise.resolve(cachedBlocks);
}

interface BundledPackage {
    dirname: string;
    config: pxt.PackageConfig;
    files: pxt.Map<string>;
}

interface UsedPackageInfo {
    dirname: string,
    info: pxt.PackageApiInfo
}

async function getCachedApiInfoAsync(project: pkg.EditorPackage, bundled: pxt.Map<pxt.PackageApiInfo>): Promise<pxtc.ApisInfo> {
    if (!bundled) return null;
    const corePkgName = "libs/" + pxt.appTarget.corepkg;
    const corePkg = bundled[corePkgName];
    if (!corePkg) return null;

    // If the project has a TypeScript file beside main.ts, it could export blocks so we can't use the cache
    const files = project.getAllFiles();
    if (Object.keys(files).some(filename => filename != "main.ts" && filename.indexOf("/") === -1 && pxt.Util.endsWith(filename, ".ts"))) {
        return null;
    }

    const bundledPackages: BundledPackage[] = pxt.appTarget.bundleddirs.map(dirname => {
        const pack = pxt.appTarget.bundledpkgs[dirname.substr(dirname.lastIndexOf("/") + 1)];

        if (!pack) return null;

        return {
            dirname,
            files: pack,
            config: JSON.parse(pack[pxt.CONFIG_NAME]) as pxt.PackageConfig
        }
    }).filter(p => p && p.config);

    const usedPackages = project.pkgAndDeps();
    const externalPackages: pkg.EditorPackage[] = [];
    const usedPackageInfo: UsedPackageInfo[] = [{
        dirname: corePkgName,
        info: corePkg
    }];

    for (const dep of usedPackages) {
        if (dep.id === "built" || dep.isTopLevel()) continue;

        let foundIt = false;
        for (const bundle of bundledPackages) {
            if (bundle.config.name === dep.getKsPkg().config.name) {
                usedPackageInfo.push({
                    dirname: bundle.dirname,
                    info: bundled[bundle.dirname]
                });
                foundIt = true;
                break;
            }
        }

        if (!foundIt) externalPackages.push(dep);
    }

    if (externalPackages.length) {
        const db = await ApiInfoIndexedDb.createAsync();

        for (const dep of externalPackages) {
            const entry = await db.getAsync(dep);

            if (!entry) {
                pxt.debug(`Could not find cached API info for ${dep.getKsPkg().config.name}, waiting for full compile`);
                return null;
            }
            else {
                pxt.debug(`Fetched cached API info for ${dep.getKsPkg().config.name}`);
                usedPackageInfo.push({
                    dirname: dep.getKsPkg().config.name,
                    info: entry
                });
            }
        }
    }

    const result: pxtc.ApisInfo = {
        byQName: {},
        jres: {}
    };

    for (const used of usedPackageInfo) {
        if (!used) continue;
        const { info, dirname } = used;

        // reinclude the pkg the api originates from, which is trimmed during compression
        for (const api of Object.keys(info.apis.byQName)) {
            info.apis.byQName[api].pkg = dirname;
        }

        pxt.Util.jsonCopyFrom(result.byQName, info.apis.byQName);
        if (info.apis.jres)
            pxt.Util.jsonCopyFrom(result.jres, info.apis.jres);
    }

    const jres = pkg.mainPkg.getJRes();

    for (const qName of Object.keys(result.byQName)) {
        let si = result.byQName[qName]

        let jrname = si.attributes.jres
        if (jrname) {
            if (jrname == "true") jrname = qName
            let jr = U.lookup(jres || {}, jrname)
            if (jr && jr.icon && !si.attributes.iconURL) {
                si.attributes.iconURL = jr.icon
            }
            if (jr && jr.data && !si.attributes.jresURL) {
                si.attributes.jresURL = "data:" + jr.mimeType + ";base64," + jr.data
            }
        }
    }

    return result;
}

async function cacheApiInfoAsync(project: pkg.EditorPackage, info: pxtc.ApisInfo) {
    const corePkgs = pxt.Package.corePackages().map(pkg => pkg.name);
    const externalPackages = project.pkgAndDeps().filter(p => p.id !== "built" && !p.isTopLevel() && corePkgs.indexOf(p.getKsPkg().config.name) === -1);

    if (externalPackages.length) {
        const apiList = Object.keys(info.byQName);
        const db = await ApiInfoIndexedDb.createAsync();

        for (const dep of externalPackages) {
            const name = dep.getKsPkg().config.name;
            const entry: pxt.PackageApiInfo = {
                sha: null,
                apis: { byQName: {} }
            }


            for (const api of apiList) {
                if (info.byQName[api].pkg === name) {
                    entry.apis.byQName[api] = info.byQName[api];
                }
            }

            await db.setAsync(dep, entry);
            pxt.debug(`Stored API info for ${dep}`);
        }
    }
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
                cleanupOperation = workspace.forceSaveAsync(backup)
            }

            return cleanupOperation
                .finally(() => {
                    if (token) token.resolveCancel();
                });
        });
}


export function newProjectAsync() {
    clearCaches();
    return workerOpAsync("reset", {});
}

export function clearCaches() {
    firstTypecheck = null;
    cachedApis = null;
    cachedBlocks = null;
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
    const bannedCategories = pkg.mainPkg.resolveBannedCategories();
    if (bannedCategories)
        return { bannedCategories };
    return undefined;
}

function getPackageHash(pack: pkg.EditorPackage) {
    const input = JSON.stringify(pack.getAllFiles()) + pxt.appTarget.versions.pxt + "_" + pxt.appTarget.versions.target;
    return pxtc.U.sha256(input);
}

function getPackageKey(pack: pkg.EditorPackage) {
    return pack.getKsPkg().config.name;
}

interface ApiInfoIndexedDbEntry {
    id: string;
    hash: string;
    apis: pxt.PackageApiInfo;
}

class ApiInfoIndexedDb {
    static TABLE = "files";
    static KEYPATH = "id";

    static dbName() {
        return `__pxt_apis_${pxt.appTarget.id || ""}`;
    }

    static createAsync(): Promise<ApiInfoIndexedDb> {
        function openAsync() {
            const idbWrapper = new pxt.BrowserUtils.IDBWrapper(ApiInfoIndexedDb.dbName(), 2, (ev, r) => {
                const db = r.result as IDBDatabase;
                db.createObjectStore(ApiInfoIndexedDb.TABLE, { keyPath: ApiInfoIndexedDb.KEYPATH });
            }, () => {
                // quota exceeeded, clear db
                pxt.BrowserUtils.IDBWrapper.deleteDatabaseAsync(ApiInfoIndexedDb.dbName())
            });
            return idbWrapper.openAsync()
                .then(() => new ApiInfoIndexedDb(idbWrapper));
        }
        return openAsync()
            .catch(e => {
                console.log(`db: failed to open api database, try delete entire store...`)
                return pxt.BrowserUtils.IDBWrapper.deleteDatabaseAsync(ApiInfoIndexedDb.dbName())
                    .then(() => openAsync());
            })
    }

    private constructor(protected readonly db: pxt.BrowserUtils.IDBWrapper) {
    }

    getAsync(pack: pkg.EditorPackage): Promise<pxt.PackageApiInfo> {
        const key = getPackageKey(pack);
        const hash = getPackageHash(pack);

        return this.db.getAsync(ApiInfoIndexedDb.TABLE, key)
            .then((value: ApiInfoIndexedDbEntry) => {
                /* tslint:disable:possible-timing-attack (this is not a security-sensitive codepath) */
                if (value && value.hash === hash) {
                    return value.apis
                }
                /* tslint:enable:possible-timing-attack */
                return undefined;
            });
    }

    setAsync(pack: pkg.EditorPackage, apis: pxt.PackageApiInfo): Promise<void> {
        pxt.perf.measureStart("compiler db setAsync")
        const key = getPackageKey(pack);
        const hash = getPackageHash(pack);

        const entry: ApiInfoIndexedDbEntry = {
            id: key,
            hash,
            apis
        };

        return this.db.setAsync(ApiInfoIndexedDb.TABLE, entry)
            .then(() => {
                pxt.perf.measureEnd("compiler db setAsync")
            })
    }
}