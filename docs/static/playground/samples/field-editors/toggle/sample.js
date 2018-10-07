namespace sample {

    /**
     * Render a boolean as a down/up toggle
     */
    //% block="$down"
    //% down.shadow="toggleDownUp"
    export function downUp(down: boolean): boolean {
        return down;
    }

    /**
     * Render a boolean as an up/down toggle
     */
    //% block="$up"
    //% up.shadow="toggleUpDown"
    export function upDown(up: boolean): boolean {
        return up;
    }

    /**
     * Render a boolean as a high/low toggle
     */
    //% block="$high"
    //% high.shadow="toggleHighLow"
    export function highLow(high: boolean): boolean {
        return high;
    }


    /**
     * Render a boolean as a on/off toggle
     */
    //% block="$on"
    //% on.shadow="toggleOnOff"
    export function onOff(on: boolean): boolean {
        return on;
    }

    /**
     * Render a boolean as a yes/no toggle
     */
    //% block="$yes"
    //% yes.shadow="toggleYesNo"
    export function yesNo(yes: boolean): boolean {
        return yes;
    }

}