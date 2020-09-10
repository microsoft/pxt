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
        //% block="robot $this(robot) say $message"
        public say(message: string) {

        }
    }
}