import * as workspace from "./workspace";
import * as data from "./data";
import * as core from "./core";

var lf = Util.lf

export class File {
    inSyncWithEditor = true;
    inSyncWithDisk = true;
    diagnostics: ts.Diagnostic[];

    constructor(public epkg: EditorPackage, public name: string, public content: string)
    { }

    isReadonly() {
        return !this.epkg.header
    }

    getName() {
        return this.epkg.getPkgId() + "/" + this.name
    }

    getExtension() {
        let m = /\.([^\.]+)$/.exec(this.name)
        if (m) return m[1]
        return ""
    }

    markDirty() {
        this.inSyncWithEditor = false;
        this.updateStatus();
    }

    private updateStatus() {
        data.invalidate("open-meta:status:" + this.getName())
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

    constructor(private yelmPkg: yelm.Package, private topPkg: EditorPackage) {
        if (yelmPkg && yelmPkg.verProtocol() == "workspace")
            this.header = workspace.getHeader(yelmPkg.verArgument())
    }

    getTopHeader() {
        return this.topPkg.header;
    }

    makeTopLevel() {
        this.topPkg = this;
        this.outputPkg = new EditorPackage(null, this)
        this.outputPkg.id = "built"
    }

    getYelmPkg() {
        return this.yelmPkg;
    }

    getPkgId() {
        return this.yelmPkg ? this.yelmPkg.id : this.id;
    }

    isTopLevel() {
        return this.yelmPkg && this.yelmPkg.level == 0;
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

    saveFilesAsync() {
        if (!this.header) return Promise.resolve();

        let cfgFile = this.files[yelm.configName]
        if (cfgFile) {
            try {
                let cfg = <yelm.PackageConfig>JSON.parse(cfgFile.content)
                this.header.name = cfg.name
            } catch (e) {
            }
        }
        let files = Util.mapStringMap(this.files, (k, f) => f.content)
        return workspace.saveAsync(this.header, files)
            .then(() => this.scheduleSave())
    }

    sortedFiles() {
        return Util.values(this.files)
    }

    forEachFile(cb: (f: File) => void) {
        this.pkgAndDeps().forEach(p => {
            Util.values(p.files).forEach(cb)
        })
    }

    getMainFile() {
        return this.sortedFiles().filter(f => f.getExtension() == "ts")[0] || this.sortedFiles()[0]
    }

    pkgAndDeps(): EditorPackage[] {
        if (this.topPkg != this)
            return this.topPkg.pkgAndDeps();
        return Util.values((this.yelmPkg as yelm.MainPackage).deps).map(getEditorPkg).concat([this.outputPkg])
    }

    lookupFile(name: string) {
        return Util.concat(this.pkgAndDeps().map(e => Util.values(e.files).filter(f => f.getName() == name)))[0]
    }
}

class Host
    implements yelm.Host {

    readFileAsync(module: yelm.Package, filename: string): Promise<string> {
        let epkg = getEditorPkg(module)
        let file = epkg.files[filename]
        return Promise.resolve(file ? file.content : null)
    }

    writeFileAsync(module: yelm.Package, filename: string, contents: string): Promise<void> {
        if (filename == yelm.configName)
            return Promise.resolve(); // ignore config writes
        throw Util.oops("trying to write " + module + " / " + filename)
    }

    getHexInfoAsync() {
        return Promise.resolve(require("../../../generated/hexinfo.js"))
    }

    downloadPackageAsync(pkg: yelm.Package) {
        let proto = pkg.verProtocol()
        let epkg = getEditorPkg(pkg)

        if (proto == "pub")
            // make sure it sits in cache
            return workspace.getScriptFilesAsync(pkg.verArgument())
                .then(files => epkg.setFiles(files))
        else if (proto == "workspace") {
            return workspace.getTextAsync(pkg.verArgument())
                .then(scr => epkg.setFiles(scr))
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }

    resolveVersionAsync(pkg: yelm.Package) {
        return data.getAsync("cloud:" + yelm.pkgPrefix + pkg.id).then(r => {
            let id = (r || {})["scriptid"]
            if (!id)
                Util.userError(lf("cannot resolve package {0}", pkg.id))
            return id
        })
    }

}

var theHost = new Host();
export var mainPkg = new yelm.MainPackage(theHost);

export function getEditorPkg(p: yelm.Package) {
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
    mainPkg = new yelm.MainPackage(theHost)
    mainPkg._verspec = "workspace:" + id

    return theHost.downloadPackageAsync(mainPkg)
        .then(() => theHost.readFileAsync(mainPkg, yelm.configName))
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

/*
    open-meta:status:<pkgName>/<filename> - readonly/saved/unsaved
    open-meta:errors:<pkgName>/<filename> - number of errors  
*/
data.mountVirtualApi("open-meta", {
    getSync: p => {
        p = data.stripProtocol(p)
        let m = /^([^:]+):(.*)/.exec(p)
        let op = m[1]
        let f = getEditorPkg(mainPkg).lookupFile(m[2])
        if (!f) return null
        
        if (op == "status") {
            if (f.isReadonly())
                return "readonly"

            if (f.inSyncWithEditor && f.inSyncWithDisk)
                return "saved"
            else
                return "unsaved"
        } else if (op == "error") {
            return f.diagnostics ? f.diagnostics.length : 0
        } else {
            Util.oops();
            return null
        }
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

