import * as React from 'react';
import { GestureTarget, ClientCoordinates, bindGestureEvents, TilemapPatch, createTilemapPatchFromFloatingLayer, useGestureEvents } from './util';

import { Edit, EditState, getEdit, getEditState, ToolCursor, tools } from './toolDefinitions';
import { createTile } from '../../assets';
import { areShortcutsEnabled } from './keyboardShortcuts';
import { LIGHT_MODE_TRANSPARENT } from './ImageEditor';
import { ImageEditorContext, ImageEditorStore, ImageEditorTool, AnimationState, TilemapState, TileDrawingMode, GalleryTile, imageEdit, changeCanvasZoom, changeCursorLocation, changeImageTool, changeSelectedColor, changeBackgroundColor, createNewTile } from './state';

const IMAGE_MIME_TYPE = "image/x-mkcd-f4"

export interface ImageCanvasProps {
    dispatchImageEdit: (state: pxt.sprite.ImageState) => void;
    dispatchChangeZoom: (zoom: number) => void;
    dispatchChangeCursorLocation: (loc: [number, number, number, number]) => void;
    dispatchChangeImageTool: (tool: ImageEditorTool) => void;
    dispatchChangeSelectedColor: (index: number) => void;
    dispatchChangeBackgroundColor: (index: number) => void;
    dispatchCreateNewTile: (tile: pxt.Tile, foreground: number, background: number, qualifiedName?: string) => void;
    selectedColor: number;
    backgroundColor: number;
    tool: ImageEditorTool;
    toolWidth: number;
    zoomDelta: number;
    onionSkinEnabled: boolean;
    isTilemap: boolean;
    drawingMode: TileDrawingMode;
    overlayEnabled?: boolean;
    gallery?: GalleryTile[];

    colors: string[];
    tilemapState?: TilemapState;
    imageState?: pxt.sprite.ImageState;
    prevFrame?: pxt.sprite.ImageState;
    lightMode?: boolean;
    tilesetRevision: number;

    suppressShortcuts: boolean;
}

/**
 * Color for the walls
 */
const WALL_COLOR = 2;

/**
 * Each overlay layer is associated with a specific drawing mode
 */
const overlayLayers = [TileDrawingMode.Wall];

export class ImageCanvasImpl extends React.Component<ImageCanvasProps, {}> implements GestureTarget {
    protected canvas: HTMLCanvasElement;

    protected imageWidth: number;
    protected imageHeight: number;

    protected background: HTMLCanvasElement;
    protected floatingLayer: HTMLDivElement;
    protected canvasLayers: HTMLCanvasElement[];
    protected cellWidth: number;
    protected colors: Uint8ClampedArray;

    protected edit: Edit;
    protected editState: EditState;
    protected cursorLocation: [number, number, number, number];
    protected cursor: ToolCursor | string = ToolCursor.Crosshair;
    protected zoom = 2.5;
    protected panX = 0;
    protected panY = 0;
    protected hasInteracted = false;

    protected lastPanX: number;
    protected lastPanY: number;
    protected lastTool: ImageEditorTool;

    protected isResizing: boolean;
    protected originalImage: pxt.sprite.Bitmap;

    protected tileCache: pxt.Map<HTMLCanvasElement> = {};
    protected tileCacheRevision: number;
    protected hasHover: boolean;

    protected waitingToZoom: boolean;

    render() {
        const imageState = this.getImageState();
        const isPortrait = !imageState || (imageState.bitmap.height > imageState.bitmap.width);
        const showResizeHandles = !this.props.isTilemap && this.props.tool == ImageEditorTool.Marquee;

        return <div ref="canvas-bounds" className={`image-editor-canvas ${isPortrait ? "portrait" : "landscape"}`} onContextMenu={this.preventContextMenu} tabIndex={0}>
            <div className="paint-container">
                {!this.props.lightMode && <canvas ref="paint-surface-bg" className="paint-surface" />}
                <canvas ref="paint-surface" className="paint-surface main" />
                {overlayLayers.map((layer, index) => {
                    return <canvas ref={`paint-surface-${layer.toString()}`} className={`paint-surface overlay ${!this.props.overlayEnabled ? 'hide' : ''}`} key={index} />
                })}
                <div ref="floating-layer-border" className="image-editor-floating-layer" />
                { showResizeHandles && <div ref="floating-layer-nw-corner" className="image-editor-floating-layer-corner"/>}
                { showResizeHandles && <div ref="floating-layer-ne-corner" className="image-editor-floating-layer-corner"/>}
                { showResizeHandles && <div ref="floating-layer-se-corner" className="image-editor-floating-layer-corner"/>}
                { showResizeHandles && <div ref="floating-layer-sw-corner" className="image-editor-floating-layer-corner"/>}
            </div>
        </div>
    }

