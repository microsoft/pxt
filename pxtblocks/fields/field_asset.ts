/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="./field_base.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface FieldAssetEditorOptions {
        initWidth?: string;
        initHeight?: string;

        disableResize?: string;
    }

    interface ParsedFieldAssetEditorOptions {
        initWidth?: number;
        initHeight?: number;
        disableResize?: boolean;
        lightMode?: boolean;
    }

    // 32 is specifically chosen so that we can scale the images for the default
    // sprite sizes without getting browser anti-aliasing
    const PREVIEW_WIDTH = 32;
    const X_PADDING = 5;
    const Y_PADDING = 1;
    const BG_PADDING = 4;
    const BG_WIDTH = BG_PADDING * 2 + PREVIEW_WIDTH;
    const TOTAL_HEIGHT = Y_PADDING * 2 + BG_PADDING * 2 + PREVIEW_WIDTH;
    const TOTAL_WIDTH = X_PADDING * 2 + BG_PADDING * 2 + PREVIEW_WIDTH;

    export abstract class FieldAssetEditor<U extends FieldAssetEditorOptions, V extends ParsedFieldAssetEditorOptions> extends FieldBase<U> {
        protected asset: pxt.Asset;
        protected params: V;

        protected blocksInfo: pxtc.BlocksInfo;
        protected lightMode: boolean;
        protected undoRedoState: any;
        protected pendingEdit = false;
        protected isEmpty = false;

        // If input is invalid, the subclass can set this to be true. The field will instead
        // render as a grey block and preserve the decompiled code
        public isGreyBlock: boolean;

        constructor(text: string, params: any, validator?: Function) {
            super(text, params, validator);

            this.lightMode = params.lightMode;
            this.params = this.parseFieldOptions(params);
            this.blocksInfo = params.blocksInfo;
        }

        protected abstract getAssetType(): pxt.AssetType;
        protected abstract createNewAsset(text?: string): pxt.Asset;
        protected abstract getValueText(): string;

        onInit() {
            this.redrawPreview();
        }

        onValueChanged(newValue: string) {
            this.parseValueText(newValue);
            this.redrawPreview();
            return this.getValueText();
        }

        showEditor_() {
            if (this.isGreyBlock) return;

            const params: any = {...this.params};

            params.blocksInfo = this.blocksInfo;

            let editorKind: string;

            switch (this.asset.type) {
                case pxt.AssetType.Tile:
                case pxt.AssetType.Image:
                    editorKind = "image-editor";
                    params.temporaryAssets = getTemporaryAssets(this.sourceBlock_.workspace, pxt.AssetType.Image);
                    break;
                case pxt.AssetType.Animation:
                    editorKind = "animation-editor";
                    params.temporaryAssets = getTemporaryAssets(this.sourceBlock_.workspace, pxt.AssetType.Image)
                        .concat(getTemporaryAssets(this.sourceBlock_.workspace, pxt.AssetType.Animation));
                    break;
                case pxt.AssetType.Tilemap:
                    editorKind = "tilemap-editor";
                    const project = pxt.react.getTilemapProject();
                    pxt.sprite.addMissingTilemapTilesAndReferences(project, this.asset);

                    for (const tile of getTilesReferencedByTilesets(this.sourceBlock_.workspace)) {
                        if (this.asset.data.projectReferences.indexOf(tile.id) === -1) {
                            this.asset.data.projectReferences.push(tile.id);
                        }
                    }
                    break;
                case pxt.AssetType.Song:
                    editorKind = "music-editor";
                    params.temporaryAssets = getTemporaryAssets(this.sourceBlock_.workspace, pxt.AssetType.Song);
                    setMelodyEditorOpen(this.sourceBlock_, true);
                    break;
            }


            if (this.isFullscreen()) {
                this.showEditorFullscreen(editorKind, params);
            }
            else {
                this.showEditorInWidgetDiv(editorKind, params);
            }
        }

        protected showEditorFullscreen(editorKind: string, params: any) {
            const fv = pxt.react.getFieldEditorView(editorKind, this.asset, params);

            if (this.undoRedoState) {
                fv.restorePersistentData(this.undoRedoState);
            }

            pxt.react.getTilemapProject().pushUndo();

            fv.onHide(() => {
                this.onFieldEditorHide(fv);
            });

            fv.show();
        }

        protected showEditorInWidgetDiv(editorKind: string, params: any) {
            let bbox: Blockly.utils.Rect;

            // This is due to the changes in https://github.com/microsoft/pxt-blockly/pull/289
            // which caused the widgetdiv to jump around if any fields underneath changed size
            let widgetOwner = {
                getScaledBBox: () => bbox
            }

            Blockly.WidgetDiv.show(widgetOwner, this.sourceBlock_.RTL, () => {
                if (document.activeElement && document.activeElement.tagName === "INPUT") (document.activeElement as HTMLInputElement).blur();

                fv.hide();

                widgetDiv.classList.remove("sound-effect-editor-widget");
                widgetDiv.style.transform = "";
                widgetDiv.style.position = "";
                widgetDiv.style.left = "";
                widgetDiv.style.top = "";
                widgetDiv.style.width = "";
                widgetDiv.style.height = "";
                widgetDiv.style.opacity = "";
                widgetDiv.style.transition = "";
                widgetDiv.style.alignItems = "";

                this.onFieldEditorHide(fv);
            })

            const widgetDiv = Blockly.WidgetDiv.DIV as HTMLDivElement;

            const fv = pxt.react.getFieldEditorView(editorKind, this.asset, params, widgetDiv);

            const block = this.sourceBlock_ as Blockly.BlockSvg;
            const bounds = block.getBoundingRectangle();
            const coord = workspaceToScreenCoordinates(block.workspace as Blockly.WorkspaceSvg,
                new Blockly.utils.Coordinate(bounds.right, bounds.top));

            const animationDistance = 20;

            const left = coord.x - 400;
            const top = coord.y + 60 - animationDistance;
            widgetDiv.style.opacity = "0";
            widgetDiv.classList.add("sound-effect-editor-widget");
            widgetDiv.style.position = "absolute";
            widgetDiv.style.left = left + "px";
            widgetDiv.style.top = top + "px";
            widgetDiv.style.width = "50rem";
            widgetDiv.style.height = "34.25rem";
            widgetDiv.style.display = "flex";
            widgetDiv.style.alignItems = "center";
            widgetDiv.style.transition = "transform 0.25s ease 0s, opacity 0.25s ease 0s";
            widgetDiv.style.borderRadius = "";

            fv.onHide(() => {
                Blockly.WidgetDiv.hideIfOwner(widgetOwner);
            });

            fv.show();

            const divBounds = widgetDiv.getBoundingClientRect();
            const injectDivBounds = block.workspace.getInjectionDiv().getBoundingClientRect();

            if (divBounds.height > injectDivBounds.height) {
                widgetDiv.style.height = "";
                widgetDiv.style.top = `calc(1rem - ${animationDistance}px)`;
                widgetDiv.style.bottom = `calc(1rem + ${animationDistance}px)`;
            }
            else {
                if (divBounds.bottom > injectDivBounds.bottom || divBounds.top < injectDivBounds.top) {
                    // This editor is pretty tall, so just center vertically on the inject div
                    widgetDiv.style.top = (injectDivBounds.top + (injectDivBounds.height / 2) - (divBounds.height / 2)) - animationDistance + "px";
                }
            }

            const toolboxWidth = block.workspace.getToolbox().getWidth();
            const workspaceLeft = injectDivBounds.left + toolboxWidth;

            if (divBounds.width > injectDivBounds.width - toolboxWidth) {
                widgetDiv.style.width = "";
                widgetDiv.style.left = "1rem";
                widgetDiv.style.right = "1rem";
            }
            else {
                // Check to see if we are bleeding off the right side of the canvas
                if (divBounds.left + divBounds.width >= injectDivBounds.right) {
                    // If so, try and place to the left of the block instead of the right
                    const blockLeft = workspaceToScreenCoordinates(block.workspace as Blockly.WorkspaceSvg,
                        new Blockly.utils.Coordinate(bounds.left, bounds.top));

                    if (blockLeft.x - divBounds.width - 20 > workspaceLeft) {
                        widgetDiv.style.left = (blockLeft.x - divBounds.width - 20) + "px"
                    }
                    else {
                        // As a last resort, just center on the inject div
                        widgetDiv.style.left = (workspaceLeft + ((injectDivBounds.width - toolboxWidth) / 2) - divBounds.width / 2) + "px";
                    }
                }
                else if (divBounds.left < injectDivBounds.left) {
                    widgetDiv.style.left = workspaceLeft + "px"
                }
            }

            const finalDimensions = widgetDiv.getBoundingClientRect();
            bbox = new Blockly.utils.Rect(finalDimensions.top, finalDimensions.bottom, finalDimensions.left, finalDimensions.right);

            requestAnimationFrame(() => {
                widgetDiv.style.opacity = "1";
                widgetDiv.style.transform = `translateY(${animationDistance}px)`;
            })
        }

        protected onFieldEditorHide(fv: pxt.react.FieldEditorView<pxt.Asset>) {
            const result = fv.getResult();
            const project = pxt.react.getTilemapProject();

            if (this.asset.type === pxt.AssetType.Song) {
                setMelodyEditorOpen(this.sourceBlock_, false);
            }

            if (result) {
                const old = this.getValue();
                if (pxt.assetEquals(this.asset, result)) return;

                const oldId = isTemporaryAsset(this.asset) ? null : this.asset.id;
                let newId = isTemporaryAsset(result) ? null : result.id;

                if (!oldId && newId === this.sourceBlock_.id) {
                    // The temporary assets we create just use the block id as the id; give it something
                    // a little nicer
                    result.id = project.generateNewID(result.type);
                    newId = result.id;
                }

                this.pendingEdit = true;

                if (result.meta?.displayName) this.disposeOfTemporaryAsset();
                this.asset = result;
                const lastRevision = project.revision();

                this.onEditorClose(this.asset);
                this.updateAssetListener();
                this.updateAssetMeta();
                this.redrawPreview();

                this.undoRedoState = fv.getPersistentData();

                if (this.sourceBlock_ && Blockly.Events.isEnabled()) {
                    const event = new BlocklyTilemapChange(
                        this.sourceBlock_, 'field', this.name, old, this.getValue(), lastRevision, project.revision());

                    if (oldId !== newId) {
                        event.oldAssetId = oldId;
                        event.newAssetId = newId;
                    }

                    Blockly.Events.fire(event);
                }
                this.pendingEdit = false;
            }
        }

        render_() {
            if (this.isGreyBlock && !this.textElement_) {
                this.createTextElement_();
            }
            super.render_();

            if (!this.isGreyBlock) {
                this.size_.height = TOTAL_HEIGHT;
                this.size_.width = TOTAL_WIDTH;
            }
        }

        getDisplayText_() {
            // This is only used when isGreyBlock is true
            if (this.isGreyBlock) {
                const text = pxt.Util.htmlUnescape(this.valueText);
                return text.substr(0, text.indexOf("(")) + "(...)";
            }
            return "";
        }

        updateEditable() {
            if (this.isGreyBlock && this.fieldGroup_) {
                const group = this.fieldGroup_;
                Blockly.utils.dom.removeClass(group, 'blocklyNonEditableText');
                Blockly.utils.dom.removeClass(group, 'blocklyEditableText');
                group.style.cursor = '';
            }
            else {
                super.updateEditable();
            }
        }

        getValue() {
            if (this.isGreyBlock) return pxt.Util.htmlUnescape(this.valueText);

            return this.getValueText();
        }

        onDispose() {
            if (this.sourceBlock_?.workspace && !this.sourceBlock_.workspace.rendered) {
                this.disposeOfTemporaryAsset();
            }
            pxt.react.getTilemapProject().removeChangeListener(this.getAssetType(), this.assetChangeListener);
        }

        disposeOfTemporaryAsset() {
            if (this.isTemporaryAsset()) {
                pxt.react.getTilemapProject().removeAsset(this.asset);
                this.setBlockData(null);
                this.asset = undefined;
            }
        }

        clearTemporaryAssetData() {
            if (this.isTemporaryAsset()) {
                this.setBlockData(null);
            }
        }

        isTemporaryAsset() {
            return isTemporaryAsset(this.asset);
        }

        getAsset() {
            return this.asset;
        }

        updateAsset(asset: pxt.Asset) {
            this.asset = asset;
            this.setValue(this.getValue());
        }

        protected onEditorClose(newValue: pxt.Asset) {
            // Subclass
        }

        protected redrawPreview() {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            if (this.isGreyBlock) {
                this.createTextElement_();
                this.render_();
                this.updateEditable();
                return;
            }

            const bg = new svg.Rect()
                .at(X_PADDING, Y_PADDING)
                .size(BG_WIDTH, BG_WIDTH)
                .setClass("blocklySpriteField")
                .stroke("#898989", 1)
                .corner(4);

            this.fieldGroup_.appendChild(bg.el);

            if (this.asset) {
                let dataURI: string;
                switch (this.asset.type) {
                    case pxt.AssetType.Image:
                    case pxt.AssetType.Tile:
                        dataURI = bitmapToImageURI(pxt.sprite.Bitmap.fromData(this.asset.bitmap), PREVIEW_WIDTH, this.lightMode);
                        break;
                    case pxt.AssetType.Animation:
                        dataURI = bitmapToImageURI(pxt.sprite.Bitmap.fromData(this.asset.frames[0]), PREVIEW_WIDTH, this.lightMode);
                        break;
                    case pxt.AssetType.Tilemap:
                        dataURI = tilemapToImageURI(this.asset.data, PREVIEW_WIDTH, this.lightMode);
                        break;
                    case pxt.AssetType.Song:
                        dataURI = songToDataURI(this.asset.song, 60, 20, this.lightMode);
                        break;
                }

                if (dataURI) {
                    const img = new svg.Image()
                        .src(dataURI)
                        .at(X_PADDING + BG_PADDING, Y_PADDING + BG_PADDING)
                        .size(PREVIEW_WIDTH, PREVIEW_WIDTH);
                    this.fieldGroup_.appendChild(img.el);
                }
            }
        }

        protected parseValueText(newText: string) {
            newText = pxt.Util.htmlUnescape(newText);
            if (this.sourceBlock_ && !this.sourceBlock_.isInFlyout) {
                const project = pxt.react.getTilemapProject();

                const id = this.getBlockData();
                const existing = project.lookupAsset(this.getAssetType(), id);
                if (existing && !(newText && this.isEmpty)) {
                    this.asset = existing;
                }
                else {
                    this.setBlockData(null);
                    if (this.asset) {
                        if (this.sourceBlock_ && this.asset.meta.blockIDs) {
                            this.asset.meta.blockIDs = this.asset.meta.blockIDs.filter(id => id !== this.sourceBlock_.id);

                            if (!this.isTemporaryAsset()) {
                                project.updateAsset(this.asset);
                            }
                        }
                    }
                    this.isEmpty = !newText;
                    this.asset = this.createNewAsset(newText);
                }
                this.updateAssetMeta();
                this.updateAssetListener();
            }
        }

        protected parseFieldOptions(opts: U): V {
            const parsed: ParsedFieldAssetEditorOptions = {
                initWidth: 16,
                initHeight: 16,
                disableResize: false,
                lightMode: false
            };

            if (!opts) {
                return parsed as V;
            }

            if (opts.disableResize) {
                parsed.disableResize = opts.disableResize.toLowerCase() === "true" || opts.disableResize === "1";
            }

            parsed.initWidth = withDefault(opts.initWidth, parsed.initWidth);
            parsed.initHeight = withDefault(opts.initHeight, parsed.initHeight);
            parsed.lightMode = (opts as any).lightMode;

            return parsed as V;

            function withDefault(raw: string, def: number) {
                const res = parseInt(raw);
                if (isNaN(res)) {
                    return def;
                }
                return res;
            }
        }

        protected updateAssetMeta() {
            if (!this.asset) return;

            if (!this.asset.meta) {
                this.asset.meta = {};
            }

            if (!this.asset.meta.blockIDs) {
                this.asset.meta.blockIDs = [];
            }

            if (this.sourceBlock_) {
                if (this.asset.meta.blockIDs.indexOf(this.sourceBlock_.id) === -1) {
                    const blockIDs = this.asset.meta.blockIDs;
                    if (blockIDs.length && this.isTemporaryAsset() && blockIDs.some(id => this.sourceBlock_.workspace.getBlockById(id))) {
                        // This temporary asset is already used, so we should clone a copy for ourselves
                        this.asset = pxt.cloneAsset(this.asset)
                        this.asset.meta.blockIDs = [];
                    }
                    this.asset.meta.blockIDs.push(this.sourceBlock_.id);
                }
                this.setBlockData(this.isTemporaryAsset() ? null : this.asset.id);
            }

            if (!this.isTemporaryAsset()) {
                pxt.react.getTilemapProject().updateAsset(this.asset);
            }
            else {
                this.asset.meta.temporaryInfo = {
                    blockId: this.sourceBlock_.id,
                    fieldName: this.name
                };
            }
        }

        protected updateAssetListener() {
            pxt.react.getTilemapProject().removeChangeListener(this.getAssetType(), this.assetChangeListener);
            if (this.asset && !this.isTemporaryAsset()) {
                pxt.react.getTilemapProject().addChangeListener(this.asset, this.assetChangeListener);
            }
        }

        protected assetChangeListener = () => {
            if (this.pendingEdit) return;
            const id = this.getBlockData();
            if (id) {
                this.asset = pxt.react.getTilemapProject().lookupAsset(this.getAssetType(), id);
            }
            this.redrawPreview();
        }

        protected isFullscreen() {
            return true;
        }
    }

    function isTemporaryAsset(asset: pxt.Asset) {
        return asset && !asset.meta.displayName;
    }

    export class BlocklyTilemapChange extends Blockly.Events.BlockChange {
        oldAssetId: string;
        newAssetId: string;
        fieldName: string;

        constructor(block: Blockly.Block, element: string, name: string, oldValue: any, newValue: any, protected oldRevision: number, protected newRevision: number) {
            super(block, element, name, oldValue, newValue);
            this.fieldName = name;
        }

        isNull() {
            return this.oldRevision === this.newRevision && super.isNull();
        }

        run(forward: boolean) {
            if (this.newAssetId || this.oldAssetId) {
                const block = this.getEventWorkspace_().getBlockById(this.blockId);

                if (forward) {
                    pxt.blocks.setBlockDataForField(block, this.fieldName, this.newAssetId);
                }
                else {
                    pxt.blocks.setBlockDataForField(block, this.fieldName, this.oldAssetId);
                }
            }

            if (forward) {
                pxt.react.getTilemapProject().redo();
                super.run(forward);
            }
            else {
                pxt.react.getTilemapProject().undo();
                super.run(forward);
            }

            const ws = this.getEventWorkspace_();

            // Fire an event to force a recompile, but make sure it doesn't end up on the undo stack
            const ev = new BlocklyTilemapChange(
                ws.getBlockById(this.blockId), 'tilemap-revision', "revision", null, pxt.react.getTilemapProject().revision(), 0, 0);
            ev.recordUndo = false;

            Blockly.Events.fire(ev)
        }
    }
}
