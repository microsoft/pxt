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

namespace images {
    //% blockId=tileset_tile_picker block="%tile"
    //% shim=TD_ID
    //% tile.fieldEditor="tileset"
    //% tile.fieldOptions.decompileIndirectFixedInstances="true"
    //% weight=10 blockNamespace="scene" group="Tiles"
    //% blockHidden=1 duplicateShadowOnDrag
    export function _tile(tile: Image) {
        return tile
    }
}

namespace scene {
    /**
     * Run code when a certain kind of sprite overlaps a tile
     * @param kind
     * @param tile
     * @param handler
     */
    //% group="Tiles"
    //% weight=100 draggableParameters="reporter" blockGap=8
    //% blockId=spriteshittile block="on $sprite of kind $kind=spritekind overlaps $tile at $location"
    //% tile.shadow=tileset_tile_picker
    //% help=tiles/on-overlap-tile
    export function onOverlapTile(kind: number, tile: Image, handler: (sprite: number, number) => void) {
    }
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