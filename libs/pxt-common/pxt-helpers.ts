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
