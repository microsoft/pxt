import { Asset, BaseAsset, ImageAsset, Project, TilemapAsset } from "../types/project";
import { getIconBitmap } from "./icons";

const SPRITE_WIDTH = 1 << 3;

export function createNewProject(): Project {
    let res: Project = {
        nextId: 1,
        revision: 0,
        assets: [],
        palette: [
            "#000000",
            "#FFFFFF",
            "#FF0000",
            "#FF007D",
            "#FF7a00",
            "#e5FF00",
            "#2D9F00",
            "#00FF72",
            "#0034FF",
            "#17ABFF",
            "#C600FF",
            "#636363",
            "#7400DB",
            "#00EFFF",
            "#DF2929",
            "#000000",
        ]
    };

    const createAsset = (type: "sprite" | "avatar" | "tile" | "item") => {
        res = createNewAsset(res, type);
        (res.assets[res.assets.length - 1] as ImageAsset).frames[0] = getIconBitmap(type)!.data();
    }

    createAsset("avatar");
    createAsset("sprite");
    createAsset("item");
    createAsset("tile");
    res = createNewAsset(res, "tilemap");

    return res;
}

export function createNewAsset(project: Project, assetKind: Asset["kind"]) {
    const newAsset: BaseAsset = {
        id: project.nextId++,
        name: assetKind + project.nextId,
        kind: assetKind
    };

    if (assetKind === "tilemap") {
        const tilemapAsset = newAsset as TilemapAsset;
        tilemapAsset.data = new pxt.sprite.TilemapData(
            new pxt.sprite.Tilemap(20, 15),
            {
                tileWidth: SPRITE_WIDTH,
                tiles: []
            },
            new pxt.sprite.Bitmap(20, 15).data()
        );
    }
    else {
        const imageAsset = newAsset as ImageAsset;
        imageAsset.frames = [new pxt.sprite.Bitmap(SPRITE_WIDTH, SPRITE_WIDTH).data()];
        imageAsset.interval = 500;
    }

    return {
        ...project,
        assets: project.assets.concat([newAsset as Asset]),
        revision: project.revision + 1
    };
}

export function updateAsset(project: Project, asset: Asset): Project {
    return {
        ...project,
        revision: project.revision + 1,
        assets: project.assets.map(a => a.id === asset.id ? asset : a)
    };
}

export function getAsset(project: Project, assetId: number) {
    return project.assets.find(asset => asset.id === assetId);
}

export function getAssetFromFiles(project: Project, assetId: number, files: pxt.Map<string>): Asset {
    const existing = getAsset(project, assetId)!;

    const tmProject = new pxt.TilemapProject();
    tmProject.loadAssetsJRes(JSON.parse(files[pxt.IMAGES_JRES]));
    tmProject.loadTilemapJRes(JSON.parse(files[pxt.TILEMAP_JRES]));

    const displayName = pxtAssetId(existing);

    if (existing.kind === "tilemap") {
        const tm = tmProject.lookupAssetByName("tilemap" as pxt.AssetType.Tilemap, displayName);

        return {
            ...existing,
            data: tm.data
        }
    }
    else {
        const anim = tmProject.lookupAssetByName("animation" as pxt.AssetType.Animation, displayName);

        return {
            ...existing,
            frames: anim.frames,
            interval: anim.interval
        };
    }
}

function pxtAssetId(asset: BaseAsset) {
    return asset.kind + "_" + asset.id;
}

export function getProjectFiles(project: Project, assetId: number) {
    const tmProject = new pxt.TilemapProject();

    const idMap = new Map<number, string>();
    const tileIdMap = new Map<number, string>();
    const tilemapIdMap = new Map<number, string>();

    const imageAssets = project.assets.filter(asset => asset.kind !== "tilemap") as ImageAsset[];
    const tilemaps = project.assets.filter(asset => asset.kind === "tilemap") as TilemapAsset[];

    imageAssets.sort((a, b) => {
        if (a.kind !== b.kind) {
            return a.kind.localeCompare(b.kind);
        }
        return a.id - b.id;
    });

    for (const asset of imageAssets) {
        const anim = tmProject.createNewAnimationFromData(
            asset.frames,
            asset.interval,
            pxtAssetId(asset)
        );

        idMap.set(asset.id, anim.id);

        const tile = tmProject.createNewTile(
            asset.frames[0],
            pxtAssetId(asset),
            pxtAssetId(asset) + "_name"
        );

        tileIdMap.set(asset.id, tile.id);
    }

    const tileset = imageAssets.map(asset => tmProject.lookupAsset("tile" as pxt.AssetType.Tile, tileIdMap.get(asset.id)!));
    tileset.unshift(tmProject.getTransparency(SPRITE_WIDTH));

    for (const tilemap of tilemaps) {
        const data = tilemap.data.cloneData();
        data.tileset.tiles = tileset.slice();

        const [ id ] = tmProject.createNewTilemapFromData(
            tilemap.data,
            pxtAssetId(tilemap)
        );

        tilemapIdMap.set(tilemap.id, id);
    }

    const asset = getAsset(project, assetId)!;
    let pxtAsset: pxt.Asset;

    if (asset.kind === "tilemap") {
        pxtAsset = tmProject.lookupAsset("tilemap" as pxt.AssetType.Tilemap, tilemapIdMap.get(asset.id)!);
    }
    else {
        pxtAsset = tmProject.lookupAsset("animation" as pxt.AssetType.Animation, idMap.get(asset.id)!);
    }

    const tmJres = tmProject.getProjectTilesetJRes();
    const tmTs = pxt.emitTilemapsFromJRes(tmJres);
    const imageJres = tmProject.getProjectAssetsJRes();
    const imageTs = pxt.emitProjectImages(imageJres);

    const files = {
        [pxt.IMAGES_CODE]: imageTs,
        [pxt.IMAGES_JRES]: JSON.stringify(imageJres),
        [pxt.TILEMAP_CODE]: tmTs,
        [pxt.TILEMAP_JRES]: JSON.stringify(tmJres),
    };

    return {
        pxtAsset,
        files
    };
}

export function getProjectTileset(project: Project) {
    const imageAssets = project.assets.filter(asset => asset.kind !== "tilemap") as ImageAsset[];

    imageAssets.sort((a, b) => {
        if (a.kind !== b.kind) {
            return a.kind.localeCompare(b.kind);
        }
        return a.id - b.id;
    });

    return ["myTiles.transparency8"].concat(imageAssets.map(asset => "myTiles." + pxtAssetId(asset)));
}

export function getProjectAnimatedTileset(project: Project): pxt.editor.AnimatedTile[] {
    const imageAssets = project.assets.filter(asset => asset.kind !== "tilemap") as ImageAsset[];

    imageAssets.sort((a, b) => {
        if (a.kind !== b.kind) {
            return a.kind.localeCompare(b.kind);
        }
        return a.id - b.id;
    });

    return imageAssets.map(asset => ({
        tileId: "myTiles." + pxtAssetId(asset),
        interval: asset.interval,
        frames: asset.frames
    }));
}

export function getTileId(asset: Asset) {
    return "myTiles." + pxtAssetId(asset);
}