import * as RectCache from "../Services/RectCache";

const isElementVisible = (element: HTMLElement): boolean => {
    const boundingClientRect = RectCache.getCachedElementRect(element);
    return boundingClientRect.height !== 0 && boundingClientRect.width !== 0;
};

const isElementValid = (element: HTMLElement): boolean => {
    return (
        (!(element instanceof HTMLAnchorElement) ||
            element.href !== undefined) &&
        !(element instanceof HTMLIFrameElement)
    );
};

const isElementDisabled = (element: HTMLElement): boolean => {
    if (
        element instanceof HTMLButtonElement ||
        element instanceof HTMLFieldSetElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLOptGroupElement ||
        element instanceof HTMLOptionElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
    ) {
        return element.disabled;
    }

    return false;
};

export const isInteractable = (
    element: Element | undefined | null
): boolean => {
    if (!element || !(element instanceof HTMLElement)) {
        return false;
    }

    return (
        element.tabIndex >= 0 &&
        isElementVisible(element) &&
        !isElementDisabled(element) &&
        isElementValid(element)
    );
};

export const focusElement = (el: HTMLElement | null | undefined): void => {
    setTimeout(() => {
        el?.focus({ focusVisible: true, preventScroll: true } as any);
    }, 0);
};
