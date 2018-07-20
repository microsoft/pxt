import * as db from "./db";
import * as core from "./core";
import * as data from "./data";

import U = pxt.Util;
import Cloud = pxt.Cloud;
let allScripts: HeaderWithScript[] = [];
let currentTarget: string;
let currentTargetVersion: string;

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

interface HeaderWithScript {
    id: string;
    path: string;
    header: Header;
    text: ScriptText;
    fsText: ScriptText;
    mtime?: number;
    textNeedsSave?: boolean;
}

function lookup(id: string) {
    return allScripts.filter(x => x.id == id || x.path == id)[0]
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

function apiAsync(path: string, data?: any) {
    return U.requestAsync({
        url: "/api/" + path,
        headers: { "Authorization": Cloud.localToken },
        method: data ? "POST" : "GET",
        data: data || undefined
    }).then(r => r.json).catch(core.handleNetworkError);
}

function mergeFsPkg(pkg: pxt.FsPkg) {
    let e = lookup(pkg.path)
    if (!e) {
        e = {
            id: pkg.header ? pkg.header.id : "",
            path: pkg.path,
            header: pkg.header,
            text: null,
            fsText: null
        }
        allScripts.push(e)
    }

    let time = pkg.files.map(f => f.mtime)
    time.sort((a, b) => b - a)
    let modTime = Math.round(time[0] / 1000) || U.nowSeconds()

    if (!e.header) {
        e.header = {
            target: currentTarget,
            targetVersion: currentTargetVersion,
            name: pkg.config.name,
            meta: {},
            editor: pxt.JAVASCRIPT_PROJECT_NAME,
            pubId: pkg.config.installedVersion,
            pubCurrent: false,
            _rev: null,
            id: U.guidGen(),
            recentUse: modTime,
            modificationTime: modTime,
            blobId: null,
            blobVersion: null,
            blobCurrent: false,
            isDeleted: false,
            icon: pkg.icon
        }
    }

    e.id = e.header.id
}

function initAsync(target: string, version: string) {
    allScripts = [];
    currentTarget = target;
    currentTargetVersion = version;
    return syncAsync().then(() => { });
}

function fetchTextAsync(e: HeaderWithScript): Promise<ScriptText> {
    return apiAsync("pkg/" + e.id)
        .then((resp: pxt.FsPkg) => {
            if (!e.text) {
                // otherwise we were beaten to it
                e.text = {};
                e.mtime = 0
                for (let f of resp.files) {
                    e.text[f.name] = f.content
                    e.mtime = Math.max(e.mtime, f.mtime)
                }
                e.fsText = U.flatClone(e.text)
            }
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

function saveCoreAsync(h: Header, text?: ScriptText) {
    if (h.temporary) return Promise.resolve();

    let e = lookup(h.id)

    U.assert(e.header === h)

    if (!text)
        return Promise.resolve()

    h.saveId = null
    e.textNeedsSave = true
    e.text = text

    return headerQ.enqueue<void>(h.id, () => {
        U.assert(!!e.fsText)
        let pkg: pxt.FsPkg = {
            files: [],
            config: null,
            header: h,
            path: h.id,
        }
        for (let fn of Object.keys(e.text)) {
            if (e.text[fn] !== e.fsText[fn])
                pkg.files.push({
                    name: fn,
                    mtime: null,
                    content: e.text[fn],
                    prevContent: e.fsText[fn]
                })
        }
        let savedText = U.flatClone(e.text)
        if (pkg.files.length == 0) return Promise.resolve()
        return apiAsync("pkg/" + h.id, pkg)
            .then((pkg: pxt.FsPkg) => {
                e.fsText = savedText
                mergeFsPkg(pkg)
                data.invalidate("header:" + h.id)
                data.invalidate("header:*")
                if (text) {
                    data.invalidate("text:" + h.id)
                    h.saveId = null
                }
            })
            .catch(e => core.errorNotification(lf("Save failed!")))
    })
}

function saveAsync(h: Header, text: ScriptText) {
    return saveCoreAsync(h, text)
}

function computePath(h: Header) {
    let path = h.name.replace(/[^a-zA-Z0-9]+/g, " ").trim().replace(/ /g, "-")
    if (lookup(path)) {
        let n = 2
        while (lookup(path + "-" + n))
            n++;
        path += "-" + n
    }

    return path
}

function importAsync(h: Header, text: ScriptText) {
    let path = computePath(h)
    const e: HeaderWithScript = {
        path: path,
        id: h.id,
        header: h,
        text: text,
        fsText: {}
    }
    allScripts.push(e)
    return saveCoreAsync(h, text)
}

function saveToCloudAsync(h: Header) {
    return Promise.resolve()
}

function syncAsync(): Promise<pxt.editor.EditorSyncState> {
    return apiAsync("list").then((h: pxt.FsPkgs) => {
        h.pkgs.forEach(mergeFsPkg)
        data.invalidate("header:")
        data.invalidate("text:")

        return undefined;
    })
}

function saveScreenshotAsync(h: Header, screenshot: string, icon: string) {
    return apiAsync("screenshot/" + h.id, { screenshot, icon })
}

function resetAsync() {
    return db.destroyAsync()
        .then(() => {
            allScripts = [];
            pxt.storage.clearLocal();
            data.clearCache();
        })
}

function loadedAsync(): Promise<void> {
    return Promise.resolve();
}

function saveAssetAsync(id: string, filename: string, data: Uint8Array): Promise<void> {
    return apiAsync("pkgasset/" + id, {
        encoding: "base64",
        name: filename,
        data: btoa(ts.pxtc.Util.uint8ArrayToString(data))
    }).then(resp => {
    })
}

function listAssetsAsync(id: string): Promise<pxt.workspace.Asset[]> {
    return apiAsync("pkgasset/" + id).then(r => r.files)
}

function duplicateAsync(h: Header, text: ScriptText): Promise<Header> {
    let e = lookup(h.id)
    U.assert(e.header === h)
    let h2 = U.flatClone(h)
    e.header = h2

    h.id = U.guidGen()
    h.name += " #2"
    return importAsync(h, text)
        .then(() => h2)
}


export const provider: WorkspaceProvider = {
    getHeaders,
    getHeader,
    getTextAsync,
    initAsync,
    saveAsync,
    importAsync,
    saveToCloudAsync,
    duplicateAsync,
    syncAsync,
    resetAsync,
    loadedAsync,
    saveScreenshotAsync,
    saveAssetAsync,
    listAssetsAsync
}