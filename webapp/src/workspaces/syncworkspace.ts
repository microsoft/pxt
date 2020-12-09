

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type File = pxt.workspace.File;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type Version = pxt.workspace.Version;
type Asset = pxt.workspace.Version;

export interface SyncWorkspaceProvider extends WorkspaceProvider {
    listSync(): Header[];
    getSync(h: Header): File;
    setSync(h: Header, prevVersion: Version, text?: ScriptText): Version;
    deleteSync?: (h: Header, prevVersion: Version) => void;
    resetSync(): void;
    loadedSync?: () => void;
    getSyncState?: () => pxt.editor.EditorSyncState;
    saveScreenshotSync?: (h: Header, screenshot: string, icon: string) => void;
    saveAssetSync?: (id: string, filename: string, data: Uint8Array) => void;
    listAssetsSync?: (id: string) => Asset[];
}

export function createCachedWorkspace(source: WorkspaceProvider) {
    // TODO @darzu: debug logging
    console.log(`createCachedWorkspace`);

    // TODO @darzu: useful?

    const provider: SyncWorkspaceProvider = {
        // sync
        listSync: (): Header[] => {
            throw "not impl";
        },
        getSync: (h: Header): File => {
            throw "not impl";
        },
        setSync: (h: Header, prevVersion: Version, text?: ScriptText): Version => {
            throw "not impl";
        },
        deleteSync: (h: Header, prevVersion: Version): void => {
            throw "not impl";
        },
        resetSync: (): void => {
            throw "not impl";
        },
        loadedSync: (): void => {
            throw "not impl";
        },
        getSyncState: (): pxt.editor.EditorSyncState => {
            throw "not impl";
        },
        saveScreenshotSync: (h: Header, screenshot: string, icon: string): void => {
            throw "not impl";
        },
        saveAssetSync: (id: string, filename: string, data: Uint8Array): void => {
            throw "not impl";
        },
        listAssetsSync: (id: string): Asset[] => {
            throw "not impl";
        },
        // async
        getAsync: (h: Header): Promise<File> => {
            throw "not impl";
        },
        setAsync: (h: Header, prevVer: any, text?: ScriptText): Promise<string> => {
            throw "not impl";
        },
        deleteAsync: (h: Header, prevVer: any): Promise<void>  => {
            throw "not impl";
        },
        listAsync: (): Promise<Header[]> => {
            throw "not impl";
        },
        resetAsync: (): Promise<void> => {
            throw "not impl";
        },
    }
    return provider;
}