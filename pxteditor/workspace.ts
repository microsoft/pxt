/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.workspace {

    export interface InstallHeader {
        name: string;
        meta: pxt.Cloud.JsonScriptMeta;
        editor: string;
        // older script might miss this
        target: string;
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

    export interface WorkspaceProvider {
        getHeaders(): Header[];
        getHeader(id: string): Header;
        getTextAsync(id: string): Promise<ScriptText>;
        initAsync(target: string): Promise<void>;
        saveAsync(h: Header, text?: ScriptText): Promise<void>;
        installAsync(h0: InstallHeader, text: ScriptText): Promise<Header>;
        saveToCloudAsync(h: Header): Promise<void>;
        syncAsync(): Promise<void>;
        resetAsync(): Promise<void>;
        // optional screenshot support
        saveScreenshotAsync?: (h: Header, screenshot: string, icon: string) => Promise<void>;
    }
}