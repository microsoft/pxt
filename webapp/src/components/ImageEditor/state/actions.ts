import { AlertOption } from "../Alert";
import { AnimationState, CursorSize, EditorState, GalleryTile, ImageEditorTool, TileCategory, TileDrawingMode } from "./state";

type ActionBase = {
    type: string;
}

type SetInitialState = ActionBase & {
    type: "SET_INITIAL_STATE";
    state: EditorState;
    past: AnimationState[];
}

type SetFrames = ActionBase & {
    type: "SET_FRAMES";
    frames: pxt.sprite.ImageState[];
}

type ChangeImageTool = ActionBase & {
    type: "CHANGE_IMAGE_TOOL";
    tool: ImageEditorTool;
}

type ChangeCursorSize = ActionBase & {
    type: "CHANGE_CURSOR_SIZE";
    cursorSize: CursorSize;
}

type ChangeSelectedColor = ActionBase & {
    type: "CHANGE_SELECTED_COLOR";
    selectedColor: number;
}

type ChangeImageDimensions = ActionBase & {
    type: "CHANGE_IMAGE_DIMENSIONS";
    width: number;
    height: number;
}

type ChangeKeyModifiers = ActionBase & {
    type: "CHANGE_KEY_MODIFIERS";
    keyModifiers: number;
}

type ChangeCursorLocation = ActionBase & {
    type: "CHANGE_CURSOR_LOCATION";
    cursor: [number, number];
}

type ImageEdit = ActionBase & {
    type: "IMAGE_EDIT";
    newState: pxt.sprite.ImageState;
}

type UndoImageEdit = ActionBase & {
    type: "UNDO_IMAGE_EDIT";
}

type RedoImageEdit = ActionBase & {
    type: "REDO_IMAGE_EDIT";
}

type ToggleAspectRatio = ActionBase & {
    type: "TOGGLE_ASPECT_RATIO";
}

type SetGalleryOpen = ActionBase & {
    type: "SET_GALLERY_OPEN";
    isOpen: boolean;
}

type NewFrame = ActionBase & {
    type: "NEW_FRAME";
    index?: number;
}

type DeleteFrame = ActionBase & {
    type: "DELETE_FRAME";
    index: number;
}

type DuplicateFrame = ActionBase & {
    type: "DUPLICATE_FRAME";
    index: number;
}

type MoveFrame = ActionBase & {
    type: "MOVE_FRAME";
    oldIndex: number;
    newIndex: number;
}

type ChangeCurrentFrame = ActionBase & {
    type: "CHANGE_CURRENT_FRAME";
    index: number;
}

type ChangeInterval = ActionBase & {
    type: "CHANGE_INTERVAL";
    interval: number;
}

type ChangePreviewAnimating = ActionBase & {
    type: "CHANGE_PREVIEW_ANIMATING";
    isAnimating: boolean;
}

type ToggleOnionSkinEnabled = ActionBase & {
    type: "TOGGLE_ONION_SKIN_ENABLED";
}

type ChangeOverlayEnabled = ActionBase & {
    type: "CHANGE_OVERLAY_ENABLED";
    isEnabled: boolean;
}

type ChangeCanvasZoom = ActionBase & {
    type: "CHANGE_CANVAS_ZOOM";
    zoom: number;
}

type ShowAlert = ActionBase & {
    type: "SHOW_ALERT";
    title: string;
    text: string;
    options?: AlertOption[]
}

type HideAlert = ActionBase & {
    type: "HIDE_ALERT";
}

type SwapForegroundBackground = ActionBase & {
    type: "SWAP_FOREGROUND_BACKGROUND";
}

type ChangeBackgroundColor = ActionBase & {
    type: "CHANGE_BACKGROUND_COLOR";
    color: number;
}

type ChangeTilePalettePage = ActionBase & {
    type: "CHANGE_TILE_PALETTE_PAGE";
    page: number;
}

type ChangeTilePaletteCategory = ActionBase & {
    type: "CHANGE_TILE_PALETTE_CATEGORY";
    category: TileCategory;
}

type ChangeDrawingMode = ActionBase & {
    type: "CHANGE_DRAWING_MODE";
    drawingMode: TileDrawingMode;
}

