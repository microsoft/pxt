import * as React from "react";
import { ContainerProps } from "../util";

export interface FocusListProps extends ContainerProps {
    role: string;
    childTabStopId?: string;
    useUpAndDownArrowKeys?: boolean;
    onItemReceivedFocus?: (item: HTMLElement) => void;
}

/**
 * A list of focusable items that represents a single tab stop in the tab order. The
 * children of the list can be navigated between using the arrow keys. Any child with
 * a tabindex other than -1 will be included in the list.
 *
 * If childTabStopId is specified, then the tab stop will be placed on the child with
 * the given id instead of the outer div.
 */
export const FocusList = (props: FocusListProps) => {
    const {
        id,
        className,
        role,
        ariaHidden,
        ariaLabel,
        childTabStopId,
        children,
        onItemReceivedFocus,
        useUpAndDownArrowKeys
    } = props;

    let focusableElements: HTMLElement[];
    let focusList: HTMLDivElement;

    const handleRef = (ref: HTMLDivElement) => {
        if (!ref || focusList) return;

        focusList = ref;

        const focusable = ref.querySelectorAll(`[tabindex]:not([tabindex="-1"]),[data-isfocusable]`);
        focusableElements = [];

        for (const element of focusable.values()) {
            focusableElements.push(element as HTMLElement);

            // Remove them from the tab order, menu items are navigable using the arrow keys
            element.setAttribute("tabindex", "-1");
            element.setAttribute("data-isfocusable", "true");
        }

        if (childTabStopId) {
            const childTabStop = focusList.querySelector("#" + childTabStopId);

            if (childTabStop) {
                childTabStop.setAttribute("tabindex", "0");
            }
        }
    }

    const isFocusable = (e: HTMLElement) => {
        return e.getAttribute("data-isfocusable") === "true"
            && getComputedStyle(e).display !== "none";
    }

    const firstFocusableElement = () => {
        return focusableElements.find(e => isFocusable(e))
    }

    const lastFocusableElement = () => {
        for (let i = 0; i < focusableElements.length; i++) {
            if (isFocusable(focusableElements[focusableElements.length - 1 - i])) {
                return focusableElements[focusableElements.length - 1 - i];
            }
        }

        return focusableElements[0];
    }

    const nextFocusableElement = (index: number, forwards: boolean) => {
        let current: HTMLElement
        for (let i = 1; i < focusableElements.length; i++) {
            if (forwards) {
                current = focusableElements[(index + i) % focusableElements.length];
            }
            else {
                current = focusableElements[(index + focusableElements.length - i) % focusableElements.length];
            }

            if (isFocusable(current)) {
                return current;
            }
        }
        return focusableElements[0];
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if  (!focusableElements?.length) return;

        const target = document.activeElement as HTMLElement;
        const index = focusableElements.indexOf(target);

        const focus = (element: HTMLElement) => {
            element.focus();
            if (onItemReceivedFocus) onItemReceivedFocus(element);
        }

        if (index === -1 && target !== focusList) return;

        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();

            if (target.click) {
                target.click();
            }
            else {
                // SVG Elements
                target.dispatchEvent(new Event("click"));
            }
        }
        else if (e.key === (useUpAndDownArrowKeys ? "ArrowDown" : "ArrowRight")) {
            if (index === focusableElements.length - 1 || target === focusList) {
                focus(firstFocusableElement());
            }
            else {
                focus(nextFocusableElement(index, true));
            }
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === (useUpAndDownArrowKeys ? "ArrowUp" : "ArrowLeft")) {
            if (index === 0 || target === focusList) {
                focus(lastFocusableElement());
            }
            else {
                focus(nextFocusableElement(index, false));
            }
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "Home") {
            focus(firstFocusableElement());
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "End") {
            focus(lastFocusableElement());
            e.preventDefault();
            e.stopPropagation();
        }
    }

    return (
        <div id={id}
            className={className}
            role={role}
            tabIndex={childTabStopId ? undefined : 0}
            onKeyDown={onKeyDown}
            ref={handleRef}
            aria-hidden={ariaHidden}
            aria-label={ariaLabel}>
            {children}
        </div>
    );
}