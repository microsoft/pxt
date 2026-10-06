import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import { assetToGalleryItem } from "./assets";
import { prepareBackpackAssetGallery } from "./backpackAssetGallery";

export interface BackpackAssetPreview {
    previewURI: string;
    framePreviewURIs?: string[];
    interval?: number;
}

/** Load saved fields in a separate project and workspace so previews cannot change the open project. */
export function backpackAssetPreview(
    item: pxt.auth.BackpackItem,
    context: {
        gallery: pxt.AssetSnapshot;
        blocksInfo: pxtc.BlocksInfo;
    }
): BackpackAssetPreview | undefined {
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
        Blockly.Events.disable(); // Blockly counts nested calls; finally restores the caller's event state.
        try {
            pxt.react.getTilemapProject = () => project;
            workspace = new Blockly.Workspace();
            // Use the blocks already registered by the active editor.
            const block = Blockly.serialization.blocks.append(root, workspace);
            const field = pxtblockly.getBackpackAssetField(block);
            let asset: pxt.Asset;

            if (field instanceof pxtblockly.FieldAssetEditor) {
                // A headless workspace does not run FieldBase's render-time initialization.
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

            // Gallery conversion adds image URIs, so give it a copy of the asset.
            const preview = assetToGalleryItem(pxt.cloneAsset(asset, true));
            if (!preview?.previewURI) return undefined;
            return preview.type === pxt.AssetType.Animation
                ? {
                    previewURI: preview.previewURI,
                    framePreviewURIs: preview.framePreviewURIs,
                    interval: preview.interval
                }
                : { previewURI: preview.previewURI };
        }
        finally {
            try {
                workspace?.dispose();
            }
            finally {
                pxt.react.getTilemapProject = getTilemapProject;
                Blockly.Events.enable();
            }
        }
    }
    catch {
        // The caller shows a fallback when a field cannot provide a preview.
        return undefined;
    }
}