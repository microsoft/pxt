// Here are the different types of blocks
// supported by MakeCode

//% color="#4C97FF"
namespace basic {

    /**
     * This is a statement block
     */
    //% block
    export function show() {

    }

    /**
     * This is a statement block with a parameter
     */
    //% block
    export function move(steps: number) {

    }

    /**
     * This is a reporter block that returns a number
     */
    //% block
    export function randomNumber(): number {
        return 0;
    }

    /**
     * This is a reporter block that returns a boolean
     */
    //% block
    export function randomBoolean(): boolean {
        return false;
    }

    /**
     * This is an event handler block
     */
    //% block="on event"
    export function onEvent(handler: () => void) {

    }
}
