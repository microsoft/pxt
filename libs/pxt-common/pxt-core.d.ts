/// <reference no-default-lib="true"/>

interface Array<T> {
    /**
      * Gets or sets the length of the array. This is a number one higher than the highest element defined in an array.
      */
    //% shim=Array_::length weight=84
    //% blockId="lists_length" block="length of %VALUE" blockBuiltin=true blockNamespace="arrays"
    length: number;

    /**
      * Append a new elements to an array.
      * @param item to append to the Array.
      */
    //% help=arrays/push
    //% shim=Array_::push weight=75
    //% blockId="array_push" block="%list| add value %value| to end" blockNamespace="arrays"
    push(item: T): void;

    /**
      * Remove the last element from an array and return it.
      */
    //% help=arrays/pop
    //% shim=Array_::pop weight=74
    //% blockId="array_pop" block="get and remove last value from %list" blockNamespace="arrays"
    pop(): T;

    /**
      * Reverse the elements in an array. The first array element becomes the last, and the last array element becomes the first.
      */
    //% help=arrays/reverse
    //% helper=arrayReverse weight=10 advanced=true
    //% blockId="array_reverse" block="reverse %list" blockNamespace="arrays"
    reverse(): void;

    /**
      * Remove the first element from an array and return it. This method changes the length of the array.
      */
    //% help=arrays/shift
    //% helper=arrayShift weight=70 advanced=true
    //% blockId="array_shift" block="get and remove first value from %list" blockNamespace="arrays"
    shift(): T;

    /**
      * Add one element to the beginning of an array and return the new length of the array.
      * @param value to insert at the start of the Array.
      */
    //% help=arrays/unshift
    //% helper=arrayUnshift weight=69 advanced=true
    //% blockId="array_unshift" block="%list| insert %value| at beginning" blockNamespace="arrays"
    //unshift(...values:T[]): number; //rest is not supported in our compiler yet.
    unshift(value:T): number;

    /**
      * Return a section of an array.
      * @param start The beginning of the specified portion of the array. eg: 0
      * @param end The end of the specified portion of the array. eg: 0
      */
    //% help=arrays/slice
    //% helper=arraySlice weight=41 advanced=true blockNamespace="arrays"
    slice(start: number, end: number): T[];

    /**
      * Remove elements from an array.
      * @param start The zero-based location in the array from which to start removing elements. eg: 0
      * @param deleteCount The number of elements to remove. eg: 0
      */
    //% helper=arraySplice weight=40
    splice(start: number, deleteCount: number): void;

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
      * Return the elements of an array that meet the condition specified in a callback function.
      * @param callbackfn A function that accepts up to two arguments. The filter method calls the callbackfn function one time for each element in the array.
      */
    //% helper=arrayFilter weight=40
    filter(callbackfn: (value: T, index: number) => boolean): T[];

    /**
      * Call the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
      * @param callbackfn A function that accepts up to three arguments. The reduce method calls the callbackfn function one time for each element in the array.
      * @param initialValue Initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
      */
    //% helper=arrayReduce weight=40
    reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): U;


    /**
     * Remove the first occurence of an object. Return true if removed.
     */
    //% shim=Array_::removeElement weight=48
    removeElement(element:T) : boolean;

    /** 
     * Remove the element at a certain index.
     * @param index the zero-based position in the list to remove the value from, eg: 0
     */
    //% help=arrays/remove-at
    //% shim=Array_::removeAt weight=49 advanced=true
    //% blockId="array_removeat" block="%list| remove value at %index" blockNamespace="arrays"
    removeAt(index:number) : T;

    /**
     * Insert the value at a particular index, increase the array length by 1.
     * @param index the zero-based position in the list to insert the value, eg: 0
     * @param value to insert, eg: 0
     */
    //% help=arrays/insert-at
    //% shim=Array_::insertAt weight=84 advanced=true
    //% blockId="array_insertAt" block="%list| insert at %index| value %value" blockNamespace="arrays"
    insertAt(index:number, value: T) : void;

    /**
      * Return the index of the first occurrence of a value in an array.
      * @param item The value to locate in the array.
      * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
      */
    //% help=arrays/index-of
    //% shim=Array_::indexOf weight=50 advanced=true
    //% blockId="array_indexof" block="%list| find index of %value" blockNamespace="arrays"
    indexOf(item: T, fromIndex?: number): number;

    /**
     * Get the value at a particular index.
     * @param index the zero-based position in the list of the item, eg: 0
     */
    //% help=arrays/get
    //% shim=Array_::getAt weight=85
    get(index: number): T;

    /**
     * Store a value at a particular index.
     * @param index the zero-based position in the list to store the value, eg: 0
     * @param the value to insert, eg: 0
     */
    //% help=arrays/set
    //% shim=Array_::setAt weight=84
    set(index: number, value : T) : void;

    [n: number]: T;
}

