import http = require('http');
import url = require('url');
import mkc = require('./mkc');

const mime: pxt.Map<string> = {
    js: "application/javascript",
    css: "text/css",
    html: "text/html"
}

export function startSimServer(ed: mkc.DownloadedEditor, port = 7000) {
    http.createServer(async (request, response) => {
        let path = request.url
        if (path == "/")
            path = "/sim.html"
        path = path.replace(/.*\//, "")
        path = path.replace(/\?.*/, "")

        let buf: Buffer = null
        if (/^[\w\.\-]+$/.test(path))
            buf = await ed.cache.getAsync(ed.website + "-" + path)

        if (buf) {
            const m = mime[path.replace(/.*\./, "")] || "application/octet-stream"
            response.writeHead(200, { 'Content-type': m });
            response.end(buf);
        } else {
            response.writeHead(404, { 'Content-type': 'text/plain' });
            response.end("Not found");
        }
    }).listen(port);
}
