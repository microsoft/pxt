
//% color="#FFAB19"
namespace time {
    /**
      * Text dropdowns are text fields where a user can either
      * type in a string or choose a string from a list of
      * options. The user is not limited to typing the options
      * in the list, so this field is mostly useful for giving
      * a shortcut for commonly used values or helpful default
      * values.
      */
    //% shim=TD_ID
    //% blockId=wordPicker
    //% block="$word"
    //% blockHidden=true
    //% word.fieldEditor="textdropdown"
    //% word.fieldOptions.decompileLiterals=true
    //% word.fieldOptions.values='hi,hello'
    //% word.defl='hello'
    export function __wordPicker(word: string): string {
        return word;
    }

    //% block="say textdropdown $word"
    //% word.shadow="wordPicker"
    export function say(word: string) {

    }

    /**
      * If you use fieldOptions.data instead of fieldOptions.values,
      * you can enter your values as a JSON array of tuples. This syntax
      * is useful when you want to display a string differently in the
      * dropdown then from what will appear in the text field when the
      * option is selected.
      *
      * In each tuple, the first entry will be the string displayed in the
      * dropdown and the second will be the string that appears in the text
      * field when that option is selected.
      *
      * For example, if the user selects "hello" from this exmaple dropdown,
      * "hi" is the text that will appear in the field editor.
      */
    //% shim=TD_ID
    //% blockId=wordPickerWithTuples
    //% block="$word"
    //% blockHidden=true
    //% word.fieldEditor="textdropdown"
    //% word.fieldOptions.decompileLiterals=true
    //% word.fieldOptions.data='[["hello", "hi"], ["goodbye", "bye"]]'
    //% word.defl='hello'
    export function __wordPickerWithTuples(word: string): string {
        return word;
    }

    //% block="say textdropdown with tuples $word"
    //% word.shadow="wordPickerWithTuples"
    export function sayWithTuples(word: string) {

    }

    /**
     * To create a dropdown for number values, use numberdropdown instead
     * of textdropdown for the fieldEditor.
     */
    //% shim=TD_ID
    //% blockId=numberPicker
    //% block="$value"
    //% blockHidden=true
    //% value.fieldEditor="numberdropdown"
    //% value.fieldOptions.decompileLiterals=true
    //% value.fieldOptions.values='1,2,23.5,5'
    //% value.defl='5'
    export function __numberPicker(value: number): number {
        return value;
    }

    //% block="show numberdropdown $value"
    //% value.shadow="numberPicker"
    export function showNumber(value: number) {

    }

    /**
     * You can also use the fieldOptions.data with numberdropdown, just
     * make sure that the second entry in each tuple is a number instead of
     * a string. This is useful for displaying numerical values in different
     * units.
     */
    //% shim=TD_ID
    //% blockId=numberPickerWithTuples
    //% block="$value"
    //% blockHidden=true
    //% value.fieldEditor="numberdropdown"
    //% value.fieldOptions.decompileLiterals=true
    //% value.fieldOptions.data='[["1 mm", 1], ["1 cm", 10], ["1 m", 1000]]'
    //% value.defl='1'
    export function __numberPickerWithTuples(value: number): number {
        return value;
    }

    //% block="show numberdropdown with tuples $value"
    //% value.shadow="numberPickerWithTuples"
    export function showNumberWithTuples(value: number) {

    }
}
