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
            const buttonWidth = "300px";
            const buttonHeight = "45px";
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
            let row = document.createElement('div');
            row.setAttribute('id', ':' + i); // For aria-activedescendant
            row.setAttribute('role', 'menuitem');
            row.setAttribute('class', 'melody-gallery-button melody-editor-card');
            row.style.width = width;
            row.style.height = height;
            let backgroundColor = this.itemBackgroundColor;

            row.style.backgroundColor = backgroundColor;
            row.style.borderColor = this.itemBorderColor;

            const parentDiv = this.contentDiv;

            row.addEventListener(pxt.BrowserUtils.pointerEvents.move, () => {
                row.setAttribute('class', 'melody-gallery-button melody-gallery-button-hover melody-editor-card');
                parentDiv.setAttribute('aria-activedescendant', row.id);
            });
            row.addEventListener(pxt.BrowserUtils.pointerEvents.leave, () => {
                row.setAttribute('class', 'melody-gallery-button melody-editor-card');
                parentDiv.removeAttribute('aria-activedescendant');
            });

            let galleryItem = document.createElement('div');
            pxt.BrowserUtils.addClass(galleryItem, "melody-gallery-row");

            galleryItem.addEventListener("click", () => this.handleSelection(value));
            

            let buttonText = document.createElement('div');
            buttonText.innerText = src;
            buttonText.setAttribute('class', 'melody-editor-text');
            
            let musicIcon = document.createElement('i');
            pxt.BrowserUtils.addClass(musicIcon, "music icon melody-icon");
            
            galleryItem.setAttribute('data-value', value);
            galleryItem.title = alt;

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
            
            galleryItem.appendChild(musicIcon);
            galleryItem.appendChild(buttonText);
            galleryItem.appendChild(colorBlock);

            let preview = document.createElement("div");
            preview.title = "Preview";
            pxt.BrowserUtils.addClass(preview, "circular mini ui icon button melody-preview-button");
            
            let playButton = document.createElement("i");
            pxt.BrowserUtils.addClass(playButton, "play icon");
            pxt.BrowserUtils.addClass(playButton, "melody-gallery-play-icon");
            
            preview.appendChild(playButton);
            preview.addEventListener("click", () => this.previewMelody(value));
            
            row.appendChild(galleryItem);
            row.appendChild(preview);
            this.contentDiv.appendChild(row);
        }

        protected handleSelection(value: string) {
            if (this.pending) {
                const notes = this.pending;
                this.pending = undefined;
                notes(value);
            }
        }

        protected previewMelody(value:string):void {

        }

    }
}