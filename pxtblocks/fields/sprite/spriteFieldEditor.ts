/// <reference path="./spriteEditor.ts" />
/// <reference path="../../../built/pxtlib.d.ts" />


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

    // These are the characters used to compile, for a list of every supported character see parseBitmap()
    const hexChars = [".", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

    export class FieldSpriteEditor extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private params: ParsedSpriteEditorOptions;
        private editor: SpriteEditor;
        private state: Bitmap;
        private lightMode: boolean;

        constructor(text: string, params: any, validator?: Function) {
            super(text, validator);

            this.lightMode = params.lightMode;
            this.params = parseFieldOptions(params);

            if (!this.state) {
                this.state = new Bitmap(this.params.initWidth, this.params.initHeight);
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
                this.state = new Bitmap(this.params.initWidth, this.params.initHeight);
            }

            this.redrawPreview();

            this.updateEditable();
            this.sourceBlock_.getSvgRoot().appendChild(this.fieldGroup_);

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

            this.editor = new SpriteEditor(this.state, this.lightMode);
            this.editor.render(contentDiv);
            this.editor.rePaint();

            this.editor.setActiveColor(this.params.initColor, true);
            this.editor.setSizePresets(this.params.sizes);

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
            });

            goog.style.setHeight(contentDiv, this.editor.outerHeight() + 1);
            goog.style.setWidth(contentDiv, this.editor.outerWidth() + 1);
            goog.style.setStyle(contentDiv, "overflow", "hidden");
            goog.style.setStyle(contentDiv, "max-height", "500px");

            this.editor.layout();
        }

        private isInFlyout() {
            return (this.sourceBlock_.workspace.getParentSvg() as SVGElement).className.baseVal == "blocklyFlyout";
        }

        render_() {
            super.render_();
            this.size_.height = TOTAL_WIDTH
            this.size_.width = TOTAL_WIDTH;
        }

        getText() {
            if (!this.state) {
                return "img``";
            }
            let res = "img`";

            for (let r = 0; r < this.state.height; r++) {
                res += "\n"
                for (let c = 0; c < this.state.width; c++) {
                    res += hexChars[this.state.get(c, r)] + " ";
                }
            }

            res += "\n`";

            return res;
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
            // Strip the tagged template string business and the whitespace. We don't have to exhaustively
            // replace encoded characters because the compiler will catch any disallowed characters and throw
            // an error before the decompilation happens. 96 is backtick and 9 is tab
            newText = newText.replace(/[ `]|(?:&#96;)|(?:&#9;)|(?:img)/g, "").trim();
            newText = newText.replace(/&#10;/g, "\n");

            const rows = newText.split("\n");

            // We support "ragged" sprites so not all rows will be the same length
            const sprite: number[][] = [];
            let spriteWidth = 0;

            for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                const rowValues: number[] = [];
                for (let c = 0; c < row.length; c++) {
                    // This list comes from libs/screen/targetOverrides.ts
                    switch (row[c]) {
                        case "0": case ".": rowValues.push(0); break;
                        case "1": case "#": rowValues.push(1); break;
                        case "2": case "T": rowValues.push(2); break;
                        case "3": case "t": rowValues.push(3); break;
                        case "4": case "N": rowValues.push(4); break;
                        case "5": case "n": rowValues.push(5); break;
                        case "6": case "G": rowValues.push(6); break;
                        case "7": case "g": rowValues.push(7); break;
                        case "8": rowValues.push(8); break;
                        case "9": rowValues.push(9); break;
                        case "a": case "A": case "R": rowValues.push(10); break;
                        case "b": case "B": case "P": rowValues.push(11); break;
                        case "c": case "C": case "p": rowValues.push(12); break;
                        case "d": case "D": case "O": rowValues.push(13); break;
                        case "e": case "E": case "Y": rowValues.push(14); break;
                        case "f": case "F": case "W": rowValues.push(15); break;
                    }
                }

                if (rowValues.length) {
                    sprite.push(rowValues);
                    spriteWidth = Math.max(spriteWidth, rowValues.length);
                }
            }

            const spriteHeight = sprite.length;

            if (spriteHeight === 0 || spriteWidth === 0) {
                // This isn't great because it changes the underlying code; the user entered
                // an empty/invalid sprite and we are converting it to an empty 16x16 sprite
                // next time the project saves. The best behavior would be to flag this in
                // the decompiler and return a grey block but that's not supported.
                return;
            }

            this.state = new Bitmap(spriteWidth, spriteHeight)

            for (let r = 0; r < spriteHeight; r++) {
                const row = sprite[r];
                for (let c = 0; c < spriteWidth; c++) {
                    if (c < row.length) {
                        this.state.set(c, r, row[c]);
                    }
                    else {
                        this.state.set(c, r, 0);
                    }
                }
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

                const width = parseInt(pair[0]);
                const height = parseInt(pair[1]);

                if (isNaN(width) || isNaN(height)) {
                    continue;
                }

                sizes.push([width, height]);
            }

            parsed.sizes = sizes;
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