import { useEffect } from "react";
import { EditState } from "./toolDefinitions";

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

/**
 * Similar to fireClickOnEnter, but interactions limited to enter key / ignores
 * space bar.
 */
export function fireClickOnlyOnEnter(e: React.KeyboardEvent<HTMLElement>): void {
    const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
    if (charCode === 13 /** enter key **/) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).click();
    }
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
        return bindPointerEvents(el, target);
    }
    else if (isTouchEnabled()) {
        return bindTouchEvents(el, target);
    }
    else {
        return bindMouseEvents(el, target);
    }
}

function bindPointerEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;

    const pointerUp = (ev: PointerEvent) => {
        if (state) {
            state.end(clientCoord(ev));
            ev.preventDefault();
        }
        state = undefined;
    };

    const pointerDown = (ev: PointerEvent) => {
        if (state) state.end();

        state = new GestureState(target, clientCoord(ev), isRightClick(ev));
        ev.preventDefault();
    };

    const pointerMove = (ev: PointerEvent) => {
        if (state) {
            state.update(clientCoord(ev));
            ev.preventDefault();
        }
    };

    const pointerLeave = (ev: PointerEvent) => {
        if (state) {
            state.end(clientCoord(ev));
            ev.preventDefault();
        }
        state = undefined;
    };

    el.addEventListener("pointerup", pointerUp);
    el.addEventListener("pointerdown", pointerDown);
    el.addEventListener("pointermove", pointerMove);
    el.addEventListener("pointerleave", pointerLeave);

    return () => {
        el.removeEventListener("pointerup", pointerUp);
        el.removeEventListener("pointerdown", pointerDown);
        el.removeEventListener("pointermove", pointerMove);
        el.removeEventListener("pointerleave", pointerLeave);
    };
}

function bindMouseEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;

    const pointerUp = (ev: MouseEvent) => {
        if (state) {
            state.end(clientCoord(ev));
        }
        state = undefined;
    };

    const pointerDown = (ev: MouseEvent) => {
        if (state) state.end();

        state = new GestureState(target, clientCoord(ev), isRightClick(ev));
    };

    const pointerMove = (ev: MouseEvent) => {
        if (state) {
            state.update(clientCoord(ev));
        }
    };

    const pointerLeave = (ev: MouseEvent) => {
        if (state) {
            state.end(clientCoord(ev));
        }
        state = undefined;
    };

    el.addEventListener("mouseup", pointerUp);
    el.addEventListener("mousedown", pointerDown);
    el.addEventListener("mousemove", pointerMove);
    el.addEventListener("mouseleave", pointerLeave);

    return () => {
        el.removeEventListener("mouseup", pointerUp);
        el.removeEventListener("mousedown", pointerDown);
        el.removeEventListener("mousemove", pointerMove);
        el.removeEventListener("mouseleave", pointerLeave);
    };
}

function bindTouchEvents(el: HTMLElement, target: GestureTarget) {
    let state: GestureState;
    let touchIdentifier: number | undefined;

    const touchEnd = (ev: TouchEvent) => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.end(touch);
                state = undefined;
                ev.preventDefault();
            }
        }
    };

    const touchStart = (ev: TouchEvent) => {
        if (state) state.end();

        touchIdentifier = ev.changedTouches[0].identifier;
        state = new GestureState(target, ev.changedTouches[0], isRightClick(ev));
    };

    const touchMove = (ev: TouchEvent) => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.update(touch);
                ev.preventDefault();
            }
        }
    };

    const touchCancel = (ev: TouchEvent) => {
        if (state && touchIdentifier) {
            const touch = getTouch(ev, touchIdentifier);

            if (touch) {
                state.end(touch);
                state = undefined;
                ev.preventDefault();
            }
        }
    };

    el.addEventListener("touchend", touchEnd);
    el.addEventListener("touchstart", touchStart);
    el.addEventListener("touchmove", touchMove);
    el.addEventListener("touchcancel", touchCancel);

    return () => {
        el.removeEventListener("touchend", touchEnd);
        el.removeEventListener("touchstart", touchStart);
        el.removeEventListener("touchmove", touchMove);
        el.removeEventListener("touchcancel", touchCancel);
    };
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
    const base = pxt.sprite.Bitmap.fromData(state.bitmap).copy();
    if (state.floating && state.floating.bitmap) {
        const floating = pxt.sprite.Bitmap.fromData(state.floating.bitmap);
        floating.x0 = state.layerOffsetX || 0;
        floating.y0 = state.layerOffsetY || 0;

        base.apply(floating, true);
    }

    return base;
}

