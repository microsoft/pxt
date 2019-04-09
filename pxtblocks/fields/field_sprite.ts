/// <reference path="../../built/pxtlib.d.ts" />


namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface FieldSpriteEditorOptions {
        // Format is semicolon separated pairs, e.g. "width,height;width,height;..."
        sizes: string;

        // Index of initial color (defaults to 1)
        initColor: string;

        initWidth: string;
        initHeight: string;
    }

    interface ParsedSpriteEditorOptions {
        sizes: [number, number][];
        initColor: number;
        initWidth: number;
        initHeight: number;
    }

    // 32 is specifically chosen so that we can scale the images for the default
    // sprite sizes without getting browser anti-aliasing
    const PREVIEW_WIDTH = 32;
    const PADDING = 5;
    const BG_PADDING = 4;
    const BG_WIDTH = BG_PADDING * 2 + PREVIEW_WIDTH;
    const TOTAL_WIDTH = PADDING * 2 + BG_PADDING * 2 + PREVIEW_WIDTH;

    export class FieldSpriteEditor extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private params: ParsedSpriteEditorOptions;
        private blocksInfo: pxtc.BlocksInfo;
        private editor: pxtsprite.SpriteEditor;
        private state: pxtsprite.Bitmap;
        private lightMode: boolean;

        constructor(text: string, params: any, validator?: Function) {
            super(text, validator);

            this.lightMode = params.lightMode;
            this.params = parseFieldOptions(params);
            this.blocksInfo = params.blocksInfo;

            if (!this.state) {
                this.state = new pxtsprite.Bitmap(this.params.initWidth, this.params.initHeight);
            }
        }

        init() {
            if (this.fieldGroup_) {
                // Field has already been initialized once.
                return;
            }
            // Build the DOM.
            this.fieldGroup_ = Blockly.utils.createSvgElement('g', {}, null);
            if (!this.visible_) {
                (this.fieldGroup_ as any).style.display = 'none';
            }

            if (!this.state) {
                this.state = new pxtsprite.Bitmap(this.params.initWidth, this.params.initHeight);
            }

            this.redrawPreview();

            this.updateEditable();
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().appendChild(this.fieldGroup_);

            // Force a render.
            this.render_();
            (this as any).mouseDownWrapper_ = Blockly.bindEventWithChecks_((this as any).getClickTarget_(), "mousedown", this, (this as any).onMouseDown_)
        }

        /**
         * Show the inline free-text editor on top of the text.
         * @private
         */
        showEditor_() {
            const windowSize = goog.dom.getViewportSize();
            const scrollOffset = goog.style.getViewportPageOffset(document);

            // If there is an existing drop-down someone else owns, hide it immediately and clear it.
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.DropDownDiv.clearContent();

            let contentDiv = Blockly.DropDownDiv.getContentDiv() as HTMLDivElement;

            this.editor = new pxtsprite.SpriteEditor(this.state, this.blocksInfo, this.lightMode);
            this.editor.render(contentDiv);
            this.editor.rePaint();

            this.editor.onClose(() => {
                Blockly.DropDownDiv.hideIfOwner(this);
            });

            this.editor.setActiveColor(this.params.initColor, true);
            if (!this.params.sizes.some(s => s[0] === this.state.width && s[1] === this.state.height)) {
                this.params.sizes.push([this.state.width, this.state.height]);
            }
            this.editor.setSizePresets(this.params.sizes);

            goog.style.setHeight(contentDiv, this.editor.outerHeight() + 1);
            goog.style.setWidth(contentDiv, this.editor.outerWidth() + 1);
            goog.style.setStyle(contentDiv, "overflow", "hidden");
            goog.style.setStyle(contentDiv, "max-height", "500px");
            goog.dom.classlist.add(contentDiv.parentElement, "sprite-editor-dropdown")

            Blockly.DropDownDiv.setColour("#2c3e50", "#2c3e50");
            Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_, () => {
                this.state = this.editor.bitmap();
                this.redrawPreview();
                if (this.sourceBlock_ && Blockly.Events.isEnabled()) {
                    Blockly.Events.fire(new Blockly.Events.BlockChange(
                        this.sourceBlock_, 'field', this.name, this.text_, this.getText()));
                }

                goog.style.setHeight(contentDiv, null);
                goog.style.setWidth(contentDiv, null);
                goog.style.setStyle(contentDiv, "overflow", null);
                goog.style.setStyle(contentDiv, "max-height", null);
                (goog.dom.classlist as any).remove(contentDiv.parentElement, "sprite-editor-dropdown");
                this.editor.removeKeyListeners();
            });

            this.editor.addKeyListeners();
            this.editor.layout();
        }

        private isInFlyout() {
            return ((this.sourceBlock_.workspace as Blockly.WorkspaceSvg).getParentSvg() as SVGElement).className.baseVal == "blocklyFlyout";
        }

        render_() {
            super.render_();
            this.size_.height = TOTAL_WIDTH
            this.size_.width = TOTAL_WIDTH;
        }

        getText() {
            return pxtsprite.bitmapToImageLiteral(this.state, pxt.editor.FileType.TypeScript);
        }

        setText(newText: string) {
            if (newText == null) {
                return;
            }
            this.parseBitmap(newText);
            this.redrawPreview();

            super.setText(newText);
        }

        private redrawPreview() {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            const bg = new svg.Rect()
                .at(PADDING, PADDING)
                .size(BG_WIDTH, BG_WIDTH)
                .fill("#dedede")
                .stroke("#898989", 1)
                .corner(4);

            this.fieldGroup_.appendChild(bg.el);

            if (this.state) {
                const data = this.renderPreview();
                const img = new svg.Image()
                    .src(data)
                    .at(PADDING + BG_PADDING, PADDING + BG_PADDING)
                    .size(PREVIEW_WIDTH, PREVIEW_WIDTH);
                this.fieldGroup_.appendChild(img.el);
            }
        }

        private parseBitmap(newText: string) {
            const bmp = pxtsprite.imageLiteralToBitmap(newText);

            // Ignore invalid bitmaps
            if (bmp && bmp.width && bmp.height) {
                this.state = bmp;
            }
        }

        /**
         * Scales the image to 32x32 and returns a data uri. In light mode the preview
         * is drawn with no transparency (alpha is filled with background color)
         */
        private renderPreview() {
            const colors = pxt.appTarget.runtime.palette.slice(1);
            const canvas = document.createElement("canvas");
            canvas.width = PREVIEW_WIDTH;
            canvas.height = PREVIEW_WIDTH;

            // Works well for all of our default sizes, does not work well if the size is not
            // a multiple of 2 or is greater than 32 (i.e. from the decompiler)
            const cellSize = Math.min(PREVIEW_WIDTH / this.state.width, PREVIEW_WIDTH / this.state.height);

            // Center the image if it isn't square
            const xOffset = Math.max(Math.floor((PREVIEW_WIDTH * (1 - (this.state.width / this.state.height))) / 2), 0);
            const yOffset = Math.max(Math.floor((PREVIEW_WIDTH * (1 - (this.state.height / this.state.width))) / 2), 0);

            let context: CanvasRenderingContext2D;
            if (this.lightMode) {
                context = canvas.getContext("2d", { alpha: false });
                context.fillStyle = "#dedede";
                context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_WIDTH);
            }
            else {
                context = canvas.getContext("2d");
            }

            for (let c = 0; c < this.state.width; c++) {
                for (let r = 0; r < this.state.height; r++) {
                    const color = this.state.get(c, r);

                    if (color) {
                        context.fillStyle = colors[color - 1];
                        context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
                    }
                    else if (this.lightMode) {
                        context.fillStyle = "#dedede";
                        context.fillRect(xOffset + c * cellSize, yOffset + r * cellSize, cellSize, cellSize);
                    }
                }
            }

            return canvas.toDataURL();
        }
    }

    function parseFieldOptions(opts: FieldSpriteEditorOptions) {
        const parsed: ParsedSpriteEditorOptions = {
            sizes: [
                [8, 8],
                [8, 16],
                [16, 16],
                [16, 32],
                [32, 32],
            ],
            initColor: 1,
            initWidth: 16,
            initHeight: 16,
        };

        if (!opts) {
            return parsed;
        }

        if (opts.sizes != null) {
            const pairs = opts.sizes.split(";");
            const sizes: [number, number][] = [];
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i].split(",");
                if (pair.length !== 2) {
                    continue;
                }

                let width = parseInt(pair[0]);
                let height = parseInt(pair[1]);

                if (isNaN(width) || isNaN(height)) {
                    continue;
                }

                const screenSize = pxt.appTarget.runtime && pxt.appTarget.runtime.screenSize;
                if (width < 0 && screenSize)
                    width = screenSize.width;
                if (height < 0 && screenSize)
                    height = screenSize.height;

                sizes.push([width, height]);
            }
            if (sizes.length > 0) {
                parsed.sizes = sizes;
                parsed.initWidth = sizes[0][0];
                parsed.initHeight = sizes[0][1];
            }
        }

        parsed.initColor = withDefault(opts.initColor, parsed.initColor);
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
}