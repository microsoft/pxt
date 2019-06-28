/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
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
        private editorGalleryToggle: HTMLDivElement;
        private editorButton: HTMLButtonElement;
        private galleryButton: HTMLButtonElement;
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
        private static BOTTOM_MARGIN = 7;
        private elt: SVGSVGElement;
        private cells: SVGRectElement[][] = [];
        private static VIEWBOX_WIDTH: number;
        private static VIEWBOX_HEIGHT: number;


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
            contentDiv.style.maxHeight = "550px";

            this.renderEditor(Blockly.DropDownDiv.getContentDiv() as HTMLDivElement);

            Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_, () => {
                this.onEditorClose();
                // revert all style attributes for dropdown div
                contentDiv.style.maxHeight = null;
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
            for (let i = 0; i < this.numRow; i++) {
                this.cells.push([]);
            }
            this.render_();
            this.createMelodyIfDoesntExist();
            this.updateFieldLabel();
        }

        // Render the editor that will appear in the dropdown div when the user clicks on the field
        protected renderEditor(div: HTMLDivElement) {
            this.topDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.topDiv, "melody-top-bar-div")

            this.editorGalleryToggle = document.createElement("div");
            this.editorGalleryToggle.id = "melody-toggle";

            this.editorButton = document.createElement("button");
            this.editorButton.innerText = "Editor";
            pxt.BrowserUtils.addClass(this.editorButton, "ui left attached button");

            this.galleryButton = document.createElement("button");
            this.galleryButton.innerText = "Gallery";
            pxt.BrowserUtils.addClass(this.galleryButton, "right attached ui button");

            this.editorGalleryToggle.appendChild(this.editorButton);
            this.editorGalleryToggle.appendChild(this.galleryButton);
            this.topDiv.appendChild(this.editorGalleryToggle);
            div.appendChild(this.topDiv);

            this.gridDiv = this.createGridDisplay();
            div.appendChild(this.gridDiv);

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
            div.appendChild(this.bottomDiv);
        }

        // Runs when the editor is closed by clicking on the Blockly workspace
        protected onEditorClose() {
            this.stopMelody();
        }

        // when click done
        onDone() {
            this.stopMelody();
            Blockly.DropDownDiv.hideIfOwner(this);
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
            //return "#696969";
        }

        protected getDropdownBorderColour() {
            return this.sourceBlock_.getColourSecondary();
            //return "#696969";
        }

        updateFieldLabel(): void {
            if (this.invalidString) {
                Blockly.FieldLabel.prototype.setText.call(this, pxt.Util.lf("Invalid Input"));
                return;
            }
            this.title = this.melody.getStringRepresentation().trim();
            Blockly.FieldLabel.prototype.setText.call(this, this.title);
        }

        setTempo(tempo: number): void {
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
        getDuration(): number {
            return 60000 / this.tempo;
        }

        createMelodyIfDoesntExist(): boolean {
            if (!this.melody) {
                this.melody = new pxtmelody.MelodyArray();
                return true;
            }
            return false;
        }

        onNoteSelect(row: number, col: number): void {
            // play sound if selected
            if (!this.melody.getValue(row, col)) {
                this.playNote(row);
                if (this.oneNotePerCol) { // clear all other notes in col
                    for (let i = 0; i < this.numRow; i++) {
                        if (this.melody.getValue(i, col)) {
                            // update melody array
                            this.melody.updateMelody(i, col);
                            // set color to default
                            this.cells[i][col].style.fill = this.getColor(i, col);
                        }
                    }
                }
            }
            // update melody array
            this.invalidString = null;
            this.melody.updateMelody(row, col);
            // update fill color
            this.cells[row][col].style.fill = this.getColor(row, col);
            this.updateFieldLabel();
        }

        playNote(rowNumber: number, colNumber?: number): void {
            let tone: number = 0;
            let count: number = ++this.soundingKeys;

            switch (rowNumber) {
                case 0: tone = 262; break; // Middle C
                case 1: tone = 294; break; // Middle D
                case 2: tone = 330; break; // Middle E
                case 3: tone = 349; break; // Middle F
                case 4: tone = 392; break; // Middle G
                case 5: tone = 440; break; // Middle A
                case 6: tone = 494; break; // Middle B
                case 7: tone = 523; break; // Tenor C 
            }

            if (this.isPlaying) { // when melody is playing
                // start note
                this.timeouts.push(setTimeout(() => {
                    AudioContextManager.tone(tone);
                }, colNumber * this.getDuration()));
                // stop note
                this.timeouts.push(setTimeout(() => {
                    AudioContextManager.stop();
                }, (colNumber + 1) * this.getDuration()));
            } else { // when a single note is selected
                // start note
                AudioContextManager.tone(tone);
                // stop note
                this.timeouts.push(setTimeout(() => {
                    if (this.soundingKeys == count)
                        AudioContextManager.stop();
                }, this.getDuration()));
            }
        }

        getColorClass(row: number): string {
            let colorClass = "";
            switch (row) {
                case 0: colorClass = "melody-red"; break; // Middle C
                case 1: colorClass = "melody-orange"; break; // Middle D
                case 2: colorClass = "melody-yellow"; break; // Middle E
                case 3: colorClass = "melody-green"; break; // Middle F
                case 4: colorClass = "melody-teal"; break; // Middle G
                case 5: colorClass = "melody-blue"; break; // Middle A
                case 6: colorClass = "melody-violet"; break; // Middle B
                case 7: colorClass = "melody-purple"; break; // Tenor C
            }
            return colorClass;
        }

        createGridDisplay(): SVGSVGElement {
            FieldCustomMelody.VIEWBOX_WIDTH = (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_VERTICAL_MARGIN) * this.numCol + FieldCustomMelody.CELL_VERTICAL_MARGIN;
            FieldCustomMelody.VIEWBOX_HEIGHT = (FieldCustomMelody.CELL_WIDTH + FieldCustomMelody.CELL_HORIZONTAL_MARGIN) * this.numRow + FieldCustomMelody.CELL_HORIZONTAL_MARGIN;
            this.elt = pxsim.svg.parseString(`<svg xmlns="http://www.w3.org/2000/svg" class="melody-grid-div" viewBox="0 0 ${FieldCustomMelody.VIEWBOX_WIDTH} ${FieldCustomMelody.VIEWBOX_HEIGHT}"/>`);
            // Create the cells of the matrix that is displayed
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
                'class': `blocklyLed${this.melody.getValue(x, y) ? 'On' : 'Off'}`,
                'cursor': 'pointer',
                width: FieldCustomMelody.CELL_WIDTH, height: FieldCustomMelody.CELL_WIDTH,
                fill: this.getColor(x, y),
                stroke: "white",
                'data-x': x,
                'data-y': y,
                rx: FieldCustomMelody.CELL_CORNER_RADIUS
            }) as SVGRectElement;
            this.cells[x][y] = cellRect;

            if ((this.sourceBlock_.workspace as any).isFlyout) return;

            pxsim.pointerEvents.down.forEach(evid => cellRect.addEventListener(evid, (ev: MouseEvent) => {
                this.onNoteSelect(x, y);
                ev.stopPropagation();
                ev.preventDefault();
            }, false));
        }

        private getColor(rowNum: number, colNum: number): string {
            let colorString = "gainsboro";
            if (this.melody.getValue(rowNum, colNum)) {
                switch (rowNum) {
                    case 0: colorString = "#A80000"; break; // red - Middle C
                    case 1: colorString = "#D83B01"; break; // orange - Middle D
                    case 2: colorString = "#FFB900"; break; // yellow - Middle E
                    case 3: colorString = "#107C10"; break; // green - Middle F
                    case 4: colorString = "#008272"; break; // teal - Middle G
                    case 5: colorString = "#0078D7"; break; // blue - Middle A
                    case 6: colorString = "#B4009E"; break; // violet - Middle B
                    case 7: colorString = "#5C2D91"; break; // purple - Tenor C
                }
            }
            return colorString;
        }

        togglePlay() {
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

        playMelody() {
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

        stopMelody() {
            if (this.isPlaying) {
                while (this.timeouts.length) clearTimeout(this.timeouts.shift());
                AudioContextManager.stop();
                this.isPlaying = false;
            }
        }

    }
}