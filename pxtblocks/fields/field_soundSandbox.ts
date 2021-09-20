/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;
   
    export class FieldCustomSound<U extends Blockly.FieldCustomOptions> extends Blockly.Field implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public SERIALIZABLE = true;
        protected params: U;
        private melody: pxtmelody.MelodyArray;
        private duration: number = 1500;
        private volume: number = 0.2*10;
        private startFrequency: number = 440;
        private hz1: any;
        private hz2: any;
        private seconds: any;
        private chart: any;
        private canvas: any;
        private endFrequency: number = 880;
        private waveType: string = "square";
        private arrow: any;
        private waveButtons:any;
        private interpolationType: string = "linear";
        private stringRep: string;
        private isPlaying: boolean = false;
        private timeouts: any[] = []; // keep track of timeouts
        private invalidString: string;
        private prevString: string;
    
        // DOM references
        private topDiv: HTMLDivElement;
        private editorDiv: HTMLDivElement;
        private parameters: HTMLDivElement;
        private frequencies:  HTMLDivElement; 
        private volumeText: any;
        private volumeInput: HTMLInputElement;
        private startFrequencyText: any;
        private endFrequencyText: any;
        private wave: HTMLDivElement;
        private interpolation: HTMLDivElement;
        private bottomDiv: HTMLDivElement; 
        private doneButton: HTMLButtonElement;
        private playButton: HTMLButtonElement;
        private playIcon: HTMLElement;
        private durationInput: HTMLInputElement;
        private startFrequencyInput: HTMLInputElement;
        private endFrequencyInput: HTMLInputElement;

        // Use toggle from sprite editor
        private toggle: Toggle;
        private root: svg.SVG;
        private gallery: pxtmelody.SoundGallery;

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

            this.gallery = new pxtmelody.SoundGallery();
            this.renderEditor(contentDiv);


            // The webapp listens to this event and stops the simulator so that you don't get a sound
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

        mkWaveButtons(samples: any){
            const outer = mkElement("div", {
               className: "melody-gallery-button melody-editor-card",
                id: "waveButtons"
            });
            for(let i = 0; i < samples.length; i++){
                const innerButton = mkElement("div", {
                    className: "melody-gallery-button melody-editor-card",
                    role: "menuitem",
                    id: samples[i].name,
                    name: samples[i].type
                } );
        
                const label = mkElement("div", {
                    className: "melody-editor-text"
                });

                const im = document.createElement("img");
                pxt.BrowserUtils.addClass(im, "wave-image");
                im.src = samples[i].image;
                console.log(im.height+ " " + im.width);
                im.height = 35;
                im.width = 60;
            
                
        
                label.innerText = samples[i].name;
    
               innerButton.title = samples[i].name;
                innerButton.appendChild(im);
    
                outer.appendChild(innerButton);
                innerButton.addEventListener("click", () =>{ this.updateParameters(samples[i], innerButton); this.updateGraph();  /*this.waveButtons.style.setProperty("background-color", "green")*/} );
            }
            return outer;
        }

     updateParameters(sample: any, innerButton: HTMLElement){
        switch(sample.type){
            case "wave":
               this.waveType = sample.name;
               document.getElementById("sine").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("square").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("triangle").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("sawtooth").style.setProperty("background-color", "#dcdcdc");
               innerButton.style.setProperty("background-color", "#c1c1c1");
               this.syncWaveField(false);
                return;
            case "interpolation":
               this.interpolationType = sample.name;
               document.getElementById("linear").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("exponential").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("quadratic").style.setProperty("background-color", "#dcdcdc");
               innerButton.style.setProperty("background-color", "#c1c1c1");
               this.syncInterpolationField(false);
               return;
        }     
    }

    updateFields(){
        document.getElementById(this.waveType).click();
        document.getElementById(this.interpolationType).click();
    }

    updateInputs(){
       this.volumeInput.value= this.volume.toString();
       this.syncVolumeField(false);
       this.startFrequencyInput.value = this.startFrequency.toString();
       this.syncStartFrequencyField(false);
       this.endFrequencyInput.value = this.endFrequency.toString();
       this.syncEndFrequencyField(false);
       this.durationInput.value = this.duration.toString();
       this.syncDurationField(false);
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

        getText_() {
            if (this.invalidString) return pxt.Util.lf("Invalid Input");
            else return this.getValue();
        }

        // This will be run when the field is created (i.e. when it appears on the workspace)
        protected onInit() {
            this.render_();
            this.createMelodyIfDoesntExist();

            if (!this.invalidString) {
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
                this.size_.width = 45;
            }
            this.sourceBlock_.setColour("#ffffff");
        }

        // Render the editor that will appear in the dropdown div when the user clicks on the field
        protected renderEditor(div: HTMLDivElement) {
            // Set colours
            let color = this.getDropdownBackgroundColour();
            let secondaryColor = this.getDropdownBorderColour();

            this.topDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.topDiv, "melody-top-bar-div");

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

            // editor div
            this.editorDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.editorDiv, "melody-editor-div");
            this.editorDiv.style.setProperty("background-color", secondaryColor);


            // add parameters div to editor div
            this.parameters = document.createElement("div");
            pxt.BrowserUtils.addClass(this.parameters, "melody-top-bar-div-parameters")
            this.parameters.style.setProperty("background-color", secondaryColor);
            
            this.frequencies = document.createElement("div");
            this.frequencies.style.setProperty("background-color", secondaryColor);
            this.parameters.appendChild(this.frequencies);

            

            // Add start and end frequency inputs 
            this.startFrequencyText = document.createElement("span");
            this.startFrequencyText.innerText = lf("Start ");

            this.startFrequencyInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.startFrequencyInput, "ui-input");
            this.startFrequencyInput.type = "number";
            this.startFrequencyInput.title = lf("Start frequency");
            this.startFrequencyInput.value = this.startFrequency.toString();
            this.startFrequencyInput.id = "melody-tempo-input-start-frequency";
            this.startFrequencyInput.addEventListener("input", () => {this.setStartFrequency(+this.startFrequencyInput.value); this.updateGraph()});
            this.syncStartFrequencyField(true);

            this.hz1 = document.createElement("span");
            this.hz1.innerText = " Hz ";

            this.arrow = document.createElement("i");
            pxt.BrowserUtils.addClass(this.arrow, "arrow right icon");
            

            this.endFrequencyText = document.createElement("span");
            this.endFrequencyText.innerText = lf("End ");

            this.endFrequencyInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.endFrequencyInput, "ui input");
            this.endFrequencyInput.type = "number";
            this.endFrequencyInput.title = lf("End frequency");
            this.endFrequencyInput.value = this.endFrequency.toString();
            this.endFrequencyInput.id = "melody-tempo-input-start-frequency";
            this.endFrequencyInput.addEventListener("input", () => {this.setEndFrequency(+this.endFrequencyInput.value); this.updateGraph()});
            this.syncEndFrequencyField(true);

            this.hz2 = document.createElement("span");
            this.hz2.innerText = " Hz  for  "

            // add duration element
            this.durationInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.durationInput, "ui-input");
            this.durationInput.type = "number";
            this.durationInput.title = lf("duration");
            this.durationInput.id = "melody-tempo-input-start-frequency";
            this.durationInput.addEventListener("input", () => this.setSoundDuration(+this.durationInput.value));
            this.syncDurationField(true);

            this.seconds = document.createElement("span");
            this.seconds.innerText = " ms  "

           this.frequencies.appendChild(this.startFrequencyText);
            this.frequencies.appendChild(this.startFrequencyInput);
            this.frequencies.appendChild(this.hz1);
            this.frequencies.appendChild(this.arrow);
            this.frequencies.appendChild(this.endFrequencyText);
            this.frequencies.appendChild(this.endFrequencyInput);
            this.frequencies.appendChild(this.hz2);
            this.frequencies.appendChild(this.durationInput);
            this.frequencies.appendChild(this.seconds);


            // Add wave shape and interpolation buttons
            this.wave = document.createElement("div");
            this.wave.innerText = lf("Wave shape: ");

            this.parameters.appendChild(this.wave);
            
            this.waveButtons = this.mkWaveButtons(pxtmelody.SampleWaves);
            this.syncWaveField(true);
            this.parameters.appendChild(this.waveButtons);

            this.interpolation = document.createElement("div");
            this.interpolation.innerText = lf("Interpolation: ");
            this.parameters.appendChild(this.interpolation);

            const interpolationButtons = this.mkWaveButtons(pxtmelody.SampleInterpolations);
            this.syncInterpolationField(true);
            this.parameters.appendChild(interpolationButtons);
            setTimeout(() => {
                this.updateFields();
            }, 10);

            // Create bottom div with duration and play and done buttons
            this.bottomDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.bottomDiv, "melody-bottom-bar-div");
            this.bottomDiv.style.setProperty("background-color", secondaryColor);

            this.volumeInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.volumeInput, "ui-input-volume");
            this.volumeInput.type = "number";
            this.volumeInput.value = "2";
            this.volumeInput.title = lf("Volume");
            this.volumeInput.id = "volume";
            this.volumeInput.addEventListener("input", () => this.setVolume(+this.volumeInput.value));
            this.syncVolumeField(true);

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

            

            this.canvas = document.createElement("canvas");
            pxt.BrowserUtils.addClass(this.canvas, "myCanvas");
            this.canvas.width="440";
            this.canvas.height="100";
            this.canvas.style="border:4px solid #d3d3d3";

            var csv = this.createCsv()
            console.log(csv)
            var canvasWidth = this.canvas.width;
            var canvasHeight = this.canvas.height;
            var ctx = this.canvas.getContext("2d");

            for(let i = 0; i<csv.length; i++){

                ctx.beginPath();
                ctx.arc(Math.round((i/csv.length)*canvasWidth), 100 - Math.round(csv[i]/200), 1, 0, 2 * Math.PI);
                ctx.stroke();
                }

           
            this.parameters.appendChild(this.canvas);
            this.bottomDiv.appendChild(this.volumeInput);
            this.bottomDiv.appendChild(this.playButton);
            this.bottomDiv.appendChild(this.doneButton);

            this.editorDiv.appendChild(this.parameters);
            this.editorDiv.appendChild(this.bottomDiv);

            div.appendChild(this.editorDiv);
        }

        // Runs when the editor is closed by clicking on the Blockly workspace
        protected onEditorClose() {
            this.stopSound();
            if (this.gallery) {
                this.gallery.stopSound();
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

        //will run when the editor is closed
        private clearDomReferences() {
            this.topDiv = null;
            this.editorDiv = null;
            this.parameters = null;
            this.bottomDiv = null;
            this.doneButton = null;
            this.playButton = null;
            this.playIcon = null;
            this.durationInput = null;
            this.toggle = null;
            this.root = null;
            this.gallery.clearDomReferences();
            this.startFrequencyInput = null;
            this.endFrequencyInput = null;
        }

        private updateGraph(){
           
            var ctx = this.canvas.getContext("2d");
            var csv = this.createCsv()


ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            for(let i = 0; i<csv.length; i++){

                ctx.beginPath();
                ctx.arc(Math.round((i/csv.length)*this.canvas.width), 100 - Math.round(csv[i]/200), 1, 0, 2 * Math.PI);
                ctx.stroke();
                }

        } 

        // This is the string that will be inserted into the user's TypeScript code
        protected getTypeScriptValue(): string {
            if (this.invalidString) {
                return this.invalidString;
            }
            if (this.melody) {
                return "\"" + "\"";
            }
            return "";
        }

        // This should parse the string returned by getTypeScriptValue() and restore the state based on that
        protected parseTypeScriptValue(value: string) {
            let oldValue: string = value;
            try {
                this.updateFieldLabel();
            } catch (e) {
                pxt.log(e)
                this.invalidString = oldValue;
            }
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
            if (this.sourceBlock_.parentBlock_) {
                return this.sourceBlock_.parentBlock_.getColour();
            } else {
                return "#3D3D3D";
            }
        }

        protected getDropdownBorderColour() {
            if (this.sourceBlock_.parentBlock_) {
                return (this.sourceBlock_.parentBlock_ as Blockly.BlockSvg).getColourTertiary();
            } else {
                return "#2A2A2A";
            }
        }

        private updateFieldLabel(): void {
            //this will ultimately create a visual sound preview
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            let musicIcon = mkText("\uf001")
                .appendClass("melody-editor-field-icon")
                .at(6, 15);
            let musicIcon2 = mkText("\uf001")
                .appendClass("melody-editor-field-icon")
                .at(30, 15);
            this.fieldGroup_.appendChild(musicIcon.el);
            this.fieldGroup_.appendChild(musicIcon2.el);
        }


        private setSoundDuration(duration:number): void {
                // update duration and display to reflect new duration
            if (this.duration != duration) {
                this.duration = duration;
                if (this.melody) {
                    this.melody.setTempo(this.duration);
                }
                if (this.durationInput) {
                    this.durationInput.value = this.duration + "";
                }
                this.syncDurationField(false);
            }
        }

        private setStartFrequency(frequency:number):void{
              // update startfrequency and display to reflect new start frequency
              if (this.startFrequency != frequency) {
                this.startFrequency = frequency;
                if (this.startFrequencyInput) {
                    this.startFrequencyInput.value = this.startFrequency + "";
                }
                this.syncStartFrequencyField(false);
        }
    }

    private setEndFrequency(frequency:number):void{
         // update end frequency and display to reflect new end frequency
         if (this.endFrequency != frequency) {
            this.endFrequency = frequency;
            if (this.endFrequencyInput) {
                this.endFrequencyInput.value = this.endFrequency + "";
            }
            this.syncEndFrequencyField(false);
    }
    }

        private setVolume(volume:number):void{
           // update end volume and display to reflect new end volume
         if (this.volume != volume) {
            this.volume = volume;
            if (this.volumeInput) {
                this.volumeInput.value = this.volume + "";
            }
            this.syncVolumeField(false);
        }
    }

        // sync value from duration field on block with duration in field editor
        private syncDurationField(blockToEditor: boolean): void {
            const s = this.sourceBlock_;
            if (s.parentBlock_) {
                const p = s.parentBlock_;
                for (const input of p.inputList) {
                    if (input.name === "duration") {
                        const durationBlock = input.connection.targetBlock();
                        if (durationBlock) {
                            if (blockToEditor)
                                if (durationBlock.getFieldValue("SLIDER")) {
                                    this.durationInput.value = durationBlock.getFieldValue("SLIDER");
                                    this.duration = +this.durationInput.value;
                                } else {
                                    this.durationInput.value = this.duration + "";
                                }
                            else { // Editor to block
                                if (durationBlock.type === "math_number_minmax") {
                                    durationBlock.setFieldValue(this.durationInput.value, "SLIDER")
                                }
                                else {
                                    durationBlock.setFieldValue(this.durationInput.value, "NUM")
                                }
                                this.durationInput.focus();
                            }
                        }
                        break;
                    }
                }
            }
        }

            // sync value from start frequency field on block with start frequency in field editor
            private syncStartFrequencyField(blockToEditor: boolean): void {
                const s = this.sourceBlock_;
                if (s.parentBlock_) {
                    const p = s.parentBlock_;
                    for (const input of p.inputList) {
                        if (input.name === "freq1") {
                            const startFrequencyBlock = input.connection.targetBlock();
                            if (startFrequencyBlock) {
                                if (blockToEditor)
                                    if (startFrequencyBlock.getFieldValue("SLIDER")) {
                                        this.startFrequencyInput.value = startFrequencyBlock.getFieldValue("SLIDER");
                                        this.startFrequency = +this.startFrequencyInput.value;
                                    } else {
                                        this.startFrequencyInput.value = this.startFrequency + "";
                                    }
                                else { // Editor to block
                                    if (startFrequencyBlock.type === "math_number_minmax") {
                                        startFrequencyBlock.setFieldValue(this.startFrequencyInput.value, "SLIDER")
                                    }
                                    else {
                                        startFrequencyBlock.setFieldValue(this.startFrequencyInput.value, "NUM")
                                    }
                                    this.startFrequencyInput.focus();
                                }
                            }
                            break;
                        }
                    }
                }
            }
    
            // sync value from start frequency field on block with start frequency in field editor
            private syncEndFrequencyField(blockToEditor: boolean): void {
                const s = this.sourceBlock_;
                if (s.parentBlock_) {
                    const p = s.parentBlock_;
                    for (const input of p.inputList) {
                        if (input.name === "freq2") {
                            const endFrequencyBlock = input.connection.targetBlock();
                            if (endFrequencyBlock) {
                                if (blockToEditor)
                                    if (endFrequencyBlock.getFieldValue("SLIDER")) {
                                        this.endFrequencyInput.value = endFrequencyBlock.getFieldValue("SLIDER");
                                        this.endFrequency = +this.endFrequencyInput.value;
                                    } else {
                                        this.endFrequencyInput.value = this.endFrequency + "";
                                    }
                                else { // Editor to block
                                    if (endFrequencyBlock.type === "math_number_minmax") {
                                        endFrequencyBlock.setFieldValue(this.endFrequencyInput.value, "SLIDER")
                                    }
                                    else {
                                        endFrequencyBlock.setFieldValue(this.endFrequencyInput.value, "NUM")
                                    }
                                    this.endFrequencyInput.focus();
                                }
                            }
                            break;
                        }
                    }
                }
            }

               // sync value from volume field on block with volume in field editor
        private syncVolumeField(blockToEditor: boolean): void {
            const s = this.sourceBlock_;
            if (s.parentBlock_) {
                const p = s.parentBlock_;
                for (const input of p.inputList) {
                    if (input.name === "volume") {
                        const volumeBlock = input.connection.targetBlock();
                        if (volumeBlock) {
                            if (blockToEditor)
                                if (volumeBlock.getFieldValue("SLIDER")) {
                                    this.volumeInput.value = volumeBlock.getFieldValue("SLIDER");
                                    this.volume = +this.volumeInput.value;
                                } else {
                                    this.volumeInput.value = this.volume + "";
                                }
                            else { // Editor to block
                                if (volumeBlock.type === "math_number_minmax") {
                                    volumeBlock.setFieldValue(this.volumeInput.value, "SLIDER")                                  
                                }
                                else {
                                    volumeBlock.setFieldValue(this.volumeInput.value, "NUM")
                                }
                                this.volumeInput.focus();
                            }
                        }
                        break;
                    }
                }
            }
        }

        // sync value from wave field on block with volume in field editor
               private syncWaveField(blockToEditor: boolean): void {
                const s = this.sourceBlock_;
                if (s.parentBlock_) {
                    const p = s.parentBlock_;
                    
                    for (const input of p.inputList) {
                        if (input.name === "0_optional_field0") {
                            if(blockToEditor){
                                switch(this.sourceBlock_.parentBlock_.getFieldValue("waveType")){
                                    case "WaveType.SineWave":
                                        this.waveType = "sine";
                                        break;
                                    case "WaveType.SquareWave":
                                        this.waveType = "square";
                                        break;
                                    case "WaveType.TriangleWave":
                                        this.waveType = "triangle";
                                        break;
                                    case "WaveType.SawtoothWave":
                                        this.waveType = "sawtooth";
                                        break;
                                        
                                }
                                setTimeout(() => {
                                    this.updateFields();
                                }, 10); 
                            
                            }
                            else { //editor to block
                                switch(this.waveType){
                                    case "sine":
                                        this.sourceBlock_.parentBlock_.setFieldValue("WaveType.SineWave", "waveType");
                                        break;
                                    case "square":
                                        this.sourceBlock_.parentBlock_.setFieldValue("WaveType.SquareWave", "waveType");
                                        break;
                                    case "triangle":
                                        this.sourceBlock_.parentBlock_.setFieldValue("WaveType.TriangleWave", "waveType");
                                        break;
                                    case "sawtooth":
                                        this.sourceBlock_.parentBlock_.setFieldValue("WaveType.SawtoothWave", "waveType");
                                        break;
                                }
                            }
                      
                            
                        }
                }
            }
               }


         // sync value from wave field on block with volume in field editor
         private syncInterpolationField(blockToEditor: boolean): void {
            const s = this.sourceBlock_;
            if (s.parentBlock_) {
                const p = s.parentBlock_;
                
                for (const input of p.inputList) {
                    if (input.name === "0_optional_field1") {
                        if(blockToEditor){
                            switch(this.sourceBlock_.parentBlock_.getFieldValue("interpolation")){
                                case "Interpolation.Linear":
                                    this.interpolationType = "linear";
                                    break;
                                case "Interpolation.Quadratic":
                                    this.interpolationType = "quadratic";
                                    break;
                                case "Interpolation.Exponential":
                                    this.interpolationType = "exponential";
                                    break;
                            }
                            setTimeout(() => {
                                this.updateFields();
                            }, 10); 
                        }
                        else { //editor to block
                            switch(this.interpolationType){
                                case "linear":
                                    this.sourceBlock_.parentBlock_.setFieldValue("Interpolation.Linear", "interpolation");
                                    break;
                                case "quadratic":
                                    this.sourceBlock_.parentBlock_.setFieldValue("Interpolation.Quadratic", "interpolation");
                                    break;
                                case "exponential":
                                    this.sourceBlock_.parentBlock_.setFieldValue("Interpolation.Exponential", "interpolation");
                                    break;
                        }
                        }     
                    }
            }
        }
           }

        // ms to hold note
        private getDuration(): number {
            //this will return the duration 
            return this.duration;
        }

        private createMelodyIfDoesntExist(): boolean {
            //will become a create sound if doesn't exsist function
            if (!this.melody) {
                this.melody = new pxtmelody.MelodyArray();
                return true;
            }
            return false;
        }

        protected playToneCore(frequency: number) {
            pxt.AudioContextManager.tone(frequency);
        }

        private createCsv(){
            let divisor = 100;
            let timeDivision = this.duration/divisor;
            let frequencyDivision = (this.endFrequency - this.startFrequency)/divisor;
            let csv = [];

            switch(this.interpolationType){
                case "linear":
                    for(let i = 0; i < divisor; i++) {
                        
                        let frequency = this.startFrequency + (i * frequencyDivision)
                        csv.push(frequency);
                    }
                     return csv;
                case "exponential":
                    for(let i = 0; i < divisor; i++) {
                        let frequency = this.startFrequency + ( (this.endFrequency - this.startFrequency) / Math.pow( 1.1 , divisor-1) ) * Math.pow( 1.1 , i );
                        csv.push(frequency);    
                     }
                     return csv;
                case "quadratic":
                    for(let i = 0; i < divisor; i++) {
                        let frequency = this.startFrequency + ( (this.endFrequency - this.startFrequency) / Math.pow( divisor-1 , 3) ) * Math.pow( i , 3 ) ;
                           csv.push(frequency);
                    }
                    return csv;
                default:
                    for(let i = 0; i < divisor; i++) {
                        
                        let frequency = this.startFrequency + (i * frequencyDivision)
                        csv.push(frequency);
                    }
                     return csv;
            }
        }

        private playSound(): void {
            if (this.isPlaying) {
                pxt.AudioContextManager.sound( this.startFrequency, this.endFrequency, this.duration, this.waveType, this.volume, this.interpolationType );
               // this.createCsv();
                this.timeouts.push(setTimeout(() => {
                    this.togglePlay();
                }, this.getDuration() ));
            }
            else {
                this.stopSound();
            }
        }


        private togglePlay() {
            //this will toggle if we are playing a note
            if (!this.isPlaying) {
                this.isPlaying = true;
                this.playSound();
            } else {
                this.stopSound();
            }
            this.updatePlayButton();
        }

        private updatePlayButton() {
            //can be kept the same for playing the sound
            if (this.isPlaying) {
                pxt.BrowserUtils.removeClass(this.playIcon, "play icon");
                pxt.BrowserUtils.addClass(this.playIcon, "stop icon");
            }
            else {
                pxt.BrowserUtils.removeClass(this.playIcon, "stop icon");
                pxt.BrowserUtils.addClass(this.playIcon, "play icon");
            }
        }


        private stopSound() {
            //stops the sound
            if (this.isPlaying) {
                while (this.timeouts.length) clearTimeout(this.timeouts.shift());
                pxt.AudioContextManager.stop();
                this.isPlaying = false;
            }
        }

        private showGallery() {
            //for showing the gallery of sounds
            this.stopSound();
            this.updatePlayButton();
            this.gallery.show((volume: number, startFrequency: number, endFrequency: number, duration: number,  waveType: string, interpolationType:string) => {
                if (startFrequency) {
                    this.gallery.hide();
                    this.toggle.toggle();
                    this.volume = volume;
                    this.startFrequency = startFrequency;
                    this.endFrequency = endFrequency;
                    this.duration = duration;
                    this.waveType = waveType;
                    this.interpolationType = interpolationType;
                    this.updateFields();
                    this.updateInputs();
                }
            });
        }

        private hideGallery() {
            //this will hide our gallery
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
            //this will toggle us between gallery and editor mode
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

    




    function mkElement(tag: string, props?: {[index: string]: string | number}, onClick?: () => void): HTMLElement {
        const el = document.createElement(tag);
        return initElement(el, props, onClick);
    }


    function initElement(el: HTMLElement, props?: {[index: string]: string | number}, onClick?: () => void) {
        if (props) {
            for (const key of Object.keys(props)) {
                if (key === "className") el.setAttribute("class", props[key] + "")
                else el.setAttribute(key, props[key] + "");
            }
        }

        if (onClick) {
            el.addEventListener("click", onClick);
        }

        return el;
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
