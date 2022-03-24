import * as React from "react";

export interface ControlProps {
    id?: string;
    className?: string;
    ariaLabel?: string;
    ariaHidden?: boolean;
    ariaDescribedBy?: string;
    role?: string;
}

export interface ContainerProps extends React.PropsWithChildren<ControlProps> {
}

export function jsxLF(loc: string, ...rest: JSX.Element[]) {
    const indices: number[] = [];

    loc.replace(/\{\d\}/g, match => {
        indices.push(parseInt(match.substr(1, 1)));
        return match;
    });

    const out: JSX.Element[] = [];

    let parts: string[];

    let i = 0;

    for (const index of indices) {
        parts = loc.split(`{${index}}`);
        pxt.U.assert(parts.length === 2);
        out.push(<span key={i++}>{parts[0]}</span>);
        out.push(<span key={i++}>{rest[index]}</span>);
        loc = parts[1]
    }
    out.push(<span key={i++}>{loc}</span>);

    return out;
}

export function fireClickOnEnter(e: React.KeyboardEvent<HTMLElement>) {
    const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
    if (charCode === 13 /* enter */ || charCode === 32 /* space */) {
        e.preventDefault();
        e.currentTarget.click();
    }
}

export function classList(...classes: string[]) {
    return classes
        .filter(c => typeof c === "string")
        .reduce((prev, c) => prev.concat(c.split(" ")), [] as string[])
        .map(c => c.trim())
        .filter(c => !!c)
        .join(" ");
}

export function nodeListToArray<U extends Node>(list: NodeListOf<U>): U[] {
    const out: U[] = [];

    for (const node of list) {
        out.push(node);
    }
    return out;
}

export enum CheckboxStatus {
    Selected,
    Unselected,
    Waiting
}

export const DRAG_RADIUS = 3;

export function hasPointerEvents(): boolean {
    return typeof window != "undefined" && !!(window as any).PointerEvent;
}

export function isTouchEnabled(): boolean {
    return typeof window !== "undefined" &&
        ('ontouchstart' in window                              // works on most browsers
            || (navigator && navigator.maxTouchPoints > 0));       // works on IE10/11 and Surface);
}

export interface ClientCoordinates {
    clientX: number;
    clientY: number;
}

export function clientCoord(ev: PointerEvent | MouseEvent | TouchEvent): ClientCoordinates {
    if ((ev as TouchEvent).touches) {
        const te = ev as TouchEvent;
        if (te.touches.length) {
            return te.touches[0];
        }
        return te.changedTouches[0];
    }
    return (ev as PointerEvent | MouseEvent);
}

export interface GestureTarget {
    onClick(coord: ClientCoordinates, isRightClick?: boolean): void;
    onDragStart(coord: ClientCoordinates, isRightClick?: boolean): void;
    onDragMove(coord: ClientCoordinates): void;
    onDragEnd(coord: ClientCoordinates): void;
}

export class GestureState {
    startX: number;
    startY: number;

    currentX: number;
    currentY: number;

    isDrag: boolean;

    constructor(protected target: GestureTarget, coord: ClientCoordinates, public isRightClick: boolean) {
        this.startX = coord.clientX;
        this.startY = coord.clientY;

        this.currentX = coord.clientX;
        this.currentY = coord.clientY;
    }

    update(coord: ClientCoordinates) {
        this.currentX = coord.clientX;
        this.currentY = coord.clientY;

        if (!this.isDrag && this.distance() > DRAG_RADIUS) {
            this.isDrag = true;
            this.target.onDragStart(coord, this.isRightClick);
        }
        else if (this.isDrag) {
            this.target.onDragMove(coord);
        }
    }

    end(coord?: ClientCoordinates) {
        if (coord) {
            this.update(coord);
        }

        coord = coord || { clientX: this.currentX, clientY: this.currentY };

        if (this.isDrag) {
            this.target.onDragEnd(coord);
        }
        else {
            this.target.onClick(coord, this.isRightClick);
        }
    }

    distance() {
        return Math.sqrt(Math.pow(this.currentX - this.startX, 2) + Math.pow(this.currentY - this.startY, 2));
    }
}

export function bindGestureEvents(el: HTMLElement, target: GestureTarget) {
    if (hasPointerEvents()) {
        bindPointerEvents(el, target);
    }
    else if (isTouchEnabled()) {
        bindTouchEvents(el, target);
    }
    else {
        bindMouseEvents(el, target);
    }
}

function bindPointerEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;

    el.onpointerup = ev => {
        if (state) {
            state.end(clientCoord(ev));
            ev.preventDefault();
        }
        state = undefined;
    };

    el.onpointerdown = ev => {
        if (state) state.end();

        state = new GestureState(target, clientCoord(ev), isRightClick(ev));
        ev.preventDefault();
    };

    el.onpointermove = ev => {
        if (state) {
            state.update(clientCoord(ev));
            ev.preventDefault();
        }
    };

    el.onpointerleave = ev => {
        if (state) {
            state.end(clientCoord(ev));
            ev.preventDefault();
        }
        state = undefined;
    };
}

function bindMouseEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;

    el.onmouseup = ev => {
        if (state) state.end(clientCoord(ev));
        state = undefined;
    };

    el.onmousedown = ev => {
        if (state) state.end();

        state = new GestureState(target, clientCoord(ev), isRightClick(ev));
    };

    el.onmousemove = ev => {
        if (state) state.update(clientCoord(ev));
    };

    el.onmouseleave = ev => {
        if (state) state.end(clientCoord(ev));
        state = undefined;
    };
}

function bindTouchEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;
    let touchIdentifier: number | undefined;

    el.ontouchend = ev => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.end(touch);
                state = undefined;
                ev.preventDefault();
            }
        }
    };

    el.ontouchstart = ev => {
        if (state) state.end();

        touchIdentifier = ev.changedTouches[0].identifier;
        state = new GestureState(target, ev.changedTouches[0], isRightClick(ev));
    };

    el.ontouchmove = ev => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.update(touch);
                ev.preventDefault();
            }
        }
    };

    el.ontouchcancel = ev => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.end(touch);
                state = undefined;
                ev.preventDefault();
            }
        }
    };
}

function getTouch(ev: TouchEvent, identifier: number) {
    for (let i = 0; i < ev.changedTouches.length; i++) {
        if (ev.changedTouches[i].identifier === identifier) {
            return ev.changedTouches[i];
        }
    }

    return undefined;
}

function isRightClick(ev: MouseEvent | PointerEvent | TouchEvent) {
    if ((ev as MouseEvent | PointerEvent).button > 0) return true;
    return false;
}

export function screenToSVGCoord(ref: SVGSVGElement, coord: ClientCoordinates) {
    const screenCoord = ref.createSVGPoint();
    screenCoord.x = coord.clientX;
    screenCoord.y = coord.clientY;
    return screenCoord.matrixTransform(ref.getScreenCTM().inverse());
}