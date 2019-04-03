/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />
/// <reference path="../../built/pxtwinrt.d.ts" />

import * as db from "./db";
import * as core from "./core";
import * as data from "./data";
import * as cloudworkspace from "./browserworkspace"
import * as fileworkspace from "./fileworkspace"
import * as memoryworkspace from "./memoryworkspace"
import * as iframeworkspace from "./iframeworkspace"
import * as cloudsync from "./cloudsync"
import * as indexedDBWorkspace from "./idbworkspace";
import * as compiler from "./compiler"

import U = pxt.Util;
import Cloud = pxt.Cloud;

// Avoid importing entire crypto-js
/* tslint:disable:no-submodule-imports */
const sha1 = require("crypto-js/sha1");

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

interface HeaderWithScript {
    header: Header;
    text: ScriptText;
    version: pxt.workspace.Version;
}

let allScripts: HeaderWithScript[] = [];

let headerQ = new U.PromiseQueue();

let impl: WorkspaceProvider;
let implType: string;

function lookup(id: string) {
    return allScripts.filter(x => x.header.id == id || x.header.path == id)[0]
}

export function gitsha(data: string) {
    return (sha1("blob " + U.toUTF8(data).length + "\u0000" + data) + "")
}

export function copyProjectToLegacyEditor(header: Header, majorVersion: number): Promise<Header> {
    if (!isBrowserWorkspace()) {
        return Promise.reject("Copy operation only works in browser workspace");
    }
    return cloudworkspace.copyProjectToLegacyEditor(header, majorVersion);
}

export function setupWorkspace(id: string) {
    U.assert(!impl, "workspace set twice");
    pxt.log(`workspace: ${id}`);
    implType = id;
    switch (id) {
        case "fs":
        case "file":
            impl = fileworkspace.provider;
            break;
        case "mem":
        case "memory":
            impl = memoryworkspace.provider;
            break;
        case "iframe":
            impl = iframeworkspace.provider;
            break;
        case "uwp":
            fileworkspace.setApiAsync(pxt.winrt.workspace.fileApiAsync);
            impl = pxt.winrt.workspace.getProvider(fileworkspace.provider);
            break;
        case "idb":
            impl = indexedDBWorkspace.provider;
            break;
        case "cloud":
        case "browser":
        default:
            impl = cloudworkspace.provider
            break;
    }
}

export function getHeaders(withDeleted = false) {
    checkSession();
    let r = allScripts.map(e => e.header).filter(h => (withDeleted || !h.isDeleted) && !h.isBackup)
    r.sort((a, b) => b.recentUse - a.recentUse)
    return r
}

export function makeBackupAsync(h: Header, text: ScriptText): Promise<Header> {
    let h2 = U.flatClone(h)
    h2.id = U.guidGen()

    delete h2._rev
    delete (h2 as any)._id
    h2.isBackup = true;

    return importAsync(h2, text)
        .then(() => {
            h.backupRef = h2.id;
            return saveAsync(h2);
        })
        .then(() => h2)
}


export function restoreFromBackupAsync(h: Header) {
    if (!h.backupRef || h.isDeleted) return Promise.resolve();

    const refId = h.backupRef;
    return getTextAsync(refId)
        .then(files => {
            delete h.backupRef;
            return saveAsync(h, files);
        })
        .then(() => {
            const backup = getHeader(refId);
            backup.isDeleted = true;
            return saveAsync(backup);
        })
        .catch(() => {
            delete h.backupRef;
            return saveAsync(h);
        });
}

export function cleanupBackupsAsync() {
    checkSession();
    const allHeaders = allScripts.map(e => e.header);

    const refMap: pxt.Map<boolean> = {};

    // Figure out which scripts have backups
    allHeaders.filter(h => h.backupRef).forEach(h => refMap[h.backupRef] = true);

    // Delete the backups that don't have any scripts referencing them
    return Promise.all(allHeaders.filter(h => (h.isBackup && !refMap[h.id])).map(h => {
        h.isDeleted = true;
        return saveAsync(h);
    }));
}

export function getHeader(id: string) {
    checkSession();
    let e = lookup(id)
    if (e && !e.header.isDeleted)
        return e.header
    return null
}

let sessionID: string;
export function isSessionOutdated() {
    return pxt.storage.getLocal('pxt_workspace_session_id') != sessionID;
}
function checkSession() {
    if (isSessionOutdated()) {
        pxt.Util.assert(false, "trying to access outdated session")
    }
}

