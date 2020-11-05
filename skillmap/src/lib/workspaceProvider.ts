import { IDBWrapper } from "./indexedDBWrapper";

export interface WorkspaceProvider {
    initAsync(): Promise<void>
    getProjectAsync(headerId: string): Promise<pxt.workspace.Project>;
    saveProjectAsync(project: pxt.workspace.Project): Promise<void>;
    getUserStateAsync(): Promise<UserState>;
    saveUserStateAsync(user: UserState): Promise<void>;
}

let workspace: WorkspaceProvider;
let workspacePromise: Promise<WorkspaceProvider>;

export function getWorkspaceAsync() {
    if (!workspacePromise) {
        workspace = new IndexedDBWorkspace();
        workspacePromise = workspace.initAsync()
            .then(wp => workspace);
    }
    return workspacePromise;
}

class IndexedDBWorkspace implements WorkspaceProvider {
    static version = 6;
    static databaseName = "local-skill-map";
    static projectTable = "projects";
    static projectKey = "id";
    static userTable = "users";
    static userKey = "id";

    db: IDBWrapper;

    constructor() {
        this.db = new IDBWrapper(IndexedDBWorkspace.databaseName, IndexedDBWorkspace.version, (ev, result) => {
            const db = result.result as IDBDatabase;

            db.createObjectStore(IndexedDBWorkspace.projectTable, { keyPath: IndexedDBWorkspace.projectKey });
            db.createObjectStore(IndexedDBWorkspace.userTable, { keyPath: IndexedDBWorkspace.userKey });
        });
    }

    initAsync() {
        return this.db.openAsync();
    }


    getProjectAsync(headerId: string): Promise<pxt.workspace.Project> {
        return this.db.getAsync(IndexedDBWorkspace.projectTable, headerId)
            .then(entry => (entry as any).project);
    }

    saveProjectAsync(project: pxt.workspace.Project): Promise<void> {
        return this.db.setAsync(
            IndexedDBWorkspace.projectTable,
            {
                id: project.header!.id,
                project
            }
        );
    }

    getUserStateAsync(): Promise<UserState> {
        return this.db.getAsync(IndexedDBWorkspace.userTable, "local-user")
            .then(entry => (entry as any).user);
    }

    saveUserStateAsync(user: UserState): Promise<void> {
        return this.db.setAsync(
            IndexedDBWorkspace.userTable,
            {
                id: "local-user",
                user
            }
        );
    }
}