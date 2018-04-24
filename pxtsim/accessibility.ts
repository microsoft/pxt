
// Helpers designed to help to make a simulator accessible.
namespace pxsim.accessibility {
    let liveRegion: HTMLDivElement;

    export function makeFocusable(elem: SVGElement): void {
        elem.setAttribute("focusable", "true");
        elem.setAttribute("tabindex", "0");
    }

    export function enableKeyboardInteraction(elem: Element, handlerKeyDown?: () => void, handlerKeyUp?: () => void): void {
        if (handlerKeyDown) {
            elem.addEventListener('keydown', (e: KeyboardEvent) => {
                const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
                if (charCode === 32 || charCode === 13) { // Enter or Space key
                    handlerKeyDown();
                }
            });
        }

        if (handlerKeyUp) {
            elem.addEventListener('keyup', (e: KeyboardEvent) => {
                const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
                if (charCode === 32 || charCode === 13) { // Enter or Space key
                    handlerKeyUp();
                }
            });
        }
    }

    export function setAria(elem: Element, role?: string, label?: string): void {
        if (role && !elem.hasAttribute("role")) {
            elem.setAttribute("role", role);
        }

        if (label && !elem.hasAttribute("aria-label")) {
            elem.setAttribute("aria-label", label);
        }
    }

    export function setLiveContent(value: string): void {
        if (!liveRegion) {
            let style = "position: absolute !important;" +
                        "display: block;" +
                        "visibility: visible;" +
                        "overflow: hidden;" +
                        "width: 1px;" +
                        "height: 1px;" +
                        "margin: -1px;" +
                        "border: 0;" +
                        "padding: 0;" +
                        "clip: rect(0 0 0 0);";
            liveRegion = document.createElement("div");
            liveRegion.setAttribute("role", "status");
            liveRegion.setAttribute("aria-live", "polite");
            liveRegion.setAttribute("aria-hidden", "false");
            liveRegion.setAttribute("style", style);
            document.body.appendChild(liveRegion);
        }

        if (liveRegion.textContent !== value) {
            liveRegion.textContent = value;
        }
    }
}