export function initAsync() {
    if (!impl) impl = cloudworkspace.provider;

    // generate new workspace session id to avoid races with other tabs
    sessionID = ts.pxtc.Util.guidGen();
    pxt.storage.setLocal('pxt_workspace_session_id', sessionID);
    pxt.debug(`workspace session: ${sessionID}`);

    allScripts = []

    return syncAsync()
        .then(state => cleanupBackupsAsync().then(() => state));
}

export function getTextAsync(id: string): Promise<ScriptText> {
    checkSession();

    let e = lookup(id)
    if (!e)
        return Promise.resolve(null as ScriptText)
    if (e.text)
        return Promise.resolve(e.text)
    return headerQ.enqueue(id, () => impl.getAsync(e.header)
        .then(resp => {
            if (!e.text) {
                // otherwise we were beaten to it
                e.text = fixupFileNames(resp.text);
            }
            e.version = resp.version;
            return e.text
        }))
}

export interface ScriptMeta {
    description: string;
    blocksWidth?: number;
    blocksHeight?: number;
}

// https://github.com/Microsoft/pxt-backend/blob/master/docs/sharing.md#anonymous-publishing
export function anonymousPublishAsync(h: Header, text: ScriptText, meta: ScriptMeta, screenshotUri?: string) {
    const saveId = {}
    h.saveId = saveId
    let thumbnailBuffer: string;
    let thumbnailMimeType: string;
    if (screenshotUri) {
        const m = /^data:(image\/(png|gif));base64,([a-zA-Z0-9+/]+=*)$/.exec(screenshotUri);
        if (m) {
            thumbnailBuffer = m[3];
            thumbnailMimeType = m[1];
        }
    }
    const stext = JSON.stringify(text, null, 2) + "\n"
    const scrReq = {
        name: h.name,
        target: h.target,
        targetVersion: h.targetVersion,
        description: meta.description || lf("Made with ❤️ in {0}.", pxt.appTarget.title || pxt.appTarget.name),
        editor: h.editor,
        text: text,
        meta: {
            versions: pxt.appTarget.versions,
            blocksHeight: meta.blocksHeight,
            blocksWidth: meta.blocksWidth
        },
        thumbnailBuffer,
        thumbnailMimeType
    }
    pxt.debug(`publishing script; ${stext.length} bytes`)
    return Cloud.privatePostAsync("scripts", scrReq, /* forceLiveEndpoint */ true)
        .then((inf: Cloud.JsonScript) => {
            if (inf.shortid) inf.id = inf.shortid;
            h.pubId = inf.shortid
            h.pubCurrent = h.saveId === saveId
            h.meta = inf.meta;
            pxt.debug(`published; id /${h.pubId}`)
            return saveAsync(h)
                .then(() => inf)
        })
}

function fixupVersionAsync(e: HeaderWithScript) {
    if (e.version !== undefined)
        return Promise.resolve()
    return impl.getAsync(e.header)
        .then(resp => {
            e.version = resp.version;
        })
}

export function saveAsync(h: Header, text?: ScriptText, isCloud?: boolean): Promise<void> {
    checkSession();
    U.assert(h.target == pxt.appTarget.id);

    if (h.temporary)
        return Promise.resolve()

    let e = lookup(h.id)
    U.assert(e.header === h)

    if (!isCloud)
        h.recentUse = U.nowSeconds()

    if (text || h.isDeleted) {
        if (text)
            e.text = text
        if (!isCloud) {
            h.pubCurrent = false
            h.blobCurrent = false
            h.modificationTime = U.nowSeconds();
            h.targetVersion = h.targetVersion || "0.0.0";
        }
        h.saveId = null
        // update version on save
    }

    // perma-delete
    if (h.isDeleted && h.blobVersion == "DELETED") {
        let idx = allScripts.indexOf(e)
        U.assert(idx >= 0)
        allScripts.splice(idx, 1)
        return headerQ.enqueue(h.id, () =>
            fixupVersionAsync(e).then(() =>
                impl.deleteAsync ? impl.deleteAsync(h, e.version) : impl.setAsync(h, e.version, {})))
    }

    // check if we have dynamic boards, store board info for home page rendering
    if (text && pxt.appTarget.simulator && pxt.appTarget.simulator.dynamicBoardDefinition) {
        const pxtjson = ts.pxtc.Util.jsonTryParse(text["pxt.json"]) as pxt.PackageConfig;
        if (pxtjson && pxtjson.dependencies)
            h.board = Object.keys(pxtjson.dependencies)
                .filter(p => !!pxt.bundledSvg(p))[0];
    }

    return headerQ.enqueue<void>(h.id, () =>
        fixupVersionAsync(e).then(() =>
            impl.setAsync(h, e.version, text ? e.text : null)
                .then(ver => {
                    if (text)
                        e.version = ver
                    if (text || h.isDeleted) {
                        h.pubCurrent = false
                        h.blobCurrent = false
                        h.saveId = null
                        data.invalidate("text:" + h.id)
                    }
                    data.invalidate("header:" + h.id)
                    data.invalidate("header:*")
                })))
}

