namespace pxt.py {
    // TODO handle translating built-ins to and from python
    /*
        examples:
            ts:
                let a = [1,2]
                let l = a.length
            py:
                a = [1,2]
                l = len(a)
            
            ts:
                let n = Math.randomRange(0, 10)
            py:
                n = random.randint(0, 10)

            ts:
                let fn = Math.randomRange
                let n = fn(0, 10)
            py:
                fn = random.randint
                n = fn(0, 10)

            ts:
                let m = Math
                let fn = m.randomRange
                let n = fn(0, 10)
            py:
                # error: "Math" object doesn't exist
                # TODO is there a better way to handle this? Can we preform substitution of m -> Math first?

            py:
                r = random
                fn = r.randomRange
                n = fn(0, 10)
            ts:
                // error: "random" object doesn't exist
                # TODO is there a better way to handle this? Can we preform substitution of r -> random first?

        observation: in ts2py (but not py2ts) we can access the full typescript language services and typechecker 
        since we know the input program compiles correctly (if it doesn't, surface an error saying the TS or blocks program 
        must be error-free before converting to PY)
        observation: in ts2py we can be certain when we're calling a builtin due to the above property

        strategy for both ts2py and py2ts:
            for each identifier
            if identifier is function or method
            if function / method is one of the builtin ones
            map it to the python equivalent

    */

    /*
    // from: pxt-core.d.ts
    interface Array<T> {
        length: number;
        push(item: T): void;
        concat(arr: T[]): T[];
        pop(): T;
        reverse(): void;
        shift(): T;
        unshift(value: T): number;
        slice(start?: number, end?: number): T[];
        splice(start: number, deleteCount: number): void;
        join(sep: string): string;
        some(callbackfn: (value: T, index: number) => boolean): boolean;
        every(callbackfn: (value: T, index: number) => boolean): boolean;
        sort(callbackfn?: (value1: T, value2: T) => number): T[];
        map<U>(callbackfn: (value: T, index: number) => U): U[];
        forEach(callbackfn: (value: T, index: number) => void): void;
        filter(callbackfn: (value: T, index: number) => boolean): T[];
        fill(value: T, start?: number, end?: number): T[];
        find(callbackfn: (value: T, index: number) => boolean): T;
        reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): U;
        removeElement(element: T): boolean;
        removeAt(index: number): T;
        insertAt(index: number, value: T): void;
        indexOf(item: T, fromIndex?: number): number;
        get(index: number): T;
        set(index: number, value: T): void;
        [n: number]: T;
    }
    declare interface String {
        concat(other: string): string;
        charAt(index: number): string;
        length: number;
        charCodeAt(index: number): number;
        compare(that: string): number;
        substr(start: number, length?: number): string;
        slice(start: number, end?: number): string;
        isEmpty(): boolean;
        indexOf(searchValue: string, start?: number): number;
        includes(searchValue: string, start?: number): boolean;
        split(separator?: string, limit?: number): string[];
        [index: number]: string;
    }
    declare function parseFloat(text: string): number;
    interface Object { }
    interface Function { }
    interface IArguments { }
    interface RegExp { }
    type TemplateStringsArray = Array<string>;
    type uint8 = number;
    type uint16 = number;
    type uint32 = number;
    type int8 = number;
    type int16 = number;
    type int32 = number;
    declare interface Boolean {
        toString(): string;
    }
    declare namespace String {
        function fromCharCode(code: number): string;
    }
    declare interface Number {
        toString(): string;
    }
    declare namespace Array {
        function isArray(obj: any): boolean;
    }
    declare namespace Object {
        function keys(obj: any): string[];
    }
    declare namespace Math {
        function pow(x: number, y: number): number;
        function random(): number;
        function randomRange(min: number, max: number): number;
        function log(x: number): number;
        function exp(x: number): number;
        function sin(x: number): number;
        function cos(x: number): number;
        function tan(x: number): number;
        function asin(x: number): number;
        function acos(x: number): number;
        function atan(x: number): number;
        function atan2(y: number, x: number): number;
        function sqrt(x: number): number;
        function ceil(x: number): number;
        function floor(x: number): number;
        function trunc(x: number): number;
        function round(x: number): number;
        function imul(x: number, y: number): number;
        function idiv(x: number, y: number): number;
    }
     */
}