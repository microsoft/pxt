import { BrowserDbWorkspaceProvider, createBrowserDbWorkspace } from "./browserdbworkspace";

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

let currentDb: BrowserDbWorkspaceProvider;
async function init() {
    if (!currentDb) {
        currentDb = await createAndMigrateBrowserDb();
    }
}

async function migrateProject(fromWs: WorkspaceProvider, newWs: WorkspaceProvider, h: pxt.workspace.Header): Promise<string> {
    const old = await fromWs.getAsync(h)
    // Ignore metadata of the previous script so they get re-generated for the new copy
    delete (<any>h)._id;
    delete (<any>h)._rev;
    return await newWs.setAsync(h, undefined, old.text)
};

const getVersionedDbPrefix = (majorVersion: number) => {
    return pxt.appTarget.appTheme.browserDbPrefixes && pxt.appTarget.appTheme.browserDbPrefixes[majorVersion];
}
const getCurrentDbPrefix = () => {
    const currentVersion = pxt.semver.parse(pxt.appTarget.versions.target);
    const currentMajor = currentVersion.major;
    const currentDbPrefix = getVersionedDbPrefix(currentMajor);
    return currentDbPrefix
}
const getPreviousDbPrefix = () => {
    // No headers using this prefix yet, attempt to migrate headers from previous major version (or default tables)
    const currentVersion = pxt.semver.parse(pxt.appTarget.versions.target);
    const currentMajor = currentVersion.major;
    const previousMajor = currentMajor - 1;
    const previousDbPrefix = previousMajor < 0 ? "" : getVersionedDbPrefix(previousMajor);
    return previousDbPrefix
}

async function createAndMigrateBrowserDb(): Promise<BrowserDbWorkspaceProvider> {
    console.log("BAD createAndMigrateBrowserDb") // TODO @darzu: trace
    const currentDbPrefix = getCurrentDbPrefix();
    let currDb: BrowserDbWorkspaceProvider;
    if (currentDbPrefix) {
        currDb = createBrowserDbWorkspace(currentDbPrefix);
    } else {
        // This version does not use a prefix for storing projects, so just use default tables
        currDb = createBrowserDbWorkspace("");
        return currDb;
    }

    const currHeaders = await currDb.listAsync()
    if (currHeaders.length) {
        // There are already scripts using the prefix, so a migration has already happened
        return currDb;
    }

    // Do a migration
    const prevDbPrefix = getPreviousDbPrefix();
    let prevDb: BrowserDbWorkspaceProvider;
    if (prevDbPrefix) {
        prevDb = createBrowserDbWorkspace(prevDbPrefix);
    } else {
        prevDb = createBrowserDbWorkspace("");
    }
    const prevHeaders = await prevDb.listAsync()
    prevHeaders.forEach(h => migrateProject(prevDb, currDb, h));

    return currDb;
}

export async function copyProjectToLegacyEditor(h: Header, majorVersion: number): Promise<Header> {
    console.log("BAD copyProjectToLegacyEditor") // TODO @darzu: trace
    await init();

    const prefix = getVersionedDbPrefix(majorVersion);
    const oldDb = createBrowserDbWorkspace(prefix || "");

    // clone header
    const header = pxt.Util.clone(h);
    delete (header as any)._id;
    delete header._rev;
    header.id = pxt.Util.guidGen();

    const resp = await currentDb.getAsync(h)
    const rev = await oldDb.setAsync(header, undefined, resp.text)
    return header
}

// TODO @darzu: might be a better way to provide this wrapping and handle the migration
// TODO @darzu: export
const provider: WorkspaceProvider = {
    listAsync: async () => {
        await init();
        return currentDb.listAsync();
    },
    getAsync: async (h: Header) => {
        await init();
        return currentDb.getAsync(h);
    },
    setAsync: async (h: Header, prevVersion: pxt.workspace.Version, text?: ScriptText) => {
        await init();
        console.log("BAD setAsync") // TODO @darzu: tracing usage
        return currentDb.setAsync(h, prevVersion, text);
    },
    deleteAsync: async (h: Header, prevVersion: pxt.workspace.Version) => {
        await init();
        return currentDb.deleteAsync(h, prevVersion);
    },
    resetAsync: async () => {
        await init();
        return currentDb.resetAsync();
    }
}