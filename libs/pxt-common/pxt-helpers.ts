type Action = () => void;

namespace helpers {
    export function arraySplice<T>(arr: T[], start: number, len: number) {
        if (start < 0) {
            return;
        }
        for (let i = 0; i < len; ++i) {
            arr.removeAt(start)
        }
    }

    export function arrayReverse<T>(arr: T[]): void {
        let len = arr.length;
        for (let i = 0; i < len / 2; i++) {
            swap(arr, i, len - i - 1);
        }
    }

    export function arrayShift<T>(arr: T[]): T {
        return arr.removeAt(0);
    }

    export function arrayJoin<T>(arr: T[], sep: string): string {
        let r = "";
        let len = arr.length // caching this seems to match V8
        for (let i = 0; i < len; ++i) {
            if (i > 0 && sep)
                r += sep;
            r += arr[i] || "";
        }
        return r;
    }

    /*TODO: Enable this multiple value unshift, after rest is enabled in our compiler.
        export function arrayUnshift<T>(arr: T[], ...values: T[]) : number {
            for(let i = values.length; i > 0; --i) {
                arr.insertAt(0, values[i - 1]);
            }
            return arr.length;
        }
    */
    export function arrayUnshift<T>(arr: T[], value: T): number {
        arr.insertAt(0, value);
        return arr.length;
    }

    function swap<T>(arr: T[], i: number, j: number): void {
        let temp: T = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }

    function sortHelper<T>(arr: T[], callbackfn?: (value1: T, value2: T) => number): T[] {
        if (arr.length <= 0 || !callbackfn) {
            return arr;
        }
        let len = arr.length;
        // simple selection sort.
        for (let i = 0; i < len - 1; ++i) {
            for (let j = i + 1; j < len; ++j) {
                if (callbackfn(arr[i], arr[j]) > 0) {
                    swap(arr, i, j);
                }
            }
        }
        return arr;
    }

    export function arraySort<T>(arr: T[], callbackfn?: (value1: T, value2: T) => number): T[] {
        if (!callbackfn) {
            //TODO: support native strings and number sorting
            /* callbackfn = function (value1: string, value2: string) : number {
                return value1.compare(value2);
                }*/
        }
        return sortHelper(arr, callbackfn);
    }

    export function arrayMap<T, U>(arr: T[], callbackfn: (value: T, index: number) => U): U[] {
        let res: U[] = []
        let len = arr.length // caching this seems to match V8
        for (let i = 0; i < len; ++i) {
            res.push(callbackfn(arr[i], i))
        }
        return res
    }

    export function arraySome<T>(arr: T[], callbackfn: (value: T, index: number) => boolean): boolean {
        let len = arr.length // caching this seems to match V8
        for (let i = 0; i < len; ++i)
            if (callbackfn(arr[i], i))
                return true;
        return false;
    }

    export function arrayEvery<T>(arr: T[], callbackfn: (value: T, index: number) => boolean): boolean {
        let len = arr.length // caching this seems to match V8
        for (let i = 0; i < len; ++i)
            if (!callbackfn(arr[i], i))
                return false;
        return true;
    }

    export function arrayForEach<T>(arr: T[], callbackfn: (value: T, index: number) => void): void {
        let len = arr.length // caching this seems to match V8
        for (let i = 0; i < len; ++i) {
            callbackfn(arr[i], i);
        }
    }

    export function arrayFilter<T>(arr: T[], callbackfn: (value: T, index: number) => boolean): T[] {
        let res: T[] = []
        let len = arr.length
        for (let i = 0; i < len; ++i) {
            let v = arr[i] // need to cache
            if (callbackfn(v, i)) res.push(v)
        }
        return res
    }

    export function arrayReduce<T, U>(arr: T[], callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): U {
        let len = arr.length
        for (let i = 0; i < len; ++i) {
            initialValue = callbackfn(initialValue, arr[i], i)
        }
        return initialValue
    }

    export function arraySlice<T>(arr: T[], start: number, end: number): T[] {
        const res: T[] = [];
        const len = arr.length;

        if (start < 0) {
            start = Math.max(len + start, 0);
        }

        if (end < 0) {
            end = len + end;
        }

        const sliceLength = end - start;

        for (let i = 0; i < sliceLength; ++i) {
            const index = i + start;
            if (index >= len) {
                break;
            }
            res.push(arr[index]);
        }
        return res;
    }
}

namespace Math {
    export function clamp(min: number, max: number, value: number): number {
        return Math.min(max, Math.max(min, value));
    }

    /**
      * Returns the absolute value of a number (the value without regard to whether it is positive or negative).
      * For example, the absolute value of -5 is the same as the absolute value of 5.
      * @param x A numeric expression for which the absolute value is needed.
      */
    export function abs(x: number): number {
        return x < 0 ? -x : x;
    }

    /**
      * Returns the sign of the x, indicating whether x is positive, negative or zero.
      * @param x The numeric expression to test
      */
    export function sign(x: number): number {
        if (x == 0) return 0;
        if (x > 0) return 1;
        return -1;
    }

    /**
      * Returns the larger of two supplied numeric expressions.
      */
    export function max(a: number, b: number): number {
        if (a >= b) return a;
        return b;
    }

    /**
      * Returns the smaller of two supplied numeric expressions.
      */
    export function min(a: number, b: number): number {
        if (a <= b) return a;
        return b;
    }
}
