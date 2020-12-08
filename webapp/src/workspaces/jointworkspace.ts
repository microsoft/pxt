type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type File = pxt.workspace.File;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

export function createJointWorkspace(primary: WorkspaceProvider, ...others: WorkspaceProvider[]): WorkspaceProvider {
    const all: WorkspaceProvider[] = [primary, ...others];

    // TODO @darzu: debug logging
    console.log(`createJointWorkspace`);

    async function listAsync(): Promise<Header[]> {
       const allHdrs = (await Promise.all(all.map(ws => ws.listAsync())))
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