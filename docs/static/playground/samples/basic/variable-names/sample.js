/**
 * Set the default name given to a variable argument by
 * using the VARIABLE.defl=VALUE notatation along with
 * the variable shadow block ID. 
 */

//% color="#AA278D"
namespace sample {
    /**
     * This API will have a variable shadow block with the
     * name "someName" pre-filled
     */

    //% block="$x"
    //% x.defl=someName
    //% x.shadow=variables_get
    export function foo(x: number) {

    }
}
