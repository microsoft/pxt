/// <reference path="../../typings/bluebird/bluebird.d.ts"/>

namespace ts.pxtc {
    export var __dummy = 42;
}

import pxtc = ts.pxtc

namespace ts.pxtc.Util {
    export function assert(cond: boolean, msg = "Assertion failed") {
        if (!cond) {
            debugger
            throw new Error(msg)
        }
    }

    export function repeatMap<T>(n: number, fn: (index: number) => T): T[] {
        n = n || 0;
        let r: T[] = [];
        for (let i = 0; i < n; ++i) r.push(fn(i));
        return r;
    }

    export function listsEqual<T>(a: T[], b: T[]): boolean {
        if (!a || !b || a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    export function oops(msg = "OOPS"): Error {
        debugger
        throw new Error(msg)
    }

    export function reversed<T>(arr: T[]) {
        arr = arr.slice(0)
        arr.reverse()
        return arr
    }

    export function flatClone<T>(obj: T): T {
        if (obj == null) return null
        let r: any = {}
        Object.keys(obj).forEach((k) => { r[k] = (obj as any)[k] })
        return r;
    }

    export function clone<T>(v: T): T {
        if (v == null) return null
        return JSON.parse(JSON.stringify(v))
    }

    export function iterMap<T>(m: pxt.Map<T>, f: (k: string, v: T) => void) {
        Object.keys(m).forEach(k => f(k, m[k]))
    }

    export function mapMap<T, S>(m: pxt.Map<T>, f: (k: string, v: T) => S) {
        let r: pxt.Map<S> = {}
        Object.keys(m).forEach(k => r[k] = f(k, m[k]))
        return r
    }

    export function mapStringMapAsync<T, S>(m: pxt.Map<T>, f: (k: string, v: T) => Promise<S>) {
        let r: pxt.Map<S> = {}
        return Promise.all(Object.keys(m).map(k => f(k, m[k]).then(v => r[k] = v)))
            .then(() => r)
    }

    export function values<T>(m: pxt.Map<T>) {
        return Object.keys(m || {}).map(k => m[k])
    }

    export function lookup<T>(m: pxt.Map<T>, key: string): T {
        if (m.hasOwnProperty(key))
            return m[key]
        return null
    }

    export function pushRange<T>(trg: T[], src: T[]): void {
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

    function isKV(v: any) {
        return !!v && typeof v === "object" && !Array.isArray(v)
    }

    export function jsonMergeFrom(trg: any, src: any) {
        if (!src) return;
        Object.keys(src).forEach(k => {
            if (isKV(trg[k]) && isKV(src[k]))
                jsonMergeFrom(trg[k], src[k]);
            else trg[k] = clone(src[k]);
        });
    }

    export function jsonCopyFrom<T>(trg: T, src: T) {
        let v = clone(src)
        for (let k of Object.keys(src)) {
            (trg as any)[k] = (v as any)[k]
        }
    }

    // { a: { b: 1 }, c: 2} => { "a.b": 1, c: 2 }
    export function jsonFlatten(v: any) {
        let res: pxt.Map<any> = {}
        let loop = (pref: string, v: any) => {
            if (v !== null && typeof v == "object") {
                assert(!Array.isArray(v))
                if (pref) pref += "."
                for (let k of Object.keys(v)) {
                    loop(pref + k, v[k])
                }
            } else {
                res[pref] = v
            }
        }
        loop("", v)
        return res
    }

    export function jsonUnFlatten(v: pxt.Map<any>) {
        let res: any = {}
        for (let k of Object.keys(v)) {
            let ptr = res
            let parts = k.split(".")
            for (let i = 0; i < parts.length; ++i) {
                let part = parts[i]
                if (i == parts.length - 1)
                    ptr[part] = v[k]
                else {
                    if (typeof ptr[part] != "object") ptr[part] = {}
                    ptr = ptr[part]
                }
            }
        }
        return res
    }

    export function strcmp(a: string, b: string) {
        if (a == b) return 0;
        if (a < b) return -1;
        else return 1;
    }

    export function stringMapEq(a: pxt.Map<string>, b: pxt.Map<string>) {
        let ak = Object.keys(a)
        let bk = Object.keys(b)
        if (ak.length != bk.length) return false
        for (let k of ak) {
            if (!b.hasOwnProperty(k)) return false
            if (a[k] !== b[k]) return false
        }
        return true
    }

    export function endsWith(str: string, suffix: string) {
        if (str.length < suffix.length) return false
        if (suffix.length == 0) return true
        return str.slice(-suffix.length) == suffix
    }

    export function startsWith(str: string, prefix: string) {
        if (str.length < prefix.length) return false
        if (prefix.length == 0) return true
        return str.slice(0, prefix.length) == prefix
    }

    export function replaceAll(str: string, old: string, new_: string): string {
        if (!old) return str;
        return str.split(old).join(new_);
    }

    export function sortObjectFields<T>(o: T): T {
        let keys = Object.keys(o)
        keys.sort(strcmp)
        let r: any = {}
        keys.forEach(k => r[k] = (<any>o)[k])
        return r
    }

    export function chopArray<T>(arr: T[], chunkSize: number): T[][] {
        let res: T[][] = []
        for (let i = 0; i < arr.length; i += chunkSize)
            res.push(arr.slice(i, i + chunkSize))
        return res
    }

    export function unique<T>(arr: T[], f: (t: T) => string): T[] {
        let v: T[] = [];
        let r: { [index: string]: any; } = {}
        arr.forEach(e => {
            let k = f(e)
            if (!r.hasOwnProperty(k)) {
                r[k] = null;
                v.push(e);
            }
        })
        return v;
    }

    export function groupBy<T>(arr: T[], f: (t: T) => string): pxt.Map<T[]> {
        let r: pxt.Map<T[]> = {}
        arr.forEach(e => {
            let k = f(e)
            if (!r.hasOwnProperty(k)) r[k] = []
            r[k].push(e)
        })
        return r
    }

    export function toDictionary<T>(arr: T[], f: (t: T) => string): pxt.Map<T> {
        let r: pxt.Map<T> = {}
        arr.forEach(e => { r[f(e)] = e })
        return r
    }

    export interface ArrayLike<T> {
        [index: number]: T;
        length: number;
    }

    export function toArray<T>(a: ArrayLike<T>): T[] {
        let r: T[] = []
        for (let i = 0; i < a.length; ++i)
            r.push(a[i])
        return r
    }

    export function indexOfMatching<T>(arr: T[], f: (t: T) => boolean): number {
        for (let i = 0; i < arr.length; ++i)
            if (f(arr[i])) return i;
        return -1;
    }

    export function nextTick(f: () => void) {
        (<any>Promise)._async._schedule(f)
    }


    export function memoizeString<T>(createNew: (id: string) => T): (id: string) => T {
        return memoize(s => s, createNew)
    }

    export function memoize<S, T>(getId: (v: S) => string, createNew: (v: S) => T): (id: S) => T {
        const cache: pxt.Map<T> = {}
        return (v: S) => {
            const id = getId(v)
            if (cache.hasOwnProperty(id))
                return cache[id]
            return (cache[id] = createNew(v))
        }
    }

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    export function debounce(func: () => void, wait: number, immediate: boolean) {
        let timeout: any;
        return function () {
            let context = this
            let args = arguments;
            let later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            let callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    export function randomPermute<T>(arr: T[]) {
        for (let i = 0; i < arr.length; ++i) {
            let j = randomUint32() % arr.length
            let tmp = arr[i]
            arr[i] = arr[j]
            arr[j] = tmp
        }
    }

    export function randomPick<T>(arr: T[]): T {
        if (arr.length == 0) return null;
        return arr[randomUint32() % arr.length];
    }

    let awesomeAdj: string[];
    export function getAwesomeAdj(): string {
        if (!awesomeAdj)
            awesomeAdj = (
                lf("amazing, astonishing, astounding, awe-inspiring, awesome, breathtaking, classic, cool, curious, distinct, exceptional, exclusive, extraordinary, fabulous, fantastic, glorious, great, ") +
                lf("incredible, magical, marvellous, marvelous, mind-blowing, mind-boggling, miraculous, peculiar, phenomenal, rad, rockin', special, spectacular, startling, stunning, super-cool, ") +
                lf("superior, supernatural, terrific, unbelievable, unearthly, unique, unprecedented, unusual, weird, wonderful, wondrous")
            ).split(/\s*[,،、]\s*/)
        return randomPick(awesomeAdj)
    }

    export function isoTime(time: number) {
        let d = new Date(time * 1000)
        return Util.fmt("{0}-{1:f02.0}-{2:f02.0} {3:f02.0}:{4:f02.0}:{5:f02.0}",
            d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
    }

    export function timeSince(time: number) {
        let now = Date.now();
        time *= 1000;
        let diff = (now - time) / 1000;
        if (isNaN(diff)) return ""

        if (diff < -30) {
            diff = -diff;
            if (diff < 60) return lf("in a few seconds");
            if (diff < 2 * 60) return lf("in a minute");
            if (diff < 60 * 60) return lf("in {0} minute{0:s}", Math.floor(diff / 60));
            if (diff < 2 * 60 * 60) return lf("in an hour");
            if (diff < 60 * 60 * 24) return lf("in {0} hour{0:s}", Math.floor(diff / 60 / 60))
            if (diff < 60 * 60 * 24 * 30) return lf("in {0} day{0:s}", Math.floor(diff / 60 / 60 / 24))
            if (diff < 60 * 60 * 24 * 365) return lf("in {0} month{0:s}", Math.floor(diff / 60 / 60 / 24 / 30))
            return lf("in {0} year{0:s}", Math.floor(diff / 60 / 60 / 24 / 365))
        } else {
            if (diff < 0) return lf("now");
            if (diff < 10) return lf("a few seconds ago");
            if (diff < 60) return lf("{0} second{0:s} ago", Math.floor(diff))
            if (diff < 2 * 60) return lf("a minute ago");
            if (diff < 60 * 60) return lf("{0} minute{0:s} ago", Math.floor(diff / 60))
            if (diff < 2 * 60 * 60) return lf("an hour ago");
            if (diff < 60 * 60 * 24) return lf("{0} hour{0:s} ago", Math.floor(diff / 60 / 60))
            if (diff < 60 * 60 * 24 * 30) return lf("{0} day{0:s} ago", Math.floor(diff / 60 / 60 / 24))
            if (diff < 60 * 60 * 24 * 365) return lf("{0} month{0:s} ago", Math.floor(diff / 60 / 60 / 24 / 30))
            return lf("{0} year{0:s} ago", Math.floor(diff / 60 / 60 / 24 / 365))
        }
    }

    export function escapeForRegex(str: string) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    export function stripUrlProtocol(str: string) {
        return str.replace(/.*?:\/\//g, "");
    }
    export let isNodeJS = false;

    export interface HttpRequestOptions {
        url: string;
        method?: string; // default to GET
        data?: any;
        headers?: pxt.Map<string>;
        allowHttpErrors?: boolean; // don't treat non-200 responses as errors
        allowGzipPost?: boolean;
    }

    export interface HttpResponse {
        statusCode: number;
        headers: pxt.Map<string>;
        buffer?: any;
        text?: string;
        json?: any;
    }

    export function requestAsync(options: HttpRequestOptions): Promise<HttpResponse> {
        return httpRequestCoreAsync(options)
            .then(resp => {
                if (resp.statusCode != 200 && !options.allowHttpErrors) {
                    let msg = Util.lf("Bad HTTP status code: {0} at {1}; message: {2}",
                        resp.statusCode, options.url, (resp.text || "").slice(0, 500))
                    let err: any = new Error(msg)
                    err.statusCode = resp.statusCode
                    return Promise.reject(err)
                }
                if (resp.text && /application\/json/.test(resp.headers["content-type"]))
                    resp.json = JSON.parse(resp.text)
                return resp
            })
    }

    export function httpGetTextAsync(url: string) {
        return requestAsync({ url: url }).then(resp => resp.text)
    }

    export function httpGetJsonAsync(url: string) {
        return requestAsync({ url: url }).then(resp => resp.json)
    }

    export function httpPostJsonAsync(url: string, data: any) {
        return requestAsync({ url: url, data: data || {} }).then(resp => resp.json)
    }

    export function userError(msg: string): Error {
        let e = new Error(msg);
        (<any>e).isUserError = true;
        throw e
    }

    // this will take lower 8 bits from each character
    export function stringToUint8Array(input: string) {
        let len = input.length;
        let res = new Uint8Array(len)
        for (let i = 0; i < len; ++i)
            res[i] = input.charCodeAt(i) & 0xff;
        return res;
    }

    export function uint8ArrayToString(input: Uint8Array) {
        let len = input.length;
        let res = ""
        for (let i = 0; i < len; ++i)
            res += String.fromCharCode(input[i]);
        return res;
    }


    export function fromUTF8(binstr: string) {
        if (!binstr) return ""

        // escape function is deprecated
        let escaped = ""
        for (let i = 0; i < binstr.length; ++i) {
            let k = binstr.charCodeAt(i) & 0xff
            if (k == 37 || k > 0x7f) {
                escaped += "%" + k.toString(16);
            } else {
                escaped += binstr.charAt(i)
            }
        }

        // decodeURIComponent does the actual UTF8 decoding
        return decodeURIComponent(escaped)
    }

    export function toUTF8(str: string) {
        let res = "";
        if (!str) return res;
        for (let i = 0; i < str.length; ++i) {
            let code = str.charCodeAt(i);
            if (code <= 0x7f) res += str.charAt(i);
            else if (code <= 0x7ff) {
                res += String.fromCharCode(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            } else {
                if (0xd800 <= code && code <= 0xdbff) {
                    let next = str.charCodeAt(++i);
                    if (!isNaN(next))
                        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
                }

                if (code <= 0xffff)
                    res += String.fromCharCode(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                else
                    res += String.fromCharCode(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
            }

        }
        return res;
    }

    export class PromiseQueue {
        promises: pxt.Map<Promise<any>> = {};

        enqueue<T>(id: string, f: () => Promise<T>): Promise<T> {
            if (!this.promises.hasOwnProperty(id)) {
                this.promises[id] = Promise.resolve()
            }
            let newOne = this.promises[id]
                .catch(e => {
                    Util.nextTick(() => { throw e })
                })
                .then(() => f().then(v => {
                    if (this.promises[id] === newOne)
                        delete this.promises[id];
                    return v;
                }))
            this.promises[id] = newOne;
            return newOne;
        }
    }

    export function now(): number {
        return Date.now();
    }

    export function nowSeconds(): number {
        return Math.round(now() / 1000)
    }

    export function getMime(filename: string) {
        let m = /\.([a-zA-Z0-9]+)$/.exec(filename)
        if (m)
            switch (m[1].toLowerCase()) {
                case "txt": return "text/plain";
                case "html":
                case "htm": return "text/html";
                case "css": return "text/css";
                case "js": return "application/javascript";
                case "jpg":
                case "jpeg": return "image/jpeg";
                case "png": return "image/png";
                case "ico": return "image/x-icon";
                case "manifest": return "text/cache-manifest";
                case "webmanifest": return "application/manifest+json";
                case "json": return "application/json";
                case "svg": return "image/svg+xml";
                case "eot": return "application/vnd.ms-fontobject";
                case "ttf": return "font/ttf";
                case "woff": return "application/font-woff";
                case "woff2": return "application/font-woff2";
                case "md": return "text/markdown";
                case "xml": return "application/xml";
                default: return "application/octet-stream";
            }
        else return "application/octet-stream";
    }

    export function randomUint32() {
        let buf = new Uint8Array(4)
        getRandomBuf(buf)
        return new Uint32Array(buf.buffer)[0]
    }

    export function guidGen() {
        function f() { return (randomUint32() | 0x10000).toString(16).slice(-4); }
        return f() + f() + "-" + f() + "-4" + f().slice(-3) + "-" + f() + "-" + f() + f() + f();
    }

    let _localizeLang: string = "en";
    let _localizeStrings: pxt.Map<string> = {};
    export var localizeLive = false;

    /**
     * Returns the current user language, prepended by "live-" if in live mode
     */
    export function localeInfo(): string {
        return `${localizeLive ? "live-" : ""}${userLanguage()}`;
    }
    /**
     * Returns current user language iSO-code. Default is `en`.
     */
    export function userLanguage(): string {
        return _localizeLang;
    }

    export function userLanguageRtl(): boolean {
        return /^ar|iw/i.test(_localizeLang);
    }

    export function _localize(s: string) {
        return _localizeStrings[s] || s;
    }

    export function downloadLiveTranslationsAsync(lang: string, filename: string) {
            return Util.httpGetJsonAsync(`https://www.pxt.io/api/translations?lang=${encodeURIComponent(lang)}&filename=${encodeURIComponent(filename)}`);
    }

    export function updateLocalizationAsync(baseUrl: string, code: string, live?: boolean): Promise<any> {
        // normalize code (keep synched with localized files)
        if (!/^(es|pt|zh)/i.test(code))
            code = code.split("-")[0]

        if (live) {
            console.log(`loading live translations for ${code}`)
            return downloadLiveTranslationsAsync(code, "strings.json")
                .then(tr => {
                    _localizeStrings = tr || {};
                    _localizeLang = code;
                    localizeLive = true;
                }, e => {
                    console.error('failed to load localizations')
                })
        }

        if (_localizeLang != code) {
            return Util.httpGetJsonAsync(baseUrl + "locales/" + code + "/strings.json")
                .then(tr => {
                    _localizeStrings = tr || {};
                    _localizeLang = code;
                }, e => {
                    console.error('failed to load localizations')
                })
        }
        //
        return Promise.resolve(undefined);
    }

    export function htmlEscape(_input: string) {
        if (!_input) return _input; // null, undefined, empty string test
        return _input.replace(/([^\w .!?\-$])/g, c => "&#" + c.charCodeAt(0) + ";");
    }

    export function jsStringQuote(s: string) {
        return s.replace(/[^\w .!?\-$]/g,
            (c) => {
                let h = c.charCodeAt(0).toString(16);
                return "\\u" + "0000".substr(0, 4 - h.length) + h;
            });
    }

    export function jsStringLiteral(s: string) {
        return "\"" + jsStringQuote(s) + "\"";
    }

    export function fmt_va(f: string, args: any[]): string {
        if (args.length == 0) return f;
        return f.replace(/\{([0-9]+)(\:[^\}]+)?\}/g, function (s: string, n: string, spec: string): string {
            let v = args[parseInt(n)];
            let r = "";
            let fmtMatch = /^:f(\d*)\.(\d+)/.exec(spec);
            if (fmtMatch) {
                let precision = parseInt(fmtMatch[2])
                let len = parseInt(fmtMatch[1]) || 0
                let fillChar = /^0/.test(fmtMatch[1]) ? "0" : " ";
                let num = (<number>v).toFixed(precision)
                if (len > 0 && precision > 0) len += precision + 1;
                if (len > 0) {
                    while (num.length < len) {
                        num = fillChar + num;
                    }
                }
                r = num;
            } else if (spec == ":x") {
                r = "0x" + v.toString(16);
            } else if (v === undefined) r = "(undef)";
            else if (v === null) r = "(null)";
            else if (v.toString) r = v.toString();
            else r = v + "";
            if (spec == ":a") {
                if (/^\s*[euioah]/.test(r.toLowerCase()))
                    r = "an " + r;
                else if (/^\s*[bcdfgjklmnpqrstvwxz]/.test(r.toLowerCase()))
                    r = "a " + r;
            } else if (spec == ":s") {
                if (v == 1) r = ""
                else r = "s"
            } else if (spec == ":q") {
                r = Util.htmlEscape(r);
            } else if (spec == ":jq") {
                r = Util.jsStringQuote(r);
            } else if (spec == ":uri") {
                r = encodeURIComponent(r).replace(/'/g, "%27").replace(/"/g, "%22");
            } else if (spec == ":url") {
                r = encodeURI(r).replace(/'/g, "%27").replace(/"/g, "%22");
            } else if (spec == ":%") {
                r = (v * 100).toFixed(1).toString() + '%';
            }
            return r;
        });
    }

    export function fmt(f: string, ...args: any[]) { return fmt_va(f, args); }

    const locStats: { [index: string]: number; } = {};
    export function dumpLocStats() {
        const r: { [index: string]: string; } = {};
        Object.keys(locStats).sort((a, b) => locStats[b] - locStats[a])
            .forEach(k => r[k] = k);
        console.log('prioritized list of strings:')
        console.log(JSON.stringify(r, null, 2));
    }

    let sForPlural = true;
    export function lf_va(format: string, args: any[]): string {
        locStats[format] = (locStats[format] || 0) + 1;
        let lfmt = Util._localize(format)

        if (!sForPlural && lfmt != format && /\d:s\}/.test(lfmt)) {
            lfmt = lfmt.replace(/\{\d+:s\}/g, "")
        }

        lfmt = lfmt.replace(/\{(id|loc):[^\}]+\}/g, '');

        return fmt_va(lfmt, args);
    }

    export function lf(format: string, ...args: any[]): string {
        return lf_va(format, args);
    }
    /**
     * Similar to lf but the string do not get extracted into the loc file.
     */
    export function rlf(format: string, ...args: any[]): string {
        return lf_va(format, args);
    }

    export let httpRequestCoreAsync: (options: HttpRequestOptions) => Promise<HttpResponse>;
    export let sha256: (hashData: string) => string;
    export let getRandomBuf: (buf: Uint8Array) => void;

    export function capitalize(n: string): string {
        return n ? (n[0].toLocaleUpperCase() + n.slice(1)) : n;
    }

    export function range(len: number) {
        let r: number[] = []
        for (let i = 0; i < len; ++i) r.push(i)
        return r
    }

    export function multipartPostAsync(uri: string, data: any = {}, filename: string = null, filecontents: string = null): Promise<HttpResponse> {
        const boundry = "--------------------------0461489f461126c5"
        let form = ""

        function add(name: string, val: string) {
            form += boundry + "\r\n"
            form += "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"
            form += val + "\r\n"
        }

        function addF(name: string, val: string) {
            form += boundry + "\r\n"
            form += "Content-Disposition: form-data; name=\"files[" + name + "]\"; filename=\"blah.json\"\r\n"
            form += "\r\n"
            form += val + "\r\n"
        }

        Object.keys(data).forEach(k => add(k, data[k]))
        if (filename)
            addF(filename, filecontents)

        form += boundry + "--\r\n"

        return Util.httpRequestCoreAsync({
            url: uri,
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data; boundary=" + boundry.slice(2)
            },
            data: form
        })
    }

    export function toDataUri(data: string, mimetype?: string): string {
        // TODO does this only support trusted data?

        // weed out urls
        if (/^https?:/i.test(data)) return data;

        // already a data uri?
        if (/^data:/i.test(data)) return data;

        // infer mimetype
        if (!mimetype) {
            if (/^<svg/i.test(data)) mimetype = "image/svg+xml";
        }

        // encode
        if (/xml|svg/.test(mimetype)) return `data:${mimetype},${encodeURIComponent(data)}`
        else return `data:${mimetype || "image/png"};base64,${btoa(toUTF8(data))}`;
    }
}

namespace ts.pxtc.BrowserImpl {
    Util.httpRequestCoreAsync = httpRequestCoreAsync;
    Util.sha256 = sha256string;
    Util.getRandomBuf = buf => {
        if (window.crypto)
            window.crypto.getRandomValues(buf);
        else {
            for (let i = 0; i < buf.length; ++i)
                buf[i] = Math.floor(Math.random() * 255);
        }
    }

    function httpRequestCoreAsync(options: Util.HttpRequestOptions) {
        return new Promise<Util.HttpResponse>((resolve, reject) => {
            let client: XMLHttpRequest;
            let resolved = false

            let headers = Util.clone(options.headers) || {}

            client = new XMLHttpRequest();

            client.onreadystatechange = () => {
                if (resolved) return // Safari/iOS likes to call this thing more than once

                if (client.readyState == 4) {
                    resolved = true
                    let res: Util.HttpResponse = {
                        statusCode: client.status,
                        headers: {},
                        buffer: client.responseBody,
                        text: client.responseText,
                    }
                    client.getAllResponseHeaders().split(/\r?\n/).forEach(l => {
                        let m = /^\s*([^:]+): (.*)/.exec(l)
                        if (m) res.headers[m[1].toLowerCase()] = m[2]
                    })
                    resolve(res)
                }
            }

            let data = options.data
            let method = options.method || (data == null ? "GET" : "POST");

            let buf: any;

            if (data == null) {
                buf = null
            } else if (data instanceof Uint8Array) {
                buf = data
            } else if (typeof data == "object") {
                buf = JSON.stringify(data)
                headers["content-type"] = "application/json; charset=utf8"
            } else if (typeof data == "string") {
                buf = data
            } else {
                Util.oops("bad data")
            }

            client.open(method, options.url);

            Object.keys(headers).forEach(k => {
                client.setRequestHeader(k, headers[k])
            })

            if (buf == null)
                client.send();
            else
                client.send(buf);
        })
    }

    let sha256_k = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ])

    function rotr(v: number, b: number) {
        return (v >>> b) | (v << (32 - b));
    }

    function sha256round(hs: Uint32Array, w: Uint32Array) {
        Util.assert(hs.length == 8);
        Util.assert(w.length == 64);

        for (let i = 16; i < 64; ++i) {
            let s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            let s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }

        let a = hs[0];
        let b = hs[1];
        let c = hs[2];
        let d = hs[3];
        let e = hs[4];
        let f = hs[5];
        let g = hs[6];
        let h = hs[7];

        for (let i = 0; i < 64; ++i) {
            let s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
            let ch = (e & f) ^ (~e & g)
            let temp1 = (h + s1 + ch + sha256_k[i] + w[i]) | 0
            let s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
            let maj = (a & b) ^ (a & c) ^ (b & c)
            let temp2 = (s0 + maj) | 0

            h = g
            g = f
            f = e
            e = (d + temp1) | 0
            d = c
            c = b
            b = a
            a = (temp1 + temp2) | 0
        }

        hs[0] += a
        hs[1] += b
        hs[2] += c
        hs[3] += d
        hs[4] += e
        hs[5] += f
        hs[6] += g
        hs[7] += h
    }

    export function sha256buffer(buf: Uint8Array) {
        let h = new Uint32Array(8);
        h[0] = 0x6a09e667
        h[1] = 0xbb67ae85
        h[2] = 0x3c6ef372
        h[3] = 0xa54ff53a
        h[4] = 0x510e527f
        h[5] = 0x9b05688c
        h[6] = 0x1f83d9ab
        h[7] = 0x5be0cd19

        let work = new Uint32Array(64);

        let chunkLen = 16 * 4;

        function addBuf(buf: Uint8Array) {
            let end = buf.length - (chunkLen - 1)
            for (let i = 0; i < end; i += chunkLen) {
                for (let j = 0; j < 16; j++) {
                    let off = (j << 2) + i
                    work[j] = (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]
                }
                sha256round(h, work)
            }
        }

        addBuf(buf)

        let padSize = 64 - (buf.length + 9) % 64
        if (padSize == 64) padSize = 0
        let endPos = buf.length - (buf.length % chunkLen)
        let padBuf = new Uint8Array((buf.length - endPos) + 1 + padSize + 8)
        let dst = 0
        while (endPos < buf.length) padBuf[dst++] = buf[endPos++]
        padBuf[dst++] = 0x80
        while (padSize-- > 0)
            padBuf[dst++] = 0x00
        let len = buf.length * 8
        dst = padBuf.length
        while (len > 0) {
            padBuf[--dst] = len & 0xff
            len >>= 8
        }

        addBuf(padBuf)

        let res = ""
        for (let i = 0; i < h.length; ++i)
            res += ("000000000" + h[i].toString(16)).slice(-8)

        return res.toLowerCase()
    }

    export function sha256string(s: string) {
        return sha256buffer(Util.stringToUint8Array(Util.toUTF8(s)))
    }
}

