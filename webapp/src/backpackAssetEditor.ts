import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import { prepareBackpackAssetGallery } from "./backpackAssetGallery";

export interface BackpackAssetEditorOptions {
    code: string;
    gallery: pxt.AssetSnapshot;
    name?: string;
}

/** Edit saved assets in a separate workspace and project. */
export class BackpackAssetEditor {
    private workspace: Blockly.Workspace;
    private block: Blockly.Block;
    private field: Blockly.Field;
    private asset: pxt.Asset;
    private editorAssetId: string;
    private scalar = false;
    private original: Blockly.serialization.blocks.State;
    private name: string;

    constructor(public readonly project: pxt.TilemapProject) { }

    /** Field loaders use a global project getter, so restore it before returning or awaiting. */
    private withProject<T>(action: () => T): T {
        const getProject = pxt.react.getTilemapProject;
        Blockly.Events.disable();
        try {
            pxt.react.getTilemapProject = () => this.project;
            return action();
        } finally {
            pxt.react.getTilemapProject = getProject;
            Blockly.Events.enable();
        }
    }

    open(request: BackpackAssetEditorOptions, scalarHost?: HTMLDivElement): pxt.Asset {
        try {
            return this.withProject(() => this.openCore(request, scalarHost));
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    private openCore(request: BackpackAssetEditorOptions, scalarHost?: HTMLDivElement): pxt.Asset {
        const { blocks } = pxtblockly.parseBackpackCode(request.code);
        const root = blocks[0];
        if (blocks.length !== 1 || root.next
            || Object.keys(root.inputs || {}).length)
            throw new Error("Expected a single Backpack asset.");

        this.original = root;
        this.name = request.name;

        const { snapshot, projectGallery: gallery } = prepareBackpackAssetGallery(request.gallery, this.project);
        for (const type of Object.keys(snapshot.assets)) {
            gallery.assets[type] = snapshot.assets[type];
        }
        this.project.loadGallerySnapshot(gallery);
        this.workspace = new Blockly.Workspace();
        this.block = Blockly.serialization.blocks.append(root, this.workspace);
        this.field = pxtblockly.getBackpackAssetField(this.block);
        if (!this.field) throw new Error("This asset has no supported editor.");

        this.scalar = !(this.field instanceof pxtblockly.FieldAssetEditor || this.field instanceof pxtblockly.FieldTileset);
        if (this.scalar && scalarHost) {
            // Non-asset custom fields need a rendered workspace to open their editors.
            this.workspace.dispose();
            this.workspace = Blockly.inject(scalarHost, {
                renderer: "pxt",
                sounds: false,
                trashcan: false,
                scrollbars: false
            });
            this.block = Blockly.serialization.blocks.append(root, this.workspace);
            this.field = pxtblockly.getBackpackAssetField(this.block);
            if (!this.field) throw new Error("This asset has no supported editor.");
        }

        const fields = this.block.inputList.reduce<Blockly.Field[]>((all, input) => all.concat(input.fieldRow), []);
        fields.forEach(field => {
            if (field instanceof pxtblockly.FieldBase) field.onLoadedIntoWorkspace();
        });
        this.block.setEditable(true);
        this.block.setMovable(true); // Required by captureBackpackBlock.
        this.block.setCollapsed(false);

        if (this.field instanceof pxtblockly.FieldAssetEditor) {
            if (this.field.isGreyBlock) throw new Error("This asset cannot be edited.");
            this.asset = this.field.getAsset();
        }
        else if (this.field instanceof pxtblockly.FieldTileset) {
            // Use the original full state: a dropdown's selected option can be stale after loading.
            const saved = root.fields?.[this.field.name];
            this.asset = typeof saved === "object" ? pxtblockly.loadAssetFromSaveState(saved)
                : this.project.lookupAsset(pxt.AssetType.Tile, saved)
                    || pxt.lookupProjectAssetByTSReference(saved, this.project)
                    || pxt.lookupProjectAssetByTSReference(this.field.getValue(), this.project)
                    || this.project.lookupAsset(pxt.AssetType.Tile, this.field.getValue());
            if (this.asset?.type !== pxt.AssetType.Tile) throw new Error("The saved tile is unavailable.");
        }
        else {
            if (this.workspace.rendered) {
                const block = this.block as Blockly.BlockSvg;
                block.moveBy(32, 32);
                Blockly.svgResize(this.workspace as Blockly.WorkspaceSvg);
                this.field.showEditor();
            }
            return undefined;
        }
        if (!this.asset) throw new Error("The saved asset is unavailable.");

        if (this.asset.type === pxt.AssetType.Tilemap) {
            pxt.sprite.addMissingTilemapTilesAndReferences(this.project, this.asset);
        }
        this.editorAssetId = this.asset.id;
        return pxt.cloneAsset(this.asset, true);
    }

    save(edited?: pxt.Asset): { code: string; blockText: string; name?: string } {
        return this.withProject(() => this.saveCore(edited));
    }

    private saveCore(edited?: pxt.Asset): { code: string; blockText: string; name?: string } {
        // Close dropdowns so their final edits are included in the saved fields.
        if (this.scalar) {
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.WidgetDiv.hide();
        }

        if (this.asset) {
            if (!edited || edited.type !== this.asset.type) throw new Error("The asset editor is not ready.");
            let result = pxt.cloneAsset(edited, true);

            // After a failed save, the editor may still return the temporary ID.
            // Reuse the asset ID already assigned by the previous attempt.
            if (result.id === this.editorAssetId && this.asset.id !== this.editorAssetId) {
                result.id = this.asset.id;
                result.internalID = this.asset.internalID;
            }
            result = pxt.patchTemporaryAsset(this.asset, result, this.project);
            if (result.type === pxt.AssetType.Tilemap) pxt.sprite.updateTilemapReferencesFromResult(this.project, result);
            if (this.field instanceof pxtblockly.FieldTileset && result.type === pxt.AssetType.Tile) {
                // ImageEditor.getTile always marks the result as a project tile,
                // including edits that started from a gallery tile.
                result = (this.asset as pxt.Tile).isProjectTile ? this.project.updateAsset(result)
                    : this.project.createNewTile(result.bitmap, undefined, result.meta?.displayName);
                this.field.loadState(pxtblockly.getAssetSaveState(result));
            }
            else if (this.field instanceof pxtblockly.FieldAssetEditor) {
                if (result.meta?.displayName) this.project.updateAsset(result);
                pxtblockly.setBlockDataForField(this.block, this.field.name, result.meta?.displayName ? result.id : null);
                this.field.updateAsset(result);
            }
            this.asset = result;
        }

        const captured = pxtblockly.captureBackpackBlock(this.block);
        const payload = pxtblockly.parseBackpackCode(captured.code);

        // Restore the original block flags instead of saving the editor's interaction settings.
        for (const key of ["deletable", "editable", "movable", "collapsed"] as const) {
            if (this.original[key] === undefined) delete payload.blocks[0][key];
            else payload.blocks[0][key] = this.original[key];
        }
        return {
            ...captured,
            code: JSON.stringify(payload),
            name: this.asset ? edited?.meta?.displayName : this.name
        };
    }

    dispose(): void {
        this.withProject(() => {
            if (this.scalar) {
                Blockly.DropDownDiv.hideWithoutAnimation();
                Blockly.WidgetDiv.hide();
            }
            this.workspace?.dispose();
            this.workspace = undefined;
        });
    }
}