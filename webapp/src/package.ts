import * as workspace from "./workspace";
import * as data from "./data";
import * as core from "./core";
import * as db from "./db";
import * as compiler from "./compiler";

import Util = pxt.Util;

let hostCache = new db.Table("hostcache")

let extWeight: pxt.Map<number> = {
    "ts": 10,
    "blocks": 20,
    "json": 30,
    "md": 40,
}

export function setupAppTarget(trgbundle: pxt.TargetBundle) {
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
    baseGitContent: string;

    constructor(public epkg: EditorPackage, public name: string, public content: string) { }

    isReadonly() {
        return !this.epkg.header;
    }

    getName() {
        return this.epkg.getPkgId() + "/" + this.name
    }

    getTextFileName() {
        if (this.epkg.isTopLevel()) return this.name
        else return "pxt_modules/" + this.epkg.getPkgId() + "/" + this.name
    }

    getFileNameWithExtension(ext: string) {
        const base = this.getTextFileName();
        return base.substring(0, base.length - this.getExtension().length) + ext;
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
        if (/^_locales\//.test(this.name))
            return 500;
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

    setBaseGitContent(newContent: string) {
        if (newContent != this.baseGitContent) {
            this.baseGitContent = newContent
            this.updateStatus()
        }
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
                    if (this.name == pxt.github.GIT_JSON)
                        this.epkg.updateGitJsonCache()
                })
        } else {
            this.updateStatus();
            return Promise.resolve()
        }
    }

    setForceChangeCallback(callback: (from: string, to: string) => void) {
        this.forceChangeCallback = callback;
    }

    /**
     * Content prepared for github publishing
     */
    publishedContent(): string {
        let c = this.content;
        if (this.name == pxt.CONFIG_NAME)
            c = workspace.prepareConfigForGithub(c);
        return c;
    }
}

interface CachedTranspile {
    fromLanguage: pxtc.CodeLang;
    fromText: string;

    toLanguage: pxtc.CodeLang;
    toText: string;
}

const MAX_CODE_EQUIVS = 10

export class EditorPackage {
    files: pxt.Map<File> = {};
    header: pxt.workspace.Header;
    onupdate = () => { };
    saveScheduled = false;
    savingNow = 0;
    private simState: pxt.Map<any>;
    private simStateSaveScheduled = false;
    protected transpileCache: CachedTranspile[] = [];

    id: string;
    outputPkg: EditorPackage;
    assetsPkg: EditorPackage;

    constructor(private ksPkg: pxt.Package, private topPkg: EditorPackage) {
        if (ksPkg && ksPkg.verProtocol() == "workspace")
            this.header = workspace.getHeader(ksPkg.verArgument())
    }

    getSimState() {
        if (!this.simState) {
            if (!this.files[pxt.SIMSTATE_JSON])
                this.setFile(pxt.SIMSTATE_JSON, "{}")
            const f = this.files[pxt.SIMSTATE_JSON]
            try {
                this.simState = JSON.parse(f.content)
            } catch {
                this.simState = {}
            }
        }
        return this.simState
    }

    setSimState(k: string, v: any) {
        const state = this.getSimState()
        if (state[k] == v)
            return
        if (v == null)
            delete state[k]
        else
            state[k] = v
        if (!this.simStateSaveScheduled) {
            this.simStateSaveScheduled = true
            setTimeout(() => {
                this.simStateSaveScheduled = false
                if (!this.simState)
                    return
                const f = this.files[pxt.SIMSTATE_JSON]
                if (!f)
                    return
                f.setContentAsync(JSON.stringify(this.simState)).done()
            }, 2000)
        }
    }

    getTopHeader() {
        return this.topPkg.header;
    }

