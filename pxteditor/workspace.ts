/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.workspace {
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

    export type Version = any;

    export interface File {
        header: Header;
        text: ScriptText;
        version: Version;
    }

    export interface HistoryEntry {
        timestamp: number;
        changes: FileChange[];
    }

    export type FileChange = FileAddedChange | FileRemovedChange | FileEditedChange;

    export interface FileAddedChange {
        type: "added";
        filename: string;
        value: string;
    }

    export interface FileRemovedChange {
        type: "removed";
        filename: string;
        value: string;
    }

    export interface FileEditedChange {
        type: "edited";
        filename: string;
        forwardPatch: any;
        backwardPatch: any;
    }

    export interface WorkspaceProvider {
        listAsync(): Promise<Header[]>; // called from workspace.syncAsync (including upon startup)
        getAsync(h: Header): Promise<File>;
        setAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<Version>;
        deleteAsync?: (h: Header, prevVersion: Version) => Promise<void>;
        resetAsync(): Promise<void>;
        loadedAsync?: () => Promise<void>;
        getSyncState?: () => pxt.editor.EditorSyncState;

        // optional screenshot support
        saveScreenshotAsync?: (h: Header, screenshot: string, icon: string) => Promise<void>;

        // optional asset (large binary file) support
        saveAssetAsync?: (id: string, filename: string, data: Uint8Array) => Promise<void>;
        listAssetsAsync?: (id: string) => Promise<Asset[]>;

        fireEvent?: (ev: pxt.editor.events.Event) => void;
    }

    export function freshHeader(name: string, modTime: number) {
        let header: Header = {
            target: pxt.appTarget.id,
            targetVersion: pxt.appTarget.versions.target,
            name: name,
            meta: {},
            editor: pxt.JAVASCRIPT_PROJECT_NAME,
            pubId: "",
            pubCurrent: false,
            _rev: null,
            historyRev: null,
            id: U.guidGen(),
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
}