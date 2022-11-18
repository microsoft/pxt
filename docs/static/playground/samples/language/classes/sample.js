/**
 * Blocks can be mounted on class methods.
 * 
 * Note: In the following examples, the
 * generated blocks do not instantiate
 * the class and therefore result in an
 * error when dragged into the workplace.
 * See the Factories sample to make a 
 * factory function to first create the 
 * instance.
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
    /**
     * Use the "blockCombine" annotation in class defintions
     * to automatically combine blocks such that there is a
     * single block for all getters of a given type, a 
     * single block for setters, and a single block for
     * updates.
     */

   //% blockNamespace=language 
   class Foo {
        //% blockCombine
        x: number;
        //% blockCombine
        y: number;
        // exposed with custom name
        //% blockCombine block="foo bar"
        foo_bar: number;

        // not exposed
        _bar: number;
        _qux: number;

        // exposed as read-only (only in the getter block)
        //% blockCombine
        get bar() { return this._bar }

        // exposed in both getter and setter
        //% blockCombine
        get qux() { return this._qux }
        //% blockCombine
        set qux(v: number) { if (v != 42) this._qux = v }
}