import * as actions from '../actions/types'

export enum ImageEditorTool {
    Paint,
    Fill,
    Line,
    Erase,
    Circle,
    Rect,
    ColorSelect,
    Marquee,
    Pan
}

export const enum CursorSize {
    One = 1,
    Three = 3,
    Five = 5
}

export const enum KeyModifiers {
    Alt = 1 << 0,
    Shift = 1 << 1
}

export enum TileCategory {
    Forest,
    Aquatic,
    Dungeon,
    Misc,
}

export enum TileDrawingMode {
    Default = "default",
    Wall = "wall"
}

// State that goes on the undo/redo stack
export interface AnimationState {
    visible: boolean;
    colors: string[];

    aspectRatioLocked: boolean;

    currentFrame: number;
    frames: pxt.sprite.ImageState[];
    interval: number;
}

export interface TilemapState {
    tileset: pxt.sprite.TileSet;
    aspectRatioLocked: boolean;
    tilemap: pxt.sprite.ImageState;
    colors: string[];
}

// State that is not on the undo/redo stack
export interface EditorState {
    previewAnimating: boolean;
    isTilemap: boolean;

    selectedColor: number;
    backgroundColor: number;

    tool: ImageEditorTool;
    cursorSize: CursorSize;
    cursorLocation?: [number, number];
    zoomDelta?: number;
    onionSkinEnabled: boolean;
    tilemapPalette?: TilemapPaletteState;
    drawingMode?: TileDrawingMode;
}

export interface TilemapPaletteState {
    category: TileCategory;
    page: number;
}

export interface ImageEditorStore {
    store: EditorStore;

    editor: EditorState;
}

export interface EditorStore {
    past: (AnimationState | TilemapState)[];
    present: AnimationState | TilemapState;
    future: (AnimationState | TilemapState)[];
}

export interface AnimationStore {
}

export interface TilemapStore {
    past: TilemapState[];
    present: TilemapState;
    future: TilemapState[];
}

const initialState: AnimationState =  {
    visible: true,
    colors: [
        "#000000",
        "#ffffff",
        "#ff2121",
        "#ff93c4",
        "#ff8135",
        "#fff609",
        "#249ca3",
        "#78dc52",
        "#003fad",
        "#87f2ff",
        "#8e2ec4",
        "#a4839f",
        "#5c406c",
        "#e5cdc4",
        "#91463d",
        "#000000"
    ],

    aspectRatioLocked: false,

    currentFrame: 0,
    frames: [emptyFrame(16, 16)],
    interval: 200
}

const initialStore: ImageEditorStore = {
    store: {
        present: initialState,
        past: [],
        future: [],
    },
    editor: {
        selectedColor: 3,
        tool: ImageEditorTool.Paint,
        cursorSize: CursorSize.One,
        backgroundColor: 1,
        previewAnimating: false,
        onionSkinEnabled: false,
        isTilemap: false
    }
}

