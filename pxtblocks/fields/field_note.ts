/// <reference path="../../localtypings/pxtblockly.d.ts" />

namespace pxtblockly {

    enum Note {
        C = 262,
        CSharp = 277,
        D = 294,
        Eb = 311,
        E = 330,
        F = 349,
        FSharp = 370,
        G = 392,
        GSharp = 415,
        A = 440,
        Bb = 466,
        B = 494,
        C3 = 131,
        CSharp3 = 139,
        D3 = 147,
        Eb3 = 156,
        E3 = 165,
        F3 = 175,
        FSharp3 = 185,
        G3 = 196,
        GSharp3 = 208,
        A3 = 220,
        Bb3 = 233,
        B3 = 247,
        C4 = 262,
        CSharp4 = 277,
        D4 = 294,
        Eb4 = 311,
        E4 = 330,
        F4 = 349,
        FSharp4 = 370,
        G4 = 392,
        GSharp4 = 415,
        A4 = 440,
        Bb4 = 466,
        B4 = 494,
        C5 = 523,
        CSharp5 = 555,
        D5 = 587,
        Eb5 = 622,
        E5 = 659,
        F5 = 698,
        FSharp5 = 740,
        G5 = 784,
        GSharp5 = 831,
        A5 = 880,
        Bb5 = 932,
        B5 = 988,
        C6 = 1047,
        CSharp6 = 1109,
        D6 = 1175,
        Eb6 = 1245,
        E6 = 1319,
        F6 = 1397,
        FSharp6 = 1480,
        G6 = 1568,
        GSharp6 = 1568,
        A6 = 1760,
        Bb6 = 1865,
        B6 = 1976,
        C7 = 2093
    }

    interface NoteData {
        name: string,
        prefixedName: string,
        altPrefixedName?: string,
        freq: number
    }

    const Notes: {[key: number]: NoteData} = {
        28: {name: "C", prefixedName: "Low C", freq: 131},
        29: {name: "C#", prefixedName: "Low C#", freq: 139},
        30: {name: "D", prefixedName: "Low D", freq: 147},
        31: {name: "D#", prefixedName: "Low D#", freq: 156},
        32: {name: "E", prefixedName: "Low E", freq: 165},
        33: {name: "F", prefixedName: "Low F", freq: 175},
        34: {name: "F#", prefixedName: "Low F#", freq: 185},
        35: {name: "G", prefixedName: "Low G", freq: 196},
        36: {name: "G#", prefixedName: "Low G#", freq: 208},
        37: {name: "A", prefixedName: "Low A", freq: 220},
        38: {name: "A#", prefixedName: "Low A#", freq: 233},
        39: {name: "B", prefixedName: "Low B", freq: 247},

        40: {name: "C", prefixedName: "Middle C", freq: 262},
        41: {name: "C#", prefixedName: "Middle C#", freq: 277},
        42: {name: "D", prefixedName: "Middle D", freq: 294},
        43: {name: "D#", prefixedName: "Middle D#", freq: 311},
        44: {name: "E", prefixedName: "Middle E", freq: 330},
        45: {name: "F", prefixedName: "Middle F", freq: 349},
        46: {name: "F#", prefixedName: "Middle F#", freq: 370},
        47: {name: "G", prefixedName: "Middle G", freq: 392},
        48: {name: "G#", prefixedName: "Middle G#", freq: 415},
        49: {name: "A", prefixedName: "Middle A", freq: 440},
        50: {name: "A#", prefixedName: "Middle A#", freq: 466},
        51: {name: "B", prefixedName: "Middle B", freq: 494},

        52: {name: "C", prefixedName: "Tenor C", altPrefixedName: "High C", freq: 523},
        53: {name: "C#", prefixedName: "Tenor C#", altPrefixedName: "High C#", freq: 554},
        54: {name: "D", prefixedName: "Tenor D", altPrefixedName: "High D", freq: 587},
        55: {name: "D#", prefixedName: "Tenor D#", altPrefixedName: "High D#", freq: 622},
        56: {name: "E", prefixedName: "Tenor E", altPrefixedName: "High E", freq: 659},
        57: {name: "F", prefixedName: "Tenor F", altPrefixedName: "High F", freq: 698},
        58: {name: "F#", prefixedName: "Tenor F#", altPrefixedName: "High F#", freq: 740},
        59: {name: "G", prefixedName: "Tenor G", altPrefixedName: "High G", freq: 784},
        60: {name: "G#", prefixedName: "Tenor G#", altPrefixedName: "High G#", freq: 831},
        61: {name: "A", prefixedName: "Tenor A", altPrefixedName: "High A", freq: 880},
        62: {name: "A#", prefixedName: "Tenor A#", altPrefixedName: "High A#", freq: 932},
        63: {name: "B", prefixedName: "Tenor B", altPrefixedName: "High B", freq: 988},

        64: {name: "C", prefixedName: "High C", freq: 1046},
        65: {name: "C#", prefixedName: "High C#", freq: 1109},
        66: {name: "D", prefixedName: "High D", freq: 1175},
        67: {name: "D#", prefixedName: "High D#", freq: 1245},
        68: {name: "E", prefixedName: "High E", freq: 1319},
        69: {name: "F", prefixedName: "High F", freq: 1397},
        70: {name: "F#", prefixedName: "High F#", freq: 1478},
        71: {name: "G", prefixedName: "High G", freq: 1568},
        72: {name: "G#", prefixedName: "High G#", freq: 1661},
        73: {name: "A", prefixedName: "High A", freq: 1760},
        74: {name: "A#", prefixedName: "High A#", freq: 1865},
        75: {name: "B", prefixedName: "High B", freq: 1976}
    }

