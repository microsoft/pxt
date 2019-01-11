namespace pxsim.util {
    export function injectPolyphils() {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill
        if (!Array.prototype.fill) {
            Object.defineProperty(Array.prototype, 'fill', {
                writable: true,
                enumerable: true,
                value: function (value: Array<any>) {

                    // Steps 1-2.
                    if (this == null) {
                        throw new TypeError('this is null or not defined');
                    }

                    let O = Object(this);

                    // Steps 3-5.
                    let len = O.length >>> 0;

                    // Steps 6-7.
                    let start = arguments[1];
                    let relativeStart = start >> 0;

                    // Step 8.
                    let k = relativeStart < 0 ?
                        Math.max(len + relativeStart, 0) :
                        Math.min(relativeStart, len);

                    // Steps 9-10.
                    let end = arguments[2];
                    let relativeEnd = end === undefined ?
                        len : end >> 0;

                    // Step 11.
                    let final = relativeEnd < 0 ?
                        Math.max(len + relativeEnd, 0) :
                        Math.min(relativeEnd, len);

                    // Step 12.
                    while (k < final) {
                        O[k] = value;
                        k++;
                    }

                    // Step 13.
                    return O;
                }
            });
        }

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
        if (!Array.prototype.find) {
            Object.defineProperty(Array.prototype, 'find', {
                writable: true,
                enumerable: true,
                value: function (predicate: (value: any, index: number, obj: any[]) => boolean) {
                    // 1. Let O be ? ToObject(this value).
                    if (this == null) {
                        throw new TypeError('"this" is null or not defined');
                    }

                    let o = Object(this);

                    // 2. Let len be ? ToLength(? Get(O, "length")).
                    const len = o.length >>> 0;

                    // 3. If IsCallable(predicate) is false, throw a TypeError exception.
                    if (typeof predicate !== 'function') {
                        throw new TypeError('predicate must be a function');
                    }

                    // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
                    const thisArg = arguments[1];

                    // 5. Let k be 0.
                    let k = 0;

                    // 6. Repeat, while k < len
                    while (k < len) {
                        // a. Let Pk be ! ToString(k).
                        // b. Let kValue be ? Get(O, Pk).
                        // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
                        // d. If testResult is true, return kValue.
                        const kValue = o[k];
                        if (predicate.call(thisArg, kValue, k, o)) {
                            return kValue;
                        }
                        // e. Increase k by 1.
                        k++;
                    }

                    // 7. Return undefined.
                    return undefined;
                },
            });
        }
        // Polyfill for Uint8Array.slice for IE and Safari
        // https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.slice
        // TODO: Move this polyfill to a more appropriate file. It is left here for now because moving it causes a crash in IE; see PXT issue #1301.
        if (!Uint8Array.prototype.slice) {
            Object.defineProperty(Uint8Array.prototype, 'slice', {
                value: Array.prototype.slice,
                writable: true,
                enumerable: true
            });
        }
        if (!Uint16Array.prototype.slice) {
            Object.defineProperty(Uint16Array.prototype, 'slice', {
                value: Array.prototype.slice,
                writable: true,
                enumerable: true
            });
        }
        if (!Uint32Array.prototype.slice) {
            Object.defineProperty(Uint32Array.prototype, 'slice', {
                value: Array.prototype.slice,
                writable: true,
                enumerable: true
            });
        }
        // https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.fill
        if (!Uint8Array.prototype.fill) {
            Object.defineProperty(Uint8Array.prototype, 'fill', {
                value: Array.prototype.fill,
                writable: true,
                enumerable: true
            });
        }
        if (!Uint16Array.prototype.fill) {
            Object.defineProperty(Uint16Array.prototype, 'fill', {
                value: Array.prototype.fill,
                writable: true,
                enumerable: true
            });
        }
        if (!Uint32Array.prototype.fill) {
            Object.defineProperty(Uint32Array.prototype, 'fill', {
                value: Array.prototype.fill,
                writable: true,
                enumerable: true
            });
        }
        // https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.some
        if (!Uint8Array.prototype.some) {
            Object.defineProperty(Uint8Array.prototype, 'some', {
                value: Array.prototype.some,
                writable: true,
                enumerable: true
            });
        }
        if (!Uint16Array.prototype.some) {
            Object.defineProperty(Uint16Array.prototype, 'some', {
                value: Array.prototype.some,
                writable: true,
                enumerable: true
            });
        }
        if (!Uint32Array.prototype.some) {
            Object.defineProperty(Uint32Array.prototype, 'some', {
                value: Array.prototype.some,
                writable: true,
                enumerable: true
            });
        }
        // https://tc39.github.io/ecma262/#sec-%typedarray%.prototype.reverse
        if (!Uint8Array.prototype.reverse) {
            Object.defineProperty(Uint8Array.prototype, 'reverse', {
                value: Array.prototype.reverse,
                writable: true,
                enumerable: true
            });
        }
        if (!Uint16Array.prototype.reverse) {
            Object.defineProperty(Uint16Array.prototype, 'reverse', {
                value: Array.prototype.reverse,
                writable: true,
                enumerable: true
            });
        }
        if (!Uint32Array.prototype.reverse) {
            Object.defineProperty(Uint32Array.prototype, 'reverse', {
                value: Array.prototype.reverse,
                writable: true,
                enumerable: true
            });
        }
        // Inject Math imul polyfill
        if (!Math.imul) {
            // for explanations see:
            // http://stackoverflow.com/questions/3428136/javascript-integer-math-incorrect-results (second answer)
            // (but the code below doesn't come from there; I wrote it myself)
            // TODO use Math.imul if available
            Math.imul = function (a: number, b: number): number {
                const ah = (a >>> 16) & 0xffff;
                const al = a & 0xffff;
                const bh = (b >>> 16) & 0xffff;
                const bl = b & 0xffff;
                // the shift by 0 fixes the sign on the high part
                // the final |0 converts the unsigned value into a signed value
                return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0);
            }
        }
    }

    export class Lazy<T> {
        private _value: T;
        private _evaluated = false;

        constructor(private _func: () => T) { }

        get value(): T {
            if (!this._evaluated) {
                this._value = this._func();
                this._evaluated = true;
            }
            return this._value;
        }
    }

    export function getNormalizedParts(path: string): string[] {
        path = path.replace(/\\/g, "/");

        const parts: string[] = [];
        path.split("/").forEach(part => {
            if (part === ".." && parts.length) {
                parts.pop();
            }
            else if (part && part !== ".") {
                parts.push(part)
            }
        });

        return parts;
    }

    export function normalizePath(path: string): string {
        return getNormalizedParts(path).join("/");
    }

    export function relativePath(fromDir: string, toFile: string): string {
        const fParts = getNormalizedParts(fromDir);
        const tParts = getNormalizedParts(toFile);

        let i = 0;
        while (fParts[i] === tParts[i]) {
            i++;
            if (i === fParts.length || i === tParts.length) {
                break;
            }
        }

        const fRemainder = fParts.slice(i);
        const tRemainder = tParts.slice(i);
        for (let i = 0; i < fRemainder.length; i++) {
            tRemainder.unshift("..");
        }

        return tRemainder.join("/");
    }

    export function pathJoin(...paths: string[]): string {
        let result = "";
        paths.forEach(path => {
            path.replace(/\\/g, "/");
            if (path.lastIndexOf("/") === path.length - 1) {
                path = path.slice(0, path.length - 1)
            }
            result += "/" + path;
        });
        return result;
    }

    export function toArray<T>(a: ArrayLike<T> | ReadonlyArray<T>): T[] {
        if (Array.isArray(a)) {
            return a;
        }
        let r: T[] = []
        for (let i = 0; i < a.length; ++i)
            r.push(a[i])
        return r
    }
}