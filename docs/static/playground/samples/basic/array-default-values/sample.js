/**
 * Default values for arrays of primitive types are 
 * automatically generated. For non-primitive types, 
 * set the shadow block ID to "lists_create_with"
 * and the default value to the block ID for the type 
 * of elements you want the array to be populated with.
 */

//% color="#AA278D"
namespace sample {
    
    //% block
    export function myNumArrayFunction(myParam: number[]): void {}

    //% block
    export function myStringArrayFunction(myParam: string[]): void {}

    // Note: The following example will only render in the 
    // Arcade editor, since that is where the Image type is supported.
    
    //% block
    //% myParam.shadow="lists_create_with"
    //% myParam.defl="screen_image_picker"
    export function myImageArrayFunction(myParam: Image[]): void {}
}