const topReducer = (state: ImageEditorStore = initialStore, action: any): ImageEditorStore => {
    switch (action.type) {
        case actions.CHANGE_PREVIEW_ANIMATING:
        case actions.CHANGE_CANVAS_ZOOM:
        case actions.CHANGE_IMAGE_TOOL:
        case actions.CHANGE_CURSOR_SIZE:
        case actions.CHANGE_SELECTED_COLOR:
        case actions.CHANGE_CURSOR_LOCATION:
        case actions.CHANGE_BACKGROUND_COLOR:
        case actions.SWAP_FOREGROUND_BACKGROUND:
        case actions.TOGGLE_ONION_SKIN_ENABLED:
        case actions.CHANGE_TILE_PALETTE_PAGE:
        case actions.CHANGE_TILE_PALETTE_CATEGORY:
        case actions.CHANGE_DRAWING_MODE:
            return {
                ...state,
                editor: editorReducer(state.editor, action)
            };
        case actions.SET_INITIAL_STATE:
            return {
                ...state,
                editor: action.state,
                store: {
                    ...state.store,
                    past: action.past || state.store.past,
                    future: action.past ? [] : state.store.future
                }
            };
        case actions.UNDO_IMAGE_EDIT:
            if (!state.store.past.length) return state;

            tickEvent(`undo`);
            return {
                ...state,
                store: {
                    ...state.store,
                    past: state.store.past.slice(0, state.store.past.length - 1),
                    present: state.store.past[state.store.past.length - 1],
                    future: [...state.store.future, state.store.present]
                }
            };
        case actions.REDO_IMAGE_EDIT:
            if (!state.store.future.length) return state;

            tickEvent(`redo`);
            return {
                ...state,
                store: {
                    ...state.store,
                    past: [...state.store.past, state.store.present],
                    present: state.store.future[state.store.future.length - 1],
                    future: state.store.future.slice(0, state.store.future.length - 1),
                }
            };
        case actions.SET_INITIAL_FRAMES:
            return {
                ...state,
                editor: {
                    ...state.editor,
                    isTilemap: false,
                },
                store: {
                    ...state.store,
                    past: [],
                    present: {
                        visible: true,
                        colors: [
                            "#000000",
                            "#ffffff",
                            "#ff2121",
                            "#ff93c4",
                            "#ff8135",
                            "#fff609",
                            "#249ca3",
                            "#78dc52",
                            "#003fad",
                            "#87f2ff",
                            "#8e2ec4",
                            "#a4839f",
                            "#5c406c",
                            "#e5cdc4",
                            "#91463d",
                            "#000000"
                        ],

                        aspectRatioLocked: false,

                        currentFrame: 0,
                        frames: action.frames,
                        interval: action.interval
                    },
                    future: []
                }
            }
        case actions.SET_INITIAL_TILEMAP:
            return {
                ...state,
                editor: {
                    ...state.editor,
                    isTilemap: true,
                    tilemapPalette: {
                        category: TileCategory.Forest,
                        page: 0
                    },
                    drawingMode: TileDrawingMode.Default
                },
                store: {
                    ...state.store,
                    past: [],
                    present: {
                        colors: [
                            "#000000",
                            "#ffffff",
                            "#ff2121",
                            "#ff93c4",
                            "#ff8135",
                            "#fff609",
                            "#249ca3",
                            "#78dc52",
                            "#003fad",
                            "#87f2ff",
                            "#8e2ec4",
                            "#a4839f",
                            "#5c406c",
                            "#e5cdc4",
                            "#91463d",
                            "#000000"
                        ],
                        aspectRatioLocked: false,
                        tilemap: {
                            bitmap: action.tilemap,
                            overlayLayers: action.layers
                        },
                        tileset: action.tileset
                    },
                    future: []
                }
            };
        default:
            return {
                ...state,
                store: {
                    ...state.store,
                    past: [...state.store.past, state.store.present],
                    present: state.editor.isTilemap ? tilemapReducer(state.store.present as TilemapState, action) : animationReducer(state.store.present as AnimationState, action),
                    future: []
                }
            }
    }
}


const animationReducer = (state: AnimationState, action: any): AnimationState => {
    switch (action.type) {
        case actions.TOGGLE_ASPECT_RATIO:
            tickEvent(`toggle-aspect-ratio-lock`);
            return { ...state, aspectRatioLocked: !state.aspectRatioLocked };
        case actions.CHANGE_CURRENT_FRAME:
            tickEvent(`change-frame`);
            return { ...state, currentFrame: action.index };
        case actions.CHANGE_INTERVAL:
            tickEvent(`change-interval`);
            return { ...state, interval: action.newInterval };
        case actions.CHANGE_IMAGE_DIMENSIONS:
            tickEvent(`change-dimensions`);
            const [width, height] = action.imageDimensions as [number, number];
            return {
                ...state,
                frames: state.frames.map((frame, index) => ({
                    ...frame,
                    bitmap: pxt.sprite.Bitmap.fromData(frame.bitmap).resize(width, height).data()
                }))
            };
        case actions.IMAGE_EDIT:
            tickEvent(`image-edit`);
            return {
                ...state,
                frames: state.frames.map((frame, index) => (
                    index === state.currentFrame ? action.newState : frame))
            };
        case actions.DELETE_FRAME:
            if (state.frames.length === 1) return state;

            tickEvent(`delete-frame`);
            const newFrames = state.frames.slice();
            newFrames.splice(action.index, 1);

            let newFrame = state.currentFrame;
            if (state.currentFrame >= action.index && state.currentFrame > 0) {
                newFrame--;
            }

            return {
                ...state,
                currentFrame: newFrame,
                frames: newFrames
            }
        case actions.DUPLICATE_FRAME:
            tickEvent(`duplicate-frame`);
            const frames = state.frames.slice();
            frames.splice(action.index, 0, cloneImage(state.frames[action.index]))
            return {
                ...state,
                frames,
                currentFrame: action.index + 1
            };
        case actions.NEW_FRAME:
            tickEvent(`new-frame`);
            return {
                ...state,
                frames: [...state.frames, emptyFrame(state.frames[0].bitmap.width, state.frames[0].bitmap.height)],
                currentFrame: state.frames.length,
            };
        case actions.MOVE_FRAME:
            if (action.newIndex < 0 || action.newIndex >= state.frames.length ||
                action.newIndex < 0 || action.newIndex >= state.frames.length) return state;

            tickEvent(`move-frame`);
            const movedFrames = state.frames.slice();
            const toMove = movedFrames.splice(action.oldIndex, 1)[0];
            movedFrames.splice(action.newIndex, 0, toMove);
            return {
                ...state,
                frames: movedFrames,
                currentFrame: action.oldIndex === state.currentFrame ? action.newIndex : state.currentFrame
            }
        default:
            return state;
    }
}

