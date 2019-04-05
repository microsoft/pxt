namespace pxsim.svg {
    export function parseString(xml: string): SVGSVGElement {
        return new DOMParser().parseFromString(xml, "image/svg+xml").getElementsByTagName("svg").item(0) as SVGSVGElement;
    }

    export function toDataUri(xml: string): string {
        return 'data:image/svg+xml,' + encodeURI(xml);
    }

    let pt: SVGPoint;
    export function cursorPoint(pt: SVGPoint, svg: SVGSVGElement, evt: MouseEvent): SVGPoint {
        // clientX and clientY are not defined in iOS safari
        pt.x = evt.clientX != null ? evt.clientX : evt.pageX;
        pt.y = evt.clientY != null ? evt.clientY : evt.pageY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    export function rotateElement(el: SVGElement, originX: number, originY: number, degrees: number) {
        el.setAttribute(
            'transform',
            `translate(${originX},${originY}) rotate(${degrees + 90}) translate(${-originX},${-originY})`
        );
    }

    export function hasClass(el: SVGElement, cls: string): boolean {
        if (el.classList) return el.classList.contains(cls);
        else return el.className.baseVal.indexOf(cls) > -1;
    }

    export function addClass(el: SVGElement, cls: string) {
        if (el.classList) el.classList.add(cls);
        else if (el.className.baseVal.indexOf(cls) < 0) el.className.baseVal += ' ' + cls;
    }

    export function removeClass(el: SVGElement, cls: string) {
        if (el.classList) el.classList.remove(cls);
        else el.className.baseVal = el.className.baseVal.replace(cls, '').replace(/\s{2,}/, ' ');
    }

    export function hydrate(el: SVGElement, props: any) {
        for (let k in props) {
            if (k == "title") {
                svg.title(el, props[k])
            } else el.setAttributeNS(null, k, props[k])
        }
    }

    export function elt(name: string, props?: any): SVGElement {
        let el = document.createElementNS("http://www.w3.org/2000/svg", name)
        if (props)
            svg.hydrate(el, props);
        return el;
    }

    export function child(parent: Element, name: string, props?: any): SVGElement {
        let el = svg.elt(name, props);
        parent.appendChild(el);
        return el;
    }

    export function mkPath(cls: string, data: string, title?: string): SVGPathElement {
        let p: any = { class: cls, d: data };
        if (title) p["title"] = title;
        let el = <SVGPathElement>svg.elt("path");
        svg.hydrate(el, p);
        return el;
    }

    export function path(parent: Element, cls: string, data: string, title?: string): SVGPathElement {
        let el = mkPath(cls, data, title);
        parent.appendChild(el);
        return el;
    }


    export function fill(el: SVGElement, c: string) {
        (<any>el).style.fill = c;
    }

    export function filter(el: SVGElement, c: string) {
        (<any>el).style.filter = c;
    }

    export function fills(els: SVGElement[], c: string) {
        els.forEach(el => (<any>el).style.fill = c);
    }

    export function isTouchEnabled(): boolean {
        return typeof window !== "undefined" &&
            ('ontouchstart' in window               // works on most browsers
                || navigator.maxTouchPoints > 0);       // works on IE10/11 and Surface);
    }

    export function onClick(el: Element, click: (ev: MouseEvent) => void) {
        let captured = false;
        pxsim.pointerEvents.down.forEach(evid => el.addEventListener(evid, (ev: MouseEvent) => {
            captured = true;
            return true;
        }, false));
        el.addEventListener(pxsim.pointerEvents.up, (ev: MouseEvent) => {
            if (captured) {
                captured = false;
                click(ev);
                ev.preventDefault();
                return false;
            }
            return true;
        }, false);
    }

    export function buttonEvents(el: Element,
        move?: (ev: MouseEvent) => void,
        start?: (ev: MouseEvent) => void,
        stop?: (ev: MouseEvent) => void,
        keydown?: (ev: KeyboardEvent) => void) {
        let captured = false;
        pxsim.pointerEvents.down.forEach(evid => el.addEventListener(evid, (ev: MouseEvent) => {
            captured = true;
            if (start) start(ev)
            return true;
        }, false));
        el.addEventListener(pxsim.pointerEvents.move, (ev: MouseEvent) => {
            if (captured) {
                if (move) move(ev);
                ev.preventDefault();
                return false;
            }
            return true;
        }, false);
        el.addEventListener(pxsim.pointerEvents.up, (ev: MouseEvent) => {
            captured = false;
            if (stop) stop(ev);
        }, false);
        el.addEventListener(pxsim.pointerEvents.leave, (ev: MouseEvent) => {
            captured = false;
            if (stop) stop(ev);
        }, false);
        el.addEventListener('keydown', (ev: KeyboardEvent) => {
            captured = false;
            if (keydown) keydown(ev);
        });
    }

    export function mkLinearGradient(id: string, horizontal = false): SVGLinearGradientElement {
        let gradient = <SVGLinearGradientElement>svg.elt("linearGradient");
        svg.hydrate(gradient, { id: id, x1: "0%", y1: "0%", x2: horizontal ? "100%" : "0%", y2: horizontal ? "0%" : "100%"});
        let stop1 = svg.child(gradient, "stop", { offset: "0%" })
        let stop2 = svg.child(gradient, "stop", { offset: "100%" })
        let stop3 = svg.child(gradient, "stop", { offset: "100%" })
        let stop4 = svg.child(gradient, "stop", { offset: "100%" })
        return gradient;
    }

    export function linearGradient(defs: SVGDefsElement, id: string, horizontal = false): SVGLinearGradientElement {
        let lg = mkLinearGradient(id, horizontal);
        defs.appendChild(lg);
        return lg;
    }

    export function setGradientColors(lg: SVGLinearGradientElement, start: string, end: string) {
        if (!lg) return;

        (<SVGStopElement>lg.childNodes[0]).style.stopColor = start;
        (<SVGStopElement>lg.childNodes[1]).style.stopColor = start;
        (<SVGStopElement>lg.childNodes[2]).style.stopColor = end;
        (<SVGStopElement>lg.childNodes[3]).style.stopColor = end;
    }

    export function setGradientValue(lg: SVGLinearGradientElement, percent: string) {
        if ((<SVGStopElement>lg.childNodes[1]).getAttribute("offset") != percent) {
            (<SVGStopElement>lg.childNodes[1]).setAttribute("offset", percent);
            (<SVGStopElement>lg.childNodes[2]).setAttribute("offset", percent);
        }
    }

    export function animate(el: SVGElement, cls: string) {
        svg.addClass(el, cls);
        let p = el.parentElement;
        if (p) {
            p.removeChild(el);
            p.appendChild(el)
        }
    }

    export function mkTitle(txt: string): SVGTitleElement {
        let t = <SVGTitleElement>svg.elt("title");
        t.textContent = txt;
        return t;
    }

    export function title(el: SVGElement, txt: string): SVGTitleElement {
        let t = mkTitle(txt);
        el.appendChild(t);
        return t;
    }

    export function toHtmlColor(c: number): string {
        const b = c & 0xFF;
        const g = (c >> 8) & 0xFF;
        const r = (c >> 16) & 0xFF;
        const a = (c >> 24) & 0xFF / 255;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

}