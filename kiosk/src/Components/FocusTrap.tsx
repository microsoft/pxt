import * as React from "react";
import { classList, nodeListToArray } from "../Utils";
import { useClickedOutside } from "../Hooks";

export interface FocusTrapProps extends React.PropsWithChildren<{}> {
    id?: string;
    className?: string;
    includeOutsideTabOrder?: boolean;
}

export const FocusTrap = (props: FocusTrapProps) => {
    const { children, id, className, includeOutsideTabOrder } = props;

    const [container, setContainer] = React.useState<HTMLElement | null>(null);

    const [stoleFocus, setStoleFocus] = React.useState(false);

    const getElements = React.useCallback(() => {
        if (!container) return [];
        return nodeListToArray(
            includeOutsideTabOrder
                ? container.querySelectorAll(`[tabindex]`)
                : container.querySelectorAll(`[tabindex]:not([tabindex="-1"])`)
        ).map(v => v as HTMLElement);
    }, [container]);

    const handleRef = React.useCallback((ref: HTMLDivElement) => {
        if (!ref) return;
        setContainer(ref);

        if (
            !stoleFocus &&
            !ref.contains(document.activeElement) &&
            getElements().length
        ) {
            ref.focus();

            // Only steal focus once
            setStoleFocus(true);
        }
    }, []);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!container) return;

        const moveFocus = (forward: boolean, goToEnd: boolean) => {
            const focusable = getElements();

            if (!focusable.length) return;

            const index = focusable.indexOf(e.target as HTMLElement);

            if (forward) {
                if (goToEnd) {
                    focusable[focusable.length - 1].focus();
                } else if (index === focusable.length - 1) {
                    focusable[0].focus();
                } else {
                    focusable[index + 1].focus();
                }
            } else {
                if (goToEnd) {
                    focusable[0].focus();
                } else if (index === 0) {
                    focusable[focusable.length - 1].focus();
                } else {
                    focusable[Math.max(index - 1, 0)].focus();
                }
            }

            e.preventDefault();
            e.stopPropagation();
        };

        if (e.key === "Tab") {
            if (e.shiftKey) moveFocus(false, false);
            else moveFocus(true, false);
        }
    };

    return (
        <div
            id={id}
            className={classList("focus-trap", className)}
            ref={handleRef}
            onKeyDown={onKeyDown}
            tabIndex={-1}
        >
            {children}
        </div>
    );
};
