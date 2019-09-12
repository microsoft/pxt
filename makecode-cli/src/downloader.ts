import * as http from "http";
import * as https from "https";
import * as url from "url";
import * as zlib from "zlib";
import * as events from "events";

import * as mkc from "./mkc"

export interface HttpRequestOptions {
    url: string;
    method?: string; // default to GET
    data?: any;
    headers?: pxt.Map<string>;
    allowHttpErrors?: boolean; // don't treat non-200 responses as errors
    allowGzipPost?: boolean;
}

export interface HttpResponse {
    statusCode: number;
    headers: pxt.Map<string | string[]>;
    buffer?: any;
    text?: string;
    json?: any;
}

function clone<T>(v: T): T {
    if (!v)
        return v
    return JSON.parse(JSON.stringify(v))
}

export function readResAsync(g: events.EventEmitter) {
    return new Promise<Buffer>((resolve, reject) => {
        let bufs: Buffer[] = []
        g.on('data', (c: any) => {
            if (typeof c === "string")
                bufs.push(new Buffer(c, "utf8"))
            else
                bufs.push(c)
        });

        g.on("error", (err: any) => reject(err))

        g.on('end', () => resolve(Buffer.concat(bufs)))
    })
}

function nodeHttpRequestAsync(options: HttpRequestOptions): Promise<HttpResponse> {
    let isHttps = false

    let u = <http.RequestOptions><any>url.parse(options.url)

    if (u.protocol == "https:") isHttps = true
    /* tslint:disable:no-http-string */
    else if (u.protocol == "http:") isHttps = false
    /* tslint:enable:no-http-string */
    else return Promise.reject("bad protocol: " + u.protocol)

    u.headers = clone(options.headers) || {}
    let data = options.data
    u.method = options.method || (data == null ? "GET" : "POST");

    let buf: Buffer = null;

    u.headers["accept-encoding"] = "gzip"
    u.headers["user-agent"] = "MakeCode-CLI"

    let gzipContent = false

    if (data != null) {
        if (Buffer.isBuffer(data)) {
            buf = data;
        } else if (typeof data == "object") {
            buf = new Buffer(JSON.stringify(data), "utf8")
            u.headers["content-type"] = "application/json; charset=utf8"
            if (options.allowGzipPost) gzipContent = true
        } else if (typeof data == "string") {
            buf = new Buffer(data, "utf8")
            if (options.allowGzipPost) gzipContent = true
        } else {
            throw new Error("bad data")
        }
    }

    if (gzipContent) {
        buf = zlib.gzipSync(buf)
        u.headers['content-encoding'] = "gzip"
    }

    if (buf)
        u.headers['content-length'] = buf.length

    return new Promise<HttpResponse>((resolve, reject) => {
        const handleResponse = (res: http.IncomingMessage) => {
            let g: events.EventEmitter = res;
            if (/gzip/.test(res.headers['content-encoding'])) {
                let tmp = zlib.createUnzip();
                res.pipe(tmp);
                g = tmp;
            }

            resolve(readResAsync(g).then(buf => {
                let text: string = null
                try {
                    text = buf.toString("utf8")
                } catch (e) {
                }
                let resp: HttpResponse = {
                    statusCode: res.statusCode,
                    headers: res.headers,
                    buffer: buf,
                    text: text
                }
                return resp;
            }))
        };

        const req = isHttps ? https.request(u, handleResponse) : http.request(u, handleResponse);
        req.on('error', (err: any) => reject(err))
        req.end(buf)
    })
}


export function requestAsync(options: HttpRequestOptions): Promise<HttpResponse> {
    log("Download " + options.url)
    return nodeHttpRequestAsync(options)
        .then<HttpResponse>(resp => {
            if ((resp.statusCode != 200 && resp.statusCode != 304) && !options.allowHttpErrors) {
                let msg = `Bad HTTP status code: ${resp.statusCode} at ${options.url}; message: ${(resp.text || "").slice(0, 500)}`
                let err: any = new Error(msg)
                err.statusCode = resp.statusCode
                return Promise.reject(err)
            }
            if (resp.text && /application\/json/.test(resp.headers["content-type"] as string))
                resp.json = JSON.parse(resp.text)
            return resp
        })
}

export function httpGetTextAsync(url: string) {
    return requestAsync({ url: url }).then(resp => resp.text)
}

export function httpGetJsonAsync(url: string) {
    return requestAsync({ url: url }).then(resp => resp.json)
}

