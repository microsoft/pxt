import { nanoid } from "nanoid";
import * as GamepadManager from "./GamepadManager";
import * as RectCache from "./RectCache";
import { debounce, nodeListToArray } from "../Utils";
import * as domUtils from "../Utils/domUtils";
import { playSoundEffect } from "./SoundEffectService";
import { NavRect } from "../Types";

export enum NavDirection {
    Up = "Up",
    Down = "Down",
    Left = "Left",
    Right = "Right",
}

const allNavDirections = () => [
    NavDirection.Up,
    NavDirection.Down,
    NavDirection.Left,
    NavDirection.Right,
];

const navGridIdentifierKey = Symbol("navGridIdentifierKey");

const isNavGridElement = (el: HTMLElement | null | undefined): boolean => {
    return !!(el && (el as any)[navGridIdentifierKey]);
};

type Navigable = {
    id: string;
    contextId: string;
    el: HTMLElement;
    exitDirections: NavDirection[];
    autofocus: boolean;
};

const makeNavigable = (
    id: string | undefined,
    contextId: string,
    el: HTMLElement,
    exitDirections: NavDirection[],
    autofocus: boolean
): Navigable => ({
    id: id ?? nanoid(),
    contextId,
    el,
    exitDirections,
    autofocus,
});

type CandidateRect = NavRect & {
    id: string;
};

type NavContext = {
    id: string;
    navigables: Map<string, Navigable>;
    activeElement: string | undefined;
    mousingElement: string | undefined;
};

const makeContext = (): NavContext => ({
    id: nanoid(),
    navigables: new Map(),
    activeElement: undefined,
    mousingElement: undefined,
});

class NavGrid {
    stack: Array<NavContext> = [makeContext()];

    get context() {
        return this.stack[this.stack.length - 1];
    }
    get navigables() {
        return this.stack[this.stack.length - 1].navigables;
    }
    get activeElement() {
        return this.context.activeElement;
    }
    set activeElement(value: string | undefined) {
        this.context.activeElement = value;
    }
    get mousingElement() {
        return this.context.mousingElement;
    }
    set mousingElement(value: string | undefined) {
        this.context.mousingElement = value;
    }

    pushContext() {
        if (this.activeElement) {
            this.navigables.get(this.activeElement)?.el.blur();
            this.mousingElement = undefined;
        }
        this.stack.push(makeContext());
    }

    popContext() {
        if (this.stack.length > 1) {
            this.context.mousingElement = undefined;
            this.context.activeElement = undefined;
            this.stack.pop();
            if (this.activeElement) {
                // Focus the previously active element
                domUtils.focusElement(this.navigables.get(this.activeElement)?.el);
            } else {
                // Focus the first autofocus element in the context
                const navs = Array.from(this.navigables.values());
                for (const navigable of navs) {
                    if (navigable.autofocus) {
                        domUtils.focusElement(navigable.el);
                        break;
                    }
                }
            }
        }
    }

    initialize() {
        GamepadManager.addKeydownListener(this.keydownHandler);
        window.addEventListener("keydown", this.window_keydownHandler);
    }

