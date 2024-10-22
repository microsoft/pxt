export function applyPolyfills() {
    if (!Element.prototype.checkVisibility) {
        Element.prototype.checkVisibility = function checkVisibility(this: Element): boolean {
            const computedStyle = getComputedStyle(this);

            // technically, this should also check for contentVisibility === "auto" and then
            // traverse the ancestors of this node to see if any have contentVisibility set
            // to "hidden", but Blockly doesn't use content-visibility AFAIK
            if (
                computedStyle.opacity === "0" ||
                computedStyle.visibility === "hidden" ||
                computedStyle.display === "none" ||
                computedStyle.contentVisibility === "hidden"
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