type Action = () => void;


/**
  * Convert a string to an integer.
  * @param s A string to convert into an integral number. eg: 123
  */
//% help=text/parse-int
//% blockId="string_parseint" block="parse to integer %text" blockNamespace="text"
//% text.defl="123"
//% blockHidden=1
function parseInt(text: string): number {
    return parseFloat(text) >> 0;
}

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

    /**
     * Rounds ``x`` to a number with the given number of ``digits``
     * @param x the number to round
     * @param digits the number of resulting digits
     */
    //%
    export function roundWithPrecision(x: number, digits: number): number {
        digits = digits | 0;
        // invalid digits input
        if (digits <= 0) return Math.round(x);
        if (x == 0) return 0;
        let r = 0;
        do {
            const d = Math.pow(10, digits);
            r = Math.round(x * d) / d;
            digits++;
        } while (r == 0 && digits < 21);
        return r;
    }
}


//% blockHidden=1
namespace __internal {
    /**
     * A shim to render a boolean as a down/up toggle
     */
    //% shim=TD_ID blockHidden=1
    //% blockId=toggleDownUp block="%down"
    //% down.fieldEditor=toggledownup
    //% down.fieldOptions.decompileLiterals=true
    export function __downUp(down: boolean): boolean {
        return down;
    }

    /**
     * A shim to render a boolean as a up/down toggle
     */
    //% shim=TD_ID blockHidden=1
    //% blockId=toggleUpDown block="%up"
    //% up.fieldEditor=toggleupdown
    //% up.fieldOptions.decompileLiterals=true
    export function __upDown(up: boolean): boolean {
        return up;
    }

    /**
     * A shim to render a boolean as a high/low toggle
     */
    //% shim=TD_ID blockHidden=1
    //% blockId=toggleHighLow block="%high"
    //% high.fieldEditor=togglehighlow
    //% high.fieldOptions.decompileLiterals=true
    export function __highLow(high: boolean): boolean {
        return high;
    }

    /**
     * A shim to render a boolean as a on/off toggle
     */
    //% shim=TD_ID blockHidden=1
    //% blockId=toggleOnOff block="%on"
    //% on.fieldEditor=toggleonoff
    //% on.fieldOptions.decompileLiterals=true
    export function __onOff(on: boolean): boolean {
        return on;
    }

    /**
     * A shim to render a boolean as a yes/no toggle
     */
    //% shim=TD_ID blockHidden=1
    //% blockId=toggleYesNo block="%yes"
    //% yes.fieldEditor=toggleyesno
    //% yes.fieldOptions.decompileLiterals=true
    export function __yesNo(yes: boolean): boolean {
        return yes;
    }

    /**
     * Get the color wheel field editor
     * @param color color, eg: #ff0000
     */
    //% blockId=colorNumberPicker block="%value"
    //% blockHidden=true
    //% shim=TD_ID colorSecondary="#FFFFFF"
    //% value.fieldEditor="colornumber" value.fieldOptions.decompileLiterals=true
    //% value.defl='#ff0000'
    //% value.fieldOptions.colours='["#ff0000","#ff8000","#ffff00","#ff9da5","#00ff00","#b09eff","#00ffff","#007fff","#65471f","#0000ff","#7f00ff","#ff0080","#ff00ff","#ffffff","#999999","#000000"]'
    //% value.fieldOptions.columns=4 value.fieldOptions.className='rgbColorPicker'
    export function __colorNumberPicker(value: number) {
        return value;
    }

    /**
     * Get the color wheel field editor
     * @param value value between 0 to 255 to get a color value, eg: 10
     */
    //% blockId=colorWheelPicker block="%value"
    //% blockHidden=true
    //% shim=TD_ID colorSecondary="#FFFFFF"
    //% value.fieldEditor="colorwheel" value.fieldOptions.decompileLiterals=true
    //% value.fieldOptions.sliderWidth='200'
    //% value.fieldOptions.min=0 value.fieldOptions.max=255
    export function __colorWheelPicker(value: number) {
        return value;
    }

    /**
    * Get the color wheel field editor using HSV values
    * @param value value between 0 to 255 to get a color value, eg: 10
    */
    //% blockId=colorWheelHsvPicker block="%value"
    //% blockHidden=true
    //% shim=TD_ID colorSecondary="#FFFFFF"
    //% value.fieldEditor="colorwheel" value.fieldOptions.decompileLiterals=true
    //% value.fieldOptions.sliderWidth='200'
    //% value.fieldOptions.min=0 value.fieldOptions.max=255
    //% value.fieldOptions.channel=hsvfast
    export function __colorWheelHsvPicker(value: number) {
        return value;
    }

    /**
     * A speed picker
     * @param speed the speed, eg: 50
     */
    //% blockId=speedPicker block="%speed" shim=TD_ID
    //% speed.fieldEditor="speed" colorSecondary="#FFFFFF"
    //% weight=0 blockHidden=1 speed.fieldOptions.decompileLiterals=1
    export function __speedPicker(speed: number): number {
        return speed;
    }

    /**
     * A turn ratio picker
     * @param turnratio the turn ratio, eg: 0
     */
    //% blockId=turnRatioPicker block="%turnratio" shim=TD_ID
    //% turnratio.fieldEditor="turnratio" colorSecondary="#FFFFFF"
    //% weight=0 blockHidden=1 turnRatio.fieldOptions.decompileLiterals=1
    export function __turnRatioPicker(turnratio: number): number {
        return turnratio;
    }

    /**
     * A field editor that displays a protractor
     */
    //% blockId=protractorPicker block="%angle"
    //% shim=TD_ID
    //% angle.fieldEditor=protractor
    //% angle.fieldOptions.decompileLiterals=1    
    //% colorSecondary="#FFFFFF"
    //% blockHidden=1
    export function __protractor(angle: number) {
        return angle;
    }

    /**
      * Get the time field editor
      * @param ms time duration in milliseconds, eg: 500, 1000
      */
    //% blockId=timePicker block="%ms"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% ms.fieldEditor="numberdropdown" ms.fieldOptions.decompileLiterals=true
    //% ms.fieldOptions.data='[["100 ms", 100], ["200 ms", 200], ["500 ms", 500], ["1 second", 1000], ["2 seconds", 2000]]'
    export function __timePicker(ms: number): number {
        return ms;
    }
}