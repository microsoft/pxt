/// <reference no-default-lib="true"/>

interface Array<T> {
    /**
      * Gets or sets the length of the array. This is a number one higher than the highest element defined in an array.
      */
    //% shim=Array_::length
    length: number;

    /**
      * Appends new elements to an array.
      * @param items New elements of the Array.
      */
    //% shim=Array_::push
    push(item: T): void;
    
    /**
      * Removes the last element from an array and returns it.
      */
    //% helper=arrayPop
    pop(): T;

    /**
      * Reverses the elements in an Array. 
      */
    //% helper=arrayReverse
    reverse(): void;
    
    /**
      * Removes the first element from an array and returns it.
      */
    //% helper=arrayShift
    shift(): T;
    
    /** 
      * Returns a section of an array.
      * @param start The beginning of the specified portion of the array.
      * @param end The end of the specified portion of the array.
      */
    //% helper=arraySlice
    slice(start: number, end: number): T[];

    /** Removes the first occurence of an object. Returns true if removed. */
    //% shim=Array_::removeElement
    removeElement(element:T) : boolean;
    
    /** Removes the object at position index. */
    //% shim=Array_::removeAt
    removeAt(idx:number) : void;
    
    
    /**
      * Removes elements from an array.
      * @param start The zero-based location in the array from which to start removing elements.
      * @param deleteCount The number of elements to remove.
      */
    //% helper=arraySplice
    splice(start: number, deleteCount: number): void;

    /**
      * Inserts new elements at the start of an array.
      * @param items  Elements to insert at the start of the Array.
      */
    //% helper=arrayUnshift
    unshift(item:T): void;

    /**
      * Returns the index of the first occurrence of a value in an array.
      * @param searchElement The value to locate in the array.
      * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
      */
    //% shim=Array_::indexOf
    indexOf(searchElement: T, fromIndex?: number): number;


    [n: number]: T;
}

declare interface String {
    /**
     * Returns the character at the specified index.
     * @param pos The zero-based index of the desired character.
     */
    //% shim=String_::charAt
    charAt(pos: number): string;

    /** 
     * Returns the Unicode value of the character at the specified location.
     * @param index The zero-based index of the desired character. If there is no character at the specified index, NaN is returned.
     */
    //% shim=String_::charCodeAt
    charCodeAt(index: number): number;

    /**
     * Returns a string that contains the concatenation of two or more strings.
     * @param other The string to append to the end of the string.  
     */
    //% shim=String_::concat
    concat(other: string): string;

    /**
     * Determines whether relative order of two strings (in ASCII encoding).
     * @param that String to compare to target string
     */
    //% shim=String_::compare
    compare(that: string): number;

    /** Returns the length of a String object. */
    //% property shim=String_::length
    length: number;

    [index: number]: string;
}



/**
  * Converts A string to an integer.
  * @param s A string to convert into a number.
  */
//% shim=String_::toNumber
declare function parseInt(s: string): number;

interface Object {}
interface Function {}
interface IArguments {}
interface RegExp {}


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
    //% shim=String_::fromCharCode
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
