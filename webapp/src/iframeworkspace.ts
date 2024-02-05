import * as mem from "./memoryworkspace";
import * as pxteditor from "../../pxteditor";

type Header = pxt.workspace.Header;
type ScriptText = pxteditor.workspace.ScriptText;
type WorkspaceProvider = pxteditor.workspace.WorkspaceProvider;

function loadedAsync(): Promise<void> {
    return pxteditor.postHostMessageAsync(<pxteditor.EditorWorkspaceSyncRequest>{
        type: "pxthost",
        action: "workspaceloaded",
        response: true
    }).then(() => { })
}

let lastSyncState: pxteditor.EditorSyncState

function listAsync() {
    return pxteditor.postHostMessageAsync(<pxteditor.EditorWorkspaceSyncRequest>{
        type: "pxthost",
        action: "workspacesync",
        response: true
    }).then((msg: pxteditor.EditorWorkspaceSyncResponse) => {
        (msg.projects || []).forEach(mem.merge);

        lastSyncState = msg.editor

        // controllerId is a unique identifier of the controller source
        pxt.tickEvent("pxt.controller", { controllerId: msg.controllerId });

        return mem.provider.listAsync()
    })
}

function getSyncState() { return lastSyncState }

function getAsync(h: Header): Promise<pxteditor.workspace.File> {
    return mem.provider.getAsync(h)
}

function setAsync(h: Header, prevVer: any, text?: ScriptText) {
    return mem.provider.setAsync(h, prevVer, text)
        .then(() => {
            const projectText = (text || (mem.projects[h.id] && mem.projects[h.id].text));
            return pxteditor.postHostMessageAsync(<pxteditor.EditorWorkspaceSaveRequest>{
                    type: "pxthost",
                    action: "workspacesave",
                    project: { header: h, text: projectText },
                    response: false
                })
        }).then(() => { })
}

function resetAsync(): Promise<void> {
    return mem.provider.resetAsync()
        .then(() => pxteditor.postHostMessageAsync(<pxteditor.EditorWorkspaceSyncRequest>{
            type: "pxthost",
            action: "workspacereset",
            response: true
        })).then(() => { })
}

function fireEvent(ev: pxteditor.EditorEvent) {
    // Send the message up the chain
    pxteditor.postHostMessageAsync(<pxteditor.EditorWorkspaceEvent>{
        type: "pxthost",
        action: "workspaceevent",
        response: false,
        event: ev
    })
}

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    listAsync,
    resetAsync,
    loadedAsync,
    getSyncState,
    fireEvent
}