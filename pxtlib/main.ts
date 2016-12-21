/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/pxtpackage.d.ts"/>
/// <reference path="../built/pxtparts.d.ts"/>
/// <reference path="../built/pxtarget.d.ts"/>
/// <reference path="../built/pxtpackage.d.ts"/>
/// <reference path="emitter/util.ts"/>

namespace pxt {
    export import U = pxtc.Util;
    export import Util = pxtc.Util;
    const lf = U.lf;

    export var appTarget: TargetBundle;

    export function setAppTarget(trg: TargetBundle) {
        appTarget = trg

        // patch-up the target
        let comp = appTarget.compile
        if (!comp)
            comp = appTarget.compile = { isNative: false, hasHex: false }
        if (comp.hasHex && comp.jsRefCounting === undefined)
            comp.jsRefCounting = true
        if (!comp.hasHex && comp.floatingPoint === undefined)
            comp.floatingPoint = true
        if (comp.nativeType == "AVR") {
            comp.shortPointers = true
            comp.flashCodeAlign = 0x10
        }
        if (!trg.appTheme.embedUrl)
            trg.appTheme.embedUrl = trg.appTheme.homeUrl
        let cs = appTarget.compileService
        if (cs) {
            if (cs.yottaTarget && !cs.yottaBinary)
                cs.yottaBinary = "pxt-microbit-app-combined.hex"
        }
    }

    export interface PxtOptions {
        debug?: boolean;
        light?: boolean; // low resource device
        wsPort?: number;
    }
    export var options: PxtOptions = {};

    // general error reported
    export var debug: (msg: any) => void = typeof console !== "undefined" && !!console.debug
        ? (msg) => {
            if (pxt.options.debug)
                console.debug(msg);
        } : () => { };
    export var log: (msg: any) => void = typeof console !== "undefined" && !!console.log
        ? (msg) => {
            console.log(msg);
        } : () => { };

    export var reportException: (err: any, data?: Map<string>) => void = function (e, d) {
        if (console) {
            console.error(e);
            if (d) {
                try {
                    // log it as object, so native object inspector can be used
                    console.log(d)
                    //pxt.log(JSON.stringify(d, null, 2))
                } catch (e) { }
            }
        }
    }
    export var reportError: (cat: string, msg: string, data?: Map<string>) => void = function (cat, msg, data) {
        if (console) {
            console.error(`${cat}: ${msg}`);
            if (data) {
                try {
                    pxt.log(JSON.stringify(data, null, 2))
                } catch (e) { }
            }
        }
    }

    /**
     * Track an event.
     */
    export var tickEvent: (id: string, data?: Map<string | number>) => void = function (id) { }

    let activityEvents: Map<number> = {};
    const tickActivityDebounced = Util.debounce(() => {
        tickEvent("activity", activityEvents);
        activityEvents = {};
    }, 10000, false);
    /**
     * Ticks activity events. This event gets aggregated and eventually gets sent.
     */
    export function tickActivity(...ids: string[]) {
        ids.forEach(id => activityEvents[id] = (activityEvents[id] || 0) + 1);
        tickActivityDebounced();
    }

    export interface WebConfig {
        relprefix: string; // "/beta---",
        workerjs: string;  // "/beta---worker",
        tdworkerjs: string;  // "/beta---tdworker",
        monacoworkerjs: string; // "/beta---monacoworker",
        pxtVersion: string; // "0.3.8",
        pxtRelId: string; // "zstad",
        pxtCdnUrl: string; // "https://az851932.vo.msecnd.net/app/zstad/c/",
        targetUrl: string; // "https://pxt.microbit.org"
        targetVersion: string; // "0.2.108",
        targetRelId: string; // "zowrj",
        targetCdnUrl: string; // "https://az851932.vo.msecnd.net/app/zowrj/c/",
        targetId: string; // "microbit",
        simUrl: string; // "https://trg-microbit.kindscript.net/sim/zowrj"
        partsUrl?: string; // /beta---parts
        runUrl?: string; // "/beta---run"
        docsUrl?: string; // "/beta---docs"
        isStatic?: boolean;
    }

