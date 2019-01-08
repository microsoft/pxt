namespace pxt.svgUtil {
    export type Map<T> = {
        [index: string]: T;
    };

    export type PointerHandler = () => void;

    export enum PatternUnits {
        userSpaceOnUse = 0,
        objectBoundingBox = 1,
    }

    export enum LengthUnit {
        em,
        ex,
        px,
        in,
        cm,
        mm,
        pt,
        pc,
        percent
    }

    const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

    export class BaseElement<T extends SVGElement> {
        el: T;
        protected titleElement: SVGTitleElement;
        constructor(type: string) {
            this.el = elt(type) as T;
        }
        attr(attributes: Map<string | number | boolean>): this {
            Object.keys(attributes).forEach(at => {
                this.setAttribute(at, attributes[at]);
            });
            return this;
        }

        setAttribute(name: string, value: string | number | boolean): this {
            this.el.setAttribute(name, value.toString());
            return this;
        }

        setAttributeNS(ns: string, name: string, value: string | number | boolean): this {
            this.el.setAttributeNS(ns, name, value.toString());
            return this;
        }

        id(id: string): this {
            return this.setAttribute("id", id);
        }

        setClass(...classes: string[]): this {
            return this.setAttribute("class", classes.join(" "));
        }

        appendClass(className: string): this {
            addClass(this.el, className);
            return this;
        }

        removeClass(className: string): void {
            removeClass(this.el, className);
        }

        title(text: string) {
            if (!this.titleElement) {
                this.titleElement = elt("title");

                // Title has to be the first child in the DOM
                if (this.el.firstChild) {
                    this.el.insertBefore(this.titleElement, this.el.firstChild)
                }
                else {
                    this.el.appendChild(this.titleElement);
                }
            }
            this.titleElement.textContent = text;
        }

        setVisible(visible: boolean): this {
            return this.setAttribute("visibility", visible ? "visible" : "hidden");
        }
    }

    export class DrawContext<T extends SVGElement> extends BaseElement<T> {
        draw(type: "text"): Text;
        draw(type: "circle"): Circle;
        draw(type: "rect"): Rect;
        draw(type: "line"): Line;
        draw(type: "polygon"): Polygon;
        draw(type: "polyline"): Polyline;
        draw(type: "path"): Path;
        draw(type: string): Drawable<SVGElement> {
            const el = drawable(type as any /*FIXME?*/);
            this.el.appendChild(el.el);
            return el;
        }

        element(type: "text", cb: (newElement: Text) => void): this;
        element(type: "circle", cb: (newElement: Circle) => void): this;
        element(type: "rect", cb: (newElement: Rect) => void): this;
        element(type: "line", cb: (newElement: Line) => void): this;
        element(type: "polygon", cb: (newElement: Polygon) => void): this;
        element(type: "polyline", cb: (newElement: Polyline) => void): this;
        element(type: "path", cb: (newElement: Path) => void): this;
        element(type: string, cb: (newElement: any) => void): this {
            cb(this.draw(type as any /*FIXME?*/));
            return this;
        }

        group(): Group {
            const g = new Group();
            this.el.appendChild(g.el);
            return g;
        }

        appendChild<T extends SVGElement>(child: BaseElement<T>): void {
            this.el.appendChild(child.el);
        }

        onDown(handler: PointerHandler): this {
            events.down(this.el, handler);
            return this;
        }

        onUp(handler: PointerHandler): this {
            events.up(this.el, handler);
            return this;
        }

        onMove(handler: PointerHandler): this {
            events.move(this.el, handler);
            return this;
        }

        onEnter(handler: (isDown: boolean) => void): this {
            events.enter(this.el, handler);
            return this;
        }

        onLeave(handler: PointerHandler): this {
            events.leave(this.el, handler);
            return this;
        }

        onClick(handler: PointerHandler): this {
            events.click(this.el, handler);
            return this;
        }
    }

    export class SVG extends DrawContext<SVGSVGElement> {
        defs: DefsElement;
        constructor(parent?: Element) {
            super("svg");
            if (parent) {
                parent.appendChild(this.el);
            }
        }

        define(cb: (defs: DefsElement) => void): this {
            if (!this.defs) {
                this.defs = new DefsElement(this.el);
            }
            cb(this.defs);
            return this;
        }
    }

    export class Group extends DrawContext<SVGGElement> {
        top: number;
        left: number;
        scaleFactor: number;

        constructor(parent?: SVGElement) {
            super("g");
            if (parent) {
                parent.appendChild(this.el);
            }
        }

        translate(x: number, y: number): this {
            this.left = x;
            this.top = y;
            return this.updateTransform();
        }

        scale(factor: number): this {
            this.scaleFactor = factor;
            return this.updateTransform();
        }

        def() {
            return new DefsElement(this.el);
        }

        style() {
            return new StyleElement(this.el);
        }

        private updateTransform(): this {
            let transform = "";
            if (this.left != undefined) {
                transform += `translate(${this.left} ${this.top})`
            }
            if (this.scaleFactor != undefined) {
                transform += ` scale(${this.scaleFactor})`
            }
            this.setAttribute("transform", transform);
            return this;
        }
    }

    export class Pattern extends DrawContext<SVGPatternElement> {
        constructor() {
            super("pattern");
        }

        units(kind: PatternUnits): this {
            return this.setAttribute("patternUnits", kind === PatternUnits.objectBoundingBox ? "objectBoundingBox" : "userSpaceOnUse")
        }

        contentUnits(kind: PatternUnits): this {
            return this.setAttribute("patternContentUnits", kind === PatternUnits.objectBoundingBox ? "objectBoundingBox" : "userSpaceOnUse")
        }

        size(width: number, height: number): this {
            this.setAttribute("width", width);
            this.setAttribute("height", height);
            return this;
        }
    }

    export class DefsElement extends BaseElement<SVGDefsElement> {
        constructor(parent: SVGElement) {
            super("defs");
            parent.appendChild(this.el);
        }

        create(type: "path", id: string): Path;
        create(type: "pattern", id: string): Pattern;
        create(type: "radialGradient", id: string): RadialGradient;
        create(type: "linearGradient", id: string): LinearGradient;
        create(type: "clipPath", id: string): ClipPath;
        create(type: string, id: string): BaseElement<any> {
            let el: BaseElement<SVGElement>;
            switch (type) {
                case "path": el = new Path(); break;
                case "pattern": el = new Pattern(); break;
                case "radialGradient": el = new RadialGradient(); break;
                case "linearGradient": el = new LinearGradient(); break;
                case "clipPath": el = new ClipPath(); break;
                default: el = new BaseElement(type);
            }
            el.id(id);
            this.el.appendChild(el.el);
            return el;
        }
    }

    export class StyleElement extends BaseElement<SVGStyleElement> {
        constructor(parent: SVGElement) {
            super("style");
            parent.appendChild(this.el);
        }

        content(css: string) {
            this.el.textContent = css;
        }
    }

    export class Drawable<T extends SVGElement> extends DrawContext<T> {
        at(x: number, y: number): this {
            this.setAttribute("x", x);
            this.setAttribute("y", y);
            return this;
        }

        moveTo(x: number, y: number): this {
            return this.at(x, y);
        }

        fill(color: string, opacity?: number): this {
            this.setAttribute("fill", color);
            if (opacity != undefined) {
                this.opacity(opacity);
            }
            return this;
        }

        opacity(opacity: number): this {
            return this.setAttribute("fill-opacity", opacity);
        }

        stroke(color: string, width?: number): this {
            this.setAttribute("stroke", color);
            if (width != undefined) {
                this.strokeWidth(width);
            }
            return this;
        }

        strokeWidth(width: number): this {
            return this.setAttribute("stroke-width", width);
        }

        strokeOpacity(opacity: number): this {
            return this.setAttribute("stroke-opacity", opacity);
        }

        clipPath(url: string): this {
            return this.setAttribute("clip-path", url);
        }
    }

    export class Text extends Drawable<SVGTextElement> {
        constructor(text?: string) {
            super("text");

            if (text != undefined) {
                this.text(text);
            }
        }

        text(text: string): this {
            this.el.textContent = text;
            return this;
        }

        fontFamily(family: string) {
            return this.setAttribute("font-family", family);
        }

        fontSize(size: number, units: LengthUnit) {
            return this.setAttribute("font-size", lengthWithUnits(size, units));
        }

        offset(dx: number, dy: number, units: LengthUnit) {
            if (dx !== 0) {
                this.setAttribute("dx", lengthWithUnits(dx, units));
            }
            if (dy !== 0) {
                this.setAttribute("dy", lengthWithUnits(dy, units));
            }
            return this;
        }

        anchor(type: "start" | "middle" | "end" | "inherit") {
            return this.setAttribute("text-anchor", type);
        }
    }

    export class Rect extends Drawable<SVGRectElement> {
        constructor() { super("rect") };

        width(width: number, unit = LengthUnit.px): this {
            return this.setAttribute("width", lengthWithUnits(width, unit));
        }

        height(height: number, unit = LengthUnit.px): this {
            return this.setAttribute("height", lengthWithUnits(height, unit));
        }

        corner(radius: number): this {
            return this.corners(radius, radius);
        }

        corners(rx: number, ry: number): this {
            this.setAttribute("rx", rx);
            this.setAttribute("ry", ry);
            return this;
        }

        size(width: number, height: number, unit = LengthUnit.px): this {
            this.width(width, unit);
            this.height(height, unit);
            return this;
        }
    }

    export class Circle extends Drawable<SVGCircleElement> {
        constructor() { super("circle"); }

        at(cx: number, cy: number): this {
            this.setAttribute("cx", cx);
            this.setAttribute("cy", cy);
            return this;
        }

        radius(r: number): this {
            return this.setAttribute("r", r);
        }
    }

    class Ellipse extends Drawable<SVGEllipseElement> {
        constructor() { super("ellipse"); }

        at(cx: number, cy: number): this {
            this.setAttribute("cx", cx);
            this.setAttribute("cy", cy);
            return this;
        }

        radius(rx: number, ry: number): this {
            this.setAttribute("rx", rx);
            this.setAttribute("ry", ry);
            return this;
        }
    }

    export class Line extends Drawable<SVGLineElement> {
        constructor() { super("line"); }

        at(x1: number, y1: number, x2?: number, y2?: number): this {
            this.from(x1, y1);
            if (x2 != undefined && y2 != undefined) {
                this.to(x2, y2);
            }
            return this;
        }

        from(x1: number, y1: number): this {
            this.setAttribute("x1", x1);
            this.setAttribute("y1", y1);
            return this;
        }

        to(x2: number, y2: number): this {
            this.setAttribute("x2", x2);
            this.setAttribute("y2", y2);
            return this;
        }
    }

    export class PolyElement<T extends SVGPolygonElement | SVGPolylineElement> extends Drawable<T> {
        points(points: string): this {
            return this.setAttribute("points", points);
        }

        with(points: {
            x: number;
            y: number;
        }[]): this {
            return this.points(points.map(({ x, y }) => x + " " + y).join(","))
        }
    }

    export class Polyline extends PolyElement<SVGPolylineElement> {
        constructor() { super("polyline") }
    }

    export class Polygon extends PolyElement<SVGPolygonElement> {
        constructor() { super("polygon") }
    }

    export class Path extends Drawable<SVGPathElement> {
        d: PathContext;

        constructor() {
            super("path");
            this.d = new PathContext();
        }

        update(): this {
            return this.setAttribute("d", this.d.toAttribute());
        }

        path(cb: (d: PathContext) => void): this {
            cb(this.d);
            return this.update();
        }
    }

    export class Image extends Drawable<SVGImageElement> {
        constructor() { super("image") }

        src(url: string) {
            return this.setAttributeNS(XLINK_NAMESPACE, "href", url);
        }

        width(width: number, unit = LengthUnit.px): this {
            return this.setAttribute("width", lengthWithUnits(width, unit));
        }

        height(height: number, unit = LengthUnit.px): this {
            return this.setAttribute("height", lengthWithUnits(height, unit));
        }

        size(width: number, height: number, unit = LengthUnit.px): this {
            this.width(width, unit);
            this.height(height, unit);
            return this;
        }
    }

    export class Gradient<T extends SVGGradientElement> extends BaseElement<T> {
        units(kind: PatternUnits): this {
            return this.setAttribute("gradientUnits", kind === PatternUnits.objectBoundingBox ? "objectBoundingBox" : "userSpaceOnUse")
        }

        stop(offset: number, color?: string, opacity?: string): this {
            const s = elt("stop");
            s.setAttribute("offset", offset + "%");
            if (color != undefined) {
                s.setAttribute("stop-color", color);
            }

            if (opacity != undefined) {
                s.setAttribute("stop-opacity", opacity);
            }

            this.el.appendChild(s);
            return this;
        }
    }

    export class LinearGradient extends Gradient<SVGLinearGradientElement> {
        constructor() { super("linearGradient"); }

        start(x1: number, y1: number): this {
            this.setAttribute("x1", x1);
            this.setAttribute("y1", y1);
            return this;
        }

        end(x2: number, y2: number): this {
            this.setAttribute("x2", x2);
            this.setAttribute("y2", y2);
            return this;
        }
    }

    export class RadialGradient extends Gradient<SVGRadialGradientElement> {
        constructor() { super("radialGradient"); }

        center(cx: number, cy: number): this {
            this.setAttribute("cx", cx);
            this.setAttribute("cy", cy);
            return this;
        }

        focus(fx: number, fy: number, fr: number): this {
            this.setAttribute("fx", fx);
            this.setAttribute("fy", fy);
            this.setAttribute("fr", fr);
            return this;
        }

        radius(r: number): this {
            return this.setAttribute("r", r);
        }
    }

    export class ClipPath extends DrawContext<SVGClipPathElement> {
        constructor() { super("clipPath") }

        clipPathUnits(objectBoundingBox: boolean) {
            if (objectBoundingBox) {
                return this.setAttribute("clipPathUnits", "objectBoundingBox");
            }
            else {
                return this.setAttribute("clipPathUnits", "userSpaceOnUse");
            }
        }
    }

    function elt(type: string): SVGElement {
        let el = document.createElementNS("http://www.w3.org/2000/svg", type);
        return el;
    }

    function drawable(type: "text"): Text;
    function drawable(type: "circle"): Circle;
    function drawable(type: "rect"): Rect;
    function drawable(type: "line"): Line;
    function drawable(type: "polygon"): Polygon;
    function drawable(type: "polyline"): Polyline;
    function drawable(type: "path"): Path;
    function drawable(type: string): Drawable<SVGElement> {
        switch (type) {
            case "text": return new Text();
            case "circle": return new Circle();
            case "rect": return new Rect();
            case "line": return new Line();
            case "polygon": return new Polygon();
            case "polyline": return new Polyline();
            case "path": return new Path();
            default: return new Drawable(type);
        }
    }

    export type OperatorSymbol = "m" | "M" | "l" | "L" | "c" | "C" | "q" | "Q" | "T" | "t" | "S" | "s" | "z" | "Z" | "A" | "a";
    export interface PathOp {
        op: OperatorSymbol;
        args: number[];
    }
    export class PathContext {
        private ops: PathOp[] = [];

        clear(): void {
            this.ops = [];
        }

        moveTo(x: number, y: number): this {
            return this.op("M", x, y);
        }

        moveBy(dx: number, dy: number): this {
            return this.op("m", dx, dy);
        }

        lineTo(x: number, y: number): this {
            return this.op("L", x, y);
        }

        lineBy(dx: number, dy: number): this {
            return this.op("l", dx, dy);
        }

        cCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
            return this.op("C", c1x, c1y, c2x, c2y, x, y);
        }

        cCurveBy(dc1x: number, dc1y: number, dc2x: number, dc2y: number, dx: number, dy: number): this {
            return this.op("c", dc1x, dc1y, dc2x, dc2y, dx, dy);
        }

        qCurveTo(cx: number, cy: number, x: number, y: number): this {
            return this.op("Q", cx, cy, x, y);
        }

        qCurveBy(dcx: number, dcy: number, dx: number, dy: number): this {
            return this.op("q", dcx, dcy, dx, dy);
        }

        sCurveTo(cx: number, cy: number, x: number, y: number): this {
            return this.op("S", cx, cy, x, y);
        }

        sCurveBy(dcx: number, dcy: number, dx: number, dy: number): this {
            return this.op("s", dcx, dcy, dx, dy);
        }

        tCurveTo(x: number, y: number): this {
            return this.op("T", x, y);
        }

        tCurveBy(dx: number, dy: number): this {
            return this.op("t", dx, dy);
        }

        arcTo(rx: number, ry: number, xRotate: number, large: boolean, sweepClockwise: boolean, x: number, y: number): this {
            return this.op("A", rx, ry, xRotate, large ? 1 : 0, sweepClockwise ? 1 : 0, x, y);
        }

        arcBy(rx: number, ry: number, xRotate: number, large: boolean, sweepClockwise: boolean, x: number, y: number): this {
            return this.op("a", rx, ry, xRotate, large ? 1 : 0, sweepClockwise ? 1 : 0, x, y);
        }

        close(): this {
            return this.op("z");
        }

        toAttribute(): string {
            return this.ops.map(op => op.op + " " + op.args.join(" ")).join(" ");
        }

        private op(op: OperatorSymbol, ...args: number[]) {
            this.ops.push({
                op,
                args
            });
            return this;
        }
    }

    function lengthWithUnits(value: number, unit: LengthUnit) {
        switch (unit) {
            case LengthUnit.em: return value + "em";
            case LengthUnit.ex: return value + "ex";
            case LengthUnit.px: return value + "px";
            case LengthUnit.in: return value + "in";
            case LengthUnit.cm: return value + "cm";
            case LengthUnit.mm: return value + "mm";
            case LengthUnit.pt: return value + "pt";
            case LengthUnit.pc: return value + "pc";
            case LengthUnit.percent: return value + "%";
            default: return value.toString();
        }
    }

    function addClass(el: SVGElement, cls: string) {
        if (el.classList) el.classList.add(cls);
        else if (el.className.baseVal.indexOf(cls) < 0) el.className.baseVal += ' ' + cls;
    }

    function removeClass(el: SVGElement, cls: string) {
        if (el.classList) el.classList.remove(cls);
        else el.className.baseVal = el.className.baseVal.replace(cls, '').replace(/\s{2,}/, ' ');
    }
}

