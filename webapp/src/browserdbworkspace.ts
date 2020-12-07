import * as db from "./db";

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;

type TextDbEntry = {
    id: string,
    files?: ScriptText,
    _rev: any
}

export interface BrowserDbWorkspaceProvider extends pxt.workspace.WorkspaceProvider {
    prefix: string;
}

export function createBrowserDbWorkspace(namespace: string): BrowserDbWorkspaceProvider {
    const prefix = namespace ? namespace + "-" : ""
    const headerDb = new db.Table(`${prefix}header`);
    const textDb = new db.Table(`${prefix}text`);

    // TODO @darzu: debug logging
    console.log(`createBrowserDbWorkspace: ${prefix}`);
    (async () => {
        const hdrs: pxt.workspace.Header[] = await headerDb.getAllAsync();
        const txts: TextDbEntry[] = await textDb.getAllAsync();    
        console.dir(hdrs)
        console.dir(txts)
    })();

    async function listAsync(): Promise<pxt.workspace.Header[]> {
        const hdrs: pxt.workspace.Header[] = await headerDb.getAllAsync()
        // TODO @darzu: debug logging
        console.log("browser db headers:")
        console.dir(hdrs.map(h => h.id))
        return hdrs
    }
    async function getAsync(h: Header): Promise<pxt.workspace.File> {
        const resp: TextDbEntry = await textDb.getAsync(h.id)
        return {
            header: h,
            text: resp.files,
            version: resp._rev
        }
    }
    async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<string> {
        // TODO @darzu: debug logging
        if (!text) {
            console.log("setAsync without text!")
            console.dir(h)
        } else {
            console.log("setAsync with text :)")
        }

        const textEnt: TextDbEntry = { 
            id: h.id,
            files: text,
            _rev: prevVer
        }
        const retrev = await textDb.setAsync(textEnt)
        const rev = await headerDb.setAsync(h)
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