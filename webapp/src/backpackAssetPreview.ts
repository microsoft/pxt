import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import { assetToGalleryItem } from "./assets";
import { prepareBackpackAssetGallery } from "./backpackAssetGallery";

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
        if (blocks.length !== 1 || root.next || Object.keys(root.inputs || {}).length) return undefined;

        const project = new pxt.TilemapProject();
        const { snapshot: gallery } = prepareBackpackAssetGallery(context.gallery, project);
        project.loadGallerySnapshot(gallery);

        const getTilemapProject = pxt.react.getTilemapProject;
        let workspace: Blockly.Workspace;
        Blockly.Events.disable(); // Balanced even when the caller already disabled events.
        try {
            pxt.react.getTilemapProject = () => project;
            workspace = new Blockly.Workspace();
            // The active editor already registered these blocks; never reinject them here.
            const block = Blockly.serialization.blocks.append(root, workspace);
            const field = pxtblockly.getBackpackAssetField(block);
            let asset: pxt.Asset;
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