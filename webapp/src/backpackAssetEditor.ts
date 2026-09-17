import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";

/** Owns only the asseteditor.html iframe's scratch workspace and asset project. */
export class BackpackAssetEditor {
    private workspace: Blockly.WorkspaceSvg;
    private block: Blockly.BlockSvg;
    private field: Blockly.Field;
    private asset: pxt.Asset;
    private editorAssetId: string;
    private div: HTMLDivElement;
    private original: Blockly.serialization.blocks.State;
    private name: string;

    constructor(private project: pxt.TilemapProject) { }

    async open(request: pxt.editor.OpenBackpackAssetEditorRequest): Promise<pxt.Asset> {
        const { blocks } = pxtblockly.parseBackpackCode(request.code);
        const root = blocks[0];
        if (blocks.length !== 1 || !pxt.auth.isBackpackAssetType(root.type) || root.next
            || Object.keys(root.inputs || {}).length) throw new Error(lf("Choose a single Backpack asset."));
        this.original = root;
        this.name = request.name;

        // postMessage strips class prototypes. Restore the native snapshot collections,
        // not current-project files or a second field/JRES serialization format.
        const gallery = this.project.saveGallerySnapshot();
        for (const type of Object.keys(request.gallery.assets)) {
            const collection = request.gallery.assets[type];
            Object.setPrototypeOf(collection, Object.getPrototypeOf(gallery.assets[type]));
            if (type === pxt.AssetType.Tilemap) {
                for (const asset of (collection as unknown as { assets: pxt.ProjectTilemap[] }).assets) {
                    Object.setPrototypeOf(asset.data, pxt.sprite.TilemapData.prototype);
                    Object.setPrototypeOf(asset.data.tilemap, pxt.sprite.Tilemap.prototype);
                }
            }
            gallery.assets[type] = collection;
        }
        this.project.loadGallerySnapshot(gallery);
        window.addEventListener("resize", this.resize);
        pxtblockly.initializeAndInject(request.blocksInfo);
        this.div = document.createElement("div");
        this.div.style.cssText = "position:absolute;inset:0;visibility:hidden";
        this.div.setAttribute("aria-label", lf("Backpack asset block"));
        document.body.appendChild(this.div);
        this.workspace = Blockly.inject(this.div, { renderer: "pxt", sounds: false,
            trashcan: false, scrollbars: false, zoom: { startScale: 1.5 } });
        this.block = Blockly.serialization.blocks.append(root, this.workspace) as Blockly.BlockSvg;
        pxtblockly.FieldBase.flushInitQueue();
        this.workspace.render();
        await Blockly.renderManagement.finishQueuedRenders();
        this.block.setDeletable(false);
        this.block.setEditable(true);
        this.block.setMovable(true); // Required by captureBackpackBlock.
        this.block.setCollapsed(false);
        this.block.moveBy(32, 32);
        const fields = this.block.inputList.reduce<Blockly.Field[]>((all, input) => all.concat(input.fieldRow), []);
        this.field = fields.find(field => field instanceof pxtblockly.FieldAssetEditor)
            || fields.find(field => field instanceof pxtblockly.FieldTileset);
        if (this.field instanceof pxtblockly.FieldAssetEditor) {
            if (this.field.isGreyBlock) throw new Error(lf("This asset cannot be edited."));
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
            if (this.asset?.type !== pxt.AssetType.Tile) throw new Error(lf("The saved tile is unavailable."));
        }
        else {
            this.field = fields.find(field => field instanceof pxtblockly.FieldCustomMelody
                || root.type === "music_sounds" && field instanceof pxtblockly.FieldGridPicker);
            if (!this.field) throw new Error(lf("This asset has no supported editor."));
            this.div.style.visibility = "visible";
            Blockly.svgResize(this.workspace);
            Blockly.getFocusManager().focusNode(this.block);
            this.field.showEditor();
            return undefined;
        }
        if (!this.asset) throw new Error(lf("The saved asset is unavailable."));
        if (this.asset.type === pxt.AssetType.Tilemap) {
            pxt.sprite.addMissingTilemapTilesAndReferences(this.project, this.asset);
        }
        this.editorAssetId = this.asset.id;
        return pxt.cloneAsset(this.asset, true);
    }

    save(edited?: pxt.Asset): { code: string; blockText: string; name?: string } {
        // Commit native dropdown edits before capturing their real serialized fields.
        Blockly.DropDownDiv.hideWithoutAnimation();
        Blockly.WidgetDiv.hide();
        if (this.asset) {
            if (!edited || edited.type !== this.asset.type) throw new Error(lf("The asset editor is not ready."));
            let result = pxt.cloneAsset(edited, true);
            // A failed parent save leaves the native editor holding its original
            // temporary id. Reuse the promoted identity on subsequent captures.
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
        // Scratch-only interaction settings must not make the saved asset undeletable.
        for (const key of ["deletable", "editable", "movable", "collapsed"] as const) {
            if (this.original[key] === undefined) delete payload.blocks[0][key];
            else payload.blocks[0][key] = this.original[key];
        }
        return { ...captured, code: JSON.stringify(payload), name: this.asset ? edited?.meta?.displayName : this.name };
    }

    dispose(): void {
        window.removeEventListener("resize", this.resize);
        Blockly.DropDownDiv.hideWithoutAnimation();
        Blockly.WidgetDiv.hide();
        try { pxtblockly.FieldBase.flushInitQueue(); }
        finally {
            this.workspace?.dispose();
            this.div?.remove();
        }
    }

    private resize = (): void => {
        if (this.workspace) Blockly.svgResize(this.workspace);
    }
}