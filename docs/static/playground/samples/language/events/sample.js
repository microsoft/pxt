/**
 * Events are function that take a function handler as the last argument
 */
//% color="#AA278D"
namespace language {
    /**
     * A simple event taking an function handler
     */
    //% block
    export function onEvent(handler: () => void) {

    }

    /**
     * Events can have arguments before the handler
     */
    //% block
    export function onEventWithArgs(color: number, handler: () => void) {

    }

    /**
     * Event handlers can have arguments too. You can refer to them using $NAME.
     */
    //% block="on rare $handlerArg1 event"
    export function onEventWithHandlerArgs(handler: (handlerArg: text) => void) {

    }

    /**
     * You can mix up function argument and handler arguments for best readability,
     * Make sure to use the $ notation.
     */
    //% block="on some event $handlerArg from $arg"
    export function onEventWithHandlerArgs(arg: number, handler: (handlerArg: text) => void) {

    }

}