/// <reference path="./buttons.ts" />
namespace pxtsprite {
    import svg = pxt.svgUtil;

    export interface SpriteHeaderHost {
        showGallery(): void;
        hideGallery(): void;
    }

    export class SpriteHeader {
        div: HTMLDivElement;
        root: svg.SVG;
        toggle: Toggle;
        undoButton: Button;
        redoButton: Button;

        constructor(protected host: SpriteHeaderHost) {
            this.div = document.createElement("div");
            this.div.setAttribute("id", "sprite-editor-header");

            this.root = new svg.SVG(this.div).id("sprite-editor-header-controls");
            this.toggle = new Toggle(this.root, { leftText: "Editor", rightText: "Gallery", baseColor: "#4B7BEC" });
            this.toggle.onStateChange(isLeft => {
                if (isLeft) {
                    this.host.hideGallery();
                }
                else {
                    this.host.showGallery();
                }
            });
        }

        getElement() {
            return this.div;
        }

        layout() {
            this.toggle.layout();
            this.toggle.translate((TOTAL_HEIGHT - this.toggle.width()) / 2, (HEADER_HEIGHT - this.toggle.height()) / 2);
        }
    }
}

// <div role="button" class="closeIcon" tabindex="0">
// <i class="icon close remove circle " aria-hidden="true" role="presentation"></i>
// </div>
function makeCloseButton() {
    const i = document.createElement("i");
    i.className = "icon close remove circle sprite-focus-hover";
    i.setAttribute("role", "presentation");
    i.setAttribute("aria-hidden", "true");

    const d = document.createElement("div");
    d.className = "closeIcon";
    d.setAttribute("tabindex", "0");
    d.setAttribute("role", "button");

    d.appendChild(i);
    return d;
}