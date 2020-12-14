import { createMemWorkspace, SyncWorkspaceProvider } from "./memworkspace";
import { createSynchronizedWorkspace, Synchronizable } from "./synchronizedworkspace";
import U = pxt.Util;

type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type Header = pxt.workspace.Header;
type Version = pxt.workspace.Version;

// TODO @darzu: what I need from a header: modificationTime, isDeleted
// TODO @darzu: example:
const exampleRealHeader: Header & {_id: string, _rev: String} = {
    "name": "c2",
    "meta": {},
    "editor": "blocksprj",
    "pubId": "",
    "pubCurrent": false,
    "target": "arcade",
    "targetVersion": "1.3.17",
    "cloudUserId": "3341c114-06d5-4ca5-9c2b-b9bb4fb13e81",
    "id": "3a30f274-9612-4184-d9ad-e14c99cf81e7",
    "recentUse": 1607395785,
    "modificationTime": 1607395785,
    "path": "c2",
    "blobCurrent_": false,
    "saveId": null,
    "githubCurrent": false,
    "cloudCurrent": true,
    "cloudVersion": "\"4400a5b3-0000-0100-0000-5fcee9bd0000\"",
    "_id": "header--3a30f274-9612-4184-d9ad-e14c99cf81e7",
    "_rev": "12-b259964d5d245a44f7141b7c5c41ca23", // TODO @darzu: gotta figure out _rev and _id ...
    // TODO @darzu: these are missing in the real header!!
    isDeleted: false,
    blobId_: null,
    blobVersion_: null,
};

export enum ConflictStrategy {
    LastWriteWins
}
export enum DisjointSetsStrategy {
    Synchronize,
    DontSynchronize
}

export interface Strategy {
    conflict: ConflictStrategy,
    disjointSets: DisjointSetsStrategy
}

function resolveConflict(a: Header, b: Header, strat: ConflictStrategy): Header {
    if (strat === ConflictStrategy.LastWriteWins)
        return a.modificationTime > b.modificationTime ? a : b;
    U.unreachable(strat);
}

function hasChanged(a: Header, b: Header): boolean {
    // TODO @darzu: use version uuid instead?
    return a.modificationTime !== b.modificationTime
}

async function transfer(h: Header, fromWs: WorkspaceProvider, toWs: WorkspaceProvider): Promise<Header> {
    const fromPrj = await fromWs.getAsync(h)
    const prevVersion: Version = null // TODO @darzu: what do we do with this version thing...
    const toRes: Version = await toWs.setAsync(h, prevVersion, fromPrj.text)
    return h;
}

export interface SyncResult {
    changed: Header[],
    left: Header[],
    right: Header[],
}

// TODO @darzu: this has been moved into cloudsync workspace.. not sure it's still needed here
export async function synchronize(left: WorkspaceProvider, right: WorkspaceProvider, strat: Strategy): Promise<SyncResult> {
    // TODO @darzu: add "on changes identified" handler so we can show in-progress syncing

    // TODO @darzu: thoughts & notes
    // idea: never delete, only say "isDeleted" is true; can optimize away later
    /*
    sync scenarios:
        cloud & cloud cache (last write wins;
        any workspace & memory workspace (memory leads)

    synchronization strategies:
        local & remote cloud
            local wins? cloud wins?
            last write wins? UTC timestamp?
        primary & secondary
            primary always truth ?
    */

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
    return {
        changed,
        left: lRes,
        right: rRes
    }
}

export function wrapInMemCache(ws: WorkspaceProvider): SyncWorkspaceProvider & WorkspaceProvider & Synchronizable {
    return createSynchronizedWorkspace(ws, createMemWorkspace(), {
        conflict: ConflictStrategy.LastWriteWins,
        disjointSets: DisjointSetsStrategy.Synchronize
    });
}

export async function migrateOverlap(fromWs: WorkspaceProvider, toWs: WorkspaceProvider) {
    // TODO @darzu:
}