    export function localWebConfig() {
        let r: WebConfig = {
            relprefix: "/--",
            workerjs: "/worker.js",
            tdworkerjs: "/tdworker.js",
            monacoworkerjs: "/monacoworker.js",
            pxtVersion: "local",
            pxtRelId: "",
            pxtCdnUrl: "/cdn/",
            targetUrl: "",
            targetVersion: "local",
            targetRelId: "",
            targetCdnUrl: "/sim/",
            targetId: appTarget ? appTarget.id : "",
            simUrl: "/sim/simulator.html",
            partsUrl: "/sim/siminstructions.html"
        }
        return r
    }

    export var webConfig: WebConfig;

    export function getOnlineCdnUrl(): string {
        if (!webConfig) return null
        let m = /^(https:\/\/[^\/]+)/.exec(webConfig.pxtCdnUrl)
        if (m) return m[1]
        else return null
    }

    export function setupWebConfig(cfg: WebConfig) {
        if (cfg) webConfig = cfg;
        else if (!webConfig) webConfig = localWebConfig()
    }

    export interface CompileTarget extends pxtc.CompileTarget {
        preferredEditor?: string; // used to indicate preferred editor to show code in
    }

    export interface Host {
        readFile(pkg: Package, filename: string): string;
        writeFile(pkg: Package, filename: string, contents: string, force?: boolean): void;
        downloadPackageAsync(pkg: Package): Promise<void>;
        getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo>;
        cacheStoreAsync(id: string, val: string): Promise<void>;
        cacheGetAsync(id: string): Promise<string>; // null if not found
    }

    // this is for remote file interface to packages
    export interface FsFile {
        name: string;  // eg "main.ts"
        mtime: number; // ms since epoch
        content?: string; // not returned in FsPkgs
        prevContent?: string; // only used in write reqs
    }

    export interface FsPkg {
        path: string; // eg "foo/bar"
        config: pxt.PackageConfig; // pxt.json
        files: FsFile[]; // this includes pxt.json
        icon?: string;
    }

    export interface FsPkgs {
        pkgs: FsPkg[];
    }

    export interface ICompilationOptions {

    }

    export function getEmbeddedScript(id: string): Map<string> {
        return U.lookup(appTarget.bundledpkgs || {}, id)
    }

    export class Package {
        public config: PackageConfig;
        public level = -1;
        public isLoaded = false;
        private resolvedVersion: string;

        constructor(public id: string, public _verspec: string, public parent: MainPackage) {
            if (parent) {
                this.level = this.parent.level + 1
            }
        }

        version() {
            return this.resolvedVersion || this._verspec;
        }

        verProtocol() {
            let spl = this.version().split(':')
            if (spl.length > 1) return spl[0]
            else return ""
        }

        verArgument() {
            let p = this.verProtocol()
            if (p) return this.version().slice(p.length + 1)
            return this.version()
        }

        commonDownloadAsync(): Promise<Map<string>> {
            let proto = this.verProtocol()
            if (proto == "pub") {
                return Cloud.downloadScriptFilesAsync(this.verArgument())
            } else if (proto == "github") {
                return pxt.packagesConfigAsync()
                    .then(config => pxt.github.downloadPackageAsync(this.verArgument(), config))
                    .then(resp => resp.files)
            } else if (proto == "embed") {
                let resp = pxt.getEmbeddedScript(this.verArgument())
                return Promise.resolve(resp)
            } else
                return Promise.resolve(null as Map<string>)
        }

        host() { return this.parent._host }

        readFile(fn: string) {
            return this.host().readFile(this, fn)
        }

        resolveDep(id: string) {
            if (this.parent.deps.hasOwnProperty(id))
                return this.parent.deps[id];
            return null
        }

        saveConfig() {
            let cfg = JSON.stringify(this.config, null, 4) + "\n"
            this.host().writeFile(this, pxt.CONFIG_NAME, cfg)
        }