function computePath(h: Header) {
    let path = h.name.replace(/[^a-zA-Z0-9]+/g, " ").trim().replace(/ /g, "-")
    if (!path)
        path = "Untitled"; // do not translate
    if (lookup(path)) {
        let n = 2
        while (lookup(path + "-" + n))
            n++;
        path += "-" + n
    }

    return path
}

export function importAsync(h: Header, text: ScriptText, isCloud = false) {
    h.path = computePath(h)
    const e: HeaderWithScript = {
        header: h,
        text: text,
        version: null
    }
    allScripts.push(e)
    return saveAsync(h, text, isCloud)
}

export function installAsync(h0: InstallHeader, text: ScriptText) {
    checkSession();
    U.assert(h0.target == pxt.appTarget.id);

    const h = <Header>h0
    h.id = ts.pxtc.Util.guidGen();
    h.recentUse = U.nowSeconds()
    h.modificationTime = h.recentUse;

    const cfg: pxt.PackageConfig = JSON.parse(text[pxt.CONFIG_NAME] || "{}")
    if (cfg.preferredEditor)
        h.editor = cfg.preferredEditor

    return importAsync(h, text)
        .then(() => h)
}

export function duplicateAsync(h: Header, text: ScriptText, rename?: boolean): Promise<Header> {
    let e = lookup(h.id)
    U.assert(e.header === h)
    let h2 = U.flatClone(h)
    e.header = h2

    h.id = U.guidGen()
    if (rename) {
        h.name = createDuplicateName(h);
        let cfg = JSON.parse(text[pxt.CONFIG_NAME]) as pxt.PackageConfig
        cfg.name = h.name
        text[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4)
    }
    delete h._rev
    delete (h as any)._id
    return importAsync(h, text)
        .then(() => h)
}

export function createDuplicateName(h: Header) {
    let reducedName = h.name.indexOf("#") > -1 ?
        h.name.substring(0, h.name.lastIndexOf('#')).trim() : h.name;
    let names = U.toDictionary(allScripts.filter(e => !e.header.isDeleted), e => e.header.name)
    let n = 2
    while (names.hasOwnProperty(reducedName + " #" + n))
        n++
    return reducedName + " #" + n;
}

export function saveScreenshotAsync(h: Header, data: string, icon: string) {
    checkSession();
    return impl.saveScreenshotAsync
        ? impl.saveScreenshotAsync(h, data, icon)
        : Promise.resolve();
}

export function fixupFileNames(txt: ScriptText) {
    if (!txt) return txt;
    ["kind.json", "yelm.json"].forEach(oldName => {
        if (!txt[pxt.CONFIG_NAME] && txt[oldName]) {
            txt[pxt.CONFIG_NAME] = txt[oldName]
            delete txt[oldName]
        }
    })
    return txt
}


const scriptDlQ = new U.PromiseQueue();
const scripts = new db.Table("script"); // cache for published scripts
//let scriptCache:any = {}
export function getPublishedScriptAsync(id: string) {
    checkSession();
    //if (scriptCache.hasOwnProperty(id)) return Promise.resolve(scriptCache[id])
    if (pxt.github.isGithubId(id))
        id = pxt.github.noramlizeRepoId(id)
    let eid = encodeURIComponent(id)
    return pxt.packagesConfigAsync()
        .then(config => scriptDlQ.enqueue(id, () => scripts.getAsync(eid)
            .then(v => v.files, e =>
                (pxt.github.isGithubId(id) ?
                    pxt.github.downloadPackageAsync(id, config).then(v => v.files) :
                    Cloud.downloadScriptFilesAsync(id))
                    .catch(core.handleNetworkError)
                    .then(files => scripts.setAsync({ id: eid, files: files })
                        .then(() => {
                            //return (scriptCache[id] = files)
                            return files
                        })))
            .then(fixupFileNames))
        );
}

