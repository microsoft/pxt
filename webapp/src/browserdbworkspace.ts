import * as db from "./db";

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;

export interface BrowserDbWorkspaceProvider extends pxt.workspace.WorkspaceProvider {
    prefix: string;
}

export function createBrowserDbWorkspace(namespace: string): BrowserDbWorkspaceProvider {
    const prefix = namespace ? namespace + "-" : ""
    const headerDb = new db.Table(`${prefix}header`);
    const textDb = new db.Table(`${prefix}text`);

    async function listAsync(): Promise<pxt.workspace.Header[]> {
        return headerDb.getAllAsync()
    }
    async function getAsync(h: Header): Promise<pxt.workspace.File> {
        const resp = await textDb.getAsync(h.id)
        return {
            header: h,
            text: resp.files,
            version: resp._rev
        }
    }
    async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<string> {
        return setCoreAsync(headerDb, textDb, h, prevVer, text);
    }
    async function setCoreAsync(headers: db.Table, texts: db.Table, h: Header, prevVer: any, text?: ScriptText): Promise<string> {
        const retrev = await texts.setAsync({
            id: h.id,
            files: text,
            _rev: prevVer
        })
        const rev = await headers.setAsync(h)
        h._rev = rev
        return retrev
    }
    async function deleteAsync(h: Header, prevVer: any): Promise<void> {
        await headerDb.deleteAsync(h)
        await textDb.deleteAsync({ id: h.id, _rev: h._rev })
    }
    async function resetAsync() {
        // workspace.resetAsync already clears all tables
        // TODO @darzu: I don't like that worksapce reset does that....
        return Promise.resolve();
    }

    const provider: BrowserDbWorkspaceProvider = {
        prefix,
        getAsync,
        setAsync,
        deleteAsync,
        listAsync,
        resetAsync,
    }
    return provider;
}