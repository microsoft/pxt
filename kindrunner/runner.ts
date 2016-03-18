/// <reference path="../built/kindlib.d.ts" />
/// <reference path="../built/kindblocks.d.ts" />
/// <reference path="../built/kindsim.d.ts" />

namespace ks.runner {
    export interface RunnerOptions {
        appCdnRoot: string;
        simCdnRoot: string;
    }

    export var appTarget: ks.AppTarget;

    function getEmbeddedScript(id: string): Util.StringMap<string> {
        return Util.lookup(appTarget.bundledpkgs, id)
    }

    class EditorPackage {
        files: Util.StringMap<string> = {};
        id: string;

        constructor(private ksPkg: ks.Package, public topPkg: EditorPackage) {
        }

        getKsPkg() {
            return this.ksPkg;
        }

        getPkgId() {
            return this.ksPkg ? this.ksPkg.id : this.id;
        }

        isTopLevel() {
            return this.ksPkg && this.ksPkg.level == 0;
        }

        setFiles(files: Util.StringMap<string>) {
            this.files = files;
        }

        getAllFiles() {
            return Util.mapStringMap(this.files, (k, f) => f)
        }
    }

    class Host
        implements ks.Host {

        readFile(module: ks.Package, filename: string): string {
            let epkg = getEditorPkg(module)
            return U.lookup(epkg.files, filename)
        }

        writeFile(module: ks.Package, filename: string, contents: string): void {
            if (filename == ks.configName)
                return; // ignore config writes
            throw Util.oops("trying to write " + module + " / " + filename)
        }

        getHexInfoAsync() {
            return Promise.resolve((window as any).ksHexInfo)
        }

        downloadPackageAsync(pkg: ks.Package) {
            let proto = pkg.verProtocol()
            let epkg = getEditorPkg(pkg)

            if (proto == "pub") {
                return Cloud.downloadScriptFilesAsync(pkg.verArgument())
                    .then(files => epkg.setFiles(files))
            } else if (proto == "embed") {
                epkg.setFiles(getEmbeddedScript(pkg.verArgument()))
                return Promise.resolve()
            } else if (proto == "empty") {
                epkg.setFiles(emptyPrjFiles())
                return Promise.resolve()
            } else {
                return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
            }
        }

        resolveVersionAsync(pkg: ks.Package) {
            if (getEmbeddedScript(pkg.id))
                return Promise.resolve("embed:" + pkg.id)
            return Cloud.privateGetAsync(ks.pkgPrefix + pkg.id)
                .then(r => {
                    let id = (r || {})["scriptid"]
                    if (!id)
                        Util.userError(lf("cannot resolve package {0}", pkg.id))
                    return id
                })
        }
    }

    export var mainPkg: ks.MainPackage;

    function getEditorPkg(p: ks.Package) {
        let r: EditorPackage = (p as any)._editorPkg
        if (r) return r
        let top: EditorPackage = null
        if (p != mainPkg)
            top = getEditorPkg(mainPkg)
        let newOne = new EditorPackage(p, top)
        if (p == mainPkg)
            newOne.topPkg = newOne;
        (p as any)._editorPkg = newOne
        return newOne
    }

    function emptyPrjFiles() {
        let p = appTarget.tsprj
        let files = U.clone(p.files)
        files[ks.configName] = JSON.stringify(p.config, null, 4) + "\n"
        return files
    }

    function initInnerAsync() {
        let lang = /lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
        return Util.updateLocalizationAsync(options.appCdnRoot, lang ? lang[1] : (navigator.userLanguage || navigator.language))
            .then(() => Util.httpGetJsonAsync(options.simCdnRoot + "target.json"))
            .then((trgbundle: ks.TargetBundle) => {
                let cfg: ks.PackageConfig = JSON.parse(trgbundle.bundledpkgs[trgbundle.corepkg][ks.configName])
                appTarget = cfg.target
                appTarget.bundledpkgs = trgbundle.bundledpkgs

                if (!appTarget.cloud) Cloud.apiRoot = undefined;
            })
            .then(() => {
                mainPkg = new ks.MainPackage(new Host());
            })
            .then(() => {
            })
    }

    export function showError(msg: string) {
        console.error(msg)
    }

    function loadPackageAsync(id: string) {
        let host = mainPkg.host();
        mainPkg = new ks.MainPackage(host)
        mainPkg._verspec = id ? "pub:" + id : "empty:tsprj"

        return host.downloadPackageAsync(mainPkg)
            .then(() => host.readFile(mainPkg, ks.configName))
            .then(str => {
                if (!str) return Promise.resolve()
                return mainPkg.installAllAsync()
                    .catch(e => {
                        showError(lf("Cannot load package: {0}", e.message))
                    })
            })
    }

    function getCompileOptionsAsync() {
        let trg = mainPkg.getTargetOptions()
        trg.isNative = false
        trg.hasHex = false
        return mainPkg.getCompileOptionsAsync(trg)
    }

    function compileAsync() {
        return getCompileOptionsAsync()
            .then(opts => {
                let resp = ts.ks.compile(opts)
                if (resp.diagnostics && resp.diagnostics.length > 0) {
                    resp.diagnostics.forEach(diag => {
                        console.error(diag.messageText)                        
                    })
                }
                return resp
            })
    }

    export function simulateAsync(id: string, container: HTMLElement) {
        return loadPackageAsync(id)
            .then(compileAsync)
            .then(resp => {
                if (resp.diagnostics && resp.diagnostics.length > 0) {
                    console.error("Diagnostics", resp.diagnostics)
                }
                let js = resp.outfiles["microbit.js"];
                if (js) {
                    let driver = new ks.rt.SimulatorDriver(container);
                    driver.run(js, resp.enums);                    
                }
            })
    }
    
    export function toBlocksAsync(code: string) : Promise<JQuery> {        
        return loadPackageAsync(null)
            .then(getCompileOptionsAsync)
            .then(opts => {
                opts.fileSystem["main.ts"] = code
                opts.ast = true
                let resp = ts.ks.compile(opts)
                if (resp.diagnostics && resp.diagnostics.length > 0) {
                    console.error("Diagnostics", resp.diagnostics)
                }                
                let apis = ts.ks.getApiInfo(resp.ast);
                let blocksInfo = ts.ks.getBlocksInfo(apis);
                ks.blocks.initBlocks(blocksInfo);
                console.log(resp)
                let blcks = ks.blocks.toBlocks(blocksInfo, resp.ast.getSourceFile("main.ts").statements)
                console.log(blcks)
                return ks.blocks.render(blcks, true);
            })
    }

    export var initCallbacks: (() => void)[] = [];
    export var options: RunnerOptions;
    export function init(opts: RunnerOptions) {
        options = opts;
        initInnerAsync()
            .done(() => {
                for (let i = 0; i < initCallbacks.length; ++i) {
                    initCallbacks[i]();
                }
            })
    }


    function windowLoad() {
        let f = (window as any).ksRunnerWhenLoaded
        if (f) f();
    }

    windowLoad();
}