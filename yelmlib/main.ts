/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/emitter.d.ts"/>

namespace yelm {
    export interface PackageConfig {
        name: string;
        description?: string;
        dependencies: Util.StringMap<string>;
    }
    
    export function publishPackage(cfg: PackageConfig) {

    }
}
