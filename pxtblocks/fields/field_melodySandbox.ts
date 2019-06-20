/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    export class FieldCustomMelody<U extends Blockly.FieldCustomOptions> extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        protected params: U;
        private title: string = "Name this tune";
        private melody: pxtmelody.MelodyArray;
        private soundingKeys: number = 0;
        private numRow: number = 8;
        private numCol: number = 8;
        private tempo: number = 120;
        private stringRep: string;
        private oneNotePerCol: boolean = true;
        private isPlaying: boolean = false;
        private timeouts: any = []; // keep track of timeouts

        // html references
        private topDiv: HTMLDivElement;
        private editorGalleryToggle: HTMLDivElement;
        private editorButton: HTMLButtonElement;
        private galleryButton: HTMLButtonElement;
        private melodyName: HTMLInputElement;
        private gridDiv: HTMLDivElement;
        private bottomDiv: HTMLDivElement;
        private buttonBarDiv: HTMLDivElement;
        private doneButton: HTMLButtonElement;
        private iconButtons: HTMLDivElement;
        private playButton: HTMLButtonElement;
        private playIcon: HTMLElement;
        private tempoText: HTMLInputElement;



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
            contentDiv.style.maxHeight = "500px";
            this.renderEditor(Blockly.DropDownDiv.getContentDiv() as HTMLDivElement);
            this.createGridDisplay();
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
            this.render_();
            this.createMelodyIfDoesntExist();
            Blockly.FieldLabel.prototype.setText.call(this, this.getTitle());
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
            this.melodyName = document.createElement("input");
            pxt.BrowserUtils.addClass(this.melodyName, "ui input");
            this.melodyName.id = "melody-name";
            this.melodyName.maxLength = 25;
            this.melodyName.value = this.title;
            this.melodyName.addEventListener("input", () => this.setTitle(this.melodyName.value));
            this.topDiv.appendChild(this.melodyName);
            div.appendChild(this.topDiv);

            this.gridDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.gridDiv, "melody-grid-div");
            for (let i = 0; i < this.numRow; i++) {
                let row = document.createElement("div");
                pxt.BrowserUtils.addClass(row, "row" + i);
                for (let j = 0; j < this.numCol; j++) {
                    let cell = document.createElement("button");
                    pxt.BrowserUtils.addClass(cell, "cell");
                    cell.id = "cell-" + i + "-" + j;
                    row.appendChild(cell);
                }
                this.gridDiv.appendChild(row);
            }
            div.appendChild(this.gridDiv);

            this.bottomDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.bottomDiv, "melody-bottom-bar-div");

            this.buttonBarDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.buttonBarDiv, "melody-button-bar-div");

            this.doneButton = document.createElement("button");
            this.doneButton.id = "melody-done-button";
            pxt.BrowserUtils.addClass(this.doneButton, "ui button");
            this.doneButton.innerText = "Done";
            this.doneButton.addEventListener("click", () => Blockly.DropDownDiv.hideIfOwner(this));
            this.iconButtons = document.createElement("div");
            pxt.BrowserUtils.addClass(this.iconButtons, "ui icon buttons");
            this.playButton = document.createElement("button");
            pxt.BrowserUtils.addClass(this.playButton, "ui button");
            this.playButton.id = "melody-play-button";
            this.playButton.addEventListener("click", () => this.playMelody());
            this.playIcon = document.createElement("i");
            this.playIcon.id = "melody-play-icon";
            pxt.BrowserUtils.addClass(this.playIcon, "play icon");
            this.playButton.appendChild(this.playIcon);
            this.buttonBarDiv.appendChild(this.playButton);
            this.buttonBarDiv.appendChild(this.doneButton);

            this.tempoText = document.createElement("input");
            this.tempoText.type = "number";
            this.tempoText.value = this.tempo + ""; // will be updated according to slider
            this.tempoText.id = "melody-tempo-text";
            this.tempoText.addEventListener("input", () => this.setTempo(+this.tempoText.value));
            this.bottomDiv.appendChild(this.tempoText);
            this.bottomDiv.appendChild(this.buttonBarDiv);
            div.appendChild(this.bottomDiv);

            // create event listeners at the end because the DOM needs to finish loading
            for (let i = 0; i < this.numRow; i++) {
                for (let j = 0; j < this.numCol; j++) {
                    let el = "cell-" + i + "-" + j;
                    document.getElementById(el).addEventListener("click", () => this.onNoteSelect(el));
                }
            }

        }

        // Runs when the editor is closed by clicking on the Blockly workspace
        protected onEditorClose() {

        }

        // This is the string that will be inserted into the user's TypeScript code
        protected getTypeScriptValue(): string {
            if (this.melody) {
                return "\"" + this.melody.getStringRepresentation() + "\"";
            }
            return "";

        }

        // This should parse the string returned by getTypeScriptValue() and restore the state based on that
        protected parseTypeScriptValue(value: string) {
            value = value.slice(1, -1); // remove the boundary quotes
            value = value.trim(); // remove boundary white space
            let melodies: string[] = value.split("-");
            this.createMelodyIfDoesntExist();
            this.setTitle(melodies[0]);
            this.setTempo(Number(melodies[1]));
            for (let i = 2; i < melodies.length - 1; i++) { // first two strings are name and tempo
                let notes: string[] = melodies[i].split(" ");
                for (let j = 0; j < notes.length - 1; j++) {
                    if (notes[j] != "R") {
                        let rowPos: number = pxtmelody.noteToRow(notes[j]);
                        this.melody.updateMelody(rowPos, j);
                    }
                }
            }
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
            //return "#560649";
        }

        protected getDropdownBorderColour() {
            return this.sourceBlock_.getColourSecondary();
            //return "#560649";
        }

        setTitle(melodyName: string): void {
            if (this.title != melodyName) {
                this.title = melodyName;
                Blockly.FieldLabel.prototype.setText.call(this, this.title);
                if (this.melody) {
                    this.melody.setTitle(this.title);
                }
            }
        }

        getTitle(): string {
            return this.title;
        }

        setTempo(tempo: number): void {
            // reset text input if input is invalid
            if (isNaN(tempo) || tempo <= 0 && this.tempoText) {
                this.tempoText.value = this.tempo + "";
                return
            }
            // update tempo and duration values and display to reflect new tempo
            if (this.tempo != tempo) {
                this.tempo = tempo;
                if (this.melody) {
                    this.melody.setTempo(this.tempo);
                }
                if (this.tempoText) {
                    this.tempoText.value = this.tempo + "";
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

        onNoteSelect(id: string): void {
            // parse element id
            let params = id.split("-"); // params[1] is row, params[2] is cell
            let row = params[1];
            let col = params[2];


            // play sound if selected
            if (!this.melody.getValue(+row, +col)) {
                this.playNote(+row);
                if (this.oneNotePerCol) { // clear all other notes in col
                    for (let i = 0; i < this.numRow; i++) {
                        if (this.melody.getValue(i, +col)) {
                            // update melody array
                            this.melody.updateMelody(i, +col);
                            // set color to default
                            document.getElementById("cell-" + i + "-" + col).style.backgroundColor = "";
                        }
                    }

                }
                // update button/div color
                this.updateColor(id, +row, +col);
            } else {
                // set color to default
                document.getElementById(id).style.backgroundColor = "";
            }

            // update melody array
            this.melody.updateMelody(+row, +col);
        }



        playNote(rowNumber: number, colNumber?: number): void {
            let tone: number = 0;
            let cnt: number = ++this.soundingKeys;

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
                this.timeouts.push(setTimeout(function () {
                    AudioContextManager.tone(tone);
                }, colNumber * this.getDuration()));
                this.timeouts.push(setTimeout(function () {
                    AudioContextManager.stop();
                }, (colNumber + 1) * this.getDuration()));
            } else { // when a single note is selected
                AudioContextManager.tone(tone);
                this.timeouts.push(setTimeout(function () {
                    if (this.soundingKeys == cnt)
                        AudioContextManager.stop();
                }, this.getDuration()));
                this.timeouts.push(setTimeout(function () {
                    AudioContextManager.stop();
                }, this.getDuration()));
            }
        }

        updateColor(id: string, row: number, col: number) {
            let color: string = "";
            switch (row) {
                case 0: color = "#A80000"; break; // red - Middle C
                case 1: color = "#D83B01"; break; // orange - Middle D
                case 2: color = "#FFB900"; break; // yellow - Middle E
                case 3: color = "#107C10"; break; // green - Middle F
                case 4: color = "#008272"; break; // teal - Middle G
                case 5: color = "#0078D7"; break; // blue - Middle A
                case 6: color = "#B4009E"; break; // violet - Middle B
                case 7: color = "#5C2D91"; break; // purple - Tenor C
                default: return;
            }
            document.getElementById(id).style.backgroundColor = color;
        }

        createGridDisplay() {
            if (this.createMelodyIfDoesntExist()) return;
            for (let i = 0; i < this.numRow; i++) {
                for (let j = 0; j < this.numCol; j++) {
                    if (this.melody.getValue(i, j)) {
                        let id = "cell-" + i + "-" + j;
                        this.updateColor(id, i, j);
                    }
                }
            }
        }

        // instead of using a bunch of switch statements - can create enum of objects

        playMelody() {
            // toggle icon
            if (pxt.BrowserUtils.containsClass(this.playIcon, "play icon")) {
                pxt.BrowserUtils.removeClass(this.playIcon, "play icon");
                pxt.BrowserUtils.addClass(this.playIcon, "stop icon");
                this.isPlaying = true;
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
                this.timeouts.push(setTimeout( // call the melody again after it finishes - not currently working
                    this.playMelody, (this.numCol - 1) * this.getDuration()));
            } else {
                pxt.BrowserUtils.removeClass(this.playIcon, "stop icon");
                pxt.BrowserUtils.addClass(this.playIcon, "play icon");
                this.isPlaying = false;
                for (let i = 0; i < this.timeouts.length; i++) {
                    clearTimeout(this.timeouts[i]);
                }
                AudioContextManager.stop();
            }
        }

    }
}