
//% color="#D063CF"
namespace rgb {

    /**
     * Color picker
     * @param color color number value. eg: 0xff0000
     */
    //% block="%color"
    //% blockId="colorPicker"
    //% blockHidden=true
    //% color.fieldEditor="colornumber"
    export function __colorPicker(color: number) {
        return color;
    }

    /**
     * Color wheel picker
     * @param color color number value. eg: 140
     */
    //% block="%color"
    //% blockId="colorWheel"
    //% blockHidden=true colorSecondary="#ffffff"
    //% color.fieldEditor="colorwheel"
    export function __colorWheelPicker(color: number) {
        return color;
    }

    

    //% block="show color %color=colorPicker"
    export function showColor(color: number) {

    }

    //% block="show color %color=colorWheel"
    export function showColorWheel(color: number) {

    }
}
