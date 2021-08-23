/// <reference no-default-lib="true"/>

interface Array<T> {
    /**
      * Get or set the length of an array. This number is one more than the index of the last element the array.
      */
    //% shim=Array_::length weight=84
    //% blockId="lists_length" block="length of %VALUE" blockBuiltin=true blockNamespace="arrays"
    length: number;

    /**
      * Append a new element to an array.
      * @param items New elements of the Array.
      */
    //% help=arrays/push
    //% shim=Array_::push weight=50
    //% blockId="array_push" block="%list| add value %value| to end" blockNamespace="arrays"
    //% group="Modify"
    push(item: T): void;

    /**
      * Concatenates the values with another array.
      * @param arr The other array that is being concatenated with
      */
    //% helper=arrayConcat weight=40
    concat(arr: T[]): T[];

    /**
      * Remove the last element from an array and return it.
      */
    //% help=arrays/pop
    //% shim=Array_::pop weight=45
    //% blockId="array_pop" block="get and remove last value from %list" blockNamespace="arrays"
    //% group="Read"
    pop(): T;

    /**
      * Reverse the elements in an array. The first array element becomes the last, and the last array element becomes the first.
      */
    //% help=arrays/reverse
    //% helper=arrayReverse weight=10
    //% blockId="array_reverse" block="reverse %list" blockNamespace="arrays"
    //% group="Operations"
    reverse(): void;

    /**
      * Remove the first element from an array and return it. This method changes the length of the array.
      */
    //% help=arrays/shift
    //% helper=arrayShift weight=30
    //% blockId="array_shift" block="get and remove first value from %list" blockNamespace="arrays"
    //% group="Read"
    shift(): T;

    /**
      * Add one element to the beginning of an array and return the new length of the array.
      * @param element to insert at the start of the Array.
      */
    //% help=arrays/unshift
    //% helper=arrayUnshift weight=25
    //% blockId="array_unshift" block="%list| insert %value| at beginning" blockNamespace="arrays"
    //% group="Modify"
    //unshift(...values:T[]): number; //rest is not supported in our compiler yet.
    unshift(value: T): number;

    /**
      * Return a section of an array.
      * @param start The beginning of the specified portion of the array. eg: 0
      * @param end The end of the specified portion of the array. eg: 0
      */
    //% help=arrays/slice
    //% helper=arraySlice weight=41 blockNamespace="arrays"
    slice(start?: number, end?: number): T[];

    /**
      * Remove elements from an array.
      * @param start The zero-based location in the array from which to start removing elements. eg: 0
      * @param deleteCount The number of elements to remove. eg: 0
      */
    //% helper=arraySplice weight=40
    splice(start: number, deleteCount: number): void;

    /**
      * joins all elements of an array into a string and returns this string.
      * @param sep the string separator
      */
    //% helper=arrayJoin weight=40
    join(sep?: string): string;

    /**
      * Tests whether at least one element in the array passes the test implemented by the provided function.
      * @param callbackfn A function that accepts up to two arguments. The some method calls the callbackfn function one time for each element in the array.
      */
    //% helper=arraySome weight=40
    some(callbackfn: (value: T, index: number) => boolean): boolean;

    /**
      * Tests whether all elements in the array pass the test implemented by the provided function.
      * @param callbackfn A function that accepts up to two arguments. The every method calls the callbackfn function one time for each element in the array.
      */
    //% helper=arrayEvery weight=40
    every(callbackfn: (value: T, index: number) => boolean): boolean;

    /**
      * Sort the elements of an array in place and returns the array. The sort is not necessarily stable.
      * @param specifies a function that defines the sort order. If omitted, the array is sorted according to the prmitive type
      */
    //% helper=arraySort weight=40
    sort(callbackfn?: (value1: T, value2: T) => number): T[];

