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
                reader.onload = (ev) => resolve(reader.result as string);
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

    export function arrayEquals<U>(a: U[], b: U[], compare: (c: U, d: U) => boolean = (c, d) => c === d) {
        if (a == b) return true;
        if (!a && b || !b && a || a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) {
            if (!compare(a[i], b[i])) return false;
        }
        return true;
    }

    export function iterMap<T>(m: pxt.Map<T>, f: (k: string, v: T) => void) {
        Object.keys(m).forEach(k => f(k, m[k]))
    }

    export function mapMap<T, S>(m: pxt.Map<T>, f: (k: string, v: T) => S) {
        let r: pxt.Map<S> = {}
        Object.keys(m).forEach(k => r[k] = f(k, m[k]))
        return r
    }

    export function values<T>(m: pxt.Map<T>) {
        return Object.keys(m || {}).map(k => m[k])
    }

    export function pushRange<T>(trg: T[], src: ArrayLike<T>): void {
        if (src)
            for (let i = 0; i < src.length; ++i)
                trg.push(src[i])
    }

    // TS gets lost in type inference when this is passed an array
    export function concatArrayLike<T>(arrays: ArrayLike<ArrayLike<T>>): T[] {
        return concat(arrays as any)
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

    export function snakify(s: string) {
        const up = s.toUpperCase()
        const lo = s.toLowerCase()

        // if the name is all lowercase or all upper case don't do anything
        if (s == up || s == lo)
            return s

        // if the name already has underscores (not as first character), leave it alone
        if (s.lastIndexOf("_") > 0)
            return s

        const isUpper = (i: number) => s[i] != lo[i]
        const isLower = (i: number) => s[i] != up[i]
        //const isDigit = (i: number) => /\d/.test(s[i])

        let r = ""
        let i = 0
        while (i < s.length) {
            let upperMode = isUpper(i)
            let j = i
            while (j < s.length) {
                if (upperMode && isLower(j)) {
                    // ABCd -> AB_Cd
                    if (j - i > 2) {
                        j--
                        break
                    } else {
                        // ABdefQ -> ABdef_Q
                        upperMode = false
                    }
                }
                // abcdE -> abcd_E
                if (!upperMode && isUpper(j)) {
                    break
                }
                j++
            }
            if (r) r += "_"
            r += s.slice(i, j)
            i = j
        }

        // If the name is is all caps (like a constant), preserve it
        if (r.toUpperCase() === r) {
            return r;
        }
        return r.toLowerCase();
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

    export function toSet<T>(arr: T[], f: (t: T) => string): pxt.Map<boolean> {
        let r: pxt.Map<boolean> = {}
        arr.forEach(e => { r[f(e)] = true })
        return r
    }

    export function deepCopy(src: any) {
        if (typeof src !== "object" || src === null) {
            return src;
        }

        const dst = Array.isArray(src) ? [] : {} as any;

        for (const key in src) {
            const value = src[key];
            dst[key] = deepCopy(value);
        }

        return dst;
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

    const _nextTickResolvedPromise = Promise.resolve();
    export function nextTick(f: () => void) {
        // .then should run as a microtask / at end of loop
        _nextTickResolvedPromise.then(f);
    }

    export async function delay<T>(duration: number, value: T | Promise<T>): Promise<T>;
    export async function delay(duration: number): Promise<void>
    export async function delay<T>(duration: number, value?: T | Promise<T>): Promise<T> {
        // eslint-disable-next-line
        const output = await value;
        await new Promise<void>(resolve => setTimeout(() => resolve(), duration));
        return output;
    }

    export function promiseMapAll<T, V>(values: T[], mapper: (obj: T) => Promise<V>): Promise<V[]> {
        return Promise.all(values.map(v => mapper(v)));
    }

    export function promiseMapAllSeries<T, V>(values: T[], mapper: (obj: T) => Promise<V>): Promise<V[]> {
        return promisePoolAsync(1, values, mapper);
    }

    export async function promisePoolAsync<T, V>(maxConcurrent: number, inputValues: T[], handler: (input: T) => Promise<V>): Promise<V[]> {
        let curr = 0;
        const promises = [];
        const output: V[] = [];

        for (let i = 0; i < maxConcurrent; i++) {
            const thread = (async () => {
                while (curr < inputValues.length) {
                    const id = curr++;
                    const input = inputValues[id];
                    output[id] = await handler(input);
                }
            })();

            promises.push(thread);
        }

        try {
            await Promise.all(promises);
        } catch (e) {
            // do not spawn any more promises after pool failed.
            curr = inputValues.length;
            throw e;
        }

        return output;
    }

    export function memoizeString<T>(createNew: (id: string) => T): (id: string) => T {
        return memoize(s => s, createNew)
    }

    export async function promiseTimeout<T>(ms: number, promise: T | Promise<T>, msg?: string): Promise<T> {
        let timeoutId: number;
        let res: (v?: T | PromiseLike<T>) => void;

        const timeoutPromise: Promise<T> = new Promise((resolve, reject) => {
            res = resolve;
            timeoutId = setTimeout(() => {
                res = undefined;
                clearTimeout(timeoutId);
                reject(msg || `Promise timed out after ${ms}ms`);
            }, ms);
        });

        return Promise.race([ promise, timeoutPromise ])
            .then(output => {
                // clear any dangling timeout
                if (res) {
                    clearTimeout(timeoutId);
                    res();
                }
                return <T>output;
            });
    }

    export interface DeferredPromise<T> {
        resolve: (value: T) => void;
        reject: (reason: any) => void;
        promise: Promise<T>;
    }

    export function defer<T>(): DeferredPromise<T> {
        let result: T | Promise<T>;
        let resolve: (value?: unknown) => void;
        let reject: (reason?: any) => void;
        let isResolved = false;

        return {
            resolve: function (value: T) {
                if (isResolved) {
                    pxt.debug("Deferred promise already resolved");
                    return;
                }

                if (resolve) {
                    resolve(value);
                } else {
                    result = result || new Promise(function (r) { r(value); });
                }

                isResolved = true;
            },

            reject: function (reason: any) {
                if (isResolved) {
                    pxt.debug("Deferred promise already resolved");
                    return;
                }

                if (reject) {
                    reject(reason);
                } else {
                    result = result || new Promise(function (_, j) { j(reason); });
                }

                isResolved = true;
            },

            promise: new Promise<T>(function (r, j) {
                if (result) {
                    r(result);
                } else {
                    resolve = r;
                    reject = j;
                }
            })
        };
    };

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
            return timeout;
        };
    }

    export class AdaptiveDebouncer {
        private lastPoke = 0
        private recentGaps: number[] = []
        private timeout: any
        private wrapped: () => void

        constructor(
            public func: () => void,
            public minDelay = 300,
            public maxDelay = 2000,
            public slowdownFactor = 2
        ) {
            this.wrapped = () => {
                this.timeout = null
                this.func()
            }
        }

        poke() {
            const now = Date.now()
            if (this.lastPoke) {
                const gap = now - this.lastPoke
                if (gap < 10)
                    return // ignore triggers is quick succession
                if (gap < 4000)
                    this.recentGaps.push(gap)
                while (this.recentGaps.length > 10)
                    this.recentGaps.shift()
            }
            this.lastPoke = now
        }

        trigger() {
            let delay = this.maxDelay
            if (this.lastPoke) {
                const gaps = this.recentGaps.slice()
                gaps.sort()
                const median = gaps[gaps.length >> 1] || 1
                delay = Math.min(Math.max((median * this.slowdownFactor) | 0, this.minDelay), this.maxDelay)
                const gap = Date.now() - this.lastPoke
                delay -= gap
                if (delay < 0) delay = 0
                this.lastPoke = null
            }
            clearTimeout(this.timeout)
            this.timeout = setTimeout(this.wrapped, delay)
        }
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
        return str?.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    export function stripUrlProtocol(str: string) {
        return str?.replace(/.*?:\/\//g, "");
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
        successCodes?: number[];
        withCredentials?: boolean;
    }

    export interface HttpResponse {
        statusCode: number;
        headers: pxt.Map<string | string[]>;
        buffer?: any;
        text?: string;
        json?: any;
    }

    // debug flag
    //export let debugHttpRequests = false;
    export function requestAsync(options: HttpRequestOptions): Promise<HttpResponse> {
        //if (debugHttpRequests)
        //    pxt.debug(`>> ${options.method || "GET"} ${options.url.replace(/[?#].*/, "...")}`); // don't leak secrets in logs
        return httpRequestCoreAsync(options)
            .then(resp => {
                //if (debugHttpRequests)
                //    pxt.debug(`  << ${resp.statusCode}`);
                const statusCode = resp.statusCode;
                const successCodes = options.successCodes || [304, 200, 201, 202];
                if (successCodes.indexOf(statusCode) < 0 && !options.allowHttpErrors) {
                    const msg = Util.lf("Bad HTTP status code: {0} at {1}; message: {2}",
                        resp.statusCode, options.url, (resp.text || "").slice(0, 500))
                    const err: any = new Error(msg)
                    err.statusCode = resp.statusCode
                    return Promise.reject(err)
                }
                if (resp.text && /application\/json/.test(resp.headers["content-type"] as string))
                    resp.json = U.jsonTryParse(resp.text)
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
                        U.delay(timeout)
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

    export function timeout(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(() => resolve(), ms))
    }

    // node.js overrides this to use process.cpuUsage()
    export let cpuUs = (): number => {
        // current time in microseconds
        const perf = typeof performance != "undefined" ?
            performance.now.bind(performance) ||
            (performance as any).moznow.bind(performance) ||
            (performance as any).msNow.bind(performance) ||
            (performance as any).webkitNow.bind(performance) ||
            (performance as any).oNow.bind(performance) :
            Date.now;
        cpuUs = () => perf() * 1000;
        return cpuUs();
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
            let host = pxt.BrowserUtils.isLocalHost() || pxt.webConfig.isStatic ? "https://makecode.com/api/" : ""
            // https://pxt.io/api/translations?filename=strings.json&lang=pl&approved=true&branch=v0
            let url = `${host}translations?lang=${encodeURIComponent(lang)}&filename=${encodeURIComponent(filename)}&approved=true`;
            if (branch) url += '&branch=' + encodeURIComponent(branch);
            const headers: pxt.Map<string> = {};
            if (etag && !pxt.Cloud.useCdnApi()) headers["If-None-Match"] = etag;
            return (host ? requestAsync : pxt.Cloud.apiRequestWithCdnAsync)({ url, headers }).then(resp => {
                // if 304, translation not changed, skip
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
                        downloadFromCloudAsync(entry.strings);
                    return entry.strings;
                } else
                    return downloadFromCloudAsync();
            })

    }

    export const pxtLangCookieId = "PXT_LANG";
    export const langCookieExpirationDays = 30;

    export interface Language {
        englishName: string;
        localizedName: string;
    }

    // "lang-code": { englishName: "", localizedName: ""},
    // Crowdin code: https://support.crowdin.com/api/language-codes/
    // English name and localized name: https://en.wikipedia.org/wiki/List_of_language_names
    export const allLanguages: pxt.Map<Language> = {
        "af": { englishName: "Afrikaans", localizedName: "Afrikaans" },
        "ar": { englishName: "Arabic", localizedName: "العربية" },
        "az": { englishName: "Azerbaijani", localizedName: "آذربایجان دیلی" },
        "bg": { englishName: "Bulgarian", localizedName: "български" },
        "bn": { englishName: "Bengali", localizedName: "বাংলা" },
        "ca": { englishName: "Catalan", localizedName: "Català" },
        "cs": { englishName: "Czech", localizedName: "Čeština" },
        "cy": { englishName: "Welsh", localizedName: "Cymraeg" },
        "da": { englishName: "Danish", localizedName: "Dansk" },
        "de": { englishName: "German", localizedName: "Deutsch" },
        "el": { englishName: "Greek", localizedName: "Ελληνικά" },
        "en": { englishName: "English", localizedName: "English" },
        "es-ES": { englishName: "Spanish (Spain)", localizedName: "Español (España)" },
        "es-MX": { englishName: "Spanish (Mexico)", localizedName: "Español (México)" },
        "et": { englishName: "Estonian", localizedName: "Eesti" },
        "eu": { englishName: "Basque", localizedName: "Euskara" },
        "fa": { englishName: "Persian", localizedName: "فارسی" },
        "fi": { englishName: "Finnish", localizedName: "Suomi" },
        "fr": { englishName: "French", localizedName: "Français" },
        "fr-CA": { englishName: "French (Canada)", localizedName: "Français (Canada)" },
        "gu-IN": { englishName: "Gujarati", localizedName: "ગુજરાતી" },
        "he": { englishName: "Hebrew", localizedName: "עברית" },
        "hr": { englishName: "Croatian", localizedName: "Hrvatski" },
        "hu": { englishName: "Hungarian", localizedName: "Magyar" },
        "hy-AM": { englishName: "Armenian (Armenia)", localizedName: "Հայերէն (Հայաստան)" },
        "id": { englishName: "Indonesian", localizedName: "Bahasa Indonesia" },
        "is": { englishName: "Icelandic", localizedName: "Íslenska" },
        "it": { englishName: "Italian", localizedName: "Italiano" },
        "ja": { englishName: "Japanese", localizedName: "日本語" },
        "kab": { englishName: "Kabyle", localizedName: "شئعم" },
        "ko": { englishName: "Korean", localizedName: "한국어" },
        "kmr": { englishName: "Kurmanji (Kurdish)", localizedName: "کورمانجی‎" },
        "kn": { englishName: "Kannada", localizedName: "ಕನ್ನಡ" },
        "lt": { englishName: "Lithuanian", localizedName: "Lietuvių" },
        "lv": { englishName: "Latvian", localizedName: "Latviešu" },
        "ml-IN": { englishName: "Malayalam", localizedName: "മലയാളം" },
        "mr": { englishName: "Marathi", localizedName: "मराठी" },
        "nl": { englishName: "Dutch", localizedName: "Nederlands" },
        "no": { englishName: "Norwegian", localizedName: "Norsk" },
        "nb": { englishName: "Norwegian Bokmal", localizedName: "Norsk bokmål" },
        "nn-NO": { englishName: "Norwegian Nynorsk", localizedName: "Norsk nynorsk" },
        "pa-IN": { englishName: "Punjabi", localizedName: "ਪੰਜਾਬੀ" },
        "pl": { englishName: "Polish", localizedName: "Polski" },
        "pt-BR": { englishName: "Portuguese (Brazil)", localizedName: "Português (Brasil)" },
        "pt-PT": { englishName: "Portuguese (Portugal)", localizedName: "Português (Portugal)" },
        "ro": { englishName: "Romanian", localizedName: "Română" },
        "ru": { englishName: "Russian", localizedName: "Русский" },
        "si-LK": { englishName: "Sinhala", localizedName: "සිංහල" },
        "sk": { englishName: "Slovak", localizedName: "Slovenčina" },
        "sl": { englishName: "Slovenian", localizedName: "Slovenski" },
        "sr": { englishName: "Serbian (Latin)", localizedName: "Srpski" },
        "su": { englishName: "Sundanese", localizedName: "ᮘᮞ ᮞᮥᮔ᮪ᮓ" },
        "sv-SE": { englishName: "Swedish", localizedName: "Svenska" },
        "ta": { englishName: "Tamil", localizedName: "தமிழ்" },
        "te": { englishName: "Telugu", localizedName: "తెలుగు" },
        "th": { englishName: "Thai", localizedName: "ภาษาไทย" },
        "tl": { englishName: "Tagalog", localizedName: "ᜏᜒᜃᜅ᜔ ᜆᜄᜎᜓᜄ᜔" },
        "tr": { englishName: "Turkish", localizedName: "Türkçe" },
        "uk": { englishName: "Ukrainian", localizedName: "Українська" },
        "ur-IN": { englishName: "Urdu (India)", localizedName: "اردو (ہندوستان)" },
        "ur-PK": { englishName: "Urdu (Pakistan)", localizedName: "اردو (پاکستان)" },
        "vi": { englishName: "Vietnamese", localizedName: "Tiếng việt" },
        "zh-CN": { englishName: "Chinese (Simplified)", localizedName: "中文(简体)" },
        "zh-TW": { englishName: "Chinese (Traditional)", localizedName: "中文(繁體)" },
    };

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

    interface LocalizationUpdateOptions {
        targetId: string;
        baseUrl: string;
        code: string;
        pxtBranch: string;
        targetBranch: string;
        force?: boolean;
    }

    export function updateLocalizationAsync(opts: LocalizationUpdateOptions): Promise<void> {
        const {
            targetId,
            baseUrl,
            pxtBranch,
            targetBranch,
            force,
        } = opts;
        let { code } = opts;
        code = normalizeLanguageCode(code)[0];
        if (code === "en-US")
            code = "en"; // special case for built-in language
        if (code === userLanguage() || (!isLocaleEnabled(code) && !force)) {
            pxt.debug(`loc: ${code} (using built-in)`)
            return Promise.resolve();
        }

        pxt.debug(`loc: ${code}`);

        const liveUpdateStrings = pxt.Util.liveLocalizationEnabled()
        return downloadTranslationsAsync(targetId, baseUrl, code,
            pxtBranch, targetBranch, liveUpdateStrings,
            ts.pxtc.Util.TranslationsKind.Editor)
            .then((translations) => {
                if (translations) {
                    setUserLanguage(code);
                    pxt.analytics?.addDefaultProperties({lang: code}); //set the new language in analytics.
                    setLocalizedStrings(translations);
                }

                // Download api translations
                return ts.pxtc.Util.downloadTranslationsAsync(
                    targetId, baseUrl, code,
                    pxtBranch, targetBranch, liveUpdateStrings,
                    ts.pxtc.Util.TranslationsKind.Apis)
                    .then(trs => {
                        if (trs)
                            ts.pxtc.apiLocalizationStrings = trs;
                    });
            });
    }

    export enum TranslationsKind {
        Editor,
        Sim,
        Apis,
        SkillMap
    }

    export function downloadTranslationsAsync(targetId: string, baseUrl: string, code: string, pxtBranch: string, targetBranch: string, live: boolean, translationKind?: TranslationsKind): Promise<pxt.Map<string>> {
        translationKind = translationKind || TranslationsKind.Editor;
        code = normalizeLanguageCode(code)[0];
        if (code === "en-US" || code === "en") // shortcut
            return Promise.resolve(undefined);

        let translationsCacheId = `${code}/${live}/${translationKind}`;
        if (translationsCache()[translationsCacheId]) {
            return Promise.resolve(translationsCache()[translationsCacheId]);
        }

        let stringFiles: { branch: string, staticName: string, path: string }[];
        switch (translationKind) {
            case TranslationsKind.Editor:
                stringFiles = [
                    { branch: pxtBranch, staticName: "strings.json", path: "strings.json" },
                    { branch: targetBranch, staticName: "target-strings.json", path: targetId + "/target-strings.json" },
                ];
                break;
            case TranslationsKind.Sim:
                stringFiles = [{ branch: targetBranch, staticName: "sim-strings.json", path: targetId + "/sim-strings.json" }];
                break;
            case TranslationsKind.Apis:
                stringFiles = [{ branch: targetBranch, staticName: "bundled-strings.json", path: targetId + "/bundled-strings.json" }];
                break;
            case TranslationsKind.SkillMap:
                stringFiles = [{ branch: targetBranch, staticName: "skillmap-strings.json", path: "/skillmap-strings.json" }];
                break;
        }
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

            const pAll = U.promiseMapAllSeries(stringFiles, (file) => downloadLiveTranslationsAsync(code, file.path, file.branch)
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
                    return downloadTranslationsAsync(targetId, baseUrl, code, pxtBranch, targetBranch, false, translationKind);
                }

                return Promise.resolve(translations);
            });
        } else {
            return Promise.all(stringFiles.map(p =>
                Util.httpGetJsonAsync(`${baseUrl}locales/${code}/${p.staticName}`)
                    .catch(e => undefined))
            ).then(resps => {
                let tr: pxt.Map<string> = {};
                resps.forEach(res => pxt.Util.jsonMergeFrom(tr, res));
                if (Object.keys(tr).length) {
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

    export const imageMagic = 0x59347a7d // randomly selected
    export const imageHeaderSize = 36 // has to be divisible by 9
    export function encodeBlobAsync(canvas: HTMLCanvasElement, blob: Uint8Array) {
        const neededBytes = imageHeaderSize + blob.length
        const usableBytes = (canvas.width * canvas.height - 1) * 3
        let bpp = 1
        while (bpp < 4) {
            if (usableBytes * bpp >= neededBytes * 8)
                break
            bpp++
        }
        let imgCapacity = (usableBytes * bpp) >> 3
        let missing = neededBytes - imgCapacity
        let addedLines = 0
        let addedOffset = canvas.width * canvas.height * 4
        if (missing > 0) {
            const bytesPerLine = canvas.width * 3
            addedLines = Math.ceil(missing / bytesPerLine)
            const c2 = document.createElement("canvas")
            c2.width = canvas.width
            c2.height = canvas.height + addedLines
            const ctx = c2.getContext("2d")
            ctx.drawImage(canvas, 0, 0)
            canvas = c2
        }

        let header = pxt.HF2.encodeU32LE([
            imageMagic,
            blob.length,
            addedLines,
            0,
            0,
            0,
            0,
            0,
            0,
        ])

        pxt.Util.assert(header.length == imageHeaderSize)

        function encode(img: Uint8ClampedArray, ptr: number, bpp: number, data: ArrayLike<number>) {
            let shift = 0
            let dp = 0
            let v = data[dp++]
            const bppMask = (1 << bpp) - 1
            let keepGoing = true
            while (keepGoing) {
                let bits = (v >> shift) & bppMask
                let left = 8 - shift
                if (left <= bpp) {
                    if (dp >= data.length) {
                        if (left == 0) break
                        else keepGoing = false
                    }
                    v = data[dp++]
                    bits |= (v << left) & bppMask
                    shift = bpp - left
                } else {
                    shift += bpp
                }
                img[ptr] = ((img[ptr] & ~bppMask) | bits) & 0xff
                ptr++
                if ((ptr & 3) == 3) {
                    // set alpha to 0xff
                    img[ptr++] = 0xff
                }
            }
            return ptr
        }

        const ctx = canvas.getContext("2d")
        const imgdat = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // first pixel holds bpp (LSB are written first, so we can skip what it writes in second and third pixel)
        encode(imgdat.data, 0, 1, [bpp])
        let ptr = 4
        // next, the header
        ptr = encode(imgdat.data, ptr, bpp, header)
        pxt.Util.assert((ptr & 3) == 0)
        if (addedLines == 0)
            ptr = encode(imgdat.data, ptr, bpp, blob)
        else {
            let firstChunk = imgCapacity - header.length
            ptr = encode(imgdat.data, ptr, bpp, blob.slice(0, firstChunk))
            ptr = encode(imgdat.data, addedOffset, 8, blob.slice(firstChunk))
        }
        // set remaining alpha
        ptr |= 3
        while (ptr < imgdat.data.length) {
            imgdat.data[ptr] = 0xff
            ptr += 4
        }

        ctx.putImageData(imgdat, 0, 0)
        return canvas;
    }

    export function decodeBlobAsync(dataURL: string) {
        return pxt.BrowserUtils.loadCanvasAsync(dataURL)
            .then(canvas => {
                const ctx = canvas.getContext("2d")
                const imgdat = ctx.getImageData(0, 0, canvas.width, canvas.height)
                const d = imgdat.data
                const bpp = (d[0] & 1) | ((d[1] & 1) << 1) | ((d[2] & 1) << 2)
                // Safari sometimes just reads a buffer full of 0's so we also need to bail if bpp == 0
                if (bpp > 5 || bpp == 0)
                    return Promise.reject(new Error(lf("Invalid encoded PNG format")))

                function decode(ptr: number, bpp: number, trg: Uint8Array) {
                    let shift = 0
                    let i = 0
                    let acc = 0
                    const mask = (1 << bpp) - 1
                    while (i < trg.length) {
                        acc |= (d[ptr++] & mask) << shift
                        if ((ptr & 3) == 3)
                            ptr++ // skip alpha
                        shift += bpp
                        if (shift >= 8) {
                            trg[i++] = acc & 0xff
                            acc >>= 8
                            shift -= 8
                        }
                    }
                    return ptr
                }

                const hd = new Uint8Array(pxt.Util.imageHeaderSize)
                let ptr = decode(4, bpp, hd)
                const dhd = pxt.HF2.decodeU32LE(hd)
                if (dhd[0] != pxt.Util.imageMagic)
                    return Promise.reject(new Error(lf("Invalid magic in encoded PNG")))
                const res = new Uint8Array(dhd[1])
                const addedLines = dhd[2]
                if (addedLines > 0) {
                    const origSize = (canvas.height - addedLines) * canvas.width
                    const imgCap = (origSize - 1) * 3 * bpp >> 3
                    const tmp = new Uint8Array(imgCap - pxt.Util.imageHeaderSize)
                    decode(ptr, bpp, tmp)
                    res.set(tmp)
                    const added = new Uint8Array(res.length - tmp.length)
                    decode(origSize * 4, 8, added)
                    res.set(added, tmp.length)
                } else {
                    decode(ptr, bpp, res)
                }
                return res
            })
    }

    export function parseQueryString(qs: string) {
        let r: pxt.Map<string> = {}

        qs.replace(/\+/g, " ").replace(/([^#?&=]+)=([^#?&=]*)/g, (f: string, k: string, v: string) => {
            r[decodeURIComponent(k)] = decodeURIComponent(v)
            return ""
        })
        return r
    }

    export function stringifyQueryString(url: string, qs: any) {
        for (let k of Object.keys(qs)) {
            if (url.indexOf("?") >= 0) {
                url += "&"
            } else {
                url += "?"
            }
            url += encodeURIComponent(k) + "=" + encodeURIComponent(qs[k])
        }
        return url
    }
    export function cloneTargetBundle(target: pxt.TargetBundle) {
        target = {
            ...target
        };

        const apiInfo = target.apiInfo;
        delete target.apiInfo;

        const bundleddirs = target.bundleddirs;
        delete target.bundleddirs;

        const bundledpkgs = target.bundledpkgs;
        delete target.bundledpkgs;

        const tutorialInfo = target.tutorialInfo;
        delete target.tutorialInfo;

        const res = clone(target);

        if (apiInfo) {
            res.apiInfo = {};
            for (const key of Object.keys(apiInfo)) {
                const apis = apiInfo[key].apis;

                res.apiInfo[key] = {
                    sha: apiInfo[key].sha,
                    apis: {
                        jres: { ...apis.jres },
                        byQName: cloneApis(apis.byQName)
                    }
                }
            }
        }

        if (bundleddirs) {
            res.bundleddirs = [...bundleddirs]
        }

        if (bundledpkgs) {
            res.bundledpkgs = {};
            for (const key of Object.keys(bundledpkgs)) {
                res.bundledpkgs[key] = {
                    ...bundledpkgs[key]
                };
            }
        }

        if (tutorialInfo) {
            res.tutorialInfo = {};

            for (const key of Object.keys(tutorialInfo)) {
                const built = tutorialInfo[key];

                res.tutorialInfo[key] = {
                    hash: built.hash,
                    usedBlocks: {
                        ...built.usedBlocks
                    },
                    snippetBlocks: {
                        ...built.snippetBlocks
                    },
                    highlightBlocks: {
                        ...built.highlightBlocks
                    },
                    validateBlocks: {
                        ...built.validateBlocks
                    },
                }
            }
        }

        return res;
    }

    export function cloneApis(byQName: pxt.Map<pxtc.SymbolInfo>) {
        const res: pxt.Map<pxtc.SymbolInfo> = {};

        for (const key of Object.keys(byQName)) {
            res[key] = cloneSymbolInfo(byQName[key]);
        }

        return res;
    }

    export function cloneSymbolInfo(sym: pxtc.SymbolInfo): pxtc.SymbolInfo {
        return {
            // FIXME: This is a little dangerous, because we do edit the symbol attributes in some places
            // for localization. However, most of those edits are to top-level properties and only edits
            // to child objects matter so it *should* be fine
            attributes: {
                ...sym.attributes
            },

            parameters: sym.parameters?.map(cloneParameterDesc),
            extendsTypes: sym.extendsTypes ? [...sym.extendsTypes] : undefined,
            pkgs: sym.pkgs ? [...sym.pkgs] : undefined,
            combinedProperties: sym.combinedProperties ? [...sym.combinedProperties] : undefined,

            name: sym.name,
            namespace: sym.namespace,
            fileName: sym.fileName,
            kind: sym.kind,
            retType: sym.retType,
            isInstance: sym.isInstance,
            isContextual: sym.isContextual,
            qName: sym.qName,
            pkg: sym.pkg,
            snippet: sym.snippet,
            snippetName: sym.snippetName,
            snippetWithMarkers: sym.snippetWithMarkers,
            pySnippet: sym.pySnippet,
            pySnippetName: sym.pySnippetName,
            pySnippetWithMarkers: sym.pySnippetWithMarkers,
            blockFields: sym.blockFields,
            isReadOnly: sym.isReadOnly,
            pyName: sym.pyName,
            pyQName: sym.pyQName,
            snippetAddsDefinitions: sym.snippetAddsDefinitions,
        }
    }

    function cloneParameterDesc(param: pxtc.ParameterDesc): pxtc.ParameterDesc {
        return {
            name: param.name,
            description: param.description,
            type: param.type,
            pyTypeString: param.pyTypeString,
            initializer: param.initializer,
            default: param.default,
            properties: param.properties?.map(clonePropertyDesc),
            handlerParameters: param.handlerParameters?.map(clonePropertyDesc),
            options: param.options ? U.clone(param.options) : undefined,
            isEnum: param.isEnum
        }
    }

    function clonePropertyDesc(prop: pxtc.PropertyDesc): pxtc.PropertyDesc {
        return {
            name: prop.name,
            type: prop.type
        }
    }


    export function toUTF8Array(s: string) {
        return (new TextEncoder()).encode(s);
    }

    export function fromUTF8Array(s: Uint8Array) {
        return (new TextDecoder()).decode(s);
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
            if (options.withCredentials)
                client.withCredentials = true;
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
        pxt.perf.measureStart("sha256buffer")
        const res = sha256buffer(Util.toUTF8Array(s));
        pxt.perf.measureEnd("sha256buffer")
        return res;
    }
}

namespace ts.pxtc.jsonPatch {
    export type AddOperation = {
        op: 'add',
        path: (string | number)[];
        value: string | number | boolean | object;
    };

    export type ReplaceOperation = {
        op: 'replace',
        path: (string | number)[];
        value: string | number | boolean | object;
    };

    export type RemoveOperation = {
        op: 'remove',
        path: (string | number)[];
    };

    export type PatchOperation = AddOperation | ReplaceOperation | RemoveOperation;

    interface Ops {
        add(obj: any, key: string | number, value: any): void;
        replace(obj: any, key: string | number, value: any): void;
        remove(obj: any, key: string | number): void;
    }

    const objOps: Ops = {
        add: (obj: any, key: string | number, value: any) => {
            if (typeof obj !== 'object') throw new Error("jsonPatch: expected object type");
            if (key in obj) throw new Error(`jsonPatch: object already contains key ${key}`);
            obj[key] = value;
        },
        replace: (obj: any, key: string | number, value: any) => {
            if (typeof obj !== 'object') throw new Error("jsonPatch: expected object type");
            obj[key] = value;
        },
        remove: (obj: any, key: string | number) => {
            if (typeof obj !== 'object') throw new Error("jsonPatch: expected object type");
            delete obj[key];
        },
    }

    const arrOps: Ops = {
        add: (arr: any, key: string | number, value: any) => {
            if (!Array.isArray(arr)) throw new Error("jsonPatch: expected array type");
            if (key in arr) throw new Error(`jsonPatch: key ${key} already exists in array`);
            if (typeof key === 'number') {
                if (key === Math.floor(key)) {
                    arr.splice(key, 0, value);
                    return;
                }
            }
            (arr as any)[key] = value;
        },
        replace: (arr: any, key: string | number, value: any) => {
            if (!Array.isArray(arr)) throw new Error("jsonPatch: expected array type");
            if (typeof key === 'number') {
                if (key === Math.floor(key)) {
                    arr.splice(key, 1, value);
                    return;
                }
            }
            (arr as any)[key] = value;
        },
        remove: (arr: any, key: string | number) => {
            if (!Array.isArray(arr)) throw new Error("jsonPatch: expected array type");
            if (typeof key === 'number') {
                if (key === Math.floor(key)) {
                    arr.splice(key, 1);
                    return;
                }
            }
            delete (arr as any)[key];
        },
    }

    /**
     * Returns the diff of two objects as a set of change operations, following the
     * "JSON Patch" format: https://datatracker.ietf.org/doc/html/rfc6902 (with a
     * small difference to the way paths are encoded).
     */
    export function diff(oldObj: any, newObj: any): PatchOperation[] {
        const diff: {
            add: AddOperation[]; remove: RemoveOperation[]; replace: ReplaceOperation[];
        } = {
            add: [], remove: [], replace: []
        };

        function _resolveKey(refObj: any, key: string): string | number {
            if (!Array.isArray(refObj)) return key;
            const nkey = Number.parseFloat(key);
            return Number.isNaN(nkey) ? key : nkey;
        }

        function _diff(oldObj: any, newObj: any, basePath: (string | number)[]) {
            if (Object.is(oldObj, newObj)) { return; }
            newObj = newObj || {};
            oldObj = oldObj || {};

            for (let baseKey of Object.keys(oldObj)) {
                if (!(baseKey in newObj)) {
                    const key = _resolveKey(oldObj, baseKey);
                    // key exists in oldObj but not in newObj -> remove op
                    diff.remove.push({
                        op: 'remove',
                        path: basePath.concat(key)
                    });
                }
            }

            for (const baseKey of Object.keys(newObj)) {
                const oldVal = oldObj[baseKey];
                const newVal = newObj[baseKey];
                const key = _resolveKey(newObj, baseKey);
                if (!(key in oldObj)) {
                    if (newObj[key] !== undefined) {
                        // key exists in newObj but not in oldObj -> add op
                        if (basePath.length) {
                            diff.add.push({
                                op: 'add',
                                path: basePath,
                                value: Array.isArray(newObj) ? [] : {}
                            });
                        }
                        diff.add.push({
                            op: 'add',
                            path: basePath.concat(key),
                            value: newVal
                        });
                    }
                } else if (typeof oldVal !== 'object' && typeof newVal !== 'object' && oldVal !== newVal) {
                    // Leaf nodes of same type with differing values -> replace op
                    diff.replace.push({
                        op: 'replace',
                        path: basePath.concat(key),
                        value: newVal
                    });
                } else if (typeof oldVal !== typeof newVal || Array.isArray(oldVal) !== Array.isArray(newVal)) {
                    // Type changed -> replace op
                    diff.replace.push({
                        op: 'replace',
                        path: basePath.concat(key),
                        value: newVal
                    });
                } else {
                    // Recurse
                    _diff(oldVal, newVal, basePath.concat(key));
                }
            }
        }

        _diff(oldObj, newObj, []);

        return [...diff.remove.reverse(), ...diff.replace, ...diff.add.sort((a, b) => a.path.length - b.path.length)];
    }

    /**
     * Applies a set of JSON Patch operations to the object.
     */
    export function patchInPlace(obj: any, ops: PatchOperation[]): void {
        if (!obj || typeof obj !== 'object') {
            throw new Error("jsonPatch: Must be an object or an array.");
        }
        for (const op of ops) {
            const path = op.path.slice();
            const lastKey: (string | number) = path.pop();
            if (lastKey == null) {
                throw new Error("jsonPatch: missing last key");
            }
            let parent = obj;
            // Find parent object of lastKey
            let currKey = path.shift();
            while (currKey != null) {
                if (!(currKey in parent)) {
                    throw new Error(`jsonPatch: missing parent element ${currKey}`);
                }
                parent = parent[currKey];
                currKey = path.shift();
            }
            if (Array.isArray(parent) && typeof lastKey !== 'number') {
                throw new Error(`jsonPatch: expected numeric index for array object`);
            }
            const ops = Array.isArray(parent) ? arrOps : objOps;
            if (op.op === 'remove') {
                ops.remove(parent, lastKey);
            } else if (op.op === 'add' && !(lastKey in parent)) {
                ops.add(parent, lastKey, op.value);
            } else if (op.op === 'replace') {
                ops.replace(parent, lastKey, op.value);
            }
        }
    }

    export function opsAreEqual(a: PatchOperation, b: PatchOperation): boolean {
        return (a.op === b.op && U.arrayEquals(a.path, b.path));
    }
}

namespace ts.pxtc.jsonPatch.tests {
    export function diffTests() {
        const tests: {
            comment: string;
            obja: any;
            objb: any;
            expected: ts.pxtc.jsonPatch.PatchOperation[]
        }[] = [
                {
                    comment: "test 1",
                    obja: { a: 4, b: 5 },
                    objb: { a: 3, b: 5 },
                    expected: [
                        { op: "replace", path: ['a'], value: 3 }
                    ]
                },
                {
                    comment: "test 2",
                    obja: { a: 3, b: 5 },
                    objb: { a: 4, c: 5 },
                    expected: [
                        { op: "remove", path: ['b'] },
                        { op: "replace", path: ['a'], value: 4 },
                        { op: "add", path: ['c'], value: 5 }
                    ]
                },
                {
                    comment: "test 3",
                    obja: { a: 4, b: [1, 2, 3] },
                    objb: { a: 3, b: [1, 2, 4] },
                    expected: [
                        { op: "replace", path: ['a'], value: 3 },
                        { op: "replace", path: ['b', 2], value: 4 }
                    ]
                },
                {
                    comment: "test 4",
                    obja: { a: 3, b: [1, 2, 4] },
                    objb: { a: 3, b: [1, 2, 4, 5] },
                    expected: [
                        { op: "add", path: ['b'], value: [] },
                        { op: "add", path: ['b', 3], value: 5 }
                    ]
                },
                {
                    comment: "test 5",
                    obja: { a: 4, b: { c: 3 } },
                    objb: { a: 4, b: { c: 4 } },
                    expected: [
                        { op: "replace", path: ['b', 'c'], value: 4 }
                    ]
                },
                {
                    comment: "test 6",
                    obja: { a: 4, b: { c: 4 } },
                    objb: { a: 5, b: { d: 4 } },
                    expected: [
                        { op: "remove", path: ['b', 'c'] },
                        { op: "replace", path: ['a'], value: 5 },
                        { op: "add", path: ['b'], value: {} },
                        { op: "add", path: ['b', 'd'], value: 4 }
                    ]
                },
                {
                    comment: "test 7",
                    obja: { a: 4, b: [2, "foo"] },
                    objb: { a: 4, b: [2, "foo", ["this", "that"]] },
                    expected: [
                        { op: "add", path: ['b'], value: [] },
                        { op: "add", path: ['b', 2], value: ["this", "that"] }
                    ]
                }
            ];

        for (const test of tests) {
            console.log(test.comment);
            const patches = ts.pxtc.jsonPatch.diff(test.obja, test.objb);
            if (deepEqual(patches, test.expected)) {
                console.log("succeeded");
            } else {
                console.error("FAILED");
                console.log("got", patches);
                console.log("exp", test.expected);
            }
        }
    }

    export function patchTests() {
        const tests: {
            comment: string;
            obj: any;
            patches: ts.pxtc.jsonPatch.PatchOperation[];
            expected: any;
            validate?: (obj: any) => boolean;
        }[] = [
                {
                    comment: "test 1",
                    obj: { a: "foo", b: [4, 11] },
                    patches: [
                        { op: "remove", path: ['b'] },
                        { op: "replace", path: ['a'], value: 4 },
                        { op: "add", path: ['c'], value: 5 }
                    ],
                    expected: { a: 4, c: 5 }
                },
                {
                    comment: "test 2",
                    obj: { a: 4, b: [1, 2, 3] },
                    patches: [
                        { op: "replace", path: ['a'], value: 3 },
                        { op: "replace", path: ['b', 2], value: 4 },
                        { op: "add", path: ['b', 3], value: 9 }
                    ],
                    expected: { a: 3, b: [1, 2, 4, 9] }
                },
                {
                    comment: "test 3",
                    obj: { a: 4, b: { c: 3 } },
                    patches: [
                        { op: "replace", path: ['a'], value: 5 },
                        { op: "remove", path: ['b', 'c'] },
                        { op: "add", path: ['b', 'd'], value: 4 }
                    ],
                    expected: { a: 5, b: { d: 4 } }
                },
                {
                    comment: "test 4",
                    obj: { a: 4 },
                    patches: [
                        { op: "add", path: ['b'], value: [] },
                        { op: "add", path: ['b', 0], value: "foo" },
                        { op: "add", path: ['b', 1], value: "bar" }
                    ],
                    expected: { a: 4, b: ["foo", "bar"] },
                    validate: (obj: any): boolean => {
                        return obj['b'] && obj['b'].forEach;
                    }
                }
            ];

        for (const test of tests) {
            console.log(test.comment);
            ts.pxtc.jsonPatch.patchInPlace(test.obj, test.patches);
            const equal = deepEqual(test.obj, test.expected);
            const succeeded = equal && test.validate ? test.validate(test.obj) : true;
            if (succeeded) {
                console.log("succeeded");
            } else if (test.expected) {
                console.error("FAILED");
                console.log("got", test.obj);
                console.log("exp", test.expected);
            }
        }
    }

    function deepEqual(a: any, b: any): boolean {
        if (a === b) { return true; }

        if (a && b && typeof a === 'object' && typeof b === 'object') {
            const arrA = Array.isArray(a);
            const arrB = Array.isArray(b);

            if (arrA && arrB) {
                if (a.length !== b.length) { return false; }
                for (let i = 0; i < a.length; ++i) {
                    if (!deepEqual(a[i], b[i])) { return false; }
                }
                return true;
            }

            if (arrA !== arrB) { return false; }

            const keysA = Object.keys(a);

            if (keysA.length !== Object.keys(b).length) { return false; }

            for (const key of keysA) {
                if (!b.hasOwnProperty(key)) { return false; }
                if (!deepEqual(a[key], b[key])) { return false; }
            }

            return true;
        }

        // True if both are NaN, false otherwise
        return a !== a && b !== b;
    };
}
