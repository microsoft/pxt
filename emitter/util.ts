/// <reference path="../typings/bluebird/bluebird.d.ts"/>

namespace Util {
    export interface StringMap<T> {
        [index: string]: T;
    }
    export function assert(cond: boolean, msg = "Assertion failed") {
        if (!cond) {
            throw new Error(msg)
        }
    }

    export function oops(msg = "OOPS"):Error {
        throw new Error(msg)
    }

    export function clone<T>(v: T): T {
        if (v == null) return null
        return JSON.parse(JSON.stringify(v))
    }

    export function iterStringMap<T>(m: StringMap<T>, f: (k: string, v: T) => void) {
        Object.keys(m).forEach(k => f(k, m[k]))
    }

    export function mapStringMap<T, S>(m: StringMap<T>, f: (k: string, v: T) => S) {
        let r: StringMap<S> = {}
        Object.keys(m).forEach(k => r[k] = f(k, m[k]))
    }

    export function mapStringMapAsync<T, S>(m: StringMap<T>, f: (k: string, v: T) => Promise<S>) {
        let r: StringMap<S> = {}
        return Promise.all(Object.keys(m).map(k => f(k, m[k]).then(v => r[k] = v)))
            .then(() => r)
    }


    export function pushRange<T>(trg: T[], src: T[]) {
        for (let i = 0; i < src.length; ++i)
            trg.push(src[i])
    }

    export function concat<T>(arrays: T[][]): T[] {
        let r: T[] = []
        for (let i = 0; i < arrays.length; ++i) {
            pushRange(r, arrays[i])
        }
        return r
    }

    export function strcmp(a: string, b: string) {
        if (a == b) return 0;
        if (a < b) return -1;
        else return 1;
    }

    export function sortObjectFields<T>(o: T): T {
        let keys = Object.keys(o)
        keys.sort(strcmp)
        let r: any = {}
        keys.forEach(k => r[k] = (<any>o)[k])
        return r
    }

    export var isNodeJS = false;

    export interface HttpRequestOptions {
        url: string;
        method?: string; // default to GET
        data?: any;
        headers?: StringMap<string>;
        allowHttpErrors?: boolean; // don't treat non-200 responses as errors
    }

    export interface HttpResponse {
        statusCode: number;
        headers: StringMap<string>;
        buffer?: any;
        text?: string;
        json?: any;
    }

    export function requestAsync(options: HttpRequestOptions): Promise<HttpResponse> {
        return httpRequestCoreAsync(options)
            .then(resp => {
                if (resp.statusCode != 200 && !options.allowHttpErrors)
                    throw new Error("Bad HTTP status code: " + resp.statusCode + " at " + options.url)
                if (resp.text && /application\/json/.test(resp.headers["content-type"]))
                    resp.json = JSON.parse(resp.text)
                return resp
            })
    }

    export function httpGetJsonAsync(url: string) {
        return requestAsync({ url: url }).then(resp => resp.json)
    }

    export function httpPostJsonAsync(url: string, data: any) {
        return requestAsync({ url: url, data: data || {} }).then(resp => resp.json)
    }

    export function userError(msg: string):Error {
        let e = new Error(msg);
        (<any>e).isUserError = true;
        throw e
    }

    // TODO add web implementations below    
    export var httpRequestCoreAsync: (options: HttpRequestOptions) => Promise<HttpResponse>;
    export var sha256: (hashData: string) => string;

}

namespace Cloud {
    export var apiRoot = "https://mbit.touchdevelop.com/api/";
    export var accessToken = "";

    export function privateRequestAsync(options: Util.HttpRequestOptions) {
        options.url = apiRoot + options.url
        if (accessToken) {
            if (!options.headers) options.headers = {}
            options.headers["x-td-access-token"] = accessToken
        }
        return Util.requestAsync(options)
    }

    export function privateGetAsync(path: string) {
        return privateRequestAsync({ url: path }).then(resp => resp.json)
    }

    export function privateDeleteAsync(path: string) {
        return privateRequestAsync({ url: path, method: "DELETE" }).then(resp => resp.json)
    }

    export function privatePostAsync(path: string, data: any) {
        return privateRequestAsync({ url: path, data: data || {} }).then(resp => resp.json)
    }
}
