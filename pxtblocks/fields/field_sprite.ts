/// <reference path="../../built/pxtlib.d.ts" />


namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface FieldSpriteEditorOptions {
        // Deprecated
        sizes: string;

        // Index of initial color (defaults to 1)
        initColor: string;

        initWidth: string;
        initHeight: string;

        disableResize: string;

        filter?: string;
    }

    interface ParsedSpriteEditorOptions {
        initColor: number;
        initWidth: number;
        initHeight: number;
        disableResize: boolean;
        filter?: string;
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
        public SERIALIZABLE = true;

        private params: ParsedSpriteEditorOptions;
        private blocksInfo: pxtc.BlocksInfo;
        private state: pxt.sprite.Bitmap;
        private lightMode: boolean;
        private undoRedoState: any;

        constructor(text: string, params: any, validator?: Function) {
            super(text, validator);

            this.lightMode = params.lightMode;
            this.params = parseFieldOptions(params);
            this.blocksInfo = params.blocksInfo;

            if (!this.state) {
                this.state = new pxt.sprite.Bitmap(this.params.initWidth, this.params.initHeight);
            }
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

            if (!this.state) {
                this.state = new pxt.sprite.Bitmap(this.params.initWidth, this.params.initHeight);
            }

            this.redrawPreview();

            this.updateEditable();
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().appendChild(this.fieldGroup_);

            // Force a render.
            this.render_();
            (this as any).mouseDownWrapper_ = Blockly.bindEventWithChecks_((this as any).getClickTarget_(), "mousedown", this, (this as any).onMouseDown_)
        }

        showEditor_() {
            (this.params as any).blocksInfo = this.blocksInfo;
            const fv = pxt.react.getFieldEditorView("image-editor", this.state, this.params);

            if (this.undoRedoState) {
                fv.restorePersistentData(this.undoRedoState);
            }

            fv.onHide(() => {
                const result = fv.getResult();

                if (result) {
                    const old = this.getValue();

                    this.state = result;
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
            this.size_.height = TOTAL_WIDTH
            this.size_.width = TOTAL_WIDTH;
        }

        getValue() {
            return pxt.sprite.bitmapToImageLiteral(this.state, pxt.editor.FileType.TypeScript);
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

        private redrawPreview() {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            const bg = new svg.Rect()
                .at(PADDING, PADDING)
                .size(BG_WIDTH, BG_WIDTH)
                .setClass("blocklySpriteField")
                .stroke("#898989", 1)
                .corner(4);

            this.fieldGroup_.appendChild(bg.el);

            if (this.state) {
                const data = bitmapToImageURI(this.state, PREVIEW_WIDTH, this.lightMode);
                const img = new svg.Image()
                    .src(data)
                    .at(PADDING + BG_PADDING, PADDING + BG_PADDING)
                    .size(PREVIEW_WIDTH, PREVIEW_WIDTH);
                this.fieldGroup_.appendChild(img.el);
            }
        }

        private parseBitmap(newText: string) {
            const bmp = pxt.sprite.imageLiteralToBitmap(newText);

            // Ignore invalid bitmaps
            if (bmp && bmp.width && bmp.height) {
                this.state = bmp;
            }
        }
    }

    function parseFieldOptions(opts: FieldSpriteEditorOptions) {
        const parsed: ParsedSpriteEditorOptions = {
            initColor: 1,
            initWidth: 16,
            initHeight: 16,
            disableResize: false,
        };

        if (!opts) {
            return parsed;
        }

        if (opts.sizes) {
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
                parsed.initWidth = sizes[0][0];
                parsed.initHeight = sizes[0][1];
            }
        }

        if (opts.filter) {
            parsed.filter = opts.filter;
        }

        if (opts.disableResize) {
            parsed.disableResize = opts.disableResize.toLowerCase() === "true" || opts.disableResize === "1";
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
