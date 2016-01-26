/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/emitter.d.ts"/>

namespace yelm {
    export interface PackageConfig {
        name: string;
        description?: string;
        dependencies: Util.StringMap<string>;
    }
    
    export interface Package {
        _packageBrand:any;
        [s:string]: string;
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
    
    export function installPkgAsync(cfg: PackageConfig){
        let res:Util.StringMap<Package> = {}
        return Promise.join(Object.keys(cfg.dependencies).map(n => {
            return depVersionAsync(n, cfg.dependencies[n])
                .then(v => Cloud.privateRequestAsync({ url: v + "/text" }))
                .then(resp => {
                    let v = JSON.parse(resp.text)
                    if (typeof v["yelm.json"] == "string")
                        v["yelm.json"] = JSON.parse(v["yelm.json"])
                    res[n] = v                      
                })              
        }))
        .then(() => res)   
    }


    export function publishPackage(cfg: PackageConfig) {

    }
}
