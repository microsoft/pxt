// TODO rename to browserworkspace

import * as db from "./db";

let headers = new db.Table("header")
let texts = new db.Table("text")

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

function listAsync() {
    return headers.getAllAsync()
}

function getAsync(h: Header): Promise<pxt.workspace.File> {
    return texts.getAsync(h.id)
        .then(resp => ({
            header: h,
            text: resp.files,
            version: resp._rev
        }))
}

function setAsync(h: Header, prevVer: any, text?: ScriptText) {
    let retrev = ""
    return (!text ? Promise.resolve() :
        texts.setAsync({
            id: h.id,
            files: text,
            _rev: prevVer
        }).then(rev => {
            retrev = rev
        }))
        .then(() => headers.setAsync(h))
        .then(rev => {
            h._rev = rev
            return retrev
        })
}

function deleteAsync(h: Header, prevVer: any) {
    return headers.deleteAsync(h)
        .then(() => texts.deleteAsync({ id: h.id, _rev: h._rev }))
}

function resetAsync() {
    // workspace.resetAsync already clears all tables
    return Promise.resolve()
}

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
}