    let regex: RegExp = /^Note\.(.+)$/;

    export interface FieldNoteOptions extends Blockly.FieldCustomOptions {
        editorColour?: string;
        minNote?: string;
        maxNote?: string;
    }

    //  Class for a note input field.
    export class FieldNote extends Blockly.FieldNumber implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        //  value of the field
        private note_: string;

        //  colour of the dropdown
        private colour_: string;
        //  colour of the dropdown border
        private colourBorder_: string;

        /**
         * default number of piano keys
         * @type {number}
         * @private
         */
        private nKeys_: number = 36;
        private minNote_: number = 28;
        private maxNote_: number = 63;

        /**
         * Absolute error for note frequency identification (Hz)
         * @type {number}
         */
        eps: number = 2;

        /**
         * array of notes frequency
         * @type {Array.<number>}
         * @private
         */
        private noteFreq_: Array<number> = [];

        /**
         * array of notes names
         * @type {Array.<string>}
         * @private
         */
        private noteName_: Array<string> = [];

        constructor(text: string, params: FieldNoteOptions, validator?: Function) {
            super(text);

            (FieldNote as any).superClass_.constructor.call(this, text, validator);
            this.note_ = text;

            if (params.editorColour) {
                this.colour_ = pxtblockly.parseColour(params.editorColour);
                this.colourBorder_ = goog.color.rgbArrayToHex(goog.color.darken(goog.color.hexToRgb(this.colour_), 0.2));
            }

            let minNote = parseInt(params.minNote) || this.minNote_;
            let maxNote = parseInt(params.maxNote) || this.maxNote_;
            if (minNote >= 28 && maxNote <= 76 && maxNote > minNote) {
                this.minNote_ = minNote;
                this.maxNote_ = maxNote;
                this.nKeys_ = this.maxNote_ - this.minNote_ + 1;
            }
        }

        /**
         * Ensure that only a non negative number may be entered.
         * @param {string} text The user's text.
         * @return {?string} A string representing a valid positive number, or null if invalid.
         */
        classValidator(text: string) {
            if (text === null) {
                return null;
            }
            text = String(text);

            let n = parseFloat(text || "0");
            if (isNaN(n) || n < 0) {
                // Invalid number.
                return null;
            }
            // Get the value in range.
            return String(n);
        }

