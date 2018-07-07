/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />
/// <reference path="../../built/pxtwinrt.d.ts" />

import * as db from "./db";
import * as core from "./core";
import * as data from "./data";
import * as cloudworkspace from "./cloudworkspace"
import * as fileworkspace from "./fileworkspace"
import * as memoryworkspace from "./memoryworkspace"
import * as iframeworkspace from "./iframeworkspace"

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

let scripts = new db.Table("script")

import U = pxt.Util;
import Cloud = pxt.Cloud;

let impl: WorkspaceProvider;

export function setupWorkspace(id: string) {
    U.assert(!impl, "workspace set twice");
    pxt.debug(`workspace: ${id}`);
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
            impl = data.wrapWorkspace(pxt.winrt.workspace.provider);
            break;
        case "cloud":
        default:
            impl = cloudworkspace.provider
            break;
    }
}

export function getHeaders(withDeleted = false) {
    checkSession();

    let r = impl.getHeaders()
    if (!withDeleted)
        r = r.filter(r => !r.isDeleted)
    r.sort((a, b) => b.recentUse - a.recentUse)
    return r
}

export function getHeader(id: string) {
    checkSession();

    let hd = impl.getHeader(id)
    if (hd && !hd.isDeleted)
        return hd
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

    return impl.initAsync(pxt.appTarget.id, pxt.appTarget.versions.target)
}

export function getTextAsync(id: string): Promise<ScriptText> {
    checkSession();
    return impl.getTextAsync(id);
}

export interface ScriptMeta {
    description: string;
    blocksWidth?: number;
    blocksHeight?: number;
}

// https://github.com/Microsoft/pxt-backend/blob/master/docs/sharing.md#anonymous-publishing
export function anonymousPublishAsync(h: Header, text: ScriptText, meta: ScriptMeta) {
    const saveId = {}
    h.saveId = saveId
    const stext = JSON.stringify(text, null, 2) + "\n"
    const scrReq = {
        name: h.name,
        target: h.target,
        targetVersion: h.targetVersion,
        description: meta.description,
        editor: h.editor,
        text: text,
        meta: {
            versions: pxt.appTarget.versions,
            blocksHeight: meta.blocksHeight,
            blocksWidth: meta.blocksWidth
        }
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

export function saveAsync(h: Header, text?: ScriptText) {
    checkSession();
    U.assert(h.target == pxt.appTarget.id);
    if (text || h.isDeleted) {
        h.pubCurrent = false
        h.blobCurrent = false
        h.modificationTime = U.nowSeconds();
    }
    h.recentUse = U.nowSeconds();
    // update version on save    
    h.targetVersion = pxt.appTarget.versions.target;
    return impl.saveAsync(h, text)
}

export function installAsync(h0: InstallHeader, text: ScriptText) {
    checkSession();
    U.assert(h0.target == pxt.appTarget.id);
    return impl.installAsync(h0, text)
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


let scriptDlQ = new U.PromiseQueue();
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

export interface GitJson {
    repo: string;
    commit: pxt.github.Commit;
}

export const GIT_JSON = ".git.json"

export enum PullStatus {
    NoSourceControl,
    UpToDate,
    GotChanges,
    NeedsCommit,
}

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

export async function commitAsync(hd: Header, msg: string, tag = "") {
    let files = await getTextAsync(hd.id)
    let gitjsontext = files[GIT_JSON]
    if (!gitjsontext)
        U.userError(lf("Not a git package."))
    let gitjson = JSON.parse(gitjsontext) as GitJson
    let parsed = pxt.github.parseRepoId(gitjson.repo)
    let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
    let treeUpdate: pxt.github.CreateTreeReq = {
        base_tree: gitjson.commit.tree.sha,
        tree: []
    }
    for (let path of pxt.allPkgFiles(cfg)) {
        let gitsha = U.gitsha(files[path])
        let ex = gitjson.commit.tree.tree.filter(e => e.path == path)[0]
        if (!ex || ex.sha != gitsha) {
            let res = await pxt.github.createObjectAsync(parsed.fullName, "blob", {
                content: files[path],
                encoding: "utf-8"
            } as pxt.github.CreateBlobReq)
            U.assert(res == gitsha)
            treeUpdate.tree.push({
                "path": path,
                "mode": "100644",
                "type": "blob",
                "sha": gitsha,
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
        await githubUpdateToAsync(hd, gitjson.repo, newCommit, files)
        if (tag)
            await pxt.github.createTagAsync(parsed.fullName, tag, newCommit)
        return ""
    }
}

async function githubUpdateToAsync(hd: Header, repoid: string, commitid: string, files: ScriptText) {
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
        if (files[path] && U.gitsha(files[path]) == treeEnt.sha)
            return
        let text = await pxt.github.downloadTextAsync(parsed.fullName, commitid, path)
        files[path] = text
        if (U.gitsha(files[path]) != treeEnt.sha)
            U.userError(lf("Corrupt SHA1 on download of '{0}'.", path))
    }

    await downloadAsync(pxt.CONFIG_NAME)
    let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
    for (let fn of pxt.allPkgFiles(cfg).slice(1)) {
        await downloadAsync(fn)
    }

    gitjson.commit = commit
    files[".git.json"] = JSON.stringify(gitjson, null, 4)

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
        if (files[k] && treeEnt.sha != U.gitsha(U.toUTF8(files[k])))
            return
    }

    h.githubCurrent = true
}

export async function importGithubAsync(id: string) {
    let parsed = pxt.github.parseRepoId(id)
    let sha = await pxt.github.getRefAsync(parsed.fullName, parsed.tag)
    let repoid = pxt.github.noramlizeRepoId(id).replace(/^github:/, "")
    return await githubUpdateToAsync(null, repoid, sha, {})
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
                        targetVersion: scr.targetVersion
                    }, files)))
}

export function saveToCloudAsync(h: Header) {
    checkSession();
    return impl.saveToCloudAsync(h)
}

export function syncAsync(): Promise<pxt.editor.EditorSyncState> {
    checkSession();
    return impl.syncAsync();
}

export function resetAsync() {
    checkSession();
    return impl.resetAsync()
}

export function loadedAsync() {
    checkSession();
    return impl.loadedAsync();
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

