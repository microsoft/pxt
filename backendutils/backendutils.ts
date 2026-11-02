/// <reference path="../pxtlib/shared/docsrender.ts"/>
/// <reference path="../pxtlib/shared/extensioninfo.ts"/>

namespace pxt {
    export interface BackendutilsVersion {
        hash: string;
        hasLocalChanges: boolean;
    }

    /**
     * Returns the Git revision and local-change status captured at build time.
     * @example pxt.backendutilsVersion() // { hash: "...", hasLocalChanges: false }
     */
    export function backendutilsVersion(): BackendutilsVersion {
        return JSON.parse("@PXT_BACKENDUTILS_VERSION@");
    }
}

(global as any).pxt = pxt;
