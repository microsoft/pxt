import * as core from "./core";
import * as cloudsync from "./cloudsync";

const rootdir = "/drive/special/approot"

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

export class Provider extends cloudsync.ProviderBase implements cloudsync.Provider {
    private entryCache: pxt.Map<OneEntry> = {}

    constructor() {
        super("onedrive", lf("Microsoft OneDrive"), "https://graph.microsoft.com/v1.0")
    }

    login() {
        let p = this.loginInner()
        p.scope = "Files.ReadWrite.AppFolder User.Read"
        let url = core.stringifyQueryString("https://login.microsoftonline.com/common/oauth2/v2.0/authorize", p)
        window.location.href = url
    }

    getUserInfoAsync() {
        return this.getJsonAsync("/me")
            .then(resp => ({
                name: resp.displayName as string || lf("{0} User", this.friendlyName),
                id: resp.id
            }))
    }

    listAsync() {
        // ,size,cTag,eTag
        return this.getJsonAsync(rootdir + "/children?select=@microsoft.graph.downloadUrl,lastModifiedDateTime,cTag,id,name")
            .then(lst => {
                let suff = this.fileSuffix()
                let res: cloudsync.FileInfo[] = []
                for (let r of (lst.value || []) as OneEntry[]) {
                    if (!U.endsWith(r.name.toLowerCase(), suff))
                        continue
                    this.entryCache[r.id] = r
                    res.push({
                        id: r.id,
                        name: r.name,
                        version: r.cTag,
                        updatedAt: this.parseTime(r.lastModifiedDateTime)
                    })
                }
                return res
            })
    }

    async downloadAsync(id: string): Promise<cloudsync.FileInfo> {
        let cached = this.entryCache[id]
        let recent = false
        if (!cached || !cached["@microsoft.graph.downloadUrl"]) {
            cached = await this.getJsonAsync("/drive/items/" + id)
            this.entryCache[id] = cached
            recent = true
        }
        try {
            let resp = await U.requestAsync({ url: cached["@microsoft.graph.downloadUrl"] })
            return {
                id: id,
                // We assume the downloadUrl would be for a given cTag; eTags seem to change too often.
                version: cached.cTag,
                name: cached.name || "?",
                updatedAt: this.parseTime(resp.headers["last-modified"] as string),
                content: JSON.parse(resp.text)
            }
        } catch (e) {
            // in case of failure when using cached URL, try getting the download URL again
            if (!recent) {
                delete cached["@microsoft.graph.downloadUrl"]
                return this.downloadAsync(id)
            }
            throw e
        }
    }


    async uploadAsync(id: string, prevVersion: string, files: pxt.Map<string>): Promise<cloudsync.FileInfo> {
        let cached = this.entryCache[id || "???"]
        if (cached)
            delete cached["@microsoft.graph.downloadUrl"]

        let path = "/drive/items/" + id + "/content"

        if (!id) {
            let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
            let xname = cfg.name.replace(/[~"#%&*:<>?/\\{|}]+/g, "_")
            path = rootdir + ":/" + encodeURIComponent(xname + this.fileSuffix()) +
                ":/content?@microsoft.graph.conflictBehavior=rename"
        }

        let resp = await this.reqAsync({
            url: path,
            method: "PUT",
            data: JSON.stringify(files, null, 1),
            headers: !prevVersion ? {} :
                {
                    "if-match": prevVersion
                }
        })

        if (resp.statusCode >= 300)
            this.syncError(lf("Can't upload file to {0}", this.friendlyName))

        cached = resp.json
        this.entryCache[cached.id] = cached

        return {
            id: cached.id,
            version: cached.cTag,
            updatedAt: U.nowSeconds(),
            name: cached.name,
        }
    }

    async deleteAsync(id: string): Promise<void> {
        let resp = await this.reqAsync({
            url: "/drive/items/" + id,
            method: "DELETE",
        })

        if (resp.statusCode != 204)
            this.syncError(lf("Can't delete {0} file", this.friendlyName))

        delete this.entryCache[id]
    }
}
