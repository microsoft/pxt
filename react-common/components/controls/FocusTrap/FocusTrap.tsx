import * as React from "react";
import { classList, nodeListToArray, findNextFocusableElement, focusLastActive } from "../../util";
import { addRegion, FocusTrapProvider, removeRegion, useFocusTrapDispatch, useFocusTrapState } from "./context";
import { useId } from "../../../hooks/useId";

export interface FocusTrapProps extends React.PropsWithChildren<{}> {
    onEscape: () => void;
    id?: string;
    className?: string;
    arrowKeyNavigation?: boolean;
    dontStealFocus?: boolean;
    includeOutsideTabOrder?: boolean;
    dontRestoreFocus?: boolean;
}

export const FocusTrap = (props: FocusTrapProps) => {
    return (
        <FocusTrapProvider>
            <FocusTrapInner {...props} />
        </FocusTrapProvider>
    );
}

const FocusTrapInner = (props: FocusTrapProps) => {
    const {
        children,
        id,
        className,
        onEscape,
        arrowKeyNavigation,
        dontStealFocus,
        includeOutsideTabOrder,
        dontRestoreFocus
    } = props;

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const previouslyFocused = React.useRef<Element>(document.activeElement);
    const [stoleFocus, setStoleFocus] = React.useState(false);
    const lastValidTabElement = React.useRef<HTMLElement | null>(null);

    const { regions } = useFocusTrapState();

    React.useEffect(() => {
        return () => {
            if (!dontRestoreFocus && previouslyFocused.current) {
                focusLastActive(previouslyFocused.current as HTMLElement)
            }
        }
    }, [])

    const getElements = React.useCallback(() => {
        let all = nodeListToArray(
            includeOutsideTabOrder ? containerRef.current?.querySelectorAll(`[tabindex]`) :
            containerRef.current?.querySelectorAll(`[tabindex]:not([tabindex="-1"])`)
        );

        if (regions.length) {
            const regionElements: pxt.Map<Element> = {};

            for (const region of regions) {
                const el = containerRef.current?.querySelector(`[data-focus-trap-region="${region.id}"]`);

                if (el) {
                    regionElements[region.id] = el;
                }
            }

            for (const region of regions) {
                const regionElement = regionElements[region.id];
                if (!region.enabled && regionElement) {
                    all = all.filter(el => !regionElement.contains(el));
                }
            }

            const initialOrder = all.slice();
            all.sort((a, b) => {
                const aRegion = regions.find(r => r.enabled && regionElements[r.id]?.contains(a));
                const bRegion = regions.find(r => r.enabled && regionElements[r.id]?.contains(b));

                if (aRegion?.order === bRegion?.order) {
                    const aIndex = initialOrder.indexOf(a);
                    const bIndex = initialOrder.indexOf(b);
                    return aIndex - bIndex;
                }
                else if (!aRegion) {
                    return 1;
                }
                else if (!bRegion) {
                    return -1;
                }
                else {
                    return aRegion.order - bRegion.order;
                }
            });
        }

        return all as HTMLElement[];
    }, [regions, includeOutsideTabOrder]);

    const handleRef = React.useCallback((ref: HTMLDivElement) => {
        if (!ref) return;
        containerRef.current = ref;

        if (!dontStealFocus && !stoleFocus && !ref.contains(document.activeElement) && getElements().length) {
            containerRef.current.focus();

            // Only steal focus once
            setStoleFocus(true);
        }
    }, [getElements, dontStealFocus, stoleFocus]);

    const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (!containerRef.current) return;

        const moveFocus = (forward: boolean, goToEnd: boolean) => {
            const focusable = getElements();

            if (!focusable.length) return;

            let index = focusable.indexOf(e.target as HTMLElement);
            if (index < 0) {
                // If we have arrived at a non-indexed focusable, it's probably
                // been triggered by a calling focus() on an element with
                // tabindex=-1, from the last focusable element, so try to use
                // that.
                index = focusable.indexOf(lastValidTabElement.current);
            }

            let nextFocusableElement;
            if (forward) {
                if (goToEnd) {
                    nextFocusableElement = findNextFocusableElement(focusable, index, focusable.length - 1, forward);
                }
                else if (index === focusable.length - 1) {
                    nextFocusableElement = findNextFocusableElement(focusable, index, 0, forward);
                }
                else {
                    nextFocusableElement = findNextFocusableElement(focusable, index, index + 1, forward);
                }
            }
            else {
                if (goToEnd) {
                    nextFocusableElement = findNextFocusableElement(focusable, index, 0, forward);
                }
                else if (index === 0) {
                    nextFocusableElement = findNextFocusableElement(focusable, index, focusable.length - 1, forward);
                }
                else {
                    nextFocusableElement = findNextFocusableElement(focusable, index, Math.max(index - 1, 0), forward);
                }
            }
            lastValidTabElement.current = nextFocusableElement;
            nextFocusableElement.focus();

            e.preventDefault();
            e.stopPropagation();
        }

        if (e.key === "Escape") {
            let foundHandler = false;
            if (regions.length) {
                for (const region of regions) {
                    if (!region.onEscape) continue;
                    const regionElement = containerRef.current?.querySelector(`[data-focus-trap-region="${region.id}"]`);
                    if (regionElement?.contains(document.activeElement)) {
                        foundHandler = true;
                        region.onEscape();
                        break;
                    }
                }
            }
            if (!foundHandler) {
                onEscape();
            }
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
    }, [getElements, onEscape, arrowKeyNavigation, regions])

    return(
        <div id={id}
            className={classList("common-focus-trap", className)}
            ref={handleRef}
            onKeyDown={onKeyDown}
            tabIndex={-1}>
            {children}
        </div>
    );
}



interface FocusTrapRegionProps extends React.PropsWithChildren<{}> {
    enabled: boolean;
    order?: number;
    onEscape?: () => void;
    id?: string;
    className?: string;
    divRef?: (ref: HTMLDivElement) => void;
}

export const FocusTrapRegion = (props: FocusTrapRegionProps) => {
    const {
        className,
        id,
        onEscape,
        order,
        enabled,
        children,
        divRef
    } = props;

    const regionId = useId();
    const dispatch = useFocusTrapDispatch();

    React.useEffect(() => {
        dispatch(addRegion(regionId, order, enabled, onEscape));

        return () => dispatch(removeRegion(regionId));
    }, [regionId, enabled, order])

    return (
        <div
            id={id}
            className={className}
            data-focus-trap-region={regionId}
            tabIndex={-1}
            ref={divRef}
        >
            {children}
        </div>
    )
}