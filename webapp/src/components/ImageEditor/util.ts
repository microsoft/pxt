export const DRAG_RADIUS = 3;

export function hasPointerEvents(): boolean {
    return typeof window != "undefined" && !!(window as any).PointerEvent;
}

export function isTouchEnabled(): boolean {
    return typeof window !== "undefined" &&
        ('ontouchstart' in window                              // works on most browsers
            || (navigator && navigator.maxTouchPoints > 0));       // works on IE10/11 and Surface);
}

export function isBitmapSupported(): boolean {
    return !!window.createImageBitmap;
}

export enum MapTools {
    Pan,
    Stamp,
    Object,
    Erase
}

export class Bitmask {
    protected mask: Uint8Array;

    constructor(public width: number, public height: number) {
        this.mask = new Uint8Array(Math.ceil(width * height / 8));
    }

    set(col: number, row: number) {
        const cellIndex = col + this.width * row;
        const index = cellIndex >> 3;
        const offset = cellIndex & 7;
        this.mask[index] |= (1 << offset);
    }

    get(col: number, row: number) {
        const cellIndex = col + this.width * row;
        const index = cellIndex >> 3;
        const offset = cellIndex & 7;
        return (this.mask[index] >> offset) & 1;
    }
}

export interface IPointerEvents {
    up: string,
    down: string[],
    move: string,
    enter: string,
    leave: string
}

export const pointerEvents: IPointerEvents = (() => {
    if (hasPointerEvents()) {
        return {
            up: "pointerup",
            down: ["pointerdown"],
            move: "pointermove",
            enter: "pointerenter",
            leave: "pointerleave"
        }
    } else if (isTouchEnabled()) {
        return {
            up: "mouseup",
            down: ["mousedown", "touchstart"],
            move: "touchmove",
            enter: "touchenter",
            leave: "touchend"
        }
    } else {
        return {
            up: "mouseup",
            down: ["mousedown"],
            move: "mousemove",
            enter: "mouseenter",
            leave: "mouseleave"
        }
    }
})();

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
    let state: GestureState;

    let upHandler = (ev: MouseEvent) => {
        endGesture(ev);

        ev.stopPropagation();
        ev.preventDefault();
    };

    let leaveHandler = (ev: MouseEvent) => {
        endGesture(ev);

        ev.stopPropagation();
        ev.preventDefault();
    };

    let moveHandler = (ev: MouseEvent) => {
        if (state) state.update(clientCoord(ev));

        ev.stopPropagation();
        ev.preventDefault();
    };

    let startGesture = (ev: MouseEvent | PointerEvent | TouchEvent) => {
        if (state) state.end();

        state = new GestureState(target, clientCoord(ev), isRightClick(ev));

        document.addEventListener(pointerEvents.move, moveHandler);
        document.addEventListener(pointerEvents.up, upHandler);

        if (isTouchEnabled() && !hasPointerEvents()) {
            document.addEventListener("touchend", upHandler);
            document.addEventListener("touchcancel", leaveHandler);
        }
        else {
            document.addEventListener(pointerEvents.leave, leaveHandler);
        }
    }

    let endGesture = (ev: MouseEvent | PointerEvent | TouchEvent) => {
        if (state) state.end(clientCoord(ev));

        state = undefined;

        document.removeEventListener(pointerEvents.move, moveHandler);
        document.removeEventListener(pointerEvents.up, upHandler);
        document.removeEventListener(pointerEvents.leave, leaveHandler);

        if (isTouchEnabled() && !hasPointerEvents()) {
            document.removeEventListener("touchend", upHandler);
            document.removeEventListener("touchcancel", leaveHandler);
        }
        else {
            document.removeEventListener(pointerEvents.leave, leaveHandler);
        }
    }

    pointerEvents.down.forEach(evId => {
        el.addEventListener(evId, startGesture);
    });
}

function isRightClick(ev: MouseEvent | PointerEvent | TouchEvent) {
    if ((ev as MouseEvent | PointerEvent).button > 0) return true;
    return false;
}

export interface Color { r: number, g: number, b: number, a?: number }
