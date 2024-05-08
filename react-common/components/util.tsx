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

export function classList(...classes: (string | undefined)[]) {
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

export function screenToSVGCoord(ref: SVGSVGElement, coord: ClientCoordinates) {
    const screenCoord = ref.createSVGPoint();
    screenCoord.x = coord.clientX;
    screenCoord.y = coord.clientY;
    return screenCoord.matrixTransform(ref.getScreenCTM().inverse());
}

export function findNextFocusableElement(elements: HTMLElement[], focusedIndex: number, index: number, forward: boolean): HTMLElement {
    const increment = forward ? 1 : -1;
    const element = elements[index];
    // in this case, there are no focusable elements
    if (focusedIndex === index) {
        return element;
    }
    if (getComputedStyle(element).display !== "none") {
        return element;
    } else {
        if (index + increment >= elements.length) {
            index = 0;
        } else if (index + increment < 0) {
            index = elements.length - 1;
        } else {
            index += increment;
        }
    }
    return findNextFocusableElement(elements, focusedIndex, index, forward);
}