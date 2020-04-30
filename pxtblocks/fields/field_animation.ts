/// <reference path="../../built/pxtlib.d.ts" />


namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface FieldAnimationOptions {
        initWidth: string;
        initHeight: string;

        filter?: string;
    }

    export interface ParsedFieldAnimationOptions {
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
    const ICON_WIDTH = 30;
    const TOTAL_HEIGHT = PADDING * 2 + BG_PADDING * 2 + PREVIEW_WIDTH;
    const TOTAL_WIDTH = TOTAL_HEIGHT + ICON_WIDTH;

    export class FieldAnimationEditor extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public SERIALIZABLE = true;

        protected params: ParsedFieldAnimationOptions;
        protected blocksInfo: pxtc.BlocksInfo;
        protected lightMode: boolean;
        protected undoRedoState: any;

        protected state: pxt.sprite.AnimationData;
        protected frames: string[];

        protected preview: svg.Image;
        protected animateRef: number;

        constructor(text: string, params: any, validator?: Function) {
            super(text, validator);

            this.lightMode = params.lightMode;
            this.params = parseFieldOptions(params);
            this.blocksInfo = params.blocksInfo;

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

            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().addEventListener("mouseenter", this.onMouseEnter);
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().addEventListener("mouseleave", this.onMouseLeave);

            this.updateEditable();
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().appendChild(this.fieldGroup_);

            // Force a render.
            this.render_();
            (this as any).mouseDownWrapper_ = Blockly.bindEventWithChecks_((this as any).getClickTarget_(), "mousedown", this, (this as any).onMouseDown_);

            this.state.interval = this.getParentInterval();
        }

        showEditor_() {
            (this.params as any).blocksInfo = this.blocksInfo;

            this.initState();
            const parentInterval = this.getParentInterval();

            if (!isNaN(parentInterval)) this.state.interval = parentInterval;

            const fv = pxt.react.getFieldEditorView("animation-editor", this.state, this.params);

            if (this.undoRedoState) {
                fv.restorePersistentData(this.undoRedoState);
            }

            fv.onHide(() => {
                const result = fv.getResult();

                if (result) {
                    const old = this.getValue();

                    this.state = result;

                    if (!isNaN(this.state.interval)) {
                        this.setParentInterval(this.state.interval);
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
            this.size_.height = TOTAL_HEIGHT
            this.size_.width = TOTAL_WIDTH;
        }

        getValue() {
            if (!this.state) return "[]";
            return "[" + this.state.frames.map(frame =>
                pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(frame), pxt.editor.FileType.TypeScript)
            ).join(",") + "]"
        }

        doValueUpdate_(newValue: string) {
            if (newValue == null) {
                return;
            }
            this.value_ = newValue;


            const frames = parseImageArrayString(newValue);

            if (frames && frames.length) {
                this.initState();
                this.state.frames = frames;
            }

            this.redrawPreview();

            super.doValueUpdate_(newValue);
        }

        protected redrawPreview() {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            const bg = new svg.Rect()
                .at(PADDING + ICON_WIDTH, PADDING)
                .size(BG_WIDTH, BG_WIDTH)
                .corner(4)
                .setClass("blocklyAnimationField");

            this.fieldGroup_.appendChild(bg.el);

            const icon = new svg.Text("\uf008")
                .at(PADDING, 5 + (TOTAL_HEIGHT >> 1))
                .fill((this.sourceBlock_ as Blockly.BlockSvg).getColourSecondary())
                .setClass("semanticIcon");

            this.fieldGroup_.appendChild(icon.el);

            if (this.state) {
                this.frames = this.state.frames.map(frame => bitmapToImageURI(pxt.sprite.Bitmap.fromData(frame), PREVIEW_WIDTH, this.lightMode));
                this.preview = new svg.Image()
                    .src(this.frames[0])
                    .at(PADDING + BG_PADDING + ICON_WIDTH, PADDING + BG_PADDING)
                    .size(PREVIEW_WIDTH, PREVIEW_WIDTH);
                this.fieldGroup_.appendChild(this.preview.el);
            }
        }

        protected onMouseEnter = () => {
            if (this.animateRef) return;

            const interval = this.state.interval > 50 ? this.state.interval : 50;

            let index = 0;
            this.animateRef = setInterval(() => {
                if (this.preview && this.frames[index]) this.preview.src(this.frames[index]);
                index = (index + 1) % this.frames.length;
            }, interval);
        }

        protected onMouseLeave = () => {
            if (this.animateRef) clearInterval(this.animateRef);
            this.animateRef = undefined;

            if (this.preview && this.frames[0]) {
                this.preview.src(this.frames[0]);
            }
        }

        protected getParentIntervalBlock(): Blockly.Block {
            const s = this.sourceBlock_;
            if (s.parentBlock_) {
                const p = s.parentBlock_;
                for (const input of p.inputList) {
                    if (input.name === "frameInterval") {
                        return input.connection.targetBlock();
                    }
                }
            }

            return undefined;
        }

        protected setParentInterval(interval: number) {
            const target = this.getParentIntervalBlock();

            if (target) {
                const fieldName = getFieldName(target);
                if (fieldName) {
                    target.setFieldValue(String(interval), fieldName);
                }
            }
        }

        protected getParentInterval() {
            const target = this.getParentIntervalBlock();

            if (target) {
                const fieldName = getFieldName(target);
                if (fieldName) {
                    return Number(target.getFieldValue(fieldName))
                }
            }

            return 100;
        }

        protected initState() {
            if (!this.state) {
                if (this.params) {
                    this.state = {
                        frames: [new pxt.sprite.Bitmap(this.params.initWidth, this.params.initHeight).data()],
                        interval: 100
                    }
                }
                else {
                    this.state = {
                        frames: [],
                        interval: 100
                    }
                }
            }
        }
    }

    function parseFieldOptions(opts: FieldAnimationOptions) {
        const parsed: ParsedFieldAnimationOptions = {
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

    function parseImageArrayString(str: string): pxt.sprite.BitmapData[] {
        str = str.replace(/[\[\]]/mg, "");
        return str.split(",").map(s => pxt.sprite.imageLiteralToBitmap(s).data()).filter(b => b.height && b.width);
    }

    function isNumberType(type: string) {
        return type === "math_number" || type === "math_integer" || type === "math_whole_number";
    }

    function getFieldName(target: Blockly.Block) {
        if (target.type === "math_number_minmax") {
            return "SLIDER";
        }
        else if (isNumberType(target.type)) {
            return "NUM";
        }
        else if (target.type === "timePicker") {
            return "ms";
        }

        return null;
    }
}