type CreateNewTile = ActionBase & {
    type: "CREATE_NEW_TILE";
    tile: pxt.Tile;
    foreground: number;
    background: number;
    qualifiedName?: string;
}

type OpenTileEditor = ActionBase & {
    type: "OPEN_TILE_EDITOR";
    index?: number;
    id?: string;
}

type CloseTileEditor = ActionBase & {
    type: "CLOSE_TILE_EDITOR";
    result?: pxt.Tile;
    index?: number;
}

type DeleteTile = ActionBase & {
    type: "DELETE_TILE";
    index: number;
    id: string;
}

type DisableResize = ActionBase & {
    type: "DISABLE_RESIZE";
}

type ChangeAssetName = ActionBase & {
    type: "CHANGE_ASSET_NAME";
    name: string;
}

type OpenAsset = ActionBase & {
    type: "OPEN_ASSET";
    asset: pxt.Asset;
    keepPast: boolean;
    gallery?: GalleryTile[];
}

export type Action =
    | SetInitialState
    | SetFrames
    | ChangeImageTool
    | ChangeCursorSize
    | ChangeSelectedColor
    | ChangeImageDimensions
    | ChangeKeyModifiers
    | ChangeCursorLocation
    | ImageEdit
    | UndoImageEdit
    | RedoImageEdit
    | ToggleAspectRatio
    | SetGalleryOpen
    | NewFrame
    | DeleteFrame
    | DuplicateFrame
    | MoveFrame
    | ChangeCurrentFrame
    | ChangeInterval
    | ChangePreviewAnimating
    | ToggleOnionSkinEnabled
    | ChangeOverlayEnabled
    | ChangeCanvasZoom
    | ShowAlert
    | HideAlert
    | SwapForegroundBackground
    | ChangeBackgroundColor
    | ChangeTilePalettePage
    | ChangeTilePaletteCategory
    | ChangeDrawingMode
    | CreateNewTile
    | OpenTileEditor
    | CloseTileEditor
    | DeleteTile
    | DisableResize
    | ChangeAssetName
    | OpenAsset

const setInitialState = (state: EditorState, past: AnimationState[]): SetInitialState => ({
    type: "SET_INITIAL_STATE",
    state,
    past
});

const setFrames = (frames: pxt.sprite.ImageState[]): SetFrames => ({
    type: "SET_FRAMES",
    frames
});

const changeImageTool = (tool: ImageEditorTool): ChangeImageTool => ({
    type: "CHANGE_IMAGE_TOOL",
    tool
});

const changeCursorSize = (cursorSize: CursorSize): ChangeCursorSize => ({
    type: "CHANGE_CURSOR_SIZE",
    cursorSize
});

const changeSelectedColor = (selectedColor: number): ChangeSelectedColor => ({
    type: "CHANGE_SELECTED_COLOR",
    selectedColor
});

const changeImageDimensions = (width: number, height: number): ChangeImageDimensions => ({
    type: "CHANGE_IMAGE_DIMENSIONS",
    width,
    height
});

const changeKeyModifiers = (keyModifiers: number): ChangeKeyModifiers => ({
    type: "CHANGE_KEY_MODIFIERS",
    keyModifiers
});

const changeCursorLocation = (cursor: [number, number]): ChangeCursorLocation => ({
    type: "CHANGE_CURSOR_LOCATION",
    cursor
});

const imageEdit = (newState: pxt.sprite.ImageState): ImageEdit => ({
    type: "IMAGE_EDIT",
    newState
});

const undoImageEdit = (): UndoImageEdit => ({
    type: "UNDO_IMAGE_EDIT",
});

const redoImageEdit = (): RedoImageEdit => ({
    type: "REDO_IMAGE_EDIT",
});

const toggleAspectRatio = (): ToggleAspectRatio => ({
    type: "TOGGLE_ASPECT_RATIO",
});

const setGalleryOpen = (isOpen: boolean): SetGalleryOpen => ({
    type: "SET_GALLERY_OPEN",
    isOpen
});

const newFrame = (): NewFrame => ({
    type: "NEW_FRAME",
});

const deleteFrame = (index: number): DeleteFrame => ({
    type: "DELETE_FRAME",
    index
});

const duplicateFrame = (index: number): DuplicateFrame => ({
    type: "DUPLICATE_FRAME",
    index
});

