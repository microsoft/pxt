
//% color="#FFAB19"
namespace control {

    //% block="pause $ms"
    //% ms.shadow="timePicker"
    export function pause(ms: number) {

    }

    /**
     * Custom text dropdown
     */

    /**
      * Get the word field editor
      * @param word eg: Hello
      */
    //% blockId=wordPicker block="$word"
    //% blockHidden=true
    //% colorSecondary="#FFFFFF"
    //% word.fieldEditor="textdropdown" word.fieldOptions.decompileLiterals=true
    //% word.fieldOptions.values='[["Hi"], ["How are you?"]]'
    export function __wordPicker(word: string): string {
        return word;
    }


    //% block="say $word"
    //% word.shadow="wordPicker"
    export function say(word: string) {

    }
}
