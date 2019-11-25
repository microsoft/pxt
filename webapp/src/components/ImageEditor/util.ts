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
    if (hasPointerEvents()) {
        bindPointerEvents(el, target);
    }
    else if (isTouchEnabled()) {
        bindTouchEvents(el, target);
    }
    else {
        bindMouseEvents(el, target);
    }
}

function bindPointerEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;

    el.addEventListener("pointerup", ev => {
        if (state) {
            state.end(clientCoord(ev));
            ev.preventDefault();
        }
        state = undefined;
    });

    el.addEventListener("pointerdown", ev => {
        if (state) state.end();

        state = new GestureState(target, clientCoord(ev), isRightClick(ev));
        ev.preventDefault();
    });

    el.addEventListener("pointermove", ev => {
        if (state) {
            state.update(clientCoord(ev));
            ev.preventDefault();
        }
    });

    el.addEventListener("pointerleave", ev => {
        if (state) {
            state.end(clientCoord(ev));
            ev.preventDefault();
        }
        state = undefined;
    });
}

function bindMouseEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;

    el.addEventListener("mouseup", ev => {
        if (state) state.end(clientCoord(ev));
        state = undefined;
    });

    el.addEventListener("mousedown", ev => {
        if (state) state.end();

        state = new GestureState(target, clientCoord(ev), isRightClick(ev));
    });

    el.addEventListener("mousemove", ev => {
        if (state) state.update(clientCoord(ev));
    });

    el.addEventListener("mouseleave", ev => {
        if (state) state.end(clientCoord(ev));
        state = undefined;
    });
}

function bindTouchEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;
    let touchIdentifier: number | undefined;

    el.addEventListener("touchend", ev => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.end(touch);
                state = undefined;
                ev.preventDefault();
            }
        }
    });

    el.addEventListener("touchstart", ev => {
        if (state) state.end();

        touchIdentifier = ev.changedTouches[0].identifier;
        state = new GestureState(target, ev.changedTouches[0], isRightClick(ev));
    });

    el.addEventListener("touchmove", ev => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.update(touch);
                ev.preventDefault();
            }
        }
    });

    el.addEventListener("touchcancel", ev => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.end(touch);
                state = undefined;
                ev.preventDefault();
            }
        }
    });
}

function getTouch(ev: TouchEvent, identifier: number) {
    for (let i = 0; i < ev.changedTouches.length; i++) {
        if (ev.changedTouches[i].identifier === identifier) {
            return ev.changedTouches[i];
        }
    }

    return undefined;
}

function isRightClick(ev: MouseEvent | PointerEvent | TouchEvent) {
    if ((ev as MouseEvent | PointerEvent).button > 0) return true;
    return false;
}

export interface Color { r: number, g: number, b: number, a?: number }


export function imageStateToBitmap(state: pxt.sprite.ImageState) {
    const base = pxt.sprite.Bitmap.fromData(state.bitmap);
    if (state.floating && state.floating.bitmap) {
        const floating = pxt.sprite.Bitmap.fromData(state.floating.bitmap);
        floating.x0 = state.layerOffsetX || 0;
        floating.y0 = state.layerOffsetY || 0;

        base.apply(floating, true);
    }

    return base;
}

export function imageStateToTilemap(state: pxt.sprite.ImageState) {
    const base = pxt.sprite.Tilemap.fromData(state.bitmap);
    if (state.floating && state.floating.bitmap) {
        const floating = pxt.sprite.Tilemap.fromData(state.floating.bitmap);
        floating.x0 = state.layerOffsetX || 0;
        floating.y0 = state.layerOffsetY || 0;

        base.apply(floating, true);
    }

    return base;
}

export function applyBitmapData(bitmap: pxt.sprite.BitmapData, data: pxt.sprite.BitmapData, x0: number = 0, y0: number = 0): pxt.sprite.BitmapData {
    if (!bitmap || !data) return bitmap;
    const base = pxt.sprite.Bitmap.fromData(bitmap);
    const layer = pxt.sprite.Bitmap.fromData(data);
    layer.x0 = x0;
    layer.y0 = y0;
    base.apply(layer, true);
    return base.data();
}
