/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    export class FieldCustomMelody<U extends Blockly.FieldCustomOptions> extends Blockly.Field implements Blockly.FieldCustom {
        isFieldCustom_ = true;
        protected params: U;
        mobile = false; // add some check for mobile
        title: string;
        private melody: pxtmelody.MelodyArray;
        soundingKeys: number = 0;
        numRow: number = 8;
        numCol: number = 8;
        tempo: number = 120;

        constructor(value: string, params: U, validator?: Function) {
            super(value, validator);
            this.params = params;
            this.melody = new pxtmelody.MelodyArray();
            this.title = "Name this tune";
        }

        init() {
            super.init();
            this.onInit();
        }

        render_() {
            super.render_();
            this.renderPreview(this.fieldGroup_ as SVGGElement);

            this.size_.height = this.getPreviewWidth();
            this.size_.width = this.getPreviewHeight();
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
            return this.getTypeScriptValue();
        }

        setText(newText: string) {
            if (newText == null) {
                return;
            }
            //this.parseTypeScriptValue(newText);
            super.setText(newText);
            //Blockly.Field.prototype.setText.call(this, newText);
        }


        // This will be run when the field is created (i.e. when it appears on the workspace)
        protected onInit() {
           // this.render_();
           Blockly.FieldLabel.prototype.setText.call(this, this.getTitle());
        }

        // This should render what appears on the block when it is not being edited. It should be an
        // SVG (not HTML)
        protected renderPreview(group: SVGGElement) { // may not need the parameter?
            // let textElement_ = document.createElement("label");
            // textElement_.innerText = this.name;
            // group.appendChild(textElement_);
        }

        // Render the editor that will appear in the dropdown div when the user clicks on the field
        protected renderEditor(div: HTMLDivElement) {
            let topDiv = goog.dom.createDom("div", {}) as HTMLElement;
            topDiv.className = "topBarDiv";
            let editorGalleryToggle = goog.dom.createDom("div", {}) as HTMLElement;
            editorGalleryToggle.style.textAlign = "center";
            let editorButton = document.createElement("button");
            editorButton.innerText = "Editor";
            let galleryButton = document.createElement("button");
            galleryButton.innerText = "Gallery";
            editorGalleryToggle.appendChild(editorButton);
            editorGalleryToggle.appendChild(galleryButton);
            editorGalleryToggle.style.cssFloat = "center";
            topDiv.appendChild(editorGalleryToggle);
            let name = document.createElement("input");
            name.id = "melody-name";
            name.value = this.title;
            name.addEventListener("input", () => this.setTitle(name.value));
            topDiv.appendChild(name);
            div.appendChild(topDiv);

            let gridDiv = goog.dom.createDom("div", {}) as HTMLElement;
            gridDiv.className = "melody-grid-div";
            for(var i = 0; i < this.numRow; i++) {
                var row = document.createElement("div");
                //row.style.cssFloat = "left";
                row.className = "row" + i;
                for(var j = 0; j < this.numCol; j++) {
                    var cell = document.createElement("button");
                    cell.className = "cell";
                    cell.id = "cell-" + i + "-" + j;
                    cell.style.height = "25px";
                    cell.style.width = "25px";
                    row.appendChild(cell);
                }
                gridDiv.appendChild(row);
            }
            div.appendChild(gridDiv);

            let bottomDiv = goog.dom.createDom("div", {}) as HTMLElement;
            bottomDiv.className = "bottomBarDiv";
            let doneButton = document.createElement("button");
            doneButton.innerText="Done";
            doneButton.style.cssFloat = "right";
            doneButton.addEventListener("click", () => Blockly.DropDownDiv.hideIfOwner(this));
            let playButton = document.createElement("button");
            playButton.innerText="P"; // will be an icon
            let loopButton = document.createElement("button");
            loopButton.innerText = "L"; // will be an icon
            let tempoSlider = document.createElement("input");
            tempoSlider.id = "melody-tempo-slider";
            tempoSlider.type = "range";
            // tempoSlider.width = 75;
            tempoSlider.min = "60";
            tempoSlider.max = "200";
            tempoSlider.defaultValue = "120";
            tempoSlider.addEventListener("input", () => this.setTempo(+tempoSlider.value));
            let tempoLabel = document.createElement("label");
            tempoLabel.innerText = "120"; // will be updated according to slider
            tempoLabel.id = "melody-tempo-label";
            bottomDiv.appendChild(doneButton);
            bottomDiv.appendChild(tempoLabel);
            //bottomDiv.appendChild(tempoSlider);
            bottomDiv.appendChild(playButton);
            bottomDiv.appendChild(loopButton);
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

            return "\"00001111\""; // need the extra quotes for it to be recognized as a string
            //return pxtmelody.stringRepresentation(this.melody);
        }

        // This should parse the string returned by getTypeScriptValue() and restore the state based on that
        protected parseTypeScriptValue(value: string) {

        }

        // The width of the preview on the block itself
        protected getPreviewWidth() {
            return 0;
        }

        // The height of the preview on the block itself
        protected getPreviewHeight() {
            return 0;
        }

        protected getDropdownBackgroundColour() {
            return this.sourceBlock_.getColour();
        }

        protected getDropdownBorderColour() {
            return this.sourceBlock_.getColourSecondary();
        }

        setTitle(name: string): void {
            if (this.title != name) {
                this.title = name;
                Blockly.FieldLabel.prototype.setText.call(this, this.getTitle());
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
            }
            document.getElementById(id).style.backgroundColor = color;
        }

        createGridDispaly() {
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