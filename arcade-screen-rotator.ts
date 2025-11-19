//% weight=0 color=#b8860b icon="\uf021" block="Screen Transforms"
//% advanced=true

// ref from arcade-turtle-logo 
namespace screenRotator {
    // Number of times the scaled image has been doubled.
    // Scaled image is used for sampling when rotating image.
    const NUM_SCALES: number = 1;

    let _enabled = true

    // Container of state information for rotated sprites
    let _spritesWithRotations: Array<SpriteWithRotation> = [];

    class SpriteWithRotation {
        private _spriteId: number;
        private _currRotation: number;
        private _origImage: Image;
        private _scaledImage: Image;

        constructor(sprite: Sprite, angle: number = 0) {
            this._spriteId = sprite.id;
            this._currRotation = angle;
            this._origImage = sprite.image.clone();
            this._scaledImage = scale2x(sprite.image);
        }   // constructor()

        get id(): number {
            return this._spriteId;
        }   // get id()

        get image(): Image {
            return this._origImage;
        }   // get image()

        get rotation(): number {
            return this._currRotation;
        }   // get rotation()

        set rotation(angle: number) {
            this._currRotation = angle;
        }   // set rotation()

        get scaledImage(): Image {
            return this._scaledImage;
        }   // get scaledImage()
    }   // class SpriteWithRotation

    class Coordinate {
        private _x: number;
        private _y: number;

        constructor(x: number, y: number) {
            this._x = x;
            this._y = y;
        }   // constructor()

        public get x() {
            return this._x;
        }   // get x()

        public get y() {
            return this._y;
        }   // get y()
    }   // class Coordinate

    class Vector {
        private _mag: number;
        private _dir: number;

        constructor(magnitude: number, direction: number) {
            this._mag = magnitude;
            this._dir = direction;
        }   // constructor()

        public get direction() {
            return this._dir;
        }   // get direction()

        public get magnitude() {
            return this._mag;
        }   // get magnitude()
    }   // class Vector


    /**
     * Increment the rotation of a sprite.
     * The sprite's image will be updated with the new rotation.
     * Angle is in degrees.
     * Positive change rotates clockwise; negative change rotates counterclockwise.
     */
    //% blockId=transform_change_rotation
    //% block="change rotation of %sprite(mySprite) by %angleChange degrees"
    //% sprite.shadow="variables_get" angleChange.defl=0
    export function changeRotation(sprite: Sprite, angleChange: number): void {
        if (_enabled) {
            if (!_spritesWithRotations[sprite.id]) {
                _spritesWithRotations[sprite.id] = new SpriteWithRotation(sprite, 0);
            }   // if ( ! _spritesWithRotations[sprite.id] )

            rotateSprite(sprite, _spritesWithRotations[sprite.id].rotation + angleChange);
        }
    }   // changeRotation()

    /**
     * Get the current rotation angle for a sprite in degrees.
     */
    //% blockId=transform_get_rotation
    //% block="%sprite(mySprite) rotation"
    //% sprite.shadow="variables_get"
    export function getRotation(sprite: Sprite): number {
        if (!_spritesWithRotations[sprite.id]) {
            return 0;
        } else {
            return _spritesWithRotations[sprite.id].rotation;
        }   // if ( ! SpriteWithRotations[sprite.id])
    }   // getRotation()

    /**
     * Rotate a sprite to a specific angle.
     * The sprite's image will be updated to the rotated image.
     * Angle is in degrees.
     * Positive change rotates clockwise; negative change rotates counterclockwise.
     */
    //% blockId=transform_rotate_sprite
    //% block="set rotation of %sprite(mySprite) to %angle degrees"
    //% sprite.shadow="variables_get" angle.defl=0
    export function rotateSprite(sprite: Sprite, angle: number): void {
        if (_enabled) {
            if (!_spritesWithRotations[sprite.id]) {
                _spritesWithRotations[sprite.id] = new SpriteWithRotation(sprite, 0);
                // shiftScreen(sprite.image, sprite) unsupported
            }   // if ( ! _spritesWithRotations[sprite.id] )

            _spritesWithRotations[sprite.id].rotation = angle;
            sprite.setImage(rotate(_spritesWithRotations[sprite.id], angle));
        }
    }   // rotateSprite()

