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
        private isLooping: boolean = false;
        private timeouts: any = []; // keep track of timeouts
        private duration = 60000/this.tempo; //ms to hold note

        constructor(value: string, params: U, validator?: Function) {
            super(value, validator);
            this.params = params;
            if (!this.melody) {
                this.melody = new pxtmelody.MelodyArray();
            }
        }

        init() {
            super.init();
            this.onInit();
        }

        render_() {
            super.render_();
            //this.size_.height = this.getPreviewHeight();
            //this.size_.width = this.getPreviewWidth();
        }

        showEditor_() {
            // If there is an existing drop-down someone else owns, hide it immediately and clear it.
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.DropDownDiv.clearContent();
            Blockly.DropDownDiv.setColour(this.getDropdownBackgroundColour(), this.getDropdownBorderColour());
            let contentDiv = Blockly.DropDownDiv.getContentDiv() as HTMLDivElement;
            goog.style.setStyle(contentDiv, "max-height", "500px");
            this.renderEditor(Blockly.DropDownDiv.getContentDiv() as HTMLDivElement);
            this.createGridDispaly();
            Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_, () => {
                this.onEditorClose();
                // revert all style attributes for dropdown div
                goog.style.setStyle(contentDiv, "max-height", null);
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
            //super.setText(this.getTitle());
            //super.setText(newText); // this causes grid to come back empty from typescript 
        }


        // This will be run when the field is created (i.e. when it appears on the workspace)
        protected onInit() {
            this.render_();
            if (!this.melody) {
                this.melody = new pxtmelody.MelodyArray();
            }
            Blockly.FieldLabel.prototype.setText.call(this, this.getTitle());
        }

        // Render the editor that will appear in the dropdown div when the user clicks on the field
        protected renderEditor(div: HTMLDivElement) {
            let topDiv = goog.dom.createDom("div", {}) as HTMLElement;
            topDiv.className = "melody-top-bar-div";

            let editorGalleryToggle = goog.dom.createDom("div", {}) as HTMLElement;
            editorGalleryToggle.id = "melody-toggle";
            let editorButton = document.createElement("button");
            editorButton.innerText = "Editor";
            editorButton.className = "ui left attached button";
            let galleryButton = document.createElement("button");
            galleryButton.innerText = "Gallery";
            galleryButton.className = "right attached ui button";
            editorGalleryToggle.appendChild(editorButton);
            editorGalleryToggle.appendChild(galleryButton);

            topDiv.appendChild(editorGalleryToggle);
            let melodyName = document.createElement("input");
            melodyName.className = "ui input";
            melodyName.id = "melody-name";
            melodyName.value = this.title;
            melodyName.addEventListener("input", () => this.setTitle(melodyName.value));
            topDiv.appendChild(melodyName);
            div.appendChild(topDiv);

            let gridDiv = goog.dom.createDom("div", {}) as HTMLElement;
            gridDiv.className = "melody-grid-div";
            for(var i = 0; i < this.numRow; i++) {
                var row = document.createElement("div");
                row.className = "row" + i;
                for(var j = 0; j < this.numCol; j++) {
                    var cell = document.createElement("button"); // button
                    cell.className = "cell";
                    cell.id = "cell-" + i + "-" + j;
                    row.appendChild(cell);
                }
                gridDiv.appendChild(row);
            }
            div.appendChild(gridDiv);

            let bottomDiv = goog.dom.createDom("div", {}) as HTMLElement;
            bottomDiv.className = "melody-bottom-bar-div";

            let buttonBarDiv = goog.dom.createDom("div", {}) as HTMLElement;
            buttonBarDiv.className = "melody-button-bar-div";

            let doneButton = document.createElement("button");
            doneButton.id = "melody-done-button";
            doneButton.className = "ui button";
            doneButton.innerText="Done";
            doneButton.addEventListener("click", () => Blockly.DropDownDiv.hideIfOwner(this));
            let iconButtons = goog.dom.createDom("div", {}) as HTMLElement;
            iconButtons.className = "ui icon buttons";
            let playButton = document.createElement("button");
            playButton.className = "ui button";
            playButton.id = "melody-play-button";
            playButton.addEventListener("click", () => this.playMelody());
            let playIcon = document.createElement("i");
            playIcon.id = "melody-play-icon";
            playIcon.className= "play icon";
            playButton.appendChild(playIcon);
            let loopButton = document.createElement("button");
            loopButton.className = "ui button";
            loopButton.id = "melody-loop-button";
            loopButton.addEventListener("click", () => this.loopMelody());
            let loopIcon = document.createElement("i");
            loopIcon.className = "redo xicon";
            loopButton.appendChild(loopIcon);

            iconButtons.appendChild(playButton);
            iconButtons.appendChild(loopButton);
            buttonBarDiv.appendChild(iconButtons);
            buttonBarDiv.appendChild(doneButton);

            let sliderDiv = goog.dom.createDom("div", {}) as HTMLElement;
            sliderDiv.className = "slider-container";

            let tempoSlider = document.createElement("input");
            tempoSlider.id = "melody-tempo-slider";
            tempoSlider.type = "range";
            tempoSlider.className = "ui range";
            tempoSlider.min = "60";
            tempoSlider.max = "200";
            tempoSlider.defaultValue = this.tempo + "";
            tempoSlider.addEventListener("input", () => this.setTempo(+tempoSlider.value));

            let tempoText = document.createElement("input");
            tempoText.value = this.tempo + ""; // will be updated according to slider
            tempoText.id = "melody-tempo-text";
            tempoText.addEventListener("input", () => this.setTempo(+tempoText.value));
            sliderDiv.appendChild(tempoText);
            sliderDiv.appendChild(tempoSlider);
            bottomDiv.appendChild(sliderDiv);
            bottomDiv.appendChild(buttonBarDiv);
            div.appendChild(bottomDiv);

            // create event listeners at the end because the DOM needs to finish loading
            for(var i = 0; i < this.numRow; i++) {
                for(var j = 0; j < this.numCol; j++) {
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
            value = value.slice(1,-1); // remove the boundary quotes
            value = value.trim(); // remove boundary white space
            let melodies: string[] = value.split("-");
            if (!this.melody) {
                this.melody = new pxtmelody.MelodyArray();
            }
            this.setTitle(melodies[0]);
            this.setTempo(Number(melodies[1]));
            for (var i = 2; i < melodies.length-1; i++) { // first two strings are name and tempo
                let notes: string [] = melodies[i].split(" ");
                for (var j = 0; j < notes.length-1; j++) {
                    if (notes[j] != "R") {
                        let rowPos: number = pxtmelody.getRowNum(notes[j]);
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
            if (this.tempo != tempo) {
                this.tempo = tempo;
                this.duration = 60000/tempo;
                if (this.melody) {
                    this.melody.setTempo(this.tempo);
                }
                if (document.getElementById("melody-tempo-text")) {
                    (<HTMLInputElement>document.getElementById("melody-tempo-text")).value = this.tempo + "";
                }
                if (document.getElementById("melody-tempo-slider")) {
                    (<HTMLInputElement>document.getElementById("melody-tempo-slider")).value = this.tempo + "";
                }
            }
        }

        onNoteSelect(id: string): void {
            // parse element id
            let params = id.split("-"); // params[1] is row, params[2] is cell
            let row = params[1];
            let col = params[2];
            

            // play sound if selected
            if (!this.melody.getValue(+row, +col)) {
                this.playNote(row);
                if (this.oneNotePerCol) { // clear all other notes in col
                    for (var i = 0; i< this.numRow; i++) {
                        if(this.melody.getValue(i, +col)) {
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



        playNote(rowNumber: string, colNumber?: number): void {
            let tone: number = 0;
            let cnt: number = ++this.soundingKeys;
            
            switch(rowNumber) {
                case "0": tone = 262; break; // Middle C
                case "1": tone = 294; break; // Middle D
                case "2": tone = 330; break; // Middle E
                case "3": tone = 349; break; // Middle F
                case "4": tone = 392; break; // Middle G
                case "5": tone = 440; break; // Middle A
                case "6": tone = 494; break; // Middle B
                case "7": tone = 523; break; // Tenor C 
            }
            
            if (this.isPlaying) { // when melody is playing
                this.timeouts.push(setTimeout(function() {
                    AudioContextManager.tone(tone);
                }, colNumber*this.duration));
                this.timeouts.push(setTimeout(function() {
                    AudioContextManager.stop();
                }, (colNumber+1)*this.duration));
            } else { // when a single note is selected
                AudioContextManager.tone(tone);
                this.timeouts.push(setTimeout(function() {
                    if (this.soundingKeys == cnt)
                        AudioContextManager.stop();
                }, this.duration));
                this.timeouts.push(setTimeout(function() {
                    AudioContextManager.stop();
                }, this.duration));
            }
        }

        updateColor(id: string, row: number, col: number) {
            let color: string = "";
            switch(row) {
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

        createGridDispaly() {
            if (!this.melody) {
                this.melody = new pxtmelody.MelodyArray();
                return;
            }
            for (var i = 0; i < this.numRow; i++) {
                for (var j = 0; j < this.numCol; j++) {
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
            if (document.getElementById("melody-play-icon").className == "play icon") {
                document.getElementById("melody-play-icon").className = "stop icon";
                this.isPlaying = true;
                for (var i = 0; i < this.numCol; i++) {
                    for (var j = 0; j < this.numRow; j++) {
                        if (this.melody.getValue(j,i)) {
                            if (this.oneNotePerCol) {
                                this.playNote(j+"", i);
                                break;
                            } // will support playing multiple notes in the future
                        }
                    }
                }
                if(!this.isLooping) {
                    this.isPlaying = false;
                    this.timeouts.push(setTimeout(function() {
                        document.getElementById("melody-play-icon").className = "play icon";
                    }, (this.numCol-1)*this.duration));
                } else {
                    this.timeouts.push(setTimeout(
                        this.playMelody, (this.numCol-1)*this.duration));
                }

            } else {
                document.getElementById("melody-play-icon").className = "play icon";
                this.isPlaying = false;
                for (var i = 0; i < this.timeouts.length; i++) {
                    clearTimeout(this.timeouts[i]);
                }
                AudioContextManager.stop();
            }
            
        }

        loopMelody() {
            this.isLooping = !this.isLooping;
        }


    }
}