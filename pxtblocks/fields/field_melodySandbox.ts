/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;
    export const HEADER_HEIGHT = 50;
    export const TOTAL_WIDTH = 300;

    export class FieldCustomMelody<U extends Blockly.FieldCustomOptions> extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public SERIALIZABLE = true;

        protected params: U;
        private melody: pxtmelody.MelodyArray;
        private soundingKeys: number = 0;
        private numRow: number = 8;
        private numCol: number = 8;
        private tempo: number = 120;
        private stringRep: string;
        private isPlaying: boolean = false;
        private timeouts: number[] = []; // keep track of timeouts
        private invalidString: string;
        private prevString: string;

        // DOM references
        private topDiv: HTMLDivElement;
        private editorDiv: HTMLDivElement;
        private gridDiv: SVGSVGElement;
        private bottomDiv: HTMLDivElement;
        private doneButton: HTMLButtonElement;
        private playButton: HTMLButtonElement;
        private playIcon: HTMLElement;
        private tempoInput: HTMLInputElement;

        // grid elements
        private static CELL_WIDTH = 25;
        private static CELL_HORIZONTAL_MARGIN = 7;
        private static CELL_VERTICAL_MARGIN = 5;
        private static CELL_CORNER_RADIUS = 5;
        private elt: SVGSVGElement;
        private cells: SVGRectElement[][];
        private static VIEWBOX_WIDTH: number;
        private static VIEWBOX_HEIGHT: number;

        // preview field elements
        private static COLOR_BLOCK_WIDTH = 10;
        private static COLOR_BLOCK_HEIGHT = 20;
        private static COLOR_BLOCK_X = 20;
        private static COLOR_BLOCK_Y = 5;
        private static COLOR_BLOCK_SPACING = 2;
        private static MUSIC_ICON_WIDTH = 20;

        // Use toggle from sprite editor
        private toggle: Toggle;
        private root: svg.SVG;
        private gallery: pxtmelody.MelodyGallery;

        constructor(value: string, params: U, validator?: Function) {
            super(value, validator);
            this.params = params;
            this.createMelodyIfDoesntExist();
        }

        init() {
            super.init();
            this.onInit();
        }

        showEditor_() {
            // If there is an existing drop-down someone else owns, hide it immediately and clear it.
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.DropDownDiv.clearContent();
            Blockly.DropDownDiv.setColour(this.getDropdownBackgroundColour(), this.getDropdownBorderColour());

            let contentDiv = Blockly.DropDownDiv.getContentDiv() as HTMLDivElement;
            pxt.BrowserUtils.addClass(contentDiv, "melody-content-div");
            pxt.BrowserUtils.addClass(contentDiv.parentElement, "melody-editor-dropdown");

            this.gallery = new pxtmelody.MelodyGallery();
            this.renderEditor(contentDiv);

            this.prevString = this.getValue();

            // The webapp listens to this event and stops the simulator so that you don't get the melody
            // playing twice (once in the editor and once when the code runs in the sim)
            Blockly.Events.fire(new Blockly.Events.Ui(this.sourceBlock_, "melody-editor", false, true))

            Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_, () => {
                this.onEditorClose();
                // revert all style attributes for dropdown div
                pxt.BrowserUtils.removeClass(contentDiv, "melody-content-div");
                pxt.BrowserUtils.removeClass(contentDiv.parentElement, "melody-editor-dropdown");

                Blockly.Events.fire(new Blockly.Events.Ui(this.sourceBlock_, "melody-editor", true, false))
            });
        }

        getValue() {
            this.stringRep = this.getTypeScriptValue();
            return this.stringRep;
        }

        doValueUpdate_(newValue: string) {
            if (newValue == null || newValue == "" || newValue == "\"\"" || (this.stringRep && this.stringRep === newValue)) { // ignore empty strings
                return;
            }
            this.stringRep = newValue;
            this.parseTypeScriptValue(newValue);
            super.doValueUpdate_(this.getValue());
        }

        // This will be run when the field is created (i.e. when it appears on the workspace)
        protected onInit() {
            this.render_();
            this.createMelodyIfDoesntExist();

            if (this.invalidString) {
                Blockly.FieldLabel.prototype.setValue.call(this, pxt.Util.lf("Invalid Input"));
            } else {
                if (!this.fieldGroup_) {
                    // Build the DOM.
                    this.fieldGroup_ = Blockly.utils.dom.createSvgElement('g', {}, null) as SVGGElement;
                }
                if (!this.visible_) {
                    (this.fieldGroup_ as any).style.display = 'none';
                }

                (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().appendChild(this.fieldGroup_);
                this.updateFieldLabel();
            }
        }

        render_() {
            super.render_();
            if (!this.invalidString) {
                this.size_.width = FieldCustomMelody.MUSIC_ICON_WIDTH + (FieldCustomMelody.COLOR_BLOCK_WIDTH + FieldCustomMelody.COLOR_BLOCK_SPACING) * this.numCol;
            }
            this.sourceBlock_.setColour("#ffffff");
        }

        // Render the editor that will appear in the dropdown div when the user clicks on the field
        protected renderEditor(div: HTMLDivElement) {
            let color = this.getDropdownBackgroundColour();
            let secondaryColor = this.getDropdownBorderColour();

            this.topDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.topDiv, "melody-top-bar-div")

            // Same toggle set up as sprite editor
            this.root = new svg.SVG(this.topDiv).id("melody-editor-header-controls");
            this.toggle = new Toggle(this.root, { leftText: lf("Editor"), rightText: lf("Gallery"), baseColor: color });
            this.toggle.onStateChange(isLeft => {
                if (isLeft) {
                    this.hideGallery();
                }
                else {
                    this.showGallery();
                }
            });
            this.toggle.layout();
            this.toggle.translate((TOTAL_WIDTH - this.toggle.width()) / 2, 0);

            div.appendChild(this.topDiv);
            div.appendChild(this.gallery.getElement());

            this.editorDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.editorDiv, "melody-editor-div");
            this.editorDiv.style.setProperty("background-color", secondaryColor);

            this.gridDiv = this.createGridDisplay();
            this.editorDiv.appendChild(this.gridDiv);

            this.bottomDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.bottomDiv, "melody-bottom-bar-div");

            this.doneButton = document.createElement("button");
            pxt.BrowserUtils.addClass(this.doneButton, "melody-confirm-button");
            this.doneButton.innerText = lf("Done");
            this.doneButton.addEventListener("click", () => this.onDone());
            this.doneButton.style.setProperty("background-color", color);

            this.playButton = document.createElement("button");
            this.playButton.id = "melody-play-button";
            this.playButton.addEventListener("click", () => this.togglePlay());

            this.playIcon = document.createElement("i");
            this.playIcon.id = "melody-play-icon";
            pxt.BrowserUtils.addClass(this.playIcon, "play icon");
            this.playButton.appendChild(this.playIcon);

            this.tempoInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.tempoInput, "ui input");
            this.tempoInput.type = "number";
            this.tempoInput.title = lf("tempo");
            this.tempoInput.id = "melody-tempo-input";
            this.tempoInput.addEventListener("input", () => this.setTempo(+this.tempoInput.value));
            this.syncTempoField(true);

            this.bottomDiv.appendChild(this.tempoInput);
            this.bottomDiv.appendChild(this.playButton);
            this.bottomDiv.appendChild(this.doneButton);
            this.editorDiv.appendChild(this.bottomDiv);

            div.appendChild(this.editorDiv);
        }

        // Runs when the editor is closed by clicking on the Blockly workspace
        protected onEditorClose() {
            this.stopMelody();
            if (this.gallery) {
                this.gallery.stopMelody();
            }
            this.clearDomReferences();

            if (this.sourceBlock_ && Blockly.Events.isEnabled() && this.getValue() !== this.prevString) {
                Blockly.Events.fire(new Blockly.Events.BlockChange(
                    this.sourceBlock_, 'field', this.name, this.prevString, this.getValue()));
            }

            this.prevString = undefined;
        }

        // when click done
        private onDone() {
            Blockly.DropDownDiv.hideIfOwner(this);
            this.onEditorClose();
        }

        private clearDomReferences() {
            this.topDiv = null;
            this.editorDiv = null;
            this.gridDiv = null;
            this.bottomDiv = null;
            this.doneButton = null;
            this.playButton = null;
            this.playIcon = null;
            this.tempoInput = null;
            this.elt = null;
            this.cells = null;
            this.toggle = null;
            this.root = null;
            this.gallery.clearDomReferences();
        }

        // This is the string that will be inserted into the user's TypeScript code
        protected getTypeScriptValue(): string {
            if (this.invalidString) {
                return this.invalidString;
            }
            if (this.melody) {
                return "\"" + this.melody.getStringRepresentation() + "\"";
            }
            return "";
        }

        // This should parse the string returned by getTypeScriptValue() and restore the state based on that
        protected parseTypeScriptValue(value: string) {
            let oldValue: string = value;
            try {
                value = value.slice(1, -1); // remove the boundary quotes
                value = value.trim(); // remove boundary white space
                this.createMelodyIfDoesntExist();
                let notes: string[] = value.split(" ");

                notes.forEach(n => {
                    if (!this.isValidNote(n)) throw new Error(lf("Invalid note '{0}'. Notes can be C D E F G A B C5", n));
                });

                this.melody.resetMelody();

                for (let j = 0; j < notes.length; j++) {
                    if (notes[j] != "-") {
                        let rowPos: number = pxtmelody.noteToRow(notes[j]);
                        this.melody.updateMelody(rowPos, j);
                    }
                }
                this.updateFieldLabel();
            } catch (e) {
                pxt.log(e)
                this.invalidString = oldValue;
            }
        }

        private isValidNote(note: string): boolean {
            switch (note) {
                case "C":
                case "D":
                case "E":
                case "F":
                case "G":
                case "A":
                case "B":
                case "C5":
                case "-": return true;
            }
            return false;
        }

        // The width of the preview on the block itself
        protected getPreviewWidth(): number {
            this.updateSize_();
            return this.size_.width;
        }

        // The height of the preview on the block itself
        protected getPreviewHeight(): number {
            return this.constants_.FIELD_BORDER_RECT_HEIGHT;
        }

        protected getDropdownBackgroundColour() {
            return this.sourceBlock_.parentBlock_.getColour();
        }

        protected getDropdownBorderColour() {
            return (this.sourceBlock_.parentBlock_ as Blockly.BlockSvg).getColourTertiary();
        }

        private updateFieldLabel(): void {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            let musicIcon = mkText("\uf001")
                .appendClass("melody-editor-field-icon")
                .at(6, 15);
            this.fieldGroup_.appendChild(musicIcon.el);

            let notes = this.melody.getStringRepresentation().trim().split(" ");

            for (let i = 0; i < notes.length; i++) {
                let className = pxtmelody.getColorClass(pxtmelody.noteToRow(notes[i]));
                const cb = new svg.Rect()
                    .at((FieldCustomMelody.COLOR_BLOCK_WIDTH + FieldCustomMelody.COLOR_BLOCK_SPACING) * i + FieldCustomMelody.COLOR_BLOCK_X, FieldCustomMelody.COLOR_BLOCK_Y)
                    .size(FieldCustomMelody.COLOR_BLOCK_WIDTH, FieldCustomMelody.COLOR_BLOCK_HEIGHT)
                    .stroke("#898989", 1)
                    .corners(3, 2);

                pxt.BrowserUtils.addClass(cb.el, className);
                this.fieldGroup_.appendChild(cb.el);
            }
        }

        private setTempo(tempo: number): void {
            // reset text input if input is invalid
            if ((isNaN(tempo) || tempo <= 0) && this.tempoInput) {
                this.tempoInput.value = this.tempo + "";
                return
            }
            // update tempo and display to reflect new tempo
            if (this.tempo != tempo) {
                this.tempo = tempo;
                if (this.melody) {
                    this.melody.setTempo(this.tempo);
                }
                if (this.tempoInput) {
                    this.tempoInput.value = this.tempo + "";
                }
                this.syncTempoField(false);
            }
        }

        // sync value from tempo field on block with tempo in field editor
        private syncTempoField(blockToEditor: boolean): void {
            const s = this.sourceBlock_;
            if (s.parentBlock_) {
                const p = s.parentBlock_;
                for (const input of p.inputList) {
                    if (input.name === "tempo") {
                        const tempoBlock = input.connection.targetBlock();
                        if (tempoBlock) {
                            if (blockToEditor)
                                if (tempoBlock.getFieldValue("SLIDER")) {
                                    this.tempoInput.value = tempoBlock.getFieldValue("SLIDER");
                                    this.tempo = +this.tempoInput.value;
                                } else {
                                    this.tempoInput.value = this.tempo + "";
                                }
                            else { // Editor to block
                                if (tempoBlock.type === "math_number_minmax") {
                                    tempoBlock.setFieldValue(this.tempoInput.value, "SLIDER")
                                }
                                else {
                                    tempoBlock.setFieldValue(this.tempoInput.value, "NUM")
                                }
                                this.tempoInput.focus();
                            }
                        }
                        break;
                    }
                }
            }
        }

        // ms to hold note
        private getDuration(): number {
            return 60000 / this.tempo;
        }

        private createMelodyIfDoesntExist(): boolean {
            if (!this.melody) {
                this.melody = new pxtmelody.MelodyArray();
                return true;
            }
            return false;
        }

        private onNoteSelect(row: number, col: number): void {
            // update melody array
            this.invalidString = null;
            this.melody.updateMelody(row, col);

            if (this.melody.getValue(row, col) && !this.isPlaying) {
                this.playNote(row, col);
            }

            this.updateGrid();
            this.updateFieldLabel();
        }

        private updateGrid() {
            for (let row = 0; row < this.numRow; row++) {
                const rowClass = pxtmelody.getColorClass(row);

                for (let col = 0; col < this.numCol; col++) {
                    const cell = this.cells[row][col];

                    if (this.melody.getValue(row, col)) {
                        pxt.BrowserUtils.removeClass(cell, "melody-default");
                        pxt.BrowserUtils.addClass(cell, rowClass);
                    }
                    else {
                        pxt.BrowserUtils.addClass(cell, "melody-default");
                        pxt.BrowserUtils.removeClass(cell, rowClass);
                    }
                }
            }
        }

        private playNote(rowNumber: number, colNumber?: number): void {
            let count: number = ++this.soundingKeys;

            if (this.isPlaying) {
                this.timeouts.push(setTimeout(() => {
                    this.playToneCore(rowNumber);
                }, colNumber * this.getDuration()));

                this.timeouts.push(setTimeout(() => {
                    pxt.AudioContextManager.stop();
                }, (colNumber + 1) * this.getDuration()));
            }
            else {
                this.playToneCore(rowNumber);
                this.timeouts.push(setTimeout(() => {
                    if (this.soundingKeys == count)
                        pxt.AudioContextManager.stop();
                }, this.getDuration()));
            }
        }

        protected queueToneForColumn(column: number, delay: number, duration: number) {
            const start = setTimeout(() => {
                ++this.soundingKeys;
                pxt.AudioContextManager.stop();

                for (let i = 0; i < this.numRow; i++) {
                    if (this.melody.getValue(i, column)) {
                        this.playToneCore(i);
                    }
                }
                this.highlightColumn(column, true);
                this.timeouts = this.timeouts.filter(t => t !== start);
            }, delay);

            const end = setTimeout(() => {
                // pxt.AudioContextManager.stop();
                this.timeouts = this.timeouts.filter(t => t !== end);
                this.highlightColumn(column, false);
            }, delay + duration)

            this.timeouts.push(start);
            this.timeouts.push(end);
        }

        protected playToneCore(row: number) {
            let tone: number = 0;

            switch (row) {
                case 0: tone = 523; break; // Tenor C
                case 1: tone = 494; break; // Middle B
                case 2: tone = 440; break; // Middle A
                case 3: tone = 392; break; // Middle G
                case 4: tone = 349; break; // Middle F
                case 5: tone = 330; break; // Middle E
                case 6: tone = 294; break; // Middle D
                case 7: tone = 262; break; // Middle C
            }

            pxt.AudioContextManager.tone(tone);
        }

        private highlightColumn(col: number, on: boolean) {
            const cells = this.cells.map(row => row[col]);

            cells.forEach(cell => {
                if (on) pxt.BrowserUtils.addClass(cell, "playing")
                else pxt.BrowserUtils.removeClass(cell, "playing")
            });
        }

        private createGridDisplay(): SVGSVGElement {
            FieldCustomMelody.VIEWBOX_WIDTH = (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_VERTICAL_MARGIN) * this.numCol + FieldCustomMelody.CELL_VERTICAL_MARGIN;
            if (pxt.BrowserUtils.isEdge()) FieldCustomMelody.VIEWBOX_WIDTH += 37;
            FieldCustomMelody.VIEWBOX_HEIGHT = (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_HORIZONTAL_MARGIN) * this.numRow + FieldCustomMelody.CELL_HORIZONTAL_MARGIN;
            this.elt = pxsim.svg.parseString(`<svg xmlns="http://www.w3.org/2000/svg" class="melody-grid-div" viewBox="0 0 ${FieldCustomMelody.VIEWBOX_WIDTH} ${FieldCustomMelody.VIEWBOX_HEIGHT}"/>`);

            // Create the cells of the matrix that is displayed
            this.cells = []; // initialize array that holds rect svg elements
            for (let i = 0; i < this.numRow; i++) {
                this.cells.push([]);
            }
            for (let i = 0; i < this.numRow; i++) {
                for (let j = 0; j < this.numCol; j++) {
                    this.createCell(i, j);
                }
            }
            return this.elt;
        }

        private createCell(x: number, y: number) {
            const tx = x * (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_HORIZONTAL_MARGIN) + FieldCustomMelody.CELL_HORIZONTAL_MARGIN;
            const ty = y * (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_VERTICAL_MARGIN) + FieldCustomMelody.CELL_VERTICAL_MARGIN;

            const cellG = pxsim.svg.child(this.elt, "g", { transform: `translate(${ty} ${tx})` }) as SVGGElement;
            const cellRect = pxsim.svg.child(cellG, "rect", {
                'cursor': 'pointer',
                'width': FieldCustomMelody.CELL_WIDTH,
                'height': FieldCustomMelody.CELL_WIDTH,
                'stroke': 'white',
                'data-x': x,
                'data-y': y,
                'rx': FieldCustomMelody.CELL_CORNER_RADIUS
            }) as SVGRectElement;

            // add appropriate class so the cell has the correct fill color
            if (this.melody.getValue(x, y)) pxt.BrowserUtils.addClass(cellRect, pxtmelody.getColorClass(x));
            else pxt.BrowserUtils.addClass(cellRect, "melody-default");

            if ((this.sourceBlock_.workspace as any).isFlyout) return;

            pxsim.pointerEvents.down.forEach(evid => cellRect.addEventListener(evid, (ev: MouseEvent) => {
                this.onNoteSelect(x, y);
                ev.stopPropagation();
                ev.preventDefault();
            }, false));

            this.cells[x][y] = cellRect;
        }

        private togglePlay() {
            if (!this.isPlaying) {
                this.isPlaying = true;
                this.playMelody();
            } else {
                this.stopMelody();
            }

            this.updatePlayButton();
        }

        private updatePlayButton() {
            if (this.isPlaying) {
                pxt.BrowserUtils.removeClass(this.playIcon, "play icon");
                pxt.BrowserUtils.addClass(this.playIcon, "stop icon");
            }
            else {
                pxt.BrowserUtils.removeClass(this.playIcon, "stop icon");
                pxt.BrowserUtils.addClass(this.playIcon, "play icon");
            }
        }

        private playMelody() {
            if (this.isPlaying) {
                for (let i = 0; i < this.numCol; i++) {
                    this.queueToneForColumn(i, i * this.getDuration(), this.getDuration());
                }
                this.timeouts.push(setTimeout( // call the melody again after it finishes
                    () => this.playMelody(), (this.numCol) * this.getDuration()));
            } else {
                this.stopMelody();
            }
        }

        private stopMelody() {
            if (this.isPlaying) {
                while (this.timeouts.length) clearTimeout(this.timeouts.shift());
                pxt.AudioContextManager.stop();
                this.isPlaying = false;

                this.cells.forEach(row => row.forEach(cell => pxt.BrowserUtils.removeClass(cell, "playing")));
            }
        }

        private showGallery() {
            this.stopMelody();
            this.updatePlayButton();
            this.gallery.show((result: string) => {
                if (result) {
                    this.melody.parseNotes(result);
                    this.gallery.hide();
                    this.toggle.toggle();
                    this.updateFieldLabel();
                    this.updateGrid();
                }
            });
        }

        private hideGallery() {
            this.gallery.hide();
        }
    }

    export interface ButtonGroup {
        root: svg.Group;
        cx: number;
        cy: number;
    }

    const TOGGLE_WIDTH = 200;
    const TOGGLE_HEIGHT = 40;
    const TOGGLE_BORDER_WIDTH = 2;
    const TOGGLE_CORNER_RADIUS = 4;

    const BUTTON_CORNER_RADIUS = 2;
    const BUTTON_BORDER_WIDTH = 1;
    const BUTTON_BOTTOM_BORDER_WIDTH = 2;

    interface ToggleProps {
        baseColor: string;
        borderColor: string;
        backgroundColor: string;
        switchColor: string;
        unselectedTextColor: string;
        selectedTextColor: string;

        leftText: string;
        leftIcon: string;

        rightText: string;
        rightIcon: string;
    }

    class Toggle {
        protected leftElement: svg.Group;
        protected leftText: svg.Text;
        protected rightElement: svg.Group;
        protected rightText: svg.Text;

        protected switch: svg.Rect;
        protected root: svg.Group;
        protected props: ToggleProps;

        protected isLeft: boolean;
        protected changeHandler: (left: boolean) => void;

        constructor(parent: svg.SVG, props: Partial<ToggleProps>) {
            this.props = defaultColors(props);
            this.root = parent.group();
            this.buildDom();
            this.isLeft = true;
        }

        protected buildDom() {
            // Our css minifier mangles animation names so they need to be injected manually
            this.root.style().content(`
            .toggle-left {
                transform: translateX(0px);
                animation: mvleft 0.2s 0s ease;
            }

            .toggle-right {
                transform: translateX(100px);
                animation: mvright 0.2s 0s ease;
            }

            @keyframes mvright {
                0% {
                    transform: translateX(0px);
                }
                100% {
                    transform: translateX(100px);
                }
            }

            @keyframes mvleft {
                0% {
                    transform: translateX(100px);
                }
                100% {
                    transform: translateX(0px);
                }
            }
            `);


            // The outer border has an inner-stroke so we need to clip out the outer part
            // because SVG's don't support "inner borders"
            const clip = this.root.def().create("clipPath", "sprite-editor-toggle-border")
                .clipPathUnits(true);

            clip.draw("rect")
                .at(0, 0)
                .corners(TOGGLE_CORNER_RADIUS / TOGGLE_WIDTH, TOGGLE_CORNER_RADIUS / TOGGLE_HEIGHT)
                .size(1, 1);

            // Draw the outer border
            this.root.draw("rect")
                .size(TOGGLE_WIDTH, TOGGLE_HEIGHT)
                .fill(this.props.baseColor)
                .stroke(this.props.borderColor, TOGGLE_BORDER_WIDTH * 2)
                .corners(TOGGLE_CORNER_RADIUS, TOGGLE_CORNER_RADIUS)
                .clipPath("url(#sprite-editor-toggle-border)");


            // Draw the background
            this.root.draw("rect")
                .at(TOGGLE_BORDER_WIDTH, TOGGLE_BORDER_WIDTH)
                .size(TOGGLE_WIDTH - TOGGLE_BORDER_WIDTH * 2, TOGGLE_HEIGHT - TOGGLE_BORDER_WIDTH * 2)
                .fill(this.props.backgroundColor)
                .corners(TOGGLE_CORNER_RADIUS, TOGGLE_CORNER_RADIUS);

            // Draw the switch
            this.switch = this.root.draw("rect")
                .at(TOGGLE_BORDER_WIDTH, TOGGLE_BORDER_WIDTH)
                .size((TOGGLE_WIDTH - TOGGLE_BORDER_WIDTH * 2) / 2, TOGGLE_HEIGHT - TOGGLE_BORDER_WIDTH * 2)
                .fill(this.props.switchColor)
                .corners(TOGGLE_CORNER_RADIUS, TOGGLE_CORNER_RADIUS);

            // Draw the left option
            this.leftElement = this.root.group();
            this.leftText = mkText(this.props.leftText)
                .appendClass("sprite-editor-text")
                .fill(this.props.selectedTextColor);
            this.leftElement.appendChild(this.leftText);

            // Draw the right option
            this.rightElement = this.root.group();
            this.rightText = mkText(this.props.rightText)
                .appendClass("sprite-editor-text")
                .fill(this.props.unselectedTextColor);
            this.rightElement.appendChild(this.rightText);

            this.root.onClick(() => this.toggle());
        }

        toggle(quiet = false) {
            if (this.isLeft) {
                this.switch.removeClass("toggle-left");
                this.switch.appendClass("toggle-right");
                this.leftText.fill(this.props.unselectedTextColor);
                this.rightText.fill(this.props.selectedTextColor);
            }
            else {
                this.switch.removeClass("toggle-right");
                this.switch.appendClass("toggle-left");
                this.leftText.fill(this.props.selectedTextColor);
                this.rightText.fill(this.props.unselectedTextColor);
            }
            this.isLeft = !this.isLeft;

            if (!quiet && this.changeHandler) {
                this.changeHandler(this.isLeft);
            }
        }

        onStateChange(handler: (left: boolean) => void) {
            this.changeHandler = handler;
        }

        layout() {
            const centerOffset = (TOGGLE_WIDTH - TOGGLE_BORDER_WIDTH * 2) / 4;
            this.leftText.moveTo(centerOffset + TOGGLE_BORDER_WIDTH, TOGGLE_HEIGHT / 2);
            this.rightText.moveTo(TOGGLE_WIDTH - TOGGLE_BORDER_WIDTH - centerOffset, TOGGLE_HEIGHT / 2)
        }

        translate(x: number, y: number) {
            this.root.translate(x, y);
        }

        height() {
            return TOGGLE_HEIGHT;
        }

        width() {
            return TOGGLE_WIDTH;
        }
    }

    function mkText(text: string) {
        return new svg.Text(text)
            .anchor("middle")
            .setAttribute("dominant-baseline", "middle")
            .setAttribute("dy", (pxt.BrowserUtils.isIE() || pxt.BrowserUtils.isEdge()) ? "0.3em" : "0.1em")
    }

    function defaultColors(props: Partial<ToggleProps>): ToggleProps {
        if (!props.baseColor) props.baseColor = "#e95153";
        if (!props.backgroundColor) props.backgroundColor = "rgba(52,73,94,.2)";
        if (!props.borderColor) props.borderColor = "rgba(52,73,94,.4)";
        if (!props.selectedTextColor) props.selectedTextColor = props.baseColor;
        if (!props.unselectedTextColor) props.unselectedTextColor = "hsla(0,0%,100%,.9)";
        if (!props.switchColor) props.switchColor = "#ffffff";

        return props as ToggleProps;
    }
}
