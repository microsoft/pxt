import * as workspace from "./workspace";
import * as data from "./data";
import * as core from "./core";
import * as db from "./db";

import Cloud = pxt.Cloud;
import Util = pxt.Util;
const lf = Util.lf

let hostCache = new db.Table("hostcache")

let extWeight: pxt.Map<number> = {
    "ts": 10,
    "blocks": 20,
    "json": 30,
    "md": 40,
}

export function setupAppTarget(trgbundle: pxt.TargetBundle) {
    //if (!trgbundle.appTheme) trgbundle.appTheme = {};
    pxt.appTarget = trgbundle
}

export class File {
    inSyncWithEditor = true;
    inSyncWithDisk = true;
    diagnostics: pxtc.KsDiagnostic[];
    numDiagnosticsOverride: number;
    virtualSource: File;

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

    static tsFileNameRx = /\.ts$/;
    static blocksFileNameRx = /\.blocks$/;
    getVirtualFileName(): string {
        if (File.blocksFileNameRx.test(this.name))
            return this.name.replace(File.blocksFileNameRx, '.ts');
        if (File.tsFileNameRx.test(this.name))
            return this.name.replace(File.tsFileNameRx, '.blocks');
        return undefined;
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

    setContentAsync(newContent: string) {
        Util.assert(newContent !== undefined);
        this.inSyncWithEditor = true;
        if (newContent != this.content) {
            this.inSyncWithDisk = false;
            this.content = newContent;
            this.updateStatus();
            return this.epkg.saveFilesAsync()
                .then(() => {
                    if (this.content == newContent) {
                        this.inSyncWithDisk = true;
                        this.updateStatus();
                    }
                })
        } else {
            this.updateStatus();
            return Promise.resolve()
        }
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

    constructor(private ksPkg: pxt.Package, private topPkg: EditorPackage) {
        if (ksPkg && ksPkg.verProtocol() == "workspace")
            this.header = workspace.getHeader(ksPkg.verArgument())
    }

    getTopHeader() {
        return this.topPkg.header;
    }

    makeTopLevel() {
        this.topPkg = this;
        this.outputPkg = new EditorPackage(null, this)
        this.outputPkg.id = "built"
    }

    updateConfigAsync(update: (cfg: pxt.PackageConfig) => void) {
        let cfgFile = this.files[pxt.configName]
        if (cfgFile) {
            try {
                let cfg = <pxt.PackageConfig>JSON.parse(cfgFile.content)
                update(cfg);
                return cfgFile.setContentAsync(JSON.stringify(cfg, null, 2))
            } catch (e) { }
        }

        return null;
    }

    updateDepAsync(pkgid: string): Promise<void> {
        let p = this.ksPkg.resolveDep(pkgid);
        if (!p || p.verProtocol() != "github") return Promise.resolve();
        let parsed = pxt.github.parseRepoId(p.verArgument())
        return pxt.github.latestVersionAsync(parsed.repo)
            .then(tag => { parsed.tag = tag })
            .then(() => pxt.github.pkgConfigAsync(parsed.repo, parsed.tag))
            .catch(core.handleNetworkError)
            .then(cfg => this.addDepAsync(cfg.name, pxt.github.stringifyRepo(parsed)));
    }

    removeDepAsync(pkgid: string) {
        return this.updateConfigAsync(cfg => delete cfg.dependencies[pkgid])
            .then(() => this.saveFilesAsync());
    }

    addDepAsync(pkgid: string, pkgversion: string) {
        return this.updateConfigAsync(cfg => cfg.dependencies[pkgid] = pkgversion)
            .then(() => this.saveFilesAsync());
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

    setFile(n: string, v: string) {
        let f = new File(this, n, v)
        this.files[n] = f
        data.invalidate("open-meta:")
        return f
    }

    removeFileAsync(n: string) {
        delete this.files[n];
        data.invalidate("open-meta:")
        return this.updateConfigAsync(cfg => cfg.files = cfg.files.filter(f => f != n))
    }

    setContentAsync(n: string, v: string) {
        let f = this.files[n];
        if (!f) f = this.setFile(n, v);
        return f.setContentAsync(v);
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
        return Util.mapMap(this.files, (k, f) => f.content)
    }

    saveFilesAsync() {
        if (!this.header) return Promise.resolve();

        let cfgFile = this.files[pxt.configName]
        if (cfgFile) {
            try {
                let cfg = <pxt.PackageConfig>JSON.parse(cfgFile.content)
                this.header.name = cfg.name
            } catch (e) {
            }
        }
        return workspace.saveAsync(this.header, this.getAllFiles())
            .then(() => this.scheduleSave())
    }

    sortedFiles() {
        let lst = Util.values(this.files)
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
        return Util.values((this.ksPkg as pxt.MainPackage).deps).map(getEditorPkg).concat([this.outputPkg])
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

    writeFile(module: pxt.Package, filename: string, contents: string): void {
        if (filename == pxt.configName)
            return; // ignore config writes
        throw Util.oops("trying to write " + module + " / " + filename)
    }

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<any> {
        return pxt.hex.getHexInfoAsync(this, extInfo).catch(core.handleNetworkError);
    }

    cacheStoreAsync(id: string, val: string): Promise<void> {
        return hostCache.forceSetAsync({
            id: id,
            val: val
        }).then(() => { })
    }

    cacheGetAsync(id: string): Promise<string> {
        return hostCache.getAsync(id)
            .then(v => v.val, e => null)
    }

    downloadPackageAsync(pkg: pxt.Package) {
        let proto = pkg.verProtocol()
        let epkg = getEditorPkg(pkg)

        if (proto == "pub") {
            // make sure it sits in cache
            return workspace.getPublishedScriptAsync(pkg.verArgument())
                .then(files => epkg.setFiles(files))
        } else if (proto == "github") {
            return workspace.getPublishedScriptAsync(pkg.version())
                .then(files => epkg.setFiles(files))
        } else if (proto == "workspace") {
            return workspace.getTextAsync(pkg.verArgument())
                .then(scr => epkg.setFiles(scr))
        } else if (proto == "file") {
            let arg = pkg.verArgument()
            if (arg[0] == ".") arg = resolvePath(pkg.parent.verArgument() + "/" + arg)
            return workspace.getTextAsync(arg)
                .then(scr => epkg.setFiles(scr));
        } else if (proto == "embed") {
            epkg.setFiles(pxt.getEmbeddedScript(pkg.verArgument()))
            return Promise.resolve()
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }
}

function resolvePath(p: string) {
    return p.replace(/\/+/g, "/").replace(/[^\/]+\/\.\.\//g, "").replace(/\/\.\//g, "/")
}

const theHost = new Host();
export var mainPkg = new pxt.MainPackage(theHost);

export function getEditorPkg(p: pxt.Package) {
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

export function allEditorPkgs() {
    return getEditorPkg(mainPkg).pkgAndDeps()
}

export function notifySyncDone(updated: pxt.Map<number>) {
    let newOnes = Util.values(mainPkg.deps).filter(d => d.verProtocol() == "workspace" && updated.hasOwnProperty(d.verArgument()))
    if (newOnes.length > 0) {
        getEditorPkg(mainPkg).onupdate()
    }

}

export function loadPkgAsync(id: string) {
    mainPkg = new pxt.MainPackage(theHost)
    mainPkg._verspec = "workspace:" + id

    return theHost.downloadPackageAsync(mainPkg)
        .catch(core.handleNetworkError)
        .then(() => theHost.readFile(mainPkg, pxt.configName))
        .then(str => {
            if (!str) return Promise.resolve()
            return mainPkg.installAllAsync()
                .catch(e => {
                    core.errorNotification(lf("Cannot load package: {0}", e.message))
                })
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

