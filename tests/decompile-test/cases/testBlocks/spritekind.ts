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



namespace tiles {
    interface TileMapData {

    }

    export function createTilemap(data: Buffer, layer: number, tiles: number, scale: number): TileMapData {
        return null;
    }

    //% blockId=tilemap_editor block="%tilemap"
    //% tilemap.fieldEditor="tilemap"
    //% tilemap.fieldOptions.decompileArgumentAsString="true"
    //% tilemap.fieldOptions.filter="tile"
    //% group="Animate" duplicateShadowOnDrag
    export function setTilemap(tilemap: TileMapData) {
    }

    //% blockId=til_getter block="tile %tile"
    //% tile.fieldEditor="tileset" shim=TD_ID
    export function _tileGetter(tile: Image) {
        return tile;
    }
}