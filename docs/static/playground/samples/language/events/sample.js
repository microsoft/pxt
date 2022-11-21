/**
 * Events are functions that take a function (lambda) as the last argument
 */
//% color="#AA278D"
namespace language {
    /**
     * A simple event taking a function handler
     */
    //% block="on event"
    export function onEvent(handler: () => void) {
        handler();
    }

    /**
     * Events can have arguments before the handler
     */
    //% block="on event with $color"
    export function onEventWithArgs(color: number, handler: () => void) {
        handler();
    }

    /**
     * Event handlers can have arguments too. You can refer to them using $NAME.
     */
    //% block="on rare $handlerArg event"
    //% draggableParameters
    export function onEventWithHandlerArgs(handler: (handlerArg: string) => void) {
        handler("Hello world!");
    }

    /**
     * You can mix up function argument and handler arguments for best readability,
     * Make sure to use the $ notation.
     */
    //% block="on some event $handlerArg from $arg"
    //% draggableParameters
    export function onEventWithHandlerArgsShuffle(arg: number, handler: (handlerArg: string) => void) {
        handler("Hello world!");
    }

    /**
     * The arguments on event handlers are variables by default, but they can
     * also be special "reporter" blocks that can only be used inside the event
     * handler itself, mimicking the behavior of locally scoped variables.
     */
    //% block="on some event $handlerStringArg $handlerBoolArg from $arg"
    //% draggableParameters="reporter"
    export function onEventWithHandlerReporterArgs(arg: number, handler: (handlerStringArg: string, handlerBoolArg: boolean) => void) {
        handler("Hello world", true);
    }

    /**
     * Events can be made into statements that can be put in line with other events,
     * similar to loops or conditions.
     */
    //% block="on an inline event"
    //% handlerStatement
    export function onEventAsStatement(handler: () => void) {
        handler();
    }
}