export enum PullStatus {
    NoSourceControl,
    UpToDate,
    GotChanges,
    NeedsCommit,
}

const GIT_JSON = pxt.github.GIT_JSON
type GitJson = pxt.github.GitJson

export async function pullAsync(hd: Header) {
    let files = await getTextAsync(hd.id)
    await recomputeHeaderFlagsAsync(hd, files)
    let gitjsontext = files[GIT_JSON]
    if (!gitjsontext)
        return PullStatus.NoSourceControl
    if (!hd.githubCurrent)
        return PullStatus.NeedsCommit
    let gitjson = JSON.parse(gitjsontext) as GitJson
    let parsed = pxt.github.parseRepoId(gitjson.repo)
    let sha = await pxt.github.getRefAsync(parsed.fullName, parsed.tag)
    if (sha == gitjson.commit.sha)
        return PullStatus.UpToDate
    let res = await githubUpdateToAsync(hd, gitjson.repo, sha, files)
    return PullStatus.GotChanges
}

export async function prAsync(hd: Header, commitId: string, msg: string) {
    let parsed = pxt.github.parseRepoId(hd.githubId)
    // merge conflict - create a Pull Request
    let url = await pxt.github.createPRAsync(parsed.fullName, parsed.tag, commitId, msg)
    // force user back to master - we will instruct them to merge PR in github.com website
    // and sync here to get the changes
    let headCommit = await pxt.github.getRefAsync(parsed.fullName, parsed.tag)
    await githubUpdateToAsync(hd, hd.githubId, headCommit, {})
    return url
}

export async function bumpAsync(hd: Header) {
    let files = await getTextAsync(hd.id)
    let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
    let v = pxt.semver.parse(cfg.version)
    v.patch++
    cfg.version = pxt.semver.stringify(v)
    files[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4)
    await saveAsync(hd, files)
    return await commitAsync(hd, cfg.version, "v" + cfg.version)
}

export async function commitAsync(hd: Header, msg: string, tag = "", filenames: string[] = null) {
    let files = await getTextAsync(hd.id)
    let gitjsontext = files[GIT_JSON]
    if (!gitjsontext)
        U.userError(lf("Not a git extension."))
    let gitjson = JSON.parse(gitjsontext) as GitJson
    let parsed = pxt.github.parseRepoId(gitjson.repo)
    let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
    let treeUpdate: pxt.github.CreateTreeReq = {
        base_tree: gitjson.commit.tree.sha,
        tree: []
    }
    if (!filenames)
        filenames = pxt.allPkgFiles(cfg)
    for (let path of filenames) {
        if (path == GIT_JSON)
            continue
        let sha = gitsha(files[path])
        let ex = gitjson.commit.tree.tree.filter(e => e.path == path)[0]
        if (!ex || ex.sha != sha) {
            let res = await pxt.github.createObjectAsync(parsed.fullName, "blob", {
                content: files[path],
                encoding: "utf-8"
            } as pxt.github.CreateBlobReq)
            U.assert(res == sha)
            treeUpdate.tree.push({
                "path": path,
                "mode": "100644",
                "type": "blob",
                "sha": sha,
                "url": undefined
            })
        }
    }

    if (treeUpdate.tree.length == 0)
        U.userError(lf("Nothing to commit!"))

    let treeId = await pxt.github.createObjectAsync(parsed.fullName, "tree", treeUpdate)
    let commit: pxt.github.CreateCommitReq = {
        message: msg,
        parents: [gitjson.commit.sha],
        tree: treeId
    }
    let commitId = await pxt.github.createObjectAsync(parsed.fullName, "commit", commit)
    let ok = await pxt.github.fastForwardAsync(parsed.fullName, parsed.tag, commitId)
    let newCommit = commitId
    if (!ok)
        newCommit = await pxt.github.mergeAsync(parsed.fullName, parsed.tag, commitId)

    if (newCommit == null) {
        return commitId
    } else {
        await githubUpdateToAsync(hd, gitjson.repo, newCommit, files, tag)
        if (tag)
            await pxt.github.createTagAsync(parsed.fullName, tag, newCommit)
        return ""
    }
}