        private resolveVersionAsync() {
            let v = this._verspec

            if (getEmbeddedScript(this.id)) {
                this.resolvedVersion = v = "embed:" + this.id
            } else if (!v || v == "*") {
                U.userError(lf("version not specified for {0}", v))
            }
            return Promise.resolve(v)
        }

        private downloadAsync() {
            let kindCfg = ""
            return this.resolveVersionAsync()
                .then(verNo => {
                    if (!/^embed:/.test(verNo) &&
                        this.config && this.config.installedVersion == verNo)
                        return
                    pxt.debug('downloading ' + verNo)
                    return this.host().downloadPackageAsync(this)
                        .then(() => {
                            const confStr = this.readFile(pxt.CONFIG_NAME)
                            const mainTs = this.readFile("main.ts")
                            if (!confStr)
                                U.userError(`package ${this.id} is missing ${pxt.CONFIG_NAME}`)
                            this.parseConfig(confStr, mainTs);
                            if (this.level != 0)
                                this.config.installedVersion = this.version()
                            this.saveConfig()
                        })
                        .then(() => {
                            pxt.debug(`installed ${this.id} /${verNo}`)
                        })

                })
        }

        protected validateConfig() {
            if (!this.config.dependencies)
                U.userError("Missing dependencies in config of: " + this.id)
            if (!Array.isArray(this.config.files))
                U.userError("Missing files in config of: " + this.id)
            if (typeof this.config.name != "string" || !this.config.name ||
                (this.config.public && !/^[a-z][a-z0-9\-_]+$/i.test(this.config.name)))
                U.userError("Invalid package name: " + this.config.name)
            if (this.config.targetVersions
                && this.config.targetVersions.target
                && semver.strcmp(this.config.targetVersions.target, appTarget.versions.target) > 0)
                U.userError(lf("Package {0} requires target version {1} (you are running {2})",
                    this.config.name, this.config.targetVersions.target, appTarget.versions.target))
        }

        addMissingPackages(config: pxt.PackageConfig, ts: string) {
            const upgrades = appTarget.compile ? appTarget.compile.upgrades : undefined;
            if (ts && upgrades)
                upgrades.filter(rule => rule.type == "missingPackage")
                    .forEach(rule => {
                        for (const match in rule.map) {
                            const regex = new RegExp(match, 'g');
                            const pkg = rule.map[match];
                            ts.replace(regex, (m) => {
                                if (!config.dependencies[pkg]) {
                                    pxt.log(`adding missing package ${pkg}`);
                                    config.dependencies[pkg] = "*"
                                }
                                return "";
                            })
                        }
                    })
        }

        upgradePackage(pkg: string, val: string): string {
            if (val != "*") return pkg;
            const upgrades = appTarget.compile ? appTarget.compile.upgrades : undefined;
            let newPackage = pkg;
            if (upgrades) {
                upgrades.filter(rule => rule.type == "package")
                    .forEach(rule => {
                        for (let match in rule.map) {
                            if (newPackage == match) {
                                newPackage = rule.map[match];
                            }
                        }
                    });
            }
            return newPackage;
        }

        upgradeAPI(fileContents: string): string {
            const upgrades = appTarget.compile ? appTarget.compile.upgrades : undefined;
            let updatedContents = fileContents;
            if (upgrades) {
                upgrades.filter(rule => rule.type == "api")
                    .forEach(rule => {
                        for (const match in rule.map) {
                            const regex = new RegExp(match, 'g');
                            updatedContents = updatedContents.replace(regex, rule.map[match]);
                        }
                    });
            }
            return updatedContents;
        }

        private parseConfig(cfgSrc: string, mainTs: string) {
            const cfg = <PackageConfig>JSON.parse(cfgSrc)
            this.config = cfg;

            const currentConfig = JSON.stringify(this.config);
            for (const dep in this.config.dependencies) {
                const value = this.upgradePackage(dep, this.config.dependencies[dep]);
                if (value != dep) {
                    delete this.config.dependencies[dep];
                    if (value) {
                        this.config.dependencies[value] = "*";
                    }
                }
            }
            this.addMissingPackages(this.config, mainTs);
            if (JSON.stringify(this.config) != currentConfig) {
                this.saveConfig();
            }
            this.validateConfig();
        }