const editorReducer = (state: EditorState, action: any): EditorState => {
    switch (action.type) {
        case actions.CHANGE_PREVIEW_ANIMATING:
            tickEvent(`preview-animate-${action.animating ? "on" : "off"}`)
            return { ...state, previewAnimating: action.animating };
        case actions.CHANGE_CANVAS_ZOOM:
            if (action.zoom > 0 || action.zoom < 0) {
                tickEvent(`zoom-${action.zoom > 0 ? "in" : "out"}`);
            }
            return { ...state, zoomDelta: action.zoom };
        case actions.CHANGE_IMAGE_TOOL:
            tickEvent(`change-tool-${ImageEditorTool[action.tool]}`);
            return { ...state, tool: action.tool };
        case actions.CHANGE_CURSOR_SIZE:
            tickEvent(`change-cursor-size-${action.cursorSize}`);
            return { ...state, cursorSize: action.cursorSize };
        case actions.CHANGE_SELECTED_COLOR:
            tickEvent(`foreground-color-${action.selectedColor}`);

            // If the selected tool is the eraser, make sure to switch to pencil
            return { ...state,
                selectedColor: action.selectedColor,
                tool: state.tool === ImageEditorTool.Erase ? ImageEditorTool.Paint : state.tool
            };
        case actions.CHANGE_CURSOR_LOCATION:
            return { ...state, cursorLocation: action.cursorLocation };
        case actions.CHANGE_BACKGROUND_COLOR:
            tickEvent(`background-color-${action.backgroundColor}`);
            return { ...state, backgroundColor: action.backgroundColor };
        case actions.SWAP_FOREGROUND_BACKGROUND:
            tickEvent(`swap-foreground-background`);
            return { ...state, backgroundColor: state.selectedColor, selectedColor: state.backgroundColor };
        case actions.TOGGLE_ONION_SKIN_ENABLED:
            tickEvent(`toggle-onion-skin`);
            return { ...state, onionSkinEnabled: !state.onionSkinEnabled };
        case actions.CHANGE_TILE_PALETTE_CATEGORY:
            tickEvent(`change-tile-category-${TileCategory[action.category]}`);
            return { ...state, tilemapPalette: { ...state.tilemapPalette, category: action.category, page: 0 } };
        case actions.CHANGE_TILE_PALETTE_PAGE:
            tickEvent(`change-tile-page`);
            return { ...state, tilemapPalette: { ...state.tilemapPalette, page: action.page } };
        case actions.CHANGE_DRAWING_MODE:
            tickEvent(`change-drawing-mode`);
            return { ...state, drawingMode: action.drawingMode || TileDrawingMode.Default };
    }
    return state;
}

const tilemapReducer = (state: TilemapState, action: any): TilemapState => {
    switch (action.type) {
        case actions.TOGGLE_ASPECT_RATIO:
            tickEvent(`toggle-aspect-ratio-lock`);
            return { ...state, aspectRatioLocked: !state.aspectRatioLocked };
        case actions.CHANGE_IMAGE_DIMENSIONS:
            tickEvent(`change-dimensions`);
            const [width, height] = action.imageDimensions as [number, number];
            return {
                ...state,
                tilemap: {
                    ...state.tilemap,
                    bitmap: pxt.sprite.Tilemap.fromData(state.tilemap.bitmap).resize(width, height).data()
                }
            };
        case actions.IMAGE_EDIT:
            tickEvent(`image-edit`);
            return {
                ...state,
                tilemap: action.newState
            };
        case actions.LAYER_EDIT:
            tickEvent(`layer-edit`);
            let layers = state.tilemap.overlayLayers;
            if (action.index > layers.length - 1) return state
            layers[action.index] = action.data;
            return {
                ...state,
                tilemap: {
                    ...state.tilemap,
                    overlayLayers: layers
                }
            }
        default:
            return state;
    }
}

function emptyFrame(width: number, height: number): pxt.sprite.ImageState {
    return {
        bitmap: new pxt.sprite.Bitmap(width, height).data()
    }
}

function cloneImage(state: pxt.sprite.ImageState): pxt.sprite.ImageState {
    return {
        ...state,
        bitmap: pxt.sprite.Bitmap.fromData(state.bitmap).copy().data(),
        floatingLayer: state.floatingLayer && pxt.sprite.Bitmap.fromData(state.floatingLayer).copy().data()
    };
}

let tickCallback: (event: string) => void;

function tickEvent(event: string) {
    if (tickCallback) {
        tickCallback(event)
    }
}

export function setTelemetryFunction(cb: (event: string) => void) {
    tickCallback = cb;
}

export default topReducer;