interface WebConfig {
    relprefix: string; // "/beta---",
    workerjs: string;  // "/beta---worker",
    monacoworkerjs: string; // "/beta---monacoworker",
    gifworkerjs: string; // /beta---gifworker",
    pxtVersion: string; // "?",
    pxtRelId: string; // "9e298e8784f1a1d6787428ec491baf1f7a53e8fa",
    pxtCdnUrl: string; // "https://pxt.azureedge.net/commit/9e2...e8fa/",
    commitCdnUrl: string; // "https://pxt.azureedge.net/commit/9e2...e8fa/",
    blobCdnUrl: string; // "https://pxt.azureedge.net/commit/9e2...e8fa/",
    cdnUrl: string; // "https://pxt.azureedge.net"
    targetUrl: string; // "https://pxt.microbit.org"
    targetVersion: string; // "?",
    targetRelId: string; // "9e298e8784f1a1d6787428ec491baf1f7a53e8fa",
    targetId: string; // "microbit",
    simUrl: string; // "https://trg-microbit.userpxt.io/beta---simulator"
    partsUrl?: string; // /beta---parts
    runUrl?: string; // "/beta---run"
    docsUrl?: string; // "/beta---docs"
    isStatic?: boolean;
    verprefix?: string; // "v1"

    // added here
    rootUrl: string;
    manifestUrl?: string;
    files: { [index: string]: string };
}

function resolveUrl(root: string, path: string) {
    if (path[0] == "/") {
        return root.replace(/(:\/\/[^\/]*)\/.*/, (x, y) => y) + path
    }
    return path
}

async function parseWebConfigAsync(url: string): Promise<WebConfig | null> {
    // html
    const html: string = await httpGetTextAsync(url);
    const m = /var pxtConfig = (\{[^}]+\})/.exec(html);
    const cfg = m && JSON.parse(m[1]) as WebConfig;
    if (cfg) {
        cfg.rootUrl = url;
        cfg.files = {};

        const m = /manifest="([^"]+)"/.exec(html);
        if (m)
            cfg.manifestUrl = resolveUrl(url, m[1]);
    }
    return cfg;
}

export interface DownloadInfo {
    manifestUrl?: string;
    manifest?: string;
    manifestEtag?: string;
    cdnUrl?: string;
}

function log(msg: string) {
    console.log(msg)
}

export async function downloadAsync(cache: mkc.Cache, webAppUrl: string) {
    const infoBuf = await cache.getAsync(webAppUrl + "-info")
    const info: DownloadInfo = infoBuf ? JSON.parse(infoBuf.toString("utf8")) : {}

    if (!await hasNewManifestAsync())
        return loadFromCacheAsync()

    log("Download new webapp")
    const cfg = await parseWebConfigAsync(webAppUrl)
    if (!cfg.manifestUrl)
        cfg.manifestUrl = webAppUrl // use index.html if no manifest
    if (info.manifestUrl != cfg.manifestUrl) {
        info.manifestUrl = cfg.manifestUrl
        info.manifestEtag = null
        info.cdnUrl = cfg.cdnUrl
        await hasNewManifestAsync()
    }

    for (let fn of ["pxtworker.js", "target.json"]) {
        await saveFileAsync(fn)
    }

    let simTxt = await httpGetTextAsync(cfg.simUrl)
    let simurls: string[] = []
    simTxt = simTxt.replace(/https:\/\/[\w\/\.\-]+/g, f => {
        if (f.startsWith(info.cdnUrl)) {
            simurls.push(f)
            return f.replace(/.*\//, "")
        }
        return f
    })
    simTxt = simTxt.replace(/ manifest=/, "x-manifest=")

    await cache.setAsync(webAppUrl + "-sim.html", Buffer.from(simTxt, "utf8"))
    for (let url of simurls) {
        const resp = await requestAsync({ url })
        const base = url.replace(/.*\//, "")
        await cache.setAsync(webAppUrl + "-" + base, resp.buffer)
    }

    return loadFromCacheAsync()

    async function loadFromCacheAsync() {
        await cache.setAsync(webAppUrl + "-info", Buffer.from(JSON.stringify(info), "utf8"))
        const res: mkc.DownloadedEditor = {
            cache,
            cdnUrl: info.cdnUrl,
            website: webAppUrl,
            pxtWorkerJs: (await cache.getAsync(webAppUrl + "-pxtworker.js")).toString("utf8"),
            targetJson: JSON.parse((await cache.getAsync(webAppUrl + "-target.json")).toString("utf8")),
        }
        return res
    }

    async function saveFileAsync(name: string) {
        const resp = await requestAsync({ url: cfg.pxtCdnUrl + name })
        await cache.setAsync(webAppUrl + "-" + name, resp.buffer)
    }

    async function hasNewManifestAsync() {
        if (!info.manifestUrl)
            return true

        const resp = await requestAsync({
            url: info.manifestUrl,
            headers: info.manifestEtag ? {
                "if-none-match": info.manifestEtag
            } : {},
        })

        if (resp.statusCode == 304)
            return false

        info.manifestEtag = resp.headers["etag"] as string
        if (resp.text == info.manifest)
            return false

        info.manifest = resp.text
        return true
    }
}