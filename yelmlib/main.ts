/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/emitter.d.ts"/>

namespace yelm {
    export interface PackageConfig {
        name: string;
        description?: string;
        dependencies: Util.StringMap<string>;
        files: string[];
    }

    export interface Package {
        _packageBrand: any;
        [s: string]: string;
    }

    export function getConfig(p: Package) {
        let cfg = <PackageConfig>JSON.parse(p["yelm.config"])
        Util.assert(typeof cfg.name == "string")
        return cfg
    }

    var pkgPrefix = "ptr-yelm-"

    function depVersionAsync(n: string, v: string) {
        if (!v || v == "*")
            return Cloud.privateGetAsync(pkgPrefix + n).then(r => {
                let id = r["scriptid"]
                if (!id)
                    throw new Error("scriptid no set on ptr for pkg " + n)
                return v;
            })
        if (/^[a-z]+$/.test(v)) {
            return Promise.resolve(v)
        }
        throw new Error("bad version spec: " + n)
    }
    
    export function buildPkgAsync(pkgs:Util.StringMap<Package>)
    {
        
    }

    export function installPkgAsync(cfg: PackageConfig) {
        let res: Util.StringMap<Package> = {}
        let versions: Util.StringMap<string> = {}

        function recAsync(cfg: PackageConfig):Promise<any> {
            return Promise.join(Object.keys(cfg.dependencies).map(n => {
                return depVersionAsync(n, cfg.dependencies[n])
                    .then(v => {
                        if (versions.hasOwnProperty(n)) {
                            if (versions[n] != v)
                                throw new Error("Version mismatch on " + n)
                        } else {
                            versions[n] = v
                            return Cloud.privateRequestAsync({ url: v + "/text" })
                                .then(resp => {
                                    let pkg = <Package>JSON.parse(resp.text)
                                    res[n] = pkg
                                    return recAsync(getConfig(pkg))
                                })
                        }
                    })
            }))
        }
        return recAsync(cfg).then(() => res)
    }


    export function publishPackage(cfg: PackageConfig) {

    }
}
