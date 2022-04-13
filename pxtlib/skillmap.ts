namespace pxt.skillmap {
    export type ScriptText = pxt.Map<string>;

    export interface Project {
        header?: pxt.workspace.Header;
        text?: ScriptText;
        deleted?: boolean;
    }

    export interface WorkspaceProvider<U> {
        initAsync(): Promise<void>
        getProjectAsync(headerId: string): Promise<Project>;
        saveProjectAsync(project: Project): Promise<void>;
        getUserStateAsync(): Promise<U | undefined>;
        saveUserStateAsync(user: U): Promise<void>;
    }

    export const USER_VERSION = "0.0.1"

    export class IndexedDBWorkspace<U> implements WorkspaceProvider<U> {
        static version = 6;
        static databaseName = "local-skill-map";
        static projectTable = "projects";
        static projectKey = "id";
        static userTable = "users";
        static userKey = "id";

        db: BrowserUtils.IDBWrapper;

        constructor() {
            this.db = new BrowserUtils.IDBWrapper(IndexedDBWorkspace.databaseName, IndexedDBWorkspace.version, (ev, result) => {
                const db = result.result as IDBDatabase;

                if (ev.oldVersion < 1) {
                    db.createObjectStore(IndexedDBWorkspace.projectTable, { keyPath: IndexedDBWorkspace.projectKey });
                    db.createObjectStore(IndexedDBWorkspace.userTable, { keyPath: IndexedDBWorkspace.userKey });
                }
            });
        }

        initAsync() {
            return this.db.openAsync();
        }

        getAllProjectsAsync(): Promise<Project[]> {
            return this.db.getAllAsync<{id: string, project: Project}>(IndexedDBWorkspace.projectTable)
                .then(entries => entries.map(e => e.project).filter(e => !e.deleted));
        }

        deleteProjectAsync(headerId: string) {
            return this.getProjectAsync(headerId)
                .then(project => {
                    project.deleted = true;
                    this.saveProjectAsync(project);
                });
        }


        getProjectAsync(headerId: string): Promise<Project> {
            return this.db.getAsync(IndexedDBWorkspace.projectTable, headerId)
                .then(entry => (entry as any)?.project);
        }

        saveProjectAsync(project: Project): Promise<void> {
            return this.db.setAsync(
                IndexedDBWorkspace.projectTable,
                {
                    id: project.header!.id,
                    project
                }
            );
        }

        getUserStateAsync(): Promise<U | undefined> {
            return this.db.getAsync(IndexedDBWorkspace.userTable, "local-user")
                .then(entry => (entry as any)?.user);
        }

        saveUserStateAsync(user: U): Promise<void> {
            return this.db.setAsync(
                IndexedDBWorkspace.userTable,
                {
                    id: "local-user",
                    user
                }
            );
        }
    }
}