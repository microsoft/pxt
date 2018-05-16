/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.workspace {

    export interface InstallHeader {
        name: string;
        meta: pxt.Cloud.JsonScriptMeta;
        editor: string;
        temporary?: boolean; // don't serialize project
        // older script might miss this
        target: string;
        // older scripts might miss this
        targetVersion: string;
        pubId: string; // for published scripts
        pubCurrent: boolean; // is this exactly pubId, or just based on it
    }

    export interface Header extends InstallHeader {
        _rev: string;
        id: string; // guid
        recentUse: number; // seconds since epoch
        modificationTime: number; // seconds since epoch
        blobId: string; // blob name for cloud version
        blobCurrent: boolean;      // has the current version of the script been pushed to cloud
        isDeleted: boolean;
        saveId?: any;
        // icon uri
        icon?: string;
    }

    export type ScriptText = pxt.Map<string>;

    export interface Project {
        header?: Header;
        text?: ScriptText;
    }

    export interface Asset {
        name: string;
        size: number;
        url: string;
    }

    export interface WorkspaceProvider {
        getHeaders(): Header[];
        getHeader(id: string): Header;
        getTextAsync(id: string): Promise<ScriptText>;
        initAsync(target: string, version: string): Promise<void>;
        saveAsync(h: Header, text?: ScriptText): Promise<void>;
        installAsync(h0: InstallHeader, text: ScriptText): Promise<Header>;
        saveToCloudAsync(h: Header): Promise<void>;
        syncAsync(): Promise<pxt.editor.EditorSyncState>;
        resetAsync(): Promise<void>;
        loadedAsync(): Promise<void>;
        // optional screenshot support
        saveScreenshotAsync?: (h: Header, screenshot: string, icon: string) => Promise<void>;
        // asset (large binary file) support
        saveAssetAsync?: (id: string, filename: string, data: Uint8Array) => Promise<void>;
        listAssetsAsync?: (id: string) => Promise<Asset[]>;
    }
}