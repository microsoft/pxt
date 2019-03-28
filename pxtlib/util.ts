/// <reference path="tickEvent.ts" />
/// <reference path="apptarget.ts"/>
/// <reference path="commonutil.ts"/>

namespace ts.pxtc {
    /**
     * atob replacement
     * @param s
     */
    export let decodeBase64 = function (s: string) { return atob(s); }
    /**
     * bota replacement
     * @param s
     */
    export let encodeBase64 = function (s: string) { return btoa(s); }
}

namespace ts.pxtc.Util {

    export class CancellationToken {
        private pending = false;
        private cancelled = false;
        private resolve: () => void;
        private deferred: Promise<void>;
        private progressHandler: (completed: number, total: number) => void;

        startOperation() {
            this.pending = true;
        }

        isRunning() {
            return this.pending;
        }

        onProgress(progressHandler: (completed: number, total: number) => void) {
            this.progressHandler = progressHandler;
        }

        reportProgress(completed: number, total: number) {
            if (this.progressHandler) {
                this.progressHandler(completed, total);
            }
        }

        cancel() {
            this.cancelled = true;
            this.pending = false;
        }

        cancelAsync() {
            if (this.cancelled || !this.pending) {
                this.cancelled = true;
                this.pending = false;
                return Promise.resolve();
            }
            this.cancelled = true;
            this.deferred = new Promise(resolve => {
                this.resolve = resolve;
            });

            return this.deferred;
        }

        isCancelled() {
            return this.cancelled;
        }

        throwIfCancelled() {
            if (this.isCancelled()) throw new Error();
        }

        resolveCancel() {
            this.pending = false;
            if (this.deferred) {
                this.resolve();
                this.deferred = undefined;
                this.resolve = undefined;
            }
        }
    }

    export function codalHash16(s: string): number {
        // same hashing as https://github.com/lancaster-university/codal-core/blob/c1fe7a4c619683a50d47cb0c19d15b8ff3bd16a1/source/drivers/PearsonHash.cpp#L26
        const hashTable = [
            251, 175, 119, 215, 81, 14, 79, 191, 103, 49, 181, 143, 186, 157, 0,
            232, 31, 32, 55, 60, 152, 58, 17, 237, 174, 70, 160, 144, 220, 90, 57,
            223, 59, 3, 18, 140, 111, 166, 203, 196, 134, 243, 124, 95, 222, 179,
            197, 65, 180, 48, 36, 15, 107, 46, 233, 130, 165, 30, 123, 161, 209, 23,
            97, 16, 40, 91, 219, 61, 100, 10, 210, 109, 250, 127, 22, 138, 29, 108,
            244, 67, 207, 9, 178, 204, 74, 98, 126, 249, 167, 116, 34, 77, 193,
            200, 121, 5, 20, 113, 71, 35, 128, 13, 182, 94, 25, 226, 227, 199, 75,
            27, 41, 245, 230, 224, 43, 225, 177, 26, 155, 150, 212, 142, 218, 115,
            241, 73, 88, 105, 39, 114, 62, 255, 192, 201, 145, 214, 168, 158, 221,
            148, 154, 122, 12, 84, 82, 163, 44, 139, 228, 236, 205, 242, 217, 11,
            187, 146, 159, 64, 86, 239, 195, 42, 106, 198, 118, 112, 184, 172, 87,
            2, 173, 117, 176, 229, 247, 253, 137, 185, 99, 164, 102, 147, 45, 66,
            231, 52, 141, 211, 194, 206, 246, 238, 56, 110, 78, 248, 63, 240, 189,
            93, 92, 51, 53, 183, 19, 171, 72, 50, 33, 104, 101, 69, 8, 252, 83, 120,
            76, 135, 85, 54, 202, 125, 188, 213, 96, 235, 136, 208, 162, 129, 190,
            132, 156, 38, 47, 1, 7, 254, 24, 4, 216, 131, 89, 21, 28, 133, 37, 153,
            149, 80, 170, 68, 6, 169, 234, 151
        ]

        // REF: https://en.wikipedia.org/wiki/Pearson_hashing
        function eightBitHash(s: Uint8Array): number {
            let hash = 0;
            for (let i = 0; i < s.length; i++) {
                let c = s[i];
                hash = hashTable[hash ^ c];
            }
            return hash;
        }
        function hashN(s: string, byteCount: number): number {
            // this hash is used by enum.isHash. So any modification should be considered a breaking change.
            let hash;
            const buffer = new Uint8Array(s.length); // TODO unicode
            for (let i = 0; i < s.length; ++i) {
                const c = s.charCodeAt(i);
                buffer[i] = c & 0xff;
            }
            let res = 0;
            for (let i = 0; i < byteCount; ++i) {
                hash = eightBitHash(buffer);
                res |= hash << (8 * i);
                buffer[0] = (buffer[0] + 1) % 255;
            }
            return res;
        }


        if (!s) return 0;
        return hashN(s, 2);
    }

