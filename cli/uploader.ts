import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';
import * as crypto from 'crypto';

import * as nodeutil from './nodeutil';

import U = ks.Util;
import Cloud = ks.Cloud;

var uploadCache: U.Map<string> = {};
var uploadPromises: U.Map<Promise<string>> = {};
var usedPromises: U.Map<boolean> = {};
var ptrPrefix = ""
var showVerbose = false

function error(msg: string) {
    U.userError(msg)
}

function verbose(msg: string) {
    if (showVerbose)
        console.log(msg)
}

function replContent(str: string, waitFor: Promise<string>[]) {
    return str.replace(/[\.\/]*(\/static\/[\w\.\-\/]+)/g, (m, x) => {
        let repl = uploadFileAsync(x)
        usedPromises[x] = true;
        if (waitFor) waitFor.push(repl)
        else return repl.value();
        return "";
    })
}

function rewriteUrl(id: string): string {
    return id;
}

export function sha256buffer(b: Buffer): string {
    let h = crypto.createHash('sha256')
    h.update(b)
    return h.digest('hex').toLowerCase()
}

function uploadArtAsync(fn: string): Promise<string> {
    let contentType = U.getMime(fn)
    if (!contentType || contentType == "application/octet-stream")
        error("content type not understood: " + fn)

    let buf = fs.readFileSync("docs" + fn)

    return Promise.resolve()
        .then(() => {
            if (/^text/.test(contentType)) {
                let str = buf.toString("utf8");
                let waitFor: Promise<any>[] = [];
                replContent(str, waitFor);
                return Promise.all(waitFor)
                    .then(() => {
                        str = replContent(str, null);
                        buf = new Buffer(str, "utf8");
                    })
            } else {
                return Promise.resolve()
            }
        })
        .then(() => {
            let sha = sha256buffer(buf).slice(0, 32)
            return Cloud.privateGetAsync("arthash/" + sha)
        })
        .then(resp => {
            let it = resp["items"][0]
            if (it) {
                let id0 = rewriteUrl(it.bloburl);
                verbose(`already present: ${fn} at ${id0}`)
                return id0
            } else {
                return Cloud.privatePostAsync("art", {
                    content: buf.toString("base64"),
                    contentType: contentType,
                    description: "#kindupload",
                    name: fn.replace(/.*\//, "")
                })
                    .then(resp => {
                        let id = rewriteUrl(resp["bloburl"])
                        console.log(`upload: ${fn} -> ${id}`)
                        return id
                    }, err => {
                        error(`cannot upload ${fn} - ${err.message}`)
                        return ""
                    })
            }
        })
}

function uploadFileAsync(fn: string) {
    if (uploadPromises[fn])
        return uploadPromises[fn]
    let path = ptrPrefix + fn.replace(/\.md$/, "")
    uploadPromises[fn] = uploadArtAsync(fn)
        .then(bloburl => {
            if (U.startsWith(fn, "/static/"))
                return Promise.resolve(bloburl)

            let m = /\/pub\/([a-z]+)/.exec(bloburl)
            let id = m[1]

            return Cloud.privateGetAsync(nodeutil.pathToPtr(path))
                .then((curr: Cloud.JsonPointer) => {
                    if (curr.artid == id) {
                        verbose(`already set: ${fn} -> ${id}`)
                        return Promise.resolve()
                    }

                    return Cloud.privatePostAsync("pointers", {
                        path: path,
                        htmlartid: "",
                        artid: id,
                        scriptid: "",
                        releaseid: "",
                        redirect: ""
                    })
                        .then(() => {
                            console.log(`${fn}: set to ${id}`)
                        })
                })
                .then(() => bloburl)
        })
    return uploadPromises[fn]
}

function getFiles() {
    let res: string[] = []
    function loop(path: string) {
        for (let fn of fs.readdirSync(path)) {
            if (fn[0] == ".") continue;
            let fp = path + "/" + fn
            let st = fs.statSync(fp)
            if (st.isDirectory()) loop(fp)
            else if (st.isFile()) res.push(fp.replace(/^docs/, ""))
        }
    }
    loop("docs")
    return res
}

export function uploadAsync(...args: string[]) {
    if (args[0] == "-v") {
        showVerbose = true
        args.shift()
    }
    
    let appTarget = nodeutil.getWebTarget()
    ptrPrefix = "/" + appTarget.id
    
    let files = args.map(a => {
        if (U.startsWith(a, "docs/")) return a.slice(4)
        else throw error("File name has to start with docs/: " + a)
    })
    if (files.length == 0)
        files = getFiles().filter(fn => !/^\/_/.test(fn))
        
    return Promise.map(files, uploadFileAsync, { concurrency: 20 })
        .then(() => {
            for (let k of Object.keys(uploadPromises)) {
                if (/^\/static\//.test(k) && !usedPromises[k]) {
                    console.log("unused:", k)
                }
            }
        })
        .then(() => {
            console.log("ALL DONE")
        })
}
