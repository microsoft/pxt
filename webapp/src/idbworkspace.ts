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
export const SCRIPT_TABLE = "script";
export const GITHUB_TABLE = "github";
export const HOSTCACHE_TABLE = "hostcache";

let _migrationPromise: Promise<void>;
async function performMigrationsAsync() {
    if (!_migrationPromise) {
        _migrationPromise = (async () => {
            try {
                await migratePouchAsync();
            }
            catch (e) {
                pxt.reportException(e);
                pxt.log("Unable to migrate pouchDB")
            }

            try {
                await migrateOldIndexedDbAsync();
            }
            catch (e) {
                pxt.reportException(e);
                pxt.log("Unable to migrate old indexed db format")
            }

            try {
                await migratePrefixesAsync();
            }
            catch (e) {
                pxt.reportException(e);
                pxt.log("Unable to migrate projects from other prefixes");
            }
        })();
    }

    return _migrationPromise;
}

const POUCH_OBJECT_STORE = "by-sequence";
const POUCH_DB_VERSION = 5;

async function checkIfPouchDbExistsAsync() {
    // Unfortunately, there is no simple cross-browser way to check
    // if an indexedDb already exists. This works by requesting the
    // db with a version lower than the current version. If it
    // throws an exception, then the db must already exist with the
    // higher version. If it tries to upgrade, then the db doesn't
    // exist. We abort the transaction to avoid poisoning pouchdb
    // if anyone ever visits an old version of the editor.
    let result = true;
    try {
        const db = new pxt.BrowserUtils.IDBWrapper("_pouch_pxt-" + pxt.storage.storageId(), 1, (e, r) => {
            result = false;
            r.transaction.abort();
        }, null, true);
        await db.openAsync();
    }
    catch (e) {
        // This will always throw an exception
    }

    return result;
}

interface MigrationEntry {
    prefix?: string;
    table: string;
    id: string;
    rev: number;
    entry: any;
}

async function migratePouchAsync() {
    if (!await checkIfPouchDbExistsAsync()) return;

    const oldDb = new pxt.BrowserUtils.IDBWrapper("_pouch_pxt-" + pxt.storage.storageId(), POUCH_DB_VERSION, () => {});
    await oldDb.openAsync();

    const entries = await oldDb.getAllAsync<any>(POUCH_OBJECT_STORE);
    const alreadyMigratedList = await getMigrationDbAsync();

    const toMigrate: MigrationEntry[] = [];

    for (const entry of entries) {
        // format is (prefix-)?tableName--id::rev-guid
        const docId: string = entry._doc_id_rev;

        const revSeparatorIndex = docId.lastIndexOf("::");
        const rev = parseInt(docId.substring(revSeparatorIndex + 2).split("-")[0]);

        const tableSeparatorIndex = docId.indexOf("--");
        let table = docId.substring(0, tableSeparatorIndex);

        const id = docId.substring(tableSeparatorIndex + 2, revSeparatorIndex);

        let prefix: string;
        let prefixSeparatorIndex = table.indexOf("-")
        if (prefixSeparatorIndex !== -1) {
            prefix = table.substring(0, prefixSeparatorIndex);
            table = table.substring(prefixSeparatorIndex + 1);
        }

        pxtc.assert(id === entry.id, "ID mismatch!");

        switch (table) {
            case "header":
                table = HEADERS_TABLE;
                break;
            case "text":
                table = TEXTS_TABLE;
                break;
            case "script":
                table = SCRIPT_TABLE;
                prefix = prefix || getCurrentDBPrefix();
                break;
            case "github":
                table = GITHUB_TABLE;
                prefix = prefix || getCurrentDBPrefix();
                break;
            case "hostcache":
                table = HOSTCACHE_TABLE;
                prefix = prefix || getCurrentDBPrefix();
                break;
            default:
                console.warn("Unknown database table " + table);
                continue;
        }

        if (await alreadyMigratedList.getAsync(table, migrationDbKey(prefix, id))) {
            continue;
        }

        // PouchDB sometimes keeps around multiple entries for the same doc. Favor
        // the one with the highest revision number
        const existing = toMigrate.find(
            m => m.id === id && m.prefix === prefix && m.table === table
        );
        if (existing) {
            if (existing.rev < rev) {
                existing.rev = rev;
                existing.entry = entry;
            }
            continue;
        }

        toMigrate.push({
            id,
            table,
            prefix,
            rev,
            entry,
        });
    }

    for (const m of toMigrate) {
        const { prefix, table, id, entry } = m;

        await alreadyMigratedList.setAsync(table, { id: migrationDbKey(prefix, id) });

        const db = await getDbAsync(prefix)
        const existing = await db.getAsync(table, id);

        if (!existing) {
            delete entry._doc_id_rev
            await db.setAsync(table, entry);
        }
    }
}

