type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

interface StoredText {
    id: string;
    files: pxt.Map<string>;
    _rev: string;
};

interface GitHubCacheEntry {
    id: string;
    package?: pxt.github.CachedPackage;
    config?: pxt.PackageConfig;
    cacheTime?: number;
    version?: string;
    etag?: string;
}

const TEXTS_TABLE = "texts";
const HEADERS_TABLE = "headers";
const KEYPATH = "id";
export const SCRIPT_TABLE = "script";
export const GITHUB_TABLE = "github";
export const HOSTCACHE_TABLE = "hostcache";

// this is the expiration time for cached latest versions of repos and
// calls to /api/ghtutorial
const GITHUB_TUTORIAL_CACHE_EXPIRATION_MILLIS = 60 * 60 * 1000;

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

        if (!docId) continue;

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
                pxt.warn("Unknown database table " + table);
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

    const previousDbPrefix = "legacy";
    const currentDbPrefix = getCurrentDBPrefix() || "default";

    try {
        await legacyDb.openAsync();
        const currentDb = await getCurrentDbAsync();

        await copyTableEntriesAsync(legacyDb, currentDb, HEADERS_TABLE, true, previousDbPrefix, currentDbPrefix);
        await copyTableEntriesAsync(legacyDb, currentDb, TEXTS_TABLE, true, previousDbPrefix, currentDbPrefix);
    } catch (e) {
        pxt.reportException(e);
    }
}

