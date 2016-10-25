/// <reference no-default-lib="true"/>

interface Array<T> {
    /**
      * Gets or sets the length of the array. This is a number one higher than the highest element defined in an array.
      */
    //% shim=Array_::length weight=84
    //% blockId="lists_length" block="length of %VALUE" blockBuiltin=true blockNamespace="lists"
    length: number;

    /**
      * Appends new elements to an array.
      * @param items New elements of the Array.
      */
    //% shim=Array_::push weight=75
    //% blockId="array_push" block="push into %this|with last item %item" blockNamespace="lists"
    push(item: T): void;

    /**
      * Removes the last element from an array and returns it.
      */
    //% helper=arrayPop weight=74
    //% blockId="array_pop" block="pop last item from %this" blockNamespace="lists"
    pop(): T;

    /**
      * Reverses the elements in an Array.
      */
    //% helper=arrayReverse weight=10
    //% blockId="array_reverse" block="reverse %this" blockNamespace="lists"
    reverse(): void;

    /**
      * Removes the first element from an array and returns it.
      */
    //% helper=arrayShift weight=70
    //% blockId="array_shift" block="shift first item from %this" blockNamespace="lists"
    shift(): T;

    /**
      * Inserts new elements at the start of an array.
      * @param items  Elements to insert at the start of the Array.
      */
    //% helper=arrayUnshift weight=69
    //% blockId="array_unshift" block="unshift into %this|with first item %item" blockNamespace="lists"
    unshift(item:T): void;

    /**
      * Returns a section of an array.
      * @param start The beginning of the specified portion of the array. eg: 0
      * @param end The end of the specified portion of the array. eg: 0
      */
    //% helper=arraySlice weight=41
    //% blockId="array_slice" block="slice %this|from %start|to %end" blockNamespace="lists"
    slice(start: number, end: number): T[];

    /**
      * Removes elements from an array.
      * @param start The zero-based location in the array from which to start removing elements. eg: 0
      * @param deleteCount The number of elements to remove. eg: 0
      */
    //% helper=arraySplice weight=40
    splice(start: number, deleteCount: number): void;

    /**
      * Calls a defined callback function on each element of an array, and returns an array that contains the results.
      * @param callbackfn A function that accepts up to two arguments. The map method calls the callbackfn function one time for each element in the array.
      */
    //% helper=arrayMap weight=40
    map<U>(callbackfn: (value: T, index: number) => U): U[];

    /**
      * Returns the elements of an array that meet the condition specified in a callback function.
      * @param callbackfn A function that accepts up to two arguments. The filter method calls the callbackfn function one time for each element in the array.
      */
    //% helper=arrayFilter weight=40
    filter(callbackfn: (value: T, index: number) => boolean): T[];

    /**
      * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
      * @param callbackfn A function that accepts up to three arguments. The reduce method calls the callbackfn function one time for each element in the array.
      * @param initialValue Initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
      */
    //% helper=arrayReduce weight=40
    reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number) => U, initialValue: U): U;


    /** Removes the first occurence of an object. Returns true if removed. */
    //% shim=Array_::removeElement weight=48
    removeElement(element:T) : boolean;

    /** Removes the object at position index. */
    //% shim=Array_::removeAt weight=49
    //% blockId="array_removeat" block="remove from %this|at %index" blockNamespace="lists"
    removeAt(index:number) : void;

    /**
      * Returns the index of the first occurrence of a value in an array.
      * @param item The value to locate in the array.
      * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
      */
    //% shim=Array_::indexOf weight=50
    //% blockId="array_indexof" block="index in %this|of %item" blockNamespace="lists"
    indexOf(item: T, fromIndex?: number): number;

    /**
     * Gets the value at a particular index
     * @param index the zero-based position in the list of the item, eg: 0
     */
    //% shim=Array_::getAt weight=85
    //% blockId="array_get" block="get from %this|at %index" blockNamespace="lists"
    get(index: number): T;

    /**
     * Stores the value at a particular index
     * @param index the zero-based position in the list to store the value, eg: 0
     * @param the value to insert, eg: 0
     */
    //% shim=Array_::setAt weight=84
    //% blockId="array_set" block="set in %this|at %index|with value %value" blockNamespace="lists"
    set(index: number, value : T) : void;

    [n: number]: T;
}

declare interface String {
    /**
     * Returns a string that contains the concatenation of two or more strings.
     * @param other The string to append to the end of the string.
     */
    //% shim=String_::concat weight=80
    //% blockId="string_concat" block="join %this|%other" blockNamespace="text"
    concat(other: string): string;

    /**
     * Returns the character at the specified index.
     * @param index The zero-based index of the desired character.
     */
    //% shim=String_::charAt weight=77
    //% blockId="string_get" block="char from %this|at %pos" blockNamespace="text"
    charAt(index: number): string;

    /** Returns the length of a String object. */
    //% property shim=String_::length weight=75
    //% blockId="text_length" block="length of %VALUE" blockBuiltin=true blockNamespace="text"
    length: number;

    /**
     * Returns the Unicode value of the character at the specified location.
     * @param index The zero-based index of the desired character. If there is no character at the specified index, NaN is returned.
     */
    //% shim=String_::charCodeAt
    charCodeAt(index: number): number;

    /**
     * Determines whether relative order of two strings (in ASCII encoding).
     * @param that String to compare to target string
     */
    //% shim=String_::compare
    //% blockId="string_compare" block="compare %this| to %that" blockNamespace="text"
    compare(that: string): number;

    /**
     * Return substring of the current string.
     * @param start first character index; can be negative from counting from the end, eg:0
     * @param length number of characters to extract
     */
    //% shim=String_::substr length.defl=1000000
    //% blockId="string_substr" block="substring of %this|from %start|of length %length" blockNamespace="text"
    substr(start:number, length?:number): string;

    /** Returns a value indicating if the string is empty */
    //% shim=String_::isEmpty
    //% blockId="string_isempty" block="%this| is empty" blockNamespace="text"
    isEmpty() : boolean;

    [index: number]: string;
}

/**
  * Converts A string to an integer.
  * @param s A string to convert into a number.
  */
//% shim=String_::toNumber
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

declare namespace String {

    /**
     * Make a string from the given ASCII character code.
     */
    //% help=math/string-from-char-code
    //% shim=String_::fromCharCode
    //% advanced=true
    //% blockNamespace="Math" blockId="stringFromCharCode" block="text from char code %code" weight=1 color=230
    function fromCharCode(code: number): string;
}


declare interface Number {
    /**
     * Returns a string representation of a number.
     */
    //% shim=Number_::toString
    toString(): string;
}

declare namespace Math {

    /**
     * Returns the value of a base expression taken to a specified power.
     * @param x The base value of the expression.
     * @param y The exponent value of the expression.
     */
    //% shim=Math_::pow
    function pow(x: number, y: number): number;

    /**
     * Returns a pseudorandom number between 0 and `max`.
     */
    //% shim=Math_::random
    function random(max: number): number;

    /**
     * Returns the square root of a number.
     * @param x A numeric expression.
     */
    //% shim=Math_::sqrt
    function sqrt(x: number): number;
}
