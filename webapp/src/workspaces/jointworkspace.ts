import { CachedWorkspaceProvider } from "./cloudsyncworkspace";

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type File = pxt.workspace.File;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

async function unique<T extends {id: string}>(...listFns: (() => Promise<T[]>)[]) {
    const allHdrs = (await Promise.all(listFns.map(ls => ls())))
         .reduce((p, n) => [...p, ...n], [])
    const seenHdrs: { [key: string]: boolean } = {}
    // de-duplicate headers (prefering earlier ones)
    const res = allHdrs.reduce((p, n) => {
         if (seenHdrs[n.id])
             return p;
         seenHdrs[n.id] = true;
         return [...p, n]
     }, [])
     return res;
}

// TODO @darzu: still useful? else cull
export function createJointWorkspace2(primary: WorkspaceProvider, ...others: WorkspaceProvider[]): WorkspaceProvider {
    const all: WorkspaceProvider[] = [primary, ...others];

    // TODO @darzu: debug logging
    console.log(`createJointWorkspace2`);

    async function listAsync(): Promise<Header[]> {
        return unique(...all.map(ws => ws.listAsync))
    }
    async function getAsync(h: Header): Promise<File> {
        // chose the first matching one
        return all.reduce(async (p: Promise<File>, n) => await p ?? n.getAsync(h), null)
    }
    async function getWorkspaceForAsync(h: Header): Promise<WorkspaceProvider> {
        return await all.reduce(
            async (p: Promise<WorkspaceProvider>, n) => await p ?? n.getAsync(h).then(f => f ? n : null), null)
    }
    async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<string> {
        const matchingWorkspace = await getWorkspaceForAsync(h)
        const ws = matchingWorkspace ?? primary
        return ws.setAsync(h, prevVer, text)
    }
    async function deleteAsync(h: Header, prevVer: any): Promise<void> {
        const matchingWorkspace = await getWorkspaceForAsync(h)
        return matchingWorkspace?.deleteAsync(h, prevVer)
    }
    async function resetAsync() {
       await Promise.all(all.map(ws => ws.resetAsync()))
    }

    const provider: WorkspaceProvider = {
        getAsync,
        setAsync,
        deleteAsync,
        listAsync,
        resetAsync,
    }
    return provider;
}

export function createJointWorkspace(...all: CachedWorkspaceProvider[]): CachedWorkspaceProvider {
    // TODO @darzu: we're assuming they are disjoint for now

    // TODO @darzu: debug logging
    console.log(`createJointWorkspace`);

    const firstSync = async () => (await Promise.all(all.map(w => w.firstSync()))).reduce((p, n) => p || n, false)
    const pendingSync = async () => (await Promise.all(all.map(w => w.pendingSync()))).reduce((p, n) => p || n, false)
    const getLastModTime = () => Math.max(...all.map(w => w.getLastModTime()))

    async function synchronize(expectedLastModTime?: number): Promise<boolean> {
        return (await Promise.all(all.map(w => w.synchronize(expectedLastModTime))))
            .reduce((p, n) => p || n, false)
    }
    function listSync(): Header[] {
        // return all (assuming disjoint)
        return all.map(w => w.listSync())
            .reduce((p, n) => [...p, ...n], [])
    }
    async function listAsync(): Promise<Header[]> {
        await pendingSync()
        // return all (assuming disjoint)
        return (await Promise.all(all.map(w => w.listAsync())))
            .reduce((p, n) => [...p, ...n], [])
    }
    function getWorkspaceFor(h: Header): CachedWorkspaceProvider {
        return all.reduce((p, n) => p || (n.hasSync(h) ? n : null), null)
    }
    async function getAsync(h: Header): Promise<File> {
        await pendingSync()
        // choose the first matching one
        const ws = getWorkspaceFor(h)
        return ws?.getAsync(h) ?? undefined
    }
    function tryGetSync(h: Header): File {
        // choose the first matching one
        const ws = getWorkspaceFor(h)
        return ws?.tryGetSync(h) ?? undefined
    }
    function hasSync(h: Header): boolean {
        return all.reduce((p, n) => p || n.hasSync(h), false)
    }
    async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<string> {
        await pendingSync()
        console.log("joint:setAsync")
        console.dir(all.map(w => w.hasSync(h)))
        const ws = getWorkspaceFor(h) ?? all[0]
        return ws.setAsync(h, prevVer, text)
    }
    async function deleteAsync(h: Header, prevVer: any): Promise<void> {
        await pendingSync()
        const ws = getWorkspaceFor(h)
        return ws?.deleteAsync(h, prevVer)
    }
    async function resetAsync() {
        await pendingSync()
        await Promise.all(all.map(ws => ws.resetAsync()))
    }

    const provider: CachedWorkspaceProvider = {
        // cache
        getLastModTime,
        synchronize,
        pendingSync,
        firstSync,
        listSync,
        hasSync,
        tryGetSync,
        // workspace
        getAsync,
        setAsync,
        deleteAsync,
        listAsync,
        resetAsync,
    }
    return provider;
}