        loadAsync(isInstall = false): Promise<void> {
            if (this.isLoaded) return Promise.resolve();

            let initPromise = Promise.resolve()

            this.isLoaded = true
            const str = this.readFile(pxt.CONFIG_NAME);
            const mainTs = this.readFile("main.ts");
            if (str == null) {
                if (!isInstall)
                    U.userError("Package not installed: " + this.id)
            } else {
                initPromise = initPromise.then(() => this.parseConfig(str, mainTs))
            }

            if (isInstall)
                initPromise = initPromise.then(() => this.downloadAsync())

            return initPromise
                .then(() =>
                    U.mapStringMapAsync(this.config.dependencies, (id, ver) => {
                        let mod = this.resolveDep(id)
                        ver = ver || "*"
                        if (mod) {
                            if (mod._verspec != ver && (!/^file:/.test(mod._verspec) || !/^file:/.test(ver)))
                                U.userError("Version spec mismatch on " + id)
                            mod.level = Math.min(mod.level, this.level + 1)
                            return Promise.resolve()
                        } else {
                            mod = new Package(id, ver, this.parent)
                            this.parent.deps[id] = mod
                            return mod.loadAsync(isInstall)
                        }
                    }))
                .then(() => { })
        }

        getFiles() {
            if (this.level == 0)
                return this.config.files.concat(this.config.testFiles || [])
            else
                return this.config.files.slice(0);
        }

        addSnapshot(files: Map<string>, exts: string[] = [""]) {
            for (let fn of this.getFiles()) {
                if (exts.some(e => U.endsWith(fn, e))) {
                    files[this.id + "/" + fn] = this.readFile(fn)
                }
            }
            files[this.id + "/" + pxt.CONFIG_NAME] = this.readFile(pxt.CONFIG_NAME)
        }

        /**
         * Returns localized strings qName -> translation
         */
        packageLocalizationStringsAsync(lang: string): Promise<Map<string>> {
            const targetId = pxt.appTarget.id;
            const filenames = [this.id + "-jsdoc", this.id];
            const r: Map<string> = {};
            if (pxt.Util.localizeLive && this.id != "this") {
                pxt.log(`loading live translations for ${this.id}`)
                const code = pxt.Util.userLanguage();
                return Promise.all(filenames.map(
                    fn => pxt.Util.downloadLiveTranslationsAsync(code, `${targetId}/${fn}-strings.json`)
                        .then(tr => Util.jsonMergeFrom(r, tr))
                        .catch(e => pxt.log(`error while downloading ${targetId}/${fn}-strings.json`)))
                ).then(() => r);
            }

            const files = this.config.files;
            filenames.map(name => {
                let fn = `_locales/${lang.toLowerCase()}/${name}-strings.json`;
                if (files.indexOf(fn) > -1)
                    return JSON.parse(this.readFile(fn)) as Map<string>;
                if (lang.length > 2) {
                    fn = `_locales/${lang.substring(0, 2).toLowerCase()}/${name}-strings.json`;
                    if (files.indexOf(fn) > -1)
                        return JSON.parse(this.readFile(fn)) as Map<string>;
                }
                return undefined;
            }).filter(d => !!d).forEach(d => Util.jsonMergeFrom(r, d));

            return Promise.resolve(r);
        }
    }

