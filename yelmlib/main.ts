/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../emitter/driver.ts"/>

namespace yelm {
    export interface Host {
        readFileAsync(pkg: Package, filename: string): Promise<string>;
        writeFileAsync(pkg: Package, filename: string, contents: string): Promise<void>;
        downloadPackageAsync(pkg: Package): Promise<void>;
        getHexInfoAsync(): Promise<any>;
        resolveVersionAsync(pkg: Package): Promise<string>;
    }

    export interface PackageConfig {
        name: string;
        installedVersion?: string;
        description?: string;
        dependencies: Util.StringMap<string>;
        files: string[];
        testFiles?: string[];
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

        host() { return this.parent._host }

        resolveDep(id: string) {
            if (this.parent.deps.hasOwnProperty(id))
                return this.parent.deps[id];
            return null
        }

        protected saveConfigAsync() {
            let cfg = JSON.stringify(this.config, null, 4) + "\n"
            return this.host().writeFileAsync(this, configName, cfg)
        }

        private resolveVersionAsync() {
            let v = this._verspec

            if (!v || v == "*")
                return this.host().resolveVersionAsync(this).then(id => {
                    return (this.resolvedVersion = "pub:" + id);
                })
            return Promise.resolve(v)
        }

        private downloadAsync() {
            let yelmCfg = ""
            return this.resolveVersionAsync()
                .then(verNo => {
                    if (this.config && this.config.installedVersion == verNo)
                        return
                    return this.host().downloadPackageAsync(this)
                        .then(() => this.host().readFileAsync(this, configName))
                        .then(confStr => {
                            if (!confStr)
                                Util.userError(`package ${this.id} is missing ${configName}`)
                            this.parseConfig(confStr)
                            this.config.installedVersion = this.version()
                            return this.saveConfigAsync()
                        })
                        .then(() => {
                            info(`installed ${this.id} /${verNo}`)
                        })

                })
        }

        protected validateConfig() {
            if (!this.config.dependencies)
                Util.userError("Missing dependencies in config of: " + this.id)
            if (!Array.isArray(this.config.files))
                Util.userError("Missing files in config of: " + this.id)
            if (typeof this.config.name != "string" || !/^[a-z][a-z0-9\-]+$/.test(this.config.name))
                Util.userError("Invalid package name: " + this.config.name)
        }

        private parseConfig(str: string) {
            let cfg = <PackageConfig>JSON.parse(str)
            this.config = cfg;
            this.validateConfig();
        }

