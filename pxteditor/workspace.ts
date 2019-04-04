/// <reference path="../built/pxtlib.d.ts"/>

namespace pxt.workspace {

    export interface InstallHeader {
        name: string;
        meta: pxt.Cloud.JsonScriptMeta;
        editor: string;
        board?: string; // name of the package that contains the board.json info
        temporary?: boolean; // don't serialize project
        // older script might miss this
        target: string;
        // older scripts might miss this
        targetVersion: string;
        pubId: string; // for published scripts
        pubCurrent: boolean; // is this exactly pubId, or just based on it
        githubId?: string;
        githubCurrent?: boolean;
        // in progress tutorial if any
        tutorial?: pxt.tutorial.TutorialOptions;
        // completed tutorial info if any
        tutorialCompleted?: pxt.tutorial.TutorialCompletionInfo;
    }

    export interface Header extends InstallHeader {
        _rev: string;
        id: string; // guid
        path?: string; // for workspaces that require it
        recentUse: number; // seconds since epoch
        modificationTime: number; // seconds since epoch
        blobId: string;       // id of the cloud blob holding this script
        blobVersion: string;  // version of the cloud blob
        blobCurrent: boolean; // has the current version of the script been pushed to cloud
        isDeleted: boolean;
        saveId?: any;
        // icon uri
        icon?: string;
        backupRef?: string; // guid of backed-up project (present if an update was interrupted)
        isBackup?: boolean; // True if this is a backed-up project (for a pending update)
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

    export type Version = any;

    export interface File {
        header: Header;
        text: ScriptText;
        version: Version;
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
            id: U.guidGen(),
            recentUse: modTime,
            modificationTime: modTime,
            blobId: null,
            blobVersion: null,
            blobCurrent: false,
            isDeleted: false,
        }
        return header
    }
}