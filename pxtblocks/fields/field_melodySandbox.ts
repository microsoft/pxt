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
            this.size_.height = this.getPreviewHeight();
            this.size_.width = this.getPreviewWidth();
        }

        showEditor_() {
            // If there is an existing drop-down someone else owns, hide it immediately and clear it.
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.DropDownDiv.clearContent();
            Blockly.DropDownDiv.setColour(this.getDropdownBackgroundColour(), this.getDropdownBorderColour());

            this.renderEditor(Blockly.DropDownDiv.getContentDiv() as HTMLDivElement);
            this.createGridDispaly();
            Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_, () => {
                this.onEditorClose();
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
            div.id = "melody-editor";
            let topDiv = goog.dom.createDom("div", {}) as HTMLElement;
            topDiv.className = "melody-top-bar-div";

            let editorGalleryToggle = goog.dom.createDom("div", {}) as HTMLElement;
            editorGalleryToggle.id = "melody-toggle";
            let editorButton = document.createElement("button");
            editorButton.innerText = "Editor";
            let galleryButton = document.createElement("button");
            galleryButton.innerText = "Gallery";
            editorGalleryToggle.appendChild(editorButton);
            editorGalleryToggle.appendChild(galleryButton);

            topDiv.appendChild(editorGalleryToggle);
            let melodyName = document.createElement("input");
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
                    var cell = document.createElement("button");
                    cell.className = "cell";
                    cell.id = "cell-" + i + "-" + j;
                    row.appendChild(cell);
                }
                gridDiv.appendChild(row);
            }
            div.appendChild(gridDiv);

            let bottomDiv = goog.dom.createDom("div", {}) as HTMLElement;
            bottomDiv.className = "melody-bottom-bar-div";

            let doneButton = document.createElement("button");
            doneButton.id = "melody-done-button";
            doneButton.innerText="Done";
            doneButton.addEventListener("click", () => Blockly.DropDownDiv.hideIfOwner(this));

            let playButton = document.createElement("button");
            playButton.innerText="P"; // will be an icon
            let loopButton = document.createElement("button");
            loopButton.innerText = "L"; // will be an icon

            let tempoSlider = document.createElement("input");
            tempoSlider.id = "melody-tempo-slider";
            tempoSlider.type = "range";
            tempoSlider.min = "60";
            tempoSlider.max = "200";
            tempoSlider.defaultValue = "120";
            tempoSlider.addEventListener("input", () => this.setTempo(+tempoSlider.value));

            let tempoLabel = document.createElement("label");
            tempoLabel.innerText = "120"; // will be updated according to slider
            tempoLabel.id = "melody-tempo-label";

            bottomDiv.appendChild(tempoLabel);
            //bottomDiv.appendChild(tempoSlider);
            bottomDiv.appendChild(playButton);
            bottomDiv.appendChild(loopButton);
            bottomDiv.appendChild(doneButton);
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
            for (var i = 0; i < melodies.length-1; i++) {
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
        }

        protected getDropdownBorderColour() {
            return this.sourceBlock_.getColourSecondary();
        }

        setTitle(melodyName: string): void {
            if (this.title != melodyName) {
                this.title = melodyName;
                Blockly.FieldLabel.prototype.setText.call(this, this.title);
            }
            
        }

        getTitle(): string {
            return this.title;
        }

        setTempo(tempo: number): void {
            if (this.tempo != tempo) {
                this.tempo = tempo;
                document.getElementById("melody-tempo-label").innerText = this.tempo + "";
            }
        }

        onNoteSelect(id: string): void {
            // parse element id
            let params = id.split("-"); // params[1] is row, params[2] is cell
            let row = params[1];
            let col = params[2];
            

            // play sound if selected
            if (!this.melody.getValue(+row, +col)) {
                //this.playNote(row);
                // update button/div color
                this.updateColor(id, +row, +col);
            } else {
                // set color to default
                document.getElementById(id).style.backgroundColor = "";
            }

            // update melody array
            this.melody.updateMelody(+row, +col);
        }



        playNote(rowNumber: string): void {
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
            AudioContextManager.tone(tone);
            setTimeout(function() {
                if (this.soundingKeys == cnt)
                    AudioContextManager.stop();
            }, 100);
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


    }
}