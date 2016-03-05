import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';

import U = yelm.Util;
import Cloud = yelm.Cloud;

export function serveAsync() {
    let root = process.cwd()
    let dirs = ["built/web", "webapp/public"].map(p => path.join(root, p) + path.sep)

    let server = http.createServer((req, res) => {
        let pathname = decodeURI(url.parse(req.url).pathname);

        if (pathname == "/") {
            res.writeHead(301, { location: '/index.html' })
            res.end()
            return
        }

        for (let dir of dirs) {
            let filename = path.resolve(path.join(dir, pathname))
            if (U.startsWith(filename, dir) && fs.existsSync(filename)) {
                let stat = fs.statSync(filename);

                res.writeHead(200, {
                    'Content-Type': U.getMime(filename),
                    'Content-Length': stat.size
                });

                fs.createReadStream(filename).pipe(res);
                return;
            }
        }

        let elts = pathname.split("/").filter(s => !!s)
        switch (elts[0]) {
            case "file":
                break;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found :(\n");
    });

    server.listen(3232, "127.0.0.1");

    console.log("Serving from http://127.0.0.1:3232/");

    return new Promise<void>((resolve, reject) => { })
}