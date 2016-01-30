/// <reference no-default-lib="true"/>

interface Array<T> {
    /**
      * Gets or sets the length of the array. This is a number one higher than the highest element defined in an array.
      */
    // {shim:collection::count}
    length: number;

    /**
      * Appends new elements to an array.
      * @param items New elements of the Array.
      */
    // {shim:collection::add}
    push(item: T): void;
    
    /**
      * Removes the last element from an array and returns it.
      */
    // {helper:arrayPop}
    pop(): T;

    /**
      * Reverses the elements in an Array. 
      */
    // {helper:arrayReverse}
    reverse(): void;
    
    /**
      * Removes the first element from an array and returns it.
      */
    // {helper:arrayShift}
    shift(): T;
    
    /** 
      * Returns a section of an array.
      * @param start The beginning of the specified portion of the array.
      * @param end The end of the specified portion of the array.
      */
    // {helper:arraySlice}
    slice(start: number, end: number): T[];

    /** Removes the first occurence of an object. Returns true if removed. */
    // {shim:collection::remove}
    removeElement(element:T) : boolean;
    
    /** Removes the object at position index. */
    // {shim:collection::remove_at}
    removeAt(idx:number) : void;
    
    
    /**
      * Removes elements from an array.
      * @param start The zero-based location in the array from which to start removing elements.
      * @param deleteCount The number of elements to remove.
      */
    // {helper:arraySplice}
    splice(start: number, deleteCount: number): void;

    /**
      * Inserts new elements at the start of an array.
      * @param items  Elements to insert at the start of the Array.
      */
    // {helper:arrayUnshift}
    unshift(item:T): void;

    /**
      * Returns the index of the first occurrence of a value in an array.
      * @param searchElement The value to locate in the array.
      * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
      */
    // {shim:collection::index_of}
    indexOf(searchElement: T, fromIndex?: number): number;


    [n: number]: T;
}

interface ArrayConstructor {
    new (arrayLength?: number): any[];
    new <T>(arrayLength: number): T[];
    isArray(arg: any): arg is Array<any>;
    prototype: Array<any>;
}

declare var Array: ArrayConstructor;


interface PropertyDescriptor {
    configurable?: boolean;
    enumerable?: boolean;
    value?: any;
    writable?: boolean;
    get? (): any;
    set? (v: any): void;
}

interface PropertyDescriptorMap {
    [s: string]: PropertyDescriptor;
}

interface Object {
    /** The initial value of Object.prototype.constructor is the standard built-in Object constructor. */
    constructor: Function;
}

interface ObjectConstructor {
    new (value?: any): Object;

    /** A reference to the prototype for a class of objects. */
    prototype: Object;

}

/**
  * Provides functionality common to all JavaScript objects.
  */
declare var Object: ObjectConstructor;

/**
  * Creates a new function.
  */
interface Function {
    /**
      * Calls the function, substituting the specified object for the this value of the function, and the specified array for the arguments of the function.
      * @param thisArg The object to be used as the this object.
      * @param argArray A set of arguments to be passed to the function.
      */
    apply(thisArg: any, argArray?: any): any;

    /**
      * Calls a method of an object, substituting another object for the current object.
      * @param thisArg The object to be used as the current object.
      * @param argArray A list of arguments to be passed to the method.
      */
    call(thisArg: any, ...argArray: any[]): any;

    /**
      * For a given function, creates a bound function that has the same body as the original function. 
      * The this object of the bound function is associated with the specified object, and has the specified initial parameters.
      * @param thisArg An object to which the this keyword can refer inside the new function.
      * @param argArray A list of arguments to be passed to the new function.
      */
    bind(thisArg: any, ...argArray: any[]): any;

    prototype: any;
    length: number;

    // Non-standard extensions
    arguments: any;
    caller: Function;
}

interface FunctionConstructor {
    /**
      * Creates a new function.
      * @param args A list of arguments the function accepts.
      */
    new (...args: string[]): Function;
    (...args: string[]): Function;
    prototype: Function;
}

declare var Function: FunctionConstructor;

interface IArguments {
    [index: number]: any;
    length: number;
    callee: Function;
}

interface String {

