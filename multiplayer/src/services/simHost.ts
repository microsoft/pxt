import { gameOver } from "./gameClient";
import { dispatch } from "../state";
import { setNetMode } from "../state/actions";

let _mainPkg: pxt.MainPackage;
let mainPkg = (reset?: boolean) => {
    if (!_mainPkg || reset) {
        _mainPkg = new pxt.MainPackage(_mainPkg?.host() || new PkgHost());
    }
    return _mainPkg;
};

let tilemapProject: pxt.TilemapProject;
if (!pxt.react.getTilemapProject) {
    pxt.react.getTilemapProject = () => {
        if (!tilemapProject) {
            tilemapProject = new pxt.TilemapProject();
            tilemapProject.loadPackage(mainPkg());
        }

        return tilemapProject;
    };
}

async function loadPackageAsync(runOpts: RunOptions) {
    const verspec =
        runOpts.mpRole === "server" ? `pub:${runOpts.id}` : "empty:clientprj";
    const previousMainPackage = mainPkg();
    if (
        previousMainPackage?._verspec !== verspec ||
        verspec.startsWith("pub:S")
    ) {
        const mp = mainPkg(true /** force refresh */);
        // we want this to be cached only within the scope of a single call to loadpackageasync,
        // as the file can be requested multiple times while loading.
        mp.host().cacheStoreAsync(verspec, undefined!);
        mp._verspec = verspec;
        await mp.host().downloadPackageAsync(mainPkg(), []);
        await mainPkg().installAllAsync();
    }

    try {
        if (runOpts.mpRole === "client") {
            let epkg = getEditorPkg(mainPkg());
            epkg.files[pxt.MAIN_TS] = "multiplayer.init()";
        }
    } catch (e: any) {
        console.error(lf("Cannot load extension: {0}", e));
    }
}

function getApiInfo(program: ts.Program, opts: pxtc.CompileOptions) {
    const apiCache: pxt.Map<pxtc.ApisInfo> = {};

    const key = Object.keys(opts.fileSystem).sort().join(";");

    if (!apiCache[key]) apiCache[key] = pxtc.getApiInfo(program, opts.jres);

    return apiCache[key];
}

function getEditorPkg(p: pxt.Package) {
    let r: EditorPackage = (p as any)._editorPkg;
    if (r) return r;
    let top: EditorPackage | undefined = undefined;
    if (p != mainPkg()) top = getEditorPkg(mainPkg());
    let newOne: EditorPackage = new EditorPackage(p, top!);
    if (p == mainPkg()) newOne.topPkg = newOne;
    (p as any)._editorPkg = newOne;
    return newOne;
}

class EditorPackage {
    files: pxt.Map<string> = {};
    id: string | undefined;

    constructor(private ksPkg: pxt.Package, public topPkg: EditorPackage) {}

    getKsPkg() {
        return this.ksPkg;
    }

    getPkgId() {
        return this.ksPkg ? this.ksPkg.id : this.id;
    }

    isTopLevel() {
        return this.ksPkg && this.ksPkg.level == 0;
    }

    setFiles(files: pxt.Map<string>) {
        this.files = files;
    }

    getAllFiles() {
        return pxt.Util.mapMap(this.files, (k, f) => f);
    }
}

function emptyPrjFiles() {
    let p = pxt.appTarget.tsprj;
    let files = pxt.U.clone(p.files);
    files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(p.config);
    files[pxt.MAIN_BLOCKS] = "";
    return files;
}

class PkgHost implements pxt.Host {
    readFile(module: pxt.Package, filename: string): string {
        let epkg = getEditorPkg(module);
        return pxt.U.lookup(epkg.files, filename);
    }