async function githubUpdateToAsync(hd: Header, repoid: string, commitid: string, files: ScriptText, tag?: string) {
    let parsed = pxt.github.parseRepoId(repoid)
    let commit = await pxt.github.getCommitAsync(parsed.fullName, commitid)
    let gitjson: GitJson = JSON.parse(files[GIT_JSON] || "{}")

    if (!gitjson.commit) {
        gitjson = {
            repo: repoid,
            commit: null
        }
    }

    let downloadAsync = async (path: string) => {
        let treeEnt = commit.tree.tree.filter(e => e.path == path)[0]
        if (!treeEnt) {
            files[path] = ""
            return
        }
        if (files[path] && gitsha(files[path]) == treeEnt.sha)
            return
        let text = await pxt.github.downloadTextAsync(parsed.fullName, commitid, path)
        files[path] = text
        if (gitsha(files[path]) != treeEnt.sha)
            U.userError(lf("Corrupt SHA1 on download of '{0}'.", path))
    }

    await downloadAsync(pxt.CONFIG_NAME)
    let cfg = JSON.parse(files[pxt.CONFIG_NAME] || "{}") as pxt.PackageConfig
    for (let fn of pxt.allPkgFiles(cfg).slice(1)) {
        await downloadAsync(fn)
    }

    if (!cfg.name) {
        cfg.name = parsed.fullName.replace(/[^\w\-]/g, "")
        files[pxt.CONFIG_NAME] = JSON.stringify(cfg, null, 4)
    }

    commit.tag = tag
    gitjson.commit = commit
    files[GIT_JSON] = JSON.stringify(gitjson, null, 4)

    if (!hd) {
        hd = await installAsync({
            name: cfg.name,
            githubId: repoid,
            pubId: "",
            pubCurrent: false,
            meta: {},
            editor: "tsprj",
            target: pxt.appTarget.id,
            targetVersion: pxt.appTarget.versions.target,
        }, files)
    } else {
        hd.name = cfg.name
        await saveAsync(hd, files)
    }

    return hd
}


// to be called after loading header in a editor
export async function recomputeHeaderFlagsAsync(h: Header, files: ScriptText) {
    h.githubCurrent = false

    let gitjson: GitJson = JSON.parse(files[GIT_JSON] || "{}")

    h.githubId = gitjson.repo

    if (!h.githubId)
        return

    if (!gitjson.commit || !gitjson.commit.tree)
        return

    for (let k of Object.keys(files)) {
        if (k == GIT_JSON)
            continue
        let treeEnt = gitjson.commit.tree.tree.filter(e => e.path == k)[0]
        if (!treeEnt || treeEnt.type != "blob")
            return
        if (files[k] && treeEnt.sha != gitsha(files[k]))
            return
    }

    h.githubCurrent = true
}

