/// <reference path="../../built/pxtlib.d.ts" />


namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface FieldAssetEditorOptions {
        initWidth: string;
        initHeight: string;

        disableResize: string;
    }

    interface ParsedFieldAssetEditorOptions {
        initWidth: number;
        initHeight: number;
        disableResize: boolean;
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

    export abstract class FieldAssetEditor<U extends FieldAssetEditorOptions, V extends ParsedFieldAssetEditorOptions> extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public SERIALIZABLE = true;

        protected asset: pxt.Asset;
        protected params: V;

        protected blocksInfo: pxtc.BlocksInfo;
        protected lightMode: boolean;
        protected undoRedoState: any;
        protected pendingEdit = false

        // If input is invalid, the subclass can set this to be true. The field will instead
        // render as a grey block and preserve the decompiled code
        public isGreyBlock: boolean;

        constructor(text: string, params: any, validator?: Function) {
            super(text, validator);

            this.lightMode = params.lightMode;
            this.params = this.parseFieldOptions(params);
            this.blocksInfo = params.blocksInfo;

            this.initState();
        }

        protected abstract getAssetType(): pxt.AssetType;
        protected abstract createNewAsset(text?: string): pxt.Asset;
        protected abstract getValueText(): string;

        init() {
            if (this.fieldGroup_) {
                // Field has already been initialized once.
                return;
            }
            // Build the DOM.
            this.fieldGroup_ = Blockly.utils.dom.createSvgElement('g', {}, null) as SVGGElement;
            if (!this.visible_) {
                (this.fieldGroup_ as any).style.display = 'none';
            }

            this.initState();
            this.redrawPreview();

            this.updateEditable();
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().appendChild(this.fieldGroup_);

            // Force a render.
            this.render_();
            (this as any).mouseDownWrapper_ = Blockly.bindEventWithChecks_((this as any).getClickTarget_(), "mousedown", this, (this as any).onMouseDown_)
        }

        showEditor_() {
            if (this.isGreyBlock) return;

            (this.params as any).blocksInfo = this.blocksInfo;

            let editorKind: string;

            switch (this.asset.type) {
                case pxt.AssetType.Tile:
                case pxt.AssetType.Image:
                    editorKind = "image-editor";
                    break;
                case pxt.AssetType.Animation:
                    editorKind = "animation-editor";
                    break;
                case pxt.AssetType.Tilemap:
                    editorKind = "tilemap-editor";
                    const allTiles = pxt.react.getTilemapProject().getProjectTiles(this.asset.data.tileset.tileWidth, true);

                    for (const tile of allTiles.tiles) {
                        if (!this.asset.data.tileset.tiles.some(t => t.id === tile.id)) {
                            this.asset.data.tileset.tiles.push(tile);
                        }
                    }
                    break;
            }


            const fv = pxt.react.getFieldEditorView(editorKind, this.asset, this.params);

            if (this.undoRedoState) {
                fv.restorePersistentData(this.undoRedoState);
            }

            pxt.react.getTilemapProject().pushUndo();

            fv.onHide(() => {
                const result = fv.getResult();
                const project = pxt.react.getTilemapProject();

                if (result) {
                    const old = this.getValue();
                    if (pxt.assetEquals(this.asset, result)) return;

                    this.pendingEdit = true;
                    this.asset = result;
                    const lastRevision = project.revision();

                    this.onEditorClose(this.asset);
                    this.updateAssetListener();
                    this.updateAssetMeta();
                    this.redrawPreview();

                    this.undoRedoState = fv.getPersistentData();

                    if (this.sourceBlock_ && Blockly.Events.isEnabled()) {
                        Blockly.Events.fire(new BlocklyTilemapChange(
                            this.sourceBlock_, 'field', this.name, old, this.getValue(), lastRevision, project.revision()));
                    }
                    this.pendingEdit = false;
                }
            });

            fv.show();
        }

        render_() {
            super.render_();

            if (!this.isGreyBlock) {
                this.size_.height = TOTAL_HEIGHT;
                this.size_.width = TOTAL_WIDTH;
            }
        }

        getDisplayText_() {
            // This is only used when isGreyBlock is true
            const text = pxt.Util.htmlUnescape(this.value_);
            return text.substr(0, text.indexOf("(")) + "(...)";;
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
            if (this.isGreyBlock) return pxt.Util.htmlUnescape(this.value_);

            return this.getValueText();
        }

        doValueUpdate_(newValue: string) {
            if (newValue == null) {
                return;
            }
            this.value_ = newValue;
            this.parseValueText(newValue);
            this.redrawPreview();

            super.doValueUpdate_(newValue);
        }

        dispose() {
            super.dispose();

            pxt.react.getTilemapProject().removeChangeListener(this.getAssetType(), this.assetChangeListener);

            this.disposeOfTemporaryAsset();
        }

        disposeOfTemporaryAsset() {
            if (this.isTemporaryAsset()) {
                pxt.react.getTilemapProject().removeAsset(this.asset);
                this.asset = undefined;
            }
        }

        protected onEditorClose(newValue: pxt.Asset) {
            // Subclass
        }

        protected redrawPreview() {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            if (this.isGreyBlock) {
                this.createTextElement_();
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
                }
                const img = new svg.Image()
                    .src(dataURI)
                    .at(X_PADDING + BG_PADDING, Y_PADDING + BG_PADDING)
                    .size(PREVIEW_WIDTH, PREVIEW_WIDTH);
                this.fieldGroup_.appendChild(img.el);
            }
        }

        protected parseValueText(newText: string) {
            if (this.sourceBlock_ && !this.sourceBlock_.isInFlyout) {
                const project = pxt.react.getTilemapProject();

                const id = pxt.blocks.getBlockDataForField(this.sourceBlock_, this.name);
                if (id) {
                    this.asset = project.lookupAsset(this.getAssetType(), id);
                }
                else {
                    if (!newText) return;
                    if (this.asset) {
                        if (this.sourceBlock_ && this.asset.meta.blockIDs) {
                            this.asset.meta.blockIDs = this.asset.meta.blockIDs.filter(id => id !== this.sourceBlock_.id);
                            project.updateAsset(this.asset);
                        }
                    }
                    this.asset = this.createNewAsset(newText);
                }
                this.updateAssetMeta();
                this.updateAssetListener();
            }
        }

        protected parseFieldOptions(opts: U): V {
            // NOTE: This implementation is duplicated in pxtcompiler/emitter/service.ts
            // TODO: Refactor to share implementation.
            const parsed: ParsedFieldAssetEditorOptions = {
                initWidth: 16,
                initHeight: 16,
                disableResize: false,
            };

            if (!opts) {
                return parsed as V;
            }

            if (opts.disableResize) {
                parsed.disableResize = opts.disableResize.toLowerCase() === "true" || opts.disableResize === "1";
            }

            parsed.initWidth = withDefault(opts.initWidth, parsed.initWidth);
            parsed.initHeight = withDefault(opts.initHeight, parsed.initHeight);

            return parsed as V;

            function withDefault(raw: string, def: number) {
                const res = parseInt(raw);
                if (isNaN(res)) {
                    return def;
                }
                return res;
            }
        }

        protected initState() {
            if (!this.asset && this.sourceBlock_ && !this.sourceBlock_.isInFlyout) {
                const project = pxt.react.getTilemapProject();

                const id = pxt.blocks.getBlockDataForField(this.sourceBlock_, this.name);
                if (id) {
                    this.asset = project.lookupAsset(this.getAssetType(), id);
                }
                if (!this.asset) {
                    this.asset = this.createNewAsset();
                }
                this.updateAssetListener();
            }
            this.updateAssetMeta();
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
                    this.asset.meta.blockIDs.push(this.sourceBlock_.id);
                }
                pxt.blocks.setBlockDataForField(this.sourceBlock_, this.name, this.asset.id);
            }

            pxt.react.getTilemapProject().updateAsset(this.asset);
        }

        protected updateAssetListener() {
            pxt.react.getTilemapProject().removeChangeListener(this.getAssetType(), this.assetChangeListener);
            if (this.asset) {
                pxt.react.getTilemapProject().addChangeListener(this.asset, this.assetChangeListener);
            }
        }

        protected assetChangeListener = () => {
            if (this.pendingEdit) return;
            const id = pxt.blocks.getBlockDataForField(this.sourceBlock_, this.name);
            if (id) {
                this.asset = pxt.react.getTilemapProject().lookupAsset(this.getAssetType(), id);
            }
            this.redrawPreview();
        }

        protected isTemporaryAsset() {
            return this.asset && !this.asset.meta.displayName;
        }
    }

    export class BlocklyTilemapChange extends Blockly.Events.BlockChange {

        constructor(block: Blockly.Block, element: string, name: string, oldValue: any, newValue: any, protected oldRevision: number, protected newRevision: number) {
            super(block, element, name, oldValue, newValue);
        }

        isNull() {
            return this.oldRevision === this.newRevision && super.isNull();
        }

        run(forward: boolean) {
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
