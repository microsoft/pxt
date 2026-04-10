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

export function findNextFocusableElement(elements: HTMLElement[], focusedIndex: number, index: number, forward: boolean, filter?: (e: HTMLElement) => boolean): HTMLElement {
    const increment = forward ? 1 : -1;
    const element = elements[index];
    // in this case, there are no focusable elements
    if (focusedIndex === index) {
        return element;
    }
    if (filter ? filter(element) : isVisible(element)) {
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
    return findNextFocusableElement(elements, focusedIndex, index, forward, filter);
}

export function getFocusableDescendants(container: Element): Element[] {
    return getVisibleDescendants(container, isFocusableIfVisible);
}

export function getTabbableDescendants(container: Element): Element[] {
    return getVisibleDescendants(container, isTabbableIfVisible);
}

export function getVisibleDescendants(container: Element, filter: (e: Element) => boolean): Element[] {
    if (!isVisible(container)) {
        return [];
    }

    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_ELEMENT,
        node => {
            // If not visible, don't bother walking the subtree
            if (!isVisible(node as Element, false)) {
                return NodeFilter.FILTER_REJECT;
            }
            return filter(node as Element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
    );

    const elements: Element[] = [];
    let currentNode: Node | null = walker.nextNode();
    while (currentNode) {
        elements.push(currentNode as Element);
        currentNode = walker.nextNode();
    }
    return elements;
}

function isVisible(e: Element, checkParent = true): boolean {
    if ((e as any).checkVisibility) {
        return (e as any).checkVisibility({ visibilityProperty: true });
    }
    const style = getComputedStyle(e);
    if (style.display === "none" || style.visibility === "hidden") {
        return false;
    }

    if (checkParent && e.parentElement) {
        return isVisible(e.parentElement, checkParent);
    }
    return true;
}

export function isFocusable(e: Element) {
    return isFocusableIfVisible(e) && isVisible(e);
}

function isFocusableIfVisible(e: Element) {
    if (isDisabled(e)) return false;

    // There are some edge cases here like <summary> elements and
    // span elements with the `user-modify` attribute but we don't use
    // those anyway. This should cover the vast majority
    if (
        e.hasAttribute("tabindex") ||
        (e.tagName === "A" && (e.hasAttribute("href") || e.hasAttributeNS("xlink", "href"))) ||
        e.tagName === "BUTTON" ||
        e.tagName === "INPUT" ||
        e.tagName === "SELECT" ||
        e.tagName === "TEXTAREA" ||
        e.tagName === "IFRAME" ||
        e.tagName === "EMBED" ||
        e.tagName === "OBJECT" ||
        (e.tagName === "DIV" && e.hasAttribute("contenteditable") && e.getAttribute("contenteditable") !== "false") ||
        ((e.tagName === "AUDIO" || e.tagName === "VIDEO") && e.hasAttribute("controls"))
    ) {
        return true;
    }

    return false;
}


export function isDisabled(e: Element) {
    if (e) {
        if (e.hasAttribute("disabled")) return true;
    }
    return false;
}

export function isTabbable(e: Element) {
    return isTabbableIfVisible(e) && isVisible(e);
}

function isTabbableIfVisible(e: Element) {
    if (isFocusableIfVisible(e)) {
        if (e.hasAttribute("tabindex")) {
            return parseInt(e.getAttribute("tabindex")!) >= 0;
        }
        return true;
    }
    return false;
}

export function focusLastActive(el: HTMLElement) {
    while (el && !isFocusable(el)) {
        const toFocusParent = el.parentElement;
        if (toFocusParent) {
            el = toFocusParent;
        } else {
            break;
        }
    }
    el.focus();
}