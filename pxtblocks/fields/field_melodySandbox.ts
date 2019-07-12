/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;
    export const HEADER_HEIGHT = 50;
    export const TOTAL_WIDTH = 300;

    export class FieldCustomMelody<U extends Blockly.FieldCustomOptions> extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        protected params: U;
        private title: string = "- - - - - - - -";
        private melody: pxtmelody.MelodyArray;
        private soundingKeys: number = 0;
        private numRow: number = 8;
        private numCol: number = 8;
        private tempo: number = 120;
        private stringRep: string;
        private oneNotePerCol: boolean = true;
        private isPlaying: boolean = false;
        private timeouts: number[] = []; // keep track of timeouts
        private invalidString: string;

        // DOM references
        private topDiv: HTMLDivElement;
        private editorDiv: HTMLDivElement;
        private gridDiv: SVGSVGElement;
        private bottomDiv: HTMLDivElement;
        private doneButton: HTMLButtonElement;
        private playButton: HTMLButtonElement;
        private playIcon: HTMLElement;
        private tempoInput: HTMLInputElement;
        private tempoDiv: HTMLDivElement;
        private tempoLabel: HTMLLabelElement;

        // grid elements
        private static CELL_WIDTH = 25;
        private static CELL_HORIZONTAL_MARGIN = 7;
        private static CELL_VERTICAL_MARGIN = 5;
        private static CELL_CORNER_RADIUS = 5;
        private elt: SVGSVGElement;
        private cells: SVGRectElement[][];
        private static VIEWBOX_WIDTH: number;
        private static VIEWBOX_HEIGHT: number;

        // Use toggle from sprite editor
        private toggle: pxtsprite.Toggle;
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

            Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_, () => {
                this.onEditorClose();
                // revert all style attributes for dropdown div
                pxt.BrowserUtils.removeClass(contentDiv, "melody-content-div");
                pxt.BrowserUtils.removeClass(contentDiv.parentElement, "melody-editor-dropdown");

            });
        }

        getText() {
            this.stringRep = this.getTypeScriptValue();
            return this.stringRep;
        }

        setText(newText: string) {
            if (newText == null || newText == "" || newText == "\"\"" || (this.stringRep && this.stringRep === newText)) { // ignore empty strings
                return;
            }
            this.stringRep = newText;
            this.parseTypeScriptValue(newText);
        }


        // This will be run when the field is created (i.e. when it appears on the workspace)
        protected onInit() {
            this.render_();
            this.createMelodyIfDoesntExist();
            this.updateFieldLabel();
        }

        // Render the editor that will appear in the dropdown div when the user clicks on the field
        protected renderEditor(div: HTMLDivElement) {
            this.topDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.topDiv, "melody-top-bar-div")

            // Same toggle set up as sprite editor
            this.root = new svg.SVG(this.topDiv).id("melody-editor-header-controls");
            this.toggle = new pxtsprite.Toggle(this.root, { leftText: lf("Editor"), rightText: lf("Gallery"), baseColor: "#B4009E" });
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

            this.gridDiv = this.createGridDisplay();
            this.editorDiv.appendChild(this.gridDiv);

            this.bottomDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.bottomDiv, "melody-bottom-bar-div");

            this.doneButton = document.createElement("button");
            this.doneButton.id = "melody-done-button";
            pxt.BrowserUtils.addClass(this.doneButton, "ui button");
            this.doneButton.innerText = "Done";
            this.doneButton.addEventListener("click", () => this.onDone());

            this.playButton = document.createElement("button");
            pxt.BrowserUtils.addClass(this.playButton, "ui icon button");
            this.playButton.id = "melody-play-button";
            this.playButton.addEventListener("click", () => this.togglePlay());

            this.playIcon = document.createElement("i");
            this.playIcon.id = "melody-play-icon";
            pxt.BrowserUtils.addClass(this.playIcon, "play icon");
            this.playButton.appendChild(this.playIcon);

            this.tempoDiv = document.createElement("div");
            this.tempoDiv.id = "melody-tempo-div";

            this.tempoLabel = document.createElement("label");
            this.tempoLabel.id = "melody-tempo-label";
            this.tempoLabel.innerText = "Tempo";

            this.tempoInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.tempoInput, "ui input");
            this.tempoInput.type = "number";
            this.tempoInput.value = this.tempo + "";
            this.tempoInput.id = "melody-tempo-input";
            this.tempoInput.addEventListener("input", () => this.setTempo(+this.tempoInput.value));

            this.tempoDiv.appendChild(this.tempoLabel);
            this.tempoDiv.appendChild(this.tempoInput);

            this.bottomDiv.appendChild(this.tempoDiv);
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
            this.tempoDiv = null;
            this.tempoLabel = null;
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
                this.updateFieldLabel();
                let notes: string[] = value.split(" ");

                for (let j = 0; j < notes.length; j++) {
                    if (!this.isValidNote(notes[j])) throw new Error("Invalid note: " + notes[j] + " Notes can be C D E F G A B C5");
                    if (notes[j] != "-") {
                        let rowPos: number = pxtmelody.noteToRow(notes[j]);
                        this.melody.updateMelody(rowPos, j);
                    }
                }
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
            this.updateWidth();
            return this.size_.width;
        }

        // The height of the preview on the block itself
        protected getPreviewHeight(): number {
            return Blockly.BlockSvg.FIELD_HEIGHT;
        }

        protected getDropdownBackgroundColour() {
            return this.sourceBlock_.getColour();
        }

        protected getDropdownBorderColour() {
            //return this.sourceBlock_.getColourSecondary();
            return "#4f0643";
        }

        private updateFieldLabel(): void {
            if (this.invalidString) {
                Blockly.FieldLabel.prototype.setText.call(this, pxt.Util.lf("Invalid Input"));
                return;
            }
            this.title = this.melody.getStringRepresentation().trim();
            Blockly.FieldLabel.prototype.setText.call(this, this.title);
        }

        private setTempo(tempo: number): void {
            // reset text input if input is invalid
            if ((isNaN(tempo) || tempo <= 0) && this.tempoInput) {
                this.tempoInput.value = this.tempo + "";
                return
            }
            // update tempo and duration values and display to reflect new tempo
            if (this.tempo != tempo) {
                this.tempo = tempo;
                if (this.melody) {
                    this.melody.setTempo(this.tempo);
                }
                if (this.tempoInput) {
                    this.tempoInput.value = this.tempo + "";
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
            let selectedNote = this.cells[row][col];
            // play sound if selected
            if (!this.melody.getValue(row, col)) {
                this.playNote(row);
                pxt.BrowserUtils.removeClass(selectedNote, "melody-default");
                pxt.BrowserUtils.addClass(selectedNote, pxtmelody.getColorClass(row));
                if (this.oneNotePerCol) { // clear all other notes in col
                    for (let i = 0; i < this.numRow; i++) {
                        if (this.melody.getValue(i, col)) {
                            // remove current color class
                            pxt.BrowserUtils.removeClass(this.cells[i][col], pxtmelody.getColorClass(i));
                            // update melody array
                            this.melody.updateMelody(i, col);
                            // set color to default
                            pxt.BrowserUtils.addClass(this.cells[i][col], "melody-default");
                        }
                    }
                }
            } else { // when note is unselected
                pxt.BrowserUtils.removeClass(selectedNote, pxtmelody.getColorClass(row));
                pxt.BrowserUtils.addClass(selectedNote, "melody-default");
            }
            // update melody array
            this.invalidString = null;
            this.melody.updateMelody(row, col);
            this.updateFieldLabel();
        }

        private playNote(rowNumber: number, colNumber?: number): void {
            let tone: number = 0;
            let count: number = ++this.soundingKeys;

            switch (rowNumber) {
                case 0: tone = 523; break; // Tenor C
                case 1: tone = 494; break; // Middle B
                case 2: tone = 440; break; // Middle A
                case 3: tone = 392; break; // Middle G
                case 4: tone = 349; break; // Middle F
                case 5: tone = 330; break; // Middle E
                case 6: tone = 294; break; // Middle D
                case 7: tone = 262; break; // Middle C 
            }

            if (this.isPlaying) { // when melody is playing
                // start note
                this.timeouts.push(setTimeout(() => {
                    pxt.AudioContextManager.tone(tone);
                }, colNumber * this.getDuration()));
                // stop note
                this.timeouts.push(setTimeout(() => {
                    pxt.AudioContextManager.stop();
                }, (colNumber + 1) * this.getDuration()));
            } else { // when a single note is selected
                // start note
                pxt.AudioContextManager.tone(tone);
                // stop note
                this.timeouts.push(setTimeout(() => {
                    if (this.soundingKeys == count)
                        pxt.AudioContextManager.stop();
                }, this.getDuration()));
            }
        }

        private createGridDisplay(): SVGSVGElement {
            FieldCustomMelody.VIEWBOX_WIDTH = (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_VERTICAL_MARGIN) * this.numCol + FieldCustomMelody.CELL_VERTICAL_MARGIN;
            if (pxt.BrowserUtils.isEdge()) FieldCustomMelody.VIEWBOX_WIDTH += 30;
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

        private updateGridDisplay() {
            for (let i = 0; i < this.numCol; i++) {
                for (let j = 0; j < this.numRow; j++) {
                    let cell = this.cells[j][i];
                    // update color if necessary
                    if (this.melody.getValue(j, i) && !pxt.BrowserUtils.containsClass(cell, pxtmelody.getColorClass(j))) {
                        pxt.BrowserUtils.addClass(cell, pxtmelody.getColorClass(j));
                        pxt.BrowserUtils.removeClass(cell, "melody-default");
                        // reset to default if not selected
                    } else if (!this.melody.getValue(j, i) && pxt.BrowserUtils.containsClass(cell, pxtmelody.getColorClass(j))) {
                        pxt.BrowserUtils.removeClass(cell, pxtmelody.getColorClass(j));
                        pxt.BrowserUtils.addClass(cell, "melody-default");
                    }

                }
            }

        }

        private createCell(x: number, y: number) {
            const tx = x * (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_HORIZONTAL_MARGIN) + FieldCustomMelody.CELL_HORIZONTAL_MARGIN;
            const ty = y * (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_VERTICAL_MARGIN) + FieldCustomMelody.CELL_VERTICAL_MARGIN;

            const cellG = pxsim.svg.child(this.elt, "g", { transform: `translate(${ty} ${tx})` }) as SVGGElement;
            const cellRect = pxsim.svg.child(cellG, "rect", {
                'cursor': 'pointer',
                'width': FieldCustomMelody.CELL_WIDTH, height: FieldCustomMelody.CELL_WIDTH,
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
            if (pxt.BrowserUtils.containsClass(this.playIcon, "play icon")) {
                pxt.BrowserUtils.removeClass(this.playIcon, "play icon");
                pxt.BrowserUtils.addClass(this.playIcon, "stop icon");
                this.isPlaying = true;
                this.playMelody();
            } else {
                pxt.BrowserUtils.removeClass(this.playIcon, "stop icon");
                pxt.BrowserUtils.addClass(this.playIcon, "play icon");
                this.stopMelody();
            }
        }

        private playMelody() {
            if (this.isPlaying) {
                for (let i = 0; i < this.numCol; i++) {
                    for (let j = 0; j < this.numRow; j++) {
                        if (this.melody.getValue(j, i)) {
                            if (this.oneNotePerCol) {
                                this.playNote(j, i);
                                break;
                            } // will support playing multiple notes in the future
                        }
                    }
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
            }
        }

        private showGallery() {
            this.stopMelody();
            this.gallery.show((result: string) => {
                if (result) {
                    this.melody.parseNotes(result);
                    this.gallery.hide();
                    this.toggle.toggle();
                    this.updateFieldLabel();
                    this.updateGridDisplay();
                }
            });
        }

        private hideGallery() {
            this.gallery.hide();
        }
    }
}