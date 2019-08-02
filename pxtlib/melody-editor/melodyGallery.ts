namespace pxtmelody {
    export class MelodyGallery {
        protected contentDiv: HTMLDivElement;
        protected containerDiv: HTMLDivElement;

        protected itemBorderColor: string;
        protected itemBackgroundColor: string;

        protected value: string = null;

        protected visible = false;
        protected pending: (res: string) => void;

        private timeouts: number[] = []; // keep track of timeout
        private numSamples: number = pxtmelody.SampleMelodies.length;

        constructor() {
            this.containerDiv = document.createElement("div");
            this.containerDiv.setAttribute("id", "melody-editor-gallery-outer");
            this.contentDiv = document.createElement("div");
            this.contentDiv.setAttribute("id", "melody-editor-gallery");

            this.itemBackgroundColor = "#DCDCDC";
            this.itemBorderColor = "white";

            this.initStyles();
            this.containerDiv.appendChild(this.contentDiv);

            this.containerDiv.style.display = "none";
            this.contentDiv.addEventListener("animationend", () => {
                if (!this.visible) {
                    this.containerDiv.style.display = "none";
                }
            });

            this.contentDiv.addEventListener('wheel', e => {
                e.stopPropagation();
            }, true)
        }

        getElement() {
            return this.containerDiv;
        }

        getValue() {
            return this.value;
        }

        show(notes: (res: string) => void) {
            this.pending = notes;
            this.containerDiv.style.display = "block";
            this.buildDom();
            this.visible = true;
            pxt.BrowserUtils.removeClass(this.contentDiv, "hidden-above");
            pxt.BrowserUtils.addClass(this.contentDiv, "shown");
        }

        hide() {
            this.visible = false;
            pxt.BrowserUtils.removeClass(this.contentDiv, "shown");
            pxt.BrowserUtils.addClass(this.contentDiv, "hidden-above");
            this.value = null;
            this.stopMelody();
        }

        clearDomReferences() {
            this.contentDiv = null;
            this.containerDiv = null;
        }

        layout(left: number, top: number, height: number) {
            this.containerDiv.style.left = left + "px";
            this.containerDiv.style.top = top + "px";
            this.containerDiv.style.height = height + "px";
        }

        protected buildDom() {
            while (this.contentDiv.firstChild) this.contentDiv.removeChild(this.contentDiv.firstChild);
            const buttonWidth = "255px";
            const buttonHeight = "45px";
            const samples = pxtmelody.SampleMelodies;
            for (let i = 0; i < samples.length; i++) {
                this.mkButton(samples[i], i, buttonWidth, buttonHeight);
            }
        }

        protected initStyles() {
            // Style injected directly because animations are mangled by the less compiler
            const style = document.createElement("style");
            style.textContent = `
            #melody-editor-gallery {
                margin-top: -100%;
            }

            #melody-editor-gallery.hidden-above {
                margin-top: -100%;
                animation: slide-up 0.2s 0s ease;
            }

            #melody-editor-gallery.shown {
                margin-top: 0px;
                animation: slide-down 0.2s 0s ease;
            }

            @keyframes slide-down {
                0% {
                    margin-top: -100%;
                }
                100% {
                    margin-top: 0px;
                }
            }

            @keyframes slide-up {
                0% {
                    margin-top: 0px;
                }
                100% {
                    margin-top: -100%;
                }
            }
            `;
            this.containerDiv.appendChild(style);
        }

        protected mkButton(sample: pxtmelody.MelodyInfo, i: number, width: string, height: string) {
            let galleryItem = document.createElement('div');
            galleryItem.setAttribute('id', ':' + i); // For aria-activedescendant
            galleryItem.setAttribute('role', 'menuitem');
            galleryItem.style.width = width;
            galleryItem.style.height = height;
            galleryItem.style.backgroundColor = this.itemBackgroundColor;
            galleryItem.style.borderColor = this.itemBorderColor;
            pxt.BrowserUtils.addClass(galleryItem, "melody-gallery-button melody-editor-card");

            const parentDiv = this.contentDiv;

            galleryItem.addEventListener(pxt.BrowserUtils.pointerEvents.move, () => {
                pxt.BrowserUtils.addClass(galleryItem, "melody-gallery-button-hover");
                parentDiv.setAttribute('aria-activedescendant', galleryItem.id);
            });
            galleryItem.addEventListener(pxt.BrowserUtils.pointerEvents.leave, () => {
                pxt.BrowserUtils.removeClass(galleryItem, "melody-gallery-button-hover");
                parentDiv.removeAttribute('aria-activedescendant');
            });

            // create clickable area on gallery item for selecting the item
            // clickable area is separate from preview button for listening to the melody 
            let clickableArea = document.createElement('div');
            clickableArea.addEventListener("click", () => this.handleSelection(sample));
            clickableArea.setAttribute('data-value', sample.notes);
            clickableArea.title = sample.name;
            pxt.BrowserUtils.addClass(clickableArea, "melody-gallery-row");
            clickableArea.style.width = "200px";

            let melodyName = document.createElement('div');
            melodyName.innerText = sample.name;
            pxt.BrowserUtils.addClass(melodyName, "melody-editor-text");

            let musicIcon = document.createElement('i');
            pxt.BrowserUtils.addClass(musicIcon, "music icon melody-icon");

            let colorBlock = this.createColorBlock(sample);

            clickableArea.appendChild(musicIcon);
            clickableArea.appendChild(melodyName);
            clickableArea.appendChild(colorBlock);

            galleryItem.appendChild(clickableArea);

            // preview button to hear the melody
            let preview = this.createPreviewButton(sample, i);
            galleryItem.appendChild(preview);

            this.contentDiv.appendChild(galleryItem);
        }

        protected handleSelection(sample: pxtmelody.MelodyInfo) {
            if (this.pending) {
                const notes = this.pending;
                this.pending = undefined;
                notes(sample.notes);
            }
        }

        private playNote(note: string, colNumber: number, tempo: number): void {
            let tone: number = 0;

            switch (note) {
                case "C5": tone = 523; break; // Tenor C
                case "B": tone = 494; break; // Middle B
                case "A": tone = 440; break; // Middle A
                case "G": tone = 392; break; // Middle G
                case "F": tone = 349; break; // Middle F
                case "E": tone = 330; break; // Middle E
                case "D": tone = 294; break; // Middle D
                case "C": tone = 262; break; // Middle C 
            }

            // start note
            this.timeouts.push(setTimeout(() => {
                pxt.AudioContextManager.tone(tone);
            }, colNumber * this.getDuration(tempo)));
            // stop note
            this.timeouts.push(setTimeout(() => {
                pxt.AudioContextManager.stop();
            }, (colNumber + 1) * this.getDuration(tempo)));
        }

        // ms to hold note
        private getDuration(tempo: number): number {
            return 60000 / tempo;
        }

        private previewMelody(sample: pxtmelody.MelodyInfo): void {
            // stop playing any other melody
            this.stopMelody();
            let notes = sample.notes.split(" ");
            for (let i = 0; i < notes.length; i++) {
                this.playNote(notes[i], i, sample.tempo);
            }
        }

        private togglePlay(sample: pxtmelody.MelodyInfo, i: number) {
            let button = document.getElementById("play-button-" + i);
            if (pxt.BrowserUtils.containsClass(button, "play icon")) {
                // check for other stop icons and toggle back to play
                this.resetPlayIcons();
                pxt.BrowserUtils.removeClass(button, "play icon");
                pxt.BrowserUtils.addClass(button, "stop icon");
                this.previewMelody(sample);
                // make icon toggle back to play when the melody finishes
                this.timeouts.push(setTimeout(() => {
                    pxt.BrowserUtils.removeClass(button, "stop icon");
                    pxt.BrowserUtils.addClass(button, "play icon");
                }, (sample.notes.split(" ").length) * this.getDuration(sample.tempo)));
            } else {
                pxt.BrowserUtils.removeClass(button, "stop icon");
                pxt.BrowserUtils.addClass(button, "play icon");
                this.stopMelody();
            }
        }

        public stopMelody() {
            while (this.timeouts.length) clearTimeout(this.timeouts.shift());
            pxt.AudioContextManager.stop();
        }

        private resetPlayIcons(): void {
            for (let i = 0; i < this.numSamples; i++) {
                let button = document.getElementById("play-button-" + i);
                if (pxt.BrowserUtils.containsClass(button, "stop icon")) {
                    pxt.BrowserUtils.removeClass(button, "stop icon");
                    pxt.BrowserUtils.addClass(button, "play icon");
                    break;
                }
            }
        }

        // create color representation of melody
        private createColorBlock(sample: pxtmelody.MelodyInfo): HTMLDivElement {
            let colorBlock = document.createElement("div");
            pxt.BrowserUtils.addClass(colorBlock, "melody-color-block");
            let notes = sample.notes.split(" ");
            for (let i = 0; i < notes.length; i++) {
                let className = pxtmelody.getColorClass(pxtmelody.noteToRow(notes[i]));
                let colorDiv = document.createElement("div");
                // create rounded effect on edge divs and fill in color
                if (i == 0) {
                    pxt.BrowserUtils.addClass(colorDiv, "left-edge sliver " + className);
                } else if (i == notes.length - 1) {
                    pxt.BrowserUtils.addClass(colorDiv, "right-edge sliver " + className);
                } else {
                    pxt.BrowserUtils.addClass(colorDiv, "sliver " + className);
                }

                colorBlock.appendChild(colorDiv);
            }
            return colorBlock;
        }

        private createPreviewButton(sample: pxtmelody.MelodyInfo, i: number): HTMLDivElement {
            let preview = document.createElement("div");
            preview.title = lf("Preview");
            pxt.BrowserUtils.addClass(preview, "circular mini ui icon button melody-preview-button");

            let playButton = document.createElement("i");
            playButton.id = "play-button-" + i;
            pxt.BrowserUtils.addClass(playButton, "play icon");
            pxt.BrowserUtils.addClass(playButton, "melody-gallery-play-icon");

            preview.appendChild(playButton);
            preview.addEventListener("click", () => this.togglePlay(sample, i));
            return preview;
        }
    }
}