
type Header = pxt.workspace.Header;
type Project = pxt.workspace.Project;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
import U = pxt.Util;

export let projects: pxt.Map<Project> = {};

export function merge(prj: Project) {
    let h: Header = prj.header;
    if (!h) {
        prj.header = h = pxt.workspace.freshHeader(lf("Untitled"), U.nowSeconds())
        if (prj.text && prj.text["main.blocks"]) {
            prj.header.editor = pxt.BLOCKS_PROJECT_NAME;
        }
    }
    projects[prj.header.id] = prj;
}

function listAsync() {
    return Promise.resolve(U.values(projects).map(p => p.header))
}

function getAsync(h: Header): Promise<pxt.workspace.File> {
    let p = projects[h.id];
    return Promise.resolve({
        header: h,
        text: p ? p.text : {},
        version: null,
    })
}

function setAsync(h: Header, prevVer: any, text?: ScriptText) {
    if (text)
        projects[h.id] = {
            header: h,
            text: text
        }
    return Promise.resolve()
}

function deleteAsync(h: Header, prevVer: any) {
    delete projects[h.id]
    return Promise.resolve()
}

function resetAsync(): Promise<void> {
    projects = {}
    return Promise.resolve();
}

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
}
