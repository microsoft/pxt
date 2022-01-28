import * as React from "react";
import { classList, ContainerProps } from "../util";

export interface MenuBarProps extends ContainerProps {
}

export const MenuBar = (props: MenuBarProps) => {
    const {
        id,
        className,
        role,
        ariaHidden,
        ariaLabel,
        children
    } = props;

    let focusableElements: HTMLElement[];
    let menubar: HTMLDivElement;

    const handleRef = (ref: HTMLDivElement) => {
        if (!ref || menubar) return;

        menubar = ref;

        const focusable = ref.querySelectorAll(`[tabindex]:not([tabindex="-1"]),[data-isfocusable]`);
        focusableElements = [];

        for (const element of focusable.values()) {
            focusableElements.push(element as HTMLElement);

            // Remove them from the tab order, menu items are navigable using the arrow keys
            element.setAttribute("tabindex", "-1");
            element.setAttribute("data-isfocusable", "true");
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if  (!focusableElements?.length) return;

        const target = document.activeElement as HTMLElement;
        const index = focusableElements.indexOf(target);

        if (index === -1 && target !== menubar) return;

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
        else if (e.key === "ArrowRight") {
            if (index === focusableElements.length - 1 || target === menubar) {
                focusableElements[0].focus();
            }
            else {
                focusableElements[index + 1].focus();
            }
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "ArrowLeft") {
            if (index === 0 || target === menubar) {
                focusableElements[focusableElements.length - 1].focus();
            }
            else {
                focusableElements[Math.max(index - 1, 0)].focus();
            }
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "Home") {
            focusableElements[0].focus();
            e.preventDefault();
            e.stopPropagation();
        }
        else if (e.key === "End") {
            focusableElements[focusableElements.length - 1].focus();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    return (
        <div id={id}
            className={classList("common-menubar", className)}
            role={role || "menubar"}
            tabIndex={0}
            onKeyDown={onKeyDown}
            ref={handleRef}
            aria-hidden={ariaHidden}
            aria-label={ariaLabel}>
            {children}
        </div>
    );
}