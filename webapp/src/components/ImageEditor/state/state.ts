import { AlertInfo } from "../Alert";
import { emptyFrame } from "../util";

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
    kind: "Animation";
    asset?: pxt.Asset;
    visible: boolean;
    colors: string[];

    aspectRatioLocked: boolean;

    currentFrame: number;
    frames: pxt.sprite.ImageState[];
    interval: number;
}

export interface TilemapState {
    kind: "Tilemap";
    asset?: pxt.Asset;
    tileset: pxt.TileSet;
    aspectRatioLocked: boolean;
    tilemap: pxt.sprite.ImageState;
    colors: string[];
    nextId: number;
}

// State that is not on the undo/redo stack
export interface EditorState {
    selectedColor: number;
    backgroundColor: number;

    tilemapPalette?: TilemapPaletteState;
    tileGalleryOpen?: boolean;

    isTilemap: boolean;
    referencedTiles?: string[];
    deletedTiles?: string[];
    editedTiles?: string[];

    // The state below this comment is not persisted between editor reloads
    previewAnimating: boolean;
    tool: ImageEditorTool;
    cursorLocation?: [number, number];
    zoomDelta?: number;
    onionSkinEnabled: boolean;
    drawingMode?: TileDrawingMode;
    tileGallery?: GalleryTile[];
    editingTile?: TileEditContext;
    cursorSize: CursorSize;
    overlayEnabled?: boolean;
    alert?: AlertInfo;
    resizeDisabled?: boolean;
    tilesetRevision: number; // used to track changes to the tileset and invalidate the tile cache in ImageCanvas
}

export interface GalleryTile {
    qualifiedName: string;
    bitmap: pxt.sprite.BitmapData;
    tags: string[];
    tileWidth: number;
}

export interface TilemapPaletteState {
    category: TileCategory;
    page: number;
}

export interface ImageEditorStore {
    store: EditorStore;

    editor: EditorState;
}

export interface TileEditContext {
    type: "new" | "edit";
    tilesetIndex: number;
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

const initialState: AnimationState = {
    kind: "Animation",
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

export const initialStore: ImageEditorStore = {
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
        overlayEnabled: true,
        tilesetRevision: 0,
        isTilemap: false
    }
}