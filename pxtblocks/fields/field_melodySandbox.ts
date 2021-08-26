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
        private duration: number = 1500;
        private volume: number = 0.2;
        private startFrequency: number = 440;
        private endFrequency: number = 880;
        private waveType: string = "square";
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
        private volumeText: HTMLDivElement;
        private volumeInput: HTMLInputElement;
        private startFrequencyText: HTMLDivElement;
        private endFrequencyText: HTMLDivElement;
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
            console.log("made button ");
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
        
                label.innerText = samples[i].name;
    
                innerButton.appendChild(label);
    
    
                outer.appendChild(innerButton);
                innerButton.addEventListener("click", () =>{ this.updateParameters(samples[i], innerButton);  /*this.waveButtons.style.setProperty("background-color", "green")*/} );
                
            }
            

            return outer;
        }

     updateParameters(sample: any, innerButton: HTMLElement){
        console.log("updating parameters!" + sample.name);
        switch(sample.type){
            case "wave":
               this.waveType = sample.name;
               document.getElementById("sine").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("square").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("triangle").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("sawtooth").style.setProperty("background-color", "#dcdcdc");
               innerButton.style.setProperty("background-color", "#c1c1c1");
                console.log(this.waveType);
                return;
            case "interpolation":
               this.interpolationType = sample.name;
               document.getElementById("linear").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("exponential").style.setProperty("background-color", "#dcdcdc");
               document.getElementById("quadratic").style.setProperty("background-color", "#dcdcdc");
                console.log(this.interpolationType);
                innerButton.style.setProperty("background-color", "#c1c1c1");
                return;
        }
           
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
            pxt.BrowserUtils.addClass(this.topDiv, "melody-top-bar-div")
            this.parameters.style.setProperty("background-color", secondaryColor);

            // Add volume input 
            this.volumeText = document.createElement("p");
            this.volumeText.innerText = lf("Volume:  ");

            this.volumeInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.volumeInput, "ui input");
            this.volumeInput.type = "number";
            this.volumeInput.title = lf("Volume");
            this.volumeInput.id = "melody-tempo-input-start-frequency";
            this.volumeInput.addEventListener("input", () => this.setVolume(+this.volumeInput.value));
           
            this.parameters.appendChild(this.volumeText);
            this.volumeText.appendChild(this.volumeInput);


            // Add start and end frequency inputs 
            this.startFrequencyText = document.createElement("p");
            this.startFrequencyText.innerText = lf("Start frequency:  ");

            this.startFrequencyInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.startFrequencyInput, "ui input");
            this.startFrequencyInput.type = "number";
            this.startFrequencyInput.title = lf("Start frequency");
            this.startFrequencyInput.id = "melody-tempo-input-start-frequency";
            this.startFrequencyInput.addEventListener("input", () => this.setStartFrequency(+this.startFrequencyInput.value));
           
            
            this.parameters.appendChild(this.startFrequencyText);
            this.startFrequencyText.appendChild(this.startFrequencyInput);

            this.endFrequencyText = document.createElement("p");
            this.endFrequencyText.innerText = lf("End frequency:  ");

            this.endFrequencyInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.endFrequencyInput, "ui input");
            this.endFrequencyInput.type = "number";
            this.endFrequencyInput.title = lf("End frequency");
            this.endFrequencyInput.id = "melody-tempo-input-start-frequency";
            this.endFrequencyInput.addEventListener("input", () => this.setEndFrequency(+this.endFrequencyInput.value));
        
            
            this.parameters.appendChild(this.endFrequencyText);
            this.endFrequencyText.appendChild(this.endFrequencyInput);


            // Add wave shape and interpolation buttons
            this.wave = document.createElement("div");
            this.wave.innerText = lf("Wave shape: ");
            this.parameters.appendChild(this.wave);
            
            this.waveButtons = this.mkWaveButtons(pxtmelody.SampleWaves);
            this.parameters.appendChild(this.waveButtons);


            this.interpolation = document.createElement("div");
            this.interpolation.innerText = lf("Interpolation: ");
            this.parameters.appendChild(this.interpolation);

            const interpolationButtons = this.mkWaveButtons(pxtmelody.SampleInterpolations);
            this.parameters.appendChild(interpolationButtons);

           

            // Create bottom div with duration and play and done buttons
            this.bottomDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(this.bottomDiv, "melody-bottom-bar-div");
            this.bottomDiv.style.setProperty("background-color", secondaryColor);

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

            // add duration element
            this.durationInput = document.createElement("input");
            pxt.BrowserUtils.addClass(this.durationInput, "ui input");
            this.durationInput.type = "number";
            this.durationInput.title = lf("duration");
            this.durationInput.id = "melody-tempo-input";
            this.durationInput.addEventListener("input", () => this.setSoundDuration(+this.durationInput.value));
            this.syncDurationField(true);

            this.bottomDiv.appendChild(this.durationInput);
            this.bottomDiv.appendChild(this.playButton);
            this.bottomDiv.appendChild(this.doneButton);

            this.editorDiv.appendChild(this.parameters);
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
            //we will make it into is this a valid input function
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
            this.startFrequency = frequency;
            console.log("set start frequency to " + this.startFrequency);
        }

        private setVolume(volume:number):void{
            this.volume = volume;
            console.log("set end volume to " + this.volume);
        }

        private setEndFrequency(frequency:number):void{
            this.endFrequency = frequency;
            console.log("set end frequency to " + this.endFrequency);
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

        private playNote(): void {
            if (this.isPlaying) {
                pxt.AudioContextManager.sound( this.startFrequency, this.endFrequency, this.duration, this.waveType, this.volume, this.interpolationType );
                
                this.timeouts.push(setTimeout(() => {
                    this.togglePlay();
                }, this.getDuration() ));
            }
            else {
                this.stopMelody();
            }
        }

    

        private togglePlay() {
            //this will toggle if we are playing a note
            if (!this.isPlaying) {
                this.isPlaying = true;
                this.playNote();
            } else {
                this.stopMelody();
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


        private stopMelody() {
            //stops the sound
            if (this.isPlaying) {
                while (this.timeouts.length) clearTimeout(this.timeouts.shift());
                pxt.AudioContextManager.stop();
                this.isPlaying = false;
            }
        }

        private showGallery() {
            //for showing the gallery of sounds
            this.stopMelody();
            this.updatePlayButton();
            this.gallery.show((result: string) => {
                if (result) {
                    this.gallery.hide();
                    this.toggle.toggle();
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
