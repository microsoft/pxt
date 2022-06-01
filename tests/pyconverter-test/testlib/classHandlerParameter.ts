namespace game {
    export class Sprite {
        constructor(x: number) {
        }

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

namespace sprites {
    /**
     * A version of the Sprite class that is easier to extend.
     *
     * Unlike the normal Sprite class, this class will automatically add
     * itself to the physics engine and run all sprite created handlers
     * in the constructor
     */
    export class ExtendableSprite extends game.Sprite {
        constructor(kind: number) {
            super(kind)
        }

        /**
         * Override to change how the sprite is drawn to the screen
         *
         * @param drawLeft The left position to draw the sprite at (already adjusted for camera)
         * @param drawTop The top position to draw the sprite at (already adjusted for camera)
         */
        draw(drawLeft: number, drawTop: number) {
        }
    }
}