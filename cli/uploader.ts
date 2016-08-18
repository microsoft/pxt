import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';
import * as crypto from 'crypto';

import * as nodeutil from './nodeutil';

import U = pxt.Util;
import Cloud = pxt.Cloud;

let uploadCache: U.Map<string> = {};
let uploadPromises: U.Map<Promise<string>> = {};
let usedPromises: U.Map<boolean> = {};
let ptrPrefix = ""
let showVerbose = false
let sitemap: U.Map<string>;

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

let uploadDir = "docs"

export function uploadArtFileAsync(fn: string) {
    uploadDir = ""
    return uploadArtAsync(fn, true)
        .then(id => {
            console.log(id)
        })
}

function uploadArtAsync(fn: string, noRepl = false): Promise<string> {
    let contentType = U.getMime(fn)
    if (!contentType || contentType == "application/octet-stream")
        error("content type not understood: " + fn)

    let buf = fs.readFileSync(uploadDir + fn)

    return Promise.resolve()
        .then(() => {
            if (!noRepl && /^text/.test(contentType)) {
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
                        error(`cannot upload ${fn} - ${err.message}, len=${buf.length}`)
                        return ""
                    })
            }
        })
}

function uploadFileAsync(fn: string) {
    if (uploadPromises[fn])
        return uploadPromises[fn]
    let path = fn.replace(/\.md$/, "")
    let mm = /^\/_locales\/([A-Za-z\-]+)(\/.*)/.exec(path)
    if (mm) path = mm[2] + "@" + mm[1].toLowerCase()
    let isStatic = U.startsWith(fn, "/static/")
    if (!isStatic && sitemap) sitemap[path] = ""
    path = ptrPrefix + path
    uploadPromises[fn] = uploadArtAsync(fn)
        .then(bloburl => {
            if (isStatic)
                return Promise.resolve(bloburl)

            let m = /\/pub\/([a-z]+)/.exec(bloburl)
            let id = m[1]

            return Cloud.privateGetAsync(nodeutil.pathToPtr(path))
                .then(v => v, e => { return {} })
                .then((curr: Cloud.JsonPointer) => {
                    if (curr.artid == id) {
                        verbose(`already set: ${fn} -> ${id}`)
                        return Promise.resolve()
                    }

                    return Cloud.privatePostAsync("pointers", {
                        path: nodeutil.sanitizePath(path),
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

export function getFiles(): string[] {
    let res: string[] = []
    function loop(path: string) {
        for (let fn of fs.readdirSync(path)) {
            if (fn[0] == "." || fn[0] == "_") continue;
            let fp = path + "/" + fn
            let st = fs.statSync(fp)
            if (st.isDirectory()) loop(fp)
            else if (st.isFile()) res.push(fp.replace(/^docs/, ""))
        }
    }
    loop("docs")
    if (fs.existsSync("docs/_locales"))
        loop("docs/_locales")
    return res
}

function uploadJsonAsync() {
    uploadDir = "built"
    return uploadFileAsync("/theme.json")
        .then(uploadSitemapAsync)
}

function uploadSitemapAsync() {
    if (!sitemap) return Promise.resolve()
    let k = Object.keys(sitemap)
    k.sort(U.strcmp)
    k.unshift(pxt.appTarget.appTheme.homeUrl + "beta")
    k.unshift(pxt.appTarget.appTheme.homeUrl)
    let urls = k.map(u => `  <url><loc>${pxt.appTarget.appTheme.homeUrl + u.slice(1)}</loc></url>\n`)
    let map = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>
`
    fs.writeFileSync("built/sitemap.xml", map)
    return uploadFileAsync("/sitemap.xml")
        .then(bloburl => {
            let robots = "Sitemap: " + pxt.appTarget.appTheme.homeUrl + "sitemap.xml\n"
            fs.writeFileSync("built/robots.txt", robots)
            return uploadFileAsync("/robots.txt")
        })
        .then(() => { })
}

function getDocsFiles(args: string[]): string[] {
    if (args[0] == "-v") {
        showVerbose = true
        args.shift()
    }

    // core 'target' is prefix-less - it contains docs for the entire system
    if (pxt.appTarget.id != "core")
        ptrPrefix = "/" + pxt.appTarget.id

    let files = args.map(a => {
        if (U.startsWith(a, "docs/")) return a.slice(4)
        else throw error("File name has to start with docs/: " + a)
    })
    if (files.length == 0) {
        files = getFiles()
        sitemap = {} // only build sitemap 
    }
    return files;
}

export function uploadDocsAsync(...args: string[]): Promise<void> {
    let files = getDocsFiles(args);

    uploadDir = "docs"
    return Promise.map(files, uploadFileAsync, { concurrency: 20 })
        .then(() => {
            for (let k of Object.keys(uploadPromises)) {
                if (/^\/static\//.test(k) && !usedPromises[k]) {
                    console.log("unused:", k)
                }
            }
        })
        .then(uploadJsonAsync)
        .then(() => {
            console.log("ALL DONE")
        })
}

export function checkDocsAsync(...args: string[]): Promise<void> {
    console.log(`checking docs`);
    let files = getFiles();

    // known urls
    let urls: U.Map<string> = {};
    files.forEach(f => urls[f.replace(/\.md$/i, '')] = f);

    let checked = 0;
    let broken = 0;
    let snipCount = 0;
    files.filter(f => /\.md$/i.test(f)).forEach(f => {
        let header = false;
        let contentType = U.getMime(f)
        if (!contentType || !/^text/.test(contentType))
            return;
        checked++;
        let text = fs.readFileSync("docs" + f).toString("utf8");
        // look for broken urls
        text.replace(/]\((\/[^)]+)\)/g, (m) => {
            let url = /]\((\/[^)]+)\)/.exec(m)[1];
            if (!urls[url]) {
                console.error(`${f}: broken link ${url}`);
                broken++;
            }
            return '';
        })

        let snippets = getSnippets(text)
        snipCount += snippets.length
        for (let snipIndex = 0; snipIndex < snippets.length; snipIndex++) {
            let dir = "built/docs/snippets/" + snippets[snipIndex].type;
            let fn = `${dir}/${f.replace(/^\//, '').replace(/\//g, '-').replace(/\.\w+$/, '')}-${snipIndex}.ts`;
            nodeutil.mkdirP(dir);
            fs.writeFileSync(fn, snippets[snipIndex].code);
        }
    });

    console.log(`checked ${checked} files: ${broken} broken links, ${snipCount} snippets`);
    return Promise.resolve();
}

export interface SnippetInfo {
    type: string
    code: string
    ignore: boolean
    index: number
}

export function getSnippets(source: string): SnippetInfo[] {
    let snippets: SnippetInfo[] = []
    let re = /^`{3}([\S]+)?\s*\n([\s\S]+?)\n`{3}\s*?$/gm;
    let index = 0
    source.replace(re, (match, type, code) => {
        snippets.push({
            type: type ? type.replace("-ignore", "") : "pre",
            code: code,
            ignore: type ? /-ignore/g.test(type) : false,
            index: index
        })
        index++
        return ''
    })
    return snippets
}