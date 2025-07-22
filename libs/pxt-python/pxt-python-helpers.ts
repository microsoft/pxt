namespace _py {
    export const ATTRIBUTE_ERROR: string = "AttributeError";
    export const INDEX_ERROR: string = "IndexError";
    export const VALUE_ERROR: string = "ValueError";
    export const TYPE_ERROR: string = "TypeError";

    export function py_string_capitalize(str: string): string {
        nullCheck(str);

        if (str.length === 0) {
            return str;
        }

        return py_string_upper(str.charAt(0)) + py_string_lower(str.slice(1));
    }

    export function py_string_casefold(str: string): string {
        return py_string_lower(str);
    }

    export function py_string_center(str: string, width: number, fillChar?: string): string {
        nullCheck(str);

        let result = str;

        while (result.length < width) {
            result += fillChar || " ";

            if (result.length < width) {
                result = (fillChar || " ") + result;
            }
        }

        return result;
    }

    export function py_string_count(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);

        const indices = sliceIndices(str.length, start, end);
        start = indices[0];
        end = indices[1];

        let count = 0;

        for (let i = start; i < end - sub.length + 1; i++) {
            if (str.charAt(i) === sub.charAt(0)) {
                let found = true;
                for (let j = 1; j < sub.length; j++) {
                    if (str.charAt(i + j) !== sub.charAt(j)) {
                        found = false;
                        break;
                    }
                }

                if (found) {
                    count++;
                    i += sub.length - 1; // Skip ahead to avoid counting overlapping occurrences
                }
            }
        }

        return count;
    }

    export function py_string_endswith(str: string, suffix: string, start?: number, end?: number): boolean {
        nullCheck(str);

        const indices = sliceIndices(str.length, start, end);
        start = indices[0];
        end = indices[1];

        if (end - start < suffix.length) {
            return false;
        }

        for (let i = 0; i < suffix.length; i++) {
            if (str.charAt(end - suffix.length + i) !== suffix.charAt(i)) {
                return false;
            }
        }

        return true;
    }

    export function py_string_find(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);

        const indices = sliceIndices(str.length, start, end);
        start = indices[0];
        end = indices[1];

        if (sub === "") {
            return start;
        }

        for (let i = start; i < end - sub.length + 1; i++) {
            if (str.charAt(i) === sub.charAt(0)) {
                let found = true;
                for (let j = 1; j < sub.length; j++) {
                    if (str.charAt(i + j) !== sub.charAt(j)) {
                        found = false;
                        break;
                    }
                }
                if (found) return i;
            }
        }

        return -1;
    }

    export function py_string_index(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);
        const result = py_string_find(str, sub, start, end);

        if (result === -1) {
            throw VALUE_ERROR;
        }

        return result;
    }

    export function py_string_isalnum(str: string): boolean {
        nullCheck(str);

        if (str.length === 0) {
            return false;
        }

        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (!isUppercase(char) && !isLowercase(char) && !isDigit(char)) {
                return false;
            }
        }
        return true;
    }

    export function py_string_isalpha(str: string): boolean {
        nullCheck(str);

        if (str.length === 0) {
            return false;
        }

        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (!isUppercase(char) && !isLowercase(char)) {
                return false;
            }
        }
        return true;
    }

    export function py_string_isascii(str: string): boolean {
        nullCheck(str);

        for (let i = 0; i < str.length; i++) {
            if (str.charCodeAt(i) > 127) {
                return false;
            }
        }

        return true;
    }

    export function py_string_isdigit(str: string): boolean {
        nullCheck(str);

        if (str.length === 0) {
            return false;
        }

        for (let i = 0; i < str.length; i++) {
            if (!isDigit(str.charAt(i))) {
                return false;
            }
        }

        return true;
    }

    export function py_string_isnumeric(str: string): boolean {
        return py_string_isdigit(str);
    }

    export function py_string_isdecimal(str: string): boolean {
        return py_string_isdigit(str);
    }

    export function py_string_isspace(str: string): boolean {
        nullCheck(str);

        if (str.length === 0) {
            return false;
        }

        for (let i = 0; i < str.length; i++) {
            if (!isWhitespace(str.charAt(i))) {
                return false;
            }
        }

        return true;
    }

    export function py_string_isidentifier(str: string): boolean {
        nullCheck(str);

        if (str.length === 0) {
            return false;
        }

        if (isDigit(str.charAt(0))) {
            return false; // Identifiers cannot start with a digit
        }

        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (!isUppercase(char) && !isLowercase(char) && !isDigit(char) && char !== "_") {
                return false;
            }
        }

        return true;
    }

    export function py_string_islower(str: string): boolean {
        nullCheck(str);

        // python considers a string to be lowercase if it contains at least one
        // lowercase letter and no uppercase letters
        let foundLowercase = false;
        for (let i = 0; i < str.length; i++) {
            if (isUppercase(str.charAt(i))) {
                return false;
            }
            if (isLowercase(str.charAt(i))) {
                foundLowercase = true;
            }
        }

        return foundLowercase;
    }

    export function py_string_isprintable(str: string): boolean {
        nullCheck(str);
        return false;
    }

    export function py_string_istitle(str: string): boolean {
        nullCheck(str);

        if (str.length === 0) {
            return false;
        }

        // python considers a string to be title case if it contains at least one
        // uppercase letter, all sequences of lowercase letters are preceded by a
        // single uppercase letter, and uppercase letters are not preceded by other
        // uppercase or lowercase letters (but a space or punctuation is allowed)
        let foundUppercase = false
        let inWord = false;
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);

            if (isUppercase(char)) {
                if (inWord) {
                    return false;
                }
                inWord = true;
                foundUppercase = true;
            }
            else if (isLowercase(char)) {
                if (!inWord) {
                    return false;
                }
            }
            else {
                inWord = false;
            }
        }

        return foundUppercase;
    }

    export function py_string_isupper(str: string): boolean {
        nullCheck(str);

        // python considers a string to be uppercase if it contains at least one
        // uppercase letter and no lowercase letters
        let foundUppercase = false;
        for (let i = 0; i < str.length; i++) {
            if (isLowercase(str.charAt(i))) {
                return false;
            }
            if (isUppercase(str.charAt(i))) {
                foundUppercase = true;
            }
        }
        return foundUppercase;
    }

    export function py_string_join(str: string, iterable: any[]): string {
        nullCheck(str);

        let result = "";
        for (let i = 0; i < iterable.length; i++) {
            if (typeof iterable[i] !== "string") {
                throw TYPE_ERROR;
            }

            if (i > 0) {
                result += str;
            }
            result += iterable[i];
        }

        return result;
    }

    export function py_string_ljust(str: string, width: number, fillChar?: string): string {
        nullCheck(str);

        fillChar = fillChar || " ";

        while (str.length < width) {
            str += fillChar;
        }

        return str;
    }

    export function py_string_lower(str: string): string {
        nullCheck(str);

        let result = "";

        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (isUppercase(char)) {
                result += String.fromCharCode(char.charCodeAt(0) + 32);
            }
            else {
                result += char;
            }
        }
        return result;
    }

    export function py_string_rfind(str: string, sub: string, start?: number, end?: number): number {
        nullCheck(str);


        const indices = sliceIndices(str.length, start, end);
        start = indices[0];
        end = indices[1];

        if (sub === "") {
            return end;
        }

        for (let i = end - sub.length; i >= start; i--) {
            if (str.charAt(i) === sub.charAt(0)) {
                let found = true;
                for (let j = 1; j < sub.length; j++) {
                    if (str.charAt(i + j) !== sub.charAt(j)) {
                        found = false;
                        break;
                    }
                }
                if (found) return i;
            }
        }

        return -1;
    }

    export function py_string_rindex(str: string, sub: string, start?: number, end?: number): number {
        const result = py_string_rfind(str, sub, start, end);

        if (result === -1) {
            throw VALUE_ERROR;
        }

        return result;
    }

    export function py_string_rjust(str: string, width: number, fillChar?: string): string {
        nullCheck(str);

        fillChar = fillChar || " ";

        while (str.length < width) {
            str = fillChar + str;
        }

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
        return char === " " || char === "\t" || isLineBreak(char);
    }

    export function py_string_splitlines(str: string, keepends?: boolean): string[] {
        nullCheck(str);

        let result: string[] = [];

        let currentLine: string = "";
        for (let i = 0; i < str.length; i++) {
            const currentChar = str.charAt(i);
            if (currentChar === "\r" && i + 1 < str.length && str.charAt(i + 1) === "\n") {
                if (keepends) {
                    currentLine += "\r\n";
                }
                result.push(currentLine);
                currentLine = "";
                i++; // Skip the next character since it's part of the line break
            }
            else if (isLineBreak(currentChar)) {
                if (keepends) {
                    currentLine += currentChar;
                }
                result.push(currentLine);
                currentLine = "";
            }
        }
        if (currentLine) {
            result.push(currentLine);
        }

        return result;
    }

    export function py_string_startswith(str: string, prefix: string, start?: number, end?: number): boolean {
        nullCheck(str);

        const indices = sliceIndices(str.length, start, end);
        start = indices[0];
        end = indices[1];

        if (end - start < prefix.length) {
            return false;
        }


        for (let i = 0; i < prefix.length; i++) {
            if (str.charAt(start + i) !== prefix.charAt(i)) {
                return false;
            }
        }

        return true;
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

        let result = "";
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (isUppercase(char)) {
                result += py_string_lower(char);
            }
            else if (isLowercase(char)) {
                result += py_string_upper(char);
            }
            else {
                result += char;
            }
        }

        return result;
    }

    export function py_string_title(str: string): string {
        nullCheck(str);

        let result = "";
        let inWord = false;

        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (isUppercase(char)) {
                if (!inWord) {
                    result += char;
                    inWord = true;
                }
                else {
                    result += py_string_lower(char);
                }
            }
            else if (isLowercase(char)) {
                if (!inWord) {
                    result += py_string_upper(char);
                    inWord = true;
                }
                else {
                    result += char;
                }
            }
            else {
                result += char;
                inWord = false;
            }
        }

        return result;
    }

    export function py_string_upper(str: string): string {
        nullCheck(str);

        let result = "";
        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(i);
            if (isLowercase(char)) {
                result += String.fromCharCode(char.charCodeAt(0) - 32);
            }
            else {
                result += char;
            }
        }

        return result;
    }

    export function py_string_zfill(str: string, width: number): string {
        nullCheck(str);

        let padding = "";

        while (padding.length + str.length < width) {
            padding += "0";
        }

        if (str.charAt(0) === "-" || str.charAt(0) === "+") {
            return str.charAt(0) + padding + str.slice(1);
        }

        return padding + str;
    }

    export function py_array_pop(arr: any[], index?: number): any {
        nullCheck(arr);

        if (arr.length === 0) {
            throw INDEX_ERROR;
        }

        if (index == undefined) {
            return arr.pop();
        }
        else if (index >= 0 && index < arr.length) {
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

    function sliceIndices(valueLength: number, start?: number, stop?: number) {
        if (start == null) {
            start = 0;
        }
        if (stop == null) {
            stop = valueLength;
        }

        if (start < 0) {
            start += valueLength;
            if (start < 0) start = 0;
        } else if (start >= valueLength) {
            start = valueLength - 1;
        }

        if (stop < 0) {
            stop += valueLength;
            if (stop < 0) stop = 0;
        } else if (stop >= valueLength) {
            stop = valueLength;
        }

        return [start, stop];
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

    function isLineBreak(char: string): boolean {
        switch (char) {
            case "\n":
            case "\r":
            case "\r\n":
            case "\v":
            case "\x0b":
            case "\f":
            case "\x0c":
            case "\x1c":
            case "\x1d":
            case "\x1e":
            case "\x85":
            case "\u2028":
            case "\u2029":
                return true;
            default:
                return false;
        }
    }

    function isUppercase(char: string): boolean {
        const code = char.charCodeAt(0);
        return code >= 65 && code <= 90;
    }

    function isLowercase(char: string): boolean {
        const code = char.charCodeAt(0);
        return code >= 97 && code <= 122;
    }

    function isDigit(char: string): boolean {
        const code = char.charCodeAt(0);
        return code >= 48 && code <= 57;
    }
}