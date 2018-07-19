// TODO rename to browserworkspace

import * as db from "./db";
import * as core from "./core";
import * as data from "./data";
import * as ws from "./workspace";

let headers = new db.Table("header")
let texts = new db.Table("text")

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

import U = pxt.Util;
let allScripts: HeaderWithScript[] = [];

interface HeaderWithScript {
    id: string;
    header: Header;
    text: ScriptText;
    textRev?: string;
    textNeedsSave?: boolean;
}

function lookup(id: string) {
    return allScripts.filter(x => x.id == id)[0]
}

function getHeaders() {
    return allScripts.map(e => e.header)
}

function getHeader(id: string) {
    let e = lookup(id)
    if (e && !e.header.isDeleted)
        return e.header
    return null
}

function initAsync(target: string, version: string) {
    // TODO getAllAsync aware of target?
    return headers.getAllAsync().then(h => {
        allScripts = h
            .filter((hh: Header) => {
                if (!hh.target) hh.target = "microbit"
                return hh.target == pxt.appTarget.id
            })
            .map((hh: Header) => {
                return {
                    id: hh.id,
                    header: hh,
                    text: null
                }
            })
    })
}

function fetchTextAsync(e: HeaderWithScript): Promise<ScriptText> {
    return texts.getAsync(e.id)
        .then(resp => {
            if (!e.text) {
                // otherwise we were beaten to it
                e.text = ws.fixupFileNames(resp.files);
            }
            e.textRev = resp._rev;
            return e.text
        })
}

let headerQ = new U.PromiseQueue();

function getTextAsync(id: string): Promise<ScriptText> {
    let e = lookup(id)
    if (!e)
        return Promise.resolve(null as ScriptText)
    if (e.text)
        return Promise.resolve(e.text)
    return headerQ.enqueue(id, () => fetchTextAsync(e))
}

function fetchTextRevAsync(e: HeaderWithScript) {
    if (e.textRev)
        return Promise.resolve();
    return fetchTextAsync(e).then(() => { }, err => { })
}

function saveCoreAsync(h: Header, text?: ScriptText) {
    if (h.temporary) return Promise.resolve();

    let e = lookup(h.id)

    U.assert(e.header === h)

    // perma-delete
    if (h.isDeleted && h.blobVersion == "DELETED") {
        let idx = allScripts.indexOf(e)
        U.assert(idx >= 0)
        allScripts.splice(idx, 1)
        return headerQ.enqueue(h.id, () =>
            headers.deleteAsync(h)
                .then(() => fetchTextRevAsync(e))
                .then(() => texts.deleteAsync({ id: h.id, _rev: e.textRev })))
    }

    if (text) {
        h.saveId = null
        e.textNeedsSave = true
        e.text = text
    }

    return headerQ.enqueue(h.id, () => {
        return (!text ? Promise.resolve() :
            fetchTextRevAsync(e)
                .then(() => {
                    e.textNeedsSave = false;
                    return texts.setAsync({
                        id: e.id,
                        files: e.text,
                        _rev: e.textRev
                    }).then(rev => {
                        e.textRev = rev
                    })
                }))
            .then(() => headers.setAsync(e.header))
            .then(rev => {
                h._rev = rev
                data.invalidate("header:" + h.id)
                data.invalidate("header:*")
                if (text) {
                    data.invalidate("text:" + h.id)
                    h.saveId = null
                }
            })
    })
}

function saveAsync(h: Header, text: ScriptText) {
    return saveCoreAsync(h, text)
}

function importAsync(h: Header, text: ScriptText) {
    let e: HeaderWithScript = {
        id: h.id,
        header: h,
        text: text,
    }
    allScripts.push(e)
    return saveCoreAsync(h, text)
}

function resetAsync() {
    return db.destroyAsync()
        .then(() => {
            pxt.storage.clearLocal();
            data.clearCache();
        })
}

function loadedAsync(): Promise<void> {
    return Promise.resolve();
}

function syncAsync() {
    return Promise.resolve(null)
}

function saveToCloudAsync(h: Header) {
    return Promise.resolve()
}

function duplicateAsync(h: Header, text: ScriptText): Promise<Header> {
    let e = lookup(h.id)
    U.assert(e.header === h)
    let h2 = U.flatClone(h)
    e.id = h.id = U.guidGen()
    e.text = null
    e.textRev = null
    e.textNeedsSave = false
    return saveCoreAsync(h, text)
        .then(() => importAsync(h2, text))
        .then(() => h2)
}

export const provider: WorkspaceProvider = {
    getHeaders,
    getHeader,
    getTextAsync,
    initAsync,
    saveAsync,
    duplicateAsync,
    importAsync,
    saveToCloudAsync,
    syncAsync,
    resetAsync,
    loadedAsync
}