const moveFrame = (oldIndex: number, newIndex: number): MoveFrame => ({
    type: "MOVE_FRAME",
    oldIndex,
    newIndex
});

const changeCurrentFrame = (index: number): ChangeCurrentFrame => ({
    type: "CHANGE_CURRENT_FRAME",
    index
});

const changeInterval = (interval: number): ChangeInterval => ({
    type: "CHANGE_INTERVAL",
    interval
});

const changePreviewAnimating = (isAnimating: boolean): ChangePreviewAnimating => ({
    type: "CHANGE_PREVIEW_ANIMATING",
    isAnimating
});

const toggleOnionSkinEnabled = (): ToggleOnionSkinEnabled => ({
    type: "TOGGLE_ONION_SKIN_ENABLED",
});

const changeOverlayEnabled = (isEnabled: boolean): ChangeOverlayEnabled => ({
    type: "CHANGE_OVERLAY_ENABLED",
    isEnabled
});

const changeCanvasZoom = (zoom: number): ChangeCanvasZoom => ({
    type: "CHANGE_CANVAS_ZOOM",
    zoom
});

const showAlert = (title: string, text: string, options?: AlertOption[]): ShowAlert => ({
    type: "SHOW_ALERT",
    title,
    text,
    options
});

const hideAlert = (): HideAlert => ({
    type: "HIDE_ALERT",
});

const swapForegroundBackground = (): SwapForegroundBackground => ({
    type: "SWAP_FOREGROUND_BACKGROUND",
});

const changeBackgroundColor = (color: number): ChangeBackgroundColor => ({
    type: "CHANGE_BACKGROUND_COLOR",
    color
});

const changeTilePalettePage = (page: number): ChangeTilePalettePage => ({
    type: "CHANGE_TILE_PALETTE_PAGE",
    page
});

const changeTilePaletteCategory = (category: TileCategory): ChangeTilePaletteCategory => ({
    type: "CHANGE_TILE_PALETTE_CATEGORY",
    category
});

const changeDrawingMode = (drawingMode: TileDrawingMode): ChangeDrawingMode => ({
    type: "CHANGE_DRAWING_MODE",
    drawingMode
});

const createNewTile = (tile: pxt.Tile, foreground: number, background: number, qualifiedName?: string): CreateNewTile => ({
    type: "CREATE_NEW_TILE",
    tile,
    foreground,
    background,
    qualifiedName
});

const openTileEditor = (index?: number, id?: string): OpenTileEditor => ({
    type: "OPEN_TILE_EDITOR",
    index,
    id
});

const closeTileEditor = (result?: pxt.Tile, index?: number): CloseTileEditor => ({
    type: "CLOSE_TILE_EDITOR",
    result,
    index
});

const deleteTile = (index: number, id: string): DeleteTile => ({
    type: "DELETE_TILE",
    index,
    id
});

const disableResize = (): DisableResize => ({
    type: "DISABLE_RESIZE",
});

const changeAssetName = (name: string): ChangeAssetName => ({
    type: "CHANGE_ASSET_NAME",
    name
});

const openAsset = (asset: pxt.Asset, keepPast: boolean, gallery?: GalleryTile[]): OpenAsset => ({
    type: "OPEN_ASSET",
    asset,
    keepPast,
    gallery
});

export {
    setInitialState,
    setFrames,
    changeImageTool,
    changeCursorSize,
    changeSelectedColor,
    changeImageDimensions,
    changeKeyModifiers,
    changeCursorLocation,
    imageEdit,
    undoImageEdit,
    redoImageEdit,
    toggleAspectRatio,
    setGalleryOpen,
    newFrame,
    deleteFrame,
    duplicateFrame,
    moveFrame,
    changeCurrentFrame,
    changeInterval,
    changePreviewAnimating,
    toggleOnionSkinEnabled,
    changeOverlayEnabled,
    changeCanvasZoom,
    showAlert,
    hideAlert,
    swapForegroundBackground,
    changeBackgroundColor,
    changeTilePalettePage,
    changeTilePaletteCategory,
    changeDrawingMode,
    createNewTile,
    openTileEditor,
    closeTileEditor,
    deleteTile,
    disableResize,
    changeAssetName,
    openAsset,
}