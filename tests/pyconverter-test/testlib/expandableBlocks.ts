declare const enum Direction {
    //% block=left
    Left,
    //% block=right
    Right
}


namespace expandable {
    //% weight=99 inlineInputMode="inline"
    //% blockId=expandable_test block="string %str number %ang || boolean %opt enum %enu"
    export function optionalParams(str: string, ang: number, opt?: boolean, enu?: Direction) { }

    //% weight=99 inlineInputMode="inline"
    //% blockId=expandable_subset block="string %str number %ang || boolean %opt"
    export function optionalSubset(str: string, ang: number, opt?: boolean, enu?: Direction) { }

    //% weight=99 inlineInputMode="inline"
    //% blockId=expandable_just block="some text || string %str number %ang"
    export function justOptional(str?: string, ang?: number) { }
}