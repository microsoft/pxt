type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type File = pxt.workspace.File;
type Project = pxt.workspace.File;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type Version = pxt.workspace.Version;
type Asset = pxt.workspace.Version;

// TODO @darzu: is this the abstraction we want?
// TODO @darzu: replace memory workspace?
interface SyncWorkspaceProvider {
    listSync(): Header[];
    getSync(h: Header): File;
    setSync(h: Header, prevVersion: Version, text?: ScriptText): Version;
    deleteSync?: (h: Header, prevVersion: Version) => void;
    resetSync(): void;
}

export interface RealtimeWorkspaceProvider extends WorkspaceProvider, SyncWorkspaceProvider { }

export function createRealtimeWorkspace() {
    // TODO @darzu: debug logging
    console.log(`createRealtimeWorkspace`);

    // TODO @darzu: Project or File ??
    const projects: { [key: string]: File } = {}

    // TODO @darzu: useful?

    const syncProv: SyncWorkspaceProvider = {
        listSync: (): Header[] => {
            return Object.keys(projects).map(k => projects[k].header);
        },
        getSync: (h: Header): File => {
            return projects[h.id];
        },
        setSync: (h: Header, prevVersion: Version, text?: ScriptText): Version => {
            // TODO @darzu: don't do this if text is null? that's what memoryworkspace does... but db.Table workspace doesn't?
            projects[h.id] = {
                header: h,
                text: text,
                // TODO @darzu: version???
                version: prevVersion + "*"
            };
        },
        deleteSync: (h: Header, prevVersion: Version): void => {
            delete projects[h.id];
        },
        resetSync: (): void => {
            Object.keys(projects).forEach(k => delete projects[k])
        },
    }
    const provider: RealtimeWorkspaceProvider = {
        ...syncProv,
        getAsync: (h: Header): Promise<File> => {
            return Promise.resolve(syncProv.getSync(h))
        },
        setAsync: (h: Header, prevVer: any, text?: ScriptText): Promise<string> => {
            return Promise.resolve(syncProv.setSync(h, prevVer, text))
        },
        deleteAsync: (h: Header, prevVer: any): Promise<void>  => {
            return Promise.resolve(syncProv.deleteSync(h, prevVer))
        },
        listAsync: (): Promise<Header[]> => {
            return Promise.resolve(syncProv.listSync())
        },
        resetAsync: (): Promise<void> => {
            return Promise.resolve(syncProv.resetSync())
        },
    }
    return provider;
}