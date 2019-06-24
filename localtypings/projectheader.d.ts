declare namespace pxt.Cloud {
    export interface JsonScriptMeta {
        blocksWidth?: number;
        blocksHeight?: number;
        versions?: TargetVersions;
    }
}

declare namespace pxt.workspace {
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
}