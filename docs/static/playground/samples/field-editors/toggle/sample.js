namespace sample {

    /**
     * Render a boolean as a down/up toggle
     */
    //% block="%down=toggleDownUp"
    export function downUp(down: boolean): boolean {
        return down;
    }

    /**
     * Render a boolean as an up/down toggle
     */
    //% block="%up=toggleUpDown"
    export function upDown(up: boolean): boolean {
        return up;
    }

    /**
     * Render a boolean as a high/low toggle
     */
    //% block="%high=toggleHighLow"
    export function highLow(high: boolean): boolean {
        return high;
    }


    /**
     * Render a boolean as a on/off toggle
     */
    //%  block="%on=toggleOnOff"
    export function onOff(on: boolean): boolean {
        return on;
    }

    /**
     * Render a boolean as a yes/no toggle
     */
    //% block="%yes=toggleYesNo"
    export function yesNo(yes: boolean): boolean {
        return yes;
    }

}