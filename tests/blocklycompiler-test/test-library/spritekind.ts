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

namespace game {
    /**
     * Update the position and velocities of sprites
     * @param body code to execute
     */
    //% group="Gameplay"
    //% help=game/on-update weight=100 afterOnStart=true
    //% blockId=gameupdate block="on game update"
    //% blockAllowMultiple=1
    export function onUpdate(a: () => void): void {
    }
}

class Sprite {
    constructor() {}
    /**
     * Set the sprite position in pixels starting from the top-left corner of the screen.
     * @param x horizontal position in pixels
     * @param y vertical position in pixels
     */
    //% group="Physics"
    //% weight=100
    //% blockId=spritesetpos block="set %sprite(mySprite) position to x %x y %y"
    //% help=sprites/sprite/set-position
    //% x.shadow="positionPicker" y.shadow="positionPicker"
    setPosition(x: number, y: number): void {
    }
}

//% blockNamespace="statusbars"
//% blockGap=8
class StatusBarSprite extends Sprite {
    constructor() {
        super();
    }

    //% group="Value" blockSetVariable="statusbar"
    //% blockCombine block="value" callInDebugger
    //% help=github:pxt-status-bar/docs/value
    get value(): number {
        return 0;
    }

    set value(v: number) {

    }
}

namespace statusbars {
    /**
     * @param width width of status bar, eg: 20
     * @param height height of status bar, eg: 4
     */
    //% block="create status bar sprite width $width height $height kind $kind"
    //% block.loc.ru="создать спрайт индикатора статуса шириной $width высотой $height типа $kind"
    //% kind.shadow="statusbars_kind"
    //% blockId="statusbars_create"
    //% blockSetVariable="statusbar"
    //% help=github:pxt-status-bar/docs/create
    //% group="Create"
    //% weight=100
    export function create(
        width: number,
        height: number,
        kind: number
    ): StatusBarSprite {
        return undefined;
    }
}


namespace StatusBarKind {
    /**
     * Gets the "kind" of a status bar
     */
    //% shim=KIND_GET
    //% blockId="statusbars_kind" block="$kind"
    //% kindNamespace=StatusBarKind kindMemberName=kind kindPromptHint="e.g. Hungry, Thirst, ..."
    //% blockHidden=true
    export function _statusbarKind(kind: number): number {
        return kind;
    }

    let nextKind: number
    export function create() {
        if (nextKind === undefined) nextKind = 1;
        return nextKind++;
    }

    //% isKind
    export const Health = create();

    //% isKind
    export const Energy = create();

    //% isKind
    export const Magic = create();

    //% isKind
    export const EnemyHealth = create();
}


namespace images {
    /**
     * A position picker
     */
    //% blockId=positionPicker block="%index" blockHidden=true shim=TD_ID
    //% index.fieldEditor="position" color="#ffffff" colorSecondary="#ffffff"
    //% index.fieldOptions.decompileLiterals="true"
    export function __positionPicker(index: number) {
        return index;
    }
}