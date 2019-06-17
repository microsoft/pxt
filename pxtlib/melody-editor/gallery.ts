namespace pxtmelody {
    export interface GalleryItem {
        qName: string;
        src: string;
        alt: string;
    }

    export enum items { // these are placeholders for now
        melody1,
        melody2,
        melody3,
        melody4,
        melody5
    }

    const COLUMNS = 1;

    export class Gallery {
        protected info: pxtc.BlocksInfo;
        protected contentDiv: HTMLDivElement;
        protected containerDiv: HTMLDivElement;

        protected itemBorderColor: string;
        protected itemBackgroundColor: string;

        protected visible = false;

        protected pending: (res: MelodyArray, err?: string) => void;

        constructor(info: pxtc.BlocksInfo) {
            this.info = info;

            this.containerDiv = document.createElement("div");
            this.containerDiv.setAttribute("id", "sprite-editor-gallery-outer");
            this.contentDiv = document.createElement("div");
            this.contentDiv.setAttribute("id", "sprite-editor-gallery");

            this.itemBackgroundColor = "#ffffff"; // white
            this.itemBorderColor = "#000000"; // black

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

        show(cb: (res: MelodyArray, err?: string) => void) {
            if (this.pending) {
                this.reject("Error: multiple calls");
            }
            this.pending = cb;

            this.containerDiv.style.display = "block";
            this.buildDom();
            this.visible = true;
            this.contentDiv.setAttribute("class", "shown");
        }

        hide() {
            if (this.pending) {
                this.reject("cancelled");
            }
            this.visible = false;
            this.contentDiv.setAttribute("class", "hidden-above");
        }


        layout(left: number, top: number, height: number) {
            this.containerDiv.style.left = left + "px";
            this.containerDiv.style.top = top + "px";
            this.containerDiv.style.height = height + "px";
        }

        protected buildDom() {
            while (this.contentDiv.firstChild) this.contentDiv.removeChild(this.contentDiv.firstChild);
            const totalWidth = this.containerDiv.clientWidth - 17;
            const buttonWidth = (Math.floor(totalWidth / COLUMNS) - 8) + "px";
            // const melodies = Object.keys(items);
            // for(var i: number; i<melodies.length; i++) {
            //     this.mkButton(melodies[i], melodies[i], melodies[i], i, buttonWidth);
            // }

            Object.keys(items).forEach((item, i) => this.mkButton(item, item, item, i, buttonWidth)); // this is making two buttons for each melody
        }

        protected initStyles() {
            const style = document.createElement("style");
            style.textContent = `
            #sprite-editor-gallery {
                margin-top: -100%;
            }

            #sprite-editor-gallery.hidden-above {
                margin-top: -100%;
                animation: slide-up 0.2s 0s ease;
            }

            #sprite-editor-gallery.shown {
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

        protected mkButton(src: string, alt: string, value: string, i: number, width: string) {
            let button = document.createElement('button');
            button.setAttribute('id', ':' + i); // For aria-activedescendant
            button.setAttribute('role', 'menuitem');
            button.setAttribute('class', 'sprite-gallery-button sprite-editor-card');
            button.title = alt;
            button.style.width = width;
            button.style.height = "25px";
            let backgroundColor = this.itemBackgroundColor;

            button.style.backgroundColor = backgroundColor;
            button.style.borderColor = this.itemBorderColor;
            button.innerText = src;

            const parentDiv = this.contentDiv;

            //button.addEventListener("click", () => this.handleSelection(value));
            button.addEventListener(pxt.BrowserUtils.pointerEvents.move, () => {
                button.setAttribute('class', 'sprite-gallery-button sprite-gallery-button-hover sprite-editor-card');
                parentDiv.setAttribute('aria-activedescendant', button.id);
            });
            button.addEventListener(pxt.BrowserUtils.pointerEvents.leave, () => {
                button.setAttribute('class', 'sprite-gallery-button sprite-editor-card');
                parentDiv.removeAttribute('aria-activedescendant');
            });

            //let buttonImg = document.createElement('img');
            //buttonImg.src = src;
            button.setAttribute('data-value', value);
            //buttonImg.setAttribute('data-value', value);
            //button.appendChild(buttonImg);
            this.contentDiv.appendChild(button);
        }

        protected reject(reason: string) {
            if (this.pending) {
                const cb = this.pending;
                this.pending = undefined;
                cb(undefined, reason);
            }
        }
    }
}