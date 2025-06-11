namespace pxsim {
    // A ref-counted collection of either primitive or ref-counted objects (String, Image,
    // user-defined record, another collection)
    export class RefCollection extends RefObject {
        private data: any[] = [];

        constructor() {
            super();
        }

        scan(mark: (path: string, v: any) => void) {
            for (let i = 0; i < this.data.length; ++i)
                mark("[" + i + "]", this.data[i])
        }
        gcKey() { return "[...]" }
        gcSize() { return this.data.length + 2 }

        toArray(): any[] {
            return this.data.slice(0);
        }

        toAny(): any[] {
            return this.data.map(v => RefObject.toAny(v));
        }

        static fromAny(arr: any[], deep: boolean = true) {
            const r = new RefCollection();
            if (deep)
                r.data = arr.map(v => RefObject.fromAny(v));
            else
                r.data = arr.slice(0);
            return r;
        }

        toDebugString(): string {
            let s = "[";
            for (let i = 0; i < this.data.length; ++i) {
                if (i > 0)
                    s += ",";
                let newElem = RefObject.toDebugString(this.data[i]);
                if (s.length + newElem.length > 100) {
                    if (i == 0) {
                        s += newElem.substr(0, 100);
                    }
                    s += "..."
                    break;
                } else {
                    s += newElem;
                }
            }
            s += "]"
            return s;
        }

        destroy() {
            let data = this.data
            for (let i = 0; i < data.length; ++i) {
                data[i] = 0;
            }
            this.data = [];
        }

        isValidIndex(x: number) {
            return (x >= 0 && x < this.data.length);
        }

        push(x: any) {
            this.data.push(x);
        }

        pop() {
            return this.data.pop();;
        }

        getLength() {
            return this.data.length;
        }

        setLength(x: number) {
            this.data.length = x;
        }

        getAt(x: number) {
            return this.data[x];
        }

        setAt(x: number, y: any) {
            this.data[x] = y;
        }

        insertAt(x: number, y: number) {
            this.data.splice(x, 0, y);
        }

        removeAt(x: number) {
            let ret = this.data.splice(x, 1)
            return ret[0]; // return the deleted element.
        }

        indexOf(x: number, start: number) {
            return this.data.indexOf(x, start);
        }

        print() {
            //pxsim.log(`RefCollection id:${this.id} refs:${this.refcnt} len:${this.data.length} d0:${this.data[0]}`)
        }
    }

    export namespace Array_ {
        export function mk() {
            return new RefCollection();
        }

        export function isArray(c: any) {
            return c instanceof RefCollection
        }

        export function length(c: RefCollection) {
            typeCheck(c)
            return c.getLength();
        }

        export function setLength(c: RefCollection, x: number) {
            typeCheck(c)
            c.setLength(x);
        }


        export function push(c: RefCollection, x: any) {
            typeCheck(c)
            c.push(x);
        }

        export function pop(c: RefCollection, x: any) {
            typeCheck(c)
            let ret = c.pop();
            // no decr() since we're returning it
            return ret;
        }

        export function getAt(c: RefCollection, x: number) {
            typeCheck(c)
            let tmp = c.getAt(x);
            return tmp;
        }

        export function removeAt(c: RefCollection, x: number) {
            typeCheck(c)
            if (!c.isValidIndex(x))
                return;
            // no decr() since we're returning it
            return c.removeAt(x);
        }

        export function insertAt(c: RefCollection, x: number, y: number) {
            typeCheck(c)
            c.insertAt(x, y);
        }

        export function setAt(c: RefCollection, x: number, y: any) {
            typeCheck(c)
            c.setAt(x, y);
        }

        export function indexOf(c: RefCollection, x: any, start: number) {
            typeCheck(c)
            return c.indexOf(x, start)
        }

        export function removeElement(c: RefCollection, x: any) {
            typeCheck(c)
            let idx = indexOf(c, x, 0);
            if (idx >= 0) {
                removeAt(c, idx);
                return 1;
            }
            return 0;
        }

        export function typeCheck(c: RefCollection) {
            if (!(c instanceof RefCollection)) {
                throwFailedCastError(c, "Array");
            }
        }
    }

    export namespace Math_ {
        // for explanations see:
        // http://stackoverflow.com/questions/3428136/javascript-integer-math-incorrect-results (second answer)
        // (but the code below doesn't come from there; I wrote it myself)
        export const imul = Math.imul || function (a: number, b: number) {
            const ah = (a >>> 16) & 0xffff;
            const al = a & 0xffff;
            const bh = (b >>> 16) & 0xffff;
            const bl = b & 0xffff;
            // the shift by 0 fixes the sign on the high part
            // the final |0 converts the unsigned value into a signed value
            return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0);
        };

        export function idiv(x: number, y: number) {
            return ((x | 0) / (y | 0)) | 0
        }

        export function round(n: number) { return Math.round(n) }
        export function roundWithPrecision(x: number, digits: number): number {
            digits = digits | 0;
            // invalid digits input
            if (digits <= 0) return Math.round(x);
            if (x == 0) return 0;
            let r = 0;
            while (r == 0 && digits < 21) {
                const d = Math.pow(10, digits++);
                r = Math.round(x * d + Number.EPSILON) / d;
            }
            return r;
        }
        export function ceil(n: number) { return Math.ceil(n) }
        export function floor(n: number) { return Math.floor(n) }
        export function sqrt(n: number) { return Math.sqrt(n) }
        export function pow(x: number, y: number) {
            return Math.pow(x, y)
        }
        export function clz32(n: number) { return Math.clz32(n) }
        export function log(n: number) { return Math.log(n) }
        export function log10(n: number) { return Math.log10(n) }
        export function log2(n: number) { return Math.log2(n) }
        export function exp(n: number) { return Math.exp(n) }
        export function sin(n: number) { return Math.sin(n) }
        export function sinh(n: number) { return Math.sinh(n) }
        export function cos(n: number) { return Math.cos(n) }
        export function cosh(n: number) { return Math.cosh(n) }
        export function tan(n: number) { return Math.tan(n) }
        export function tanh(n: number) { return Math.tanh(n) }
        export function asin(n: number) { return Math.asin(n) }
        export function asinh(n: number) { return Math.asinh(n) }
        export function acos(n: number) { return Math.acos(n) }
        export function acosh(n: number) { return Math.acosh(n) }
        export function atan(n: number) { return Math.atan(n) }
        export function atanh(x: number) { return Math.atanh(x) }
        export function atan2(y: number, x: number) { return Math.atan2(y, x) }
        export function trunc(x: number) { return x > 0 ? Math.floor(x) : Math.ceil(x); }
        export function random(): number { return Math.random(); }
        export function randomRange(min: number, max: number): number {
            if (min == max) return min;
            if (min > max) {
                let t = min;
                min = max;
                max = t;
            }
            if (Math.floor(min) == min && Math.floor(max) == max)
                return min + Math.floor(Math.random() * (max - min + 1));
            else
                return min + Math.random() * (max - min);
        }
    }

    export namespace Number_ {
        export function lt(x: number, y: number) { return x < y; }
        export function le(x: number, y: number) { return x <= y; }
        export function neq(x: number, y: number) { return !eq(x, y); }
        export function eq(x: number, y: number) { return pxtrt.nullFix(x) == pxtrt.nullFix(y); }
        export function eqDecr(x: number, y: number) {
            if (pxtrt.nullFix(x) == pxtrt.nullFix(y)) {
                return true;
            } else {
                return false
            }
        }
        export function gt(x: number, y: number) { return x > y; }
        export function ge(x: number, y: number) { return x >= y; }
        export function div(x: number, y: number) { return Math.floor(x / y) | 0; }
        export function mod(x: number, y: number) { return x % y; }
        export function bnot(x: number) { return ~x; }
        export function toString(x: number) { return (x + ""); }
    }

    export namespace thumb {
        export function adds(x: number, y: number) { return (x + y) | 0; }
        export function subs(x: number, y: number) { return (x - y) | 0; }
        export function divs(x: number, y: number) { return Math.floor(x / y) | 0; }
        export function muls(x: number, y: number) { return Math_.imul(x, y); }
        export function ands(x: number, y: number) { return x & y; }
        export function orrs(x: number, y: number) { return x | y; }
        export function eors(x: number, y: number) { return x ^ y; }
        export function lsls(x: number, y: number) { return x << y; }
        export function lsrs(x: number, y: number) { return x >>> y; }
        export function asrs(x: number, y: number) { return x >> y; }
        export function bnot(x: number) { return ~x; }

        export function ignore(v: any) { return v; }
    }

    export namespace avr {
        function toInt(v: number) {
            return (v << 16) >> 16
        }
        export function adds(x: number, y: number) { return toInt(x + y); }
        export function subs(x: number, y: number) { return toInt(x - y); }
        export function divs(x: number, y: number) { return toInt(Math.floor(x / y)); }
        export function muls(x: number, y: number) { return toInt(Math_.imul(x, y)); }
        export function ands(x: number, y: number) { return toInt(x & y); }
        export function orrs(x: number, y: number) { return toInt(x | y); }
        export function eors(x: number, y: number) { return toInt(x ^ y); }
        export function lsls(x: number, y: number) { return toInt(x << y); }
        export function lsrs(x: number, y: number) { return (x & 0xffff) >>> y; }
        export function asrs(x: number, y: number) { return toInt(x >> y); }
        export function bnot(x: number) { return ~x; }

        export function ignore(v: any) { return v; }
    }

    export namespace String_ {
        export function stringConv(v: any) {
            const cb = getResume();
            if (v instanceof RefRecord) {
                if (v.vtable.toStringMethod) {
                    runtime.runFiberAsync(v.vtable.toStringMethod as any, v)
                        .then(() => {
                            cb(runtime.currFrame.retval + "")
                        })
                    return
                }
            }
            cb(v + "")
        }

        export function mkEmpty() {
            return ""
        }

        export function fromCharCode(code: number) {
            return (String.fromCharCode(code));
        }

        export function toNumber(s: string) {
            typeCheck(s);
            return parseFloat(s);
        }

        // TODO check edge-conditions

        export function concat(a: string, b: string) {
            typeCheck(a);
            return (a + b);
        }

        export function substring(s: string, i: number, j: number) {
            typeCheck(s);
            return (s.slice(i, i + j));
        }

        export function equals(s1: string, s2: string) {
            typeCheck(s1);
            return s1 == s2;
        }

        export function compare(s1: string, s2: string) {
            typeCheck(s1);
            if (s1 == s2) return 0;
            if (s1 < s2) return -1;
            return 1;
        }

        export function compareDecr(s1: string, s2: string) {
            typeCheck(s1);
            if (s1 == s2) {
                return 0;
            }
            if (s1 < s2) return -1;
            return 1;
        }

        export function length(s: string) {
            typeCheck(s);
            return s.length
        }

        export function substr(s: string, start: number, length?: number) {
            typeCheck(s);
            return (s.substr(start, length));
        }

        function inRange(s: string, i: number) {
            typeCheck(s)
            return 0 <= i && i < s.length
        }

        export function charAt(s: string, i: number) {
            typeCheck(s);
            return (s.charAt(i));
        }

        export function charCodeAt(s: string, i: number) {
            typeCheck(s)
            return inRange(s, i) ? s.charCodeAt(i) : 0;
        }

        export function indexOf(s: string, searchValue: string, start?: number) {
            typeCheck(s);
            if (searchValue == null) return -1;
            return s.indexOf(searchValue, start);
        }

        export function lastIndexOf(s: string, searchValue: string, start?: number) {
            typeCheck(s);
            if (searchValue == null) return -1;
            return s.lastIndexOf(searchValue, start);
        }

        export function includes(s: string, searchValue: string, start?: number) {
            typeCheck(s);
            if (searchValue == null) return false;
            return s.includes(searchValue, start);
        }

        export function typeCheck(s: string) {
            if (typeof s !== "string") {
                throwFailedCastError(s, "string");
            }
        }
    }

    export namespace Boolean_ {
        export function toString(v: boolean) {
            return v ? "true" : "false"
        }
        export function bang(v: boolean) {
            return !v;
        }
    }


    export class RefBuffer extends RefObject {
        isStatic = false
        constructor(public data: Uint8Array) {
            super();
        }

        scan(mark: (path: string, v: any) => void) {
            // nothing to do
        }

        gcKey() { return "Buffer" }
        gcSize() { return 2 + (this.data.length + 3 >> 2) }
        gcIsStatic() { return this.isStatic }

        print() {
            // pxsim.log(`RefBuffer id:${this.id} refs:${this.refcnt} len:${this.data.length} d0:${this.data[0]}`)
        }

        toDebugString(): string {
            return BufferMethods.toHex(this);
        }
    }

    export namespace BufferMethods {
        // keep in sync with C++!
        export enum NumberFormat {
            Int8LE = 1,
            UInt8LE,
            Int16LE,
            UInt16LE,
            Int32LE,
            Int8BE,
            UInt8BE,
            Int16BE,
            UInt16BE,
            Int32BE,
            UInt32LE,
            UInt32BE,
            Float32LE,
            Float64LE,
            Float32BE,
            Float64BE,
        };

        function fmtInfoCore(fmt: NumberFormat) {
            switch (fmt) {
                case NumberFormat.Int8LE: return -1;
                case NumberFormat.UInt8LE: return 1;
                case NumberFormat.Int16LE: return -2;
                case NumberFormat.UInt16LE: return 2;
                case NumberFormat.Int32LE: return -4;
                case NumberFormat.UInt32LE: return 4;
                case NumberFormat.Int8BE: return -10;
                case NumberFormat.UInt8BE: return 10;
                case NumberFormat.Int16BE: return -20;
                case NumberFormat.UInt16BE: return 20;
                case NumberFormat.Int32BE: return -40;
                case NumberFormat.UInt32BE: return 40;

                case NumberFormat.Float32LE: return 4;
                case NumberFormat.Float32BE: return 40;
                case NumberFormat.Float64LE: return 8;
                case NumberFormat.Float64BE: return 80;
                default: throw U.userError("bad format");
            }
        }

        export function fmtInfo(fmt: NumberFormat) {
            let size = fmtInfoCore(fmt)
            let signed = false
            if (size < 0) {
                signed = true
                size = -size
            }
            let swap = false
            if (size >= 10) {
                swap = true
                size /= 10
            }
            let isFloat = fmt >= NumberFormat.Float32LE
            return { size, signed, swap, isFloat }
        }

        export function getNumber(buf: RefBuffer, fmt: NumberFormat, offset: number) {
            typeCheck(buf);
            let inf = fmtInfo(fmt)
            if (inf.isFloat) {
                let subarray = buf.data.buffer.slice(offset, offset + inf.size)
                if (inf.swap) {
                    let u8 = new Uint8Array(subarray)
                    u8.reverse()
                }
                if (inf.size == 4) return new Float32Array(subarray)[0]
                else return new Float64Array(subarray)[0]
            }

            let r = 0
            for (let i = 0; i < inf.size; ++i) {
                r <<= 8
                let off = inf.swap ? offset + i : offset + inf.size - i - 1
                r |= buf.data[off]
            }
            if (inf.signed) {
                let missingBits = 32 - (inf.size * 8)
                r = (r << missingBits) >> missingBits;
            } else {
                r = r >>> 0;
            }
            return r
        }

        export function setNumber(buf: RefBuffer, fmt: NumberFormat, offset: number, r: number) {
            typeCheck(buf);
            let inf = fmtInfo(fmt)
            if (inf.isFloat) {
                let arr = new Uint8Array(inf.size)
                if (inf.size == 4)
                    new Float32Array(arr.buffer)[0] = r
                else
                    new Float64Array(arr.buffer)[0] = r
                if (inf.swap)
                    arr.reverse()
                for (let i = 0; i < inf.size; ++i) {
                    buf.data[offset + i] = arr[i]
                }
                return
            }

            for (let i = 0; i < inf.size; ++i) {
                let off = !inf.swap ? offset + i : offset + inf.size - i - 1
                buf.data[off] = (r & 0xff)
                r >>= 8
            }
        }

        export function createBuffer(size: number) {
            return new RefBuffer(new Uint8Array(size));
        }

        export function createBufferFromHex(hex: string) {
            String_.typeCheck(hex);
            let r = createBuffer(hex.length >> 1)
            for (let i = 0; i < hex.length; i += 2)
                r.data[i >> 1] = parseInt(hex.slice(i, i + 2), 16)
            r.isStatic = true
            return r
        }

        export function isReadOnly(buf: RefBuffer) {
            typeCheck(buf);
            return buf.isStatic;
        }

        export function getBytes(buf: RefBuffer) {
            typeCheck(buf);
            // not sure if this is any useful...
            return buf.data;
        }

        function inRange(buf: RefBuffer, off: number) {
            return 0 <= off && off < buf.data.length
        }

        export function getUint8(buf: RefBuffer, off: number) {
            typeCheck(buf);
            return getByte(buf, off);
        }

        export function getByte(buf: RefBuffer, off: number) {
            typeCheck(buf);
            if (inRange(buf, off)) return buf.data[off]
            else return 0;
        }

        export function setUint8(buf: RefBuffer, off: number, v: number) {
            typeCheck(buf);
            setByte(buf, off, v);
        }

        function checkWrite(buf: RefBuffer) {
            if (buf.isStatic) U.userError("Writing to read only buffer.")
        }

        export function setByte(buf: RefBuffer, off: number, v: number) {
            typeCheck(buf);
            if (inRange(buf, off)) {
                checkWrite(buf)
                buf.data[off] = v
            }
        }

        export function length(buf: RefBuffer) {
            typeCheck(buf);
            return buf.data.length
        }

        export function fill(buf: RefBuffer, value: number, offset: number = 0, length: number = -1) {
            typeCheck(buf);
            if (offset < 0 || offset > buf.data.length)
                return;
            if (length < 0)
                length = buf.data.length;
            length = Math.min(length, buf.data.length - offset);

            checkWrite(buf)
            buf.data.fill(value, offset, offset + length)
        }

        export function slice(buf: RefBuffer, offset: number, length: number) {
            typeCheck(buf);
            offset = Math.min(buf.data.length, offset);
            if (length < 0)
                length = buf.data.length;
            length = Math.min(length, buf.data.length - offset);
            return new RefBuffer(buf.data.slice(offset, offset + length));
        }

        export function toHex(buf: RefBuffer): string {
            typeCheck(buf);
            const hex = "0123456789abcdef";
            let res = "";
            for (let i = 0; i < buf.data.length; ++i) {
                res += hex[buf.data[i] >> 4];
                res += hex[buf.data[i] & 0xf];
            }
            return res;
        }

        export function toString(buf: RefBuffer): string {
            typeCheck(buf);
            return U.fromUTF8Array(buf.data);
        }

        function memmove(dst: Uint8Array, dstOff: number, src: Uint8Array, srcOff: number, len: number) {
            if (src.buffer === dst.buffer) {
                memmove(dst, dstOff, src.slice(srcOff, srcOff + len), 0, len);
            } else {
                for (let i = 0; i < len; ++i)
                    dst[dstOff + i] = src[srcOff + i];
            }
        }

        const INT_MIN = -0x80000000;

        export function shift(buf: RefBuffer, offset: number, start: number, len: number) {
            typeCheck(buf);
            if (len < 0) len = buf.data.length - start;
            if (start < 0 || start + len > buf.data.length || start + len < start
                || len == 0 || offset == 0 || offset == INT_MIN) return;
            if (len == 0 || offset == 0 || offset == INT_MIN) return;
            if (offset <= -len || offset >= len) {
                fill(buf, 0);
                return;
            }

            checkWrite(buf)
            if (offset < 0) {
                offset = -offset;
                memmove(buf.data, start + offset, buf.data, start, len - offset);
                buf.data.fill(0, start, start + offset)
            } else {
                len = len - offset;
                memmove(buf.data, start, buf.data, start + offset, len);
                buf.data.fill(0, start + len, start + len + offset)
            }
        }

        export function rotate(buf: RefBuffer, offset: number, start: number, len: number) {
            typeCheck(buf);
            if (len < 0) len = buf.data.length - start;

            if (start < 0 || start + len > buf.data.length || start + len < start
                || len == 0 || offset == 0 || offset == INT_MIN) return;

            checkWrite(buf)

            if (offset < 0)
                offset += len << 8; // try to make it positive
            offset %= len;
            if (offset < 0)
                offset += len;

            let data = buf.data
            let n_first = offset
            let first = 0
            let next = n_first
            let last = len

            while (first != next) {
                let tmp = data[first + start]
                data[first++ + start] = data[next + start]
                data[next++ + start] = tmp
                if (next == last) {
                    next = n_first;
                } else if (first == n_first) {
                    n_first = next;
                }
            }
        }

        export function write(buf: RefBuffer, dstOffset: number, src: RefBuffer, srcOffset = 0, length = -1) {
            typeCheck(buf);
            typeCheck(src);
            if (length < 0)
                length = src.data.length;

            if (srcOffset < 0 || dstOffset < 0 || dstOffset > buf.data.length)
                return;

            length = Math.min(src.data.length - srcOffset, buf.data.length - dstOffset);

            if (length < 0)
                return;

            checkWrite(buf)
            memmove(buf.data, dstOffset, src.data, srcOffset, length)
        }

        export function typeCheck(buf: RefBuffer) {
            if (!(buf instanceof RefBuffer)) {
                throwFailedCastError(buf, "Buffer");
            }
        }
    }
}

namespace pxsim.control {
    export function createBufferFromUTF8(str: string) {
        String_.typeCheck(str);
        return new pxsim.RefBuffer(U.toUTF8Array(str));
    }
}
