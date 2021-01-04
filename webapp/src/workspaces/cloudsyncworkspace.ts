import { ConflictStrategy, DisjointSetsStrategy, Strategy } from "./workspacebehavior";
import U = pxt.Util;

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WsFile = pxt.workspace.File;
type Version = pxt.workspace.Version;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

// TODO @darzu: BIG TODOs
// [ ] cache invalidation via header sessions
// [ ] enforce soft-delete
//      pouchdb uses _delete for soft delete
// [ ] error handling: conflicts returned as "undefined"; other errors propegate as exceptions

export interface CachedWorkspaceProvider extends WorkspaceProvider {
    getHeadersHash(): string,
    synchronize(reason: SynchronizationReason): Promise<Header[]>, // TODO @darzu: name syncAsync?
    pendingSync(): Promise<Header[]>,
    firstSync(): Promise<Header[]>,
    listSync(): Header[],
    getHeaderSync(id: string): Header,
    tryGetSync(h: Header): WsFile
}

// TODO @darzu: \/ \/ \/ thread through
export interface SynchronizationReason {
    expectedHeadersHash?: string,
    pollStorage?: boolean,
}

function computeHeadersHash(hdrs: Header[]): string {
    // TODO @darzu: should we just do an actual hash?
    //          [ ] measure perf difference
    //          [ ] maybe there are some fields we want to ignore; if so, these should likely be moved out of Header interface
    return hdrs.length + ' ' + hdrs // TODO @darzu: [ ] use the length component in the workspace internals?
        .map(h => h.modificationTime)
        .reduce((l, r) => Math.max(l, r), 0)
}

function hasChanged(a: Header, b: Header): boolean {
    // TODO @darzu: use e-tag, _rev, version uuid, or hash instead?
    return (!!a !== !!b) || a?.modificationTime !== b?.modificationTime
}

// TODO @darzu: use cases: multi-tab and cloud
export function createCachedWorkspace(ws: WorkspaceProvider): CachedWorkspaceProvider {
    let cacheHdrs: Header[] = []
    let cacheHdrsMap: {[id: string]: Header} = {};
    let cacheProjs: {[id: string]: WsFile} = {};

    // TODO @darzu: thinking through workspace sessions
    //      per header locks?
    //      for all headers?
    // const workspaceID: string = pxt.Util.guidGen();
    // pxt.storage.setLocal('workspaceheadersessionid:' + h.id, workspaceID);
    // pxt.storage.removeLocal('workspaceheadersessionid:' + h.id);
    // const sid = pxt.storage.getLocal('workspaceheadersessionid:' + h.id);

    let cacheHdrsHash: string = "";
    function getHeadersHash(): string {
        return cacheHdrsHash;
    }

    // TODO @darzu: do we want to kick off the first sync at construction? Side-effects at construction are usually bad..
    const firstUpdate = synchronizeInternal({ pollStorage: true });
    let pendingUpdate = firstUpdate;
    async function synchronize(reason: SynchronizationReason): Promise<Header[]> {
        if (pendingUpdate.isPending())
            return pendingUpdate
        pendingUpdate = synchronizeInternal(reason)
        return pendingUpdate
    }

    function eraseCache() {
        console.log("cachedworkspace: eraseCache") // TODO @darzu: dbg
        cacheHdrs = []
        cacheHdrsMap = {}
        cacheProjs = {}
        cacheHdrsHash = ""
    }

    async function synchronizeInternal(reason: SynchronizationReason): Promise<Header[]> {
        // remember our old cache, we might keep items from it later
        const oldHdrs = cacheHdrs
        const oldHdrsMap = cacheHdrsMap
        const oldProjs = cacheProjs
        const oldHdrsHash = cacheHdrsHash

        const hashDesync = reason.expectedHeadersHash && reason.expectedHeadersHash !== cacheHdrsHash
        const needSync = !cacheHdrsHash || hashDesync || reason.pollStorage;
        if (hashDesync) {
            // TODO @darzu: does this buy us anything?
            eraseCache()
        } else if (!needSync) {
            return []
        }

        const newHdrs = await ws.listAsync()
        const newHdrsHash = computeHeadersHash(newHdrs);
        if (newHdrsHash === oldHdrsHash) {
            // no change, keep the old cache
            cacheHdrs = oldHdrs
            cacheHdrsMap = oldHdrsMap
            cacheProjs = oldProjs
            return []
        }
        console.log("cachedworkspace: synchronizeInternal (1)") // TODO @darzu: dbg

        // compute header differences and clear old cache entries
        const newHdrsMap = U.toDictionary(newHdrs, h => h.id)
        const changedHdrIds = U.unique([...oldHdrs, ...newHdrs], h => h.id).map(h => h.id)
            .filter(id => hasChanged(oldHdrsMap[id], newHdrsMap[id]))
        const newProjs = oldProjs // TODO @darzu: is there any point in copying here?
        for (let id of changedHdrIds) {
            if (id in newProjs) {
                console.log(`cache invalidating ${id} because:`) // TODO @darzu: dbg
                console.dir({ old: (oldHdrsMap[id]), new: (newHdrsMap[id]) })
                delete newProjs[id]
            }
        }

        // save results
        cacheHdrsHash = newHdrsHash
        cacheProjs = newProjs
        cacheHdrs = newHdrs
        cacheHdrsMap = newHdrsMap
        return changedHdrIds.map(i => newHdrsMap[i]);
    }

    async function listAsync(): Promise<Header[]> {
        await pendingUpdate;
        return cacheHdrs
    }
    async function getAsync(h: Header): Promise<WsFile> {
        // TODO @darzu: should the semantics of this check the header version?
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
        if (text) {
            // update cached projects
            cacheProjs[h.id] = {
                header: h,
                text,
                version: prevVer
            }
        }
        // update headers list, map and hash
        if (!cacheHdrsMap[h.id]) {
            cacheHdrs.push(h)
        }
        cacheHdrsMap[h.id] = h
        cacheHdrsHash = computeHeadersHash(cacheHdrs)
        // send update to backing storage
        const res = await ws.setAsync(h, prevVer, text)
        if (res) {
            if (text) {
                // update cached project
                cacheProjs[h.id] = {
                    header: h,
                    text,
                    version: res
                }
            }
        } else {
            // conflict; delete cache
            delete cacheProjs[h.id]
            // TODO @darzu: fix header(s) after conflict ?
        }
        return res;
    }
    async function deleteAsync(h: Header, prevVer: Version): Promise<void> {
        await pendingUpdate;
        // update cached projects
        delete cacheProjs[h.id];
        // update headers list, map and hash
        delete cacheHdrsMap[h.id];
        cacheHdrs = cacheHdrs.filter(r => r.id === h.id);
        cacheHdrsHash = computeHeadersHash(cacheHdrs);
        // send update to backing storage
        await ws.deleteAsync(h, prevVer)
        // TODO @darzu: fix header(s) after conflict ?
    }
    async function resetAsync() {
        await pendingUpdate;
        eraseCache();
        await ws.resetAsync()
    }

    const provider: CachedWorkspaceProvider = {
        // cache
        getHeadersHash,
        synchronize,
        pendingSync: () => pendingUpdate,
        firstSync: () => firstUpdate,
        listSync: () => cacheHdrs,
        tryGetSync: h => cacheProjs[h.id],
        getHeaderSync: id => cacheHdrsMap[id],
        // workspace
        getAsync,
        setAsync,
        deleteAsync,
        listAsync,
        resetAsync,
    }

    return provider;
}

