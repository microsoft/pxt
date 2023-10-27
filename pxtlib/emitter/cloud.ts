/// <reference path="../../localtypings/projectheader.d.ts"/>
namespace pxt.Cloud {
    import Util = pxtc.Util;

    export let apiRoot = (pxt.BrowserUtils.isLocalHost() || Util.isNodeJS) ? "https://www.makecode.com/api/" : "/api/";

    export let accessToken = "";
    export let localToken = "";
    let _isOnline = true;
    export let onOffline = () => { };

    function offlineError(url: string) {
        let e: any = new Error(Util.lf("Cannot access {0} while offline", url));
        e.isOffline = true;
        return U.delay(1000).then(() => Promise.reject(e))
    }

    export function hasAccessToken() {
        return !!accessToken
    }

    export function localRequestAsync(path: string, data?: any) {
        return U.requestAsync({
            url: "/api/" + path,
            headers: { "Authorization": Cloud.localToken },
            method: data ? "POST" : "GET",
            data: data || undefined,
            allowHttpErrors: true
        })
    }

    export function useCdnApi() {
        return pxt.webConfig && !pxt.webConfig.isStatic
            && !BrowserUtils.isLocalHost() && !!pxt.webConfig.cdnUrl
    }

    export function cdnApiUrl(url: string) {
        url = url.replace(/^\//, '');
        if (!useCdnApi())
            return apiRoot + url;

        const d = new Date()
        const timestamp = d.getUTCFullYear() + ("0" + (d.getUTCMonth() + 1)).slice(-2) + ("0" + d.getUTCDate()).slice(-2)
        if (url.indexOf("?") < 0)
            url += "?"
        else
            url += "&"
        url += "cdn=" + timestamp
        // url = url.replace("?", "$")
        return pxt.webConfig.cdnUrl + "/api/" + url
    }

    export function apiRequestWithCdnAsync(options: Util.HttpRequestOptions) {
        if (!useCdnApi())
            return privateRequestAsync(options)
        options.url = cdnApiUrl(options.url)
        return Util.requestAsync(options)
            .catch(e => handleNetworkError(options, e))
    }

    function handleNetworkError(options: Util.HttpRequestOptions, e: any) {
        if (e.statusCode == 0) {
            if (_isOnline) {
                _isOnline = false;
                onOffline();
            }
            return offlineError(options.url)
        } else {
            return Promise.reject(e)
        }
    }

    export function privateRequestAsync(options: Util.HttpRequestOptions) {
        options.url = pxt.webConfig?.isStatic && !options.forceLiveEndpoint ? pxt.webConfig.relprefix + options.url : apiRoot + options.url;
        options.allowGzipPost = true
        if (!Cloud.isOnline() && !pxt.BrowserUtils.isPxtElectron()) {
            return offlineError(options.url);
        }
        if (!options.headers) options.headers = {}
        if (pxt.BrowserUtils.isLocalHost()) {
            if (Cloud.localToken)
                options.headers["Authorization"] = Cloud.localToken;
        } else if (accessToken) {
            options.headers["x-td-access-token"] = accessToken
        }
        return Util.requestAsync(options)
            .catch(e => handleNetworkError(options, e))
    }

    export function privateGetTextAsync(path: string, headers?: pxt.Map<string>): Promise<string> {
        return privateRequestAsync({ url: path, headers }).then(resp => resp.text)
    }

    export function privateGetAsync(path: string, forceLiveEndpoint: boolean = false): Promise<any> {
        return privateRequestAsync({ url: path, forceLiveEndpoint }).then(resp => resp.json)
    }

    export function downloadTargetConfigAsync(): Promise<pxt.TargetConfig> {
        if (!Cloud.isOnline()) // offline
            return Promise.resolve(undefined);

        const targetVersion = pxt.appTarget.versions && pxt.appTarget.versions.target;
        const url = pxt.webConfig && pxt.webConfig.isStatic ? `targetconfig.json` : `config/${pxt.appTarget.id}/targetconfig${targetVersion ? `/v${targetVersion}` : ''}`;
        if (pxt.BrowserUtils.isLocalHost())
            return localRequestAsync(url).then(r => r ? r.json : undefined)
        else
            return apiRequestWithCdnAsync({ url }).then(r => r.json)
    }

    export function downloadScriptFilesAsync(id: string): Promise<Map<string>> {
        return privateRequestAsync({
            url: id + "/text" + (id.startsWith("S") ? `?time=${Date.now()}` : ""),
            forceLiveEndpoint: true,
        }).then(resp => {
            return JSON.parse(resp.text)
        })
    }

    export function downloadScriptMetaAsync(id: string): Promise<JsonScriptMeta> {
        return privateRequestAsync({
            url: id + (id.startsWith("S") ? `?time=${Date.now()}` : ""),
            forceLiveEndpoint: true,
        }).then(resp => {
            return JSON.parse(resp.text).meta;
        })
    }

    export async function markdownAsync(docid: string, locale?: string, propagateExceptions?: boolean): Promise<string> {
        // 1h check on markdown content if not on development server
        const MARKDOWN_EXPIRATION = pxt.BrowserUtils.isLocalHostDev() ? 0 : 1 * 60 * 60 * 1000;
        // 1w check don't use cached version and wait for new content
        const FORCE_MARKDOWN_UPDATE = MARKDOWN_EXPIRATION * 24 * 7;

        locale = locale || pxt.Util.userLanguage();
        const branch = "";

        const db = await pxt.BrowserUtils.translationDbAsync();
        const entry = await db.getAsync(locale, docid, branch);

        const downloadAndSetMarkdownAsync = async () => {
            try {
                const r = await downloadMarkdownAsync(docid, locale, entry?.etag);
                // TODO directly compare the entry/response etags after backend change
                if (!entry || (r.md && entry.md !== r.md)) {
                    await db.setAsync(locale, docid, branch, r.etag, undefined, r.md);
                    return r.md;
                }
                return entry.md;
            } catch (e) {
                if (propagateExceptions) {
                    throw e;
                } else {
                    return ""; // no translation
                }
            }
        };

        if (entry) {
            const timeDiff = Date.now() - entry.time;
            const shouldFetchInBackground = timeDiff > MARKDOWN_EXPIRATION;
            const shouldWaitForNewContent = timeDiff > FORCE_MARKDOWN_UPDATE;

            if (!shouldWaitForNewContent) {
                if (shouldFetchInBackground) {
                    pxt.tickEvent("markdown.update.background");
                    // background update, do not wait
                    downloadAndSetMarkdownAsync();
                }

                // return cached entry
                if (entry.md) {
                    return entry.md;
                }
            } else {
                pxt.tickEvent("markdown.update.wait");
            }
        }

        // download and cache
        return downloadAndSetMarkdownAsync();
    }

    function downloadMarkdownAsync(docid: string, locale?: string, etag?: string): Promise<{ md: string; etag?: string; }> {
        const packaged = pxt.webConfig?.isStatic;
        const targetVersion = pxt.appTarget.versions && pxt.appTarget.versions.target || '?';
        let url: string;

        if (packaged) {
            url = docid;
            const isUnderDocs = /\/?docs\//.test(url);
            const hasExt = /\.\w+$/.test(url);
            if (!isUnderDocs) {
                const hasLeadingSlash = url[0] === "/";
                url = `docs${hasLeadingSlash ? "" : "/"}${url}`;
            }
            if (!hasExt) {
                url = `${url}.md`;
            }
        } else {
            url = `md/${pxt.appTarget.id}/${docid.replace(/^\//, "")}?targetVersion=${encodeURIComponent(targetVersion)}`;
        }
        if (locale != "en") {
            url += `${packaged ? "?" : "&"}lang=${encodeURIComponent(locale)}`
        }
        if (pxt.BrowserUtils.isLocalHost() && !pxt.Util.liveLocalizationEnabled()) {
            return localRequestAsync(url).then(resp => {
                if (resp.statusCode == 404)
                    return privateRequestAsync({ url, method: "GET" })
                        .then(resp => { return { md: resp.text, etag: <string>resp.headers["etag"] }; });
                else return { md: resp.text, etag: undefined };
            });
        } else {
            const headers: pxt.Map<string> = etag && !useCdnApi() ? { "If-None-Match": etag } : undefined;
            return apiRequestWithCdnAsync({ url, method: "GET", headers })
                .then(resp => { return { md: resp.text, etag: <string>resp.headers["etag"] }; });
        }
    }

    export function privateDeleteAsync(path: string) {
        return privateRequestAsync({ url: path, method: "DELETE" }).then(resp => resp.json)
    }

    export function privatePostAsync(path: string, data: any, forceLiveEndpoint: boolean = false) {
        return privateRequestAsync({ url: path, data: data || {}, forceLiveEndpoint }).then(resp => resp.json)
    }

    export function isLoggedIn() { return !!accessToken }

    export function isNavigatorOnline() {
        return navigator && navigator.onLine;
    }

    export function isOnline() {
        if (typeof navigator !== "undefined" && isNavigatorOnline()) {
            _isOnline = true;
        }
        return _isOnline;
    }

    export function getServiceUrl() {
        return apiRoot.replace(/\/api\/$/, "")
    }

    export function getUserId() {
        let m = /^0(\w+)\./.exec(accessToken)
        if (m) return m[1]
        return null
    }

    export function parseScriptId(uri: string): string {
        const target = pxt.appTarget;
        if (!uri || !target.appTheme || !target.cloud?.sharing) return undefined;

        let domains = ["makecode.com"];
        if (target.appTheme.embedUrl)
            domains.push(target.appTheme.embedUrl);
        if (target.appTheme.shareUrl)
            domains.push(target.appTheme.shareUrl);
        domains = Util.unique(domains, d => d).map(d => Util.escapeForRegex(Util.stripUrlProtocol(d).replace(/\/$/, '')).toLowerCase());
        const domainCheck = `(?:(?:https:\/\/)?(?:${domains.join('|')})\/)`;
        const versionRefCheck = "(?:v[0-9]+\/)";
        const oembedCheck = "api\/oembed\\?url=.*%2F([^&#]*)&.*";
        const sharePageCheck = "\/?([a-z0-9\\-_]+)(?:[#?&].*)?";
        const scriptIdCheck = `^${domainCheck}?${versionRefCheck}?(?:(?:${oembedCheck})|(?:${sharePageCheck}))$`;
        const m = new RegExp(scriptIdCheck, 'i').exec(uri.trim());
        const scriptid = m?.[1] /** oembed res **/ || m?.[2] /** share page res **/;

        if (/^(_.{12}|S?[0-9\-]{23})$/.test(scriptid))
            return scriptid;

        return undefined;
    }

    //
    // Interfaces used by the cloud
    //

    export interface JsonIdObject {
        kind: string;
        id: string; // id
    }

    export interface JsonPublication extends JsonIdObject {
        time: number; // time when publication was created
    }

    export interface JsonScript extends JsonPublication {
        shortid?: string;
        name: string;
        description: string;
        editor?: string; // convention where empty means touchdevelop, for backwards compatibility
        target?: string;
        targetVersion?: string;
        meta?: JsonScriptMeta; // only in lite, bag of metadata
        thumb?: boolean;
        persistId?: string;
    }
}
