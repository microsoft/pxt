import * as core from "./core";
import * as cloudsync from "./cloudsync";

const scopes = "files.readwrite.appfolder"
const rootdir = "/drive/special/approot"
const ns = "onedrive"
const friendlyName = "OneDrive"

import U = pxt.U

interface OneEntry {
    "@microsoft.graph.downloadUrl": string;
    "lastModifiedDateTime": string;
    "id": string;
    "name": string;
    "size": number;
    "eTag": string;
    "cTag": string;
}

const entryCache: pxt.Map<OneEntry> = {}

function reqAsync(opts: U.HttpRequestOptions): Promise<U.HttpResponse> {
    let tok = pxt.storage.getLocal(ns + "token")

    if (!tok) {
        U.userError(lf("Please log in to {0}", friendlyName))
    }

    if (!opts.headers) {
        opts.headers = {}
    }
    opts.headers["Authorization"] = "bearer " + tok

    if (!/^https:\/\//.test(opts.url)) {
        opts.url = "https://graph.microsoft.com/v1.0" + opts.url
    }

    opts.allowHttpErrors = true

    return U.requestAsync(opts)
    // TODO detect expired token here
}

function getJsonAsync(path: string) {
    return reqAsync({ url: path })
        .then(resp => {
            if (resp.statusCode < 300)
                return resp.json
            throw pxt.U.userError(lf("Invalid {0} response {1} at {2}",
                friendlyName, resp.statusCode, path))
        })
}

function fileSuffix() {
    return ".mkcd-" + pxt.appTarget.id

}

function parseTime(s: string) {
    return Math.round(new Date(s).getTime() / 1000)
}
function listAsync() {
    // ,size,cTag,eTag
    return getJsonAsync(rootdir + "/children?select=@microsoft.graph.downloadUrl,lastModifiedDateTime,cTag,id,name")
        .then(lst => {
            let suff = fileSuffix()
            let res: cloudsync.FileInfo[] = []
            for (let r of (lst.value || []) as OneEntry[]) {
                if (!U.endsWith(r.name.toLowerCase(), suff))
                    continue
                entryCache[r.id] = r
                res.push({
                    id: r.id,
                    name: r.name,
                    version: r.cTag,
                    updatedAt: parseTime(r["@microsoft.graph.downloadUrl"])
                })
            }
            return res
        })
}

async function downloadAsync(id: string): Promise<cloudsync.FileInfo> {
    let cached = entryCache[id]
    let recent = false
    if (!cached || !cached["@microsoft.graph.downloadUrl"]) {
        cached = await getJsonAsync("/drive/items/" + id)
        entryCache[id] = cached
        recent = true
    }
    try {
        let resp = await U.requestAsync({ url: cached["@microsoft.graph.downloadUrl"] })
        return {
            id: id,
            // We assume the downloadUrl would be for a given cTag; eTags seem to change too often.
            version: cached.cTag,
            name: cached.name || "?",
            updatedAt: parseTime(resp.headers["last-modified"] as string),
            content: JSON.parse(resp.text)
        }
    } catch (e) {
        // in case of failure when using cached URL, try getting the download URL again
        if (!recent) {
            delete cached["@microsoft.graph.downloadUrl"]
            return downloadAsync(id)
        }
        throw e
    }
}


async function uploadAsync(id: string, prevVersion: string, files: pxt.Map<string>): Promise<cloudsync.FileInfo> {
    let cached = entryCache[id || "???"]
    if (cached)
        delete cached["@microsoft.graph.downloadUrl"]

    let path = "/drive/items/" + id

    if (!id) {
        let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
        let xname = cfg.name.replace(/[~"#%&*:<>?/\\{|}]+/g, "_")
        path = rootdir + ":/" + encodeURIComponent(xname + fileSuffix()) + ":"
    }

    let resp = await reqAsync({
        url: path + "/content",
        method: "PUT",
        data: JSON.stringify(files, null, 1),
        // TODO check if this works
        headers: !prevVersion ? {} :
            {
                "if-match": prevVersion
            }
    })

    if (resp.statusCode >= 300)
        U.userError(lf("Can't upload file to {0}", friendlyName))

    cached = resp.json
    entryCache[cached.id] = cached

    return {
        id: cached.id,
        version: cached.eTag,
        updatedAt: U.nowSeconds(),
        name: cached.name,
    }
}

async function deleteAsync(id: string): Promise<void> {
    let resp = await reqAsync({
        url: "/drive/items/" + id,
        method: "DELETE",
    })

    if (resp.statusCode != 204)
        U.userError(lf("Can't delete {0} file", friendlyName))

    delete entryCache[id]
}

function loginCheck() {
    let tok = pxt.storage.getLocal(ns + "token")

    if (!tok)
        return

    cloudsync.setProvider(impl)

    let exp = parseInt(pxt.storage.getLocal(ns + "tokenExp") || "0")

    if (exp < Date.now() / 1000) {
        // if we already attempted autologin (and failed), don't do it again
        if (pxt.storage.getLocal(ns + "AutoLogin")) {
            core.infoNotification(lf("Please log in to {0}", friendlyName))
            return
        }

        pxt.storage.setLocal(ns + "AutoLogin", "yes")
        login();
    }
}

function login() {
    core.showLoading(ns + "login", lf("Logging you in to {0}...", friendlyName))
    const self = window.location.href.replace(/#.*/, "")
    const state = ts.pxtc.Util.guidGen();
    pxt.storage.setLocal("oauthState", state)
    pxt.storage.setLocal("oauthType", ns)

    const client_id = (pxt.appTarget.cloud.cloudProviders["onedrive"] as any)["client_id"]

    const login = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" +
        "?client_id=" + client_id +
        "&scope=" + encodeURIComponent(scopes) +
        "&response_type=token" +
        "&state=" + state +
        "&redirect_uri=" + encodeURIComponent(self)
    window.location.href = login
}

function loginCallback(qs: pxt.Map<string>) {
    console.log("ONE", qs)
    pxt.storage.removeLocal(ns + "AutoLogin")
    pxt.storage.setLocal(ns + "token", qs["access_token"])
    let time = Math.round(Date.now() / 1000 + (0.6 * parseInt(qs["expires_in"])))
    pxt.storage.setLocal(ns + "tokenExp", time + "")
}

export const impl: cloudsync.Provider = {
    name: ns,
    loginCheck,
    login,
    loginCallback,
    listAsync,
    downloadAsync,
    deleteAsync,
    uploadAsync
}