        /**
         * Install this field on a block.
         */
        init() {
            (FieldNote as any).superClass_.init.call(this);
            this.noteFreq_.length = 0;
            this.noteName_.length = 0;
            let thisField = this;
            //  Create arrays of name/frequency of the notes
            createNotesArray();
            this.setValue(this.callValidator(this.getValue()));

            /**
             * create Array of notes name and frequencies
             * @private
             */
            function createNotesArray() {
                for (let i = thisField.minNote_; i <= thisField.maxNote_; i++) {
                    let name = Notes[i].prefixedName;
                    // special case: one octave
                    if (thisField.nKeys_ < 13) {
                        name = Notes[i].name;
                    }
                    // special case: centered
                    else if (thisField.minNote_ >= 28 && thisField.maxNote_ <= 63) {
                        name = Notes[i].altPrefixedName || name;
                    }
                    thisField.noteName_.push(ts.pxtc.Util.rlf(name));
                    thisField.noteFreq_.push(Notes[i].freq);
                }

                // Do not remove this comment.
                // lf("C")
                // lf("C#")
                // lf("D")
                // lf("D#")
                // lf("E")
                // lf("F")
                // lf("F#")
                // lf("G")
                // lf("G#")
                // lf("A")
                // lf("A#")
                // lf("B")
                // lf("Deep C")
                // lf("Deep C#")
                // lf("Deep D")
                // lf("Deep D#")
                // lf("Deep E")
                // lf("Deep F")
                // lf("Deep F#")
                // lf("Deep G")
                // lf("Deep G#")
                // lf("Deep A")
                // lf("Deep A#")
                // lf("Deep B")
                // lf("Low C")
                // lf("Low C#")
                // lf("Low D")
                // lf("Low D#")
                // lf("Low E")
                // lf("Low F")
                // lf("Low F#")
                // lf("Low G")
                // lf("Low G#")
                // lf("Low A")
                // lf("Low A#")
                // lf("Low B")
                // lf("Middle C")
                // lf("Middle C#")
                // lf("Middle D")
                // lf("Middle D#")
                // lf("Middle E")
                // lf("Middle F")
                // lf("Middle F#")
                // lf("Middle G")
                // lf("Middle G#")
                // lf("Middle A")
                // lf("Middle A#")
                // lf("Middle B")
                // lf("Tenor C")
                // lf("Tenor C#")
                // lf("Tenor D")
                // lf("Tenor D#")
                // lf("Tenor E")
                // lf("Tenor F")
                // lf("Tenor F#")
                // lf("Tenor G")
                // lf("Tenor G#")
                // lf("Tenor A")
                // lf("Tenor A#")
                // lf("Tenor B")
                // lf("High C")
                // lf("High C#")
                // lf("High D")
                // lf("High D#")
                // lf("High E")
                // lf("High F")
                // lf("High F#")
                // lf("High G")
                // lf("High G#")
                // lf("High A")
                // lf("High A#")
                // lf("High B")
            }
        }
        /**
         * Return the current note frequency.
         * @return {string} Current note in string format.
         */
        getValue(): string {
            return this.note_;
        }

        /**
         * Set the note.
         * @param {string} note The new note in string format.
         */
        setValue(note: string) {
            // accommodate note strings like "Note.GSharp5" as well as numbers
            let match: Array<string> = regex.exec(note);
            let noteName: any = (match && match.length > 1) ? match[1] : null;
            note = Note[noteName] ? Note[noteName] : String(parseFloat(note || "0"));
            if (isNaN(Number(note)) || Number(note) < 0)
                return;
            if (this.sourceBlock_ && Blockly.Events.isEnabled() &&
                this.note_ != note) {
                Blockly.Events.fire(new Blockly.Events.Change(
                    this.sourceBlock_, "field", this.name, String(this.note_), String(note)));
            }
            this.note_ = this.callValidator(note);
            this.setText(this.getNoteName_());
        }

        /**
         * Get the text from this field.  Used when the block is collapsed.
         * @return {string} Current text.
         */
        getText(): string {
            if (Math.floor(Number(this.note_)) == Number(this.note_))
                return Number(this.note_).toFixed(0);
            return Number(this.note_).toFixed(2);
        }

        /**
         * Set the text in this field and NOT fire a change event.
         * @param {*} newText New text.
         */
        setText(newText: string) {
            if (newText === null) {
                // No change if null.
                return;
            }
            newText = String(newText);
            if (!isNaN(Number(newText)))
                newText = this.getNoteName_();

            if (newText === this.text_) {
                // No change.
                return;
            }
            Blockly.Field.prototype.setText.call(this, newText);
        }

        /**
        * get the note name to be displayed in the field
        * @return {string} note name
        * @private
        */
        private getNoteName_(): string {
            let note: string = this.getValue();
            let text: string = note.toString();
            for (let i: number = 0; i < this.nKeys_; i++) {
                if (Math.abs(this.noteFreq_[i] - Number(note)) < this.eps)
                    return this.noteName_[i];
            }
            if (!isNaN(Number(note)))
                text += " Hz";
            return text;
        }