async function migrateOldIndexedDbAsync() {
    const legacyDb = new pxt.BrowserUtils.IDBWrapper(`__pxt_idb_workspace`, 1, (ev, r) => {
        const db = r.result as IDBDatabase;
        db.createObjectStore(TEXTS_TABLE, { keyPath: KEYPATH });
        db.createObjectStore(HEADERS_TABLE, { keyPath: KEYPATH });
    }, async () => {
        await pxt.BrowserUtils.clearTranslationDbAsync();
        await pxt.BrowserUtils.clearTutorialInfoDbAsync();
    });

    try {
        await legacyDb.openAsync();
        const currentDb = await getCurrentDbAsync();

        await copyTableEntriesAsync(legacyDb, currentDb, HEADERS_TABLE, true);
        await copyTableEntriesAsync(legacyDb, currentDb, TEXTS_TABLE, true);
    } catch (e) {
        pxt.reportException(e);
    }
}

async function migratePrefixesAsync() {
    if (!getCurrentDBPrefix()) return;

    const currentVersion = pxt.semver.parse(pxt.appTarget.versions.target);
    const currentMajor = currentVersion.major;
    const previousMajor = currentMajor - 1;
    const previousDbPrefix = previousMajor < 0 ? "" : pxt.appTarget.appTheme.browserDbPrefixes[previousMajor];
    const currentDb = await getCurrentDbAsync();

    // If headers are already in the new db, migration must have already happened
    if ((await currentDb.getAllAsync(HEADERS_TABLE)).length) return;

    const prevDb = await getDbAsync(previousDbPrefix);

    await copyTableEntriesAsync(prevDb, currentDb, HEADERS_TABLE, false);
    await copyTableEntriesAsync(prevDb, currentDb, TEXTS_TABLE, false);
    await copyTableEntriesAsync(prevDb, currentDb, SCRIPT_TABLE, false);
    await copyTableEntriesAsync(prevDb, currentDb, HOSTCACHE_TABLE, false);
    await copyTableEntriesAsync(prevDb, currentDb, GITHUB_TABLE, false);
}

let _dbPromises: pxt.Map<Promise<pxt.BrowserUtils.IDBWrapper>> = {};

