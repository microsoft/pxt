let _db: pxt.BrowserUtils.IDBWrapper;


interface StoredProject {
    importId: string;
    project: pxt.workspace.Project;
}

const PROJECT_TABLE = "projects";
const KEYPATH = "importId";

export async function saveProjectAsync(project: pxt.workspace.Project): Promise<string> {
    const toStore: StoredProject = {
        importId: pxt.U.guidGen(),
        project
    };

    const db = await initAsync();
    await db.deleteAllAsync(PROJECT_TABLE);
    await db.setAsync(PROJECT_TABLE, toStore);

    return toStore.importId;
}

export async function removeProjectAsync(importId: string): Promise<pxt.workspace.Project> {
    const db = await initAsync();

    const stored = await db.getAsync<StoredProject>(PROJECT_TABLE, importId);
    await db.deleteAllAsync(PROJECT_TABLE);

    return stored.project;
}

async function initAsync() {
    if (_db) {
        return _db;
    }

    const dbName = pxt.appTarget.id + "-import";
    const version = 1;
    _db = new pxt.BrowserUtils.IDBWrapper(dbName, version, (_, request) => {
        const db = request.result as IDBDatabase;
        db.createObjectStore(PROJECT_TABLE, { keyPath: KEYPATH });
    });

    await _db.openAsync();

    return _db;
}