const enum Direction {
    //% block=left
    Left,
    //% block=right
    Right
}

namespace exp {
    //% fixedInstances
    export class Fixed {

        /**
         * Test fixed instance expandable blocks with optional args
         * @param value a value
         * @param n (optional) an optional value
         * @param b (optional) an enum arg
         */
        //% blockId=fixedExpandTest block="this %me with number %value|| optional number %n and boolean %b"
        //% weight=100 blockGap=8
        doSomething(value: number, n: number = 0, b = false) { }
    }

    //% whenUsed fixedInstance block="instance"
    export const instance = new Fixed();


    /**
     * Basic API with optional arguments
     */
    //% weight=99 inlineInputMode="inline"
    //% blockId=basicOpt block="string %str number %ang || boolean %opt enum %enu"
    export function basicOpt(str: string, ang: number, opt?: boolean, enu?: Direction) { }

    //% blockId="test_arrayReturnType" block="array return type %n"
   export function arrayReturnType(n : number): Fixed[] {
        let res: Fixed[] = []
        return res
    }
}

namespace testNamespace {
    //% blockId=test_handler_arguments3 draggableParameters=1 blockAllowMultiple=1
    //% block="Handler with draggable arguments"
    export function callbackWithDraggableParams(cb: (c: number, d: number) => void) {}
}