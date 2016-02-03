import * as workspace from "./workspace";

export class File {
    constructor(public epkg: EditorPackage, public name: string, public content: string)
    { }

    getName() {
        return this.epkg.yelmPkg.id + "/" + this.name
    }
    getExtension() {
        let m = /\.([^\.]+)$/.exec(this.name)
        if (m) return m[1]
        return ""
    }
}

export class EditorPackage {
    files: Util.StringMap<File> = {};
    constructor(public yelmPkg: yelm.Package) {
    }

    setFiles(files: Util.StringMap<string>) {
        this.files = Util.mapStringMap(files, (k, v) => new File(this, k, v))
    }

    sortedFiles() {
        return Util.values(this.files)
    }

    getMainFile() {
        return this.sortedFiles().filter(f => f.getExtension() == "ts")[0] || this.sortedFiles()[0]
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
                .then(scr => epkg.setFiles(scr.files))
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }

    resolveVersionAsync(pkg: yelm.Package) {
        return Cloud.privateGetAsync(yelm.pkgPrefix + pkg.id).then(r => {
            let id = r["scriptid"]
            if (!id)
                Util.userError("scriptid no set on ptr for pkg " + pkg.id)
            return id
        })
    }

}

var theHost = new Host();
export var mainPkg = new yelm.MainPackage(theHost);

export function getEditorPkg(p: yelm.Package) {
    let r: EditorPackage = (p as any)._editorPkg
    if (r) return r
    return ((p as any)._editorPkg = new EditorPackage(p))
}

export function allEditorPkgs() {
    return Util.values(mainPkg.deps).map(getEditorPkg)
}

export function loadPkgAsync(id: string) {
    mainPkg = new yelm.MainPackage(theHost)
    mainPkg._verspec = "workspace:" + id
    return mainPkg.installAllAsync()
}