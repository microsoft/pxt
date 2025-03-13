/**
 * A workspace implementation that uses IndexedDB directly (bypassing PouchDB), to support WKWebview where PouchDB
 * doesn't work.
 */
import * as browserworkspace from "./browserworkspace"

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

// This function migrates existing projectes in pouchDb to indexDb
// From browserworkspace to idbworkspace
async function migrateBrowserWorkspaceAsync(): Promise<void> {
    const db = await getDbAsync();
    const allDbHeaders = await db.getAllAsync<pxt.workspace.Header>(HEADERS_TABLE);
    if (allDbHeaders.length) {
        // There are already scripts using the idbworkspace, so a migration has already happened
        return;
    }

    const copyProject = async (h: pxt.workspace.Header): Promise<void> => {
        const resp = await browserworkspace.provider.getAsync(h);

        // Ignore metadata of the previous script so they get re-generated for the new copy
        delete (resp as any)._id;
        delete (resp as any)._rev;

        await setAsync(h, undefined, resp.text);
    };

    const previousHeaders = await browserworkspace.provider.listAsync();

    await Promise.all(previousHeaders.map(h => copyProject(h)));
}

let _dbPromise: Promise<pxt.BrowserUtils.IDBWrapper>;
async function getDbAsync(): Promise<pxt.BrowserUtils.IDBWrapper> {
    if (_dbPromise) {
        return await _dbPromise;
    }

    _dbPromise = createDbAsync();

    return _dbPromise;

    async function createDbAsync(): Promise<pxt.BrowserUtils.IDBWrapper> {
        const idbDb = new pxt.BrowserUtils.IDBWrapper("__pxt_idb_workspace", 1, (ev, r) => {
            const db = r.result as IDBDatabase;
            db.createObjectStore(TEXTS_TABLE, { keyPath: KEYPATH });
            db.createObjectStore(HEADERS_TABLE, { keyPath: KEYPATH });
        }, async () => {
            await pxt.BrowserUtils.clearTranslationDbAsync();
            await pxt.BrowserUtils.clearTutorialInfoDbAsync();
        });

        try {
            await idbDb.openAsync();
        } catch (e) {
            pxt.reportException(e);
            return Promise.reject(e);
        }

        return idbDb;
    }
}

async function listAsync(): Promise<pxt.workspace.Header[]> {
    await migrateBrowserWorkspaceAsync();
    const db = await getDbAsync();
    return db.getAllAsync<pxt.workspace.Header>(HEADERS_TABLE);
}

async function getAsync(h: Header): Promise<pxt.workspace.File> {
    const db = await getDbAsync();
    const res = await db.getAsync<StoredText>(TEXTS_TABLE, h.id);
    if (!res) return undefined;
    return {
        header: h,
        text: res.files,
        version: res._rev
    };
}

async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<void> {
    const db = await getDbAsync();

    try {
        await setCoreAsync(db, h, prevVer, text);
    } catch (e) {
        if (e.status == 409) {
            // conflict while writing key, ignore.
            pxt.debug(`idb: set conflict (409)`);
            return;
        }

        pxt.reportException(e);
        pxt.log(`idb: set failed, cleaning cache dbs`);

        // clean up cache dbs and try again
        await pxt.BrowserUtils.clearTranslationDbAsync();
        await pxt.BrowserUtils.clearTutorialInfoDbAsync();

        try {
            await setCoreAsync(db, h, prevVer, text);
        } catch (e) {
            pxt.reportException(e, {
                ws: "idb",
            });
            pxt.log(`idb: we are out of space...`);
            throw e;
        }
    }

    async function setCoreAsync(db: pxt.BrowserUtils.IDBWrapper, h: Header, prevVer: any, text?: ScriptText): Promise<void> {
        const dataToStore: StoredText = {
            id: h.id,
            files: text,
            _rev: prevVer
        };

        if (text) {
            await db.setAsync(TEXTS_TABLE, dataToStore);
        }

        await db.setAsync(HEADERS_TABLE, h);
    }
}


async function deleteAsync(h: Header, prevVer: any): Promise<void> {
    const db = await getDbAsync();
    await db.deleteAsync(TEXTS_TABLE, h.id);
    await db.deleteAsync(HEADERS_TABLE, h.id);
}

async function resetAsync(): Promise<void> {
    const db = await getDbAsync();
    await db.deleteAllAsync(TEXTS_TABLE);
    await db.deleteAllAsync(HEADERS_TABLE);
}

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
}