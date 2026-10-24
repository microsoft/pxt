namespace pxsim {
    export interface IPointerEvents {
        up: string,
        down: string[],
        move: string,
        enter: string,
        leave: string
    }

    export function isTouchEnabled(): boolean {
        return typeof window !== "undefined" &&
            ('ontouchstart' in window                              // works on most browsers
                || (navigator && navigator.maxTouchPoints > 0));       // works on IE10/11 and Surface);
    }

    export function hasPointerEvents(): boolean {
        return typeof window != "undefined" && !!(window as any).PointerEvent;
    }

    export const pointerEvents: IPointerEvents = hasPointerEvents() ? {
        up: "pointerup",
        down: ["pointerdown"],
        move: "pointermove",
        enter: "pointerenter",
        leave: "pointerleave"
    } : isTouchEnabled() ?
            {
                up: "mouseup",
                down: ["mousedown", "touchstart"],
                move: "touchmove",
                enter: "touchenter",
                leave: "touchend"
            } :
            {
                up: "mouseup",
                down: ["mousedown"],
                move: "mousemove",
                enter: "mouseenter",
                leave: "mouseleave"
            };
}

namespace pxsim.visuals {
    export interface IBoardPart<T> {
        style: string,
        element: SVGElement,
        overElement?: SVGElement,
        defs: SVGElement[],
        init(bus: EventBus, state: T, svgEl: SVGSVGElement, otherParams: Map<string>): void, //NOTE: constructors not supported in interfaces
        moveToCoord(xy: visuals.Coord): void,
        updateState(): void,
        updateTheme(): void,
    }

    export function translateEl(el: SVGElement, xy: [number, number]) {
        //TODO append translation instead of replacing the full transform
        svg.hydrate(el, { transform: `translate(${xy[0]} ${xy[1]})` });
    }

    export interface ComposeOpts {
        el1: SVGAndSize<SVGSVGElement>,
        scaleUnit1: number,
        el2: SVGAndSize<SVGSVGElement>,
        scaleUnit2: number,
        margin: [number, number, number, number],
        middleMargin: number,
        maxWidth?: string,
        maxHeight?: string,
    }
    export interface ComposeResult {
        host: SVGSVGElement,
        scaleUnit: number,
        under: SVGGElement,
        over: SVGGElement,
        edges: number[],
        toHostCoord1: (xy: Coord) => Coord,
        toHostCoord2: (xy: Coord) => Coord,
    }
    export function composeSVG(opts: ComposeOpts): ComposeResult {
        let [a, b] = [opts.el1, opts.el2];
        U.assert(a.x == 0 && a.y == 0 && b.x == 0 && b.y == 0, "el1 and el2 x,y offsets not supported");
        let setXY = (e: SVGSVGElement, x: number, y: number) => svg.hydrate(e, { x: x, y: y });
        let setWH = (e: SVGSVGElement, w: string, h: string) => {
            if (w)
                svg.hydrate(e, { width: w });
            if (h)
                svg.hydrate(e, { height: h });
        }
        let setWHpx = (e: SVGSVGElement, w: number, h: number) => svg.hydrate(e, { width: `${w}px`, height: `${h}px` });
        let scaleUnit = opts.scaleUnit2;
        let aScalar = opts.scaleUnit2 / opts.scaleUnit1;
        let bScalar = 1.0;
        let aw = a.w * aScalar;
        let ah = a.h * aScalar;
        setWHpx(a.el, aw, ah);
        let bw = b.w * bScalar;
        let bh = b.h * bScalar;
        setWHpx(b.el, bw, bh);
        let [mt, mr, mb, ml] = opts.margin;
        let mm = opts.middleMargin;
        let innerW = Math.max(aw, bw);
        let ax = mr + (innerW - aw) / 2.0;
        let ay = mt;
        setXY(a.el, ax, ay);
        let bx = mr + (innerW - bw) / 2.0;
        let by = ay + ah + mm;
        setXY(b.el, bx, by);
        let edges = [ay, ay + ah, by, by + bh];
        let w = mr + innerW + ml;
        let h = mt + ah + mm + bh + mb;
        let host = <SVGSVGElement>svg.elt("svg", {
            "version": "1.0",
            "viewBox": `0 0 ${w} ${h}`,
            "class": `sim-bb`,
        });
        setWH(host, opts.maxWidth, opts.maxHeight);
        setXY(host, 0, 0);
        let under = <SVGGElement>svg.child(host, "g");
        host.appendChild(a.el);
        host.appendChild(b.el);
        let over = <SVGGElement>svg.child(host, "g");
        let toHostCoord1 = (xy: Coord): Coord => {
            let [x, y] = xy;
            return [x * aScalar + ax, y * aScalar + ay];
        };
        let toHostCoord2 = (xy: Coord): Coord => {
            let [x, y] = xy;
            return [x * bScalar + bx, y * bScalar + by];
        };
        return {
            under: under,
            over: over,
            host: host,
            edges: edges,
            scaleUnit: scaleUnit,
            toHostCoord1: toHostCoord1,
            toHostCoord2: toHostCoord2,
        };
    }