namespace pxt.svgUtil.events {
    export function isTouchEnabled(): boolean {
        return typeof window !== "undefined" &&
            ('ontouchstart' in window                              // works on most browsers
                || (navigator && navigator.maxTouchPoints > 0));       // works on IE10/11 and Surface);
    }

    export function hasPointerEvents(): boolean {
        return typeof window != "undefined" && !!(window as any).PointerEvent;
    }

    export function down(el: SVGElement, handler: () => void) {
        if (hasPointerEvents()) {
            el.addEventListener("pointerdown", handler);
        }
        else if (isTouchEnabled()) {
            el.addEventListener("mousedown", handler);
            el.addEventListener("touchstart", handler);
        }
        else {
            el.addEventListener("mousedown", handler);
        }
    }

    export function up(el: SVGElement, handler: () => void) {
        if (hasPointerEvents()) {
            el.addEventListener("pointerup", handler);
        }
        else if (isTouchEnabled()) {
            el.addEventListener("mouseup", handler);
        }
        else {
            el.addEventListener("mouseup", handler);
        }
    }

    export function enter(el: SVGElement, handler: (isDown: boolean) => void) {
        if (hasPointerEvents()) {
            el.addEventListener("pointerover", e => {
                handler(!!(e.buttons & 1))
            });
        }
        else if (isTouchEnabled()) {
            el.addEventListener("touchstart", e => {
                handler(true);
            });
        }
        else {
            el.addEventListener("mouseover", e => {
                handler(!!(e.buttons & 1))
            });
        }
    }

