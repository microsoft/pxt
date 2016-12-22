"use strict";

import * as Promise from "bluebird";
import * as crypto from "crypto";
import * as events from "events";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as I from "../typings/interfaces";
import * as path from "path";
import * as stream from "stream";
import * as url from "url";
import { createGunzip } from "zlib";

export let fsReaddirPromise = Promise.promisify(fs.readdir);
export let fsReadFilePromise = Promise.promisify<string | Buffer, string, string>(fs.readFile);
export let fsRenamePromise = Promise.promisify<void, string, string>(fs.rename);
export let fsStatPromise = Promise.promisify(fs.stat);
export let fsUnlinkPromise = Promise.promisify<void, string>(fs.unlink);
export let fsWriteFilePromise = Promise.promisify<void, string, any>(fs.writeFile);

export function defer<T>(): I.Deferred<T> {
    let resolve: (thenableOrResult?: T | PromiseLike<T>) => void;
    let reject: (error: any) => void;
    let promise = new Promise<T>((r, e) => {
        resolve = r;
        reject = e;
    });

    return {
        resolve,
        reject,
        promise
    };
}

export function retryAsync<T>(func: () => Promise<T>, condition: (result: T) => boolean, maxIterations: number, failureMsg: string, delay: number = 100, iteration: number = 0): Promise<T> {
    function newIteration() {
        return Promise.delay(delay).then(() => retryAsync(func, condition, maxIterations, failureMsg, delay, iteration + 1));
    }

    if (iteration < maxIterations) {
        return func()
            .then(result => {
                if (condition(result)) {
                    return result;
                }

                return newIteration();
            }, (e) => {
                return newIteration();
            });
    }

    return Promise.reject(new Error(failureMsg));
}

export function randomInt(minInclusive: number, maxInclusive: number): number {
    if (minInclusive > maxInclusive) {
        const tmp = minInclusive;
        minInclusive = maxInclusive;
        maxInclusive = tmp;
    }

    return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

export function mkdirp(thePath: string) {
    if (thePath == ".") {
        return;
    }

    if (!fs.existsSync(thePath)) {
        mkdirp(path.dirname(thePath));
        fs.mkdirSync(thePath);
    }
}

export function fileExistsAsync(thePath: string) {
    return fsStatPromise(thePath)
        .then((stats) => {
            return true;
        })
        .catch((e) => {
            return false;
        });
}

export function readJsonFileAsync<T>(thePath: string): Promise<T> {
    return fileExistsAsync(thePath)
        .then((exists) => {
            if (!exists) {
                return Promise.resolve(null);
            }

            return fsReadFilePromise(thePath, "utf8");
        })
        .then((content: string) => {
            return JSON.parse(content) as T;
        });
}

export function writeJsonFileAsync<T>(content: T, thePath: string): Promise<void> {
    return fsWriteFilePromise(thePath, JSON.stringify(content));
}

export function requestAsStream(options: I.RequestOptions): Promise<I.RequestContext> {
    let deferred = defer<I.RequestContext>();
    let req: http.ClientRequest;
    const endpoint = url.parse(options.url);
    const rawRequest = endpoint.protocol === 'https:' ? https.request : http.request;
    const opts: https.RequestOptions = {
        hostname: endpoint.hostname,
        port: endpoint.port ? parseInt(endpoint.port) : (endpoint.protocol === 'https:' ? 443 : 80),
        path: endpoint.path,
        method: options.type || 'GET',
        headers: options.headers,
        agent: options.agent,
        rejectUnauthorized: isBoolean(options.strictSSL) ? options.strictSSL : true
    };

    if (options.user && options.password) {
        opts.auth = options.user + ':' + options.password;
    }

    req = rawRequest(opts, (res: http.ClientResponse) => {
        const followRedirects = isNumber(options.followRedirects) ? options.followRedirects : 3;

        if (res.statusCode >= 300 && res.statusCode < 400 && followRedirects > 0 && res.headers['location']) {
            requestAsStream(Object.assign({}, options, {
                url: res.headers['location'],
                followRedirects: followRedirects - 1
            })).done(deferred.resolve, deferred.reject);
        } else {
            let stream: stream = res;

            if (res.headers['content-encoding'] === 'gzip') {
                stream = stream.pipe(createGunzip());
            }

            deferred.resolve({ req, res, stream });
        }
    });
    req.on('error', (e) => {
        deferred.reject(e)
    });

    if (options.timeout) {
        req.setTimeout(options.timeout);
    }

    if (options.data) {
        req.write(options.data);
    }

    req.end();

    return deferred.promise;
}

export function download(filePath: string, context: I.RequestContext): Promise<void> {
    let deferred = defer<void>();
    const out = fs.createWriteStream(filePath);

    out.once("finish", () => deferred.resolve());
    context.stream.once("error", (e: any) => deferred.reject(e));
    context.stream.pipe(out);

    return deferred.promise;
}

export function asJson<T>(context: I.RequestContext, ignoreBadStatus: boolean = false): Promise<T> {
    let deferred = defer<T>();

    if (!ignoreBadStatus && !isSuccess(context)) {
        deferred.reject(new Error("Bad HTTP status: " + context.res.statusCode));
    }

    if (hasNoContent(context)) {
        deferred.resolve(null);
    }

    const buffer: string[] = [];
    context.stream.on("data", (d: string) => buffer.push(d));
    context.stream.on("end", () => {
        let jsonContent: T = null;

        try {
            jsonContent = JSON.parse(buffer.join(""));
        } catch (e) {
            deferred.reject(new Error("Response doesn't appear to be JSON"));
            return;
        }

        deferred.resolve(jsonContent);
    });
    context.stream.on("error", (e: any) => {
        deferred.reject(e);
    });

    return deferred.promise;
}

function isSuccess(context: I.RequestContext): boolean {
    return (context.res.statusCode >= 200 && context.res.statusCode < 300) || context.res.statusCode === 1223;
}

function hasNoContent(context: I.RequestContext): boolean {
    return context.res.statusCode === 204;
}

function isNumber(obj: any): obj is number {
    if ((typeof (obj) === "number" || obj instanceof Number) && !isNaN(<any>obj)) {
        return true;
    }

    return false;
}

function isBoolean(obj: any): obj is boolean {
    return obj === true || obj === false;
}