/**
 * A workspace implementation that uses IndexedDB directly (bypassing PouchDB), to support WKWebview where PouchDB
 * doesn't work.
 */

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

interface StoredText {
    id: string;
    files: pxt.Map<string>;
    _rev: string;
};

const TEXTS_TABLE = "texts";
const HEADERS_TABLE = "headers";
const KEYPATH = "id";

let _db: pxt.BrowserUtils.IDBWrapper;

function getDbAsync(): Promise<pxt.BrowserUtils.IDBWrapper> {
    if (_db) {
        return Promise.resolve(_db);
    }

    _db = new pxt.BrowserUtils.IDBWrapper("__pxt_idb_workspace", 1, (ev, r) => {
        const db = r.result as IDBDatabase;
        db.createObjectStore(TEXTS_TABLE, { keyPath: KEYPATH });
        db.createObjectStore(HEADERS_TABLE, { keyPath: KEYPATH });
    });

    return _db.openAsync()
        .catch((e) => {
            pxt.reportException(e);
            return Promise.reject(e);
        })
        .then(() => _db);
}

function listAsync(): Promise<pxt.workspace.Header[]> {
    return getDbAsync()
        .then((db) => {
            return db.getAllAsync<pxt.workspace.Header>(HEADERS_TABLE);
        });
}

function getAsync(h: Header): Promise<pxt.workspace.File> {
    return getDbAsync()
        .then((db) => {
            return db.getAsync<StoredText>(TEXTS_TABLE, h.id);
        })
        .then((res) => {
            return Promise.resolve({
                header: h,
                text: res.files,
                version: res._rev
            });
        });
}

function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<pxt.workspace.Version> {
    return getDbAsync()
        .then((db) => {
            const dataToStore: StoredText = {
                id: h.id,
                files: text,
                _rev: prevVer
            };
            return (text ? db.setAsync(TEXTS_TABLE, dataToStore) : Promise.resolve())
                .then(() => {
                    return db.setAsync(HEADERS_TABLE, h);
                });
        });
}

function deleteAsync(h: Header, prevVer: any): Promise<void> {
    return getDbAsync()
        .then((db) => {
            return db.deleteAsync(TEXTS_TABLE, h.id)
                .then(() => {
                    return db.deleteAsync(HEADERS_TABLE, h.id);
                });
        });
}

function resetAsync(): Promise<void> {
    return getDbAsync()
        .then((db) => {
            return db.deleteAllAsync(TEXTS_TABLE)
                .then(() => {
                    return db.deleteAllAsync(HEADERS_TABLE);
                });
        });
}

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
}