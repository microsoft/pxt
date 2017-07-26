namespace pxsim.accessibility {
    let isIE: boolean = undefined;
    let liveRegion: HTMLDivElement;

    function detectIE(): boolean {
        if (isIE !== undefined) {
            return isIE;
        }

        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            isIE = true;
            return true;
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            isIE = true;
            return true;
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            isIE = true;
            return true;
        }

        isIE = false;
        return false;
    }

    export function makeFocusable(elem: SVGElement): void {
        if (detectIE()) {
            elem.setAttribute("focusable", "true");
        } else {
            elem.setAttribute("tabindex", "0");
        }
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