    componentDidMount() {
        // move initial focus off of the blockly surface
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        this.tileCache = {};

        this.cellWidth = this.props.isTilemap ? this.props.tilemapState.tileset.tileWidth : 1;
        this.canvas = this.refs["paint-surface"] as HTMLCanvasElement;
        this.background = this.refs["paint-surface-bg"] as HTMLCanvasElement;
        this.floatingLayer = this.refs["floating-layer-border"] as HTMLDivElement;
        this.canvasLayers = overlayLayers.map(layer => this.refs[`paint-surface-${layer.toString()}`] as HTMLCanvasElement);

        bindGestureEvents(this.refs["canvas-bounds"] as HTMLDivElement, this);

        const canvasBounds = this.refs["canvas-bounds"] as HTMLDivElement;

        canvasBounds.addEventListener("wheel", ev => {
            this.hasInteracted = true
            this.updateZoom(ev.deltaY / 30, ev.clientX, ev.clientY);
            ev.preventDefault();
        });

        canvasBounds.addEventListener("mousemove", ev => {
            if (!ev.button) this.hasHover = true;
            if (!this.edit) this.updateCursorLocation(ev);
        });

        canvasBounds.addEventListener("mouseout", ev => {
            if (!this.edit) this.updateCursorLocation(null);
        });

        document.addEventListener("keydown", this.onKeyDown, true);
        document.addEventListener("keyup", this.onKeyUp);

        document.addEventListener("copy", this.onCopy);
        document.addEventListener("paste", this.onPaste);

        const imageState = this.getImageState();
        this.editState = getEditState(imageState, this.props.isTilemap, this.props.drawingMode);

        this.redraw();
        this.updateBackground();
    }

    componentDidUpdate() {
        if (!this.edit || !this.editState) {
            const imageState = this.getImageState();
            this.editState = getEditState(imageState, this.props.isTilemap, this.props.drawingMode);
        }

        if (!this.props.isTilemap) this.tileCache = {};

        this.cellWidth = this.props.isTilemap ? this.props.tilemapState.tileset.tileWidth : 1;

        if (this.props.zoomDelta || this.props.zoomDelta === 0) {
            // This is a total hack. Ideally, the zoom should be part of the global state but because
            // the mousewheel events fire very quickly it's much more performant to make it local state.
            // So, for buttons outside this component to change the zoom they have to set the zoom delta
            // which is applied here and then set back to null

            if (this.props.zoomDelta === 0) {
                if (!this.hasInteracted)
                    this.zoomToCanvas();
            }
            else {
                this.hasInteracted = true;
                this.updateZoom(this.props.zoomDelta)
            }
            this.props.dispatchChangeZoom(null);
            return;
        }

        this.redraw();
        this.updateBackground();
    }

    componentWillUnmount() {
        this.tileCache = {};
        document.removeEventListener("keydown", this.onKeyDown, true);
        document.removeEventListener("keyup", this.onKeyUp);

        document.removeEventListener("copy", this.onCopy);
        document.removeEventListener("paste", this.onPaste);
    }

    onClick(coord: ClientCoordinates, isRightClick?: boolean): void {
        this.hasInteracted = true
        if (this.isPanning()) return;

        if (document.activeElement instanceof HTMLElement && document.activeElement !== this.refs["canvas-bounds"]) {
            document.activeElement.blur();
        }
        (this.refs["canvas-bounds"] as HTMLDivElement).focus();

        if (this.isColorSelect()) {
            this.selectCanvasColor(coord, isRightClick);
            return;
        }

        this.updateCursorLocation(coord);

        if (!this.inBounds(this.cursorLocation[0], this.cursorLocation[1])) {
            if (this.editState?.floating?.image) {
                this.editState.mergeFloatingLayer();
                this.props.dispatchImageEdit(this.editState.toImageState());
            }
            return;
        }
        if (this.touchesResize(coord.clientX, coord.clientY)) {
            this.isResizing =  true;
        }
        this.startEdit(!!isRightClick);
        this.updateEdit(this.cursorLocation[0], this.cursorLocation[1]);
        this.commitEdit();
    }

    onDragStart(coord: ClientCoordinates, isRightClick?: boolean): void {
        this.hasInteracted = true
        if (this.touchesResize(coord.clientX, coord.clientY)) {
            this.isResizing = true;
        }
        if (this.isPanning()) {
            this.lastPanX = coord.clientX;
            this.lastPanY = coord.clientY;
            this.updateCursor(true, false);
        } else if (this.isColorSelect()) {
            this.selectCanvasColor(coord, isRightClick);
        }
        else {
            this.updateCursorLocation(coord);
            this.startEdit(!!isRightClick);
        }
    }

    onDragMove(coord: ClientCoordinates): void {
        if (this.isPanning() && this.lastPanX != undefined && this.lastPanY != undefined) {
            this.panX += this.lastPanX - coord.clientX;
            this.panY += this.lastPanY - coord.clientY;
            this.lastPanX = coord.clientX;
            this.lastPanY = coord.clientY;

            this.updateCursor(true, false);
        }
        else if (!this.edit) return;
        else if (this.updateCursorLocation(coord)) {
            this.updateEdit(this.cursorLocation[0], this.cursorLocation[1]);
        }
    }

    onDragEnd(coord: ClientCoordinates): void {
        if (this.isPanning() && this.lastPanX != undefined && this.lastPanY != undefined) {
            this.panX += this.lastPanX - coord.clientX;
            this.panY += this.lastPanY - coord.clientY;
            this.lastPanX = undefined;
            this.lastPanY = undefined;

            this.updateCursor(false, false);
        } else if (this.isResizing) {
            if (!this.edit) return;
            if (this.updateCursorLocation(coord))
                this.updateEdit(this.cursorLocation[0], this.cursorLocation[1]);

            this.commitEdit(false);
            this.updateCursor(false, false);
        } else {
            if (!this.edit) return;
            if (this.updateCursorLocation(coord))
                this.updateEdit(this.cursorLocation[0], this.cursorLocation[1]);

            this.commitEdit();
        }
        this.isResizing = false;
    }

