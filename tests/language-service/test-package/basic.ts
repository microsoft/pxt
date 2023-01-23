namespace testNamespace {
    export function someFunction(someParam: string, someNum: number, someBool: boolean) {
        return someParam
    }

    //% someNum.defl=5
    //% someBool.defl=true
    export function someFunctionWithDefl(someNum: number, someBool: boolean) {
        return someNum + 1
    }

    export let someString: string;

    export interface SomeInterface {
        someField: number;
    }

    export enum SomeEnum {
        One,
        Two
    }

    export class SomeClass {
        e: SomeEnum;

        _y: number;

        get y(): number {
            return this._y
        }

        set y(v: number) {
            this._y = v
        }

        someMethod(p: boolean) {
        }
    }

    export function registerSomeEvent(param1: number, handler: () => void, param2: boolean) {
        handler()
    }

    //% param.snippet="'hello'"
    //% param.pySnippet="'goodbye'"
    export function paramOverride(param: string) {

    }
}

//% fixedInstances decompileIndirectFixedInstances
declare interface Image {
    /**
     * Set pixel color
     */
    //% shim=ImageMethods::setPixel blockNamespace="images" group="Drawing"
    //% block="set %picture=variables_get color at x %x y %y to %c=colorindexpicker"
    //% help=images/image/set-pixel
    setPixel(x: int32, y: int32, c: int32): void;
}