    /**
      * Call a defined callback function on each element of an array, and return an array containing the results.
      * @param callbackfn A function that accepts up to two arguments. The map method calls the callbackfn function one time for each element in the array.
      */
    //% helper=arrayMap weight=40
    map<U>(callbackfn: (value: T, index: number) => U): U[];

    /**
      * Call a defined callback function on each element of an array.
      * @param callbackfn A function that accepts up to two arguments. The forEach method calls the callbackfn function one time for each element in the array.
      */
    //% helper=arrayForEach weight=40
    forEach(callbackfn: (value: T, index: number) => void): void;

    /**
      * Return the elements of an array that meet the condition specified in a callback function.
      * @param callbackfn A function that accepts up to two arguments. The filter method calls the callbackfn function one time for each element in the array.
      */
    //% helper=arrayFilter weight=40
    filter(callbackfn: (value: T, index: number) => boolean): T[];

    /**
      * Fills all the elements of an array from a start index to an end index with a static value. The end index is not included.
      */
    //% helper=arrayFill weight=39
    fill(value: T, start?: number, end?: number): T[];

    /**
     * Returns the value of the first element in the array that satisfies the provided testing function. Otherwise undefined is returned.
     * @param callbackfn
     */
    //% helper=arrayFind weight=40
    find(callbackfn: (value: T, index: number) => boolean): T;

    /**
      * Call the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
      * @param callbackfn A function that accepts up to three arguments. The reduce method calls the callbackfn function one time for each element in the array.
      * @param initialValue Initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
      */
    //% helper=arrayReduce weight=40
    reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): U;


    /** Remove the first occurence of an object. Returns true if removed. */
    //% shim=Array_::removeElement weight=48
    removeElement(element: T): boolean;

    /** Remove the element at a certain index. */
    //% help=arrays/remove-at
    //% shim=Array_::removeAt weight=47
    //% blockId="array_removeat" block="%list| get and remove value at %index" blockNamespace="arrays"
    //% group="Read"
    removeAt(index: number): T;

    /**
     * Insert the value at a particular index, increases length by 1
     * @param index the zero-based position in the list to insert the value, eg: 0
     * @param the value to insert, eg: 0
     */
    //% help=arrays/insert-at
    //% shim=Array_::insertAt weight=20
    //% blockId="array_insertAt" block="%list| insert at %index| value %value" blockNamespace="arrays"
    //% group="Modify"
    insertAt(index: number, value: T): void;

    /**
      * Return the index of the first occurrence of a value in an array.
      * @param item The value to locate in the array.
      * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
      */
    //% help=arrays/index-of
    //% shim=Array_::indexOf weight=40
    //% blockId="array_indexof" block="%list| find index of %value" blockNamespace="arrays"
    //% group="Operations"
    indexOf(item: T, fromIndex?: number): number;

    /**
     * Get the value at a particular index
     * @param index the zero-based position in the list of the item, eg: 0
     */
    //% help=arrays/get
    //% shim=Array_::getAt weight=85
    get(index: number): T;

    /**
     * Store a value at a particular index
     * @param index the zero-based position in the list to store the value, eg: 0
     * @param value the value to insert, eg: 0
     */
    //% help=arrays/set
    //% shim=Array_::setAt weight=84
    set(index: number, value: T): void;

    /**
     * Return a random value from the array
     */
    //% help=arrays/pick-random
    //% helper=arrayPickRandom weight=25
    //% blockId="array_pickRandom" block="get random value from %list"
    //% blockNamespace="arrays"
    //% group="Read"
    _pickRandom(): T;

    [n: number]: T;

    /**
      * Add one element to the beginning of an array and return the new length of the array.
      * @param element to insert at the start of the Array.
      */
    //% help=arrays/unshift
    //% helper=arrayUnshift weight=24
    //% blockId="array_unshift_statement" block="%list| insert %value| at beginning" blockNamespace="arrays"
    //% blockAliasFor="Array.unshift"
    //% group="Modify"
    _unshiftStatement(value: T): void;

    /**
      * Remove the last element from an array and return it.
      */
    //% help=arrays/pop
    //% shim=Array_::pop weight=44
    //% blockId="array_pop_statement" block="remove last value from %list" blockNamespace="arrays"
    //% blockAliasFor="Array.pop"
    //% group="Modify"
    _popStatement(): void;

    /**
      * Remove the first element from an array and return it. This method changes the length of the array.
      */
    //% help=arrays/shift
    //% helper=arrayShift weight=29
    //% blockId="array_shift_statement" block="remove first value from %list" blockNamespace="arrays"
    //% blockAliasFor="Array.shift"
    //% group="Modify"
    _shiftStatement(): void;

    /** Remove the element at a certain index. */
    //% help=arrays/remove-at
    //% shim=Array_::removeAt weight=14
    //% blockId="array_removeat_statement" block="%list| remove value at %index" blockNamespace="arrays"
    //% blockAliasFor="Array.removeAt"
    //% group="Modify"
    _removeAtStatement(index: number): void;
}