    writeFile(module: pxt.Package, filename: string, contents: string): void {
        const epkg = getEditorPkg(module);
        epkg.files[filename] = contents;
    }

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        return pxt.hexloader.getHexInfoAsync(this, extInfo);
    }

    async cacheStoreAsync(id: string, val: string): Promise<void> {
        try {
            this.githubPackageCache[id] = val ? JSON.parse(val) : undefined;
        } catch (e) {}
    }

    async cacheGetAsync(id: string): Promise<string> {
        return null as any as string;
    }

    patchDependencies(
        cfg: pxt.PackageConfig,
        name: string,
        repoId: string
    ): boolean {
        if (!repoId) return false;
        // check that the same package hasn't been added yet
        const repo = pxt.github.parseRepoId(repoId);
        if (!repo) return false;

        for (const k of Object.keys(cfg.dependencies)) {
            const v = cfg.dependencies[k];
            const kv = pxt.github.parseRepoId(v);
            if (kv && repo.fullName == kv.fullName) {
                if (pxt.semver.strcmp(repo.tag!, kv.tag!) < 0) {
                    // we have a later tag, use this one
                    cfg.dependencies[k] = repoId;
                }
                return true;
            }
        }

        return false;
    }

    // untouched from runner.ts
    private githubPackageCache: pxt.Map<pxt.Map<string>> = {};
    downloadPackageAsync(pkg: pxt.Package, dependencies?: string[]) {
        let proto = pkg.verProtocol();
        let cached: pxt.Map<string> | undefined = undefined;
        // cache resolve github packages
        if (proto == "github" || proto == "pub")
            cached = this.githubPackageCache[pkg._verspec];
        let epkg = getEditorPkg(pkg);

        return (
            cached ? Promise.resolve(cached) : pkg.commonDownloadAsync()
        ).then(resp => {
            if (resp) {
                if ((proto == "github" || proto == "pub") && !cached)
                    this.githubPackageCache[pkg._verspec] =
                        pxt.Util.clone(resp);
                epkg.setFiles(resp);
                return Promise.resolve();
            }
            if (proto == "empty") {
                if (Object.keys(epkg.files).length == 0) {
                    epkg.setFiles(emptyPrjFiles());
                }
                if (dependencies && dependencies.length) {
                    const files = getEditorPkg(pkg).files;
                    const cfg = JSON.parse(
                        files[pxt.CONFIG_NAME]
                    ) as pxt.PackageConfig;
                    dependencies.forEach((d: string) => {
                        this.addPackageToConfig(cfg, d);
                    });
                    files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(cfg);
                }
                return Promise.resolve();
            } else if (proto == "docs") {
                let files = emptyPrjFiles();
                let cfg = JSON.parse(
                    files[pxt.CONFIG_NAME]
                ) as pxt.PackageConfig;
                // load all dependencies
                pkg.verArgument()
                    .split(",")
                    .forEach(d => {
                        if (!this.addPackageToConfig(cfg, d)) {
                            return;
                        }
                    });

                if (!cfg.yotta) cfg.yotta = {};
                cfg.yotta.ignoreConflicts = true;
                files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(cfg);
                epkg.setFiles(files);
                return Promise.resolve();
            } else if (proto == "invalid") {
                pxt.log(`skipping invalid pkg ${pkg.id}`);
                return Promise.resolve();
            } else {
                return Promise.reject(
                    `Cannot download ${pkg.version()}; unknown protocol`
                );
            }
        });
    }

    addPackageToConfig(cfg: pxt.PackageConfig, dep: string) {
        let m = /^([a-zA-Z0-9_-]+)(=(.+))?$/.exec(dep);
        if (m) {
            if (m[3] && this.patchDependencies(cfg, m[1], m[3])) return false;
            cfg.dependencies[m[1]] = m[3] || "*";
        } else console.warn(`unknown package syntax ${dep}`);
        return true;
    }
}

function getCompileOptionsAsync() {
    let trg = mainPkg().getTargetOptions();
    return mainPkg().getCompileOptionsAsync(trg);
}

function getStoredState(runOpts: RunOptions) {
    let storedState: pxt.Map<string> = {};
    if (runOpts.mpRole != "server") return storedState;
    const id = runOpts.id;
    try {
        let projectStorage = window.localStorage.getItem(id);
        if (projectStorage) {
            storedState = JSON.parse(projectStorage);
        }
    } catch (e) {}
    return storedState;
}

function setStoredState(runOpts: RunOptions, key: string, value: any) {
    if (runOpts.mpRole != "server") return;
    const id = runOpts.id;
    let storedState: pxt.Map<string> = getStoredState(runOpts);

    if (value != null) storedState[key] = value;
    else delete storedState[key];

    try {
        window.localStorage.setItem(id, JSON.stringify(storedState));
    } catch (e) {}
}
function workerOpAsync<T extends keyof pxtc.service.ServiceOps>(
    op: T,
    arg: pxtc.service.OpArg
): Promise<any> {
    const startTm = Date.now();
    pxt.debug("worker op: " + op);
    return pxt.worker
        .getWorker(pxt.webConfig.workerjs)
        .opAsync(op, arg)
        .then(res => {
            if (pxt.appTarget.compile.switches.time) {
                pxt.log(`Worker perf: ${op} ${Date.now() - startTm}ms`);
                if (res.times) pxt.debug(res.times);
            }
            pxt.debug("worker op done: " + op);
            return res;
        });
}
export async function compileAsync(
    updateOptions?: (ops: pxtc.CompileOptions) => void
) {
    const opts = await getCompileOptionsAsync();
    if (updateOptions) updateOptions(opts);
    const resp = (await workerOpAsync("compile", {
        options: opts,
    })) as pxtc.CompileResult;

    if (resp.diagnostics && resp.diagnostics.length > 0) {
        resp.diagnostics.forEach(diag => {
            console.error(diag.messageText);
        });
    }
    return resp;
}

let _simDriver: pxsim.SimulatorDriver;
export function simDriver(container?: HTMLElement) {
    if (!_simDriver) _simDriver = new pxsim.SimulatorDriver(container!);

    if (container) _simDriver.container = container;
    if (!_simDriver.container) return undefined;
    return _simDriver;
}

interface RunOptionsBase {
    mpRole: "server" | "client";
    simQueryParams: string;
    mute?: boolean;
    builtJsInfo?: pxtc.BuiltSimJsInfo; // TODO probably move this out
}
interface ServerRunOptions extends RunOptionsBase {
    mpRole: "server";
    id: string;
}
interface ClientRunOptions extends RunOptionsBase {
    mpRole: "client";
}

