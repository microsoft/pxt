import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';

import * as nodeutil from './nodeutil';

import U = yelm.Util;
import Cloud = yelm.Cloud;

let root = process.cwd()
let dirs = ["built/web", "webapp/public"].map(p => path.join(root, p))
let fileDir = path.join(root, "libs")

let statAsync = Promise.promisify(fs.stat)
let readdirAsync = Promise.promisify(fs.readdir)
let existsAsync = Promise.promisify(fs.exists)
let readFileAsync = Promise.promisify(fs.readFile)
let writeFileAsync: any = Promise.promisify(fs.writeFile)

function returnDirAsync(logicalDirname: string, depth: number): Promise<any[]> {
    let dirname = path.join(fileDir, logicalDirname)
    return readdirAsync(dirname)
        .then(files =>
            Promise.map(files, fn =>
                statAsync(path.join(dirname, fn))
                    .then<any[]>(st => {
                        if (st.isDirectory() && depth > 1)
                            return returnDirAsync(logicalDirname + "/" + fn, depth - 1)
                        else if (fn == "yelm.json")
                            return readFileAsync(path.join(dirname, fn))
                                .then(buf => {
                                    try {
                                        let v = JSON.parse(buf.toString("utf8"))
                                        v.__path = logicalDirname
                                        return [v]
                                    } catch (e) {
                                        return []
                                    }
                                })
                        else return []
                    })))
        .then(U.concat)
}

export function serveAsync() {
    let server = http.createServer((req, res) => {
        let error = (code: number, msg: string = null) => {
            res.writeHead(code, { "Content-Type": "text/plain" })
            res.end(msg || "Error " + code)
        }

        let sendJson = (v: any) => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf8' })
            res.end(JSON.stringify(v))
        }

        let readJsonAsync = () =>
            nodeutil.readResAsync(req)
                .then(buf => JSON.parse(buf.toString("utf8")))

        let sendFile = (filename: string) => {
            let stat = fs.statSync(filename);

            res.writeHead(200, {
                'Content-Type': U.getMime(filename),
                'Content-Length': stat.size
            });

            fs.createReadStream(filename).pipe(res);
        }

        let pathname = decodeURI(url.parse(req.url).pathname);

        if (pathname == "/") {
            res.writeHead(301, { location: '/index.html' })
            res.end()
            return
        }

        let elts = pathname.split("/").filter(s => !!s)
        if (elts.some(s => s[0] == ".")) {
            return error(400, "Bad path :-(\n")
        }

        if (elts[0] == "file") {
            let opts: U.Map<string> = querystring.parse(url.parse(req.url).query)
            let innerPath = elts.slice(1).join("/")
            let filename = path.resolve(path.join(fileDir, innerPath))
            let meth = req.method.toUpperCase()
            let onlyStat = U.lookup(opts, "onlystat")

            statAsync(filename)
                .then(st => st, err => null)
                .then((st: fs.Stats) => {
                    if (meth == "PUT" || meth == "POST") {
                        if (!st || st.isFile()) {
                            readJsonAsync()
                                .then(jr => {
                                    if (jr.mtime == null ||
                                        (!st && jr.mtime === 0) ||
                                        (st && jr.mtime === st.mtime.getTime())) {
                                        (writeFileAsync(filename, jr.content) as Promise<void>)
                                            .then(() => statAsync(filename))
                                            .then(st => sendJson({ mtime: st.mtime.getTime() }))
                                    } else {
                                        error(409)
                                    }
                                })
                        } else {
                            error(405)
                        }
                    } else if (meth == "GET") {
                        if (!st)
                            error(404, "Missing file")
                        else if (st.isDirectory())
                            returnDirAsync(innerPath, 2)
                                .then(sendJson)
                        else if (st.isFile() && onlyStat)
                            sendJson({
                                mtime: st.mtime.getTime(),
                            })
                        else if (st.isFile())
                            readFileAsync(filename)
                                .then(buf => sendJson({
                                    mtime: st.mtime.getTime(),
                                    content: buf.toString("utf8")
                                }))
                        else
                            error(500)
                    } else {
                        error(405)
                    }
                })
                .done()
            return
        }

        for (let dir of dirs) {
            let filename = path.resolve(path.join(dir, pathname))
            if (fs.existsSync(filename)) {
                sendFile(filename)
                return;
            }
        }

        return error(404, "Not found :(\n")
    });

    server.listen(3232, "127.0.0.1");

    console.log("Serving from http://127.0.0.1:3232/");

    return new Promise<void>((resolve, reject) => { })
}
