/// <reference path="./spriteutils.ts" />

namespace pxt.sprite.legacy {
    const tileReferenceRegex = new RegExp(`^\\s*${TILE_NAMESPACE}\\s*\\.\\s*${TILE_PREFIX}(\\d+)\\s*$`);

    export interface LegacyTileInfo {
        data: BitmapData;
        qualifiedName?: string;
        projectId?: number;
    }

    export interface LegacyTileSet {
        tileWidth: number;
        tiles: LegacyTileInfo[];
    }

    export class LegacyTilemapData {
        nextId = 0;

        // Used to make sure the user doesn't delete a tile used elsewhere in their project
        projectReferences: number[];

        constructor(public tilemap: Tilemap, public tileset: LegacyTileSet, public layers: BitmapData) {}
    }

    export function decodeTilemap(literal: string, fileType: "typescript" | "python"): LegacyTilemapData {
        literal = Util.htmlUnescape(literal)?.trim();

        if (!literal?.trim()) {
            return new LegacyTilemapData(new Tilemap(16, 16), {tileWidth: 16, tiles: []}, new Bitmap(16, 16).data());
        }

        literal = literal.substr(literal.indexOf("(") + 1);
        literal = literal.substr(0, literal.lastIndexOf(")"));

        const tm = literal.substr(0, literal.indexOf(","));
        literal = literal.substr(tm.length + 1);

        const layer = literal.substr(0, literal.indexOf(","));
        literal = literal.substr(layer.length + 1);

        const tileset = literal.substr(0, literal.lastIndexOf("]") + 1);
        literal = literal.substr(tileset.length + 1);

        const tilescale = literal;

        const result = new LegacyTilemapData(tilemapLiteralToTilemap(tm), {
            tiles: decodeTileset(tileset),
            tileWidth: tileScaleToTileWidth(tilescale)
        }, imageLiteralToBitmap(layer).data());

        return result;
    }

    function decodeTileset(tileset: string) {
        tileset = tileset.replace(/[\[\]]/g, "");
        return tileset ? tileset.split(",").filter(t => !!t.trim()).map(t => decodeTile(t)) : [];
    }

    function decodeTile(literal: string): LegacyTileInfo {
        literal = literal.trim();
        if (literal.indexOf("img") === 0) {
            const bitmap = imageLiteralToBitmap(literal);
            return {
                data: bitmap.data()
            }
        }

        const match = tileReferenceRegex.exec(literal);

        if (match) {
            return {
                data: null,
                projectId: Number(match[1])
            };
        }

        return {
            data: null,
            qualifiedName: literal
        }
    }

    export function tileToBlocklyVariable(info: LegacyTileInfo): string {
        return `${info.projectId};${info.data.width};${info.data.height};${pxtc.Util.toHex(info.data.data)}`
    }

    export function blocklyVariableToTile(name: string): LegacyTileInfo {
        const parts = name.split(";");

        if (parts.length !== 4) {
            return null;
        }

        return {
            projectId: parseInt(parts[0]),
            data: {
                width: parseInt(parts[1]),
                height: parseInt(parts[2]),
                data: new Uint8ClampedArray(pxtc.Util.fromHex(parts[3])),
                x0: 0,
                y0: 0
            }
        }
    }
}