namespace pxt.Cloud {
    import Util = pxtc.Util;

    // hit /api/ to stay on same domain and avoid CORS
    export let apiRoot = pxt.BrowserUtils.isLocalHost() || Util.isNodeJS ? "https://www.makecode.com/api/" : "/api/";
    export let accessToken = "";
    export let localToken = "";
    let _isOnline = true;
    export let onOffline = () => { };

    function offlineError(url: string) {
        let e: any = new Error(Util.lf("Cannot access {0} while offline", url));
        e.isOffline = true;
        return Promise.delay(1000).then(() => Promise.reject(e))
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

    export function privateRequestAsync(options: Util.HttpRequestOptions) {
        options.url = pxt.webConfig && pxt.webConfig.isStatic && !options.forceLiveEndpoint ? pxt.webConfig.relprefix + options.url : apiRoot + options.url;
        options.allowGzipPost = true
        if (!Cloud.isOnline()) {
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
            .catch(e => {
                if (e.statusCode == 0) {
                    if (_isOnline) {
                        _isOnline = false;
                        onOffline();
                    }
                    return offlineError(options.url)
                } else {
                    return Promise.reject(e)
                }
            })
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
            return Cloud.privateGetAsync(url);
    }

    export function downloadScriptFilesAsync(id: string) {
        return privateRequestAsync({ url: id + "/text", forceLiveEndpoint: true }).then(resp => {
            return JSON.parse(resp.text)
        })
    }

    // 1h check on markdown content if not on development server
    const MARKDOWN_EXPIRATION = pxt.BrowserUtils.isLocalHostDev() ? 1 : 1 * 60 * 60 * 1000;
    export function markdownAsync(docid: string, locale?: string, live?: boolean): Promise<string> {
        const branch = "";
        return pxt.BrowserUtils.translationDbAsync()
            .then(db => db.getAsync(locale, docid, "")
                .then(entry => {
                    if (entry && Date.now() - entry.time > MARKDOWN_EXPIRATION)
                        // background update,
                        downloadMarkdownAsync(docid, locale, live, entry.etag)
                            .then(r => db.setAsync(locale, docid, branch, r.etag, undefined, r.md || entry.md))
                            .catch(() => { }) // swallow errors
                            .done();
                    // return cached entry
                    if (entry && entry.md)
                        return entry.md;
                    // download and cache
                    else return downloadMarkdownAsync(docid, locale, live)
                        .then(r => db.setAsync(locale, docid, branch, r.etag, undefined, r.md)
                            .then(() => r.md))
                        .catch(() => ""); // no translation
                }))
    }

    function downloadMarkdownAsync(docid: string, locale?: string, live?: boolean, etag?: string): Promise<{ md: string; etag?: string; }> {
        const packaged = pxt.webConfig && pxt.webConfig.isStatic;
        const targetVersion = pxt.appTarget.versions && pxt.appTarget.versions.target || '?';
        let url: string;

        if (packaged) {
            url = docid;
            const isUnderDocs = /\/?docs\//.test(url);
            const hasExt = /\.\w+$/.test(url);
            if (!isUnderDocs) {
                url = `docs/${url}`;
            }
            if (!hasExt) {
                url = `${url}.md`;
            }
        } else {
            url = `md/${pxt.appTarget.id}/${docid.replace(/^\//, "")}?targetVersion=${encodeURIComponent(targetVersion)}`;
        }
        if (!packaged && locale != "en") {
            url += `&lang=${encodeURIComponent(Util.userLanguage())}`
            if (live) url += "&live=1"
        }
        if (pxt.BrowserUtils.isLocalHost() && !live)
            return localRequestAsync(url).then(resp => {
                if (resp.statusCode == 404)
                    return privateRequestAsync({ url, method: "GET" })
                        .then(resp => { return { md: resp.text, etag: resp.headers["etag"] }; });
                else return { md: resp.text, etag: undefined };
            });
        else {
            const headers: pxt.Map<string> = etag ? { "If-None-Match": etag } : undefined;
            return privateRequestAsync({ url, method: "GET", headers })
                .then(resp => { return { md: resp.text, etag: resp.headers["etag"] }; });
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
        if (!uri || !target.appTheme || !target.cloud || !target.cloud.sharing) return undefined;

        let domains = ["makecode.com"];
        if (target.appTheme.embedUrl)
            domains.push(target.appTheme.embedUrl);
        if (target.appTheme.shareUrl)
            domains.push(target.appTheme.shareUrl);
        domains = Util.unique(domains, d => d).map(d => Util.escapeForRegex(Util.stripUrlProtocol(d).replace(/\/$/, '')).toLowerCase());
        const rx = `^((https:\/\/)?(?:${domains.join('|')})\/)?(api\/oembed\?url=.*%2F([^&]*)&.*?|([a-z0-9\-_]+))$`;
        const m = new RegExp(rx, 'i').exec(uri.trim());
        const scriptid = m && (!m[1] || domains.indexOf(Util.escapeForRegex(m[1].replace(/https:\/\//, '').replace(/\/$/, '')).toLowerCase()) >= 0) && (m[3] || m[4]) ? (m[3] ? m[3] : m[4]) : null

        if (!scriptid) return undefined;

        if (scriptid[0] == "_" && scriptid.length == 13)
            return scriptid;

        if (scriptid.length == 23 && /^[0-9\-]+$/.test(scriptid))
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

    export interface JsonScriptMeta {
        blocksWidth?: number;
        blocksHeight?: number;
        versions?: TargetVersions
    }

    export interface JsonScript extends JsonPublication {
        shortid?: string;
        name: string;
        description: string;
        editor?: string; // convention where empty means touchdevelop, for backwards compatibility
        target?: string;
        targetVersion?: string;
        meta?: JsonScriptMeta; // only in lite, bag of metadata
    }
}
