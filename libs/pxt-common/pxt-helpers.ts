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

    export function arrayMap<T, U>(arr: T[], callbackfn: (value: T, index: number) => U): U[] {
        let res: U[] = []
        let len = arr.length // caching this seems to match V8
        for (let i = 0; i < len; ++i) {
            res.push(callbackfn(arr[i], i))
        }
        return res
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