    /**
      * Returns the character at the specified index.
      * @param pos The zero-based index of the desired character.
      */
    // {shim:string::at}
    charAt(pos: number): string;

    /** 
      * Returns the Unicode value of the character at the specified location.
      * @param index The zero-based index of the desired character. If there is no character at the specified index, NaN is returned.
      */
    // {shim:string::code_at}
    charCodeAt(index: number): number;

    /**
      * Returns a string that contains the concatenation of two or more strings.
      * @param strings The strings to append to the end of the string.  
      */
    // {shim:string::concat}
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

    /** Converts all alphabetic characters to lowercase, taking into account the host environment's current locale. */
    toLocaleLowerCase(): string;

    /** Converts all the alphabetic characters in a string to uppercase. */
    toUpperCase(): string;

    /** Returns a string where all alphabetic characters have been converted to uppercase, taking into account the host environment's current locale. */
    toLocaleUpperCase(): string;

    /** Returns the length of a String object. */
    // {shim:string::count}
    length: number;

    // {shim:string::at}
    [index: number]: string;
}


/**
  * Converts A string to an integer.
  * @param s A string to convert into a number.
  */
  // {shim:string::to_number}
declare function parseInt(s: string): number;


interface StringConstructor {
    new (value?: any): String;
    (value?: any): string;
    prototype: String;
    fromCharCode(...codes: number[]): string;
}

/** 
  * Allows manipulation and formatting of text strings and determination and location of substrings within strings. 
  */
declare var String: StringConstructor;

interface Boolean {
}

interface BooleanConstructor {
    new (value?: any): Boolean;
    (value?: any): boolean;
    prototype: Boolean;
}

declare var Boolean: BooleanConstructor;

interface Number {
    /**
      * Returns a string representation of an object.
      */
    // {shim:number::to_string}
    toString(): string;
}

interface NumberConstructor {
    new (value?: any): Number;
    (value?: any): number;
    prototype: Number;

    /** The largest number that can be represented in JavaScript. Equal to approximately 1.79E+308. */
    MAX_VALUE: number;

    /** The closest number to zero that can be represented in JavaScript. Equal to approximately 5.00E-324. */
    MIN_VALUE: number;

    /** 
      * A value that is not a number.
      * In equality comparisons, NaN does not equal any value, including itself. To test whether a value is equivalent to NaN, use the isNaN function.
      */
    NaN: number;

    /** 
      * A value that is less than the largest negative number that can be represented in JavaScript.
      * JavaScript displays NEGATIVE_INFINITY values as -infinity. 
      */
    NEGATIVE_INFINITY: number;

    /**
      * A value greater than the largest number that can be represented in JavaScript. 
      * JavaScript displays POSITIVE_INFINITY values as infinity. 
      */
    POSITIVE_INFINITY: number;
}

/** An object that represents a number of any kind. All JavaScript numbers are 64-bit floating-point numbers. */
declare var Number: NumberConstructor;

interface RegExp {

}

declare namespace Math {
    /**
      * Returns the absolute value of a number (the value without regard to whether it is positive or negative). 
      * For example, the absolute value of -5 is the same as the absolute value of 5.
      * @param x A numeric expression for which the absolute value is needed.
      */
    // {shim:math::abs}
    export function abs(x: number): number;
    
    /**
      * Returns the sign of the x, indicating whether x is positive, negative or zero.
      * @param x The numeric expression to test
      */
    // {shim:math::sign}
    export function sign(x: number): number;
    
    /**
      * Returns the larger of two supplied numeric expressions. 
      */
    // {shim:math::max}
    export function max(a:number, b:number): number;
    
    /**
      * Returns the smaller of two supplied numeric expressions. 
      */
    // {shim:math::min}
    export function min(a:number, b:number): number;
    
    /**
      * Returns the value of a base expression taken to a specified power. 
      * @param x The base value of the expression.
      * @param y The exponent value of the expression.
      */
    // {shim:math::pow}
    export function pow(x: number, y: number): number;
    
    /** Returns a pseudorandom number between 0 and `max`. */
    // {shim:math::random}
    export function random(max:number): number;
    
    /**
      * Returns the square root of a number.
      * @param x A numeric expression.
      */
    // {shim:math::sqrt}
    export function sqrt(x: number): number;
}