declare interface String {
    // This block is currently disabled in favor of the built-in Blockly "Create text with" block, which compiles to "" + ""
    // Add % sign back to the block annotation to re-enable
    /**
     * Returns a string that contains the concatenation of two or more strings.
     * @param other The string to append to the end of the string.
     */
    //% shim=String_::concat weight=49
    //% blockId="string_concat" blockNamespace="text"
    // block="join %list=text|%other"
    concat(other: string): string;

    /**
     * Return the character at the specified index.
     * @param index The zero-based index of the desired character.
     */
    //% shim=String_::charAt weight=48
    //% help=text/char-at
    //% blockId="string_get" block="char from %this=text|at %pos" blockNamespace="text"
    charAt(index: number): string;

    /** Returns the length of a String object. */
    //% property shim=String_::length weight=47
    //% blockId="text_length" block="length of %VALUE" blockBuiltin=true blockNamespace="text"
    length: number;

    /**
     * Return the Unicode value of the character at the specified location.
     * @param index The zero-based index of the desired character. If there is no character at the specified index, NaN is returned.
     */
    //% shim=String_::charCodeAt
    charCodeAt(index: number): number;

    /**
     * See how the order of characters in two strings is different (in ASCII encoding).
     * @param that String to compare to target string
     */
    //% shim=String_::compare
    //% help=text/compare
    //% blockId="string_compare" block="compare %this=text| to %that" blockNamespace="text"
    compare(that: string): number;

    /**
     * Return a substring of the current string.
     * @param start first character index; can be negative from counting from the end, eg:0
     * @param length number of characters to extract, eg: 10
     */
    //% helper=stringSubstr
    //% help=text/substr
    //% blockId="string_substr" block="substring of %this=text|from %start|of length %length" blockNamespace="text"
    substr(start: number, length?: number): string;

    /**
     * Return the current string with the first occurence of toReplace
     * replaced with the replacer
     * @param toReplace the substring to replace in the current string
     * @param replacer either the string that replaces toReplace in the current string,
     *                or a function that accepts the substring and returns the replacement string.
     */
    //% helper=stringReplace
    replace(toReplace: string, replacer: string | ((sub: string) => string)): string;

    /**
     * Return the current string with each occurence of toReplace
     * replaced with the replacer
     * @param toReplace the substring to replace in the current string
     * @param replacer either the string that replaces toReplace in the current string,
     *                or a function that accepts the substring and returns the replacement string.
     */
    //% helper=stringReplaceAll
    replaceAll(toReplace: string, replacer: string | ((sub: string) => string)): string;

    /**
     * Return a substring of the current string.
     * @param start first character index; can be negative from counting from the end, eg:0
     * @param end one-past-last character index
     */
    //% helper=stringSlice
    slice(start: number, end?: number): string;

    /** Returns a value indicating if the string is empty */
    //% helper=stringEmpty
    //% help=text/is-empty
    //% blockId="string_isempty" blockNamespace="text"
    //% block="%this=text| is empty"
    isEmpty(): boolean;

