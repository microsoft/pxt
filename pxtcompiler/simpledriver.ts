
namespace pxt {
    export interface SimpleDriverCallbacks {
        cacheGet: (key: string) => Promise<string>
        cacheSet: (key: string, val: string) => Promise<void>
        httpRequestAsync?: (options: Util.HttpRequestOptions) => Promise<Util.HttpResponse>
        pkgOverrideAsync?: (id: string) => Promise<Map<string>>
    }

    let callbacks: SimpleDriverCallbacks
    let ghSetup = false

    class CachedGithubDb implements pxt.github.IGithubDb {
        constructor(public readonly db: pxt.github.IGithubDb) { }

        private loadAsync<T>(repopath: string, tag: string, suffix: string,
            loader: (r: string, t: string) => Promise<T>): Promise<T> {
            // only cache releases
            if (!/^v\d+\.\d+\.\d+$/.test(tag))
                return loader(repopath, tag);

            const key = `gh-${suffix}-${repopath}#${tag}`
            return callbacks.cacheGet(key)
                .then(json => {
                    if (json) {
                        const p = pxt.Util.jsonTryParse(json) as T;
                        if (p) {
                            pxt.debug(`cache hit ${key}`)
                            return Promise.resolve(p);
                        }
                    }

                    // download and cache
                    return loader(repopath, tag)
                        .then(p => {
                            if (p) {
                                pxt.debug(`cached ${key}`)
                                return callbacks.cacheSet(key, JSON.stringify(p))
                                    .then(() => p)
                            }
                            return p;
                        })

                })
        }

        latestVersionAsync(repopath: string, config: pxt.PackagesConfig): Promise<string> {
            return this.db.latestVersionAsync(repopath, config)
        }

        loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig> {
            return this.loadAsync(repopath, tag, "pxt", (r, t) => this.db.loadConfigAsync(r, t));
        }

        loadPackageAsync(repopath: string, tag: string): Promise<pxt.github.CachedPackage> {
            return this.loadAsync(repopath, tag, "pkg", (r, t) => this.db.loadPackageAsync(r, t));
        }
    }

    function pkgOverrideAsync(pkg: pxt.Package) {
        const f = callbacks?.pkgOverrideAsync
        const v = f ? f(pkg.id) : Promise.resolve(undefined as Map<string>)
        return v.then(r => r ? r : pkg.commonDownloadAsync())
    }

    export class SimpleHost implements pxt.Host {
        constructor(public packageFiles: pxt.Map<string>) { }

        resolve(module: pxt.Package, filename: string): string {
            return ""
        }

        readFile(module: pxt.Package, filename: string): string {
            const fid = module.id == "this" ? filename :
                "pxt_modules/" + module.id + "/" + filename
            if (this.packageFiles[fid] !== undefined) {
                return this.packageFiles[fid]
            } else if (pxt.appTarget.bundledpkgs[module.id]) {
                return pxt.appTarget.bundledpkgs[module.id][filename];
            } else {
                return null;
            }
        }

        writeFile(module: pxt.Package, filename: string, contents: string) {
            const pref = module.id == "this" ? "" : "pxt_modules/" + module.id + "/"
            pxt.debug(`write file ${pref + filename}`)
            this.packageFiles[pref + filename] = contents
        }

        getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
            //console.log(`getHexInfoAsync(${extInfo})`);
            return Promise.resolve<any>({ hex: ["SKIP"] })
        }

        cacheStoreAsync(id: string, val: string): Promise<void> {
            //console.log(`cacheStoreAsync(${id}, ${val})`)
            if (callbacks?.cacheSet)
                return callbacks.cacheSet(id, val)
            return Promise.resolve()
        }

        cacheGetAsync(id: string): Promise<string> {
            //console.log(`cacheGetAsync(${id})`)
            if (callbacks?.cacheGet)
                return callbacks.cacheGet(id)
            return Promise.resolve("")
        }

        downloadPackageAsync(pkg: pxt.Package): Promise<void> {
            if (ghSetup)
                return pkgOverrideAsync(pkg)
                    .then(resp => {
                        if (resp) {
                            U.iterMap(resp, (fn: string, cont: string) => {
                                this.writeFile(pkg, fn, cont)
                            })
                        }
                    })
            //console.log(`downloadPackageAsync(${pkg.id})`)
            return Promise.resolve()
        }

