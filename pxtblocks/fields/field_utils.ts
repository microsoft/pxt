namespace pxtblockly {
    export namespace svg {
        export function hasClass(el: SVGElement, cls: string): boolean {
            return pxt.BrowserUtils.containsClass(el, cls);
        }

        export function addClass(el: SVGElement, cls: string) {
            pxt.BrowserUtils.addClass(el, cls);
        }

        export function removeClass(el: SVGElement, cls: string) {
            pxt.BrowserUtils.removeClass(el, cls);
        }
    }
    export function parseColour(colour: string | number): string {
        const hue = Number(colour);
        if (!isNaN(hue)) {
            return Blockly.hueToRgb(hue);
        } else if (goog.isString(colour) && (colour as string).match(/^#[0-9a-fA-F]{6}$/)) {
            return colour as string;
        } else {
            return '#000';
        }
    }
}