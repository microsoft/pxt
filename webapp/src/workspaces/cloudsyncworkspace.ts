import { del } from "request";
import { ConflictStrategy, DisjointSetsStrategy, Strategy } from "./workspacebehavior";
import U = pxt.Util;

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type F = pxt.workspace.File;
type Version = pxt.workspace.Version;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

// TODO @darzu: 
// cache invalidation

interface CachedWorkspaceProvider extends WorkspaceProvider {
    getLastModTime(): number,
    updateCache(otherLastModTime?: number): Promise<boolean>,
    lastHeaders(): Header[],
    firstSync(): Promise<boolean>,
}

function computeLastModTime(hdrs: Header[]): number {
    return hdrs.reduce((p, n) => Math.max(n.modificationTime, p), 0)
}
function hasChanged(a: Header, b: Header): boolean {
    // TODO @darzu: use version uuid instead?
    return a.modificationTime !== b.modificationTime
}

// TODO @darzu: use cases: multi-tab and cloud
function createCachedWorkspace(ws: WorkspaceProvider): CachedWorkspaceProvider {
    let cacheHdrs: Header[] = []
    let cacheHdrsMap: {[id: string]: Header} = {};
    let cacheProjs: {[id: string]: F} = {};
    
    let cacheModTime: number = 0;

    function getLastModTime(): number {
        return cacheModTime;
    }

    let pendingUpdate: Promise<boolean> = updateCacheInternal();
    const firstUpdate = pendingUpdate;
    async function updateCache(otherLastModTime?:number): Promise<boolean> {
        if (pendingUpdate.isPending())
            return pendingUpdate
        pendingUpdate = updateCacheInternal(otherLastModTime)
        return pendingUpdate
    }

    function eraseCache() {
        cacheHdrs = []
        cacheHdrsMap = {}
        cacheProjs = {}
        cacheModTime = 0
    }

    async function updateCacheInternal(otherLastModTime?:number): Promise<boolean> {
        // remember our old cache, we might keep items from it later
        const oldHdrs = cacheHdrs
        const oldHdrsMap = cacheHdrsMap
        const oldProjs = cacheProjs
        const oldModTime = cacheModTime

        if (otherLastModTime && otherLastModTime !== cacheModTime) {
            // we've been told to invalidate, but we don't know specific
            // headers yet so do the conservative thing and reset all
            eraseCache()
        }

        const newHdrs = await ws.listAsync()
        const newLastModTime = computeLastModTime(newHdrs);
        if (newLastModTime === oldModTime) {
            // no change, keep the old cache
            cacheHdrs = oldHdrs
            cacheHdrsMap = oldHdrsMap
            cacheProjs = oldProjs
            return false
        }

        // compute header differences and clear old cache entries
        const newHdrsMap = U.toDictionary(newHdrs, h => h.id)
        const newProjs = oldProjs
        for (let id of Object.keys(newProjs)) {
            const newHdr = newHdrsMap[id]
            if (!newHdr || hasChanged(newHdr, oldHdrsMap[id]))
                delete newProjs[id]
        }

        // save results
        cacheModTime = newLastModTime      
        cacheProjs = newProjs
        cacheHdrs = newHdrs
        cacheHdrsMap = newHdrsMap  
        return true;
    }

    async function listAsync(): Promise<Header[]> {
        await pendingUpdate;
        return cacheHdrs
    }
    async function getAsync(h: Header): Promise<F> {
        await pendingUpdate;
        if (!cacheProjs[h.id]) {
            // fetch
            // TODO @darzu: use / cooperate with worklist?
            const proj = await ws.getAsync(h)
            cacheProjs[h.id] = proj
        }
        return cacheProjs[h.id];
    }
    async function setAsync(h: Header, prevVer: Version, text?: ScriptText): Promise<string> {
        await pendingUpdate;
        cacheProjs[h.id] = {
            header: h,
            text,
            version: null // TODO @darzu: 
        }
        cacheModTime = Math.max(cacheModTime, h.modificationTime)
        const res = await ws.setAsync(h, prevVer, text)
        return res;
    }
    async function deleteAsync(h: Header, prevVer: Version): Promise<void> {
        await pendingUpdate;
        delete cacheProjs[h.id];
        // TODO @darzu: how to handle mod time with delete?
        // TODO @darzu: we should probably enforce soft delete everywhere...
        cacheModTime = Math.max(cacheModTime, h.modificationTime) 
        const res = await ws.deleteAsync(h, prevVer)
        return res;
    }
    async function resetAsync() {
        await pendingUpdate;
        eraseCache();
        await ws.resetAsync()
    }

    const provider: CachedWorkspaceProvider = {
        // cache
        getLastModTime,
        updateCache,
        lastHeaders: () => cacheHdrs,
        firstSync: () => firstUpdate,
        // workspace
        getAsync,
        setAsync,
        deleteAsync,
        listAsync,
        resetAsync,
    }

    return provider;
}

