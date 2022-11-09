/**
 * Blocks can be mounted on class methods.
 */
//% color="#AA278D"
namespace language {
    /**
     * Make sure your classes are exported
     */
    export class Robot {
        /**
         * Use "$this" to define a variable block that
         * references the "this" pointer.
         */
        //% block="robot $this say $message"
        //% this.defl=robot
        //% this.shadow=variables_get
        public say(message: string) {

        }
    }
}