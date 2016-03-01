/// <reference no-default-lib="true"/>

interface Array<T> {
    /**
      * Gets or sets the length of the array. This is a number one higher than the highest element defined in an array.
      */
    //% shim=collection::count
    length: number;

    /**
      * Appends new elements to an array.
      * @param items New elements of the Array.
      */
    //% shim=collection::add
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
    //% shim=collection::remove
    removeElement(element:T) : boolean;
    
    /** Removes the object at position index. */
    //% shim=collection::remove_at
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
    //% shim=collection::index_of
    indexOf(searchElement: T, fromIndex?: number): number;


    [n: number]: T;
}


interface String {

    /**
      * Returns the character at the specified index.
      * @param pos The zero-based index of the desired character.
      */
    //% shim=string::at
    charAt(pos: number): string;

    /** 
      * Returns the Unicode value of the character at the specified location.
      * @param index The zero-based index of the desired character. If there is no character at the specified index, NaN is returned.
      */
    //% shim=string::code_at
    charCodeAt(index: number): number;

    /**
      * Returns a string that contains the concatenation of two or more strings.
      * @param strings The strings to append to the end of the string.  
      */
    //% shim=string::concat
    concat(other: string): string;

    /**
      * Returns the position of the first occurrence of a substring. 
      * @param searchString The substring to search for in the string
      * @param position The index at which to begin searching the String object. If omitted, search starts at the beginning of the string.
      */
    indexOf(searchString: string, position?: number): number;

    /**
      * Returns the last occurrence of a substring in the string.
      * @param searchString The substring to search for.
      * @param position The index at which to begin searching. If omitted, the search begins at the end of the string.
      */
    lastIndexOf(searchString: string, position?: number): number;

    /**
      * Determines whether two strings are equivalent in the current locale.
      * @param that String to compare to target string
      */
    localeCompare(that: string): number;

    /**
      * Returns a section of a string.
      * @param start The index to the beginning of the specified portion of stringObj. 
      * @param end The index to the end of the specified portion of stringObj. The substring includes the characters up to, but not including, the character indicated by end. 
      * If this value is not specified, the substring continues to the end of stringObj.
      */
    slice(start?: number, end?: number): string;

    /**
      * Returns the substring at the specified location within a String object. 
      * @param start The zero-based index number indicating the beginning of the substring.
      * @param end Zero-based index number indicating the end of the substring. The substring includes the characters up to, but not including, the character indicated by end.
      * If end is omitted, the characters from start through the end of the original string are returned.
      */
    substring(start: number, end?: number): string;

    /** Converts all the alphabetic characters in a string to lowercase. */
    toLowerCase(): string;

    /** Converts all the alphabetic characters in a string to uppercase. */
    toUpperCase(): string;

    /** Returns the length of a String object. */
    //% shim=string::count
    length: number;

    //% shim=string::at
    [index: number]: string;
}


/**
  * Converts A string to an integer.
  * @param s A string to convert into a number.
  */
  //% shim=string::to_number
declare function parseInt(s: string): number;

interface Object {}
interface Function {}
interface IArguments {}
interface RegExp {}

interface Boolean {
    /**
      * Returns a string representation of an object.
      */
    //% shim=boolean::to_string
    toString(): string;
}

declare namespace String {
    /**
      * Make a string from the given ASCII character code. 
      */
    //% shim=number::to_character
    export function fromCharCode(code:number): string;
}

interface Number {
    /**
      * Returns a string representation of an object.
      */
    //% shim=number::to_string
    toString(): string;
}

declare namespace Math {
    /**
      * Returns the absolute value of a number (the value without regard to whether it is positive or negative). 
      * For example, the absolute value of -5 is the same as the absolute value of 5.
      * @param x A numeric expression for which the absolute value is needed.
      */
    //% shim=math::abs
    export function abs(x: number): number;
    
    /**
      * Returns the sign of the x, indicating whether x is positive, negative or zero.
      * @param x The numeric expression to test
      */
    //% shim=math::sign
    export function sign(x: number): number;
    
    /**
      * Returns the larger of two supplied numeric expressions. 
      */
    //% shim=math::max
    export function max(a:number, b:number): number;
    
    /**
      * Returns the smaller of two supplied numeric expressions. 
      */
    //% shim=math::min
    export function min(a:number, b:number): number;
    
    /**
      * Returns the value of a base expression taken to a specified power. 
      * @param x The base value of the expression.
      * @param y The exponent value of the expression.
      */
    //% shim=math::pow
    export function pow(x: number, y: number): number;
    
    /** Returns a pseudorandom number between 0 and `max`. */
    //% shim=math::random
    export function random(max:number): number;
    
    /**
      * Returns the square root of a number.
      * @param x A numeric expression.
      */
    //% shim=math::sqrt
    export function sqrt(x: number): number;
}