    /**
     * Returns the position of the first occurrence of a specified value in a string.
     * @param searchValue the text to find
     * @param start optional start index for the search
     */
    //% shim=String_::indexOf
    //% help=text/index-of
    //% blockId="string_indexof" blockNamespace="text"
    //% block="%this=text|find index of %searchValue"
    indexOf(searchValue: string, start?: number): number;

    /**
     * Determines whether a string contains the characters of a specified string.
     * @param searchValue the text to find
     * @param start optional start index for the search
     */
    //% shim=String_::includes
    //% help=text/includes
    //% blockId="string_includes" blockNamespace="text"
    //% block="%this=text|includes %searchValue"
    includes(searchValue: string, start?: number): boolean;

    /**
     * Splits the string according to the separators
     * @param separator
     * @param limit
     */
    //% helper=stringSplit
    //% help=text/split
    //% blockId="string_split" blockNamespace="text"
    //% block="split %this=text|at %separator"
    split(separator?: string, limit?: number): string[];

    /**
     * Return a substring of the current string with whitespace removed from both ends
     */
    //% helper=stringTrim
    trim(): string;

    /**
     * Converts the string to upper case characters.
     */
    //% helper=stringToUpperCase
    //% help=text/to-upper-case
    toUpperCase(): string;

    /**
     * Converts the string to lower case characters.
     */
    //% helper=stringToLowerCase
    //% help=text/to-lower-case
    toLowerCase(): string;

    [index: number]: string;
}

/**
  * Convert a string to a number.
  * @param s A string to convert into a number. eg: 123
  */
//% shim=String_::toNumber
//% help=text/parse-float
//% blockId="string_parsefloat" block="parse to number %text" blockNamespace="text"
//% text.defl="123"
declare function parseFloat(text: string): number;

/**
 * Returns a pseudorandom number between min and max included.
 * If both numbers are integral, the result is integral.
 * @param min the lower inclusive bound, eg: 0
 * @param max the upper inclusive bound, eg: 10
 */
//% blockId="device_random" block="pick random %min|to %limit"
//% blockNamespace="Math"
//% help=math/randint
//% shim=Math_::randomRange
declare function randint(min: number, max: number): number;

interface Object { }
interface Function {
  __assignableToFunction: Function;
}
interface IArguments {
  __assignableToIArguments: IArguments;
}
interface RegExp {
  __assignableToRegExp: RegExp;
}
type TemplateStringsArray = Array<string>;

type uint8 = number;
type uint16 = number;
type uint32 = number;
type int8 = number;
type int16 = number;
type int32 = number;


declare interface Boolean {
    /**
     * Returns a string representation of an object.
     */
    //% shim=numops::toString
    toString(): string;
}

/**
 * Combine, split, and search text strings.
*/
//% blockNamespace="text"
declare namespace String {

    /**
     * Make a string from the given ASCII character code.
     */
    //% help=math/from-char-code
    //% shim=String_::fromCharCode weight=1
    //% blockNamespace="text" blockId="stringFromCharCode" block="text from char code %code"
    function fromCharCode(code: number): string;
}

declare interface Number {
    /**
     * Returns a string representation of a number.
     */
    //% shim=numops::toString
    toString(): string;
}

/**
 * Add, remove, and replace items in lists.
*/
//% blockNamespace="Arrays"
declare namespace Array {
    /**
     * Check if a given object is an array.
     */
    //% shim=Array_::isArray
    function isArray(obj: any): boolean;
}

declare namespace Object {
    /**
     * Return the field names in an object.
     */
    //% shim=pxtrt::keysOf
    function keys(obj: any): string[];
}

/**
 * More complex operations with numbers.
*/
declare namespace Math {
    /**
     * Returns the value of a base expression taken to a specified power.
     * @param x The base value of the expression.
     * @param y The exponent value of the expression.
     */
    //% shim=Math_::pow
    function pow(x: number, y: number): number;

