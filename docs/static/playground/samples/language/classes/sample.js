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
         * The first argument in the block signature is the "this" pointer.
         */
        //% block="robot %robot say $message"
        public say(message: string) {

        }
    }
}