import * as workspace from "./workspace";
import * as data from "./data";
import * as core from "./core";
import * as db from "./db";

import Util = pxt.Util;

let hostCache = new db.Table("hostcache")

let extWeight: pxt.Map<number> = {
    "ts": 10,
    "blocks": 20,
    "json": 30,
    "md": 40,
}

export function setupAppTarget(trgbundle: pxt.TargetBundle) {
    //if (!trgbundle.appTheme) trgbundle.appTheme = {};
    pxt.setAppTarget(trgbundle)
}

export class File implements pxt.editor.IFile {
    inSyncWithEditor = true;
    inSyncWithDisk = true;
    diagnostics: pxtc.KsDiagnostic[];
    numDiagnosticsOverride: number;
    filters: pxt.editor.ProjectFilters;
    forceChangeCallback: ((from: string, to: string) => void);
    virtual: boolean;

    constructor(public epkg: EditorPackage, public name: string, public content: string) { }

    isReadonly() {
        return !this.epkg.header
    }

    getName() {
        return this.epkg.getPkgId() + "/" + this.name
    }

    getTypeScriptName() {
        if (this.epkg.isTopLevel()) return this.name
        else return "pxt_modules/" + this.epkg.getPkgId() + "/" + this.name
    }

    getExtension() {
        let m = /\.([^\.]+)$/.exec(this.name)
        if (m) return m[1]
        return ""
    }

    getVirtualFileName(forPrj: string): string {
        const ext = this.name.replace(/.*\./, "");
        const basename = ext ? this.name.slice(0, -ext.length - 1) : this.name;
        const isExtOk = /^blocks|py|ts$/.test(ext);
        if (!isExtOk) return undefined;

        switch (forPrj) {
            case pxt.BLOCKS_PROJECT_NAME:
                return basename + ".blocks";
            case pxt.JAVASCRIPT_PROJECT_NAME:
                return basename + ".ts";
            case pxt.PYTHON_PROJECT_NAME:
                return basename + ".py";
            default:
                pxt.U.oops();
                return undefined;
        }
    }

    weight() {
        if (/^main\./.test(this.name))
            return 5;
        if (extWeight.hasOwnProperty(this.getExtension()))
            return extWeight[this.getExtension()]
        return 60;
    }

    markDirty() {
        this.inSyncWithEditor = false;
        this.updateStatus();
    }

    private updateStatus() {
        data.invalidate("open-meta:" + this.getName())
    }

    setContentAsync(newContent: string, force?: boolean) {
        Util.assert(newContent !== undefined);
        this.inSyncWithEditor = true;
        if (newContent != this.content) {
            let prevContent = this.content;
            this.inSyncWithDisk = false;
            this.content = newContent;
            this.updateStatus();
            return this.epkg.saveFilesAsync()
                .then(() => {
                    if (this.content == newContent) {
                        this.inSyncWithDisk = true;
                        this.updateStatus();
                    }
                    if (force && this.forceChangeCallback) this.forceChangeCallback(prevContent, newContent);
                })
        } else {
            this.updateStatus();
            return Promise.resolve()
        }
    }

    setForceChangeCallback(callback: (from: string, to: string) => void) {
        this.forceChangeCallback = callback;
    }
}

export class EditorPackage {
    files: pxt.Map<File> = {};
    header: pxt.workspace.Header;
    onupdate = () => { };
    saveScheduled = false;
    savingNow = 0;

    id: string;
    outputPkg: EditorPackage;
    assetsPkg: EditorPackage;

    constructor(private ksPkg: pxt.Package, private topPkg: EditorPackage) {
        if (ksPkg && ksPkg.verProtocol() == "workspace")
            this.header = workspace.getHeader(ksPkg.verArgument())
    }

    getTopHeader() {
        return this.topPkg.header;
    }

    afterMainLoadAsync() {
        if (this.assetsPkg)
            return this.assetsPkg.loadAssetsAsync()
        return Promise.resolve()
    }

    saveAssetAsync(filename: string, data: Uint8Array) {
        return workspace.saveAssetAsync(this.header.id, filename, data)
            .then(() => this.assetsPkg.loadAssetsAsync())
    }

