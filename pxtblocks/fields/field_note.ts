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
        28: {name: lf("C"), prefixedName: lf("Low C"), freq: 131},
        29: {name: lf("C#"), prefixedName: lf("Low C#"), freq: 139},
        30: {name: lf("D"), prefixedName: lf("Low D"), freq: 147},
        31: {name: lf("D#"), prefixedName: lf("Low D#"), freq: 156},
        32: {name: lf("E"), prefixedName: lf("Low E"), freq: 165},
        33: {name: lf("F"), prefixedName: lf("Low F"), freq: 175},
        34: {name: lf("F#"), prefixedName: lf("Low F#"), freq: 185},
        35: {name: lf("G"), prefixedName: lf("Low G"), freq: 196},
        36: {name: lf("G#"), prefixedName: lf("Low G#"), freq: 208},
        37: {name: lf("A"), prefixedName: lf("Low A"), freq: 220},
        38: {name: lf("A#"), prefixedName: lf("Low A#"), freq: 233},
        39: {name: lf("B"), prefixedName: lf("Low B"), freq: 247},

        40: {name: lf("C"), prefixedName: lf("Middle C"), freq: 262},
        41: {name: lf("C#"), prefixedName: lf("Middle C#"), freq: 277},
        42: {name: lf("D"), prefixedName: lf("Middle D"), freq: 294},
        43: {name: lf("D#"), prefixedName: lf("Middle D#"), freq: 311},
        44: {name: lf("E"), prefixedName: lf("Middle E"), freq: 330},
        45: {name: lf("F"), prefixedName: lf("Middle F"), freq: 349},
        46: {name: lf("F#"), prefixedName: lf("Middle F#"), freq: 370},
        47: {name: lf("G"), prefixedName: lf("Middle G"), freq: 392},
        48: {name: lf("G#"), prefixedName: lf("Middle G#"), freq: 415},
        49: {name: lf("A"), prefixedName: lf("Middle A"), freq: 440},
        50: {name: lf("A#"), prefixedName: lf("Middle A#"), freq: 466},
        51: {name: lf("B"), prefixedName: lf("Middle B"), freq: 494},

        52: {name: lf("C"), prefixedName: lf("Tenor C"), altPrefixedName: lf("High C"), freq: 523},
        53: {name: lf("C#"), prefixedName: lf("Tenor C#"), altPrefixedName: lf("High C#"), freq: 554},
        54: {name: lf("D"), prefixedName: lf("Tenor D"), altPrefixedName: lf("High D"), freq: 587},
        55: {name: lf("D#"), prefixedName: lf("Tenor D#"), altPrefixedName: lf("High D#"), freq: 622},
        56: {name: lf("E"), prefixedName: lf("Tenor E"), altPrefixedName: lf("High E"), freq: 659},
        57: {name: lf("F"), prefixedName: lf("Tenor F"), altPrefixedName: lf("High F"), freq: 698},
        58: {name: lf("F#"), prefixedName: lf("Tenor F#"), altPrefixedName: lf("High F#"), freq: 740},
        59: {name: lf("G"), prefixedName: lf("Tenor G"), altPrefixedName: lf("High G"), freq: 784},
        60: {name: lf("G#"), prefixedName: lf("Tenor G#"), altPrefixedName: lf("High G#"), freq: 831},
        61: {name: lf("A"), prefixedName: lf("Tenor A"), altPrefixedName: lf("High A"), freq: 880},
        62: {name: lf("A#"), prefixedName: lf("Tenor A#"), altPrefixedName: lf("High A#"), freq: 932},
        63: {name: lf("B"), prefixedName: lf("Tenor B"), altPrefixedName: lf("High B"), freq: 988},

        64: {name: lf("C"), prefixedName: lf("High C"), freq: 1046},
        65: {name: lf("C#"), prefixedName: lf("High C#"), freq: 1109},
        66: {name: lf("D"), prefixedName: lf("High D"), freq: 1175},
        67: {name: lf("D#"), prefixedName: lf("High D#"), freq: 1245},
        68: {name: lf("E"), prefixedName: lf("High E"), freq: 1319},
        69: {name: lf("F"), prefixedName: lf("High F"), freq: 1397},
        70: {name: lf("F#"), prefixedName: lf("High F#"), freq: 1478},
        71: {name: lf("G"), prefixedName: lf("High G"), freq: 1568},
        72: {name: lf("G#"), prefixedName: lf("High G#"), freq: 1661},
        73: {name: lf("A"), prefixedName: lf("High A"), freq: 1760},
        74: {name: lf("A#"), prefixedName: lf("High A#"), freq: 1865},
        75: {name: lf("B"), prefixedName: lf("High B"), freq: 1976}
    }

    export interface FieldNoteOptions extends Blockly.FieldCustomOptions {
        editorColour?: string;
        minNote?: string;
        maxNote?: string;
    }

    export class FieldNote extends Blockly.FieldNumber implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public SERIALIZABLE = true;
        // value of the field
        private note_: string;

        // colour of the dropdown
        private colour_: string;
        // colour of the dropdown border
        private colourBorder_: string;
        protected isExpanded: Boolean;

        /**
         * default number of piano keys
         */
        private nKeys_: number = 36;
        private minNote_: number = 28;
        private maxNote_: number = 63;

        protected static readonly keyWidth = 22;
        protected static readonly keyHeight = 90;
        protected static readonly labelHeight = 24;
        protected static readonly prevNextHeight = 20;
        protected static readonly notesPerOctave = 12;
        protected static readonly selectedKeyColor = "yellowgreen";

        protected currentPage: number;
        protected piano: HTMLDivElement[];
        /**
         * Absolute error for note frequency identification (Hz)
         */
        eps: number = 2;

        /**
         * array of notes frequency
         */
        private noteFreq_: Array<number> = [];

        /**
         * array of notes names
         */
        private noteName_: Array<string> = [];

        protected keyPressCount: number;
        protected currentSelectedKey: HTMLDivElement;

        constructor(text: string, params: FieldNoteOptions, validator?: Function) {
            super(text);

            (FieldNote as any).superClass_.constructor.call(this, text, validator);
            this.note_ = text;
            this.isExpanded = false;
            this.currentPage = 0;
            this.keyPressCount = 0;

            if (params.editorColour) {
                this.colour_ = pxtblockly.parseColour(params.editorColour);
                this.colourBorder_ = Blockly.utils.colour.darken(this.colour_, 0.2);
            }

            const minNote = parseInt(params.minNote) || this.minNote_;
            const maxNote = parseInt(params.maxNote) || this.maxNote_;
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
        doClassValidation_(text: string) {
            if (text === null) {
                return null;
            }
            text = String(text);

            let n = parseFloat(text || "0");
            if (isNaN(n) || n < 0) {
                // Invalid number.
                return null;
            }
            const showDecimal = Math.floor(n) != n;
            // Get the value in range.
            return "" + n.toFixed(showDecimal ? 2 : 0);
        }

        /**
         * Install this field on a block.
         */
        init() {
            (FieldNote as any).superClass_.init.call(this);
            this.noteFreq_.length = 0;
            this.noteName_.length = 0;

            // Create arrays of name/frequency of the notes
            for (let i = this.minNote_; i <= this.maxNote_; i++) {
                let name = Notes[i].prefixedName;
                // special case: one octave
                if (this.nKeys_ < 13) {
                    name = Notes[i].name;
                }
                // special case: centered
                else if (this.minNote_ >= 28 && this.maxNote_ <= 63) {
                    name = Notes[i].altPrefixedName || name;
                }
                this.noteName_.push(name);
                this.noteFreq_.push(Notes[i].freq);
            }

            // explicitly update the value with the newly defined notes;
            // a call to setValue here gets dropped
            this.doValueUpdate_(this.getValue());
        }

        /**
         * Return the current note frequency.
         * @return {string} Current note in string format.
         */
        getValue(): string {
            return this.note_;
        }

        /**
         * Called by setValue if the text input is valid. Updates the value of the
         * field, and updates the text of the field if it is not currently being
         * edited (i.e. handled by the htmlInput_).
         * @param {string} note The new note in string format.
         */
        doValueUpdate_(note: string) {
            // accommodate note strings like "Note.GSharp5" as well as numbers
            const match: Array<string> = /^Note\.(.+)$/.exec(note);
            const noteName: any = (match && match.length > 1) ? match[1] : null;
            note = Note[noteName] ? Note[noteName] : String(parseFloat(note || "0"));
            if (isNaN(Number(note)) || Number(note) < 0)
                return;
            if (this.sourceBlock_ && Blockly.Events.isEnabled() &&
                this.note_ != note) {
                Blockly.Events.fire(new Blockly.Events.Change(
                    this.sourceBlock_, "field", this.name, String(this.note_), String(note)));
            }
            this.note_ = note;
            this.value_ = this.note_;
            this.refreshText();
        }

        /**
         * Get the text from this field
         * @return {string} Current text.
         */
        getText(): string {
            if (this.isExpanded) {
                return "" + this.note_;
            } else {
                const note = +this.note_;
                for (let i = 0; i < this.nKeys_; i++) {
                    if (Math.abs(this.noteFreq_[i] - note) < this.eps) {
                        return this.noteName_[i];
                    }
                }
                let text = note.toString();
                if (!isNaN(note))
                    text += " Hz";
                return text;
            }
        }

        onHtmlInputChange_(e: any) {
            super.onHtmlInputChange_(e);
            Blockly.DropDownDiv.hideWithoutAnimation();
        }

        /**
         * Create a piano under the note field.
         */
        showEditor_(e: Event): void {
            this.isExpanded = true;
            this.updateColor();

            // If there is an existing drop-down someone else owns, hide it immediately and clear it.
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.DropDownDiv.clearContent();

            const contentDiv = Blockly.DropDownDiv.getContentDiv();

            const mobile = pxt.BrowserUtils.isMobile() || pxt.BrowserUtils.isIOS();
            // invoke FieldTextInputs showeditor, so we can set quiet / readonly
            (FieldNote as any).superClass_.showEditor_.call(this, e, /** quiet **/ mobile, /** readonly **/ mobile);

            this.refreshText();

            // Record windowSize and scrollOffset before adding the piano.
            const editorWidth = goog.dom.getViewportSize().editorWidth;

            this.piano = [];
            this.currentSelectedKey = undefined;

            let pianoWidth = FieldNote.keyWidth * (this.nKeys_ - (this.nKeys_ / 12 * 5));
            let pianoHeight = FieldNote.keyHeight + FieldNote.labelHeight;

            const pagination = mobile || editorWidth < pianoWidth;

            if (pagination) {
                pianoWidth = 7 * FieldNote.keyWidth;
                pianoHeight = FieldNote.keyHeight + FieldNote.labelHeight + FieldNote.prevNextHeight;
            }

            const pianoDiv = createStyledDiv(
                "blocklyPianoDiv",
                `width: ${pianoWidth}px;
                height: ${pianoHeight}px;`
            );
            contentDiv.appendChild(pianoDiv);

            // save all changes in the same group of events
            Blockly.Events.setGroup(true);

            // render piano keys
            let octaveCounter = 0;
            let whiteKeyCounter = 0;
            for (let i = 0; i < this.nKeys_; i++) {
                if (i > 0 && i % 12 == 0)
                    octaveCounter++;
                let position = this.getPosition(i, whiteKeyCounter);

                // modify original position in pagination
                if (pagination && i >= 12)
                    position -= 7 * octaveCounter * FieldNote.keyWidth;
                const isWhiteKey = this.isWhite(i);
                const key = createStyledDiv(
                    `blocklyNote ${isWhiteKey ? "" : "black"}`,
                    `width: ${this.getKeyWidth(i)}px;
                    height: ${this.getKeyHeight(i)}px;
                    left: ${position}px;
                    border-color: ${this.colour_};`
                );

                key.setAttribute("frequency", this.noteFreq_[i].toString());
                this.piano.push(key);
                pianoDiv.appendChild(key);

                // highlight current selected key
                if (Math.abs(this.noteFreq_[i] - Number(this.getValue())) < this.eps) {
                    pxt.BrowserUtils.addClass(key, "selected");
                    this.currentSelectedKey = key;
                }

                // Listener when a new key is selected
                if (!mobile) {
                    Blockly.bindEventWithChecks_(
                        key,
                        'mousedown',
                        this,
                        () => this.playKey(key),
                        /** noCaptureIdentifier **/ true,
                        /** noPreventDefault **/ true
                    );
                } else {
                    /**  Listener when a new key is selected in MOBILE
                     *   It is necessary to use TOUCHSTART event to allow passive event listeners
                     *   to avoid preventDefault() call that blocks listener
                     */
                    Blockly.bindEventWithChecks_(
                        key,
                        'touchstart',
                        this,
                        () => this.playKey(key),
                        /** noCaptureIdentifier **/ true,
                        /** noPreventDefault **/ true
                    );
                }

                Blockly.bindEventWithChecks_(
                    key,
                    'mouseover',
                    this,
                    () => noteLabel.textContent = this.noteName_[i],
                    /** noCaptureIdentifier **/ true,
                    /** noPreventDefault **/ true
                );

                // increment white key counter
                if (isWhiteKey)
                    whiteKeyCounter++;
                // set octaves different from first octave invisible
                if (pagination && i > 11)
                    key.style.display = "none";
            }

            // render note label
            const noteLabel = createStyledDiv(
                "blocklyNoteLabel",
                `top: ${FieldNote.keyHeight}px;
                width: ${pianoWidth}px;
                background-color: ${this.colour_};
                border-color: ${this.colour_};`
            );
            pianoDiv.appendChild(noteLabel);
            noteLabel.textContent = "-";

            if (pagination) {
                // TODO jwunderl: show the octave that contains the selected key, not always 0
                this.currentPage = 0;
                const prevButton = this.getNextPrevDiv(pianoWidth, true, pianoDiv);
                const nextButton = this.getNextPrevDiv(pianoWidth, false, pianoDiv);

                noteLabel.textContent = "Octave #1";
                Blockly.bindEventWithChecks_(
                    prevButton,
                    'mousedown',
                    this,
                    () => this.changePage(/** next **/ false, noteLabel, this.piano),
                    /** noCaptureIdentifier **/ true,
                    /** noPreventDefault **/ true
                );
                Blockly.bindEventWithChecks_(
                    nextButton,
                    'mousedown',
                    this,
                    () => this.changePage(/** next **/ true, noteLabel, this.piano),
                    /** noCaptureIdentifier **/ true,
                    /** noPreventDefault **/ true
                );
            }

            Blockly.DropDownDiv.setColour(this.colour_, this.colourBorder_);
            Blockly.DropDownDiv.showPositionedByBlock(this, this.sourceBlock_, () => this.onHide());
        }

        protected playKey(key: HTMLDivElement) {
            const cnt = ++this.keyPressCount;
            const freq = key.getAttribute("frequency");

            if (this.currentSelectedKey !== key) {
                if (this.currentSelectedKey)
                    pxt.BrowserUtils.removeClass(this.currentSelectedKey, "selected");
                pxt.BrowserUtils.addClass(key, "selected");
                this.setValue(freq);
            }

            this.currentSelectedKey = key;
            // TODO jwunderl: see if better way to handle this; override text box while editting, to show the current state properly
            // after each button press; feels like setText / getText should work w/o this?
            (this as any).htmlInput_.value = this.getText();

            pxt.AudioContextManager.tone(+freq);
            setTimeout(() => {
                // Clear the sound if it is still playing after 300ms
                if (this.keyPressCount == cnt) pxt.AudioContextManager.stop();
            }, 300);
        }

        /**
         * Callback for when the drop-down is hidden.
         */
        protected onHide() {
            this.isExpanded = false;
            this.refreshText()
        };

        /**
         * Close the note picker if this input is being deleted.
         */
        dispose() {
            Blockly.DropDownDiv.hideIfOwner(this);
            super.dispose()
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

        onFinishEditing_(text: string) {
            this.refreshText();
        }

        /**
         * This block shows up differently when it's being edited;
         * on any transition between `editing <--> not-editing`
         * or other change in state,
         * refresh the text to get back into a valid state.
         **/
        protected refreshText() {
            this.setText(this.getText());
            this.forceRerender();
        }

        protected changePage(next: boolean, scriptLabel: HTMLElement, piano: HTMLDivElement[]) {
            const pageCount = this.nKeys_ / FieldNote.notesPerOctave;
            if (this.currentPage == (next ? pageCount - 1 : 0)) {
                scriptLabel.textContent = "Octave #" + (this.currentPage + 1);
                return;
            }
            const nextPage = this.currentPage + (next ? 1 : -1);
            const curFirstKey = this.currentPage * FieldNote.notesPerOctave;
            const newFirstKey = nextPage * FieldNote.notesPerOctave;
            // hide current octave
            for (let i = 0; i < FieldNote.notesPerOctave; i++)
                piano[i + curFirstKey].style.display = "none";
            // show new octave
            for (let i = 0; i < FieldNote.notesPerOctave; i++)
                piano[i + newFirstKey].style.display = "block";
            this.currentPage = nextPage;
            scriptLabel.textContent = "Octave #" + (this.currentPage + 1);
        };

        /**
         * create a DOM to assign a style to the previous and next buttons
         * @param pianoWidth the width of the containing piano
         * @param isPrev true if is previous button, false otherwise
         * @return DOM with the new css style.s
         */
        protected getNextPrevDiv(pianoWidth: number, isPrev: boolean, container: HTMLDivElement) {
            const xPosition = isPrev ? 0 : (pianoWidth / 2);
            const yPosition = FieldNote.keyHeight + FieldNote.labelHeight;

            const output = createStyledDiv(
                "blocklyNotePrevNext",
                `top: ${yPosition}px;
                left: ${xPosition}px;
                width: ${Math.ceil(pianoWidth / 2)}px;
                ${isPrev ? "border-left-color" : "border-right-color"}: ${this.colour_};
                background-color: ${this.colour_};
                border-bottom-color: ${this.colour_};`
            );

            container.appendChild(output);
            output.textContent = isPrev ? "<" : ">";
            return output;
        }

        /**
         * @param idx index of the key
         * @return true if idx is white
         * @private
         */
        protected isWhite(idx: number): boolean {
            switch (idx % 12) {
                case 1: case 3: case 6:
                case 8: case 10:
                    return false;
                default:
                    return true;
            }
        }

        /**
         * get width of the piano key
         * @param idx index of the key
         * @return width of the key
         */
        protected getKeyWidth(idx: number): number {
            if (this.isWhite(idx))
                return FieldNote.keyWidth;
            return FieldNote.keyWidth / 2;
        }

        /**
         * get height of the piano key
         * @param idx index of the key
         * @return height of the key
         */
        protected getKeyHeight(idx: number): number {
            if (this.isWhite(idx))
                return FieldNote.keyHeight;
            return FieldNote.keyHeight / 2;
        }

        /**
         * get the position of the key in the piano
         * @param idx index of the key
         * @param whiteKeyCounter the curent count of white keys
         * @return position of the key
         */
        protected getPosition(idx: number, whiteKeyCounter: number): number {
            const pos = whiteKeyCounter * FieldNote.keyWidth;
            if (this.isWhite(idx))
                return pos;
            return pos - (FieldNote.keyWidth / 4);
        }
    }

    function hasOnlyOneField(block: Blockly.Block) {
        return block.inputList.length === 1 && block.inputList[0].fieldRow.length === 1;
    }

    function createStyledDiv(className: string, style?: string) {
        const output = document.createElement("div");
        pxt.BrowserUtils.addClass(output, className);
        if (style)
            output.setAttribute("style", style.replace(/\s+/g, " "));
        return output;
    }
}