        resolveVersionAsync(pkg: pxt.Package): Promise<string> {
            //console.log(`resolveVersionAsync(${pkg.id})`)
            return Promise.resolve("*")
        }
    }

    export function prepPythonOptions(opts: pxtc.CompileOptions) {
        // this is suboptimal, but we need apisInfo for the python converter
        if (opts.target.preferredEditor == pxt.PYTHON_PROJECT_NAME) {
            const opts2 = U.clone(opts)
            opts2.ast = true
            opts2.target.preferredEditor = pxt.JAVASCRIPT_PROJECT_NAME
            //opts2.noEmit = true
            // remove previously converted .ts files, so they don't end up in apisinfo
            for (let f of opts2.sourceFiles) {
                if (U.endsWith(f, ".py"))
                    opts2.fileSystem[f.slice(0, -3) + ".ts"] = " "
            }
            const res = pxtc.compile(opts2)
            opts.apisInfo = pxtc.getApiInfo(res.ast, opts2.jres)
        }
    }

    export interface CompileResultWithErrors extends pxtc.CompileResult {
        errors?: string;
    }

    export interface SimpleCompileOptions {
        native?: boolean;
    }

    export function simpleInstallPackagesAsync(files: pxt.Map<string>) {
        const host = new SimpleHost(files)
        const mainPkg = new MainPackage(host)
        return mainPkg.loadAsync(true)
    }

    export function simpleGetCompileOptionsAsync(
        files: pxt.Map<string>,
        simpleOptions: SimpleCompileOptions
    ) {
        const host = new SimpleHost(files)
        const mainPkg = new MainPackage(host)
        return mainPkg.loadAsync()
            .then(() => {
                let target = mainPkg.getTargetOptions()
                if (target.hasHex)
                    target.isNative = simpleOptions.native
                return mainPkg.getCompileOptionsAsync(target)
            }).then(opts => {
                patchTS(mainPkg.targetVersion(), opts)
                if (mainPkg.getPreferredEditor() === pxt.PYTHON_PROJECT_NAME) {
                    patchPY(mainPkg.targetVersion(), opts)
                }
                prepPythonOptions(opts)
                return opts
            })
    }

    export function simpleCompileAsync(
        files: pxt.Map<string>,
        optionsOrNative?: SimpleCompileOptions | boolean
    ) {
        const options: SimpleCompileOptions =
            typeof optionsOrNative == "boolean" ? { native: optionsOrNative }
                : optionsOrNative || {}
        return simpleGetCompileOptionsAsync(files, options)
            .then(opts => pxtc.compile(opts))
            .then((r: CompileResultWithErrors) => {
                if (!r.success)
                    r.errors = r.diagnostics.map(ts.pxtc.getDiagnosticString).join("") || "Unknown error."
                return r
            })
    }

    export function patchTS(version: string, opts: pxtc.CompileOptions) {
        if (!version)
            return
        pxt.debug(`applying TS patches relative to ${version}`)
        for (let fn of Object.keys(opts.fileSystem)) {
            if (fn.indexOf("/") == -1 && U.endsWith(fn, ".ts")) {
                const ts = opts.fileSystem[fn]
                const ts2 = pxt.patching.patchJavaScript(version, ts)
                if (ts != ts2) {
                    pxt.debug(`applying TS patch to ${fn}`)
                    opts.fileSystem[fn] = ts2
                }
            }
        }
    }

    export function patchPY(version: string, opts: pxtc.CompileOptions) {
        if (!version)
            return
        pxt.debug(`applying PY patches relative to ${version}`)
        for (let fn of Object.keys(opts.fileSystem)) {
            if (fn.indexOf("/") == -1 && U.endsWith(fn, ".py")) {
                const initial = opts.fileSystem[fn]
                const patched = pxt.patching.patchPython(version, initial)
                if (initial != patched) {
                    pxt.debug(`applying PY patch to ${fn}`)
                    opts.fileSystem[fn] = patched
                }
            }
        }
    }

    // eslint-disable-next-line no-var
    declare var global: any;
    // eslint-disable-next-line no-var
    declare var Buffer: any;
    // eslint-disable-next-line no-var
    declare var pxtTargetBundle: TargetBundle;

    export function setupSimpleCompile(cfg?: SimpleDriverCallbacks) {
        if (typeof global != "undefined" && !global.btoa) {
            global.btoa = function (str: string) { return Buffer.from(str, "binary").toString("base64"); }
            global.atob = function (str: string) { return Buffer.from(str, "base64").toString("binary"); }
        }
        if (typeof pxtTargetBundle != "undefined") {
            pxt.debug("setup app bundle")
            pxt.setAppTarget(pxtTargetBundle)
        }

        if (cfg) {
            callbacks = cfg
            ghSetup = true
            if (cfg.httpRequestAsync)
                Util.httpRequestCoreAsync = cfg.httpRequestAsync
            pxt.github.forceProxy = true
            pxt.github.db = new CachedGithubDb(new pxt.github.MemoryGithubDb())
        }

        pxt.debug("simple setup done")
    }
}