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

    export function oops(msg = "OOPS") {
        throw new Error(msg)
    }

    export function clone<T>(v: T): T {
        if (v == null) return null
        return JSON.parse(JSON.stringify(v))
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
    
    export function httpGetJsonAsync(url:string) {
        return requestAsync({ url: url }).then(resp => resp.json)
    }
    
    export function httpPostJsonAsync(url:string, data: any) {
        return requestAsync({ url: url, data: data || {} }).then(resp => resp.json)
    }
    
    // TODO add web implementations below    
    export var httpRequestCoreAsync: (options: HttpRequestOptions) => Promise<HttpResponse>;
}

namespace Cloud {
    export var apiRoot = "https://www.touchdevelop.com/api/";
    export var accessToken = "";
    
    export function privateRequestAsync(options:Util.HttpRequestOptions) {
        options.url = apiRoot + options.url
        if (!options.headers) options.headers = {}
        options.headers["x-td-access-token"] = accessToken
        return Util.requestAsync(options)
    }
    
    export function privateGetAsync(path:string) {
        return privateRequestAsync({ url: path }).then(resp => resp.json)
    }
    
    export function privateDeleteAsync(path:string) {
        return privateRequestAsync({ url: path, method: "DELETE" }).then(resp => resp.json)
    }
    
    export function privatePostAsync(path:string, data: any) {
        return privateRequestAsync({ url: path, data: data || {} }).then(resp => resp.json)
    }    
}
