// use the inlineInputMode=inline to force inputs to appear on a single line
namespace sample {
    //% block="map $value|from low $fromLow|high $fromHigh|to low $toLow|high $toHigh"
    export function mapBig(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
        return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    }


    //% block="map $value|from low $fromLow|high $fromHigh|to low $toLow|high $toHigh"
    //% inlineInputMode=inline
    export function map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
        return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    }
}