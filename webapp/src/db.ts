declare var require: any;
import * as Promise from "bluebird";
(window as any).Promise = Promise;

const PouchDB = require("pouchdb");
/* tslint:disable:no-submodule-imports TODO(tslint) */
require('pouchdb/extras/memory');
// pouchdb 7.0 - broken in IE
// PouchDB.plugin(require('pouchdb-adapter-memory'));
/* tslint:enable:no-submodule-imports */

(Promise as any).config({
    // Enables all warnings except forgotten return statements.
    warnings: {
        wForgottenReturn: false
    }
});

let _db: any = undefined;
let inMemory = false;

function memoryDb(): Promise<any> {
    pxt.debug('db: in memory...')
    inMemory = true;
    _db = new PouchDB("pxt-" + pxt.storage.storageId(), {
        adapter: 'memory'
    })
    return Promise.resolve(_db);
}

export function getDbAsync(): Promise<any> {
    if (_db) return Promise.resolve(_db);

    if (pxt.shell.isSandboxMode() || pxt.shell.isReadOnly())
        return memoryDb();

    const opts: any = {
        revs_limit: 2
    };

    let temp = new PouchDB("pxt-" + pxt.storage.storageId(), opts);
    return temp.get('pouchdbsupportabletest')
        .catch(function (error: any) {
            if (error && error.error && error.name == 'indexed_db_went_bad') {
                return memoryDb();
            } else {
                _db = temp;
                return Promise.resolve(_db);
            }
        })
        .finally(() => { pxt.log(`PouchDB adapter: ${_db.adapter}`) });
}

export function destroyAsync(): Promise<void> {
    return !_db ? Promise.resolve() : _db.destroy();
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
                    .then(() => this.setAsyncNoRetry(obj))
                    .catch(e => {
                        pxt.reportException(e);
                        pxt.log(`table: we are out of space...`)
                        return undefined;
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
    loadPackageAsync(repopath: string, tag: string): Promise<pxt.github.CachedPackage> {
        // don't cache master
        if (tag == "master")
            return this.mem.loadPackageAsync(repopath, tag);

        const id = `pkg-${repopath}-${tag}`;
        return this.table.getAsync(id).then(
            entry => {
                pxt.debug(`github offline cache hit ${id}`);
                return entry.package as pxt.github.CachedPackage;
            },
            e => {
                pxt.debug(`github offline cache miss ${id}`);
                return this.mem.loadPackageAsync(repopath, tag)
                    .then(p => {
                        return this.table.forceSetAsync({
                            id,
                            package: p
                        }).then(() => p, e => p);
                    })
            } // not found
        );
    }
}

pxt.github.db = new GithubDb();