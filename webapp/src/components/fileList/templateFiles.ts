export const customFile = "custom.ts";
export const customFileText = `
enum MyEnum {
    //% block="one"
    One,
    //% block="two"
    Two
}

/**
 * ${lf("Custom blocks")}
 */
//% weight=100 color=#0fbc11 icon="\uf0c3"
namespace custom {
    /**
     * TODO: ${lf("describe your function here")}
     * @param n ${lf("describe parameter here")}, eg: 5
     * @param s ${lf("describe parameter here")}, eg: "Hello"
     * @param e ${lf("describe parameter here")}
     */
    //% block
    export function foo(n: number, s: string, e: MyEnum): void {
        // Add code here
    }

    /**
     * TODO: ${lf("describe your function here")}
     * @param value ${lf("describe value here")}, eg: 5
     */
    //% block
    export function fib(value: number): number {
        return value <= 1 ? value : fib(value -1) + fib(value - 2);
    }
}
`;

export const customFileHeader = (homeUrl: string) => `
/**
* ${lf("Use this file to define custom functions and blocks.")}
* ${lf("Read more at {0}", homeUrl + 'blocks/custom')}
*/
`