        loadAsync(isInstall = false): Promise<void> {
            if (this.isLoaded) return Promise.resolve();
            this.isLoaded = true
            return this.host().readFileAsync(this, configName)
                .then(str => {
                    if (str == null) {
                        if (!isInstall)
                            Util.userError("Package not installed: " + this.id)
                    } else {
                        this.parseConfig(str)
                    }
                    if (isInstall)
                        return this.downloadAsync()
                    else return null
                })
                .then(() =>
                    Util.mapStringMapAsync(this.config.dependencies, (id, ver) => {
                        let mod = this.resolveDep(id)
                        ver = ver || "*"
                        if (mod) {
                            if (mod._verspec != ver)
                                Util.userError("Version spec mismatch on " + id)
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
    }

    export class MainPackage
        extends Package {
        public deps: Util.StringMap<Package> = {};

        constructor(public _host: Host) {
            super("this", "file:.", null)
            this.parent = this
            this.level = 0
            this.deps[this.id] = this;
        }

        installAllAsync() {
            return this.loadAsync(true)
        }

        installPkgAsync(name: string) {
            return Cloud.privateGetAsync(pkgPrefix + name)
                .then(ptrinfo => {
                    this.config.dependencies[name] = "*"
                })
                .then(() => this.installAllAsync())
                .then(() => this.saveConfigAsync())
        }

        sortedDeps() {
            let ids: string[] = []
            let rec = (p: Package) => {
                if (ids.indexOf(p.id) >= 0) return;
                ids.push(p.id)
                Object.keys(p.config.dependencies).forEach(id => rec(this.resolveDep(id)))
            }
            rec(this)
            return ids.map(id => this.resolveDep(id))
        }

        buildAsync() {
            let opts: ts.mbit.CompileOptions = {
                sourceFiles: [],
                fileSystem: {},
                hexinfo: {}
            }

            return this.loadAsync()
                .then(() => {
                    info(`building: ${this.sortedDeps().map(p => p.config.name).join(", ")}`)
                    return this.host().getHexInfoAsync()
                        .then(inf => opts.hexinfo = inf)
                })
                .then(() => Promise.all(Util.concat(this.sortedDeps()
                    .map(pkg =>
                        pkg.getFiles().map(f => {
                            if (/\.ts$/.test(f)) {
                                let sn = f
                                if (pkg.level > 0)
                                    sn = "yelm_modules/" + pkg.id + "/" + f
                                opts.sourceFiles.push(sn)
                                return this.host().readFileAsync(pkg, f)
                                    .then(str => {
                                        opts.fileSystem[sn] = str
                                    })
                            } else return Promise.resolve()
                        }))))
                    .then(() => {
                        return ts.mbit.compile(opts)
                    }))
        }

        initAsync(name: string) {
            return this.host().readFileAsync(this, configName)
                .then(str => {
                    if (str)
                        Util.userError("config already present")

                    this.config = {
                        name: name,
                        description: "",
                        installedVersion: "",
                        files: Object.keys(defaultFiles).filter(s => !/test/.test(s)),
                        testFiles: Object.keys(defaultFiles).filter(s => /test/.test(s)),
                        dependencies: {
                            "mbit": "*"
                        }
                    }
                    this.validateConfig();
                    return this.saveConfigAsync()
                })
                .then(() => Util.mapStringMapAsync(defaultFiles, (k, v) =>
                    this.host().writeFileAsync(this, k, v.replace(/@NAME@/g, name))))
                .then(() => {
                    info("package initialized")
                })
        }

        publishAsync() {
            let files: Util.StringMap<string> = {};
            let text: string;
            let scrInfo: { id: string; } = null;

            return this.loadAsync()
                .then(() => {
                    let cfg = Util.clone(this.config)
                    delete cfg.installedVersion
                    Util.iterStringMap(cfg.dependencies, (k, v) => {
                        if (v != "*" && !/^pub:/.test(v)) {
                            cfg.dependencies[k] = "*"
                            if (v)
                                info(`local dependency '${v}' replaced with '*' in published package`)
                        }
                    })
                    files[configName] = JSON.stringify(cfg, null, 4)
                })
                .then(() => Promise.all(
                    this.getFiles().map(f =>
                        this.host().readFileAsync(this, f)
                            .then(str => {
                                if (str == null)
                                    Util.userError("referenced file missing: " + f)
                                files[f] = str
                            }))))
                .then(() => {
                    text = JSON.stringify(Util.sortObjectFields(files), null, 2)
                    let hash = Util.sha256(text).substr(0, 32)
                    info(`checking for pre-existing script at ${hash}`)
                    return Cloud.privateGetAsync("scripthash/" + hash)
                        .then(resp => {
                            if (resp.items && resp.items[0])
                                return resp.items[0]
                            else return null
                        })
                })
                .then(sinfo => {
                    scrInfo = sinfo;
                    if (scrInfo) {
                        info(`found existing script at /${scrInfo.id}`)
                        return Promise.resolve();
                    }
                    let scrReq = {
                        baseid: "",
                        name: this.config.name,
                        description: this.config.description || "",
                        islibrary: true,
                        ishidden: false,
                        userplatform: ["yelm"],
                        editor: "tsprj",
                        text: text
                    }
                    info(`publishing script; ${text.length} bytes`)
                    return Cloud.privatePostAsync("scripts", scrReq)
                        .then(inf => {
                            scrInfo = inf
                            info(`published; id /${scrInfo.id}`)
                        })
                })
                .then(() => Cloud.privateGetAsync(pkgPrefix + this.config.name)
                    .then(res => res.scriptid == scrInfo.id, e => false))
                .then(alreadySet => {
                    if (alreadySet) {
                        info(`package already published`)
                        return
                    }
                    return Cloud.privatePostAsync("pointers", {
                        path: pkgPrefix.replace(/^ptr-/, "").replace(/-$/, "") + "/" + this.config.name,
                        scriptid: scrInfo.id
                    }).then(() => {
                        info(`package published`)
                    })
                })
                .then(() => {
                    if (this.config.installedVersion != scrInfo.id) {
                        this.config.installedVersion = scrInfo.id
                        return this.saveConfigAsync();
                    } else return null
                })
        }
    }

    export var pkgPrefix = "ptr-yelm-"
    export var configName = "yelm.json"
    var info = function info(msg: string) {
        console.log(msg)
    }

    var defaultFiles: Util.StringMap<string> = {
        "README.md":
        `# @NAME@

Put some info here.
`,
        "tsconfig.json":
        `{
    "compilerOptions": {
        "target": "es5",
        "noImplicitAny": true,
        "outDir": "built",
        "rootDir": "."
    }
}
`,
        "main.ts":
        `basic.showString("Hello world!")
`,
        "tests.ts":
        `// Put your testing code in this file. 
// It will not be compiled when compiling as a library (dependency of another module).
`,
        ".gitignore":
        `built
node_modules
yelm_modules
`
    }
}