        /**
         * Set a custom number of keys for this field.
         * @param {number} nkeys Number of keys for this block,
         *     or 26 to use default.
         * @return {!Blockly.FieldNote} Returns itself (for method chaining).
         */
        setNumberOfKeys(size: number): FieldNote {
            this.nKeys_ = size;
            return this;
        }

        onHtmlInputChange_(e: any) {
            super.onHtmlInputChange_(e);
            Blockly.DropDownDiv.hideWithoutAnimation();
        }

        /**
         * Create a piano under the note field.
         */
        showEditor_(e: Event): void {
            this.updateColor();

            // If there is an existing drop-down someone else owns, hide it immediately and clear it.
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.DropDownDiv.clearContent();

            let contentDiv = Blockly.DropDownDiv.getContentDiv();

            //  change Note name to number frequency
            Blockly.FieldNumber.prototype.setText.call(this, this.getText());

            const quietInput = (goog.userAgent.MOBILE || goog.userAgent.ANDROID ||
                goog.userAgent.IPAD);
            const readOnly = quietInput;
            (FieldNote as any).superClass_.showEditor_.call(this, e, false, readOnly);

            let pianoWidth: number;
            let pianoHeight: number;
            let keyWidth: number = 22;
            let keyHeight: number = 90;
            let labelHeight: number = 24;
            let prevNextHeight: number = 20;
            let whiteKeyCounter: number = 0;
            let selectedKeyColor: string = "yellowgreen";
            let soundingKeys: number = 0;
            let thisField = this;
            //  Record windowSize and scrollOffset before adding the piano.
            let windowSize = goog.dom.getViewportSize();
            let pagination: boolean = false;
            let mobile: boolean = false;
            let editorWidth = windowSize.width;
            let piano: Array<goog.ui.CustomButton> = [];
            //  initializate
            pianoWidth = keyWidth * (this.nKeys_ - (this.nKeys_ / 12 * 5));
            pianoHeight = keyHeight + labelHeight;

            //  Create the piano using Closure (CustomButton).
            for (let i = 0; i < this.nKeys_; i++) {
                piano.push(new goog.ui.CustomButton());
            }

            if (editorWidth < pianoWidth) {
                pagination = true;
                pianoWidth = 7 * keyWidth;
                pianoHeight = keyHeight + labelHeight + prevNextHeight;
            }
            //  Check if Mobile, pagination -> true
            if (!quietInput && (goog.userAgent.MOBILE || goog.userAgent.ANDROID)) {
                pagination = true;
                mobile = true;
                keyWidth = keyWidth * 2;
                keyHeight = keyHeight * 2;
                pianoWidth = 7 * keyWidth;
                labelHeight = labelHeight * 1.2;
                prevNextHeight = prevNextHeight * 2;
                pianoHeight = keyHeight + labelHeight + prevNextHeight;
            }

            //  create piano div
            let pianoDiv = goog.dom.createDom("div", {}) as HTMLElement;
            pianoDiv.className = "blocklyPianoDiv";
            contentDiv.appendChild(pianoDiv);
            let scrollOffset = goog.style.getViewportPageOffset(document);
            let xy = this.getAbsoluteXY_();
            let borderBBox = this.getScaledBBox_();

            let leftPosition = 0; //-(<HTMLElement>document.getElementsByClassName("blocklyDropdownDiv")[0]).offsetLeft;   //+ ((windowSize.width - this.pianoWidth_) / 2);
            let topPosition = 0; //(keyHeight + labelHeight + prevNextHeight);

            //  save all changes in the same group of events
            Blockly.Events.setGroup(true);

            //  render piano keys
            let octaveCounter = 0;
            let currentSelectedKey: goog.ui.CustomButton = null;
            let previousColor: string;
            for (let i = 0; i < this.nKeys_; i++) {
                if (i > 0 && i % 12 == 0)
                    octaveCounter++;
                let key = piano[i];
                //  What color is i key
                let bgColor = (isWhite(i)) ? "white" : "black";
                let width = getKeyWidth(i);
                let height = getKeyHeight(i);
                let position = getPosition(i);

                //  modify original position in pagination
                if (pagination && i >= 12)
                    position -= 7 * octaveCounter * keyWidth;
                let style = getKeyStyle(bgColor, width, height, position + leftPosition, topPosition, isWhite(i) ? 1000 : 1001, isWhite(i) ? this.colour_ : "black", mobile);
                key.setContent(style);
                key.setId(this.noteName_[i]);
                key.render(pianoDiv);
                let script = key.getContent() as HTMLElement;
                script.setAttribute("tag", this.noteFreq_[i].toString());

                //  highlight current selected key
                if (Math.abs(this.noteFreq_[i] - Number(this.getValue())) < this.eps) {
                    previousColor = script.style.backgroundColor;
                    script.style.backgroundColor = selectedKeyColor;
                    currentSelectedKey = key;
                }

                //  Listener when a new key is selected
                if (!mobile) {
                    goog.events.listen(key.getElement(),
                        goog.events.EventType.MOUSEDOWN, soundKey
                        , false, key
                    );
                } else {
                    /**  Listener when a new key is selected in MOBILE
                     *   It is necessary to use TOUCHSTART event to allow passive event listeners
                     *   to avoid preventDefault() call that blocks listener
                     */
                    goog.events.listen(key.getElement(),
                        goog.events.EventType.TOUCHSTART, soundKey
                        , false, key
                    );
                }
                //  Listener when the mouse is over a key
                goog.events.listen(key.getElement(),
                    goog.events.EventType.MOUSEOVER,
                    function () {
                        let script = showNoteLabel.getContent() as HTMLElement;
                        script.textContent = this.getId();
                    }, false, key
                );

                //  increment white key counter
                if (isWhite(i))
                    whiteKeyCounter++;
                // set octaves different from first octave invisible
                if (pagination && i > 11)
                    key.setVisible(false);
            }
            //  render note label
            let showNoteLabel = new goog.ui.CustomButton();
            let showNoteStyle = getShowNoteStyle(topPosition, leftPosition, mobile);
            showNoteLabel.setContent(showNoteStyle);
            showNoteLabel.render(pianoDiv);
            let scriptLabel = showNoteLabel.getContent() as HTMLElement;
            scriptLabel.textContent = "-";

            // create next and previous CustomButtons for pagination
            let prevButton = new goog.ui.CustomButton();
            let nextButton = new goog.ui.CustomButton();
            let prevButtonStyle = getNextPrevStyle(topPosition, leftPosition, true, mobile);
            let nextButtonStyle = getNextPrevStyle(topPosition, leftPosition, false, mobile);
            if (pagination) {
                scriptLabel.textContent = "Octave #1";
                //  render previous button
                let script: HTMLElement;
                prevButton.setContent(prevButtonStyle);
                prevButton.render(pianoDiv);
                script = prevButton.getContent() as HTMLElement;
                //  left arrow - previous button
                script.textContent = "<";
                //  render next button
                nextButton.setContent(nextButtonStyle);
                nextButton.render(pianoDiv);
                script = nextButton.getContent() as HTMLElement;
                //  right arrow - next button
                script.textContent = ">";

                let Npages = this.nKeys_ / 12;
                let currentPage = 0;
                goog.events.listen(prevButton.getElement(),
                    goog.events.EventType.MOUSEDOWN,
                    function () {
                        if (currentPage == 0) {
                            scriptLabel.textContent = "Octave #" + (currentPage + 1);
                            return;
                        }
                        let curFirstKey = currentPage * 12;
                        let newFirstKey = currentPage * 12 - 12;
                        //  hide current octave
                        for (let i = 0; i < 12; i++)
                            piano[i + curFirstKey].setVisible(false);
                        //  show new octave
                        for (let i = 0; i < 12; i++)
                            piano[i + newFirstKey].setVisible(true);
                        currentPage--;
                        scriptLabel.textContent = "Octave #" + (currentPage + 1);
                    }, false, prevButton
                );
                goog.events.listen(nextButton.getElement(),
                    goog.events.EventType.MOUSEDOWN,
                    function () {
                        if (currentPage == Npages - 1) {
                            scriptLabel.textContent = "Octave #" + (currentPage + 1);
                            return;
                        }
                        let curFirstKey = currentPage * 12;
                        let newFirstKey = currentPage * 12 + 12;
                        //  hide current octave
                        for (let i = 0; i < 12; i++)
                            piano[i + curFirstKey].setVisible(false);
                        //  show new octave
                        for (let i = 0; i < 12; i++)
                            piano[i + newFirstKey].setVisible(true);
                        currentPage++;
                        scriptLabel.textContent = "Octave #" + (currentPage + 1);
                    }, false, nextButton
                );
            }
            // create the key sound
            function soundKey() {
                let cnt = ++soundingKeys;
                let freq = this.getContent().getAttribute("tag");
                let script: HTMLElement;
                if (currentSelectedKey != null) {
                    script = currentSelectedKey.getContent() as HTMLElement;
                    script.style.backgroundColor = previousColor;
                }
                script = this.getContent() as HTMLElement;
                if (currentSelectedKey !== this) { // save color and change values only if is clicking different key
                    previousColor = script.style.backgroundColor;
                    thisField.setValue(thisField.callValidator(freq));
                    thisField.setText(thisField.callValidator(freq));
                }
                currentSelectedKey = this;
                script.style.backgroundColor = selectedKeyColor;
                Blockly.FieldTextInput.htmlInput_.value = thisField.getText();
                AudioContextManager.tone(freq);
                setTimeout(function () {
                    // compare current sound counter with listener sound counter (avoid async problems)
                    if (soundingKeys == cnt)
                        AudioContextManager.stop();
                }, 300);
                (FieldNote as any).superClass_.dispose.call(this);
            }
            /** get width of blockly editor space
             * @return {number} width of the blockly editor workspace
             * @private
             */
            function getEditorWidth(): number {
                let windowSize = goog.dom.getViewportSize();
                return windowSize.width;
            }
            /** get height of blockly editor space
             * @return {number} Height of the blockly editor workspace
             * @private
             */
            function getEditorHeight(): number {
                let editorHeight = document.getElementById("blocklyDiv").offsetHeight;
                return editorHeight;
            }
            /**
             * create a DOM to assing a style to the button (piano Key)
             * @param {string} bgColor color of the key background
             * @param {number} width width of the key
             * @param {number} heigth heigth of the key
             * @param {number} leftPosition horizontal position of the key
             * @param {number} topPosition vertical position of the key
             * @param {number} z_index z-index of the key
             * @param {string} keyBorderColour border color of the key
             * @param {boolean} isMobile true if the device is a mobile
             * @return {goog.dom} DOM with the new css style.
             * @private
             */
            function getKeyStyle(bgColor: string, width: number, height: number, leftPosition: number, topPosition: number, z_index: number, keyBorderColour: string, isMobile: boolean) {
                let div = goog.dom.createDom("div",
                    {
                        "style": "background-color: " + bgColor
                        + "; width: " + width
                        + "px; height: " + height
                        + "px; left: " + leftPosition
                        + "px; top: " + topPosition
                        + "px; z-index: " + z_index
                        + ";   border-color: " + keyBorderColour
                        + ";"
                    });
                div.className = "blocklyNote";
                return div;
            }
            /**
             * create a DOM to assing a style to the note label
             * @param {number} topPosition vertical position of the label
             * @param {number} leftPosition horizontal position of the label
             * @param {boolean} isMobile true if the device is a mobile
             * @return {goog.dom} DOM with the new css style.
             * @private
             */
            function getShowNoteStyle(topPosition: number, leftPosition: number, isMobile: boolean) {
                topPosition += keyHeight;
                if (isMobile)
                    topPosition += prevNextHeight;
                let div = goog.dom.createDom("div",
                    {
                        "style": "top: " + topPosition
                        + "px; left: " + leftPosition
                        + "px; background-color: " + thisField.colour_
                        + "; width: " + pianoWidth
                        + "px; border-color: " + thisField.colour_
                        + ";" + (isMobile ? " font-size: " + (labelHeight - 10) + "px; height: " + labelHeight + "px;" : "")
                    });
                div.className = "blocklyNoteLabel";
                return div;
            }
            /**
             * create a DOM to assing a style to the previous and next buttons
             * @param {number} topPosition vertical position of the label
             * @param {number} leftPosition horizontal position of the label
             * @param {boolean} isPrev true if is previous button, false otherwise
             * @param {boolean} isMobile true if the device is a mobile
             * @return {goog.dom} DOM with the new css style.
             * @private
             */
            function getNextPrevStyle(topPosition: number, leftPosition: number, isPrev: boolean, isMobile: boolean) {
                //  x position of the prev/next button
                let xPosition = (isPrev ? 0 : (pianoWidth / 2)) + leftPosition;
                //  y position of the prev/next button
                let yPosition = (keyHeight + labelHeight + topPosition);
                if (isMobile)
                    yPosition = keyHeight + topPosition;
                let div = goog.dom.createDom("div",
                    {
                        "style": "top: " + yPosition
                        + "px; left: " + xPosition
                        + "px; "
                        + ";" + (isMobile ? "height: " + prevNextHeight + "px; font-size:" + (prevNextHeight - 10) + "px;" : "")
                        + "width: " + Math.ceil(pianoWidth / 2) + "px;"
                        + "background-color: " + thisField.colour_
                        + ";" + (isPrev ? "border-left-color: " : "border-right-color: ") + thisField.colour_
                        + ";" + (!isMobile ? "border-bottom-color: " + thisField.colour_ : "")
                        + ";"
                    });
                div.className = "blocklyNotePrevNext";
                return div;
            }

            /**
             * @param {number} idx index of the key
             * @return {boolean} true if key_idx is white
             * @private
             */
            function isWhite(idx: number): boolean {
                let octavePosition: number = idx % 12;
                if (octavePosition == 1 || octavePosition == 3 || octavePosition == 6 ||
                    octavePosition == 8 || octavePosition == 10)
                    return false;
                return true;
            }

            /**
             * get width of the piano key
             * @param {number} idx index of the key
             * @return {number} width of the key
             * @private
             */
            function getKeyWidth(idx: number): number {
                if (isWhite(idx))
                    return keyWidth;
                return keyWidth / 2;
            }

            /**
             * get height of the piano key
             * @param {number} idx index of the key
             * @return {number} height of the key
             * @private
             */
            function getKeyHeight(idx: number): number {
                if (isWhite(idx))
                    return keyHeight;
                return keyHeight / 2;
            }

            /**
             * get the position of the key in the piano
             * @param {number} idx index of the key
             * @return {number} position of the key
             */
            function getPosition(idx: number): number {
                let pos: number = (whiteKeyCounter * keyWidth);
                if (isWhite(idx))
                    return pos;
                return pos - (keyWidth / 4);
            }

            pianoDiv.style.width = pianoWidth + "px";
            pianoDiv.style.height = (pianoHeight + 1) + "px";

            (Blockly.DropDownDiv as any).setColour(this.colour_, this.colourBorder_);

            // Calculate positioning based on the field position.
            let scale = (this.sourceBlock_.workspace as any).scale;
            let bBox = {width: this.size_.width, height: this.size_.height};
            bBox.width *= scale;
            bBox.height *= scale;
            let position = this.fieldGroup_.getBoundingClientRect();
            let primaryX = position.left + bBox.width / 2;
            let primaryY = position.top + bBox.height;
            let secondaryX = primaryX;
            let secondaryY = position.top;
            // Set bounds to workspace; show the drop-down.
            (Blockly.DropDownDiv as any).setBoundsElement((this.sourceBlock_.workspace as Blockly.WorkspaceSvg).getParentSvg().parentNode);
            (Blockly.DropDownDiv as any).show(this, primaryX, primaryY, secondaryX, secondaryY,
                this.onHide.bind(this));
        }

        /**
         * Callback for when the drop-down is hidden.
         */
        private onHide() {
        };

        /**
         * Close the note picker if this input is being deleted.
         */
        dispose() {
            (Blockly.DropDownDiv as any).hideIfOwner(this);
            (Blockly.FieldTextInput as any).superClass_.dispose.call(this);
        }

        private updateColor() {
            if (this.sourceBlock_.parentBlock_ && (this.sourceBlock_.isShadow() || hasOnlyOneField(this.sourceBlock_))) {
                this.colour_ = this.sourceBlock_.parentBlock_.getColour();
                this.colourBorder_ = this.sourceBlock_.parentBlock_.getColourTertiary();
            }
            else {
                this.colour_ = this.sourceBlock_.getColourTertiary();
                this.colourBorder_ = this.sourceBlock_.getColourTertiary();
            }
        }
    }

    function hasOnlyOneField(block: Blockly.Block) {
        return block.inputList.length === 1 && block.inputList[0].fieldRow.length === 1;
    }
}
