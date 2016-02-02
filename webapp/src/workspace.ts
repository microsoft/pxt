/// <reference path="../../built/yelmlib.d.ts" />

import * as Promise from "bluebird";
import * as db from "./db";

let headers = new db.Table("header")
let texts = new db.Table("text")

export interface Header {
    _rev: string;
    id: string; // guid
    name: string;
    scriptId: string; // for published scripts
    cloudSnapshot: string; // blob name for cloud version
    meta: any;
    status: string;
    recentUse: number; // seconds since epoch
    editor: string;
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