    getLanguageRestrictions() {
        const ksPkg = this.topPkg.ksPkg;
        const cfg = ksPkg && ksPkg.config;
        return cfg && cfg.languageRestriction;
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
                return cfgFile.setContentAsync(pxt.Package.stringifyConfig(cfg))
                    .then(() => this.ksPkg.loadConfig())
            } catch (e) { }
        }

        return null;
    }

    updateDepAsync(pkgid: string): Promise<void> {
        let p = this.ksPkg.resolveDep(pkgid);
        if (!p || p.verProtocol() != "github") return Promise.resolve();
        let parsed = pxt.github.parseRepoId(p.verArgument())
        if (!parsed) return Promise.resolve();
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
        return this.updateConfigAsync(cfg => {
            cfg.files = cfg.files.filter(f => f != n)
            if (cfg.testFiles)
                cfg.testFiles = cfg.testFiles.filter(f => f != n)
        })
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

    updateGitJsonCache() {
        const gj = this.files[pxt.github.GIT_JSON]
        if (gj) {
            const gjc: pxt.github.GitJson = JSON.parse(gj.content)
            if (gjc.commit) {
                for (let treeEnt of gjc.commit.tree.tree) {
                    const f = this.files[treeEnt.path]
                    if (f && treeEnt.blobContent != null)
                        f.setBaseGitContent(treeEnt.blobContent)
                }
            }
        }
    }

    setFiles(files: pxt.Map<string>) {
        this.files = Util.mapMap(files, (k, v) => new File(this, k, v))
        data.invalidate("open-meta:")
        this.updateGitJsonCache()
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

    getAllFiles(): pxt.Map<string> {
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

    sortedFiles(): File[] {
        let lst = Util.values(this.files)
        if (!pxt.options.debug)
            lst = lst.filter(f => f.name != pxt.github.GIT_JSON && f.name != pxt.SIMSTATE_JSON && f.name != pxt.SERIAL_EDITOR_FILE)
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
        if (name.indexOf("pxt_modules/") === 0) name = name.slice(12);
        return this.filterFiles(f => f.getName() == name)[0]
    }

    cacheTranspile(fromLanguage: pxtc.CodeLang, fromText: string, toLanguage: pxtc.CodeLang, toText: string) {
        this.transpileCache.push({
            fromLanguage,
            fromText,
            toLanguage,
            toText
        });

        if (this.transpileCache.length > MAX_CODE_EQUIVS) {
            this.transpileCache.shift();
        }
    }

    getCachedTranspile(fromLanguage: pxtc.CodeLang, fromText: string, toLanguage: pxtc.CodeLang) {
        for (const ct of this.transpileCache) {
            if (ct.toLanguage === fromLanguage && ct.fromLanguage === toLanguage && codeIsEqual(fromLanguage, ct.toText, fromText)) {
                return ct.fromText;
            }
            else if (ct.fromLanguage === fromLanguage && ct.toLanguage === toLanguage && codeIsEqual(fromLanguage, ct.fromText, fromText)) {
                return ct.toText;
            }
        }

        return null;
    }
}

function codeIsEqual(language: pxtc.CodeLang, a: string, b: string) {
    return a === b;
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
        return pxt.hexloader.getHexInfoAsync(this, extInfo).catch(core.handleNetworkError);
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
                    if (!epkg.isTopLevel() && !scr) {
                        pkg.configureAsInvalidPackage(`cannot find '${arg}' in the workspace.`);
                        return Promise.resolve();
                    }
                    if (!scr) // this should not happen;
                        return Promise.reject(new Error(`Cannot find text for package '${arg}' in the workspace.`));
                    if (epkg.isTopLevel() && epkg.header)
                        return workspace.recomputeHeaderFlagsAsync(epkg.header, scr)
                            .then(() => epkg.setFiles(scr))
                    else {
                        epkg.setFiles(scr)
                        return Promise.resolve()
                    }
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
            if (arg[0] == ".") {
                arg = resolvePath(pkg.parent.verArgument() + "/" + arg)
            }
            return fromWorkspaceAsync(arg)
        } else if (proto == "embed") {
            epkg.setFiles(pxt.getEmbeddedScript(pkg.verArgument()))
            return Promise.resolve()
        } else if (proto == "pkg") {
            const filesSrc = mainPkg.readFile(pkg.verArgument().replace(/^\.\//, ''));
            const files = ts.pxtc.Util.jsonTryParse(filesSrc);
            if (files)
                epkg.setFiles(files);
            else pxt.log(`failed to resolve ${pkg.version()}`);
            return Promise.resolve();
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
    isGitModified: boolean;
    diagnostics?: pxtc.KsDiagnostic[];
}

/*
    open-meta:<pkgName>/<filename> - readonly/saved/unsaved + number of errors
*/
data.mountVirtualApi("open-meta", {
    getSync: p => {
        p = data.stripProtocol(p)
        const pk = mainEditorPkg()
        const f = pk.lookupFile(p)
        if (!f) return {}
        const hasGit = !!(pk.header && pk.header.githubId && f.epkg == pk)

        const fs: FileMeta = {
            isReadonly: f.isReadonly(),
            isSaved: f.inSyncWithEditor && f.inSyncWithDisk,
            numErrors: f.numDiagnosticsOverride,
            isGitModified: hasGit && f.baseGitContent != f.publishedContent()
        }

        if (fs.numErrors == null) {
            fs.numErrors = f.diagnostics ? f.diagnostics.length : 0
            fs.diagnostics = f.diagnostics;
        }

        return fs
    },
})

export interface PackageMeta {
    numErrors: number;
    diagnostics?: pxtc.KsDiagnostic[];
}

/*
    open-pkg-meta:<pkgName> - number of errors
*/
data.mountVirtualApi("open-pkg-meta", {
    getSync: p => {
        p = data.stripProtocol(p)
        const f = allEditorPkgs().filter(pkg => pkg.getPkgId() == p)[0];
        if (!f || f.getPkgId() == "built")
            return {}

        const files = f.sortedFiles();
        let numErrors = files.reduce((n, file) => n + (file.numDiagnosticsOverride
            || (file.diagnostics ? file.diagnostics.length : 0)
            || 0), 0);
        const ks = f.getKsPkg();
        if (ks && ks.invalid())
            numErrors++;
        const r = <PackageMeta>{
            numErrors
        }
        if (numErrors) {
            r.diagnostics = [];
            files.filter(f => !!f.diagnostics).forEach(f => r.diagnostics.concat(f.diagnostics));
        }
        return r;
    }
})

export interface PackageGitStatus {
    id?: string;
    modified?: boolean;
}

/*
    pkg-git-status:<guid>
*/
data.mountVirtualApi("pkg-git-status", {
    getSync: p => {
        p = data.stripProtocol(p)
        const f = allEditorPkgs().find(pkg => pkg.header && pkg.header.id == p);
        const r: PackageGitStatus = {};
        if (f) {
            r.id = f.getPkgId() == "this" && f.header && f.header.githubId;
            if (r.id) {
                const files = f.sortedFiles();
                r.modified = !!files.find(f => f.baseGitContent != f.publishedContent());
            }
        }
        return r;
    }
})

export function invalidatePullStatus(hd: pxt.workspace.Header) {
    data.invalidateHeader("pkg-git-pull-status", hd)
}

data.mountVirtualApi("pkg-git-pull-status", {
    getAsync: p => {
        p = data.stripProtocol(p)
        const f = allEditorPkgs().find(pkg => pkg.header && pkg.header.id == p);
        const ghid = f.getPkgId() == "this" && f.header && f.header.githubId;
        if (!ghid) return Promise.resolve(workspace.PullStatus.NoSourceControl)
        return workspace.pullAsync(f.header, true)
            .catch(e => workspace.PullStatus.NoSourceControl);
    },
    expirationTime: p => 3600 * 1000
})

export function invalidatePullRequestStatus(hd: pxt.workspace.Header) {
    data.invalidateHeader("pkg-git-pr", hd)
}

data.mountVirtualApi("pkg-git-pr", {
    getAsync: p => {
        const missing = <pxt.github.PullRequest>{
            number: -1
        };
        p = data.stripProtocol(p)
        const f = allEditorPkgs().find(pkg => pkg.header && pkg.header.id == p);
        const header = f.header;
        const ghid = f.getPkgId() == "this" && header && header.githubId;
        if (!ghid) return Promise.resolve(missing);
        const parsed = pxt.github.parseRepoId(ghid);
        if (!parsed || !parsed.tag || parsed.tag == "master") return Promise.resolve(missing);
        return pxt.github.findPRNumberforBranchAsync(parsed.fullName, parsed.tag)
            .catch(e => missing);
    },
    expirationTime: p => 3600 * 1000
})

export function invalidatePagesStatus(hd: pxt.workspace.Header) {
    data.invalidateHeader("pkg-git-pages", hd)
}

data.mountVirtualApi("pkg-git-pages", {
    getAsync: p => {
        p = data.stripProtocol(p)
        const f = allEditorPkgs().find(pkg => pkg.header && pkg.header.id == p);
        const header = f.header;
        const ghid = f.getPkgId() == "this" && header && header.githubId;
        if (!ghid) return Promise.resolve(undefined);
        const parsed = pxt.github.parseRepoId(ghid);
        if (!parsed) return Promise.resolve(undefined);
        return pxt.github.getPagesStatusAsync(parsed.fullName)
            .catch(e => undefined);
    },
    expirationTime: p => 3600 * 1000
})


// pkg-status:<guid>
data.mountVirtualApi("pkg-status", {
    getSync: p => {
        p = data.stripProtocol(p)
        const ep = allEditorPkgs().find(pkg => pkg.header && pkg.header.id == p)
        if (ep)
            return ep.savingNow ? "saving" : ""
        return ""
    },
})
