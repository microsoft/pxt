import * as React from "react";
import { classList, nodeListToArray } from "../util";

export interface FocusTrapProps extends React.PropsWithChildren<{}> {
    onEscape: () => void;
    className?: string;
    arrowKeyNavigation?: boolean;
}

export const FocusTrap = (props: FocusTrapProps) => {
    const {
        children,
        className,
        onEscape,
        arrowKeyNavigation
    } = props;

    let container: HTMLDivElement;

    const handleRef = (ref: HTMLDivElement) => {
        if (!ref) return;
        container = ref;

        if (!ref.contains(document.activeElement)) {
            container.focus();
        }
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!container) return;

        const moveFocus = (forward: boolean, goToEnd: boolean) => {
            const focusable = nodeListToArray(container.querySelectorAll(`[tabindex]:not([tabindex="-1"])`)) as HTMLElement[];

            const index = focusable.indexOf(e.target as HTMLElement);

            if (forward) {
                if (goToEnd) {
                    focusable[focusable.length - 1].focus();
                }
                else if (index === focusable.length - 1) {
                    focusable[0].focus();
                }
                else {
                    focusable[index + 1].focus();
                }
            }
            else {
                if (goToEnd) {
                    focusable[0].focus();
                }
                else if (index === 0) {
                    focusable[focusable.length - 1].focus();
                }
                else {
                    focusable[Math.max(index - 1, 0)].focus();
                }
            }

            e.preventDefault();
            e.stopPropagation();
        }

        if (e.key === "Escape") {
            onEscape();
            e.preventDefault();
            e.stopPropagation();
        }
        else  if (e.key === "Tab") {
            if (e.shiftKey) moveFocus(false, false);
            else moveFocus(true, false);
        }
        else if (arrowKeyNavigation) {
            if (e.key === "ArrowDown") {
                moveFocus(true, false);
            }
            else if (e.key === "ArrowUp") {
                moveFocus(false, false);
            }
            else if (e.key === "Home") {
                moveFocus(false, true);
            }
            else if (e.key === "End") {
                moveFocus(true, true);
            }
        }
    }

    return <div className={classList("common-focus-trap", className)} ref={handleRef} onKeyDown={onKeyDown} tabIndex={-1}>
        {children}
    </div>
}