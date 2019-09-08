/// <reference path="../../localtypings/pxtpackage.d.ts" />

export interface MkcJson {
    targetWebsite: string;
}

export interface Cache {
    getAsync(key: string): Promise<Buffer>;
    setAsync(key: string, val: Buffer): Promise<void>;
}

export interface DownloadedEditor {
    website: string;
    pxtWorkerJs: string;
    targetJson: any;
}

export interface Project {
    config: pxt.PackageConfig;
    mkcConfig: MkcJson;
    files: pxt.Map<string>;
}