interface CloudSyncWorkspace extends WorkspaceProvider {
}

function createCloudSyncWorkspace(cloud: WorkspaceProvider, cloudLocal: WorkspaceProvider) {
    let lastHdrs: Header[] = []
    let lastHdrsMap: {[key: string]: Header};
    let lastProjs: {[key: string]: F};
    let lastSync: number = null;

    async function memCacheInvalidate() {
        // TODO @darzu: short circuit if full sync ?
        await synchronize();
    }
    async function listAsync(): Promise<Header[]> {
        if (!lastSync || !lastHdrs.length)
            await synchronize();
        return lastHdrs;
    }
    async function getAsync(h: Header): Promise<F> {
        if (!lastSync)
            await synchronize();
        if (lastProjs[h.id]) {
            // cache hit
            // TODO @darzu: this isn't good for multi-tabs maybe ?
            return lastProjs[h.id]
        }
        const res = await cloudLocal.getAsync(h)
        lastProjs[h.id] = res
        return res;
    }
    async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<string> {
        if (!lastSync)
            await synchronize();
        lastProjs[h.id] = {
            header: h,
            version: undefined, // TODO @darzu: 
            text,
        }
        const l = cloud.setAsync(h, prevVer, text)
        // TODO @darzu: wait for cloud?
        const r = cloudLocal.setAsync(h, prevVer, text)
        return await r
    }
    async function deleteAsync(h: Header, prevVer: any): Promise<void> {
        if (!lastSync)
            await synchronize();
        throw "not impl"
    }
    async function resetAsync() {
        if (!lastSync)
            await synchronize();
        throw "not impl"
    }

    function resolveConflict(a: Header, b: Header, strat: ConflictStrategy): Header {
        if (strat === ConflictStrategy.LastWriteWins)
            return a.modificationTime > b.modificationTime ? a : b;
        U.unreachable(strat);
    }
    async function transfer(h: Header, fromWs: WorkspaceProvider, toWs: WorkspaceProvider): Promise<Header> {
        const fromPrj = await fromWs.getAsync(h)
        
        // TODO @darzu: 
        lastProjs[h.id] = fromPrj;

        const prevVersion: Version = null // TODO @darzu: what do we do with this version thing...
        const toRes: Version = await toWs.setAsync(h, prevVersion, fromPrj.text)
        return h;
    }
    async function synchronize(): Promise<void> {
        // TODO @darzu: re-generalize?
        const left = cloud;
        const right = cloudLocal;
        const strat = {
            conflict: ConflictStrategy.LastWriteWins,
            disjointSets: DisjointSetsStrategy.Synchronize
        }

        // TODO @darzu: short circuit if there aren't changes ?
        const lHdrsList = await left.listAsync()
        const rHdrsList = await right.listAsync()        

        const lHdrs = U.toDictionary(lHdrsList, h => h.id)
        const rHdrs = U.toDictionary(rHdrsList, h => h.id)
        const allHdrsList = [...lHdrsList, ...rHdrsList]
    
        // determine left-only, overlap, and right-only sets
        const overlap = allHdrsList.reduce(
            (p: {[key: string]: Header}, n) => lHdrs[n.id] && rHdrs[n.id] ? (p[n.id] = n) && p : p, {})
        const lOnly = allHdrsList.reduce(
            (p: {[key: string]: Header}, n) => lHdrs[n.id] && !rHdrs[n.id] ? (p[n.id] = n) && p : p, {})
        const rOnly = allHdrsList.reduce(
            (p: {[key: string]: Header}, n) => !lHdrs[n.id] && rHdrs[n.id] ? (p[n.id] = n) && p : p, {})
    
        // resolve conflicts
        const conflictResults = U.values(overlap).map(h => resolveConflict(lHdrs[h.id], rHdrs[h.id], strat.conflict))
        
        // update left
        const lChanges = conflictResults.reduce((p: Header[], n) => hasChanged(n, lHdrs[n.id]) ? [...p, n] : p, [])
        let lToPush = lChanges
        if (strat.disjointSets === DisjointSetsStrategy.Synchronize)
            lToPush = [...lToPush, ...U.values(rOnly)]
        const lPushPromises = lToPush.map(h => transfer(h, right, left))
        
        // update right
        const rChanges = conflictResults.reduce((p: Header[], n) => hasChanged(n, rHdrs[n.id]) ? [...p, n] : p, [])
        let rToPush = rChanges
        if (strat.disjointSets === DisjointSetsStrategy.Synchronize)
            rToPush = [...rToPush, ...U.values(lOnly)]
        const rPushPromises = rToPush.map(h => transfer(h, left, right))
    
        // wait
        // TODO @darzu: batching? throttling? incremental?
        const changed = await Promise.all([...lPushPromises, ...rPushPromises])
    
        // return final results
        const lRes = [...U.values(lOnly), ...lToPush]
        const rRes = [...U.values(rOnly), ...rToPush]

        // TODO @darzu: 
        lastHdrs = lRes;
        lastHdrsMap = U.toDictionary(lastHdrs, h => h.id)
        lastSync = Date.now()

        return;
    }
 
     const provider: CloudSyncWorkspace = {
         getAsync,
         setAsync,
         deleteAsync,
         listAsync,
         resetAsync,
     }

     return provider;
}

