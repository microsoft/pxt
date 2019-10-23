
namespace pxt {
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
                console.log("file missing: " + module.id + " / " + filename)
                return null;
            }
        }

        writeFile(module: pxt.Package, filename: string, contents: string) {
            if (module.id == "this" && filename == pxt.CONFIG_NAME)
                this.packageFiles[pxt.CONFIG_NAME] = contents
            else
                console.log("write file? " + module.id + " / " + filename)
        }

        getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
            //console.log(`getHexInfoAsync(${extInfo})`);
            return Promise.resolve<any>({ hex: ["SKIP"] })
        }

        cacheStoreAsync(id: string, val: string): Promise<void> {
            //console.log(`cacheStoreAsync(${id}, ${val})`)
            return Promise.resolve()
        }

        cacheGetAsync(id: string): Promise<string> {
            //console.log(`cacheGetAsync(${id})`)
            return Promise.resolve("")
        }

        downloadPackageAsync(pkg: pxt.Package): Promise<void> {
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

    declare var global: any;
    declare var Buffer: any;
    declare var pxtTargetBundle: TargetBundle;

    export function setupSimpleCompile() {
        if (typeof global != "undefined" && !global.btoa) {
            global.btoa = function (str: string) { return Buffer.from(str, "binary").toString("base64"); }
            global.atob = function (str: string) { return Buffer.from(str, "base64").toString("binary"); }
        }
        if (typeof pxtTargetBundle != "undefined") {
            pxt.debug("setup app bundle")
            pxt.setAppTarget(pxtTargetBundle)
        }
        pxt.debug("simple setup done")
    }
}