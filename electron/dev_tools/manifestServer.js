/**
 * A small server to help test app update scenarios. This server serves a fake release manifest located at ./test_data/release.json.
 */

"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

function getUrl() {
    return `http://localhost:${server.address().port}`;
}

let server = http.createServer(requestHandler);
server.listen(0, "localhost", null, () => {
    console.log(`Release manifest server running at: ${getUrl()}`);
});
server.on("error", (e) => {
    console.error(`Error in release manifest server: ${e}`);
});

function requestHandler(request, response) {
    let error = (e) => {
        response.statusCode = 500;
        response.end(e);
    };

    try {
        const testReleaseManifestPath = path.join(__dirname, "test_data", "release.json");
        let testReleaseManifest = JSON.parse(fs.readFileSync(testReleaseManifestPath, "utf8"));

        response.statusCode = 200;
        response.setHeader("content-type", "application/json");

        // Simulate network delay
        setTimeout(function () {
            response.end(JSON.stringify(testReleaseManifest));
        }, 1000);
    } catch (e) {
        console.log(`Error: ${e}`);
        error(e);
    }
}
