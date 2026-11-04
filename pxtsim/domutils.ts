namespace pxsim.U {
    // Keep these helpers unified with pxtlib/browserutils.ts
    export function containsClass(el: SVGElement | HTMLElement, classes: string) {
        return splitClasses(classes).every(cls => containsSingleClass(el, cls));

        function containsSingleClass(el: SVGElement | HTMLElement, cls: string) {
            if (el.classList) {
                return el.classList.contains(cls);
            } else {
                const classes = (el.className + "").split(/\s+/);
                return !(classes.indexOf(cls) < 0);
            }
        }
    }

    export function addClass(el: SVGElement | HTMLElement, classes: string) {
        splitClasses(classes).forEach(cls => addSingleClass(el, cls));

        function addSingleClass(el: SVGElement | HTMLElement, cls: string) {
            if (el.classList) {
                el.classList.add(cls);
            } else {
                const classes = (el.className + "").split(/\s+/);
                if (classes.indexOf(cls) < 0) {
                    el.className.baseVal += " " + cls;
                }
            }
        }
    }

    export function removeClass(el: SVGElement | HTMLElement, classes: string) {
        splitClasses(classes).forEach(cls => removeSingleClass(el, cls));

        function removeSingleClass(el: SVGElement | HTMLElement, cls: string) {
            if (el.classList) {
                el.classList.remove(cls);
            } else {
                el.className.baseVal = (el.className + "")
                    .split(/\s+/)
                    .filter(c => c != cls)
                    .join(" ");
            }
        }
    }

    function splitClasses(classes: string) {
        return classes.split(/\s+/).filter(s => !!s);
    }

    export function remove(element: Element) {
        element.parentElement.removeChild(element);
    }

    export function removeChildren(element: Element) {
        while (element.firstChild) element.removeChild(element.firstChild);
    }

    export function clear(element: Element) {
        removeChildren(element);
    }
}