    export function leave(el: SVGElement, handler: () => void) {
        if (hasPointerEvents()) {
            el.addEventListener("pointerleave", handler);
        }
        else if (isTouchEnabled()) {
            el.addEventListener("touchend", handler);
        }
        else {
            el.addEventListener("mouseleave", handler);
        }
    }

    export function move(el: SVGElement, handler: () => void) {
        if (hasPointerEvents()) {
            el.addEventListener("pointermove", handler);
        }
        else if (isTouchEnabled()) {
            el.addEventListener("touchmove", handler);
        }
        else {
            el.addEventListener("mousemove", handler);
        }
    }

    export function click(el: SVGElement, handler: () => void) {
        el.addEventListener("click", handler);
    }
}

namespace pxt.svgUtil.helpers {
    export class CenteredText extends Text {
        protected cx: number;
        protected cy: number;

        protected fontSizePixels: number;

        public at(cx: number, cy: number): this {
            this.cx = cx;
            this.cy = cy;
            this.rePosition();

            return this;
        }

        public text(text: string, fontSizePixels = 12) {
            super.text(text);
            this.fontSizePixels = fontSizePixels;
            this.setAttribute("font-size", fontSizePixels + "px");

            this.rePosition();

            return this;
        }

        protected rePosition() {
            if (this.cx == undefined || this.cy == undefined || this.fontSizePixels == undefined) {
                return;
            }

            this.setAttribute("x", this.cx);
            this.setAttribute("y", this.cy);
            this.setAttribute("text-anchor", "middle");
            this.setAttribute("alignment-baseline", "middle");
        }
    }
}