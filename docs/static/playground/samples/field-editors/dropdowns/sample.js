
//% color="#FFAB19"
namespace control {

    /**
     * Number dropdown
     */

    /**
      * Get the time field editor
      * @param ms time duration in milliseconds, eg: 500, 1000
      */
    //% blockId=timePicker block="%ms"
    //% blockHidden=true
    //% colorSecondary="#FFFFFF"
    //% ms.fieldEditor="numberdropdown" ms.fieldOptions.decompileLiterals=true
    //% ms.fieldOptions.data='[["100 ms", 100], ["200 ms", 200], ["500 ms", 500], ["1 second", 1000], ["2 seconds", 2000]]'
    export function __timePicker(ms: number): number{
        return ms;
    }
    

    //% block="pause %ms=timePicker"
    export function pause(ms: number) {

    }

    /**
     * Text dropdown
     */

    /**
      * Get the word field editor
      * @param word eg: Hello
      */
    //% blockId=wordPicker block="%word"
    //% blockHidden=true
    //% colorSecondary="#FFFFFF"
    //% word.fieldEditor="textdropdown" word.fieldOptions.decompileLiterals=true
    //% word.fieldOptions.values='[["Hi"], ["How are you?"]]'
    export function __wordPicker(word: string): string {
        return word;
    }
    

    //% block="say %word=wordPicker"
    export function say(word: string) {

    }
}
