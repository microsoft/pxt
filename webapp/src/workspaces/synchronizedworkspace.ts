import { ConflictStrategy, DisjointSetsStrategy, Strategy, synchronize } from "./workspacebehavior";

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type File = pxt.workspace.File;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;


export interface Synchronizable {
    syncAsync(): Promise<void>
}

export function createSynchronizedWorkspace<T extends WorkspaceProvider>(primary: WorkspaceProvider, cache: T, strat: Strategy): T & Synchronizable {
    async function syncAsync() {
        // TODO @darzu: parameterize strategy?
        await synchronize(primary, cache, strat)
    }

    return {
        ...cache,
        // mutative operations should be kicked off for both
        setAsync: async (h, prevVersion, text) => {
            // TODO @darzu: don't push to both when disjoint sets strat isn't synchronize
            const a = primary.setAsync(h, prevVersion, text)
            const b = cache.setAsync(h, prevVersion, text)
            await Promise.all([a,b])
            return await a;
        },
        deleteAsync: async (h, prevVersion) => {
            const a = primary.deleteAsync(h, prevVersion)
            const b = cache.deleteAsync(h, prevVersion)
            await Promise.all([a,b])
            return await a;
        },
        syncAsync,
    };
}
