namespace pxtblockly {
    export interface GalleryItem {
        qName: string;
        src: string;
        alt: string;
    }

    const COLUMNS = 4;

    export class Gallery {
        protected info: pxtc.BlocksInfo;
        protected contentDiv: HTMLDivElement;
        protected containerDiv: HTMLDivElement;

        protected itemBorderColor: string;
        protected itemBackgroundColor: string;

        protected visible = false;

        constructor(info: pxtc.BlocksInfo) {
            this.info = info;

            this.containerDiv = document.createElement("div");
            this.containerDiv.setAttribute("id", "sprite-editor-gallery-outer");
            this.contentDiv = document.createElement("div");
            this.contentDiv.setAttribute("id", "sprite-editor-gallery");

            this.itemBackgroundColor = "#ffffff";
            this.itemBorderColor = "#000000";

            this.initStyles();
            this.containerDiv.appendChild(this.contentDiv);

            this.containerDiv.style.display = "none";
            this.contentDiv.addEventListener("animationend", () => {
                if (!this.visible) {
                    this.containerDiv.style.display = "none";
                }
            });
        }

        getElement() {
            return this.containerDiv;
        }

        show() {
            this.containerDiv.style.display = "block";
            this.buildDom();
            this.visible = true;
            this.contentDiv.setAttribute("class", "shown");
        }

        hide() {
            this.visible = false;
            this.contentDiv.setAttribute("class", "hidden-above");
        }

        layout(left: number, top: number, height: number) {
            this.containerDiv.style.left = left + "px";
            this.containerDiv.style.top = top + "px";
            this.containerDiv.style.height = height + "px";
        }

        protected buildDom() {
            pxsim.U.clear(this.contentDiv);
            const totalWidth = this.containerDiv.clientWidth - 17;
            const buttonWidth = (Math.floor(totalWidth / COLUMNS) - 8) + "px";
            this.getGalleryItems("Image").forEach((item, i) => this.mkButton(item.src, item.alt, item.qName, i, buttonWidth));
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
            button.setAttribute('class', 'blocklyDropDownButton');
            button.title = alt;
            button.style.width = width;
            button.style.height = width;
            let backgroundColor = this.itemBackgroundColor;

            button.style.backgroundColor = backgroundColor;
            button.style.borderColor = this.itemBorderColor;
            Blockly.bindEvent_(button, 'click', this, () => this.handleSelection(value));
            Blockly.bindEvent_(button, 'mouseup', this, () => this.handleSelection(value));

            const parentDiv = this.contentDiv;

            // These are applied manually instead of using the :hover pseudoclass
            // because Android has a bad long press "helper" menu and green highlight
            // that we must prevent with ontouchstart preventDefault
            Blockly.bindEvent_(button, 'mousedown', button, function (e) {
                this.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonHover');
                e.preventDefault();
            });
            Blockly.bindEvent_(button, 'mouseover', button, function () {
                this.setAttribute('class', 'blocklyDropDownButton blocklyDropDownButtonHover');
                parentDiv.setAttribute('aria-activedescendant', this.id);
            });
            Blockly.bindEvent_(button, 'mouseout', button, function () {
                this.setAttribute('class', 'blocklyDropDownButton');
                parentDiv.removeAttribute('aria-activedescendant');
            });

            let buttonImg = document.createElement('img');
            buttonImg.src = src;
            button.setAttribute('data-value', value);
            buttonImg.setAttribute('data-value', value);
            button.appendChild(buttonImg);
            this.contentDiv.appendChild(button);
        }

        protected handleSelection(value: string) {

        }


        protected getGalleryItems(qName: string): GalleryItem[] {
            const syms = pxt.blocks.getFixedInstanceDropdownValues(this.info.apis, qName);
            pxt.blocks.generateIcons(syms);

            return syms.map(sym => {
                return {
                    qName: sym.qName,
                    src: sym.attributes.iconURL,
                    alt: "FIXME"
                };
            });
        }
    }
}