async function getDbAsync(prefix = "__default") {
    if (_dbPromises[prefix]) return _dbPromises[prefix];

    _dbPromises[prefix] = createDbAsync();

    return _dbPromises[prefix];

    async function createDbAsync(): Promise<pxt.BrowserUtils.IDBWrapper> {
        const idbDb = new pxt.BrowserUtils.IDBWrapper(`__pxt_idb_workspace_${pxt.storage.storageId()}_${prefix}`, 1, (ev, r) => {
            const db = r.result as IDBDatabase;
            db.createObjectStore(TEXTS_TABLE, { keyPath: KEYPATH });
            db.createObjectStore(HEADERS_TABLE, { keyPath: KEYPATH });
            db.createObjectStore(SCRIPT_TABLE, { keyPath: KEYPATH });
            db.createObjectStore(HOSTCACHE_TABLE, { keyPath: KEYPATH });
            db.createObjectStore(GITHUB_TABLE, { keyPath: KEYPATH });
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

async function copyTableEntriesAsync(fromDb: pxt.BrowserUtils.IDBWrapper, toDb: pxt.BrowserUtils.IDBWrapper, storeName: string, dontOverwrite: boolean) {
    for (const entry of await fromDb.getAllAsync<any>(storeName)) {
        const existing = dontOverwrite && !!(await toDb.getAsync(storeName, entry.id));

        if (!existing) {
            await toDb.setAsync(storeName, entry);
        }
    }
}

async function getCurrentDbAsync(): Promise<pxt.BrowserUtils.IDBWrapper> {
    return getDbAsync(getCurrentDBPrefix());
}

function getCurrentDBPrefix() {
    if (!pxt.appTarget.appTheme.browserDbPrefixes) return undefined;

    const currentVersion = pxt.semver.parse(pxt.appTarget.versions.target);
    const currentMajor = currentVersion.major;
    return pxt.appTarget.appTheme.browserDbPrefixes[currentMajor];
}

async function listAsync(): Promise<pxt.workspace.Header[]> {
    await performMigrationsAsync();
    const db = await getCurrentDbAsync();
    return db.getAllAsync<pxt.workspace.Header>(HEADERS_TABLE);
}

async function getAsync(h: Header): Promise<pxt.workspace.File> {
    const db = await getCurrentDbAsync();
    const res = await db.getAsync<StoredText>(TEXTS_TABLE, h.id);
    if (!res) return undefined;
    return {
        header: h,
        text: res.files,
        version: res._rev
    };
}

async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<void> {
    const db = await getCurrentDbAsync();

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
    const db = await getCurrentDbAsync();
    await db.deleteAsync(TEXTS_TABLE, h.id);
    await db.deleteAsync(HEADERS_TABLE, h.id);
}

async function resetAsync(): Promise<void> {
    const db = await getCurrentDbAsync();
    await db.deleteAllAsync(TEXTS_TABLE);
    await db.deleteAllAsync(HEADERS_TABLE);
}

export async function getObjectStoreAsync<T>(storeName: string) {
    const db = await getCurrentDbAsync();
    return db.getObjectStoreWrapper<T>(storeName);
}

export async function copyProjectToLegacyEditorAsync(header: Header, script: pxt.workspace.ScriptText, majorVersion: number): Promise<void> {
    const prefix = pxt.appTarget.appTheme.browserDbPrefixes && pxt.appTarget.appTheme.browserDbPrefixes[majorVersion];

    const oldDB = await getDbAsync(prefix);

    await oldDB.setAsync(HEADERS_TABLE, header);
    await oldDB.setAsync(TEXTS_TABLE, {
        id: header.id,
        files: script,
        _rev: null
    } as StoredText);
}

async function getMigrationDbAsync() {
    const idbDb = new pxt.BrowserUtils.IDBWrapper(`__pxt_idb_migration_${pxt.storage.storageId()}`, 1, (ev, r) => {
        const db = r.result as IDBDatabase;
        db.createObjectStore(TEXTS_TABLE, { keyPath: KEYPATH });
        db.createObjectStore(HEADERS_TABLE, { keyPath: KEYPATH });
        db.createObjectStore(SCRIPT_TABLE, { keyPath: KEYPATH });
        db.createObjectStore(HOSTCACHE_TABLE, { keyPath: KEYPATH });
        db.createObjectStore(GITHUB_TABLE, { keyPath: KEYPATH });
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

export function initGitHubDb() {
    class GithubDb implements pxt.github.IGithubDb {
        // in memory cache
        private mem = new pxt.github.MemoryGithubDb();

        latestVersionAsync(repopath: string, config: pxt.PackagesConfig): Promise<string> {
            return this.mem.latestVersionAsync(repopath, config)
        }

        async loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig> {
            // don't cache master
            if (tag == "master")
                return this.mem.loadConfigAsync(repopath, tag);

            const id = `config-${repopath.toLowerCase()}-${tag}`;

            const cache = await getGitHubCacheAsync();

            try {
                const entry = await cache.getAsync(id);
                return entry.config;
            }
            catch (e) {
                pxt.debug(`github offline cache miss ${id}`);
                const config = await this.mem.loadConfigAsync(repopath, tag);

                try {
                    await cache.setAsync({
                        id,
                        config
                    })
                }
                catch (e) {
                }

                return config;
            }
        }

        async loadPackageAsync(repopath: string, tag: string): Promise<pxt.github.CachedPackage> {
            if (!tag) {
              pxt.debug(`dep: default to master`)
              tag = "master"
            }
            // don't cache master
            if (tag == "master")
                return this.mem.loadPackageAsync(repopath, tag);

            const id = `pkg-${repopath.toLowerCase()}-${tag}`;
            const cache = await getGitHubCacheAsync();

            try {
                const entry = await cache.getAsync(id);
                pxt.debug(`github offline cache hit ${id}`);
                return entry.package;
            }
            catch (e) {
                pxt.debug(`github offline cache miss ${id}`);
                const p = await this.mem.loadPackageAsync(repopath, tag);

                try {
                    await cache.setAsync({
                        id,
                        package: p
                    })
                }
                catch (e) {
                }

                return p;
            }
        }
    }

    function getGitHubCacheAsync() {
        return getObjectStoreAsync<{
            id: string;
            package?: pxt.github.CachedPackage;
            config?: pxt.PackageConfig;
        }>(GITHUB_TABLE)
    }

    pxt.github.db = new GithubDb();
}

function migrationDbKey(prefix: string, id: string) {
    return `${prefix}--${id}`;
};

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
}