// TODO @darzu: below is the code for multi-tab synchronizing

// // this key is the max modificationTime value of the allHeaders
// // it is used to track if allHeaders need to be refreshed (syncAsync)
// let sessionID: string = "";
// export function isHeadersSessionOutdated() {
//     return pxt.storage.getLocal('workspacesessionid') != sessionID;
// }
// function maybeSyncHeadersAsync(): Promise<void> {
//     if (isHeadersSessionOutdated()) // another tab took control
//         return syncAsync().then(() => { })
//     return Promise.resolve();
// }
// function refreshHeadersSession() {
//     // TODO @darzu: carefully handle this
//     // use # of scripts + time of last mod as key
//     sessionID = allScripts.length + ' ' + allScripts
//         .map(h => h.header.modificationTime)
//         .reduce((l, r) => Math.max(l, r), 0)
//         .toString()
//     if (isHeadersSessionOutdated()) {
//         pxt.storage.setLocal('workspacesessionid', sessionID);
//         pxt.debug(`workspace: refreshed headers session to ${sessionID}`);
//         data.invalidate("header:*");
//         data.invalidate("text:*");
//     }
// }
// // this is an identifier for the current frame
// // in order to lock headers for editing
// const workspaceID: string = pxt.Util.guidGen();
// export function acquireHeaderSession(h: Header) {
//     if (h)
//         pxt.storage.setLocal('workspaceheadersessionid:' + h.id, workspaceID);
// }
// function clearHeaderSession(h: Header) {
//     if (h)
//         pxt.storage.removeLocal('workspaceheadersessionid:' + h.id);
// }
// export function isHeaderSessionOutdated(h: Header): boolean {
//     if (!h) return false;
//     const sid = pxt.storage.getLocal('workspaceheadersessionid:' + h.id);
//     return sid && sid != workspaceID;
// }
// function checkHeaderSession(h: Header): void {
//     if (isHeaderSessionOutdated(h)) {
//         pxt.tickEvent(`workspace.conflict.header`);
//         core.errorNotification(lf("This project is already opened elsewhere."))
//         pxt.Util.assert(false, "trying to access outdated session")
//     }
// }

// TODO @darzu: from webapp:
// loadHeaderAsync(h: pxt.workspace.Header, editorState?: pxt.editor.EditorState): Promise<void> {
//     if (!h)
//         return Promise.resolve()

//     const checkAsync = this.tryCheckTargetVersionAsync(h.targetVersion);
//     if (checkAsync)
//         return checkAsync.then(() => this.openHome());

//     let p = Promise.resolve();
//     if (workspace.isHeadersSessionOutdated()) { // reload header before loading
//         pxt.log(`sync before load`)
//         p = p.then(() => workspace.syncAsync().then(() => { }))
//     }
//     return p.then(() => {
//         workspace.acquireHeaderSession(h);
//         if (!h) return Promise.resolve();
//         else return this.internalLoadHeaderAsync(h, editorState);
//     })
// }