    loadAssetsAsync() {
        if (this.id != "assets")
            return Promise.resolve()

        return workspace.listAssetsAsync(this.topPkg.header.id)
            .then(res => {
                let removeMe = Util.flatClone(this.files)
                for (let asset of res) {
                    let fn = asset.name
                    let ex = Util.lookup(this.files, fn)
                    if (ex) {
                        delete removeMe[fn]
                    } else {
                        ex = new File(this, fn, `File size: ${asset.size}; URL: ${asset.url}`)
                        this.files[fn] = ex
                    }
                }
                for (let n of Object.keys(removeMe))
                    delete this.files[n]
                let assetsTs = ""
                for (let f of this.sortedFiles()) {
                    let asset = res.filter(a => a.name == f.name)[0]
                    let bn = f.name.replace(/\..*/, "").replace(/[^a-zA-Z0-9_]/g, "_")
                    assetsTs += `    export const ${bn} = "${asset.url}";\n`
                }
                let assetsFN = "assets.ts"
                let f = this.topPkg.lookupFile(assetsFN)
                if (f || assetsTs) {
                    assetsTs = `namespace assets {\n${assetsTs}}\n`
                    let cfg = this.topPkg.ksPkg.config
                    if (cfg.files.indexOf(assetsFN) < 0) {
                        cfg.files.push(assetsFN)
                        this.topPkg.ksPkg.saveConfig()
                    }
                    if (!f)
                        this.topPkg.setFile(assetsFN, assetsTs)
                    else
                        return f.setContentAsync(assetsTs)
                }
                return Promise.resolve()
            })
    }

    makeTopLevel() {
        this.topPkg = this;
        this.outputPkg = new EditorPackage(null, this)
        this.outputPkg.id = "built"

        if (pxt.appTarget.runtime && pxt.appTarget.runtime.assetExtensions) {
            this.assetsPkg = new EditorPackage(null, this)
            this.assetsPkg.id = "assets"
        }
    }

    updateConfigAsync(update: (cfg: pxt.PackageConfig) => void) {
        let cfgFile = this.files[pxt.CONFIG_NAME]
        if (cfgFile) {
            try {
                let cfg = <pxt.PackageConfig>JSON.parse(cfgFile.content)
                update(cfg);
                return cfgFile.setContentAsync(JSON.stringify(cfg, null, 4) + "\n")
                    .then(() => this.ksPkg.loadConfig())
            } catch (e) { }
        }

        return null;
    }

    updateDepAsync(pkgid: string): Promise<void> {
        let p = this.ksPkg.resolveDep(pkgid);
        if (!p || p.verProtocol() != "github") return Promise.resolve();
        let parsed = pxt.github.parseRepoId(p.verArgument())
        return pxt.targetConfigAsync()
            .then(config => pxt.github.latestVersionAsync(parsed.fullName, config.packages))
            .then(tag => { parsed.tag = tag })
            .then(() => pxt.github.pkgConfigAsync(parsed.fullName, parsed.tag))
            .catch(core.handleNetworkError)
            .then(cfg => this.addDepAsync(cfg.name, pxt.github.stringifyRepo(parsed)));
    }

    removeDepAsync(pkgid: string) {
        return this.updateConfigAsync(cfg => delete cfg.dependencies[pkgid])
            .then(() => this.saveFilesAsync(true));
    }

