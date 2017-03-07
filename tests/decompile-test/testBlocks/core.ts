/// <reference no-default-lib="true"/>

declare interface String {
    // This block is currently disabled in favor of the built-in Blockly "Create text with" block, which compiles to "" + ""
    // Add % sign back to the block annotation to re-enable
    /**
     * Returns a string that contains the concatenation of two or more strings.
     * @param other The string to append to the end of the string.
     */
    //% shim=String_::concat weight=80
    //% blockId="string_concat" blockNamespace="text"
    // block="join %this=text|%other"
    concat(other: string): string;

    /**
     * Returns the character at the specified index.
     * @param index The zero-based index of the desired character.
     */
    //% shim=String_::charAt weight=77
    //% blockId="string_get" block="char from %this=text|at %pos" blockNamespace="text"
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
    //% blockId="string_compare" block="compare %this=text| to %that" blockNamespace="text"
    compare(that: string): number;

    /**
     * Return substring of the current string.
     * @param start first character index; can be negative from counting from the end, eg:0
     * @param length number of characters to extract
     */
    //% shim=String_::substr length.defl=1000000
    //% blockId="string_substr" block="substring of %this=text|from %start|of length %length" blockNamespace="text"
    substr(start:number, length?:number): string;

    // This block is currently disabled, as it does not compile in some targets
    // Add % sign back to the block annotation to re-enable
    /** Returns a value indicating if the string is empty */
    //% shim=String_::isEmpty
    //% blockId="string_isempty" blockNamespace="text"
    // block="%this=text| is empty"
    isEmpty() : boolean;

    [index: number]: string;
}