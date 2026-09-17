import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import { assetToGalleryItem } from "./assets";

export interface BackpackAssetPreview {
    previewURI: string;
    framePreviewURIs?: string[];
    interval?: number;
}

/** Decode with the registered native fields, without touching the editor's project or workspace. */
export function backpackAssetPreview(item: pxt.auth.BackpackItem, context: {
    gallery: pxt.AssetSnapshot;
    blocksInfo: pxtc.BlocksInfo;
}): BackpackAssetPreview | undefined {
    if (item.kind !== "asset") return undefined;

    try {
        const { blocks } = pxtblockly.parseBackpackCode(item.code);
        const root = blocks[0];
        if (blocks.length !== 1 || !pxt.auth.isBackpackAssetType(root.type) || root.next
            || Object.keys(root.inputs || {}).length
            || root.type === "melody_editor" || root.type === "music_sounds") return undefined;

        const project = new pxt.TilemapProject();
        // Snapshots contain native collections and tilemap classes. Detach all data,
        // including metadata arrays, then restore prototypes on only the scratch copy.
        const gallery = structuredClone(context.gallery);
        const emptyGallery = project.saveGallerySnapshot();
        for (const type of Object.keys(gallery.assets)) {
            const collection = gallery.assets[type];
            Object.setPrototypeOf(collection, Object.getPrototypeOf(emptyGallery.assets[type]));
            if (type === pxt.AssetType.Tilemap) {
                for (const asset of (collection as unknown as { assets: pxt.ProjectTilemap[] }).assets) {
                    Object.setPrototypeOf(asset.data, pxt.sprite.TilemapData.prototype);
                    Object.setPrototypeOf(asset.data.tilemap, pxt.sprite.Tilemap.prototype);
                }
            }
        }
        project.loadGallerySnapshot(gallery);

        const getTilemapProject = pxt.react.getTilemapProject;
        let workspace: Blockly.Workspace;
        Blockly.Events.disable(); // Balanced even when the caller already disabled events.
        try {
            pxt.react.getTilemapProject = () => project;
            workspace = new Blockly.Workspace();
            // The active editor already registered these blocks; never reinject them here.
            const block = Blockly.serialization.blocks.append(root, workspace);
            const fields = block.inputList.reduce<Blockly.Field[]>((all, input) => all.concat(input.fieldRow), []);
            let asset: pxt.Asset;
            for (const field of fields) {
                if (field instanceof pxtblockly.FieldAssetEditor) {
                    // Headless fields never enter FieldBase's rendered initialization queue.
                    field.onLoadedIntoWorkspace();
                    if (!field.isGreyBlock) asset = field.getAsset();
                }
                else if (field instanceof pxtblockly.FieldTileset) {
                    // Dropdown options may be stale after loadState; prefer the full saved state.
                    const saved = root.fields?.[field.name];
                    const tile = typeof saved === "object" ? pxtblockly.loadAssetFromSaveState(saved)
                        : project.lookupAsset(pxt.AssetType.Tile, saved)
                            || pxt.lookupProjectAssetByTSReference(saved, project)
                            || pxt.lookupProjectAssetByTSReference(field.getValue(), project)
                            || project.lookupAsset(pxt.AssetType.Tile, field.getValue());
                    if (tile?.type === pxt.AssetType.Tile) asset = tile;
                }
            }
            if (!asset) return undefined;
            // Gallery conversion attaches image URIs only to this detached asset.
            const preview = assetToGalleryItem(pxt.cloneAsset(asset, true));
            if (!preview?.previewURI) return undefined;
            return preview.type === pxt.AssetType.Animation
                ? { previewURI: preview.previewURI, framePreviewURIs: preview.framePreviewURIs, interval: preview.interval }
                : { previewURI: preview.previewURI };
        }
        finally {
            try { workspace?.dispose(); }
            finally {
                pxt.react.getTilemapProject = getTilemapProject;
                Blockly.Events.enable();
            }
        }
    }
    catch {
        // Unsupported, missing, or malformed native fields use the caller's fallback.
        return undefined;
    }
}