export type RunOptions = ClientRunOptions | ServerRunOptions;

function initDriverAndOptions(
    container: HTMLElement,
    runOpts: RunOptions,
    compileInfo?: pxtc.BuiltSimJsInfo
): pxsim.SimulatorRunOptions {
    const driver = simDriver(container)!;

    const { fnArgs, parts, usedBuiltinParts } = compileInfo || {};
    let board = pxt.appTarget.simulator?.boardDefinition!;
    let runOptions: pxsim.SimulatorRunOptions = {
        debug: true,
        mute: runOpts.mute,
        boardDefinition: board,
        parts: parts,
        builtinParts: usedBuiltinParts,
        fnArgs: fnArgs,
        cdnUrl: pxt.webConfig.commitCdnUrl,
        localizedStrings: pxt.Util.getLocalizedStrings(),
        storedState: getStoredState(runOpts),
        single: true,
        autofocus: true,
        queryParameters: runOpts.simQueryParams,
        mpRole: runOpts.mpRole,
    };
    driver.setRunOptions(runOptions);
    return runOptions;
}

export async function preloadSim(container: HTMLElement, runOpts: RunOptions) {
    initDriverAndOptions(container, runOpts);
    simDriver()?.preload(1, true /** no auto run **/);
}

export async function simulateAsync(
    container: HTMLElement,
    runOpts: RunOptions
): Promise<pxtc.BuiltSimJsInfo | undefined> {
    const builtSimJS = runOpts.builtJsInfo || (await buildSimJsInfo(runOpts));
    const { js } = builtSimJS;

    if (!js) {
        console.error("Program failed to compile");
        return undefined;
    }

    const runOptions = initDriverAndOptions(container, runOpts, builtSimJS);
    const driver = simDriver(container)!;
    driver.options.messageSimulators =
        pxt.appTarget?.simulator?.messageSimulators;
    driver.options.onSimulatorCommand = msg => {
        if (msg.command === "restart") {
            runOptions.storedState = getStoredState(runOpts);
            driver.run(js, runOptions);
        }
        if (msg.command == "setstate") {
            if (msg.stateKey) {
                setStoredState(runOpts, msg.stateKey, msg.stateValue);
            }
        }
    };
    if (builtSimJS.breakpoints) {
        driver.setBreakpoints(builtSimJS.breakpoints);
    }
    driver.run(js, runOptions);
    return builtSimJS;
}

export async function buildSimJsInfo(
    runOpts: RunOptions
): Promise<pxtc.BuiltSimJsInfo> {
    await loadPackageAsync(runOpts);

    let didUpgrade = false;
    const currentTargetVersion = pxt.appTarget.versions.target;
    let compileResult = await compileAsync(opts => {
        opts.computeUsedParts = true;
        opts.breakpoints = true;

        if (runOpts.mpRole == "client")
            opts.fileSystem[pxt.MAIN_TS] = "multiplayer.init()";

        // Api info needed for py2ts conversion, if project is shared in Python
        if (opts.target.preferredEditor === pxt.PYTHON_PROJECT_NAME) {
            opts.target.preferredEditor = pxt.JAVASCRIPT_PROJECT_NAME;
            opts.ast = true;
            const resp = pxtc.compile(opts);
            const apis = getApiInfo(resp.ast!, opts);
            opts.apisInfo = apis;
            opts.target.preferredEditor = pxt.PYTHON_PROJECT_NAME;
        }

        // Apply upgrade rules if necessary
        const sharedTargetVersion = mainPkg().config.targetVersions?.target;

        if (
            sharedTargetVersion &&
            currentTargetVersion &&
            pxt.semver.cmp(
                pxt.semver.parse(sharedTargetVersion),
                pxt.semver.parse(currentTargetVersion)
            ) < 0
        ) {
            for (const fileName of Object.keys(opts.fileSystem)) {
                if (
                    !pxt.Util.startsWith(fileName, "pxt_modules") &&
                    pxt.Util.endsWith(fileName, ".ts")
                ) {
                    didUpgrade = true;
                    opts.fileSystem[fileName] = pxt.patching.patchJavaScript(
                        sharedTargetVersion,
                        opts.fileSystem[fileName]
                    );
                }
            }
        }
    });

    if (compileResult.diagnostics?.length > 0 && didUpgrade) {
        pxt.log(
            "Compile with upgrade rules failed, trying again with original code"
        );
        compileResult = await compileAsync(opts => {
            if (runOpts.mpRole === "client")
                opts.fileSystem[pxt.MAIN_TS] = "multiplayer.init()";
        });
    }

    if (compileResult.diagnostics?.length > 0) {
        console.error("Diagnostics", compileResult.diagnostics);

        dispatch(setNetMode("init"));
        gameOver("compile-failed");
    }

    const res = pxtc.buildSimJsInfo(compileResult);
    res.parts = compileResult.usedParts;
    return res;
}
