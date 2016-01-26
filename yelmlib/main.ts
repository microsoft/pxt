/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../emitter/driver.ts"/>

namespace yelm {
    export interface Host {
        readFileAsync(module: string, filename: string): Promise<string>;
        writeFileAsync(module: string, filename: string, contents: string): Promise<void>;
    }

    export interface PackageConfig {
        name: string;
        installedVersion?: string;
        description?: string;
        dependencies: Util.StringMap<string>;
        files: string[];
    }

    export class Package {
        public config: PackageConfig;
        public level = -1;
        public isLoaded = false;

        constructor(public id: string, public verspec: string, public parent: MainPackage) {
            if (parent) {
                this.level = this.parent.level + 1
            }
        }

        host() { return this.parent._host }

        resolveDep(id: string) {
            if (this.parent.deps.hasOwnProperty(id))
                return this.parent.deps[id];
            return null
        }

        private resolveVersionAsync() {
            let v = this.verspec

            if (!v || v == "*")
                return Cloud.privateGetAsync(pkgPrefix + this.id).then(r => {
                    let id = r["scriptid"]
                    if (!id)
                        throw new Error("scriptid no set on ptr for pkg " + this.id)
                    return v;
                })
            if (/^[a-z]+$/.test(v)) {
                return Promise.resolve(v)
            }
            throw new Error("bad version spec: " + this.id)
        }

        private downloadAsync() {
            let verNo = ""
            let yelmCfg = ""
            return this.resolveVersionAsync()
                .then(v => { verNo = v })
                .then(() => Cloud.privateRequestAsync({ url: verNo + "/text" }))
                .then(resp => Promise.join(
                    Util.mapStringMap(resp.json, (fn: string, cont: string) => {
                        if (fn == "yelm.config") {
                            this.parseConfig(cont)
                            this.config.installedVersion = verNo
                            cont = JSON.stringify(cont, null, 4)
                        }
                        return this.host().writeFileAsync(this.id, fn, cont)
                    })))
                .then(() => { })
        }

        private parseConfig(str: string) {
            let cfg = <PackageConfig>JSON.parse(str)
            Util.assert(typeof cfg.name == "string")
            this.config = cfg
        }

        loadAsync(isInstall: boolean = false): Promise<void> {
            if (this.isLoaded) return Promise.resolve();
            this.isLoaded = true
            return this.host().readFileAsync(this.id, "yelm.config")
                .then(str => {
                    if (str == null) {
                        if (isInstall)
                            return this.downloadAsync()
                        else
                            throw new Error("Packge not installed: " + this.id)
                    } else {
                        this.parseConfig(str)
                    }
                })
                .then(() =>
                    Promise.join(Util.mapStringMap(this.config.dependencies, (id, ver) => {
                        let mod = this.resolveDep(id)
                        ver = ver || "*"
                        if (mod) {
                            if (mod.verspec != ver)
                                throw new Error("Version spec mismatch on " + id)
                            mod.level = Math.min(mod.level, this.level + 1)
                            return Promise.resolve()
                        } else {
                            mod = new Package(id, ver, this.parent)
                            this.parent.deps[id] = mod
                            return mod.loadAsync(isInstall)
                        }
                    })))
                .then(() => { })
        }

    }

    export class MainPackage
        extends Package {
        public deps: Util.StringMap<Package> = {};

        constructor(public _host: Host) {
            super("this", "*", null)
            this.parent = this
            this.deps[this.id] = this;
        }

        installAsync() {
            return this.loadAsync(true)
        }

        sortedDeps() {
            let ids: string[] = []
            let rec = (p: Package) => {
                if (ids.indexOf(p.id) >= 0) return;
                ids.push(p.id)
                Object.keys(p.config.dependencies).forEach(id => rec(this.resolveDep(id)))
            }
            return ids.map(id => this.resolveDep(id))
        }

        buildAsync() {
            let opts: ts.mbit.CompileOptions = {
                sourceFiles: [],
                fileSystem: {},
                hexinfo: {}
            }

            return this.loadAsync()
                .then(() => Promise.join(Util.concat(this.sortedDeps()
                    .map(pkg =>
                        pkg.config.files.map(f => {
                            if (/\.ts$/.test(f)) {
                                let sn = f
                                if (pkg.level > 0)
                                    sn = "modules/" + pkg.id + "/" + f
                                opts.sourceFiles.push(sn)
                                return this.host().readFileAsync(pkg.id, f)
                                    .then(str => {
                                        opts.fileSystem[sn] = str
                                    })
                            } else return Promise.resolve()
                        }))))
                    .then(() => {
                        return ts.mbit.compile(opts)
                    })
                )
        }

        publishAsync() {

        }
    }

    var pkgPrefix = "ptr-yelm-"
}