    /**
     * Returns a pseudorandom number between 0 and 1.
     */
    //% shim=Math_::random
    //% help=math/random
    function random(): number;

    /**
     * Returns a pseudorandom number between min and max included.
     * If both numbers are integral, the result is integral.
     * @param min the lower inclusive bound, eg: 0
     * @param max the upper inclusive bound, eg: 10
     */
    //% blockId="device_random_deprecated" block="pick random %min|to %limit"
    //% help=math/random-range deprecated
    //% shim=Math_::randomRange
    function randomRange(min: number, max: number): number;

    /**
     * Returns the natural logarithm (base e) of a number.
     * @param x A number
     */
    //% shim=Math_::log
    //% help=math
    function log(x: number): number;

    /**
     * Returns returns ``e^x``.
     * @param x A number
     */
    //% shim=Math_::exp
    //% help=math
    function exp(x: number): number;

    /**
     * Returns the sine of a number.
     * @param x An angle in radians
     */
    //% shim=Math_::sin
    //% help=math/trigonometry
    function sin(x: number): number;

    /**
     * Returns the cosine of a number.
     * @param x An angle in radians
     */
    //% shim=Math_::cos
    //% help=math/trigonometry
    function cos(x: number): number;

    /**
     * Returns the tangent of a number.
     * @param x An angle in radians
     */
    //% shim=Math_::tan
    //% help=math/trigonometry
    function tan(x: number): number;

    /**
     * Returns the arcsine (in radians) of a number
     * @param x A number
     */
    //% shim=Math_::asin
    //% help=math/trigonometry
    function asin(x: number): number;

    /**
     * Returns the arccosine (in radians) of a number
     * @param x A number
     */
    //% shim=Math_::acos
    //% help=math/trigonometry
    function acos(x: number): number;

    /**
     * Returns the arctangent (in radians) of a number
     * @param x A number
     */
    //% shim=Math_::atan
    //% help=math/trigonometry
    function atan(x: number): number;

    /**
     * Returns the arctangent of the quotient of its arguments.
     * @param y A number
     * @param x A number
     */
    //% shim=Math_::atan2
    //% help=math/trigonometry
    function atan2(y: number, x: number): number;

    /**
     * Returns the square root of a number.
     * @param x A numeric expression.
     */
    //% shim=Math_::sqrt
    //% help=math
    function sqrt(x: number): number;

    /**
     * Returns the smallest number greater than or equal to its numeric argument.
     * @param x A numeric expression.
     */
    //% shim=Math_::ceil
      //% help=math
    function ceil(x: number): number;

    /**
      * Returns the greatest number less than or equal to its numeric argument.
      * @param x A numeric expression.
      */
    //% shim=Math_::floor
      //% help=math
    function floor(x: number): number;

    /**
      * Returns the number with the decimal part truncated.
      * @param x A numeric expression.
      */
    //% shim=Math_::trunc
    //% help=math
    function trunc(x: number): number;

    /**
      * Returns a supplied numeric expression rounded to the nearest number.
      * @param x The value to be rounded to the nearest number.
      */
    //% shim=Math_::round
    //% help=math
    function round(x: number): number;

    /**
     * Returns the value of integer signed 32 bit multiplication of two numbers.
     * @param x The first number
     * @param y The second number
     */
    //% shim=Math_::imul
    //% help=math
    function imul(x: number, y: number): number;

    /**
     * Returns the value of integer signed 32 bit division of two numbers.
     * @param x The first number
     * @param y The second number
     */
    //% shim=Math_::idiv
    //% help=math
    function idiv(x: number, y: number): number;
}

declare namespace control {
    //% shim=_control::_onCodeStart
    export function _onCodeStart(arg: any): void;

    //% shim=_control::_onCodeStop
    export function _onCodeStop(arg: any): void;
}