async function migratePrefixesAsync() {
    const currentDbPrefix = getCurrentDBPrefix();
    if (!currentDbPrefix) return;

    const currentVersion = pxt.semver.parse(pxt.appTarget.versions.target);
    const currentMajor = currentVersion.major;
    const previousMajor = currentMajor - 1;
    const previousDbPrefix = previousMajor < 0 ? "" : pxt.appTarget.appTheme.browserDbPrefixes[previousMajor];
    const currentDb = await getCurrentDbAsync();
    const migrationDb = await getMigrationDbAsync();
    const dummyEntryKey = migrationDbPrefixUpgradeKey(previousDbPrefix, currentDbPrefix, "dummy");

    // If headers are already in the new db, migration must have already happened
    if ((await currentDb.getAllAsync(HEADERS_TABLE)).length) {
        // Check to see if we've populated the migration db. This only applies to older clients
        // from before we started tracking prefix upgrades in the migration db. Populating this db
        // should be a one-time operation and is necessary to ensure that reset works correctly
        // in browsers that loaded the page sometime before the migration fix was released.
        if (await migrationDb.getAsync(HEADERS_TABLE, dummyEntryKey)) return;

        const prevDb = await getDbAsync(previousDbPrefix);
        await populatePrefixMigrationDb(prevDb, currentDb, HEADERS_TABLE, previousDbPrefix, currentDbPrefix);
        await populatePrefixMigrationDb(prevDb, currentDb, TEXTS_TABLE, previousDbPrefix, currentDbPrefix);
    }
    else {
        // Copy everything over to the current db
        const prevDb = await getDbAsync(previousDbPrefix);

        await copyTableEntriesAsync(prevDb, currentDb, HEADERS_TABLE, false, previousDbPrefix, currentDbPrefix);
        await copyTableEntriesAsync(prevDb, currentDb, TEXTS_TABLE, false, previousDbPrefix, currentDbPrefix);
        await copyTableEntriesAsync(prevDb, currentDb, SCRIPT_TABLE, false, previousDbPrefix, currentDbPrefix);
        await copyTableEntriesAsync(prevDb, currentDb, HOSTCACHE_TABLE, false, previousDbPrefix, currentDbPrefix);
        await copyTableEntriesAsync(prevDb, currentDb, GITHUB_TABLE, false, previousDbPrefix, currentDbPrefix);
    }

    // Stick a dummy marker in the migration db to indicate that we did migrate everything
    await migrationDb.setAsync(HEADERS_TABLE, { id: dummyEntryKey });
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

async function copyTableEntriesAsync(fromDb: pxt.BrowserUtils.IDBWrapper, toDb: pxt.BrowserUtils.IDBWrapper, storeName: string, dontOverwrite: boolean, fromPrefix: string, toPrefix: string) {
    const migrationDb = await getMigrationDbAsync();

    for (const entry of await fromDb.getAllAsync<any>(storeName)) {
        const key = migrationDbPrefixUpgradeKey(fromPrefix, toPrefix, entry.id);
        if (await migrationDb.getAsync(storeName, key)) continue;

        const existing = dontOverwrite && !!(await toDb.getAsync(storeName, entry.id));

        if (!existing) {
            await toDb.setAsync(storeName, entry);
            await migrationDb.setAsync(storeName, {
                id: key
            });
        }
    }
}

async function populatePrefixMigrationDb(fromDb: pxt.BrowserUtils.IDBWrapper, toDb: pxt.BrowserUtils.IDBWrapper, storeName: string, fromPrefix: string, toPrefix: string) {
    const migrationDb = await getMigrationDbAsync();

    for (const entry of await fromDb.getAllAsync<any>(storeName)) {
        const key = migrationDbPrefixUpgradeKey(fromPrefix, toPrefix, entry.id);
        if (await migrationDb.getAsync(storeName, key)) continue;

        // If this header id was actually migrated, add an entry for it in the migration db
        if (await toDb.getAsync(storeName, entry.id)) {
            await migrationDb.setAsync(storeName, {
                id: key
            });
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
    await db.deleteAllAsync(SCRIPT_TABLE);
    await db.deleteAllAsync(HOSTCACHE_TABLE);
    await db.deleteAllAsync(GITHUB_TABLE);
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

        async latestVersionAsync(repopath: string, config: pxt.PackagesConfig): Promise<string> {
            repopath = repopath.toLowerCase();

            const cache = await getGitHubCacheAsync();

            const id = this.latestVersionCacheKey(repopath);

            try {
                const entry = await cache.getAsync(id);

                if (entry && Date.now() - entry.cacheTime < GITHUB_TUTORIAL_CACHE_EXPIRATION_MILLIS) {
                    return entry.version;
                }
            }
            catch (e) {
            }

            const version = await this.mem.latestVersionAsync(repopath, config);

            await this.cacheLatestVersionAsync(cache, repopath, version);

            return version;
        }

        async loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig> {
            repopath = repopath.toLowerCase()
            // don't cache master
            if (tag == "master")
                return this.mem.loadConfigAsync(repopath, tag);

            const id =  this.configCacheKey(repopath, tag);

            const cache = await getGitHubCacheAsync();

            try {
                const entry = await cache.getAsync(id);
                return entry.config;
            }
            catch (e) {
                pxt.debug(`github offline cache miss ${id}`);
                const config = await this.mem.loadConfigAsync(repopath, tag);

                await this.cachePackageConfigAsync(cache, repopath, tag, config);

                return config;
            }
        }

        async loadPackageAsync(repopath: string, tag: string): Promise<pxt.github.CachedPackage> {
            repopath = repopath.toLowerCase()
            if (!tag) {
              pxt.debug(`dep: default to master`)
              tag = "master"
            }
            // don't cache master
            if (tag == "master")
                return this.mem.loadPackageAsync(repopath, tag);

            const id = this.packageCacheKey(repopath, tag);
            const cache = await getGitHubCacheAsync();

            try {
                const entry = await cache.getAsync(id);
                pxt.debug(`github offline cache hit ${id}`);
                return entry.package;
            }
            catch (e) {
                pxt.debug(`github offline cache miss ${id}`);
                const p = await this.mem.loadPackageAsync(repopath, tag);

                await this.cachePackageAsync(cache, repopath, tag, p);

                return p;
            }
        }

        async loadTutorialMarkdown(repopath: string, tag?: string) {
            repopath = pxt.github.normalizeTutorialPath(repopath);

            const cache = await getGitHubCacheAsync();

            const id = this.tutorialCacheKey(repopath, tag);

            const existing = await cache.getAsync(id);

            const readFromCache = async () => {
                const elements = repopath.split("/");
                const repo = elements[0] + "/" + elements[1]

                // everything should be in the cache already, so the latest version
                // and load package calls should hit the DB rather than the network
                tag = tag || await this.latestVersionAsync(repo, await pxt.packagesConfigAsync());

                return this.loadPackageAsync(repo, tag);
            }

            if (existing && !isExpired(existing)) {
                // don't bother hitting the network if we are within the expiration time
                return readFromCache();
            }

            const tutorialResponse = await pxt.github.downloadMarkdownTutorialInfoAsync(repopath, tag, undefined, existing?.etag);

            const body = tutorialResponse.resp;

            // etag matched, so our cache should be up to date
            if (!body) {
                // update the cached entry
                try {
                    await cache.setAsync({
                        ...existing,
                        cacheTime: Date.now()
                    });
                }
                catch (e) {
                    // ignore
                }
                return readFromCache();
            }

            const repo = body.markdown as { filename: string, repo: pxt.github.GHTutorialRepoInfo };
            pxt.Util.assert(typeof repo === "object");

            // fill up the cache with all of the files, versions, and configs contained in this response
            await this.cacheReposAsync(body, tutorialResponse.etag);

            return repo.repo;
        }

        async cacheReposAsync(resp: pxt.github.GHTutorialResponse, etag?: string) {
            if (typeof resp.markdown === "object") {
                const repoInfo = resp.markdown.repo;

                const repopath = getRepoPath(repoInfo) + "/" + resp.markdown.filename.replace(".md", "");

                // add a marker to the cache to make sure we don't hit the network again
                const cache = await getGitHubCacheAsync();
                await this.cacheTutorialResponseAsync(cache, repopath, repoInfo.version, etag);

                // if this is the latest version of the repo, we can also cache this for
                // tutorials where the tag is not explicitly set
                if (repoInfo.version && repoInfo.latestVersion === repoInfo.version) {
                    await this.cacheTutorialResponseAsync(cache, repopath, undefined, etag);
                }

                await this.cacheRepoAsync(repoInfo);
            }
            for (const dep of resp.dependencies) {
                await this.cacheRepoAsync(dep);
            }
        }

        private async cacheRepoAsync(repo: pxt.github.GHTutorialRepoInfo) {
            const repopath = getRepoPath(repo);

            if (await isRepoBannedAsync(repopath, repo.version)) {
                return;
            }

            const cache = await getGitHubCacheAsync();

            // cache the latest version of the repo so that we don't re-fetch it later
            if (repo.latestVersion) {
                await this.cacheLatestVersionAsync(cache, repopath, repo.latestVersion);
            }

            // if this download is tied to a version, also cache the files and config
            if (repo.version) {
                await this.cachePackageAsync(cache, repopath, repo.version, { files: repo.files });

                if (repo.files[pxt.CONFIG_NAME]) {
                    const config = pxt.Package.parseAndValidConfig(repo.files[pxt.CONFIG_NAME]);
                    await this.cachePackageConfigAsync(cache, repopath, repo.version, config);
                }
            }
        }

        private configCacheKey(repopath: string, tag?: string) {
            return `config-${repopath.toLowerCase()}-${tag}`;
        }

        private packageCacheKey(repopath: string, tag?: string) {
            return `pkg-${repopath.toLowerCase()}-${tag}`;
        }

        private tutorialCacheKey(repopath: string, tag?: string) {
            return `tutorial-${repopath.toLowerCase()}-${tag}`;
        }

        private latestVersionCacheKey(repopath: string) {
            return `version-${repopath.toLowerCase()}`;
        }

        private async cacheLatestVersionAsync(cache: pxt.BrowserUtils.IDBObjectStoreWrapper<GitHubCacheEntry>, repopath: string, version: string) {
            const id = this.latestVersionCacheKey(repopath);

            try {
                await cache.setAsync({
                    id,
                    version,
                    cacheTime: Date.now()
                })
            }
            catch (e) {
                // ignore cache failures
                pxt.debug("Failed to cache latest version for " + repopath);
            }
        }

        private async cachePackageConfigAsync(cache: pxt.BrowserUtils.IDBObjectStoreWrapper<GitHubCacheEntry>, repopath: string, tag: string, config: pxt.PackageConfig) {
            const id = this.configCacheKey(repopath, tag);

            try {
                await cache.setAsync({
                    id,
                    config,
                    cacheTime: Date.now()
                })
            }
            catch (e) {
                // ignore cache failures
                pxt.debug(`Failed to cache config for ${repopath}#${tag}`);
            }
        }

        private async cachePackageAsync(cache: pxt.BrowserUtils.IDBObjectStoreWrapper<GitHubCacheEntry>, repopath: string, tag: string, cachedPackage: pxt.github.CachedPackage) {
            const id = this.packageCacheKey(repopath, tag);

            try {
                await cache.setAsync({
                    id,
                    package: cachedPackage,
                    cacheTime: Date.now()
                })
            }
            catch (e) {
                // ignore cache failures
                pxt.debug(`Failed to cache files for ${repopath}#${tag}`);
            }
        }

        private async cacheTutorialResponseAsync(cache: pxt.BrowserUtils.IDBObjectStoreWrapper<GitHubCacheEntry>, repopath: string, tag?: string, etag?: string) {
            const id = this.tutorialCacheKey(repopath, tag);

            try {
                await cache.setAsync({
                    id,
                    cacheTime: Date.now(),
                    etag
                });
            }
            catch (e) {
                // ignore cache failures
                pxt.debug("Failed to cache tutorial for " + repopath);
            }
        }
    }

    function getGitHubCacheAsync() {
        return getObjectStoreAsync<GitHubCacheEntry>(GITHUB_TABLE)
    }

    async function isRepoBannedAsync(repopath: string, tag?: string) {
        if (tag) repopath += "#" + tag;

        const parsed = pxt.github.parseRepoId(repopath);
        const packagesConfig = await pxt.packagesConfigAsync();

        return pxt.github.repoStatus(parsed, packagesConfig) === pxt.github.GitRepoStatus.Banned;
    }

    function getRepoPath(repo: pxt.github.GHTutorialRepoInfo) {
        let repopath = repo.repo;

        if (repo.subPath) {
            repopath += "/" + repo.subPath;
        }

        return repopath.toLowerCase();
    }

    async function purgeExpiredEntriesAsync() {
        const cache = await getGitHubCacheAsync();

        const entries = await cache.getAllAsync();

        const expired = entries.filter(isExpired);

        if (expired.length) {
            for (const entry of expired) {
                await cache.deleteAsync(entry.id);
            }
        }
    }

    function isExpired(entry: GitHubCacheEntry) {
        return !!entry.cacheTime && Date.now() - entry.cacheTime >= GITHUB_TUTORIAL_CACHE_EXPIRATION_MILLIS;
    }

    if (!/skipgithubcache=1/i.test(window.location.href)) {
        pxt.github.db = new GithubDb();
        /* await */ purgeExpiredEntriesAsync();
    }
}

function migrationDbKey(prefix: string, id: string) {
    return `${prefix}--${id}`;
};

function migrationDbPrefixUpgradeKey(oldPrefix: string, newPrefix: string, id: string) {
    return `${oldPrefix}--${newPrefix}--${id}`;
}

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
}