    export function bufferSerial(buffers: pxt.Map<string>, data: string = "", source: string = "?", maxBufLen: number = 255) {
        for (let i = 0; i < data.length; ++i) {
            const char = data[i]
            buffers[source] = (buffers[source] || "") + char;
            if (char === "\n" || buffers[source].length > maxBufLen) {
                let buffer = buffers[source]
                buffers[source] = ""
                window.postMessage({
                    type: "serial",
                    id: source,
                    data: buffer
                }, "*")
            }
        }
    }

    export function blobReadAsDataURL(blob: Blob): Promise<string> {
        if (!blob) return Promise.resolve(undefined);

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(<string>reader.result);
            reader.onerror = e => reject(e);
            reader.readAsDataURL(blob);
        });
    }

    export function fileReadAsBufferAsync(f: File): Promise<Uint8Array> { // ArrayBuffer
        if (!f)
            return Promise.resolve<Uint8Array>(null);
        else {
            return new Promise<Uint8Array>((resolve, reject) => {
                let reader = new FileReader();
                reader.onerror = (ev) => resolve(null);
                reader.onload = (ev) => resolve(new Uint8Array(reader.result as ArrayBuffer));
                reader.readAsArrayBuffer(f);
            });
        }
    }

    export function fileReadAsTextAsync(f: File): Promise<string> {
        if (!f)
            return Promise.resolve<string>(null);
        else {
            return new Promise<string>((resolve, reject) => {
                let reader = new FileReader();
                reader.onerror = (ev) => resolve(null);
                reader.onload = (ev) => resolve(reader.result);
                reader.readAsText(f);
            });
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

    export function memcpy(trg: Uint8Array, trgOff: number, src: ArrayLike<number>, srcOff?: number, len?: number) {
        if (srcOff === void 0)
            srcOff = 0
        if (len === void 0)
            len = src.length - srcOff
        for (let i = 0; i < len; ++i)
            trg[trgOff + i] = src[srcOff + i]
    }

    export function uint8ArrayConcat(chunks: Uint8Array[]) {
        let numbytes = 0
        for (let c of chunks) numbytes += c.length
        let r = new Uint8Array(numbytes)
        let ptr = 0
        for (let c of chunks) {
            memcpy(r, ptr, c)
            ptr += c.length
        }
        return r
    }

    export function jsonTryParse(s: string): any {
        try {
            return JSON.parse(s);
        } catch (e) {
            return undefined;
        }
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

    export function contains(str: string, contains: string) {
        if (str.length < contains.length) return false
        if (contains.length == 0) return true
        return str.indexOf(contains) > -1
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

    export function toArray<T>(a: ArrayLike<T> | ReadonlyArray<T>): T[] {
        if (Array.isArray(a)) {
            return a;
        }
        let r: T[] = []
        if (!a) return r;
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
    export function debounce(func: (...args: any[]) => any, wait: number, immediate?: boolean): any {
        let timeout: any;
        return function (this: any) {
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

    // Returns a function, that, as long as it continues to be invoked, will only
    // trigger every N milliseconds. If `immediate` is passed, trigger the
    // function on the leading edge, instead of the trailing.
    export function throttle(func: (...args: any[]) => any, wait: number, immediate?: boolean): any {
        let timeout: any;
        return function (this: any) {
            let context = this;
            let args = arguments;
            let later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            let callNow = immediate && !timeout;
            if (!timeout) timeout = setTimeout(later, wait);
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

    export function unicodeToChar(text: string) {
        let r = /\\u([\d\w]{4})/gi;
        return text.replace(r, function (match, grp) {
            return String.fromCharCode(parseInt(grp, 16));
        });
    }

    export function escapeForRegex(str: string) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    export function stripUrlProtocol(str: string) {
        return str.replace(/.*?:\/\//g, "");
    }

    export function normalizePath(path: string) {
        if (path) {
            path = path.replace(/\\/g, "/")
        }

        return path;
    }

    export function pathJoin(a: string, b: string) {
        normalizePath(a);
        normalizePath(b);

        if (!a && !b) return undefined;
        else if (!a) return b;
        else if (!b) return a;

        if (a.charAt(a.length - 1) !== "/") {
            a += "/";
        }

        if (b.charAt(0) == "/") {
            b = b.substring(1);
        }

        return a + b;
    }

    // Reliable NodeJS detection is not possible, but the following check should be accurate enough for our needs
    export let isNodeJS = typeof window === "undefined";

    export interface HttpRequestOptions {
        url: string;
        method?: string; // default to GET
        data?: any;
        headers?: pxt.Map<string>;
        allowHttpErrors?: boolean; // don't treat non-200 responses as errors
        allowGzipPost?: boolean;
        responseArrayBuffer?: boolean;
        forceLiveEndpoint?: boolean;
    }

    export interface HttpResponse {
        statusCode: number;
        headers: pxt.Map<string | string[]>;
        buffer?: any;
        text?: string;
        json?: any;
    }

    export function requestAsync(options: HttpRequestOptions): Promise<HttpResponse> {
        return httpRequestCoreAsync(options)
            .then(resp => {
                if ((resp.statusCode != 200 && resp.statusCode != 304) && !options.allowHttpErrors) {
                    let msg = Util.lf("Bad HTTP status code: {0} at {1}; message: {2}",
                        resp.statusCode, options.url, (resp.text || "").slice(0, 500))
                    let err: any = new Error(msg)
                    err.statusCode = resp.statusCode
                    return Promise.reject(err)
                }
                if (resp.text && /application\/json/.test(resp.headers["content-type"] as string))
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

    // this will take lower 8 bits from each character
    export function stringToUint8Array(input: string) {
        let len = input.length;
        let res = new Uint8Array(len)
        for (let i = 0; i < len; ++i)
            res[i] = input.charCodeAt(i) & 0xff;
        return res;
    }

    export function uint8ArrayToString(input: ArrayLike<number>) {
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

    export function toUTF8(str: string, cesu8?: boolean) {
        let res = "";
        if (!str) return res;
        for (let i = 0; i < str.length; ++i) {
            let code = str.charCodeAt(i);
            if (code <= 0x7f) res += str.charAt(i);
            else if (code <= 0x7ff) {
                res += String.fromCharCode(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            } else {
                if (!cesu8 && 0xd800 <= code && code <= 0xdbff) {
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

    export function toHex(bytes: ArrayLike<number>) {
        let r = ""
        for (let i = 0; i < bytes.length; ++i)
            r += ("0" + bytes[i].toString(16)).slice(-2)
        return r
    }

    export function fromHex(hex: string) {
        let r = new Uint8Array(hex.length >> 1)
        for (let i = 0; i < hex.length; i += 2)
            r[i >> 1] = parseInt(hex.slice(i, i + 2), 16)
        return r
    }

    export class PromiseQueue {
        promises: pxt.Map<(() => Promise<any>)[]> = {};

        enqueue<T>(id: string, f: () => Promise<T>): Promise<T> {
            return new Promise<T>((resolve, reject) => {
                let arr = this.promises[id]
                if (!arr) {
                    arr = this.promises[id] = []
                }
                arr.push(() =>
                    f()
                        .finally(() => {
                            arr.shift()
                            if (arr.length == 0)
                                delete this.promises[id]
                            else
                                arr[0]()
                        })
                        .then(resolve, reject))
                if (arr.length == 1)
                    arr[0]()
            })
        }
    }

    export class PromiseBuffer<T> {
        private waiting: ((v: (T | Error)) => void)[] = [];
        private available: (T | Error)[] = [];

        drain() {
            for (let f of this.waiting) {
                f(new Error("Promise Buffer Reset"))
            }
            this.waiting = []
            this.available = []
        }


        pushError(v: Error) {
            this.push(v as any)
        }

        push(v: T) {
            let f = this.waiting.shift()
            if (f) f(v)
            else this.available.push(v)
        }

        shiftAsync(timeout = 0) {
            if (this.available.length > 0) {
                let v = this.available.shift()
                if (v instanceof Error)
                    return Promise.reject<T>(v)
                else
                    return Promise.resolve<T>(v)
            } else
                return new Promise<T>((resolve, reject) => {
                    let f = (v: (T | Error)) => {
                        if (v instanceof Error) reject(v)
                        else resolve(v)
                    }
                    this.waiting.push(f)
                    if (timeout > 0) {
                        Promise.delay(timeout)
                            .then(() => {
                                let idx = this.waiting.indexOf(f)
                                if (idx >= 0) {
                                    this.waiting.splice(idx, 1)
                                    reject(new Error("Timeout"))
                                }
                            })
                    }
                })
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
                case "m4a": return "audio/m4a";
                case "mp3": return "audio/mp3";
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

    export function downloadLiveTranslationsAsync(lang: string, filename: string, branch?: string, etag?: string): Promise<pxt.Map<string>> {
        // hitting the cloud
        function downloadFromCloudAsync(strings?: pxt.Map<string>) {
            pxt.debug(`downloading translations for ${lang} ${filename} ${branch || ""}`);
            // https://pxt.io/api/translations?filename=strings.json&lang=pl&approved=true&branch=v0
            let url = `${pxt.BrowserUtils.isLocalHost() || pxt.webConfig.isStatic ? "https://makecode.com" : ""}/api/translations?lang=${encodeURIComponent(lang)}&filename=${encodeURIComponent(filename)}&approved=true`;
            if (branch) url += '&branch=' + encodeURIComponent(branch);
            const headers: pxt.Map<string> = {};
            if (etag) headers["If-None-Match"] = etag;
            return requestAsync({ url, headers }).then(resp => {
                // if 304, translation not changed, skipe
                if (resp.statusCode == 304 || resp.statusCode == 200) {
                    // store etag and translations
                    etag = resp.headers["etag"] as string || "";
                    return pxt.BrowserUtils.translationDbAsync()
                        .then(db => db.setAsync(lang, filename, branch, etag, resp.json || strings))
                        .then(() => resp.json || strings);
                }

                return resp.json;
            }, e => {
                console.log(`failed to load translations from ${url}`)
                return undefined;
            })
        }

        // check for cache
        return pxt.BrowserUtils.translationDbAsync()
            .then(db => db.getAsync(lang, filename, branch))
            .then((entry: pxt.BrowserUtils.ITranslationDbEntry) => {
                // if cached, return immediately
                if (entry) {
                    etag = entry.etag;
                    // update expired entries
                    const dt = (Date.now() - entry.time) / 1000;
                    if (dt > 300) // 5min caching time before trying etag again
                        downloadFromCloudAsync(entry.strings).done();
                    return entry.strings;
                } else
                    return downloadFromCloudAsync();
            })

    }

    export function normalizeLanguageCode(code: string): string[] {
        const langParts = /^(\w{2})-(\w{2}$)/i.exec(code);
        if (langParts && langParts[1] && langParts[2]) {
            return [`${langParts[1].toLowerCase()}-${langParts[2].toUpperCase()}`, langParts[1].toLowerCase()];
        } else {
            return [code.toLowerCase()];
        }
    }

    export function isLocaleEnabled(code: string): boolean {
        let [lang, baseLang] = normalizeLanguageCode(code);
        let appTheme = pxt.appTarget.appTheme;
        if (appTheme && appTheme.availableLocales) {
            if (appTheme.availableLocales.indexOf(lang) > -1) {
                return true;
            }
            //check for base language if we didn't find the full language. Example: nl for nl-NL
            if (baseLang && appTheme.availableLocales.indexOf(baseLang) > -1) {
                return true;
            }
        }
        return false;
    }

    export function updateLocalizationAsync(targetId: string, baseUrl: string, code: string, pxtBranch: string, targetBranch: string, live?: boolean, force?: boolean): Promise<void> {
        code = normalizeLanguageCode(code)[0];
        if (code === userLanguage() || (!isLocaleEnabled(code) && !force))
            return Promise.resolve();

        return downloadTranslationsAsync(targetId, baseUrl, code, pxtBranch, targetBranch, live)
            .then((translations) => {
                if (translations) {
                    setUserLanguage(code);
                    setLocalizedStrings(translations);
                    if (live) {
                        localizeLive = true;
                    }
                }
                return Promise.resolve();
            });
    }

    export function downloadSimulatorLocalizationAsync(targetId: string, baseUrl: string, code: string, pxtBranch: string, targetBranch: string, live?: boolean, force?: boolean): Promise<pxt.Map<string>> {
        code = normalizeLanguageCode(code)[0];
        if (code === userLanguage() || (!isLocaleEnabled(code) && !force))
            return Promise.resolve<pxt.Map<string>>(undefined);

        return downloadTranslationsAsync(targetId, baseUrl, code, pxtBranch, targetBranch, live)
    }

    export function downloadTranslationsAsync(targetId: string, baseUrl: string, code: string, pxtBranch: string, targetBranch: string, live?: boolean): Promise<pxt.Map<string>> {
        code = normalizeLanguageCode(code)[0];
        let translationsCacheId = `${code}/${live}`;
        if (translationsCache()[translationsCacheId]) {
            return Promise.resolve(translationsCache()[translationsCacheId]);
        }

        const stringFiles: { branch: string, path: string }[] = [
            { branch: pxtBranch, path: "strings.json" },
            { branch: targetBranch, path: targetId + "/target-strings.json" },
            { branch: targetBranch, path: targetId + "/sim-strings.json" }
        ];
        let translations: pxt.Map<string>;

        function mergeTranslations(tr: pxt.Map<string>) {
            if (!tr) return;
            if (!translations) {
                translations = {};
            }
            Object.keys(tr)
                .filter(k => !!tr[k])
                .forEach(k => translations[k] = tr[k])
        }

        if (live) {
            let errorCount = 0;

            const pAll = Promise.mapSeries(stringFiles, (file) => downloadLiveTranslationsAsync(code, file.path, file.branch)
                .then(mergeTranslations, e => {
                    console.log(e.message);
                    ++errorCount;
                })
            );

            return pAll.then(() => {
                // Cache translations unless there was an error for one of the files
                if (errorCount) {
                    translationsCache()[translationsCacheId] = translations;
                }

                if (errorCount === stringFiles.length || !translations) {
                    // Retry with non-live translations by setting live to false
                    pxt.tickEvent("translations.livetranslationsfailed");
                    return downloadTranslationsAsync(targetId, baseUrl, code, pxtBranch, targetBranch, false);
                }

                return Promise.resolve(translations);
            });
        } else {
            return Util.httpGetJsonAsync(baseUrl + "locales/" + code + "/strings.json")
                .then(tr => {
                    if (tr) {
                        translations = tr;
                        translationsCache()[translationsCacheId] = translations;
                    }
                }, e => {
                    console.error('failed to load localizations')
                })
                .then(() => translations);
        }
    }

    export let httpRequestCoreAsync: (options: HttpRequestOptions) => Promise<HttpResponse>;
    export let sha256: (hashData: string) => string;
    export let getRandomBuf: (buf: Uint8Array) => void;

    export function capitalize(n: string): string {
        return n ? (n[0].toLocaleUpperCase() + n.slice(1)) : n;
    }

    export function uncapitalize(n: string): string {
        return (n || "").split(/(?=[A-Z])/g).join(" ").toLowerCase();
    }

    export function range(len: number) {
        let r: number[] = []
        for (let i = 0; i < len; ++i) r.push(i)
        return r
    }

    export function multipartPostAsync(uri: string, data: any = {}, filename: string = null, filecontents: string = null): Promise<HttpResponse> {
        const boundary = "--------------------------0461489f461126c5"
        let form = ""

        function add(name: string, val: string) {
            form += boundary + "\r\n"
            form += "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"
            form += val + "\r\n"
        }

        function addF(name: string, val: string) {
            const fn = name.split('/').reverse()[0];
            form += boundary + "\r\n"
            form += "Content-Disposition: form-data; name=\"files[" + name + "]\"; filename=\"" + fn + "\"\r\n"
            form += "\r\n"
            form += val + "\r\n"
        }

        Object.keys(data).forEach(k => add(k, data[k]))
        if (filename)
            addF(filename, filecontents)

        form += boundary + "--\r\n"

        const req: HttpRequestOptions = {
            url: uri,
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data; boundary=" + boundary.slice(2)
            },
            data: form
        };
        return Util.httpRequestCoreAsync(req);
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
        else return `data:${mimetype || "image/png"};base64,${encodeBase64(toUTF8(data))}`;
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
            if (options.responseArrayBuffer)
                client.responseType = "arraybuffer";
            client.onreadystatechange = () => {
                if (resolved) return // Safari/iOS likes to call this thing more than once

                if (client.readyState == 4) {
                    resolved = true
                    let res: Util.HttpResponse = {
                        statusCode: client.status,
                        headers: {},
                        buffer: (client as any).responseBody || client.response,
                        text: options.responseArrayBuffer ? undefined : client.responseText,
                    }
                    const allHeaders = client.getAllResponseHeaders();
                    allHeaders.split(/\r?\n/).forEach(l => {
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

    const sha256_k = new Uint32Array([
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