    addDepAsync(pkgid: string, pkgversion: string) {
        return this.updateConfigAsync(cfg => cfg.dependencies[pkgid] = pkgversion)
            .then(() => this.saveFilesAsync(true));
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

    setFile(n: string, v: string, virtual?: boolean) {
        let f = new File(this, n, v)
        if (virtual) f.virtual = true;
        this.files[n] = f
        data.invalidate("open-meta:")
        return f
    }

    removeFileAsync(n: string) {
        delete this.files[n];
        data.invalidate("open-meta:")
        return this.updateConfigAsync(cfg => cfg.files = cfg.files.filter(f => f != n))
    }

    setContentAsync(n: string, v: string): Promise<void> {
        let f = this.files[n];
        let p = Promise.resolve();
        if (!f) {
            f = this.setFile(n, v);
            p = p.then(() => this.updateConfigAsync(cfg => cfg.files.indexOf(n) < 0 ? cfg.files.push(n) : 0))
                p.then(() => this.savePkgAsync())
        }
        return p.then(() => f.setContentAsync(v));
    }

    setFiles(files: pxt.Map<string>) {
        this.files = Util.mapMap(files, (k, v) => new File(this, k, v))
        data.invalidate("open-meta:")
    }

    private updateStatus() {
        data.invalidate("pkg-status:" + this.header.id)
    }

    savePkgAsync() {
        if (this.header.blobCurrent) return Promise.resolve();
        this.savingNow++;
        this.updateStatus();
        return workspace.saveToCloudAsync(this.header)
            .then(() => {
                this.savingNow--;
                this.updateStatus();
                if (!this.header.blobCurrent)
                    this.scheduleSave();
            })
    }

    private scheduleSave() {
        if (this.saveScheduled) return
        this.saveScheduled = true;
        setTimeout(() => {
            this.saveScheduled = false;
            this.savePkgAsync().done();
        }, 5000)
    }

    getAllFiles() {
        let r = Util.mapMap(this.files, (k, f) => f.content)
        delete r[pxt.SERIAL_EDITOR_FILE]
        return r
    }

    saveFilesAsync(immediate?: boolean) {
        if (!this.header) return Promise.resolve();

        let cfgFile = this.files[pxt.CONFIG_NAME]
        if (cfgFile) {
            try {
                let cfg = <pxt.PackageConfig>JSON.parse(cfgFile.content)
                this.header.name = cfg.name
            } catch (e) {
            }
        }
        return workspace.saveAsync(this.header, this.getAllFiles())
            .then(() => immediate ? this.savePkgAsync() : this.scheduleSave())
    }

    sortedFiles() {
        let lst = Util.values(this.files)
        if (!pxt.options.debug)
            lst = lst.filter(f => f.name != pxt.github.GIT_JSON)
        lst.sort((a, b) => a.weight() - b.weight() || Util.strcmp(a.name, b.name))
        return lst
    }

    forEachFile(cb: (f: File) => void) {
        this.pkgAndDeps().forEach(p => {
            Util.values(p.files).forEach(cb)
        })
    }

    getMainFile() {
        return this.sortedFiles()[0]
    }

    pkgAndDeps(): EditorPackage[] {
        if (this.topPkg != this)
            return this.topPkg.pkgAndDeps();
        let deps = (this.ksPkg as pxt.MainPackage).deps
        let depkeys = Object.keys(deps)
        let res: EditorPackage[] = []
        for (let k of depkeys) {
            if (/---/.test(k)) continue
            if (deps[k].cppOnly) continue
            res.push(getEditorPkg(deps[k]))
        }
        if (this.assetsPkg)
            res.push(this.assetsPkg)
        res.push(this.outputPkg)
        return res
    }

    filterFiles(cond: (f: File) => boolean) {
        return Util.concat(this.pkgAndDeps().map(e => Util.values(e.files).filter(cond)))
    }

    lookupFile(name: string) {
        return this.filterFiles(f => f.getName() == name)[0]
    }
}

class Host
    implements pxt.Host {

    readFile(module: pxt.Package, filename: string): string {
        let epkg = getEditorPkg(module)
        let file = epkg.files[filename]
        return file ? file.content : null
    }

    writeFile(module: pxt.Package, filename: string, contents: string, force?: boolean): void {
        if (filename == pxt.CONFIG_NAME || force) {
            // only write config writes
            let epkg = getEditorPkg(module)
            let file = epkg.files[filename];
            file.setContentAsync(contents, force).done();
            return;
        }
        throw Util.oops("trying to write " + module + " / " + filename)
    }

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        return pxt.hex.getHexInfoAsync(this, extInfo).catch(core.handleNetworkError);
    }

    cacheStoreAsync(id: string, val: string): Promise<void> {
        return hostCache.forceSetAsync({
            id: id,
            val: val
        }).then(() => { }, e => {
            pxt.tickEvent('cache.store.failed', { error: e.name });
            pxt.log(`cache store failed for ${id}: ${e.name}`)
        })
    }

    cacheGetAsync(id: string): Promise<string> {
        return hostCache.getAsync(id)
            .then(v => v.val, e => null)
    }