    export class MainPackage
        extends Package {
        public deps: Map<Package> = {};

        constructor(public _host: Host) {
            super("this", "file:.", null)
            this.parent = this
            this.level = 0
            this.deps[this.id] = this;
        }

        installAllAsync() {
            return this.loadAsync(true)
        }

        sortedDeps() {
            let visited: Map<boolean> = {}
            let ids: string[] = []
            let rec = (p: Package) => {
                if (U.lookup(visited, p.id)) return;
                visited[p.id] = true
                if (p.config && p.config.dependencies) {
                    const deps = Object.keys(p.config.dependencies);
                    deps.sort((a, b) => U.strcmp(a, b))
                    deps.forEach(id => rec(this.resolveDep(id)))
                    ids.push(p.id)
                }
            }
            rec(this)
            return ids.map(id => this.resolveDep(id))
        }

        localizationStringsAsync(lang: string): Promise<Map<string>> {
            const loc: Map<string> = {};
            return Promise.all(Util.values(this.deps).map(dep =>
                dep.packageLocalizationStringsAsync(lang)
                    .then(depLoc => {
                        if (depLoc) // merge data
                            for (let k in depLoc)
                                if (!loc[k]) loc[k] = depLoc[k];
                    })))
                .then(() => loc);
        }

        getTargetOptions(): CompileTarget {
            let res = U.clone(appTarget.compile)
            U.assert(!!res)
            return res
        }

        getCompileOptionsAsync(target: CompileTarget = this.getTargetOptions()) {
            let opts: pxtc.CompileOptions = {
                sourceFiles: [],
                fileSystem: {},
                target: target,
                hexinfo: { hex: [] }
            }

            const generateFile = (fn: string, cont: string) => {
                if (this.config.files.indexOf(fn) < 0)
                    U.userError(lf("please add '{0}' to \"files\" in {1}", fn, pxt.CONFIG_NAME))
                cont = "// Auto-generated. Do not edit.\n" + cont + "\n// Auto-generated. Do not edit. Really.\n"
                if (this.host().readFile(this, fn) !== cont) {
                    pxt.debug(`updating ${fn} (size=${cont.length})...`)
                    this.host().writeFile(this, fn, cont)
                }
            }

            const upgradeFile = (fn: string, cont: string) => {
                let updatedCont = this.upgradeAPI(cont);
                if (updatedCont != cont) {
                    // save file (force write)
                    pxt.debug(`updating APIs in ${fn} (size=${cont.length})...`)
                    this.host().writeFile(this, fn, updatedCont, true)
                }
                return updatedCont;
            }

            return this.loadAsync()
                .then(() => {
                    pxt.debug(`building: ${this.sortedDeps().map(p => p.config.name).join(", ")}`)
                    let ext = cpp.getExtensionInfo(this)
                    if (ext.shimsDTS) generateFile("shims.d.ts", ext.shimsDTS)
                    if (ext.enumsDTS) generateFile("enums.d.ts", ext.enumsDTS)
                    return (target.isNative
                        ? this.host().getHexInfoAsync(ext)
                        : Promise.resolve<pxtc.HexInfo>(null))
                        .then(inf => {
                            ext = U.flatClone(ext)
                            delete ext.compileData;
                            delete ext.generatedFiles;
                            delete ext.extensionFiles;
                            opts.extinfo = ext
                            opts.hexinfo = inf
                        })
                })
                .then(() => this.config.binaryonly || appTarget.compile.shortPointers || !opts.target.isNative ? null : this.filesToBePublishedAsync(true))
                .then(files => {
                    if (files) {
                        files = U.mapMap(files, upgradeFile);
                        const headerString = JSON.stringify({
                            name: this.config.name,
                            comment: this.config.description,
                            status: "unpublished",
                            scriptId: this.config.installedVersion,
                            cloudId: pxt.CLOUD_ID + appTarget.id,
                            editor: target.preferredEditor ? target.preferredEditor : (U.lookup(files, "main.blocks") ? pxt.BLOCKS_PROJECT_NAME : pxt.JAVASCRIPT_PROJECT_NAME),
                            targetVersions: pxt.appTarget.versions
                        })
                        const programText = JSON.stringify(files)
                        return lzmaCompressAsync(headerString + programText)
                            .then(buf => {
                                opts.embedMeta = JSON.stringify({
                                    compression: "LZMA",
                                    headerSize: headerString.length,
                                    textSize: programText.length,
                                    name: this.config.name,
                                    eURL: pxt.appTarget.appTheme.embedUrl,
                                    eVER: pxt.appTarget.versions ? pxt.appTarget.versions.target : "",
                                    pxtTarget: appTarget.id,
                                })
                                opts.embedBlob = btoa(U.uint8ArrayToString(buf))
                            });
                    } else {
                        return Promise.resolve()
                    }
                })
                .then(() => {
                    for (const pkg of this.sortedDeps()) {
                        for (const f of pkg.getFiles()) {
                            if (/\.(ts|asm)$/.test(f)) {
                                let sn = f
                                if (pkg.level > 0)
                                    sn = "pxt_modules/" + pkg.id + "/" + f
                                opts.sourceFiles.push(sn)
                                opts.fileSystem[sn] = pkg.readFile(f)
                            }
                        }
                    }
                    return opts;
                })
        }

        buildAsync(target: pxtc.CompileTarget) {
            return this.getCompileOptionsAsync(target)
                .then(opts => pxtc.compile(opts))
        }

        serviceAsync(op: string) {
            return this.getCompileOptionsAsync()
                .then(opts => {
                    pxtc.service.performOperation("reset", {})
                    pxtc.service.performOperation("setOpts", { options: opts })
                    return pxtc.service.performOperation(op, {})
                })
        }

        filesToBePublishedAsync(allowPrivate = false) {
            let files: Map<string> = {};

            return this.loadAsync()
                .then(() => {
                    if (!allowPrivate && !this.config.public)
                        U.userError('Only packages with "public":true can be published')
                    let cfg = U.clone(this.config)
                    delete cfg.installedVersion
                    U.iterMap(cfg.dependencies, (k, v) => {
                        if (!v || /^file:/.test(v) || /^workspace:/.test(v)) {
                            cfg.dependencies[k] = "*"
                        }
                    })
                    files[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4)
                    for (let f of this.getFiles()) {
                        let str = this.readFile(f)
                        if (str == null)
                            U.userError("referenced file missing: " + f)
                        files[f] = str
                    }

                    return U.sortObjectFields(files)
                })
        }


        computePartDefinitions(parts: string[]): pxt.Map<pxsim.PartDefinition> {
            if (!parts || !parts.length) return {};

            let res: pxt.Map<pxsim.PartDefinition> = {};
            this.sortedDeps().forEach(d => {
                let pjson = d.readFile("pxtparts.json");
                if (pjson) {
                    try {
                        let p = JSON.parse(pjson) as pxt.Map<pxsim.PartDefinition>;
                        for (let k in p) {
                            if (parts.indexOf(k) >= 0) {
                                let part = res[k] = p[k];
                                if (typeof part.visual.image === "string" && /\.svg$/i.test(part.visual.image)) {
                                    let f = d.readFile(part.visual.image);
                                    if (!f) pxt.reportError("parts", "invalid part definition", { "error": `missing visual ${part.visual.image}` })
                                    part.visual.image = `data:image/svg+xml,` + encodeURI(f);
                                }
                            }
                        }
                    } catch (e) {
                        pxt.reportError("parts", "invalid pxtparts.json file");
                    }
                }
            })
            return res;
        }

    }


    let _targetConfig: pxt.TargetConfig = undefined;
    export function targetConfigAsync(): Promise<pxt.TargetConfig> {
        return _targetConfig ? Promise.resolve(_targetConfig)
            : Cloud.privateGetAsync(`config/${pxt.appTarget.id}/targetconfig`)
                .then(js => { _targetConfig = js; return _targetConfig; });
    }
    export function packagesConfigAsync(): Promise<pxt.PackagesConfig> {
        return targetConfigAsync().then(config => config ? config.packages : undefined);
    }

    export const CONFIG_NAME = "pxt.json"
    export const CLOUD_ID = "pxt/"
    export const BLOCKS_PROJECT_NAME = "blocksprj";
    export const JAVASCRIPT_PROJECT_NAME = "tsprj";
}
