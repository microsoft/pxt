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