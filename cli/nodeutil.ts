import * as fs from 'fs';
import * as zlib from 'zlib';
import * as url from 'url';
import * as http from 'http';
import * as https from 'https';
import * as events from 'events';
import * as crypto from 'crypto';

Promise = require("bluebird");

import Util = ks.Util;

export function readResAsync(g: events.EventEmitter) {
    return new Promise<Buffer>((resolve, reject) => {
        var bufs: Buffer[] = []
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


function nodeHttpRequestAsync(options: Util.HttpRequestOptions): Promise<Util.HttpResponse> {
    let isHttps = false

    let u = <http.RequestOptions><any>url.parse(options.url)

    if (u.protocol == "https:") isHttps = true
    else if (u.protocol == "http:") isHttps = false
    else return Promise.reject("bad protocol: " + u.protocol)

    u.headers = Util.clone(options.headers) || {}
    let data = options.data
    u.method = options.method || (data == null ? "GET" : "POST");

    let mod = isHttps ? https : http;

    let buf: Buffer = null;

    u.headers["accept-encoding"] = "gzip"

    if (data != null) {
        if (Buffer.isBuffer(data)) {
            buf = data;
        } else if (typeof data == "object") {
            buf = new Buffer(JSON.stringify(data), "utf8")
            u.headers["content-type"] = "application/json; charset=utf8"
        } else if (typeof data == "string") {
            buf = new Buffer(data, "utf8")
        } else {
            Util.oops("bad data")
        }
    }

    if (buf)
        u.headers['content-length'] = buf.length

    return new Promise<Util.HttpResponse>((resolve, reject) => {
        let req = mod.request(u, res => {
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
                let resp: Util.HttpResponse = {
                    statusCode: res.statusCode,
                    headers: res.headers,
                    buffer: buf,
                    text: text
                }
                return resp;
            }))
        })
        req.on('error', (err: any) => reject(err))
        req.end(buf)
    })
}

function sha256(hashData: string): string {
    let sha: string;
    let hash = crypto.createHash("sha256");
    hash.update(hashData, "utf8");
    sha = hash.digest().toString("hex").toLowerCase();
    return sha;
}


export function init() {
    // no, please, I want to handle my errors myself
    let async = (<any>Promise)._async
    async.fatalError = (e: any) => async.throwLater(e);

    Util.isNodeJS = true;
    Util.httpRequestCoreAsync = nodeHttpRequestAsync;
    Util.sha256 = sha256;
    Util.getRandomBuf = buf => {
        let tmp = crypto.randomBytes(buf.length)
        for (let i = 0; i < buf.length; ++i)
            buf[i] = tmp[i]
    }

    (global as any).btoa = (str:string) => new Buffer(str, "binary").toString("base64");
    (global as any).atob = (str:string) => new Buffer(str, "base64").toString("binary");
}

export function sanitizePath(path: string) {
    return path.replace(/[^\w@\/]/g, "-").replace(/^\/+/, "")
}

export function getWebTarget(): ks.AppTarget {
    return JSON.parse(fs.readFileSync("built/webtarget.json", "utf8"))
}

export function pathToPtr(path: string) {
    return "ptr-" + sanitizePath(path.replace(/^ptr-/, "")).replace(/[^\w@]/g, "-")
}

