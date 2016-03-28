import * as workspace from "./workspace";
import * as data from "./data";
import * as core from "./core";

import Cloud = ks.Cloud;
import Util = ks.Util;
var lf = Util.lf

export var appTarget: ks.AppTarget;
export var targetBundle: ks.TargetBundle;

let extWeight: Util.StringMap<number> = {
    "ts": 10,
    "blocks": 20,
    "json": 30,
    "md": 40,
}

export function setupAppTarget(trgbundle: ks.TargetBundle) {
    if (!trgbundle.appTheme) trgbundle.appTheme = {};
    let cfg: ks.PackageConfig = JSON.parse(trgbundle.bundledpkgs[trgbundle.corepkg][ks.configName])
    appTarget = cfg.target
    targetBundle = trgbundle;
    if (!appTarget.cloud) Cloud.apiRoot = undefined;
}

export class File {
    inSyncWithEditor = true;
    inSyncWithDisk = true;
    diagnostics: ts.ks.KsDiagnostic[];
    numDiagnosticsOverride: number;
    isVirtual = false;

    constructor(public epkg: EditorPackage, public name: string, public content: string)
    { }

    isReadonly() {
        return !this.epkg.header || this.isVirtual
    }

    getName() {
        return this.epkg.getPkgId() + "/" + this.name
    }

    getTypeScriptName() {
        if (this.epkg.isTopLevel()) return this.name
        else return "kind_modules/" + this.epkg.getPkgId() + "/" + this.name
    }

    getExtension() {
        let m = /\.([^\.]+)$/.exec(this.name)
        if (m) return m[1]
        return ""
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
        this.inSyncWithEditor = true;
        if (newContent != this.content) {
            this.inSyncWithDisk = false;
            this.content = newContent;
            this.updateStatus();
            data.invalidate("open:" + this.getName())
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
    files: Util.StringMap<File> = {};
    header: workspace.Header;
    onupdate = () => { };
    saveScheduled = false;
    savingNow = 0;

    id: string;
    outputPkg: EditorPackage;

    constructor(private ksPkg: ks.Package, private topPkg: EditorPackage) {
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

    setFiles(files: Util.StringMap<string>) {
        this.files = Util.mapStringMap(files, (k, v) => new File(this, k, v))
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
        return Util.mapStringMap(this.files, (k, f) => f.content)
    }

    saveFilesAsync() {
        if (!this.header) return Promise.resolve();

        let cfgFile = this.files[ks.configName]
        if (cfgFile) {
            try {
                let cfg = <ks.PackageConfig>JSON.parse(cfgFile.content)
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
        return Util.values((this.ksPkg as ks.MainPackage).deps).map(getEditorPkg).concat([this.outputPkg])
    }

    filterFiles(cond: (f: File) => boolean) {
        return Util.concat(this.pkgAndDeps().map(e => Util.values(e.files).filter(cond)))
    }

    lookupFile(name: string) {
        return this.filterFiles(f => f.getName() == name)[0]
    }
}

function getEmbeddedScript(id: string): Util.StringMap<string> {
    return Util.lookup(targetBundle.bundledpkgs, id)
}

class Host
    implements ks.Host {

    readFile(module: ks.Package, filename: string): string {
        let epkg = getEditorPkg(module)
        let file = epkg.files[filename]
        return file ? file.content : null
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
            // make sure it sits in cache
            return workspace.getPublishedScriptAsync(pkg.verArgument())
                .then(files => epkg.setFiles(files))
        } else if (proto == "workspace") {
            return workspace.getTextAsync(pkg.verArgument())
                .then(scr => epkg.setFiles(scr))
        } else if (proto == "embed") {
            epkg.setFiles(getEmbeddedScript(pkg.verArgument()))
            return Promise.resolve()
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }

    resolveVersionAsync(pkg: ks.Package) {
        if (getEmbeddedScript(pkg.id))
            return Promise.resolve("embed:" + pkg.id)
        return data.getAsync("cloud:" + ks.pkgPrefix + pkg.id).then(r => {
            let id = (r || {})["scriptid"]
            if (!id)
                Util.userError(lf("cannot resolve package {0}", pkg.id))
            return id
        })
    }
}

var theHost = new Host();
export var mainPkg = new ks.MainPackage(theHost);

export function getEditorPkg(p: ks.Package) {
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

export function notifySyncDone(updated: Util.StringMap<number>) {
    let newOnes = Util.values(mainPkg.deps).filter(d => d.verProtocol() == "workspace" && updated.hasOwnProperty(d.verArgument()))
    if (newOnes.length > 0) {
        getEditorPkg(mainPkg).onupdate()
    }

}

export function loadPkgAsync(id: string) {
    mainPkg = new ks.MainPackage(theHost)
    mainPkg._verspec = "workspace:" + id

    return theHost.downloadPackageAsync(mainPkg)
        .then(() => theHost.readFile(mainPkg, ks.configName))
        .then(str => {
            data.invalidate("open:")
            if (!str) return Promise.resolve()
            return mainPkg.installAllAsync()
                .catch(e => {
                    core.errorNotification(lf("Cannot load package: {0}", e.message))
                })
        })
}

/*
    open:<pkgName>/<filename> - one file
*/
data.mountVirtualApi("open", {
    getSync: p => {
        let f = getEditorPkg(mainPkg).lookupFile(data.stripProtocol(p))
        if (f) return f.content
        return null
    },
})

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