export function imageStateToTilemap(state: pxt.sprite.ImageState) {
    const base = pxt.sprite.Tilemap.fromData(state.bitmap).copy();
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


export interface TilemapPatch {
    map: string;
    layers: string[];
    tiles: string[];
}

export function createTilemapPatchFromFloatingLayer(editState: EditState, tileset: pxt.TileSet): TilemapPatch {
    if (!editState.floating) return undefined;

    const tilemap = pxt.sprite.Tilemap.fromData(editState.floating.image.data());
    const copyTilemap = new pxt.sprite.Tilemap(tilemap.width, tilemap.height);
    const layers = editState.floating.overlayLayers ?
        editState.floating.overlayLayers.map(bitmap => pxt.sprite.base64EncodeBitmap(bitmap.data())) : [];

    let referencedTiles: pxt.Tile[] = [];
    for (let x = 0; x < tilemap.width; x++) {
        for (let y = 0; y < tilemap.height; y++) {
            const tile = tileset.tiles[tilemap.get(x, y)]
            const index = referencedTiles.indexOf(tile);

            if (index === -1) {
                copyTilemap.set(x, y, referencedTiles.length);
                referencedTiles.push(tile);
            }
            else {
                copyTilemap.set(x, y, index);
            }
        }
    }


    return {
        map: pxt.sprite.hexEncodeTilemap(copyTilemap),
        layers,
        tiles: referencedTiles.map(t => pxt.sprite.base64EncodeBitmap(t.bitmap))
    };
}

export function emptyFrame(width: number, height: number): pxt.sprite.ImageState {
    return {
        bitmap: new pxt.sprite.Bitmap(width, height).data()
    }
}

export function useGestureEvents(el: React.RefObject<Element>, target: GestureTarget) {
    if (hasPointerEvents()) {
        usePointerEvents(el, target);
    }
    else if (isTouchEnabled()) {
        useTouchEvents(el, target);
    }
    else {
        useMouseEvents(el, target);
    }
}

function usePointerEvents(el: React.RefObject<Element>, target: GestureTarget) {
    const state = React.useRef<GestureState>();

    useEffect(() => {
        const element = el.current;
        if (!element) return undefined;

        const pointerUp = (ev: PointerEvent) => {
            if (state.current) {
                state.current.end(clientCoord(ev));
                ev.preventDefault();
            }
            state.current = undefined;
        };

        const pointerDown = (ev: PointerEvent) => {
            if (state.current) state.current.end();

            state.current = new GestureState(target, clientCoord(ev), isRightClick(ev));
            ev.preventDefault();
        };

        const pointerMove = (ev: PointerEvent) => {
            if (state.current) {
                state.current.update(clientCoord(ev));
                ev.preventDefault();
            }
        };

        const pointerLeave = (ev: PointerEvent) => {
            if (state.current) {
                state.current.end(clientCoord(ev));
                ev.preventDefault();
            }
            state.current = undefined;
        };

        element.addEventListener("pointerup", pointerUp);
        element.addEventListener("pointerdown", pointerDown);
        element.addEventListener("pointermove", pointerMove);
        element.addEventListener("pointerleave", pointerLeave);

        return () => {
            element.removeEventListener("pointerup", pointerUp);
            element.removeEventListener("pointerdown", pointerDown);
            element.removeEventListener("pointermove", pointerMove);
            element.removeEventListener("pointerleave", pointerLeave);
        };
    }, [target]);
}

function useMouseEvents(el: React.RefObject<Element>, target: GestureTarget) {
    const state = React.useRef<GestureState>();

    React.useEffect(() => {
        const element = el.current;
        if (!element) return undefined;

        const pointerUp = (ev: MouseEvent) => {
            if (state.current) {
                state.current.end(clientCoord(ev));
            }
            state.current = undefined;
        };

        const pointerDown = (ev: MouseEvent) => {
            if (state.current) state.current.end();

            state.current = new GestureState(target, clientCoord(ev), isRightClick(ev));
        };

        const pointerMove = (ev: MouseEvent) => {
            if (state.current) {
                state.current.update(clientCoord(ev));
            }
        };

        const pointerLeave = (ev: MouseEvent) => {
            if (state.current) {
                state.current.end(clientCoord(ev));
            }
            state.current = undefined;
        };

        element.addEventListener("mouseup", pointerUp);
        element.addEventListener("mousedown", pointerDown);
        element.addEventListener("mousemove", pointerMove);
        element.addEventListener("mouseleave", pointerLeave);

        return () => {
            element.removeEventListener("mouseup", pointerUp);
            element.removeEventListener("mousedown", pointerDown);
            element.removeEventListener("mousemove", pointerMove);
            element.removeEventListener("mouseleave", pointerLeave);
        };
    }, [target])
}

function useTouchEvents(el: React.RefObject<Element>, target: GestureTarget) {
    const state = React.useRef<GestureState>();
    const touchIdentifier = React.useRef<number>();

    React.useEffect(() => {
        const element = el.current;
        if (!element) return undefined;

        const touchEnd = (ev: TouchEvent) => {
            if (state.current && touchIdentifier.current) {
                const touch = getTouch(ev, touchIdentifier.current);

                if (touch) {
                    state.current.end(touch);
                    state.current = undefined;
                    ev.preventDefault();
                }
            }
        };

        const touchStart = (ev: TouchEvent) => {
            if (state.current) state.current.end();

            touchIdentifier.current = ev.changedTouches[0].identifier;
            state.current = new GestureState(target, ev.changedTouches[0], isRightClick(ev));
        };

        const touchMove = (ev: TouchEvent) => {
            if (state.current && touchIdentifier.current) {
                const touch = getTouch(ev, touchIdentifier.current);

                if (touch) {
                    state.current.update(touch);
                    ev.preventDefault();
                }
            }
        };

        const touchCancel = (ev: TouchEvent) => {
            if (state.current && touchIdentifier.current) {
                const touch = getTouch(ev, touchIdentifier.current);

                if (touch) {
                    state.current.end(touch);
                    state.current = undefined;
                    ev.preventDefault();
                }
            }
        };

        element.addEventListener("touchend", touchEnd);
        element.addEventListener("touchstart", touchStart);
        element.addEventListener("touchmove", touchMove);
        element.addEventListener("touchcancel", touchCancel);

        return () => {
            element.removeEventListener("touchend", touchEnd);
            element.removeEventListener("touchstart", touchStart);
            element.removeEventListener("touchmove", touchMove);
            element.removeEventListener("touchcancel", touchCancel);
        };
    }, [target]);
}