    keydownHandler = (ev: KeyboardEvent) => {
        //console.log("NavGrid.keydownHandler", ev);

        const control = GamepadManager.keyboardKeyToGamepadControl(ev.key);
        if (!control) return;

        switch (control) {
            case GamepadManager.GamepadControl.DPadUp:
                if (this.navigate(NavDirection.Up)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                break;
            case GamepadManager.GamepadControl.DPadDown:
                if (this.navigate(NavDirection.Down)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                break;
            case GamepadManager.GamepadControl.DPadLeft:
                if (this.navigate(NavDirection.Left)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                break;
            case GamepadManager.GamepadControl.DPadRight:
                if (this.navigate(NavDirection.Right)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                break;
        }
    };

    window_keydownHandler = (ev: KeyboardEvent) => {
        if (ev.key === "Tab") {
            const from = ev.target as HTMLElement;
            if (ev.shiftKey) this.moveFocus(from, false);
            else this.moveFocus(from, true);
            ev.preventDefault();
            ev.stopPropagation();
        }
    };

    isOnScreen = (el: HTMLElement) => {
        const rect = RectCache.getCachedElementRect(el);
        const viewport = {
            top: 0,
            left: 0,
            right: window.innerWidth,
            bottom: window.innerHeight,
            width: window.innerWidth,
            height: window.innerHeight,
            center: {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
            },
        };
        return (
            rect.left < viewport.right &&
            rect.right > viewport.left &&
            rect.top < viewport.bottom &&
            rect.bottom > viewport.top
        );
    };

    getFocusableElements = () => {
        const navs = Array.from(this.navigables.values());
        return nodeListToArray(
            document.querySelectorAll(`[tabindex]:not([tabindex="-1"])`)
        )
            .map(v => v as HTMLElement)
            .filter(v => navs.find(n => n.el === v) && this.isOnScreen(v));
    };

    moveFocus = (from: HTMLElement, forward: boolean) => {
        const focusable = this.getFocusableElements();

        if (!focusable.length) return;

        const index = focusable.indexOf(from);

        if (forward) {
            if (index === focusable.length - 1) {
                domUtils.focusElement(focusable[0]);
            } else {
                domUtils.focusElement(focusable[index + 1]);
            }
        } else {
            if (index === 0) {
                domUtils.focusElement(focusable[focusable.length - 1]);
            } else {
                domUtils.focusElement(focusable[Math.max(index - 1, 0)]);
            }
        }
    };

    focusHandler = (ev: FocusEvent, navigable: Navigable) => {
        if (navigable.contextId !== this.context.id) {
            // TODO: Handle this better.
            navigable.el.blur();
            ev.stopPropagation();
            return;
        }
        //console.log("NavGrid.focusHandler", navigable);
        if (ev.relatedTarget && this.mousingElement !== navigable.id) {
            // If we're switching focus and the mouse is not down on this
            // element, play a "switch" sound effect. Otherwise in most
            // instances we end up playing overlapping "switch" and "select"
            // sound effects, which isn't good.
            // **TODO**: Pass this to a focus effects service.
            playSoundEffect("switch");
        }
        this.activeElement = navigable.id;
    };

    blurHandler = (navigable: Navigable) => {
        if (navigable.contextId !== this.context.id) {
            return;
        }
        //console.log("NavGrid.blurHandler", navigable);
        if (this.activeElement === navigable.id) {
            this.activeElement = undefined;
        }
    };

    resizeHandler = (navigable: Navigable) => {
        //console.log("NavGrid.resizeHandler", navigable);
        RectCache.invalidateCacheForElement(navigable.el);
    };

    mouseDownHandler = (navigable: Navigable) => {
        if (navigable.contextId !== this.context.id) {
            return;
        }
        //console.log("NavGrid.mouseDownHandler", navigable);
        this.mousingElement = navigable.id;
    };

    mouseUpHandler = (navigable: Navigable) => {
        if (navigable.contextId !== this.context.id) {
            return;
        }
        //console.log("NavGrid.mouseUpHandler", navigable);
        if (this.mousingElement === navigable.id) {
            this.mousingElement = undefined;
        }
    };

    getNavigableForElement(el: HTMLElement | null): Navigable | undefined {
        if (!el) {
            return undefined;
        }
        const id = (el as any)[navGridIdentifierKey];
        if (!id) {
            return undefined;
        }
        return this.navigables.get(id);
    }

    registerNavigable(
        el: HTMLElement,
        opts?: {
            exitDirections?: NavDirection[];
            autofocus?: boolean;
        }
    ): () => void {
        const navId = nanoid();
        Object.defineProperty(el, navGridIdentifierKey, {
            value: navId,
            writable: false,
            enumerable: false,
            configurable: true,
        });

        const navigable: Navigable = makeNavigable(
            navId,
            this.context.id,
            el,
            opts?.exitDirections ?? [...allNavDirections()],
            opts?.autofocus ?? false
        );

        if (opts?.autofocus) {
            el.setAttribute("autofocus", "autofocus");
        }

        const onFocus = (ev: FocusEvent) => this.focusHandler(ev, navigable);
        const onBlur = () => this.blurHandler(navigable);
        const onResize = () => this.resizeHandler(navigable);
        const onMouseDown = () => this.mouseDownHandler(navigable);
        const onMouseUp = () => this.mouseUpHandler(navigable);

        el.addEventListener("focus", onFocus);
        el.addEventListener("blur", onBlur);
        el.addEventListener("mousedown", onMouseDown);
        el.addEventListener("mouseup", onMouseUp);

        const observer = new ResizeObserver(debounce(onResize, 250));
        observer.observe(el, { box: "border-box" });

        this.navigables.set(navId, navigable);

        // If this is the first navigable and it allows autofocus, focus it
        if (!this.activeElement && opts?.autofocus) {
            domUtils.focusElement(el);
        }

        //console.log("NavGrid.registerNavigable", navigable);

        return () => {
            el.removeEventListener("focus", onFocus);
            el.removeEventListener("blur", onBlur);
            el.removeEventListener("mousedown", onMouseDown);
            el.removeEventListener("mouseup", onMouseUp);
            observer.disconnect();
            delete (el as any)[navGridIdentifierKey];
            this.navigables.delete(navId);
            if (this.activeElement === navId) {
                this.activeElement = undefined;
            }
        };
    }

    navigate(direction: NavDirection): boolean {
        //console.log("navigate", direction);

        // If nothing focused, focus the first registered autofocus navigable,
        // if any. Otherwise focus the first registered navigable, if any.
        if (!this.activeElement) {
            const values = Array.from(this.navigables.values());
            const autofocusNavigable = values.filter(n => n.autofocus)?.shift();
            if (autofocusNavigable) {
                domUtils.focusElement(autofocusNavigable.el);
                return true;
            }
            const firstNavigable = values.shift();
            if (firstNavigable) {
                domUtils.focusElement(firstNavigable.el);
                return true;
            }
            // No navigables have been registered
            return false;
        }

        const activeNavigable = this.navigables.get(this.activeElement)!;

        switch (direction) {
            case NavDirection.Up:
                return this.navigateUp(activeNavigable);
            case NavDirection.Down:
                return this.navigateDown(activeNavigable);
            case NavDirection.Left:
                return this.navigateLeft(activeNavigable);
            case NavDirection.Right:
                return this.navigateRight(activeNavigable);
        }

        return false;
    }

    navigateCore(
        fromRect: NavRect,
        candidates: CandidateRect[],
        priorities: DistanceMethod[],
        filters: FilterMethod[]
    ): boolean {
        for (const filter of filters) {
            candidates = filterArr(filter, fromRect, candidates);
        }
        for (const priority of priorities) {
            sortArr(priority, fromRect, candidates);
        }
        const bestCandidate = candidates.shift();
        if (!bestCandidate) {
            return false;
        }
        const bestNavigable = this.navigables.get(bestCandidate.id);
        if (!bestNavigable) {
            return false;
        }
        domUtils.focusElement(bestNavigable.el);
        return true;
    }

    navigateUp(fromNavigable: Navigable): boolean {
        if (!fromNavigable.exitDirections.includes(NavDirection.Up)) {
            // Can't navigate away from the element in this direction
            return false;
        }

        const fromRect = RectCache.getCachedElementRect(fromNavigable.el);
        const priorities: DistanceMethod[] = [
            DistanceMethod.NearPlumbLineIsBetter,
            DistanceMethod.NearTargetTopIsBetter,
        ];
        const filters: FilterMethod[] = [FilterMethod.Above];
        const candidates: CandidateRect[] = Array.from(this.navigables.values())
            .filter(n => n.id !== fromNavigable.id)
            .map(n => ({
                id: n.id,
                ...RectCache.getCachedElementRect(n.el),
            }));

        return this.navigateCore(fromRect, candidates, priorities, filters);
    }

    navigateDown(fromNavigable: Navigable): boolean {
        if (!fromNavigable.exitDirections.includes(NavDirection.Down)) {
            // Can't navigate away from the element in this direction
            return false;
        }

        const fromRect = RectCache.getCachedElementRect(fromNavigable.el);
        const priorities: DistanceMethod[] = [
            DistanceMethod.NearPlumbLineIsBetter,
            DistanceMethod.NearTargetBottomIsBetter,
        ];
        const filters: FilterMethod[] = [FilterMethod.Below];
        const candidates: CandidateRect[] = Array.from(this.navigables.values())
            .filter(n => n.id !== fromNavigable.id)
            .map(n => ({
                id: n.id,
                ...RectCache.getCachedElementRect(n.el),
            }));

        return this.navigateCore(fromRect, candidates, priorities, filters);
    }

    navigateLeft(fromNavigable: Navigable): boolean {
        if (!fromNavigable.exitDirections.includes(NavDirection.Left)) {
            // Can't navigate away from the element in this direction
            return false;
        }

        const fromRect = RectCache.getCachedElementRect(fromNavigable.el);
        const priorities: DistanceMethod[] = [
            DistanceMethod.NearHorizonIsBetter,
            DistanceMethod.NearTargetLeftIsBetter,
        ];
        const filters: FilterMethod[] = [FilterMethod.LeftOf];
        const candidates: CandidateRect[] = Array.from(this.navigables.values())
            .filter(n => n.id !== fromNavigable.id)
            .map(n => ({
                id: n.id,
                ...RectCache.getCachedElementRect(n.el),
            }));

        return this.navigateCore(fromRect, candidates, priorities, filters);
    }

    navigateRight(fromNavigable: Navigable): boolean {
        if (!fromNavigable.exitDirections.includes(NavDirection.Right)) {
            // Can't navigate away from the element in this direction
            return false;
        }

        const fromRect = RectCache.getCachedElementRect(fromNavigable.el);
        const priorities: DistanceMethod[] = [
            DistanceMethod.NearHorizonIsBetter,
            DistanceMethod.NearTargetRightIsBetter,
        ];
        const filters: FilterMethod[] = [FilterMethod.RightOf];
        const candidates: CandidateRect[] = Array.from(this.navigables.values())
            .filter(n => n.id !== fromNavigable.id)
            .map(n => ({
                id: n.id,
                ...RectCache.getCachedElementRect(n.el),
            }));

        return this.navigateCore(fromRect, candidates, priorities, filters);
    }

    getActiveElement(): Navigable | undefined {
        if (!this.activeElement) {
            return undefined;
        }
        const navigable = this.navigables.get(this.activeElement);
        if (!navigable) {
            return undefined;
        }
        return navigable;
    }
}

const navGrid = new NavGrid();

let initializeOnce = () => {
    initializeOnce = () => {
        throw new Error("NavGrid.initialize() called more than once.");
    };
    navGrid.initialize();
};

export function initialize() {
    initializeOnce();
}

export function registerNavigable(
    el: HTMLElement | undefined | null,
    opts?: {
        exitDirections?: NavDirection[];
        autofocus?: boolean;
    }
): () => void {
    if (!el) {
        return () => {};
    }
    if (isNavGridElement(el)) {
        console.warn("Navigable already registered");
        return () => {};
    }
    opts = opts || {};
    if (!opts.exitDirections?.length) {
        opts.exitDirections = [...allNavDirections()];
    }
    return navGrid.registerNavigable(el, opts);
}

// Returns true if focus changed to a different element
export function navigate(direction: NavDirection): boolean {
    return navGrid.navigate(direction);
}

export function getActiveElement(): HTMLElement | undefined {
    return navGrid.getActiveElement()?.el;
}

export function isActiveElement(el: HTMLElement | null | undefined): boolean {
    const activeEl = getActiveElement();
    if (!activeEl) {
        return false;
    }
    return activeEl === el;
}

export function isActiveElementDirectlyInteractible(): boolean {
    const activeEl = getActiveElement();
    if (!activeEl) {
        return false;
    }
    return domUtils.isInteractable(activeEl);
}

export function pushContext() {
    navGrid.pushContext();
}

export function popContext() {
    navGrid.popContext();
}

// Distance helpers

enum DistanceMethod {
    NearPlumbLineIsBetter,
    NearHorizonIsBetter,
    NearTargetLeftIsBetter,
    NearTargetRightIsBetter,
    NearTargetTopIsBetter,
    NearTargetBottomIsBetter,
    TopIsBetter,
    BottomIsBetter,
    LeftIsBetter,
    RightIsBetter,
}

const sortArr = (
    method: DistanceMethod,
    targetRect: NavRect,
    arr: CandidateRect[]
) => {
    arr.sort(
        (a, b) =>
            distanceFn(method, targetRect, a) -
            distanceFn(method, targetRect, b)
    );
};

const distanceFn = (
    method: DistanceMethod,
    targetRect: NavRect,
    rect: NavRect
) => {
    switch (method) {
        case DistanceMethod.NearPlumbLineIsBetter:
            return nearPlumbLineIsBetter(targetRect, rect);
        case DistanceMethod.NearHorizonIsBetter:
            return nearHorizonIsBetter(targetRect, rect);
        case DistanceMethod.NearTargetLeftIsBetter:
            return nearTargetLeftIsBetter(targetRect, rect);
        case DistanceMethod.NearTargetRightIsBetter:
            return nearTargetRightIsBetter(targetRect, rect);
        case DistanceMethod.NearTargetTopIsBetter:
            return nearTargetTopIsBetter(targetRect, rect);
        case DistanceMethod.NearTargetBottomIsBetter:
            return nearTargetBottomIsBetter(targetRect, rect);
        case DistanceMethod.TopIsBetter:
            return topIsBetter(rect);
        case DistanceMethod.BottomIsBetter:
            return bottomIsBetter(rect);
        case DistanceMethod.LeftIsBetter:
            return leftIsBetter(rect);
        case DistanceMethod.RightIsBetter:
            return rightIsBetter(rect);
        default:
            return 0;
    }
};

const nearPlumbLineIsBetter = (targetRect: NavRect, rect: NavRect): number => {
    let d: number;
    if (rect.center.x < targetRect.center.x) {
        d = targetRect.center.x - rect.right;
    } else {
        d = rect.left - targetRect.center.x;
    }
    return d < 0 ? 0 : d;
};

const nearHorizonIsBetter = (targetRect: NavRect, rect: NavRect): number => {
    let d: number;
    if (rect.center.y < targetRect.center.y) {
        d = targetRect.center.y - rect.bottom;
    } else {
        d = rect.top - targetRect.center.y;
    }
    return d < 0 ? 0 : d;
};

const nearTargetLeftIsBetter = (targetRect: NavRect, rect: NavRect): number => {
    let d: number;
    if (rect.center.x < targetRect.center.x) {
        d = targetRect.left - rect.right;
    } else {
        d = rect.left - targetRect.left;
    }
    return d < 0 ? 0 : d;
};

const nearTargetRightIsBetter = (
    targetRect: NavRect,
    rect: NavRect
): number => {
    let d: number;
    if (rect.center.x > targetRect.center.x) {
        d = rect.left - targetRect.right;
    } else {
        d = targetRect.right - rect.right;
    }
    return d < 0 ? 0 : d;
};

const nearTargetTopIsBetter = (targetRect: NavRect, rect: NavRect): number => {
    let d: number;
    if (rect.center.y < targetRect.center.y) {
        d = targetRect.top - rect.bottom;
    } else {
        d = rect.top - targetRect.top;
    }
    return d < 0 ? 0 : d;
};

const nearTargetBottomIsBetter = (
    targetRect: NavRect,
    rect: NavRect
): number => {
    let d: number;
    if (rect.center.y > targetRect.center.y) {
        d = rect.top - targetRect.bottom;
    } else {
        d = targetRect.bottom - rect.bottom;
    }
    return d < 0 ? 0 : d;
};

const topIsBetter = (rect: NavRect): number => {
    return rect.top;
};

const bottomIsBetter = (rect: NavRect): number => {
    return -1 * rect.bottom;
};

const leftIsBetter = (rect: NavRect): number => {
    return rect.left;
};

const rightIsBetter = (rect: NavRect): number => {
    return -1 * rect.right;
};

// Filter helpers

const filterArr = (
    method: FilterMethod,
    targetRect: NavRect,
    arr: CandidateRect[]
): CandidateRect[] => {
    return arr.filter(rect => filterFn(method, targetRect, rect));
};

const filterFn = (
    method: FilterMethod,
    targetRect: NavRect,
    rect: NavRect
): boolean => {
    switch (method) {
        case FilterMethod.Above:
            return filterAbove(targetRect, rect);
        case FilterMethod.Below:
            return filterBelow(targetRect, rect);
        case FilterMethod.LeftOf:
            return filterLeftOf(targetRect, rect);
        case FilterMethod.RightOf:
            return filterRightOf(targetRect, rect);
        default:
            return false;
    }
};

enum FilterMethod {
    Above,
    Below,
    LeftOf,
    RightOf,
}

const filterAbove = (targetRect: NavRect, rect: NavRect): boolean => {
    return rect.center.y < targetRect.center.y;
};

const filterBelow = (targetRect: NavRect, rect: NavRect): boolean => {
    return rect.center.y > targetRect.center.y;
};

const filterLeftOf = (targetRect: NavRect, rect: NavRect): boolean => {
    return rect.center.x < targetRect.center.x;
};

const filterRightOf = (targetRect: NavRect, rect: NavRect): boolean => {
    return rect.center.x > targetRect.center.x;
};
