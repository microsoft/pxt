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

    //  Class for a note input field.
    export class FieldNote extends Blockly.FieldNumber implements Blockly.FieldCustom {
        public isFieldCustom_ = true;
        public SERIALIZABLE = true;
        //  value of the field
        private note_: string;

        //  colour of the dropdown
        private colour_: string;
        //  colour of the dropdown border
        private colourBorder_: string;
        protected isExpanded: Boolean;

        /**
         * default number of piano keys
         * @type {number}
         * @private
         */
        private nKeys_: number = 36;
        private minNote_: number = 28;
        private maxNote_: number = 63;

        protected static readonly keyWidth = 22;
        protected static readonly keyHeight = 90;
        protected static readonly labelHeight = 24;
        protected static readonly prevNextHeight = 20;

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
            this.isExpanded = false;

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
            const thisField = this;
            // Create arrays of name/frequency of the notes
            createNotesArray();

            // explicitly update the value with the newly defined notes;
            // a call to setValue here gets dropped
            this.doValueUpdate_(this.getValue())

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
                    thisField.noteName_.push(name);
                    thisField.noteFreq_.push(Notes[i].freq);
                }
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
            this.isExpanded = true;
            this.updateColor();

            // If there is an existing drop-down someone else owns, hide it immediately and clear it.
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.DropDownDiv.clearContent();

            const contentDiv = Blockly.DropDownDiv.getContentDiv();

            const mobile = goog.userAgent.MOBILE || goog.userAgent.ANDROID || goog.userAgent.IPHONE;
            // invoke FieldTextInputs showeditor, so we can set quiet / readonly
            (FieldNote as any).superClass_.showEditor_.call(
                this,
                e,
                /** quiet **/ mobile || goog.userAgent.IPAD,
                /** readonly **/ mobile || goog.userAgent.IPAD
            );

            this.refreshText();

            let whiteKeyCounter = 0;
            let soundingKeys = 0;
            const selectedKeyColor = "yellowgreen";
            const thisField = this;
            //  Record windowSize and scrollOffset before adding the piano.
            const editorWidth = goog.dom.getViewportSize().editorWidth;
            const piano: Array<goog.ui.CustomButton> = [];

            //  initializate
            let pianoWidth = FieldNote.keyWidth * (this.nKeys_ - (this.nKeys_ / 12 * 5));
            let pianoHeight = FieldNote.keyHeight + FieldNote.labelHeight;

            const pagination = mobile || editorWidth < pianoWidth;

            //  Create the piano using Closure (CustomButton).
            for (let i = 0; i < this.nKeys_; i++) {
                piano.push(new goog.ui.CustomButton());
            }

            if (pagination) {
                pianoWidth = 7 * FieldNote.keyWidth;
                pianoHeight = FieldNote.keyHeight + FieldNote.labelHeight + FieldNote.prevNextHeight;
            }

            // create piano div
            const pianoDiv = document.createElement("div");
            pianoDiv.className = "blocklyPianoDiv";
            contentDiv.appendChild(pianoDiv);

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
                const key = piano[i];
                //  What color is i key
                const bgColor = isWhite(i) ? "white" : "black";
                const width = getKeyWidth(i);
                const height = getKeyHeight(i);
                let position = getPosition(i);

                //  modify original position in pagination
                if (pagination && i >= 12)
                    position -= 7 * octaveCounter * FieldNote.keyWidth;
                const style = this.getKeyStyle(
                    bgColor,
                    width,
                    height,
                    position + leftPosition,
                    topPosition,
                    isWhite(i) ? 1000 : 1001
                );
                key.setContent(style);
                key.setId(this.noteName_[i]);
                key.render(pianoDiv);
                const script = key.getContent() as HTMLElement;
                script.setAttribute("tag", this.noteFreq_[i].toString());

                //  highlight current selected key
                if (Math.abs(this.noteFreq_[i] - Number(this.getValue())) < this.eps) {
                    previousColor = script.style.backgroundColor;
                    script.style.backgroundColor = selectedKeyColor;
                    currentSelectedKey = key;
                }

                //  Listener when a new key is selected
                if (!mobile) {
                    goog.events.listen(
                        key.getElement(),
                        goog.events.EventType.MOUSEDOWN, soundKey
                        , false, key
                    );
                } else {
                    /**  Listener when a new key is selected in MOBILE
                     *   It is necessary to use TOUCHSTART event to allow passive event listeners
                     *   to avoid preventDefault() call that blocks listener
                     */
                    goog.events.listen(
                        key.getElement(),
                        goog.events.EventType.TOUCHSTART, soundKey
                        , false, key
                    );
                }
                //  Listener when the mouse is over a key
                goog.events.listen(
                    key.getElement(),
                    goog.events.EventType.MOUSEOVER,
                    function () {
                        const script = showNoteLabel.getContent() as HTMLElement;
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
            const showNoteLabel = new goog.ui.CustomButton();
            const showNoteStyle = this.getShowNoteStyle(
                topPosition,
                leftPosition,
                pianoWidth,
                mobile
            );
            showNoteLabel.setContent(showNoteStyle);
            showNoteLabel.render(pianoDiv);
            const scriptLabel = showNoteLabel.getContent() as HTMLElement;
            scriptLabel.textContent = "-";

            // create next and previous CustomButtons for pagination
            const prevButton = new goog.ui.CustomButton();
            const nextButton = new goog.ui.CustomButton();
            const prevButtonStyle = this.getNextPrevStyle(
                topPosition,
                leftPosition,
                pianoWidth,
                true,
                mobile
            );
            const nextButtonStyle = this.getNextPrevStyle(
                topPosition,
                leftPosition,
                pianoWidth,
                false,
                mobile
            );
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

                const pageCount = this.nKeys_ / 12;
                const changePage = (next: boolean) => {
                    if (currentPage == (next ? pageCount - 1 : 0)) {
                        scriptLabel.textContent = "Octave #" + (currentPage + 1);
                        return;
                    }
                    const curFirstKey = currentPage * 12;
                    const newFirstKey = currentPage * 12 + (next ? 12 : -12);
                    //  hide current octave
                    for (let i = 0; i < 12; i++)
                        piano[i + curFirstKey].setVisible(false);
                    //  show new octave
                    for (let i = 0; i < 12; i++)
                        piano[i + newFirstKey].setVisible(true);
                    currentPage = currentPage + (next ? 1 : -1);
                    scriptLabel.textContent = "Octave #" + (currentPage + 1);
                };
                let currentPage = 0;
                goog.events.listen(
                    prevButton.getElement(),
                    goog.events.EventType.MOUSEDOWN,
                    function () {
                        changePage(/** next **/ false);
                    }, false, prevButton
                );
                goog.events.listen(
                    nextButton.getElement(),
                    goog.events.EventType.MOUSEDOWN,
                    function () {
                        changePage(/** next **/ true);
                    }, false, nextButton
                );
            }
            // create the key sound
            function soundKey() {
                const cnt = ++soundingKeys;
                const freq = this.getContent().getAttribute("tag");
                if (currentSelectedKey != null) {
                    const currKeyEl = currentSelectedKey.getContent() as HTMLElement;
                    currKeyEl.style.backgroundColor = previousColor;
                }
                const thisKeyEl = this.getContent() as HTMLElement;
                if (currentSelectedKey !== this) { // save color and change values only if is clicking different key
                    previousColor = thisKeyEl.style.backgroundColor;
                    thisField.setValue(freq);
                }
                currentSelectedKey = this;
                thisKeyEl.style.backgroundColor = selectedKeyColor;
                (thisField as any).htmlInput_.value = thisField.getText();
                pxt.AudioContextManager.tone(freq);
                setTimeout(function () {
                    // compare current sound counter with listener sound counter (avoid async problems)
                    if (soundingKeys == cnt)
                        pxt.AudioContextManager.stop();
                }, 300);
                (FieldNote as any).superClass_.dispose.call(this);
            }

            /**
             * @param idx index of the key
             * @return true if idx is white
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
             * @param idx index of the key
             * @return width of the key
             * @private
             */
            function getKeyWidth(idx: number): number {
                if (isWhite(idx))
                    return FieldNote.keyWidth;
                return FieldNote.keyWidth / 2;
            }

            /**
             * get height of the piano key
             * @param idx index of the key
             * @return height of the key
             * @private
             */
            function getKeyHeight(idx: number): number {
                if (isWhite(idx))
                    return FieldNote.keyHeight;
                return FieldNote.keyHeight / 2;
            }

            /**
             * get the position of the key in the piano
             * @param idx index of the key
             * @return position of the key
             */
            function getPosition(idx: number): number {
                const pos: number = (whiteKeyCounter * FieldNote.keyWidth);
                if (isWhite(idx))
                    return pos;
                return pos - (FieldNote.keyWidth / 4);
            }

            pianoDiv.style.width = pianoWidth + "px";
            pianoDiv.style.height = (pianoHeight + 1) + "px";

            (Blockly.DropDownDiv as any).setColour(this.colour_, this.colourBorder_);

            // Calculate positioning based on the field position.
            const scale = (this.sourceBlock_.workspace as any).scale;
            const bBox = {width: this.size_.width, height: this.size_.height};
            bBox.width *= scale;
            bBox.height *= scale;
            const position = this.fieldGroup_.getBoundingClientRect();
            const primaryX = position.left + bBox.width / 2;
            const primaryY = position.top + bBox.height;
            const secondaryX = primaryX;
            const secondaryY = position.top;
            // Set bounds to workspace; show the drop-down.
            (Blockly.DropDownDiv as any).setBoundsElement((this.sourceBlock_.workspace as Blockly.WorkspaceSvg).getParentSvg().parentNode);
            (Blockly.DropDownDiv as any).show(this, primaryX, primaryY, secondaryX, secondaryY,
                this.onHide.bind(this));
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

        /**
         * create a DOM to assign a style to the button (piano Key)
         * @param bgColor color of the key background
         * @param width width of the key
         * @param heigth heigth of the key
         * @param leftPosition horizontal position of the key
         * @param topPosition vertical position of the key
         * @param z_index z-index of the key
         * @return DOM with the new css style.
         */
        protected getKeyStyle(bgColor: string, width: number, height: number, leftPosition: number, topPosition: number, z_index: number) {
            const div = document.createElement("div")
            div.setAttribute("style", `background-color: ${bgColor};
                width: ${width}px;
                height: ${height}px;
                left: ${leftPosition}px;
                top: ${topPosition}px;
                z-index: ${z_index};
                border-color: ${this.colour_};`
            );
            div.className = "blocklyNote";
            return div;
        }

        /**
         * create a DOM to assign a style to the note label
         * @param topPosition vertical position of the label
         * @param leftPosition horizontal position of the label
         * @param pianoWidth the width of the containing piano
         * @param isMobile true if the device is a mobile
         * @return DOM with the new css style.
         * @private
         */
        getShowNoteStyle(topPosition: number, leftPosition: number, pianoWidth: number, isMobile: boolean) {
            topPosition += FieldNote.keyHeight;
            if (isMobile)
                topPosition += FieldNote.prevNextHeight;
            const div = document.createElement("div");
            div.setAttribute("style", `top: ${topPosition}px;
                left: ${leftPosition}px;
                background-color: ${this.colour_};
                width: ${pianoWidth}px;
                border-color: ${this.colour_};
                ${isMobile ?
                    `font-size ${FieldNote.labelHeight - 10}px;
                    height: ${FieldNote.labelHeight}px;`
                    :
                    ""
                }`
            );
            div.className = "blocklyNoteLabel";
            return div;
        }

        /**
         * create a DOM to assign a style to the previous and next buttons
         * @param topPosition vertical position of the label
         * @param leftPosition horizontal position of the label
         * @param pianoWidth the width of the containing piano
         * @param isPrev true if is previous button, false otherwise
         * @param isMobile true if the device is a mobile
         * @return DOM with the new css style.
         * @private
         */
        getNextPrevStyle(topPosition: number, leftPosition: number, pianoWidth: number, isPrev: boolean, isMobile: boolean) {
            // x position of the prev/next button
            const xPosition = (isPrev ? 0 : (pianoWidth / 2)) + leftPosition;
            // y position of the prev/next button
            let yPosition = (FieldNote.keyHeight + FieldNote.labelHeight + topPosition);
            if (isMobile)
                yPosition = FieldNote.keyHeight + topPosition;
            const div = document.createElement("div");
            div.setAttribute("style", `top: ${yPosition}px;
                left: ${xPosition}px;
                width: ${Math.ceil(pianoWidth / 2)}px;
                background-color: ${this.colour_};
                ${isPrev ? "border-left-color" : "border-right-color"}: ${this.colour_};
                ${isMobile ?
                    `height: ${FieldNote.prevNextHeight}px;
                    font-size: ${FieldNote.prevNextHeight - 10} px;`
                    :
                    `border-bottom-color: ${this.colour_};`
                }`
            );
            div.className = "blocklyNotePrevNext";
            return div;
        }

    }

    function hasOnlyOneField(block: Blockly.Block) {
        return block.inputList.length === 1 && block.inputList[0].fieldRow.length === 1;
    }
}
