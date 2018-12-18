const enum Direction {
    //% block=left
    Left,
    //% block=right
    Right
}

interface Image {

}

/**
 * Tagged image literal converter
 */
//% shim=@f4
//% groups=["0.","1#","2T","3t","4N","5n","6G","7g","8","9","aAR","bBP","cCp","dDO","eEY","fFW"]
function img(lits: any, ...args: any[]): Image { return null }

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

    //% blockId=test_handler_arguments4 draggableParameters="reporter" blockAllowMultiple=1
    //% block="Handler with draggable arguments"
    export function callbackWithDraggableParamsReporters(cb: (c: string, d: number, e: boolean, f: Image) => void) {}
}