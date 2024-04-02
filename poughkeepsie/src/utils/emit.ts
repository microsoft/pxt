import assert from "assert";
import { Asset, AvatarAsset, ImageAsset, ItemAsset, Project, SpriteAsset, TileAsset, TilemapAsset } from "../types/project";

export function emitProjectFiles(project: Project) {
    const { jres, ts } = emitJres(project);

    pxtJSON["palette"] = project.palette;

    const files = {
        "pkLib.ts": emitProjectLib(project),
        "assets.g.jres": jres,
        "assets.g.ts": ts,
        "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml">
        <variables></variables>
        <block type="pxt-on-start" x="0" y="0"></block>
      </xml>`,
        "main.ts": "",
        "pxt.json": JSON.stringify(pxtJSON, null, 4)
    }

    return files;
}


function emitProjectLib(project: Project) {
    const tilemaps = project.assets.filter(t => t.kind === "tilemap") as TilemapAsset[];

    return `
    ${emitCreateAsset(project)}
    ${emitSetTilemap(project)}
    setTilemap(${tilemaps[0].id});
    `;
}

const pxtJSON = {
    "name": "Untitled",
    "description": "",
    "dependencies": {
        "device": "*",
        "poughkeepsie-lib": "pub:42318-50126-14087-28283"
    },
    "files": [
        "pkLib.ts",
        "assets.g.jres",
        "assets.g.ts",
        "main.blocks",
        "main.ts"
    ],
    "preferredEditor": "blocksprj"
} as any;


function emitJres(project: Project) {
    const tmProject = new pxt.TilemapProject();
    const idMap = new Map<number, string>();

    for (const asset of project.assets) {
        if (asset.kind === "tilemap") {
            // TODO: emit tilemap preview?
        }
        else {
            const image = tmProject.createNewProjectImage(asset.frames[0]);
            idMap.set(asset.id, image.id);
        }
    }

    return {
        jres: JSON.stringify(tmProject.getProjectAssetsJRes()),
        ts: `
        ${emitJresDropdownEntries("SpriteAsset", "SpriteFixedInstance", project.assets.filter(a => a.kind === "sprite"), idMap)}
        ${emitJresDropdownEntries("TileAsset", "TileFixedInstance", project.assets.filter(a => a.kind === "tile"), idMap)}
        ${emitJresDropdownEntries("AvatarAsset", "AvatarFixedInstance", project.assets.filter(a => a.kind === "avatar"), idMap)}
        ${emitJresDropdownEntries("ItemAsset", "ItemFixedInstance", project.assets.filter(a => a.kind === "item"), idMap)}
        `
    }
}

function emitJresDropdownEntries(name: string, className: string, assets: Asset[], idMap: Map<number, string>) {
    return `namespace ${name} {
        ${assets.map(a =>
            `
            //% block="${a.name}"
            //% jres=${idMap.get(a.id)}
            //% fixedInstance whenUsed
            export const ${name}${a.id} = new pk.${className}(${a.id});
            `
        ).join("\n")}
    }`
}

interface LocationAsset {
    x: number;
    y: number;
    assetId: number;
}

function emitCreateAsset(project: Project) {
    const assets = project.assets.filter(a => a.kind !== "tilemap" && a.kind !== "tile") as (AvatarAsset | SpriteAsset | ItemAsset)[];

    return `function createAsset(id: number) {
        switch (id) {
            ${assets.map(a => `
                case ${a.id}:
                    return ${emitSpriteLike(a)};
            `).join("\n")}
        }
        return undefined;
    }`
}

function emitSetTilemap(project: Project) {
    const tilemaps = project.assets.filter(t => t.kind === "tilemap") as TilemapAsset[];

    return `function setTilemap(id: number) {
        ${tilemaps.map(tm => `
            if (id === ${tm.id}) {
                ${emitTilemap(tm, project)}
            }
        `).join("\n")}
    }`
}

function emitSpriteLike(asset: AvatarAsset | SpriteAsset | ItemAsset) {
    if (asset.kind === "avatar") {
        return emitAvatar(asset);
    }
    else if (asset.kind === "sprite") {
        return emitSprite(asset);
    }
    else if (asset.kind === "item") {
        return emitItem(asset);
    }
}

function emitTilemap(tm: TilemapAsset, project: Project) {
    const data = new pxt.sprite.Tilemap(tm.data.tilemap.width, tm.data.tilemap.height);
    const walls = new pxt.sprite.Bitmap(tm.data.tilemap.width, tm.data.tilemap.height);

    const tileset = project.assets.filter(a => a.kind === "tile") as TileAsset[];
    tileset.unshift(transparentAsset());
    const assetsToSpawn: LocationAsset[] = [];

    for (let y = 0; y < tm.data.tilemap.height; y++) {
        for (let x = 0; x < tm.data.tilemap.width; x++) {
            const index = tm.data.tilemap.get(x, y);
            const tile = tm.data.tileset.tiles[index];

            if (index === 0 || tile.id === "myTiles.transparency8" || tile.id === "transparency8") {
                data.set(x, y, 0);
            }
            else {
                const [type, id] = tile.meta.displayName?.split("_") as [string, string];

                if (type === "tile") {
                    const tileIndex = tileset.findIndex(t => t.id.toString() === id);
                    assert(tileIndex !== -1, `Tile not found: ${id}`);
                    data.set(x, y, tileIndex);

                    const tile = tileset[tileIndex];
                    if (tile.isWall) {
                        walls.set(x, y, 2);
                    }
                }
                else {
                    assetsToSpawn.push({
                        x,
                        y,
                        assetId: parseInt(id)
                    });
                }
            }
        }
    }

    const args = [
        `${tm.id}`,
        tilemapToTilemapLiteral(data),
        pxt.sprite.bitmapToImageLiteral(walls, "typescript"),
        `[${tileset.map(t => emitTile(t)).join(",")}]`,
        pxt.sprite.tileWidthToTileScale(8)
    ]

    const encodedData = `pk.createTilemapData(${args.join(",")})`;

    return `
    pk.setTilemap(${encodedData});
    ${assetsToSpawn.map(a => `
        createAsset(${a.assetId}).setLocation(${a.x}, ${a.y});
    `).join("\n")}
    `;
}

function emitTile(tile: TileAsset) {
    return emitImageAsset(tile, "createTile");
}

function emitItem(item: ItemAsset) {
    return emitImageAsset(item, "createItem");
}

function emitAvatar(avatar: AvatarAsset) {
    return emitImageAsset(avatar, "createAvatar");
}

function emitSprite(sprite: SpriteAsset) {
    return emitImageAsset(sprite, "createSprite");
}

function transparentAsset(): TileAsset {
    return {
        id: 0,
        kind: "tile",
        name: "Transparent",
        frames: [new pxt.sprite.Bitmap(8, 8).data()],
        isWall: false,
        interval: 100
    }
}

function emitImageAsset(asset: ImageAsset, functionName: string) {
    return `pk.${functionName}(
        ${asset.id},
        ${asset.interval},
        [${asset.frames.map(f => pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(f), "typescript")).join(",")}]
    )`
}

function tilemapToTilemapLiteral(t: pxt.sprite.Tilemap): string {
    if (!t) return `hex\`\``;
    return `hex\`${pxt.sprite.hexEncodeTilemap(t)}\``;
}