    export function mkScaleFn(originUnit: number, targetUnit: number): (n: number) => number {
        return (n: number) => n * (targetUnit / originUnit);
    }
    export interface MkImageOpts {
        image: string,
        width: number,
        height: number,
        imageUnitDist: number,
        targetUnitDist: number
    }
    export function mkImageSVG(opts: MkImageOpts): SVGAndSize<SVGImageElement> {
        let scaleFn = mkScaleFn(opts.imageUnitDist, opts.targetUnitDist);
        let w = scaleFn(opts.width);
        let h = scaleFn(opts.height);
        let img = <SVGImageElement>svg.elt("image", {
            width: w,
            height: h
        });
        let href = img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `${opts.image}`);
        return { el: img, w: w, h: h, x: 0, y: 0 };
    }

    export function mkTxt(cx: number, cy: number, size: number, rot: number, txt: string, txtXOffFactor?: number, txtYOffFactor?: number): SVGTextElement {
        let el = <SVGTextElement>svg.elt("text")
        //HACK: these constants (txtXOffFactor, txtYOffFactor) tweak the way this algorithm knows how to center the text
        txtXOffFactor = txtXOffFactor || -0.33333;
        txtYOffFactor = txtYOffFactor || 0.3;
        const xOff = txtXOffFactor * size * txt.length;
        const yOff = txtYOffFactor * size;
        svg.hydrate(el, {
            style: `font-size:${size}px;`,
            transform: `translate(${cx} ${cy}) rotate(${rot}) translate(${xOff} ${yOff})`
        });
        pxsim.U.addClass(el, "noselect");
        el.textContent = txt;
        return el;
    }

    export interface SVGAndSize<T extends SVGElement> {
        el: T,
        y: number,
        x: number,
        w: number,
        h: number
    };
    export type SVGElAndSize = SVGAndSize<SVGElement>;

    export const PIN_DIST = 15;

    export interface BoardView {
        getView(): SVGAndSize<SVGSVGElement>;
        getCoord(pinNm: string): Coord;
        getPinDist(): number;
        highlightPin(pinNm: string): void;
        removeEventListeners?(): void;
    }

    //expects rgb from 0,255, gives h in [0,360], s in [0, 100], l in [0, 100]
    export function rgbToHsl(rgb: [number, number, number]): [number, number, number] {
        let [r, g, b] = rgb;
        let [r$, g$, b$] = [r / 255, g / 255, b / 255];
        let cMin = Math.min(r$, g$, b$);
        let cMax = Math.max(r$, g$, b$);
        let cDelta = cMax - cMin;
        let h: number, s: number, l: number;
        let maxAndMin = cMax + cMin;

        //lum
        l = (maxAndMin / 2) * 100

        if (cDelta === 0)
            s = h = 0;
        else {
            //hue
            if (cMax === r$)
                h = 60 * (((g$ - b$) / cDelta) % 6);
            else if (cMax === g$)
                h = 60 * (((b$ - r$) / cDelta) + 2);
            else if (cMax === b$)
                h = 60 * (((r$ - g$) / cDelta) + 4);

            //sat
            if (l > 50)
                s = 100 * (cDelta / (2 - maxAndMin));
            else
                s = 100 * (cDelta / maxAndMin);
        }

        return [Math.floor(h), Math.floor(s), Math.floor(l)];
    }
}
