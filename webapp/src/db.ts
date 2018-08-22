declare var require: any;
import * as Promise from "bluebird";
(window as any).Promise = Promise;

const PouchDB = require("pouchdb");
PouchDB.plugin(require('pouchdb-adapter-memory'));

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

    let temp = new PouchDB("pxt-" + pxt.storage.storageId(), { revs_limit: 2 })
    return temp.get('pouchdbsupportabletest')
        .catch(function (error: any) {
            if (error && error.error && error.name == 'indexed_db_went_bad') {
                return memoryDb();
            } else {
                _db = temp;
                return Promise.resolve(_db);
            }
        })
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
        if (obj.id && !obj._id)
            obj._id = this.name + "--" + obj.id
        return getDbAsync().then(db => db.put(obj)).then((resp: any) => resp.rev)
    }
}

class TranslationDb implements ts.pxtc.Util.ITranslationDb {
    table: Table;
    memCache: pxt.Map<ts.pxtc.Util.ITranslationDbEntry> = {};

    constructor() {
        this.table = new Table("translations");
    }

    private key(lang: string, filename: string, branch: string) {
        return `${lang}-${filename}-${branch || ""}`;
    }

    getAsync(lang: string, filename: string, branch?: string): Promise<ts.pxtc.Util.ITranslationDbEntry> {
        const id = this.key(lang, filename, branch);
        // only update once per session
        const entry = this.memCache[id];
        if (entry) {
            pxt.debug(`translation cache live hit ${id}`);
            return Promise.resolve(entry);
        }

        // load from pouchdb
        pxt.debug(`translation cache: load ${id}`)
        return this.table.getAsync(id).then(
            v => {
                pxt.debug(`translation cache hit ${id}`);
                return v;
            },
            e => {
                pxt.debug(`translation cache miss ${id}`);
                return undefined;
            } // not found
        );
    }
    setAsync(lang: string, filename: string, branch: string, etag: string, strings: pxt.Map<string>): Promise<void> {
        const id = this.key(lang, filename, branch);
        const entry: ts.pxtc.Util.ITranslationDbEntry = {
            id,
            etag,
            strings
        };
        pxt.debug(`translation cache: save ${id}-${etag}`)
        const mem = pxt.Util.clone(entry);
        mem.cached = true;
        delete (<any>mem)._rev;
        this.memCache[id] = mem;
        return this.table.forceSetAsync(entry).then(() => { }, e => {
            pxt.log(`translate cache: conflict for ${id}`);
        });
    }

}

ts.pxtc.Util.translationDb = new TranslationDb();

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