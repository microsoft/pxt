declare var require:any;
var PouchDB = require("pouchdb")
import * as Promise from "bluebird";

(window as any).Promise = Promise;
(Promise as any).config({
    // Enables all warnings except forgotten return statements.
    warnings: {
        wForgottenReturn: false
    }
});

export let db = new PouchDB("mbit", { revs_limit: 2 })

export class Table {    
    constructor(public name:string)
    {
    }
    
    getAsync(id:string):Promise<any> {
        return db.get(this.name + "--" + id).then((v:any) => {
            v.id = id
            return v
        })
    }
    
    getAllAsync():Promise<any[]> {
        return db.allDocs({
            include_docs: true,
            startkey: this.name + "--",
            endkey: this.name + "--\uffff"
        }).then((resp:any) => resp.rows.map((e:any) => e.doc))
    }
    
    deleteAsync(obj:any):Promise<void> {
        return db.remove(obj)
    }
    
    setAsync(obj:any):Promise<string> {
        if (obj.id && !obj._id)
            obj._id = this.name + "--" + obj.id            
        return db.put(obj).then((resp:any) => resp.rev)
    }
} 
