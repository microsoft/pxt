// Helpers designed to help to make a simulator accessible.
namespace pxsim.accessibility {
    let liveRegion: HTMLDivElement;

    export function makeFocusable(elem: SVGElement): void {
        elem.setAttribute("focusable", "true");
        elem.setAttribute("tabindex", "0");
    }

    export function enableKeyboardInteraction(elem: Element, handler?: () => void): void {
        elem.addEventListener('keyup', (e: KeyboardEvent) => {
            let charCode = (typeof e.which == "number") ? e.which : e.keyCode
            if (charCode === 32 || charCode === 13) {
                handler();
            }
        });
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
            liveRegion = document.createElement("div");
            liveRegion.setAttribute("role", "status");
            liveRegion.setAttribute("aria-live", "polite");
            document.body.appendChild(liveRegion);
        }

        liveRegion.textContent = value;
    }
}