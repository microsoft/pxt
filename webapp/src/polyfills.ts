// all options default to true
interface CheckVisibilityOptions {
    contentVisibilityAuto?: boolean;
    opacityProperty?: boolean;
    visibilityProperty?: boolean;
    checkOpacity?: boolean;
    checkVisibilityCSS?: boolean;
}

export function applyPolyfills() {
    if (!(Element.prototype as any).checkVisibility) {
        (Element.prototype as any).checkVisibility = function checkVisibility(this: Element, options: CheckVisibilityOptions = {}): boolean {
            let checkOpacity = true;

            if (options.opacityProperty != undefined || options.checkOpacity != undefined) {
                checkOpacity = !!(options.opacityProperty || options.checkOpacity);
            }

            let checkVisibility = true;

            if (options.visibilityProperty != undefined || options.checkVisibilityCSS != undefined) {
                checkVisibility = !!(options.visibilityProperty || options.checkVisibilityCSS);
            }

            let checkContentVisibility = true;

            if (options.contentVisibilityAuto != undefined) {
                checkContentVisibility = !!options.contentVisibilityAuto;
            }

            const computedStyle = getComputedStyle(this);

            // technically, this should also check for contentVisibility === "auto" and then
            // traverse the ancestors of this node to see if any have contentVisibility set
            // to "hidden", but Blockly doesn't use content-visibility AFAIK
            if (
                computedStyle.display === "none" ||
                (checkOpacity && computedStyle.opacity === "0") ||
                (checkVisibility && computedStyle.visibility === "hidden") ||
                (checkContentVisibility && (computedStyle as any).contentVisibility === "hidden")
            ) {
                return false;
            }

            try {
                const rec = this.getBoundingClientRect();
                if (rec.width === 0 || rec.height === 0) {
                    return false;
                }
            }
            catch {
                // some versions of firefox throw if an element is not in the DOM
                // and getBoundingClientRect is called
                return false;
            }

            return true;
        }
    }
}