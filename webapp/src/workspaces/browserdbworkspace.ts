import * as db from "../db";
import { toDbg } from "./cloudsyncworkspace";

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;

type TextDbEntry = {
    files?: ScriptText,
    // These are required by PouchDB/CouchDB
    id: string,
    _rev: any // This must be set to the return value of the last PouchDB/CouchDB
}

export interface BrowserDbWorkspaceProvider extends pxt.workspace.WorkspaceProvider {
    prefix: string;
}

// TODO @darzu: very important for _rev and _id
export function createBrowserDbWorkspace(namespace: string): BrowserDbWorkspaceProvider {
    if (!namespace) {
        console.log("BAD default namespace created")
        console.trace();
    }
    const prefix = namespace ? namespace + "-" : ""
    const headerDb = new db.Table(`${prefix}header`);
    const textDb = new db.Table(`${prefix}text`);

    // TODO @darzu: dz:
    // return pxt.storage.getLocal('workspacesessionid') != sessionID;
    // pxt.storage.setLocal('workspacesessionid', sessionID);

    // TODO @darzu:
    const printDbg = async () => {
        const hdrs: pxt.workspace.Header[] = await headerDb.getAllAsync();
        // const txts: TextDbEntry[] = await textDb.getAllAsync();
        console.log(`dbg ${prefix}-headers:`);
        console.dir(hdrs.map(toDbg))
    }
    // TODO @darzu: dbg
    printDbg();

    async function listAsync(): Promise<pxt.workspace.Header[]> {
        const hdrs: pxt.workspace.Header[] = await headerDb.getAllAsync()
        // // TODO @darzu: debug logging
        // console.log(`browser db headers ${prefix}:`)
        // console.dir(hdrs.map(h => h.id))
        return hdrs
    }
    async function getAsync(h: Header): Promise<pxt.workspace.File> {
        const resp: TextDbEntry = await textDb.getAsync(h.id)
        if (!resp)
            return undefined;
        return {
            header: h,
            text: resp.files,
            version: resp._rev
        }
    }
    async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<string> {
        // TODO @darzu: debug logging
        if (!text) {
            // TODO @darzu: trace down why...  this is a real bug
            console.log("!!! setAsync without text :(")
            // console.dir(h)
        } else {
            console.log(`setAsync ${namespace || "default"}:(${h.id}, ${h.modificationTime}, ${prevVer}) :)`)
        }

        const textEnt: TextDbEntry = {
            files: text,
            id: h.id,
            _rev: prevVer
        }

        // if we get a 400, we need to fetch the old then do a new
        let textVer: string;
        try {
        textVer = await textDb.setAsync(textEnt)
        } catch (e) {}

        if (!textVer) {
            console.log(`! failed to set text for id:${h.id},pv:${prevVer}`); // TODO @darzu: dbg logging
            const oldTxt = await textDb.getAsync(h.id)
            console.dir(`! text ${h.id} actually is: ${oldTxt._rev}`)
            console.dir(oldTxt)
        }

        let hdrVer: string;
        try {
        hdrVer = await headerDb.setAsync(h)
        } catch (e) {}

        if (!hdrVer) {
            console.log(`! failed to set hdr for id:${h.id},pv:${prevVer}`); // TODO @darzu: dbg logging
            let oldHdr: Header
            try {
                oldHdr = await headerDb.getAsync(h.id) as Header
            } catch (e) {}
            if (oldHdr) {
                h._rev = oldHdr._rev
            } else {
                delete h._rev
            }
            // TODO @darzu: need to rethink error handling here
            try {
            hdrVer = await headerDb.setAsync(h)
            } catch (e) {}
            if (!hdrVer) {
                console.log(`!!! failed AGAIN to set hdr for id:${h.id},old:${JSON.stringify(oldHdr)}`); // TODO @darzu: dbg logging
            }
        }

        h._rev = hdrVer

        await printDbg(); // TODO @darzu: dbg

        return textVer
    }
    async function deleteAsync(h: Header, prevVer: any): Promise<void> {
        await headerDb.deleteAsync(h)
        const textEnt: TextDbEntry = {
            id: h.id,
            _rev: prevVer
        }
        await textDb.deleteAsync(textEnt);
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