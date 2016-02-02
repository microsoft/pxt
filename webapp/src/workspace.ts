/// <reference path="../../built/yelmlib.d.ts" />

import * as Promise from "bluebird";
import * as db from "./db";

let headers = new db.Table("header")
let texts = new db.Table("text")

export interface InstallHeader {
    name: string;
    scriptId: string; // for published scripts
    meta: any;
    status: string;
    editor: string;
}

export interface Header extends InstallHeader {
    _rev: string;
    id: string; // guid
    recentUse: number; // seconds since epoch
    cloudSnapshot: string; // blob name for cloud version
}

export interface ScriptText {
    _rev: string;
    id: string;
    files: Util.StringMap<string>;
}

export let allHeaders: Header[];

export function initAsync() {
    return headers.getAllAsync().then(h => { allHeaders = h })
}

export class PromiseQueue {
    promises: Util.StringMap<Promise<any>> = {};

    enqueue<T>(id: string, f: () => Promise<T>): Promise<T> {
        if (!this.promises.hasOwnProperty(id)) {
            this.promises[id] = Promise.resolve()
        }
        let newOne = this.promises[id].then(() => f().then(v => {
            if (this.promises[id] === newOne)
                delete this.promises[id];
            return v;
        }))
        this.promises[id] = newOne;
        return newOne;
    }
}

let headerQ = new PromiseQueue();
let lastTextRev: Util.StringMap<string> = {}

export function resetAsync() {
    return db.db.destroy()
        .then(() => {
            window.localStorage.clear()
        })
}

export function getTextAsync(id: string): Promise<ScriptText> {
    return headerQ.enqueue(id, () =>
        texts.getAsync(id)
            .then(resp => {
                lastTextRev[resp.id] = resp._rev
                return resp;
            }))
}

function nowSeconds() {
    return Math.round(Date.now() / 1000)
}

export function updateAsync(h: Header, text?: ScriptText) {
    h.recentUse = nowSeconds();
    if (text)
        h.status = "unpublished"
    return saveCoreAsync(h, text)
}

export function installAsync(h0: InstallHeader, text: ScriptText) {
    let h = <Header>h0
    h.id = Util.guidGen();
    h.recentUse = nowSeconds()
    text.id = h.id
    return saveCoreAsync(h, text)
        .then(() => {
            allHeaders.push(h)
        })
}

export function installByIdAsync(id: string) {
    return Cloud.privateGetAsync(id)
        .then((scr: Cloud.JsonScript) =>
            Cloud.getScriptFilesAsync(scr.id)
                .then(files => installAsync(
                    {
                        name: scr.name,
                        scriptId: id,
                        meta: scr.meta,
                        status: "published",
                        editor: scr.editor
                    },
                    {
                        _rev: undefined,
                        id: undefined,
                        files: files
                    })))
}

function saveCoreAsync(h: Header, text?: ScriptText) {
    return headerQ.enqueue(h.id, () =>
        setTextAsync(text).then(() =>
            headers.setAsync(h).then(rev => {
                h._rev = rev
            })))
}

function setTextAsync(t: ScriptText): Promise<void> {
    if (!t) return Promise.resolve();

    Util.assert(!!t.id)
    Util.assert(!!t.files)

    t._rev = lastTextRev[t.id]

    return texts.setAsync(t)
        .then(resp => {
            lastTextRev[t.id] = resp
        })
}
