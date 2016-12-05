declare var require: any;
import * as Promise from "bluebird";
(window as any).Promise = Promise;

const PouchDB = require("pouchdb");
require('pouchdb/extras/memory');

(Promise as any).config({
    // Enables all warnings except forgotten return statements.
    warnings: {
        wForgottenReturn: false
    }
});

let _db: any = undefined;
let inMemory = false;

export function getDbAsync(): Promise<any> {
    if (_db) return Promise.resolve(_db);

    let temp = new PouchDB("pxt-" + pxt.storage.storageId(), { revs_limit: 2 })
    return temp.get('pouchdbsupportabletest')
        .catch(function (error: any) {
            if (error && error.error && error.name == 'indexed_db_went_bad') {
                // we are in private mode...
                pxt.debug('private mode...')
                inMemory = true;
                _db = new PouchDB("pxt-" + pxt.storage.storageId(), { adapter: 'memory' })
                return Promise.resolve(_db);
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
