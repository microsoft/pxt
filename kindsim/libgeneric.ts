namespace ks.rt {
    // A ref-counted collection of either primitive or ref-counted objects (String, Image,
    // user-defined record, another collection)
    export class RefCollection extends RefObject {
        data: any[] = [];

        // 1 - collection of refs (need decr)
        // 2 - collection of strings (in fact we always have 3, never 2 alone)
        constructor(public flags: number) {
            super();
        }

        destroy() {
            let data = this.data
            if (this.flags & 1)
                for (let i = 0; i < data.length; ++i) {
                    decr(data[i]);
                    data[i] = 0;
                }
            this.data = [];
        }

        print() {
            console.log(`RefCollection id:${this.id} refs:${this.refcnt} len:${this.data.length} flags:${this.flags} d0:${this.data[0]}`)
        }
    }



    export namespace ArrayImpl {
        export function mk(f: number) {
            return new RefCollection(f);
        }

        export function length(c: RefCollection) {
            return c.data.length;
        }

        export function push(c: RefCollection, x: any) {
            if (c.flags & 1) incr(x);
            c.data.push(x);
        }

        export function in_range(c: RefCollection, x: number) {
            return (0 <= x && x < c.data.length);
        }

        export function getAt(c: RefCollection, x: number) {
            if (in_range(c, x)) {
                let tmp = c.data[x];
                if (c.flags & 1) incr(tmp);
                return tmp;
            }
            else {
                check(false);
            }
        }

        export function removeAt(c: RefCollection, x: number) {
            if (!in_range(c, x))
                return;

            if (c.flags & 1) decr(c.data[x]);
            c.data.splice(x, 1)
        }

        export function setAt(c: RefCollection, x: number, y: any) {
            if (!in_range(c, x))
                return;

            if (c.flags & 1) {
                decr(c.data[x]);
                incr(y);
            }
            c.data[x] = y;
        }

        export function indexOf(c: RefCollection, x: any, start: number) {
            if (!in_range(c, start))
                return -1;
            return c.data.indexOf(x, start)
        }

        export function removeElement(c: RefCollection, x: any) {
            let idx = indexOf(c, x, 0);
            if (idx >= 0) {
                removeAt(c, idx);
                return 1;
            }
            return 0;
        }
    }

    export namespace math {
        export function min(x:number, y:number) { return  x < y ? x : y;}
        export function max(x:number, y:number) { return  x > y ? x : y;}
        export function abs(v: number) { return v < 0 ? -v : v; }
        export function sign(v: number) { return v == 0 ? 0 : v < 0 ? -1 : 1; }
        export function random(max: number): number {
            if (max < 1) return 0;
            var r = 0;
            do {
                r = Math.floor(Math.random() * max);
            } while (r == max);
            return r;
        }
        export function mod(x: number, y: number) { return x % y }
    }

    // for explanations see:
    // http://stackoverflow.com/questions/3428136/javascript-integer-math-incorrect-results (second answer)
    // (but the code below doesn't come from there; I wrote it myself)
    // TODO use Math.imul if available
    function intMult(a: number, b: number) {
        return (((a & 0xffff) * (b >>> 16) + (b & 0xffff) * (a >>> 16)) << 16) + ((a & 0xffff) * (b & 0xffff));
    }

    export namespace number {
        export function lt(x: number, y: number) { return x < y; }
        export function le(x: number, y: number) { return x <= y; }
        export function neq(x: number, y: number) { return x != y; }
        export function eq(x: number, y: number) { return x == y; }
        export function gt(x: number, y: number) { return x > y; }
        export function ge(x: number, y: number) { return x >= y; }
        export function divide(x: number, y: number) { return Math.floor(x / y) | 0; }
        export function to_string(x: number) { return initString(x + ""); }
        export function to_character(x: number) { return initString(String.fromCharCode(x)); }
        export function post_to_wall(s: number) { console.log(s); }
    }

    export namespace thumb {
        export function adds(x: number, y: number) { return (x + y) | 0; }
        export function subs(x: number, y: number) { return (x - y) | 0; }
        export function divs(x: number, y: number) { return Math.floor(x / y) | 0; }
        export function muls(x: number, y: number) { return intMult(x, y); }
        export function ands(x: number, y: number) { return x & y; }
        export function orrs(x: number, y: number) { return x | y; }
        export function eors(x: number, y: number) { return x ^ y; }
        export function lsls(x: number, y: number) { return x << y; }
        export function lsrs(x: number, y: number) { return x >>> y; }
        export function asrs(x: number, y: number) { return x >> y; }

        export function cmp_lt(x: number, y: number) { return x < y; }
        export function cmp_le(x: number, y: number) { return x <= y; }
        export function cmp_ne(x: number, y: number) { return x != y; }
        export function cmp_eq(x: number, y: number) { return x == y; }
        export function cmp_gt(x: number, y: number) { return x > y; }
        export function cmp_ge(x: number, y: number) { return x >= y; }

    }

    export namespace string {
        // TODO check edge-conditions

        export function mkEmpty() {
            return ""
        }

        export function concat(a: string, b: string) {
            return initString(a + b);
        }

        export function concat_op(s1: string, s2: string) {
            return concat(s1, s2);
        }

        export function substring(s: string, i: number, j: number) {
            return initString(s.slice(i, i + j));
        }

        export function equals(s1: string, s2: string) {
            return s1 == s2;
        }

        export function count(s: string) {
            return s.length
        }

        function inRange(s: string, i: number) { return 0 <= i && i < s.length }

        export function at(s: string, i: number) {
            return inRange(s, i) ? initString(s.charAt(i)) : null;
        }

        export function to_character_code(s: string) {
            return code_at(s, 0);
        }

        export function code_at(s: string, i: number) {
            return inRange(s, i) ? s.charCodeAt(i) : 0;
        }

        export function to_number(s: string) {
            return parseInt(s);
        }

        export function post_to_wall(s: string) {
            console.log(s);
        }
    }

    export namespace boolean {
        export function not_(v: boolean) {
            return !v;
        }

        export function to_string(v: boolean) {
            return v ? "true" : "false"
        }
    }

}
