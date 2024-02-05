/// <reference path="../built/pxtlib.d.ts"/>

import { EditorSyncState } from "./editorcontroller";
import { EditorEvent } from "./events";

export type ScriptText = pxt.Map<string>;

export interface Project {
    header?: pxt.workspace.Header;
    text?: ScriptText;
}

export interface Asset {
    name: string;
    size: number;
    url: string;
}

export type Version = any;

export interface File {
    header: pxt.workspace.Header;
    text: ScriptText;
    version: Version;
}

export interface WorkspaceProvider {
    listAsync(): Promise<pxt.workspace.Header[]>; // called from workspace.syncAsync (including upon startup)
    getAsync(h: pxt.workspace.Header): Promise<File>;
    setAsync(h: pxt.workspace.Header, prevVersion: Version, text?: ScriptText): Promise<Version>;
    deleteAsync?: (h: pxt.workspace.Header, prevVersion: Version) => Promise<void>;
    resetAsync(): Promise<void>;
    loadedAsync?: () => Promise<void>;
    getSyncState?: () => EditorSyncState;

    // optional screenshot support
    saveScreenshotAsync?: (h: pxt.workspace.Header, screenshot: string, icon: string) => Promise<void>;

    // optional asset (large binary file) support
    saveAssetAsync?: (id: string, filename: string, data: Uint8Array) => Promise<void>;
    listAssetsAsync?: (id: string) => Promise<Asset[]>;

    fireEvent?: (ev: EditorEvent) => void;
}

export function freshHeader(name: string, modTime: number) {
    let header: pxt.workspace.Header = {
        target: pxt.appTarget.id,
        targetVersion: pxt.appTarget.versions.target,
        name: name,
        meta: {},
        editor: pxt.JAVASCRIPT_PROJECT_NAME,
        pubId: "",
        pubCurrent: false,
        _rev: null,
        id: pxt.U.guidGen(),
        recentUse: modTime,
        modificationTime: modTime,
        cloudUserId: null,
        cloudCurrent: false,
        cloudVersion: null,
        cloudLastSyncTime: 0,
        isDeleted: false,
    }
    return header
}