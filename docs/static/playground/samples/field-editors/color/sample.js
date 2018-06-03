
//% color="#AA278D"
namespace basic {

    /**
     * Color picker
     * @param color color number value. eg: 140
     */
    //% block="%color"
    //% blockId="colorPicker"
    //% blockHidden=true
    //% color.fieldEditor="colornumber"
    export function __colorPicker(color: number) {
        return color;
    }

    //% block="show color %color=colorPicker"
    export function showColor(color: number) {

    }
}
