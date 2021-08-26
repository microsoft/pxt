namespace pxtmelody {
    export class MelodyGallery {
        protected contentDiv: HTMLDivElement;
        protected containerDiv: HTMLDivElement;

        protected itemBorderColor: string;
        protected itemBackgroundColor: string;

        protected value: string = null;

        protected visible = false;
        protected pending: (res: string) => void;

        protected buttons: HTMLElement[];

        private timeouts: number[] = []; // keep track of timeout
        private numSamples: number = pxtmelody.SampleSounds.length;

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
            const samples = pxtmelody.SampleSounds;

            this.buttons = [];
            for (let i = 0; i < samples.length; i++) {
                this.mkButton(samples[i], i);
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

        protected mkButton(sample: pxtmelody.SoundInfo, i: number) {
            const outer = mkElement("div", {
                className: "melody-gallery-button melody-editor-card",
                role: "menuitem",
                id: `:${i}`
            });

            const icon = mkElement("i", {
                className: "music icon melody-icon"
            });

            const label = mkElement("div", {
                className: "melody-editor-text"
            });

            label.innerText = sample.name;

            const preview = this.createColorBlock(sample);

            const leftButton = mkElement("div", {
                className: "melody-editor-button left-button",
                role: "button",
                title: sample.name
            }, () => this.handleSelection(sample))

            leftButton.appendChild(icon);
            leftButton.appendChild(label);
            leftButton.appendChild(preview);


            outer.appendChild(leftButton);

            const rightButton = mkElement("div", {
                className: "melody-editor-button right-button",
                role: "button",
                title: lf("Preview {0}", sample.name)
            }, () => this.togglePlay(sample, i));

            const playIcon = mkElement("i", {
                className: "play icon"
            });

            this.buttons[i] = playIcon;

            rightButton.appendChild(playIcon);
            outer.appendChild(rightButton);

            this.contentDiv.appendChild(outer);
        }

        protected handleSelection(sample: pxtmelody.SoundInfo) {
           if (this.pending) {
                const notes = this.pending;
                this.pending = undefined;
               notes(sample.waveType);

            }
        }

       

        

        private previewMelody(sample: pxtmelody.SoundInfo): void {
            // stop playing any other melody
            this.stopMelody();
            pxt.AudioContextManager.sound( sample.startFrequency, sample.endFrequency, sample.duration, sample.waveType, sample.volume, sample.interpolation );
                
        }

        private togglePlay(sample: pxtmelody.SoundInfo, i: number) {
            let button = this.buttons[i];

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
                },  sample.duration));
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
                let button = this.buttons[i];
                if (pxt.BrowserUtils.containsClass(button, "stop icon")) {
                    pxt.BrowserUtils.removeClass(button, "stop icon");
                    pxt.BrowserUtils.addClass(button, "play icon");
                    break;
                }
            }
        }

        // create color representation of melody
        private createColorBlock(sample: pxtmelody.SoundInfo): HTMLDivElement {
            let colorBlock = document.createElement("div");
            pxt.BrowserUtils.addClass(colorBlock, "melody-color-block");
            let colorDiv = document.createElement("div");
            pxt.BrowserUtils.addClass(colorDiv, "sound-effect-preview");

            colorBlock.appendChild(colorDiv);
            
            return colorBlock;
        }
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
}