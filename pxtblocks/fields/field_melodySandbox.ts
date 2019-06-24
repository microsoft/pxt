/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    export class FieldCustomMelody<U extends Blockly.FieldCustomOptions> extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        protected params: U;
        private title: string = pxt.Util.lf("Name this tune");
        private melody: pxtmelody.MelodyArray;
        private soundingKeys: number = 0;
        private numRow: number = 8;
        private numCol: number = 8;
        private tempo: number = 120;
        private stringRep: string;
        private oneNotePerCol: boolean = true;
        private isPlaying: boolean = false;
        private timeouts: number[] = []; // keep track of timeouts

        // html references
        private topDiv: HTMLDivElement;
        private editorGalleryToggle: HTMLDivElement;
        private editorButton: HTMLButtonElement;
        private galleryButton: HTMLButtonElement;
        private melodyName: HTMLInputElement;
        private gridDiv: HTMLDivElement;
        private bottomDiv: HTMLDivElement;
        private doneButton: HTMLButtonElement;
        private playButton: HTMLButtonElement;
        private playIcon: HTMLElement;
        private tempoInput: HTMLInputElement;
        private tempoDiv: HTMLDivElement;
        private tempoLabel: HTMLLabelElement;



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

            this.melodyName = document.createElement("input");
            pxt.BrowserUtils.addClass(this.melodyName, "ui input");
            this.melodyName.id = "melody-name";
            this.melodyName.maxLength = 25;
            this.melodyName.value = this.title;
            this.melodyName.addEventListener("input", () => this.setTitle(this.melodyName.value));

            this.topDiv.appendChild(this.editorGalleryToggle);
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
            this.tempoInput.value = this.tempo + ""; // will be updated according to slider
            this.tempoInput.id = "melody-tempo-input";
            this.tempoInput.addEventListener("input", () => this.setTempo(+this.tempoInput.value));

            this.tempoDiv.appendChild(this.tempoLabel);
            this.tempoDiv.appendChild(this.tempoInput);

            this.bottomDiv.appendChild(this.tempoDiv);
            this.bottomDiv.appendChild(this.playButton);
            this.bottomDiv.appendChild(this.doneButton);
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
            if (this.isPlaying) {
                this.stopMelody();
            }
        }

        // when click done
        onDone() {
            if (this.isPlaying) {
                this.stopMelody();
            }
            Blockly.DropDownDiv.hideIfOwner(this);
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
        }

        protected getDropdownBorderColour() {
            return this.sourceBlock_.getColourSecondary();
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

        onNoteSelect(id: string): void {
            // parse element id
            let params = id.split("-"); // params[1] is row, params[2] is cell
            let row = +params[1];
            let col = +params[2];

            // play sound if selected
            if (!this.melody.getValue(row, col)) {
                this.playNote(row);
                if (this.oneNotePerCol) { // clear all other notes in col
                    for (let i = 0; i < this.numRow; i++) {
                        if (this.melody.getValue(i, col)) {
                            // update melody array
                            this.melody.updateMelody(i, col);
                            // set color to default
                            pxt.BrowserUtils.removeClass(document.getElementById("cell-" + i + "-" + col), this.getColorClass(i));
                        }
                    }
                }
                // update button/div color
                pxt.BrowserUtils.addClass(document.getElementById(id), this.getColorClass(row));
            } else {
                // set color to default
                pxt.BrowserUtils.removeClass(document.getElementById(id), this.getColorClass(row));
            }
            // update melody array
            this.melody.updateMelody(row, col);
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

        createGridDisplay() {
            if (this.createMelodyIfDoesntExist()) return;
            for (let i = 0; i < this.numRow; i++) {
                for (let j = 0; j < this.numCol; j++) {
                    if (this.melody.getValue(i, j)) {
                        let id = "cell-" + i + "-" + j;
                        pxt.BrowserUtils.addClass(document.getElementById(id), this.getColorClass(i));
                    }
                }
            }
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
                this.isPlaying = false;
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
            while (this.timeouts.length) clearTimeout(this.timeouts.shift());
            AudioContextManager.stop();
        }

    }
}