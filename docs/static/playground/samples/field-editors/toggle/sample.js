namespace sample {

    /**
     * Render a boolean as a down/up toggle
     */
    //% block="%down"
    //% down.fieldEditor=toggledownup
    //% down.fieldOptions.decompileLiterals=true
    export function downUp(down: boolean): boolean {
        return down;
    }

    /**
     * Render a boolean as an up/down toggle
     */
    //% block="%up"
    //% up.fieldEditor=toggleupdown
    //% up.fieldOptions.decompileLiterals=true
    export function upDown(up: boolean): boolean {
        return up;
    }

    /**
     * Render a boolean as a high/low toggle
     */
    //% block="%high"
    //% high.fieldEditor=togglehighlow
    //% high.fieldOptions.decompileLiterals=true
    export function highLow(high: boolean): boolean {
        return high;
    }


    /**
     * Render a boolean as a on/off toggle
     */
    //%  block="%on"
    //% on.fieldEditor=toggleonoff
    //% on.fieldOptions.decompileLiterals=true
    export function onOff(on: boolean): boolean {
        return on;
    }

    /**
     * Render a boolean as a yes/no toggle
     */
    //% block="%yes"
    //% yes.fieldEditor=toggleyesno
    //% yes.fieldOptions.decompileLiterals=true
    export function yesNo(yes: boolean): boolean {
        return yes;
    }

}