declare interface String {
    // This block is currently disabled in favor of the built-in Blockly "Create text with" block, which compiles to "" + ""
    // Add % sign back to the block annotation to re-enable
    /**
     * Returns a string that contains the concatenation of two or more strings.
     * @param other The string to append to the end of the string, eg: "add me!"
     */
    //% shim=String_::concat weight=80
    //% blockId="string_concat" blockNamespace="text"
    // block="join %list=text|%other"
    concat(other: string): string;

    /**
     * Return the character at the specified index.
     * @param index The zero-based index of the desired character, eg: 0
     */
    //% shim=String_::charAt weight=77
    //% help=text/char-at
    //% blockId="string_get" block="char from %this=text|at %pos" blockNamespace="text"
    charAt(index: number): string;

    /** Return the length of a String object. */
    //% property shim=String_::length weight=75
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
     * @param start first character index; can be negative from counting from the end, eg: 0
     * @param length number of characters to extract, eg: 3
     */
    //% shim=String_::substr length.defl=1000000
    //% help=text/substr
    //% blockId="string_substr" block="substring of %this=text|from %start|of length %length" blockNamespace="text"
    substr(start: number, length?: number): string;

    // This block is currently disabled, as it does not compile in some targets
    // Add % sign back to the block annotation to re-enable
    /** Returns a value indicating if the string is empty */
    //% shim=String_::isEmpty
    //% blockId="string_isempty" blockNamespace="text"
    // block="%this=text| is empty"
    isEmpty(): boolean;


    [index: number]: string;
}

/**
  * Convert A string to an integer.
  * @param s A string to convert into a number.
  */
//% shim=String_::toNumber
//% help=text/parse-int
//% blockId="string_parseint" block="parse to integer %text" blockNamespace="text"
declare function parseInt(text: string): number;

interface Object {}
interface Function {}
interface IArguments {}
interface RegExp {}

type uint8 = number;
type uint16 = number;
//type uint32 = number;
type int8 = number;
type int16 = number;
type int32 = number;


declare interface Boolean {
    /**
     * Returns a string representation of an object.
     */
    //% shim=Boolean_::toString
    toString(): string;
}

/**
 * Combine, split, and search text strings.
 */
//% blockNamespace="Text"
declare namespace String {

    /**
     * Make a string from the given ASCII character code.
     */
    //% help=math/from-char-code
    //% shim=String_::fromCharCode
    //% advanced=true
    //% blockNamespace="Math" blockId="stringFromCharCode" block="text from char code %code" weight=1
    function fromCharCode(code: number): string;
}


declare interface Number {
    /**
     * Return a string representation of a number.
     */
    //% shim=Number_::toString
    toString(): string;
}

/**
 * Add, remove, and replace items in lists.
 */
//% blockNamespace="Arrays"
declare namespace Array {
}

/**
 * More complex operations with numbers.
 */
declare namespace Math {

    /**
     * Return the value of a base expression taken to a specified power.
     * @param x The base value of the expression.
     * @param y The exponent value of the expression.
     */
    //% shim=Math_::pow
    function pow(x: number, y: number): number;

    /**
     * Return a pseudorandom number between 0 and `limit`.
     * @param limit the upper bound of the number generated, eg: 4.
     */
    //% blockId="device_random" block="pick random 0 to %limit" blockGap=8
    //% help=math/random
    //% shim=Math_::random
    function random(limit: number): number;

    /**
     * Return the square root of a number.
     * @param x A numeric expression.
     */
    //% shim=Math_::sqrt
    function sqrt(x: number): number;

}
