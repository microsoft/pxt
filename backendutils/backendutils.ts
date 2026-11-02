/// <reference path="../pxtlib/shared/docsrender.ts"/>
/// <reference path="../pxtlib/shared/extensioninfo.ts"/>

namespace pxt {
    export interface BackendutilsVersion {
        hash: string;
        hasLocalChanges: boolean;
    }

    /**
     * The git revision information is injected into this function at build time.
     * See backendutils in gulpfile.js
     */
    export function backendutilsVersion(): BackendutilsVersion {
        return JSON.parse("@PXT_BACKENDUTILS_VERSION@");
    }
}

(global as any).pxt = pxt;
