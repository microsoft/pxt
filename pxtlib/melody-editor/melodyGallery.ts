namespace pxtmelody {
    import svg = pxt.svgUtil;
    export class MelodyGallery {
        protected contentDiv: HTMLDivElement;
        protected containerDiv: HTMLDivElement;

        protected itemBorderColor: string;
        protected itemBackgroundColor: string;

        protected value: string = null;

        protected visible = false;
        protected pending: (res: string) => void;
        
        constructor() {
            this.containerDiv = document.createElement("div");
            this.containerDiv.setAttribute("id", "melody-editor-gallery-outer");
            this.contentDiv = document.createElement("div");
            this.contentDiv.setAttribute("id", "melody-editor-gallery");

            this.itemBackgroundColor = "gainsboro";
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
        
        show(notes:(res: string) => void) {
            this.pending = notes;
            this.containerDiv.style.display = "block";
            this.buildDom();
            this.visible = true;
            this.contentDiv.setAttribute("class", "shown");
        }

        hide() {
            this.visible = false;
            this.contentDiv.setAttribute("class", "hidden-above");
            this.value = null;
        }

        layout(left: number, top: number, height: number) {
            this.containerDiv.style.left = left + "px";
            this.containerDiv.style.top = top + "px";
            this.containerDiv.style.height = height + "px";
        }

        protected buildDom() {
            while (this.contentDiv.firstChild) this.contentDiv.removeChild(this.contentDiv.firstChild);
            //const totalWidth = "300px";
            const buttonWidth = "300px";
            const buttonHeight = "35px";
            //pxtmelody.SampleMelodies.forEach((item, i) => this.mkButton(item.name, item.name, item.notes, i, buttonWidth));
            const samples = pxtmelody.SampleMelodies;
            for (let i = 0; i < samples.length; i++) {
                this.mkButton(samples[i].name, samples[i].name, samples[i].notes, i, buttonWidth, buttonHeight);
            }
        }

        protected initStyles() {
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

        protected mkButton(src: string, alt: string, value: string, i: number, width: string, height: string) {
            let button = document.createElement('button');
            button.setAttribute('id', ':' + i); // For aria-activedescendant
            button.setAttribute('role', 'menuitem');
            button.setAttribute('class', 'melody-gallery-button melody-editor-card');
            button.title = alt;
            button.style.width = width;
            button.style.height = height;
            let backgroundColor = this.itemBackgroundColor;

            button.style.backgroundColor = backgroundColor;
            button.style.borderColor = this.itemBorderColor;

            const parentDiv = this.contentDiv;

            button.addEventListener("click", () => this.handleSelection(value));
            button.addEventListener(pxt.BrowserUtils.pointerEvents.move, () => {
                button.setAttribute('class', 'melody-gallery-button melody-gallery-button-hover melody-editor-card');
                parentDiv.setAttribute('aria-activedescendant', button.id);
            });
            button.addEventListener(pxt.BrowserUtils.pointerEvents.leave, () => {
                button.setAttribute('class', 'melody-gallery-button melody-editor-card');
                parentDiv.removeAttribute('aria-activedescendant');
            });

            let buttonText = document.createElement('div');
            buttonText.innerText = src;
            buttonText.setAttribute('class', 'melody-editor-text');
            
            let musicIcon = document.createElement('i');
            pxt.BrowserUtils.addClass(musicIcon, "music icon");
            
            button.setAttribute('data-value', value);
            button.appendChild(musicIcon);
            button.appendChild(buttonText);
            // create color representation of melody
            let colorBlock = document.createElement("div");
            pxt.BrowserUtils.addClass(colorBlock, "melody-color-block");
            let notes = value.split(" ");
            for (let i = 0; i < notes.length; i++) {
                let className = pxtmelody.getColorClass(pxtmelody.noteToRow(notes[i]));
                let colorDiv = document.createElement("div");
                pxt.BrowserUtils.addClass(colorDiv,"sliver " + className);
                colorBlock.appendChild(colorDiv);
            }
            button.appendChild(colorBlock);
            this.contentDiv.appendChild(button);
        }

        protected handleSelection(value: string) {
            if (this.pending) {
                const notes = this.pending;
                this.pending = undefined;
                notes(value);
            }
        }

    }
}