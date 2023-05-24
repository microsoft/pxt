// eslint-disable-next-line no-var
declare var require: any;

const PouchDB = require("pouchdb")
    .plugin(require('pouchdb-adapter-memory'));

let _db: Promise<any> = undefined;
export function getDbAsync(): Promise<any> {
    if (_db) return _db;

    return _db = Promise.resolve()
        .then(() => {
            const opts: any = {
                revs_limit: 2
            };

            const db = new PouchDB("pxt-" + pxt.storage.storageId(), opts);
            pxt.log(`PouchDB adapter: ${db.adapter}`);

            return db;
        });
}

export function destroyAsync(): Promise<void> {
    return !_db ? Promise.resolve() : _db.then((db: any) => {
        db.destroy();
        _db = undefined;
    });
}

export class Table {
    constructor(public name: string) { }

    getAsync(id: string): Promise<any> {
        return getDbAsync().then(db => db.get(this.name + "--" + id)).then((v: any) => {
            v.id = id
            return v
        })
    }

    getAllAsync(): Promise<any[]> {
        return getDbAsync().then(db => db.allDocs({
            include_docs: true,
            startkey: this.name + "--",
            endkey: this.name + "--\uffff"
        })).then((resp: any) => resp.rows.map((e: any) => e.doc))
    }

    deleteAsync(obj: any): Promise<void> {
        return getDbAsync().then(db => db.remove(obj))
    }

    forceSetAsync(obj: any): Promise<string> {
        return this.getAsync(obj.id)
            .then(o => {
                obj._rev = o._rev
                return this.setAsync(obj)
            }, e => this.setAsync(obj))
    }

    setAsync(obj: any): Promise<string> {
        return this.setAsyncNoRetry(obj)
            .then(r => {
                pxt.BrowserUtils.scheduleStorageCleanup();
                return r;
            })
            .catch(e => {
                if (e.status == 409) {
                    // conflict while writing key, ignore.
                    pxt.debug(`table: set conflict (409)`);
                    return undefined;
                }
                pxt.reportException(e);
                pxt.log(`table: set failed, cleaning translation db`)
                // clean up translation and try again
                return pxt.BrowserUtils.clearTranslationDbAsync()
                    .then(() => pxt.BrowserUtils.clearTutorialInfoDbAsync())
                    .then(() => this.setAsyncNoRetry(obj))
                    .catch(e => {
                        pxt.log(`table: we are out of space...`)
                        throw e;
                    })
            })
    }

    private setAsyncNoRetry(obj: any): Promise<string> {
        if (obj.id && !obj._id)
            obj._id = this.name + "--" + obj.id
        return getDbAsync().then(db => db.put(obj)).then((resp: any) => resp.rev)
    }
}

class GithubDb implements pxt.github.IGithubDb {
    // in memory cache
    private mem = new pxt.github.MemoryGithubDb();
    private table = new Table("github");

    latestVersionAsync(repopath: string, config: pxt.PackagesConfig): Promise<string> {
        return this.mem.latestVersionAsync(repopath, config)
    }

    loadConfigAsync(repopath: string, tag: string): Promise<pxt.PackageConfig> {
        // don't cache master
        if (tag == "master")
            return this.mem.loadConfigAsync(repopath, tag);

        const id = `config-${repopath}-${tag}`;
        return this.table.getAsync(id).then(
            entry => {
                pxt.debug(`github offline cache hit ${id}`);
                return entry.config as pxt.PackageConfig;
            },
            e => {
                pxt.debug(`github offline cache miss ${id}`);
                return this.mem.loadConfigAsync(repopath, tag)
                    .then(config => {
                        return this.table.forceSetAsync({
                            id,
                            config
                        }).then(() => config, e => config);
                    })
            } // not found
        );
    }
    async loadPackageAsync(repopath: string, tag: string, backupScriptText?: pxt.Map<string>): Promise<pxt.github.CachedPackage> {
        if (!tag) {
            pxt.debug(`dep: default to master`)
            tag = "master"
        }
        // don't cache master
        if (tag == "master")
            return this.mem.loadPackageAsync(repopath, tag, backupScriptText);

        const id = `pkg-${repopath}-${tag}`;
        try {
            const entry = await this.table.getAsync(id);
            pxt.debug(`github offline cache hit ${id}`);
            // TODO: back up check here if .backupCopy to try fetch from this.mem?
            return entry.package as pxt.github.CachedPackage;

        } catch (e) {
            pxt.debug(`github offline cache miss ${id}`);
            const p = await this.mem.loadPackageAsync(repopath, tag, backupScriptText);
            try {
                await this.table.forceSetAsync({
                    id,
                    package: p
                });
            } finally {
                return p;
            }
        }
    }
}

pxt.github.db = new GithubDb();