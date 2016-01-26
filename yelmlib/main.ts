/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/emitter.d.ts"/>

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
        public isTopDep = false;

        constructor(public id: string, public verspec: string, public parent: MainPackage) {
            if (parent)
                this.host
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
                            if (<Package>this.parent == this)
                                mod.isTopDep = true;
                            return Promise.resolve()
                        } else {
                            mod = new Package(id, ver, this.parent)
                            if (<Package>this.parent == this)
                                mod.isTopDep = true;
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
        }

        installAsync() {
            return this.loadAsync(true)
        }
        
        buildAsync() {
            
        }
        
        publishAsync() {
            
        }
    }

    var pkgPrefix = "ptr-yelm-"
}
