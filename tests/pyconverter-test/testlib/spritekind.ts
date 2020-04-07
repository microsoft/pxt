namespace sprites {
    /**
     * Gets the sprite type
     */
    //% shim=KIND_GET
    //% blockId=spritetype block="$kind"
    //% kindNamespace=SpriteKind kindMemberName=kind kindPromptHint="e.g. Coin, Fireball, Asteroid..."
    export function _spriteType(kind: number): number {
        return kind;
    }
}

namespace SpriteKind {
    let nextKind: number;

    export function create() {
        if (nextKind === undefined) nextKind = 1;
        return nextKind++;
    }

    //% isKind
    export const Player = create();

    //% isKind
    export const Projectile = create();

    //% isKind
    export const Food = create();

    //% isKind
    export const Enemy = create();
}