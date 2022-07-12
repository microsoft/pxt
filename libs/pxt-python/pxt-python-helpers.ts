namespace _py {
    export const ATTRIBUTE_ERROR: string = "AttributeError";
    export const INDEX_ERROR: string = "IndexError";
    export const VALUE_ERROR: string = "ValueError";
    export const TYPE_ERROR: string = "TypeError";

    export function py_string_capitalize(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_casefold(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_center(str: string, width: number, fillChar?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_count(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_endswith(str: string, suffix: string, start?: number, end?: number): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_find(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_index(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_isalnum(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isalpha(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isascii(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isdigit(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isnumeric(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isspace(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isdecimal(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isidentifier(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_islower(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isprintable(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_istitle(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_isupper(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_join(str: string, iterable: any[]): string {
        nullCheck(str);
        return str;
    }

    export function py_string_ljust(str: string, width: number, fillChar?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_lower(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_rfind(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_rindex(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        return 0;
    }

    export function py_string_rjust(str: string, width: number, fillChar?: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_rsplit(str: string, sep?: string, maxsplit?: number): string[] {
        nullCheck(str);

        if (sep === "") {
            throw VALUE_ERROR;
        }

        if (maxsplit === 0) return [str]
        if (!maxsplit || maxsplit < 0) maxsplit = str.length;

        const out: string[] = [];

        let currentChar: string;
        let splitEnd: number;
        let previousSplit = str.length;

        if (!sep) {
            for (let i = str.length - 1; i >= 0; i--) {
                currentChar = str.charAt(i);
                if (isWhitespace(currentChar)) {
                    if (splitEnd === undefined) splitEnd = i;
                }
                else if (splitEnd !== undefined) {
                    if (previousSplit !== splitEnd + 1) out.push(str.substr(splitEnd + 1, previousSplit - (splitEnd + 1)));
                    previousSplit = i + 1;
                    splitEnd = undefined;

                }

                if (out.length === maxsplit) break;
            }

            if (out.length < maxsplit + 1) {
                if (splitEnd !== undefined) {
                    if (previousSplit !== splitEnd + 1)
                        out.push(str.substr(splitEnd + 1, previousSplit - (splitEnd + 1)));
                }
                else {
                    out.push(str.substr(0, previousSplit))
                }
            }
        }
        else {
            let separatorIndex = 0;
            for (let i = str.length; i >= 0; i--) {
                currentChar = str.charAt(i);
                if (currentChar === sep.charAt(sep.length - separatorIndex - 1)) {
                    separatorIndex++;
                    if (splitEnd === undefined) splitEnd = i;
                }
                else {
                    separatorIndex = 0;
                    splitEnd = undefined;
                }

                if (separatorIndex === sep.length) {
                    out.push(str.substr(splitEnd + 1, previousSplit - (splitEnd + 1)));
                    previousSplit = i;
                    separatorIndex = 0;
                    splitEnd = undefined;
                }

                if (out.length === maxsplit) break;
            }

            if (out.length < maxsplit + 1) {
                out.push(str.substr(0, previousSplit))
            }
        }

        out.reverse();
        return out;
    }

    export function py_string_split(str: string, sep?: string, maxsplit?: number): string[] {
        nullCheck(str);

        if (sep === "") {
            throw VALUE_ERROR;
        }

        if (maxsplit === 0) return [str]
        if (!maxsplit || maxsplit < 0) maxsplit = str.length;

        const out: string[] = [];

        let currentChar: string;
        let splitStart: number;
        let previousSplit = 0;

        if (!sep) {
            for (let i = 0; i < str.length; i++) {
                currentChar = str.charAt(i);
                if (isWhitespace(currentChar)) {
                    if (splitStart === undefined) splitStart = i;
                }
                else if (splitStart !== undefined) {
                    if (previousSplit !== splitStart) out.push(str.substr(previousSplit, splitStart - previousSplit));
                    previousSplit = i;
                    splitStart = undefined;

                }

                if (out.length === maxsplit) break;
            }

            if (out.length < maxsplit + 1) {
                if (splitStart !== undefined) {
                    if (previousSplit !== splitStart)
                        out.push(str.substr(previousSplit, splitStart - previousSplit));
                }
                else {
                    out.push(str.substr(previousSplit))
                }
            }
        }
        else {
            let separatorIndex = 0;
            for (let i = 0; i < str.length; i++) {
                currentChar = str.charAt(i);
                if (currentChar === sep.charAt(separatorIndex)) {
                    separatorIndex++;
                    if (splitStart === undefined) splitStart = i;
                }
                else {
                    separatorIndex = 0;
                    splitStart = undefined;
                }

                if (separatorIndex === sep.length) {
                    out.push(str.substr(previousSplit, splitStart - previousSplit));
                    previousSplit = i + 1;
                    separatorIndex = 0;
                    splitStart = undefined;
                }

                if (out.length === maxsplit) break;
            }

            if (out.length < maxsplit + 1) {
                out.push(str.substr(previousSplit))
            }
        }

        return out;
    }


    function isWhitespace(char: string) {
        // TODO Figure out everything python considers whitespace.
        // the \s character class in JS regexes also includes these: \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff
        return char === " " || char === "\t" || char === "\n" || char === "\v" || char === "\r" || char === "\f";
    }

    export function py_string_splitlines(str: string, keepends?: boolean): string[] {
        nullCheck(str);
        return [];
    }

    export function py_string_startswith(str: string, prefix: string, start?: number, end?: number): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_rstrip(str: string, chars?: string): string {
        nullCheck(str);

        for (let i = str.length - 1; i >= 0; i--) {
            if (chars != undefined) {
                if (chars.indexOf(str.charAt(i)) === -1) {
                    return str.substr(0, i + 1);
                }
            }
            else if (!isWhitespace(str.charAt(i))) {
                return str.substr(0, i + 1);
            }
        }

        return "";
    }

    export function py_string_lstrip(str: string, chars?: string): string {
        nullCheck(str);

        for (let i = 0; i < str.length; i++) {
            if (chars != undefined) {
                if (chars.indexOf(str.charAt(i)) === -1) {
                    return str.substr(i);
                }
            }
            else if (!isWhitespace(str.charAt(i))) {
                return str.substr(i);
            }
        }

        return "";
    }

    export function py_string_strip(str: string, chars?: string): string {
        return py_string_rstrip(py_string_lstrip(str, chars), chars);
    }

    export function py_string_swapcase(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_title(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_upper(str: string): string {
        nullCheck(str);
        return str;
    }

    export function py_string_zfill(str: string, width: number): string {
        nullCheck(str);
        return str;
    }

    export function py_array_pop(arr: any[], index?: number): any {
        nullCheck(arr);

        if (arr.length === 0) {
            throw INDEX_ERROR;
        }

        if (index == undefined) {
            return arr.pop();
        }
        else if (index > 0 && index < arr.length) {
            return arr.removeAt(index | 0);
        }

        throw INDEX_ERROR;
    }

    export function py_array_clear(arr: any[]): void {
        nullCheck(arr);

        arr.length = 0;
    }

    export function py_array_index(arr: any[], value: any, start?: number, end?: number): number {
        nullCheck(arr);

        start = fixIndex(arr, start);
        end = fixIndex(arr, end);

        if (start == null) {
            start = 0;
        }

        if (end == null) {
            // end is exclusive
            end = arr.length;
        }

        for (let i = start; i < end; i++) {
            if (arr[i] === value) {
                return i;
            }
        }

        throw VALUE_ERROR;
    }

    export function py_array_count(arr: any[], value: any): number {
        nullCheck(arr);

        let count = 0;

        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === value) count++;
        }

        return count;
    }

    function nullCheck(arg: any) {
        if (arg == null) {
            throw ATTRIBUTE_ERROR;
        }
    }

    function fixIndex(arr: any[], index: number) {
        if (index != null && arr.length) {
            index = index | 0;
            while (index < 0) index += arr.length;
        }
        return index;
    }

    /**
     * Returns a sequence of numbers up to but not including the limit
     * @param first The value to end the sequence before. This value will not show up in the result.
     *      If more than one argument is passed, this argument is instead used for the first value in the range
     * @param stop  The value to end the sequence before. This value will not show up in the result
     * @param step  The value to increase or decrease by for each step in the range. Must be a nonzero integer
     */
    export function range(first: number, stop?: number, step?: number) {
        if (step === undefined) step = 1
        // step must be a nonzero integer (can be negative)
        if (step === 0 || (step | 0) !== step) {
            throw VALUE_ERROR;
        }

        // If only one argument is given, then start is actually stop
        if (stop === undefined) {
            stop = first;
            first = 0;
        }

        const res: number[] = [];
        if (step > 0 && first >= stop || step < 0 && first <= stop) return res;

        let index = first;

        while (step < 0 ? index > stop : index < stop) {
            res.push(index);
            index += step
        }

        return res;
    }

    function sliceRange(valueLength: number, start?: number, stop?: number, step?: number) {
        if (step == null) step = 1

        // step must be a nonzero integer (can be negative)
        if (step === 0 || (step | 0) !== step) {
            throw _py.VALUE_ERROR;
        }

        if (step < 0) {
            if (start == null) {
                start = valueLength - 1;
            }
            if (stop == null) {
                stop = -1;
            }
        }
        else {
            if (start == null) {
                start = 0;
            }
            if (stop == null) {
                stop = valueLength;
            }
        }

        return range(start, stop, step)
    }

    /**
     * Returns a section of an array according to python's extended slice syntax
     */
    export function slice<U>(value: U[], start?: number, stop?: number, step?: number): U[] {
        if (value == null) {
            throw TYPE_ERROR;
        }
        return sliceRange(value.length, start, stop, step).map(index => value[index]);
    }

    /**
     * Returns a section of a string according to python's extended slice syntax
     */
    export function stringSlice(value: string, start?: number, stop?: number, step?: number): string {
        if (value == null) {
            throw TYPE_ERROR;
        }
        return sliceRange(value.length, start, stop, step).map(index => value.charAt(index)).join("");
    }
}