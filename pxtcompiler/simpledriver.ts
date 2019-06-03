
namespace pxt {
    export class SimpleHost implements pxt.Host {
        constructor(public packageFiles: pxt.Map<string>) { }

        resolve(module: pxt.Package, filename: string): string {
            return ""
        }

        readFile(module: pxt.Package, filename: string): string {
            if (module.id == "this") {
                return this.packageFiles[filename]
            } else if (pxt.appTarget.bundledpkgs[module.id]) {
                return pxt.appTarget.bundledpkgs[module.id][pxt.CONFIG_NAME];
            } else {
                console.log("file missing: " + module + " / " + filename)
                return null;
            }
        }

        writeFile(module: pxt.Package, filename: string, contents: string) {
            console.log("write file? " + module + " / " + filename)
        }

        getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
            //console.log(`getHexInfoAsync(${extInfo})`);
            return Promise.resolve<any>(null)
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
            opts2.noEmit = true
            // remove previously converted .ts files, so they don't end up in apisinfo
            for (let f of opts2.sourceFiles) {
                if (U.endsWith(f, ".py"))
                    opts2.fileSystem[f.slice(0, -3) + ".ts"] = " "
            }
            const res = pxtc.compile(opts2)
            opts.apisInfo = pxtc.getApiInfo(res.ast, opts2.jres)
        }
    }

    export function simpleCompile(files: pxt.Map<string>, isNative: boolean) {
        const host = new SimpleHost(files)
        const mainPkg = new MainPackage(host)
        let r: pxtc.CompileResult
        mainPkg.loadAsync()
            .then(() => {
                let target = mainPkg.getTargetOptions()
                if (target.hasHex)
                    target.isNative = isNative
                return mainPkg.getCompileOptionsAsync(target)
            })
            .then(opts => {
                prepPythonOptions(opts)
                r = pxtc.compile(opts)
                console.log(JSON.stringify(r, null, 1))
            })
        return r
    }
}