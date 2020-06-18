/// <reference path="../../built/pxtlib.d.ts" />


namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface FieldTilemapOptions {
        initWidth: string;
        initHeight: string;

        filter?: string;
    }

    interface ParsedFieldTilemapOptions {
        initWidth: number;
        initHeight: number;
        filter?: string;
    }

    // 32 is specifically chosen so that we can scale the images for the default
    // sprite sizes without getting browser anti-aliasing
    const PREVIEW_WIDTH = 32;
    const PADDING = 5;
    const BG_PADDING = 4;
    const BG_WIDTH = BG_PADDING * 2 + PREVIEW_WIDTH;
    const TOTAL_WIDTH = PADDING * 2 + BG_PADDING * 2 + PREVIEW_WIDTH;

    export class FieldTilemap extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public SERIALIZABLE = true;

        private params: ParsedFieldTilemapOptions;
        private blocksInfo: pxtc.BlocksInfo;
        private state: pxt.sprite.TilemapData;
        private lightMode: boolean;
        private undoRedoState: any;

        isGreyBlock: boolean;

        constructor(text: string, params: any, validator?: Function) {
            super(text, validator);

            this.lightMode = params.lightMode;
            this.params = parseFieldOptions(params);
            this.blocksInfo = params.blocksInfo;

            // Update now that we have blocksinfo
            if (text && !this.state) this.doValueUpdate_(text);

            this.initState();
        }

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

            if (this.sourceBlock_) {
                upgradeTilemapsInWorkspace(this.sourceBlock_.workspace, pxt.react.getTilemapProject());
            }

            (this.params as any).blocksInfo = this.blocksInfo;

            const fv = pxt.react.getFieldEditorView("tilemap-editor", this.state, this.params);

            if (this.undoRedoState) {
                fv.restorePersistentData(this.undoRedoState);
            }

            fv.onHide(() => {
                const result = fv.getResult();

                if (result) {
                    const old = this.getValue();

                    this.state = result;

                    const project = pxt.react.getTilemapProject();

                    for (let i = 0; i < result.tileset.tiles.length; i++) {
                        const tile = result.tileset.tiles[i];

                        if (tile.id.startsWith("*")) {
                            const newTile = project.createNewTile(tile.bitmap);
                            result.tileset.tiles[i] = newTile;
                        }
                        else if (!tile.data) {
                            result.tileset.tiles[i] = project.resolveTile(tile.id);
                        }
                    }

                    this.redrawPreview();

                    this.undoRedoState = fv.getPersistentData();

                    if (this.sourceBlock_ && Blockly.Events.isEnabled()) {
                        Blockly.Events.fire(new Blockly.Events.BlockChange(
                            this.sourceBlock_, 'field', this.name, old, this.getValue()));
                    }
                }
            });

            fv.show();
        }

        render_() {
            super.render_();

            if (!this.isGreyBlock) {
                this.size_.height = TOTAL_WIDTH
                this.size_.width = TOTAL_WIDTH;
            }
        }

        getValue() {
            if (this.isGreyBlock) return pxt.Util.htmlUnescape(this.value_);

            return pxt.sprite.encodeTilemap(this.state, "typescript");
        }

        getTileset() {
            return this.state.tileset;
        }

        doValueUpdate_(newValue: string) {
            if (newValue == null) {
                return;
            }
            this.value_ = newValue;
            this.parseBitmap(newValue);
            this.redrawPreview();

            super.doValueUpdate_(newValue);
        }

        redrawPreview() {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            if (this.isGreyBlock) {
                this.createTextElement_();
                this.updateEditable();
                return;
            }

            const bg = new svg.Rect()
                .at(PADDING, PADDING)
                .size(BG_WIDTH, BG_WIDTH)
                .setClass("blocklyTilemapField")
                .corner(4);

            this.fieldGroup_.appendChild(bg.el);

            if (this.state) {
                const data = tilemapToImageURI(this.state, PREVIEW_WIDTH, this.lightMode, this.blocksInfo);
                const img = new svg.Image()
                    .src(data)
                    .at(PADDING + BG_PADDING, PADDING + BG_PADDING)
                    .size(PREVIEW_WIDTH, PREVIEW_WIDTH);
                this.fieldGroup_.appendChild(img.el);
            }
        }

        private parseBitmap(newText: string) {
            if (!this.blocksInfo) return;

            const tilemap = pxt.sprite.decodeTilemap(newText, "typescript", pxt.react.getTilemapProject());

            // Ignore invalid bitmaps
            if (checkTilemap(tilemap)) {
                this.state = tilemap;
                this.isGreyBlock = false;
            }
            else if (newText.trim()) {
                this.isGreyBlock = true;
                this.value_ = newText;
            }
        }

        protected initState() {
            if (!this.state) {
                this.state = pxt.react.getTilemapProject().blankTilemap(16, this.params.initWidth, this.params.initHeight);
            }
        }

        getDisplayText_() {
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
    }

    function parseFieldOptions(opts: FieldTilemapOptions) {
        const parsed: ParsedFieldTilemapOptions = {
            initWidth: 16,
            initHeight: 16,
        };

        if (!opts) {
            return parsed;
        }

        if (opts.filter) {
            parsed.filter = opts.filter;
        }

        parsed.initWidth = withDefault(opts.initWidth, parsed.initWidth);
        parsed.initHeight = withDefault(opts.initHeight, parsed.initHeight);

        return parsed;

        function withDefault(raw: string, def: number) {
            const res = parseInt(raw);
            if (isNaN(res)) {
                return def;
            }
            return res;
        }
    }

    function deleteTile(localIndex: number, tilemap: pxt.sprite.Tilemap) {
        for (let x = 0; x < tilemap.width; x++) {
            for (let y = 0; y < tilemap.height; y++) {
                const value = tilemap.get(x, y);
                if (value === localIndex) {
                    tilemap.set(x, y, 0)
                }
                else if (value > localIndex) {
                    tilemap.set(x, y, value - 1);
                }
            }
        }
    }

    function checkTilemap(tilemap: pxt.sprite.TilemapData) {
        if (!tilemap || !tilemap.tilemap || !tilemap.tilemap.width || !tilemap.tilemap.height) return false;

        if (!tilemap.layers || tilemap.layers.width !== tilemap.tilemap.width || tilemap.layers.height !== tilemap.tilemap.height) return false;

        if (!tilemap.tileset) return false;

        return true;
    }

    function checkLegacyTilemap(tilemap: pxt.sprite.legacy.LegacyTilemapData, galleryItems: pxt.sprite.GalleryItem[]) {
        if (!tilemap || !tilemap.tilemap || !tilemap.tilemap.width || !tilemap.tilemap.height) return false;

        if (!tilemap.layers || tilemap.layers.width !== tilemap.tilemap.width || tilemap.layers.height !== tilemap.tilemap.height) return false;

        if (!tilemap.tileset) return false;

        for (const tile of tilemap.tileset.tiles) {
            if (tile && (tile.projectId >= 0 || (tile.qualifiedName && galleryItems.some(g => g.qName === tile.qualifiedName)))) {
                continue;
            }

            return false;
        }

        return true;
    }
}