    function rotate(sprite: SpriteWithRotation, angle: number): Image {
        // Normalize angle.
        angle %= 360;
        if (angle < 0) {
            angle += 360;
        }   // if (angle < 0)

        // Reflections not needing actual rotation.
        let toReturn: Image = null;
        let x: number = 0;
        let y: number = 0;

        toReturn = image.create(sprite.image.width, sprite.image.height);
        const rads: number = Math.PI * angle / 180;
        let center: Coordinate = new Coordinate(toReturn.width >> 1, toReturn.height >> 1);

        for (x = 0; x < toReturn.width; x++) {
            for (y = 0; y < toReturn.height; y++) {
                let currVector: Vector = new Vector(
                    Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2),
                    Math.atan2(y - center.y, x - center.x)
                );

                let rotVector: Vector = new Vector(
                    currVector.magnitude,
                    currVector.direction - rads
                );

                let scaledCoord: Coordinate = new Coordinate(
                    Math.round((center.x << NUM_SCALES) + (rotVector.magnitude << NUM_SCALES) * Math.cos(rotVector.direction)),
                    Math.round((center.y << NUM_SCALES) + (rotVector.magnitude << NUM_SCALES) * Math.sin(rotVector.direction))
                );

                if (scaledCoord.x >= 0 && scaledCoord.x < sprite.scaledImage.width &&
                    scaledCoord.y >= 0 && scaledCoord.y < sprite.scaledImage.height) {
                    toReturn.setPixel(x, y, sprite.scaledImage.getPixel(scaledCoord.x, scaledCoord.y));
                }   // scaledCoord within scaledImage bounds
            }   // for ( y )
        }   // for ( x )
        return toReturn;
    }   // rotateImage()


    /**
     * Smoothly doubles the size of an image.
     */
    // Implementation of Scale2X variation of Eric's Pixel Expansion (EPX) algorithm.
    //% blockId=transform_scale2x
    //% block="double size of|image %original=screen_image_picker"
    export function scale2x(original: Image): Image {
        // Double the size of the original.
        let toReturn: Image = image.create(original.width << 1, original.height << 1);

        for (let x: number = 0; x < original.width; x++) {
            for (let y: number = 0; y < original.height; y++) {
                // From original image:
                // .a.
                // cpb
                // .d.
                const p: color = original.getPixel(x, y);
                const a: color = original.getPixel(x, y - 1);
                const b: color = original.getPixel(x + 1, y);
                const c: color = original.getPixel(x - 1, y);
                const d: color = original.getPixel(x, y + 1);

                // In scaled image:
                // 12
                // 34
                let one: Coordinate = new Coordinate(x << 1, y << 1);
                let two: Coordinate = new Coordinate(one.x + 1, one.y);
                let three: Coordinate = new Coordinate(one.x, one.y + 1);
                let four: Coordinate = new Coordinate(one.x + 1, one.y + 1);

                // 1=P; 2=P; 3=P; 4=P;
                // IF C== A AND C!= D AND A!= B => 1 = A
                // IF A== B AND A!= C AND B!= D => 2 = B
                // IF D== C AND D!= B AND C!= A => 3 = C
                // IF B== D AND B!= A AND D!= C => 4 = D
                toReturn.setPixel(one.x, one.y, p);
                toReturn.setPixel(two.x, two.y, p);
                toReturn.setPixel(three.x, three.y, p);
                toReturn.setPixel(four.x, four.y, p);

                if (c == a && c != d && a != b) {
                    toReturn.setPixel(one.x, one.y, a);
                }   // if ( c == a ...
                if (a == b && a != c && b != d) {
                    toReturn.setPixel(two.x, two.y, b);
                }   // if ( a == b ...
                if (d == c && d != b && c != a) {
                    toReturn.setPixel(three.x, three.y, c);
                }   // if ( d == c ...
                if (b == d && b != a && d != c) {
                    toReturn.setPixel(four.x, four.y, d);
                }   // if ( b == d ...
            }   // for ( y )
        }   // for ( x )
        return toReturn;
    }   // scale2x()

    //% blockId=rotate_screen_enabled block="rotate screen enabled %enabled=toggleOnOff"
    //% enabled.defl=true weight=30
    /** 
     * Controls turn on or off the screen rotation
     */
    export function rotateScreenEnabled(enabled: boolean) {
        _enabled = enabled

        if (enabled) {
        let allSprites = game.currentScene().allSprites

        let playersList = controller.players()
        // game.onUpdate(() => {
        const sprites2 = game.currentScene().allSprites;
        controller.players().forEach(player => {
            sprites2.forEach(s => player.moveSprite(s as Sprite, 0, 0));
        });
        } else if(!enabled) "sprites can move freely now"
    }

}   // namespace transformScreen
