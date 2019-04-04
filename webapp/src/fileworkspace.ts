import * as core from "./core";
import * as electron from "./electron";

import U = pxt.Util;
import Cloud = pxt.Cloud;

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

let apiAsync = (path: string, data?: any) => {
    return U.requestAsync({
        url: "/api/" + path,
        headers: { "Authorization": Cloud.localToken },
        method: data ? "POST" : "GET",
        data: data || undefined
    }).then(r => r.json).catch(core.handleNetworkError);
}

export function setApiAsync(f: (path: string, data?: any) => Promise<any>) {
    apiAsync = f
}

function getAsync(h: Header) {
    return apiAsync("pkg/" + h.path)
        .then((resp: pxt.FsPkg) => {
            let r: pxt.workspace.File = {
                header: h,
                text: {},
                version: null
            }
            for (let f of resp.files) {
                r.text[f.name] = f.content
                h.modificationTime = Math.max(h.modificationTime, (f.mtime / 1000) | 0)
            }
            h.recentUse = Math.max(h.recentUse, h.modificationTime)
            r.version = U.flatClone(r.text)
            return r
        })
}

const delText = {}

function setAsync(h: Header, prevVersion: pxt.workspace.Version, text?: ScriptText): Promise<pxt.workspace.Version> {
    let pkg: pxt.FsPkg = {
        files: [],
        config: null,
        header: h,
        path: h.path,
        isDeleted: text === delText
    }
    if (!prevVersion) prevVersion = {}
    for (let fn of Object.keys(text || {})) {
        if (text[fn] !== prevVersion[fn])
            pkg.files.push({
                name: fn,
                mtime: null,
                content: text[fn],
                prevContent: prevVersion[fn]
            })
    }

    let savedText = U.flatClone(text || {})

    return apiAsync("pkg/" + h.path, pkg)
        .then((pkg: pxt.FsPkg) => {
            //mergeFsPkg(pkg)
            return savedText
        })
}

function deleteAsync(h: Header, prevVer: any) {
    return setAsync(h, prevVer, delText)
}

async function listAsync(): Promise<Header[]> {
    let h: pxt.FsPkgs = await apiAsync("list")
    for (let pkg of h.pkgs) {
        if (!pkg.header) {
            let time = pkg.files.map(f => f.mtime)
            time.sort((a, b) => b - a)
            let modTime = Math.round(time[0] / 1000) || U.nowSeconds()
            pkg.header = pxt.workspace.freshHeader(pkg.config.name, modTime)
            if (pkg.config.preferredEditor)
                pkg.header.editor = pkg.config.preferredEditor
            pkg.header.path = pkg.path
            // generate new header and save it
            await setAsync(pkg.header, null)
        } else {
            pkg.header.path = pkg.path
        }
    }
    return h.pkgs.map(p => p.header)
}

function saveScreenshotAsync(h: Header, screenshot: string, icon: string) {
    return apiAsync("screenshot/" + h.path, { screenshot, icon })
}

function resetAsync() {
    if (pxt.BrowserUtils.isPxtElectron())
        return apiAsync("resetworkspace", {})
            .then(() => { });
    return Promise.resolve()
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


export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    listAsync,
    resetAsync,
    deleteAsync,
    saveScreenshotAsync,
    saveAssetAsync,
    listAssetsAsync
}