    downloadPackageAsync(pkg: pxt.Package): Promise<void> {
        let proto = pkg.verProtocol()
        let epkg = getEditorPkg(pkg)

        let fromWorkspaceAsync = (arg: string) =>
            workspace.getTextAsync(arg)
                .then(scr => {
                    epkg.setFiles(scr)
                    if (epkg.isTopLevel() && epkg.header)
                        return workspace.recomputeHeaderFlagsAsync(epkg.header, scr)
                    else
                        return Promise.resolve()
                })

        if (proto == "pub") {
            // make sure it sits in cache
            return workspace.getPublishedScriptAsync(pkg.verArgument())
                .then(files => epkg.setFiles(files))
        } else if (proto == "github") {
            return workspace.getPublishedScriptAsync(pkg.version())
                .then(files => epkg.setFiles(files))
        } else if (proto == "workspace") {
            return fromWorkspaceAsync(pkg.verArgument())
        } else if (proto == "file") {
            let arg = pkg.verArgument()
            if (arg[0] == ".") arg = resolvePath(pkg.parent.verArgument() + "/" + arg)
            return fromWorkspaceAsync(arg)
        } else if (proto == "embed") {
            epkg.setFiles(pxt.getEmbeddedScript(pkg.verArgument()))
            return Promise.resolve()
        } else if (proto == "invalid") {
            pxt.log(`skipping invalid pkg ${pkg.id}`);
            return Promise.resolve();
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }
}

function resolvePath(p: string) {
    return p.replace(/\/+/g, "/").replace(/[^\/]+\/\.\.\//g, "").replace(/\/\.\//g, "/")
}

const theHost = new Host();
export let mainPkg: pxt.MainPackage = new pxt.MainPackage(theHost);

export function getEditorPkg(p: pxt.Package): EditorPackage {
    let r: EditorPackage = (p as any)._editorPkg
    if (r) return r

    let top: EditorPackage = null
    if (p != mainPkg)
        top = getEditorPkg(mainPkg)
    let newOne = new EditorPackage(p, top)
    if (p == mainPkg)
        newOne.makeTopLevel();
    (p as any)._editorPkg = newOne
    return newOne
}

export function mainEditorPkg() {
    return getEditorPkg(mainPkg)
}

export function genFileName(extension: string): string {
    /* tslint:disable:no-control-regex */
    let sanitizedName = mainEditorPkg().header.name.replace(/[()\\\/.,?*^:<>!;'#$%^&|"@+=«»°{}\[\]¾½¼³²¦¬¤¢£~­¯¸`±\x00-\x1F]/g, '');
    sanitizedName = sanitizedName.trim().replace(/\s+/g, '-');
    /* tslint:enable:no-control-regex */
    if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.fileNameExclusiveFilter) {
        const rx = new RegExp(pxt.appTarget.appTheme.fileNameExclusiveFilter, 'g');
        sanitizedName = sanitizedName.replace(rx, '');
    }
    if (!sanitizedName)
        sanitizedName = "Untitled"; // do not translate to avoid unicode issues
    const fn = `${pxt.appTarget.nickname || pxt.appTarget.id}-${sanitizedName}${extension}`;
    return fn;
}

export function allEditorPkgs() {
    return getEditorPkg(mainPkg).pkgAndDeps()
}

export function notifySyncDone(updated: pxt.Map<number>) {
    let newOnes = Util.values(mainPkg.deps).filter(d => d.verProtocol() == "workspace" && updated.hasOwnProperty(d.verArgument()))
    if (newOnes.length > 0) {
        getEditorPkg(mainPkg).onupdate()
    }

}

export function loadPkgAsync(id: string, targetVersion?: string) {
    mainPkg = new pxt.MainPackage(theHost)
    mainPkg._verspec = "workspace:" + id;

    return theHost.downloadPackageAsync(mainPkg)
        .catch(core.handleNetworkError)
        .then(() => ts.pxtc.Util.jsonTryParse(theHost.readFile(mainPkg, pxt.CONFIG_NAME)) as pxt.PackageConfig)
        .then(config => {
            if (!config) {
                mainPkg.configureAsInvalidPackage(lf("invalid pxt.json file"));
                return mainEditorPkg().afterMainLoadAsync();
            }

            return mainPkg.installAllAsync(targetVersion)
                .then(() => mainEditorPkg().afterMainLoadAsync());
        })
}


export interface FileMeta {
    isReadonly: boolean;
    isSaved: boolean;
    numErrors: number;
}

/*
    open-meta:<pkgName>/<filename> - readonly/saved/unsaved + number of errors
*/
data.mountVirtualApi("open-meta", {
    getSync: p => {
        p = data.stripProtocol(p)
        let f = getEditorPkg(mainPkg).lookupFile(p)
        if (!f) return {}

        let fs: FileMeta = {
            isReadonly: f.isReadonly(),
            isSaved: f.inSyncWithEditor && f.inSyncWithDisk,
            numErrors: f.numDiagnosticsOverride
        }

        if (fs.numErrors == null)
            fs.numErrors = f.diagnostics ? f.diagnostics.length : 0

        return fs
    },
})

export interface PackageMeta {
    numErrors: number;
}

/*
    open-pkg-meta:<pkgName> - number of errors
*/
data.mountVirtualApi("open-pkg-meta", {
    getSync: p => {
        p = data.stripProtocol(p)
        let f = allEditorPkgs().filter(pkg => pkg.getPkgId() == p)[0];
        if (!f || f.getPkgId() == "built")
            return {}

        const files = f.sortedFiles();
        let numErrors = files.reduce((n, file) => n + (file.numDiagnosticsOverride
            || (file.diagnostics ? file.diagnostics.length : 0)
            || 0), 0);
        const ks = f.getKsPkg();
        if (ks && ks.invalid())
            numErrors++;
        return <PackageMeta>{
            numErrors
        }
    }
})

// pkg-status:<guid>
data.mountVirtualApi("pkg-status", {
    getSync: p => {
        p = data.stripProtocol(p)
        let ep = allEditorPkgs().filter(pkg => pkg.header && pkg.header.id == p)[0]
        if (ep)
            return ep.savingNow ? "saving" : ""
        return ""
    },
})