export async function initializeGithubRepoAsync(hd: Header, repoid: string) {
    let parsed = pxt.github.parseRepoId(repoid)
    let name = parsed.fullName.replace(/.*\//, "")
    let files = pxt.packageFiles(name)
    pxt.packageFilesFixup(files, true)

    let currFiles = await getTextAsync(hd.id)
    U.jsonMergeFrom(currFiles, files)

    await saveAsync(hd, currFiles)
    await commitAsync(hd, "Auto-initialized.", "", Object.keys(currFiles))

    // remove files not in the package (only in git)
    currFiles = await getTextAsync(hd.id)
    let allfiles = pxt.allPkgFiles(JSON.parse(currFiles[pxt.CONFIG_NAME]))
    for (let k of Object.keys(currFiles)) {
        if (k == GIT_JSON)
            continue
        if (allfiles.indexOf(k) < 0)
            delete currFiles[k]
    }

    await saveAsync(hd, currFiles)

    return hd
}

export async function importGithubAsync(id: string) {
    let parsed = pxt.github.parseRepoId(id)
    let sha = ""
    let repoid = pxt.github.noramlizeRepoId(id).replace(/^github:/, "")
    let isEmpty = false
    try {
        sha = await pxt.github.getRefAsync(parsed.fullName, parsed.tag)
    } catch (e) {
        if (e.statusCode == 409) {
            // this means repo is completely empty; put something in there
            await pxt.github.putFileAsync(parsed.fullName, ".gitignore", "# Initial\n")
            isEmpty = true
            sha = await pxt.github.getRefAsync(parsed.fullName, parsed.tag)
        }
        else if (e.statusCode == 404)
            U.userError(lf("No such repository or branch."))
    }
    return await githubUpdateToAsync(null, repoid, sha, {})
        .then(hd => {
            if (isEmpty)
                return initializeGithubRepoAsync(hd, repoid)
            return hd
        })
}

export function downloadFilesByIdAsync(id: string): Promise<pxt.Map<string>> {
    return Cloud.privateGetAsync(id, /* forceLiveEndpoint */ true)
        .then((scr: Cloud.JsonScript) => getPublishedScriptAsync(scr.id));
}

export function installByIdAsync(id: string) {
    return Cloud.privateGetAsync(id, /* forceLiveEndpoint */ true)
        .then((scr: Cloud.JsonScript) =>
            getPublishedScriptAsync(scr.id)
                .then(files => installAsync(
                    {
                        name: scr.name,
                        pubId: id,
                        pubCurrent: true,
                        meta: scr.meta,
                        editor: scr.editor,
                        target: scr.target,
                        targetVersion: scr.targetVersion || (scr.meta && scr.meta.versions && scr.meta.versions.target)
                    }, files)))
}

export function saveToCloudAsync(h: Header) {
    checkSession();
    return cloudsync.saveToCloudAsync(h)
}

export function syncAsync(): Promise<pxt.editor.EditorSyncState> {
    checkSession();

    return impl.listAsync()
        .catch((e) => {
            // There might be a problem with the native databases. Switch to memory for this session so the user can at
            // least use the editor.
            pxt.tickEvent("workspace.syncerror", { ws: implType });
            pxt.log("Workspace error, switching to memory workspace");
            impl = memoryworkspace.provider;
            return impl.listAsync();
        })
        .then(headers => {
            let existing = U.toDictionary(allScripts || [], h => h.header.id)
            allScripts = []
            for (let hd of headers) {
                let ex = existing[hd.id]
                if (ex) {
                    U.jsonCopyFrom(ex.header, hd)
                    //ex.text = null
                    //ex.version = null
                } else {
                    ex = {
                        header: hd,
                        text: undefined,
                        version: undefined,
                    }
                }
                allScripts.push(ex)
            }
            data.invalidate("header:")
            data.invalidate("text:")
            cloudsync.syncAsync().done() // sync in background
        })
        .then(() => impl.getSyncState ? impl.getSyncState() : null)
}

export function resetAsync() {
    checkSession();
    allScripts = []
    return impl.resetAsync()
        .then(cloudsync.resetAsync)
        .then(db.destroyAsync)
        .then(() => {
            pxt.storage.clearLocal();
            data.clearCache();
            // keep local token (localhost and electron) on reset
            if (Cloud.localToken)
                pxt.storage.setLocal("local_token", Cloud.localToken);
        })
}

export function loadedAsync() {
    checkSession();
    if (impl.loadedAsync)
        return impl.loadedAsync()
    return Promise.resolve()
}

export function saveAssetAsync(id: string, filename: string, data: Uint8Array): Promise<void> {
    if (impl.saveAssetAsync)
        return impl.saveAssetAsync(id, filename, data)
    else
        return Promise.reject(new Error(lf("Assets not supported here.")))
}

export function listAssetsAsync(id: string): Promise<pxt.workspace.Asset[]> {
    if (impl.listAssetsAsync)
        return impl.listAssetsAsync(id)
    return Promise.resolve([])
}

export function isBrowserWorkspace() {
    return impl === cloudworkspace.provider;
}

export function fireEvent(ev: pxt.editor.events.Event) {
    if (impl.fireEvent)
        return impl.fireEvent(ev)
    // otherwise, NOP
}

/*
    header:<guid>   - one header
    header:*        - all headers
*/

data.mountVirtualApi("header", {
    getSync: p => {
        p = data.stripProtocol(p)
        if (p == "*") return getHeaders()
        return getHeader(p)
    },
})

/*
    headers:SEARCH   - search headers
*/

data.mountVirtualApi("headers", {
    getAsync: p => {
        p = data.stripProtocol(p)
        const headers = getHeaders()
        if (!p) return Promise.resolve(headers)
        return compiler.projectSearchAsync({ term: p, headers })
            .then((searchResults: pxtc.service.ProjectSearchInfo[]) => searchResults)
            .then(searchResults => {
                let searchResultsMap = U.toDictionary(searchResults || [], h => h.id)
                return headers.filter(h => searchResultsMap[h.id]);
            });
    },
    expirationTime: p => 5 * 1000,
    onInvalidated: () => {
        compiler.projectSearchClear();
    }
})

/*
    text:<guid>            - all files
    text:<guid>/<filename> - one file
*/
data.mountVirtualApi("text", {
    getAsync: p => {
        let m = /^[\w\-]+:([^\/]+)(\/(.*))?/.exec(p)
        return getTextAsync(m[1])
            .then(files => {
                if (m[3])
                    return files[m[3]]
                else return files;
            })
    },
})