// TODO @darzu: dbging helper
export function toDbg(h: Header) {
    return {n: h.name, t: h.modificationTime, del: h.isDeleted, id: h.id}
}

export interface CloudSyncWorkspace extends CachedWorkspaceProvider {
}

export function createCloudSyncWorkspace(cloud: WorkspaceProvider, cloudLocal: WorkspaceProvider): CloudSyncWorkspace {
    const cloudCache = createCachedWorkspace(cloud);
    const localCache = createCachedWorkspace(cloudLocal);

    const firstCachePull = Promise.all([cloudCache.firstSync(), localCache.firstSync()])
    const pendingCacheSync = () => Promise.all([cloudCache.pendingSync(), localCache.pendingSync()])
    const getHeadersHash = () => localCache.getHeadersHash()
    const needsSync = () => cloudCache.getHeadersHash() !== localCache.getHeadersHash()

    // TODO @darzu: we could frequently check the last mod times to see if a sync is in order?

    // TODO @darzu: multi-tab safety for cloudLocal
    // TODO @darzu: when two workspaces disagree on last mod time, we should sync?

    const firstSync = synchronizeInternal({pollStorage: true});;
    let pendingSync = firstSync;

    async function synchronize(reason: SynchronizationReason): Promise<Header[]> {
        if (pendingSync.isPending())
            return pendingSync
        pendingSync = synchronizeInternal(reason)
        return pendingSync
    }

    function resolveConflict(a: Header, b: Header, strat: ConflictStrategy): Header {
        // TODO @darzu: involve the user
        // TODO @darzu: consider lineage
        // TODO @darzu: consider diff
        if (strat === ConflictStrategy.LastWriteWins)
            return a.modificationTime > b.modificationTime ? a : b;
        U.unreachable(strat);
    }
    async function transfer(fromH: Header, toH: Header, fromWs: WorkspaceProvider, toWs: WorkspaceProvider): Promise<Header> {
        // TODO @darzu: worklist this?
        // TODO @darzu: track pending saves

        // TODO @darzu: dbg
        console.log(`transfer ${fromH.id}(${fromH.modificationTime},${fromH._rev}) => (${toH?.modificationTime},${toH?._rev})`)

        const newPrj = await fromWs.getAsync(fromH)

        // we need the old project if any exists so we know what prevVersion to pass
        // TODO @darzu: keep project text version in the header
        let prevVer = undefined
        if (toH) {
            const oldPrj = await toWs.getAsync(toH)
            if (oldPrj)
                prevVer = oldPrj.version
        }

        // create a new header
        // TODO @darzu: how do we do this in an abstraction preserving way?
        const newH = {...fromH, _rev: toH?._rev ?? undefined}
        delete (newH as any)["_id"]

        const newVer = await toWs.setAsync(newH, prevVer, newPrj.text)

        return newH;
    }
    async function synchronizeInternal(reason: SynchronizationReason): Promise<Header[]> {
        console.log("cloudsyncworkspace: synchronizeInternal")
        console.dir(reason)

        // TODO @darzu: review these cases:
        // case 1: everything should be synced up, we're just polling the server
        //      expectedLastModTime = 0
        //      we definitely want cloudCache to synchronize
        //      we don't need localCache to synchronize
        //      we want to wait on localCache.pendingSync
        // case 2: we suspect localCache is out of date (from other tab changes)
        //      expectedLastModTime = someValueFromOtherTab
        //      we don't need cloudCache to synchronize
        //      we definitely want localCache to synchronize
        //      we want to wait on cloudCache.pendingSync
        // case 3: createCloudSyncWorkspace is first called (first sync)
        //      expectedLastModTime = 0
        //      we don't need cloudCache to synchronize
        //      we don't need localCache to synchronize
        //      we want to wait on localCache.pendingSync
        // TODO @darzu: need to think through and compare how this would work with git

        // wait for each side to sync
        await Promise.all([cloudCache.synchronize(reason), localCache.synchronize(reason)])

        // TODO @darzu: re-generalize?
        const left = cloudCache;
        const right = localCache;
        const strat = {
            conflict: ConflictStrategy.LastWriteWins,
            disjointSets: DisjointSetsStrategy.Synchronize
        }

        const lHdrsList = left.listSync()
        const rHdrsList = right.listSync()

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
        const lPushPromises = lToPush.map(h => transfer(rHdrs[h.id], lHdrs[h.id], right, left))

        // update right
        const rChanges = conflictResults.reduce((p: Header[], n) => hasChanged(n, rHdrs[n.id]) ? [...p, n] : p, [])
        let rToPush = rChanges
        if (strat.disjointSets === DisjointSetsStrategy.Synchronize)
            rToPush = [...rToPush, ...U.values(lOnly)]
        const rPushPromises = rToPush.map(h => transfer(lHdrs[h.id], rHdrs[h.id], left, right))

        // wait
        // TODO @darzu: worklist? batching? throttling? incremental?
        const allPushes = await Promise.all([...lPushPromises, ...rPushPromises])
        const changes = U.unique(allPushes, h => h.id)

        // TODO @darzu: what about mod time changes?
        return changes
    }

    async function listAsync(): Promise<Header[]> {
        await pendingSync
        return localCache.listAsync()
    }
    async function getAsync(h: Header): Promise<WsFile> {
        await pendingSync
        return localCache.getAsync(h)
    }
    async function setAsync(h: Header, prevVer: any, text?: ScriptText): Promise<string> {
        await pendingSync
        // TODO @darzu: cannot pass prevVer to both of these.. they have different meanings on the different platforms
        // TODO @darzu: use a queue to sync to backend and make sure this promise is part of the pending sync set
        const cloudPromise = cloudCache.setAsync(h, prevVer, text)
        // TODO @darzu: also what to do with the return value ?
        return await localCache.setAsync(h, prevVer, text)
    }
    async function deleteAsync(h: Header, prevVer: any): Promise<void> {
        await pendingSync
        // TODO @darzu: use a queue to sync to backend
        const cloudPromise = cloudCache.deleteAsync(h, prevVer)
        await localCache.deleteAsync(h, prevVer)
    }
    async function resetAsync() {
        await pendingSync
        // TODO @darzu: do we really want to reset the cloud ever?
        // await Promise.all([cloudCache.resetAsync(), localCache.resetAsync()])
        return Promise.resolve();
    }


    // TODO @darzu: debug logging
    firstSync.then(c => {
        console.log("cloudSyncWS first update:")
        console.dir(localCache.listSync().map(toDbg))
    })

     const provider: CloudSyncWorkspace = {
        // cache
        getHeadersHash,
        synchronize,
        pendingSync: () => pendingSync,
        firstSync: () => firstSync,
        listSync: () => localCache.listSync(),
        tryGetSync: h => localCache.tryGetSync(h),
        getHeaderSync: id => localCache.getHeaderSync(id),
        // workspace
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