    protected onKeyDown = (ev: KeyboardEvent): void => {
        if (!areShortcutsEnabled()) return;

        this.hasInteracted = true;

        if (this.shouldHandleCanvasShortcut() && this.editState?.floating?.image) {
            let moved = false;

            switch (ev.key) {
                case 'ArrowLeft':
                    this.editState.layerOffsetX = Math.max(this.editState.layerOffsetX - 1, -this.editState.floating.image.width);
                    moved = true;
                    break;
                case 'ArrowUp':
                    this.editState.layerOffsetY = Math.max(this.editState.layerOffsetY - 1, -this.editState.floating.image.height);
                    moved = true;
                    break;
                case 'ArrowRight':
                    this.editState.layerOffsetX = Math.min(this.editState.layerOffsetX + 1, this.editState.width);
                    moved = true;
                    break;
                case 'ArrowDown':
                    this.editState.layerOffsetY = Math.min(this.editState.layerOffsetY + 1, this.editState.height);
                    moved = true;
                    break;
            }

            if (moved) {
                this.props.dispatchImageEdit(this.editState.toImageState());
                ev.preventDefault();
            }
        }

        if (!ev.repeat) {
            // prevent blockly's ctrl+c / ctrl+v handler
            if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'c' || ev.key === 'v')) {
                ev.stopPropagation();
            }

            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'a' && this.shouldHandleCanvasShortcut()) {
                this.selectAll();
                ev.preventDefault();
            }

            if (ev.key == "Escape" && this.editState?.floating?.image && this.shouldHandleCanvasShortcut()) {
                // TODO: If there isn't currently a marqueed selection, escape should save and close the field editor
                this.cancelSelection();
                ev.preventDefault();
            }

            if ((ev.key === "Backspace" || ev.key === "Delete") && this.editState?.floating?.image && this.shouldHandleCanvasShortcut()) {
                this.deleteSelection();
                ev.preventDefault();
            }

            // hotkeys for switching temporarily between tools
            this.lastTool = this.props.tool;
            switch (ev.keyCode) {
                // alt key to select color
                case 18:
                    this.props.dispatchChangeImageTool(ImageEditorTool.ColorSelect);
                    ev.preventDefault();
                    break;
                // spacebar to pan
                case 32:
                    this.props.dispatchChangeImageTool(ImageEditorTool.Pan);
                    break;
                default:
                    this.lastTool = null;
            }
            this.updateCursor(false, false);
        }
    }

    protected onKeyUp = (ev: KeyboardEvent): void => {
        if (this.lastTool != null) {
            this.props.dispatchChangeImageTool(this.lastTool);
            this.lastTool = null;
            this.updateCursor(false, false);
        }
    }

    protected onCopy = (ev: ClipboardEvent) => {
        if (this.props.tool === ImageEditorTool.Marquee && this.editState?.floating?.image) {
            ev.preventDefault();

            if (this.props.isTilemap) {
                ev.clipboardData.setData('application/makecode-tilemap', JSON.stringify(createTilemapPatchFromFloatingLayer(this.editState, this.props.tilemapState.tileset)));
            }
            else {
                const imageData = pxt.sprite.bitmapToImageLiteral(this.editState.floating.image, 'typescript');
                ev.clipboardData.setData('application/makecode-image', imageData);
                ev.clipboardData.setData('text/plain', imageData);
            }
        }
    }

    protected onPaste = (ev: ClipboardEvent) => {
        if (this.props.isTilemap) {
            const patchData = ev.clipboardData.getData('application/makecode-tilemap');

            let tilemapPatch: TilemapPatch;

            try {
                tilemapPatch = JSON.parse(patchData);
            }
            catch (e) {
            }

            if (!tilemapPatch || !tilemapPatch.map || !tilemapPatch.layers || !tilemapPatch.tiles) {
                return;
            }

            ev.preventDefault();
            this.applyTilemapPatch(tilemapPatch);
            return;
        }

        let imageData = ev.clipboardData.getData('application/makecode-image');

        if (!imageData) {
            const textData = ev.clipboardData.getData("text/plain");
            // text data contains string that 'looks like' an image
            const res = /img(`|\(""")[\s\da-f.#tngrpoyw]+(`|"""\))/im.exec(textData);
            if (res) {
                imageData = res[0];
            }
        }

        const image = imageData && pxt.sprite.imageLiteralToBitmap(imageData);

        if (image && image.width && image.height) {
            ev.preventDefault();

            // force marquee tool so the pasted selection can be moved
            if (this.props.tool !== ImageEditorTool.Marquee) {
                this.props.dispatchChangeImageTool(ImageEditorTool.Marquee);
            }

            this.editState.mergeFloatingLayer();
            this.editState.setFloatingLayer(image);
            this.props.dispatchImageEdit(this.editState.toImageState());
        }
    }

    protected updateCursorLocation(coord: ClientCoordinates): boolean {
        if (!coord) {
            if (this.cursorLocation) {
                this.cursorLocation = null;
                this.props.dispatchChangeCursorLocation(null);
                if (!this.edit) this.redraw();
            }
            return false;
        }

        if (this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor(((coord.clientX - rect.left) / rect.width) * this.imageWidth);
            const y = Math.floor(((coord.clientY - rect.top) / rect.height) * this.imageHeight);

            if (!this.cursorLocation || x !== this.cursorLocation[0] || y !== this.cursorLocation[1]) {
                this.cursorLocation = [x, y, coord.clientX, coord.clientY];
                if (this.hasHover)
                    this.props.dispatchChangeCursorLocation(this.cursorLocation);

                if (!this.edit) this.redraw();

                this.updateCursor(!!this.edit, this.editState.inFloatingLayer(x, y));
                return true;
            }

            return false;
        }

        this.cursorLocation = [0, 0, coord.clientX, coord.clientY];
        return false;
    }

    protected updateCursor(isDown: boolean, inLayer: boolean) {
        const { tool } = this.props;
        const def = tools.find(td => td.tool === tool);

        if (!def) this.updateCursorCore(ToolCursor.Default)
        else if (inLayer) {
            if (isDown) {
                this.updateCursorCore(def.downLayerCursor || def.hoverLayerCursor || def.downCursor || def.hoverCursor);
            }
            else {
                this.updateCursorCore(def.hoverLayerCursor || def.hoverCursor);
            }
        }
        else if (isDown) {
            this.updateCursorCore(def.downCursor || def.hoverCursor);
        }
        else {
            this.updateCursorCore(def.hoverCursor);
        }
    }

    protected updateCursorCore(cursor: ToolCursor | string) {
        this.cursor = cursor || ToolCursor.Default;

        this.updateBackground();
    }

    protected startEdit(isRightClick: boolean) {
        const { tool, toolWidth, selectedColor, backgroundColor, drawingMode } = this.props;

        const [x, y] = this.cursorLocation;

        if (this.inBounds(x, y) || this.isResizing) {
            // The resize handles can be out of the canvas, but we want to allow it
            let color = drawingMode == TileDrawingMode.Wall
                ? WALL_COLOR
                : (isRightClick ? backgroundColor : selectedColor);
            this.edit = getEdit(tool, this.editState, color, toolWidth);
            this.edit.originalImage = this.originalImage;
            this.edit.start(this.cursorLocation[0], this.cursorLocation[1], this.cursorLocation[2], this.cursorLocation[3], this.editState);
        }
    }

    protected updateEdit(x: number, y: number) {
        if (this.edit && (this.edit.inBounds(x, y) || this.isResizing)) {
            this.edit.update(x, y);
            this.redraw();
        }
    }

    protected commitEdit(clearImage = true) {
        const { dispatchImageEdit } = this.props;
        const imageState = this.getImageState();

        if (this.edit) {
            this.editState = getEditState(imageState, this.props.isTilemap, this.props.drawingMode);
            this.edit.doEdit(this.editState);
            if (clearImage) {
                this.originalImage = undefined;
            } else {
                this.originalImage = this.edit.originalImage;
            }
            this.edit = undefined;

            dispatchImageEdit(this.editState.toImageState());
        }
    }

    protected redraw() {
        const { prevFrame: nextFrame, onionSkinEnabled, selectedColor, toolWidth, drawingMode, tool } = this.props;
        const imageState = this.getImageState();
        const activeColor = drawingMode == TileDrawingMode.Wall ? WALL_COLOR : selectedColor;
        let shouldCenter = false;

        if (this.canvas) {
            this.imageWidth = imageState.bitmap.width;
            this.imageHeight = imageState.bitmap.height;

            shouldCenter = this.canvas.width != imageState.bitmap.width * this.cellWidth ||
                this.canvas.height != imageState.bitmap.height * this.cellWidth;

            this.canvas.width = imageState.bitmap.width * this.cellWidth;
            this.canvas.height = imageState.bitmap.height * this.cellWidth;

            this.canvasLayers.forEach(layer => {
                layer.width = this.canvas.width / this.cellWidth;
                layer.height = this.canvas.height / this.cellWidth;
            })

            if (onionSkinEnabled && nextFrame) {
                const next = getEditState(nextFrame, this.props.isTilemap, drawingMode);
                const context = this.canvas.getContext("2d");

                context.globalAlpha = 0.5;

                this.drawImage(next.image);
                if (next.floating && next.floating.image) {
                    this.drawImage(next.floating.image, next.layerOffsetX, next.layerOffsetY, true);
                }

                context.globalAlpha = 1;
            }

            if (this.edit) {
                const clone = this.editState.copy();
                clone.setActiveLayer(drawingMode);
                this.edit.doEdit(clone);
                this.drawImage(clone.image, 0, 0, !!(onionSkinEnabled && nextFrame));
                this.drawOverlayLayers(clone.overlayLayers);
                this.redrawFloatingLayer(clone);
            }
            else {
                this.drawImage(this.editState.image, 0, 0, !!(onionSkinEnabled && nextFrame));
                this.drawOverlayLayers(this.editState.overlayLayers);
                this.redrawFloatingLayer(this.editState);

                if (this.cursorLocation && this.shouldDrawCursor()) {
                    const color = tool === ImageEditorTool.Erase ? 0 : activeColor;
                    this.drawCursor(this.cursorLocation[0] - (toolWidth >> 1), this.cursorLocation[1] - (toolWidth >> 1), toolWidth, color);
                }
            }

            // Only redraw checkerboard if the image size has changed
            if (this.background && (this.background.width != this.canvas.width << 1 || this.background.height != this.canvas.height << 1)) {
                this.background.width = this.canvas.width << 1;
                this.background.height = this.canvas.height << 1;

                const ctx = this.background.getContext("2d");
                ctx.imageSmoothingEnabled = false;
                ctx.fillStyle = "#aeaeae";
                ctx.fillRect(0, 0, this.background.width, this.background.height);

                ctx.fillStyle = "#dedede";

                const bh = this.imageHeight << 1;
                const bw = this.imageWidth << 1;

                for (let x = 0; x < bw; x++) {
                    for (let y = 0; y < bh; y++) {
                        if ((x + y) & 1) {
                            ctx.fillRect(x * this.cellWidth, y * this.cellWidth, this.cellWidth, this.cellWidth);
                        }
                    }
                }
            }
        }

        if (shouldCenter) {
            this.zoomToCanvas();
        }
    }

    protected drawImage(bitmap: pxt.sprite.Bitmap, x0 = 0, y0 = 0, transparent = false, alpha = !this.props.lightMode) {
        if (this.props.isTilemap) this.drawTilemap(bitmap, x0, y0, transparent, alpha);
        else this.drawBitmap(bitmap, x0, y0, transparent, alpha);
    }

    protected redrawFloatingLayer(state: EditState, skipImage = false) {
        const floatingRect = this.refs["floating-layer-border"] as HTMLDivElement;
        const nwCorner = this.refs["floating-layer-nw-corner"] as HTMLDivElement;
        const neCorner = this.refs["floating-layer-ne-corner"] as HTMLDivElement;
        const seCorner = this.refs["floating-layer-se-corner"] as HTMLDivElement;
        const swCorner = this.refs["floating-layer-sw-corner"] as HTMLDivElement;

        const cornerHandles = [nwCorner, neCorner, seCorner, swCorner];
        if (state.floating && state.floating.image) {
            if (!skipImage) {
                this.drawImage(state.floating.image, state.layerOffsetX, state.layerOffsetY, true);
                if (state.floating.overlayLayers) this.drawOverlayLayers(state.floating.overlayLayers, state.layerOffsetX, state.layerOffsetY);
            }

            const rect = this.canvas.getBoundingClientRect();

            const left = Math.max(state.layerOffsetX, 0)
            const top = Math.max(state.layerOffsetY, 0)
            const right = Math.min(state.layerOffsetX + state.floating.image.width, state.width);
            const bottom = Math.min(state.layerOffsetY + state.floating.image.height, state.height);

            const xScale = rect.width / state.width;
            const yScale = rect.height / state.height;

            floatingRect.style.display = ""

            if (right - left < 1 || bottom - top < 1) floatingRect.style.display = "none";

            const calcLeft = (-this.panX + xScale * left);
            const calcTop = (-this.panY + yScale * top);
            const calcWidth = (xScale * (right - left))
            const calcHeight = (yScale * (bottom - top))

            floatingRect.style.left =  calcLeft + "px";
            floatingRect.style.top = calcTop + "px";
            floatingRect.style.width = calcWidth + "px";
            floatingRect.style.height = calcHeight + "px";

            floatingRect.style.borderLeft = state.layerOffsetX >= 0 ? "" : "none";
            floatingRect.style.borderTop = state.layerOffsetY >= 0 ? "" : "none";
            floatingRect.style.borderRight = state.layerOffsetX + state.floating.image.width <= state.width ? "" : "none";
            floatingRect.style.borderBottom = state.layerOffsetY + state.floating.image.height <= state.height ? "" : "none";

            const hasHandles = nwCorner != undefined;
            if (hasHandles) {
                const handleWidth = 16;
                const borderThickness = 3;

                if (!this.props.isTilemap) {
                    cornerHandles.forEach( corner => {
                        corner.style.display = ""
                        corner.style.width = handleWidth + "px";
                        corner.style.height = handleWidth + "px";
                        corner.style.border = borderThickness + "px solid black"
                        corner.style.position = "absolute";
                        corner.style.backgroundColor = "white";
                    })
                    nwCorner.style.left = (calcLeft - handleWidth ) + "px";
                    nwCorner.style.top = (calcTop - handleWidth) + "px";
                    nwCorner.style.cursor = "nw-resize"

                    neCorner.style.left = (calcLeft + calcWidth) + "px";
                    neCorner.style.top = (calcTop - handleWidth) + "px";
                    neCorner.style.cursor = "ne-resize"

                    seCorner.style.left = (calcLeft + calcWidth) + "px";
                    seCorner.style.top = (calcTop + calcHeight) + "px";
                    seCorner.style.cursor = "se-resize"

                    swCorner.style.left = (calcLeft - handleWidth) + "px";
                    swCorner.style.top = (calcTop + calcHeight) + "px";
                    swCorner.style.cursor = "sw-resize"
                }
            }
        }
        else {
            floatingRect.style.display = "none"
            cornerHandles.forEach(corner => {
                if (corner)
                    corner.style.display = "none"
            })
        }
    }

    protected drawOverlayLayers(layers: pxt.sprite.Bitmap[], x0 = 0, y0 = 0, alpha = !this.props.lightMode) {
        if (layers) {
            layers.forEach((layer, index) => {
                this.drawBitmap(layer, x0, y0, true, alpha, this.canvasLayers[index]);
            })
        }
    }

    protected drawBitmap(bitmap: pxt.sprite.Bitmap, x0 = 0, y0 = 0, transparent = false, alpha = !this.props.lightMode, target = this.canvas) {
        const { colors } = this.props;

        const context = target.getContext("2d");
        context.imageSmoothingEnabled = false;
        for (let x = 0; x < bitmap.width; x++) {
            for (let y = 0; y < bitmap.height; y++) {
                const index = bitmap.get(x, y);

                if (index) {
                    context.fillStyle = colors[index];
                    context.fillRect(x + x0, y + y0, 1, 1);
                }
                else {
                    if (!transparent) context.clearRect(x + x0, y + y0, 1, 1);
                }
            }
        }
    }

    protected generateTile(index: number, tileset: pxt.TileSet) {
        if (!tileset.tiles[index]) {
            return null;
        }
        const tileImage = document.createElement("canvas");
        tileImage.width = tileset.tileWidth;
        tileImage.height = tileset.tileWidth;
        this.drawBitmap(pxt.sprite.Bitmap.fromData(tileset.tiles[index].bitmap), 0, 0, false, !this.props.lightMode, tileImage);
        this.tileCache[tileset.tiles[index].id] = tileImage;
        return tileImage;
    }

    protected drawTilemap(tilemap: pxt.sprite.Bitmap, x0 = 0, y0 = 0, transparent = false, alpha = !this.props.lightMode, target = this.canvas) {
        const { tilemapState: { tileset } } = this.props;

        const context = target.getContext("2d");
        let index: number;
        let tileImage: HTMLCanvasElement;

        if (this.tileCacheRevision !== this.props.tilesetRevision) {
            this.tileCache = {};
            this.tileCacheRevision = this.props.tilesetRevision;
        }

        context.imageSmoothingEnabled = false;
        context.fillStyle = LIGHT_MODE_TRANSPARENT;
        for (let x = 0; x < tilemap.width; x++) {
            for (let y = 0; y < tilemap.height; y++) {
                index = tilemap.get(x, y);
                if (index && index < tileset.tiles.length) {
                    tileImage = this.tileCache[tileset.tiles[index].id];

                    if (!tileImage) {
                        tileImage = this.generateTile(index, tileset);
                    }

                    if (!tileImage) {
                        // invalid tileset index
                        continue;
                    }

                    context.drawImage(tileImage, (x + x0) * this.cellWidth, (y + y0) * this.cellWidth);
                }
                else {
                    if (!transparent) {
                        if (alpha) context.clearRect((x + x0) * this.cellWidth, (y + y0) * this.cellWidth, this.cellWidth, this.cellWidth);
                        else context.fillRect((x + x0) * this.cellWidth, (y + y0) * this.cellWidth, this.cellWidth, this.cellWidth);
                    }
                }
            }
        }
    }

    protected drawCursor(left: number, top: number, width: number, color: number) {
        const isDrawingWalls = this.props.isTilemap && this.props.drawingMode === TileDrawingMode.Wall;
        const canvas = isDrawingWalls ? this.canvasLayers[0] : this.canvas;
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = false;

        if (color && color !== -1) {
            if (this.props.isTilemap && !isDrawingWalls) {
                if (color >= this.props.tilemapState.tileset.tiles.length) return;

                let tileImage = this.tileCache[this.props.tilemapState.tileset.tiles[color].id];
                if (!tileImage) {
                    tileImage = this.generateTile(color, this.props.tilemapState.tileset);
                }

                if (!tileImage) {
                    // invalid tileset index
                    return;
                }

                for (let x = 0; x < width; x++) {
                    for (let y = 0; y < width; y++) {
                        context.drawImage(tileImage, (left + x) * this.cellWidth, (top + y) * this.cellWidth);
                    }
                }

            }
            else if (isDrawingWalls) {
                context.fillStyle = this.props.colors[color]
                context.fillRect(left, top, 1, 1);
            }
            else {
                context.fillStyle = this.props.colors[color]
                context.fillRect(left * this.cellWidth, top * this.cellWidth, width * this.cellWidth, width * this.cellWidth);
            }
        } else if (this.props.lightMode) {
            context.fillStyle = LIGHT_MODE_TRANSPARENT;
            context.fillRect(left * this.cellWidth, top * this.cellWidth, width * this.cellWidth, width * this.cellWidth);
        }
        else {
            context.clearRect(left * this.cellWidth, top * this.cellWidth, width * this.cellWidth, width * this.cellWidth);
        }
    }

    protected updateBackground() {
        (this.refs["canvas-bounds"] as HTMLDivElement).style.cursor = this.cursor;
        this.canvas.style.cursor = this.cursor;
        this.updateZoom(0);
    }

    protected updateZoom(delta: number, anchorX?: number, anchorY?: number) {
        const outer = this.refs["canvas-bounds"] as HTMLDivElement;
        if (this.canvas && outer) {
            const bounds = outer.getBoundingClientRect();

            anchorX = anchorX === undefined ? bounds.left + (bounds.width >> 1) : anchorX;
            anchorY = anchorY === undefined ? bounds.top + (bounds.height >> 1) : anchorY;

            const { canvasX: oldX, canvasY: oldY } = this.clientToCanvas(anchorX, anchorY, bounds);

            this.zoom = Math.max(this.zoom + delta, 2.5);

            const unit = this.getCanvasUnit(bounds);

            if (unit) {
                const { canvasX, canvasY } = this.clientToCanvas(anchorX, anchorY, bounds);

                if (isNaN(canvasX) || isNaN(canvasY) || isNaN(oldX) || isNaN(oldY)) {
                    return;
                }

                this.panX += (oldX - canvasX) * unit;
                this.panY += (oldY - canvasY) * unit;
            }

            this.applyZoom();
        }
    }

    protected getCenteredPan(): [number, number] {
        let [resX, resY] = [0, 0]

        const outer = this.refs["canvas-bounds"] as HTMLDivElement;
        const bounds = outer.getBoundingClientRect();
        const canvasBounds = this.canvas.getBoundingClientRect();

        if (canvasBounds.width < bounds.width) {
            resX = -((bounds.width >> 1) - (canvasBounds.width >> 1));
        }

        if (canvasBounds.height < bounds.height) {
            resY = -((bounds.height >> 1) - (canvasBounds.height >> 1));
        }

        return [resX, resY]
    }

    protected zoomToCanvas() {
        this.zoom = 10;
        const outer = this.refs["canvas-bounds"] as HTMLDivElement;

        this.applyZoom();
        if (this.canvas && outer) {
            [this.panX, this.panY] = this.getCenteredPan()
        }
        this.applyZoom();
    }

    protected applyZoom(bounds?: ClientRect) {
        const outer = this.refs["canvas-bounds"] as HTMLDivElement;
        if (this.canvas && outer) {
            bounds = bounds || outer.getBoundingClientRect();

            const unit = this.getCanvasUnit(bounds);

            if (unit === 0) {
                if (this.waitingToZoom) return;
                this.waitingToZoom = true;
                requestAnimationFrame(() => {
                    if (this.waitingToZoom) {
                        this.waitingToZoom = false;
                        this.applyZoom()
                    }
                });
                return;
            }
            this.waitingToZoom = false;

            const newWidth = unit * this.imageWidth;
            const newHeight = unit * this.imageHeight;
            const minimumVisible = this.imageWidth > 1 && this.imageHeight > 1 ? unit * 2 : unit >> 1;

            // Hack: If the user hasn't interacted, don't trust the pan since this can
            // drift for buggy reasons during init. Probably we should fix this, if you
            // do, remove the "hasInteracted" variable.
            if (!this.hasInteracted) {
                [this.panX, this.panY] = this.getCenteredPan();
            }

            this.panX = Math.max(Math.min(this.panX, newWidth - minimumVisible), -(bounds.width - minimumVisible));
            this.panY = Math.max(Math.min(this.panY, newHeight - minimumVisible), -(bounds.height - minimumVisible));

            this.canvas.style.position = "fixed"
            this.canvas.style.width = `${newWidth}px`;
            this.canvas.style.height = `${newHeight}px`;
            this.canvas.style.left = `${-this.panX}px`
            this.canvas.style.top = `${-this.panY}px`

            this.canvas.style.clipPath = `polygon(${this.panX}px ${this.panY}px, ${this.panX + bounds.width}px ${this.panY}px, ${this.panX + bounds.width}px ${this.panY + bounds.height}px, ${this.panX}px ${this.panY + bounds.height}px)`;
            // this.canvas.style.imageRendering = "pixelated"

            if (this.background) this.cloneCanvasStyle(this.canvas, this.background);
            this.canvasLayers.forEach(layer => this.cloneCanvasStyle(this.canvas, layer));

            this.redrawFloatingLayer(this.editState, true);
        }
    }

    protected selectCanvasColor(coord: ClientCoordinates, isRightClick?: boolean) {
        const outer = this.refs["canvas-bounds"] as HTMLDivElement;
        const bounds = outer.getBoundingClientRect();
        let { canvasX, canvasY } = this.clientToCanvas(coord.clientX, coord.clientY, bounds);

        canvasX = Math.floor(canvasX);
        canvasY = Math.floor(canvasY);

        let color: number;
        if (this.editState.inFloatingLayer(canvasX, canvasY)) {
            color = this.editState.floating.image.get(canvasX - this.editState.layerOffsetX, canvasY - this.editState.layerOffsetY)
        }
        if (!color) {
            color = this.editState.image.get(canvasX, canvasY)
        }

        if (isRightClick) {
            this.props.dispatchChangeBackgroundColor(color);
        } else {
            this.props.dispatchChangeSelectedColor(color);
        }
    }

    protected selectAll() {
        // force marquee tool so selection can be moved
        if (this.props.tool !== ImageEditorTool.Marquee) {
            this.props.dispatchChangeImageTool(ImageEditorTool.Marquee);
        }

        this.editState.mergeFloatingLayer();
        this.editState.copyToLayer(0, 0, this.imageWidth, this.imageHeight, true);
        this.props.dispatchImageEdit(this.editState.toImageState());
    }

    protected cancelSelection() {
        this.editState.mergeFloatingLayer();
        this.props.dispatchImageEdit(this.editState.toImageState());
    }

    protected deleteSelection() {
        this.editState.floating = null;
        this.props.dispatchImageEdit(this.editState.toImageState());
    }

    protected cloneCanvasStyle(base: HTMLCanvasElement, target: HTMLCanvasElement) {
        target.style.position = base.style.position;
        target.style.width = base.style.width;
        target.style.height = base.style.height;
        target.style.left = base.style.left;
        target.style.top = base.style.top;
        target.style.clipPath = base.style.clipPath;
    }

    protected clientToCanvas(clientX: number, clientY: number, bounds: ClientRect) {
        const unit = this.getCanvasUnit(bounds);

        return {
            canvasX: ((clientX - bounds.left + this.panX) / unit),
            canvasY: ((clientY - bounds.top + this.panY) / unit)
        }
    }

    /**
     * Gets the pixel side-length for canvas to fit in the bounds at a zoom of 1
     * @param bounds The bounds in which the canvas is contained
     */
    protected getCanvasUnit(bounds: ClientRect) {
        const boundsRatio = bounds.width / bounds.height;
        const imageRatio = this.imageWidth / this.imageHeight;
        const zm = Math.pow(this.zoom / 10, 2);

        if (boundsRatio > imageRatio) {
            return zm * (bounds.height / this.imageHeight);
        }
        else {
            return zm * (bounds.width / this.imageWidth);
        }
    }

    protected inBounds(x: number, y: number) {
        return x >= 0 && x < this.imageWidth && y >= 0 && y < this.imageHeight;
    }

    protected isPanning() {
        return this.props.tool === ImageEditorTool.Pan;
    }

    protected touchesResize(cursorX: number, cursorY: number) {
        const hovered = document.querySelectorAll( ":hover" );
        for ( let i = 0; i < hovered.length; i ++){
            if (hovered[i].className == "image-editor-floating-layer-corner") {
                return true;
            }
        }
        return false
    }

    protected isColorSelect() {
        return this.props.tool === ImageEditorTool.ColorSelect;
    }

    protected shouldHandleCanvasShortcut() {
        // canvas shortcuts (select all; delete) should only be handled if the focus is not within an input element
        return !(this.props.suppressShortcuts || document.activeElement instanceof HTMLInputElement);
    }

    protected preventContextMenu = (ev: React.MouseEvent<any>) => ev.preventDefault();

    protected shouldDrawCursor() {
        if (!this.hasHover) return false;

        switch (this.props.tool) {
            case ImageEditorTool.Fill:
            case ImageEditorTool.Marquee:
            case ImageEditorTool.Pan:
            case ImageEditorTool.ColorSelect:
                return false;
            default:
                return true;
        }
    }

    protected getImageState(): pxt.sprite.ImageState {
        return this.props.isTilemap ? this.props.tilemapState.tilemap : this.props.imageState;
    }

    protected applyTilemapPatch(patch: TilemapPatch) {
        const { tilemapState, dispatchCreateNewTile, gallery, backgroundColor } = this.props;
        const { tileset } = tilemapState;

        const copiedMap = pxt.sprite.tilemapLiteralToTilemap(patch.map);
        if (!copiedMap || !copiedMap.width || !copiedMap.height) {
            return;
        }

        const copiedTiles = patch.tiles.map(copiedTile => pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${copiedTile}`));

        const copiedLayers = patch.layers.map(encoded => pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${encoded}`));
        const tileMapping: number[] = [];

        let nextIndex = tileset.tiles.length;

        // Create any missing tiles
        for (const copiedTile of copiedTiles) {
            const existing = tileset.tiles.findIndex(tile => copiedTile.equals(pxt.sprite.Bitmap.fromData(tile.bitmap)));

            if (existing >= 0) {
                tileMapping.push(existing);
                continue;
            }

            if (gallery) {
                const galleryItem = gallery.find(tile => copiedTile.equals(pxt.sprite.Bitmap.fromData(tile.bitmap)));

                if (galleryItem) {
                    dispatchCreateNewTile(null, tileset.tiles.length, backgroundColor, galleryItem.qualifiedName);
                    tileMapping.push(nextIndex);
                    nextIndex++;
                    continue;
                }
            }

            dispatchCreateNewTile(createTile(copiedTile.data()), tileset.tiles.length, backgroundColor);
            tileMapping.push(nextIndex);
            nextIndex++;
        }

        this.editState.mergeFloatingLayer();

        const pastedMap = new pxt.sprite.Tilemap(copiedMap.width, copiedMap.height);
        for (let x = 0; x < pastedMap.width; x++) {
            for (let y = 0; y < pastedMap.height; y++) {
                pastedMap.set(x, y, tileMapping[copiedMap.get(x, y)]);
            }
        }

        this.editState.floating = {
            image: pastedMap,
            overlayLayers: copiedLayers
        };
        this.editState.layerOffsetX = 0;
        this.editState.layerOffsetY = 0;

        this.props.dispatchImageEdit(this.editState.toImageState());
    }
}

function mapStateToProps({ store: { present }, editor }: ImageEditorStore) {
    if (editor.isTilemap) {
        let state = (present as TilemapState);
        if (!state) return {} as ImageCanvasProps;
        return {
            selectedColor: editor.selectedColor,
            tilemapState: state,
            tool: editor.tool,
            toolWidth: editor.cursorSize,
            zoomDelta: editor.zoomDelta,
            onionSkinEnabled: false,
            overlayEnabled: editor.overlayEnabled,
            backgroundColor: editor.backgroundColor,
            colors: state.colors,
            isTilemap: editor.isTilemap,
            drawingMode: editor.drawingMode,
            gallery: editor.tileGallery,
            tilesetRevision: editor.tilesetRevision
        } as ImageCanvasProps
    }

    let state = (present as AnimationState);
    if (!state) return {} as ImageCanvasProps;

    return {
        selectedColor: editor.selectedColor,
        colors: state.colors,
        imageState: state.frames[state.currentFrame],
        tool: editor.tool,
        toolWidth: editor.cursorSize,
        zoomDelta: editor.zoomDelta,
        onionSkinEnabled: editor.onionSkinEnabled,
        backgroundColor: editor.backgroundColor,
        prevFrame: state.frames[state.currentFrame - 1],
        isTilemap: editor.isTilemap,
        tilesetRevision: editor.tilesetRevision
    } as ImageCanvasProps
}

interface Props {
    suppressShortcuts: boolean;
    lightMode: boolean;
}

export const ImageCanvas = (props: Props) => {
    const { state, dispatch } = React.useContext(ImageEditorContext);
    const mappedProps = mapStateToProps(state)

    return (
        <ImageCanvasImpl
            {...mappedProps}
            {...props}
            dispatchImageEdit={state => dispatch(imageEdit(state))}
            dispatchChangeZoom={zoom => dispatch(changeCanvasZoom(zoom))}
            dispatchChangeCursorLocation={location => dispatch(changeCursorLocation(location as unknown as [number, number]))}
            dispatchChangeImageTool={tool => dispatch(changeImageTool(tool))}
            dispatchChangeSelectedColor={color => dispatch(changeSelectedColor(color))}
            dispatchChangeBackgroundColor={color => dispatch(changeBackgroundColor(color))}
            dispatchCreateNewTile={(tile, fg, bg, qname) => dispatch(createNewTile(tile, fg, bg, qname))}
        />
    );
}
