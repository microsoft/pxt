/// <reference path="../../localtypings/pxtpackage.d.ts" />

export interface MkcJson {
    targetWebsite: string;
}

export interface Cache {
    getAsync(key: string): Promise<Buffer>;
    setAsync(key: string, val: Buffer): Promise<void>;
}

export interface DownloadedEditor {
    cache: Cache;
    cdnUrl: string;
    website: string;
    pxtWorkerJs: string;
    targetJson: any;
    hwVariant?: string;
}

export interface Package {
    config: pxt.PackageConfig;
    mkcConfig: MkcJson;
    files: pxt.Map<string>;
}

export interface Workspace {
    packages: pxt.Map<Package>;
}

export let cloudRoot = "https://makecode.com/api/"
