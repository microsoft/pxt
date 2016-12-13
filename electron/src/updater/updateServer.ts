"use strict";

import * as Promise from "bluebird";
import * as http from "http";
import * as I from "../typings/interfaces";
import product from "../util/productInfoLoader";
import * as qs from "querystring";
import * as url from "url";
import * as Utils from "../util/electronUtils";

/**
 * This server is needed due to how Squirrel.Mac works. Squirrel.Mac expects JSON responses in a specific format.
 * Because we host update binaries on Github, we need a "proxy" server that will translate responses from PXT API to a
 * format Squirrel understands / expects.
 */
export class UpdateServer {
    private server: http.Server = null;

    public get url(): string {
        return `http://localhost:${this.server.address().port}`;
    }

    public start(): Promise<void> {
        let deferred = Utils.defer<void>();

        this.server = http.createServer(this.requestHandler);
        this.server.listen(0, "localhost", null, () => {
            console.log(`Update server running at: ${this.url}`);
            deferred.resolve();
        });
        this.server.on("error", (e) => {
            deferred.reject(e);
        });

        return deferred.promise;
    }

    public getFeedUrl(targetVersion: string): string {
        let queryParams = qs.stringify({
            platform: process.platform,
            targetVersion
        } as I.FeedUrlParams);

        return `${this.url}?${queryParams}`;
    }

    private requestHandler(request: http.IncomingMessage, response: http.ServerResponse): void {
        let parsedUrl = url.parse(request.url, true);
        let params = parsedUrl.query as I.FeedUrlParams;

        if (!product.updateDownloadUrl) {
            // Cannot download updates for this product
            response.statusCode = 404;
            response.end();
            return;
        }

        let downloadUrl = [
            product.updateDownloadUrl
        ];

        if (!/\/$/.test(product.updateDownloadUrl)) {
            downloadUrl.push("/");
        }

        downloadUrl.push(`${params.targetVersion}/`);
        downloadUrl.push(params.platform);

        if (product.isBeta) {
            downloadUrl.push("-beta");
        }

        let updateInfo: I.Update = {
            url: downloadUrl.join(""),
            version: params.targetVersion
        };

        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(updateInfo));
    }
}