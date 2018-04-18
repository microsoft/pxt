namespace game {
    export class Sprite {
        /**
         * Registers code when the sprite overlaps with another sprite
         * @param spriteType sprite type to match
         * @param handler
         */
        //% group="Collisions"
        //% blockId=spriteonoverlap block="on %sprite overlaped with"
        //% afterOnStart=true
        onOverlap(handler: (other: Sprite) => void) {
        }
    }
}