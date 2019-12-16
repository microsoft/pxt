import * as actions from './types'
import { ImageEditorTool, CursorSize, EditorState, AnimationState, TileCategory, TileDrawingMode, GalleryTile } from '../store/imageReducer';
import { AlertOption } from '../Alert';

export const dispatchChangeImageTool = (tool: ImageEditorTool) => ({ type: actions.CHANGE_IMAGE_TOOL, tool });
export const dispatchChangeCursorSize = (cursorSize: CursorSize) => ({ type: actions.CHANGE_CURSOR_SIZE, cursorSize });
export const dispatchChangeSelectedColor = (selectedColor: number) => ({ type: actions.CHANGE_SELECTED_COLOR, selectedColor });
export const dispatchChangeImageDimensions = (imageDimensions: [number, number]) => ({ type: actions.CHANGE_IMAGE_DIMENSIONS, imageDimensions });
export const dispatchChangeKeyModifiers = (keyModifiers: number) => ({ type: actions.CHANGE_KEY_MODIFIERS, keyModifiers });
export const dispatchChangeCursorLocation = (cursorLocation: [number, number]) => ({ type: actions.CHANGE_CURSOR_LOCATION, cursorLocation });

export const dispatchImageEdit = (newState: pxt.sprite.ImageState) => ({ type: actions.IMAGE_EDIT, newState });
export const dispatchUndoImageEdit = () => ({ type: actions.UNDO_IMAGE_EDIT });
export const dispatchRedoImageEdit = () => ({ type: actions.REDO_IMAGE_EDIT });

export const dispatchToggleAspectRatioLocked = () => ({ type: actions.TOGGLE_ASPECT_RATIO });

export const dispatchNewFrame = (index?: number) => ({ type: actions.NEW_FRAME, index });
export const dispatchDeleteFrame = (index: number) => ({ type: actions.DELETE_FRAME, index });
export const dispatchDuplicateFrame = (index: number) => ({ type: actions.DUPLICATE_FRAME, index });
export const dispatchChangeCurrentFrame = (index: number) => ({ type: actions.CHANGE_CURRENT_FRAME, index });
export const dispatchMoveFrame = (oldIndex: number, newIndex: number) => ({ type: actions.MOVE_FRAME, oldIndex, newIndex });
export const dispatchChangeInterval = (newInterval: number) => ({ type: actions.CHANGE_INTERVAL, newInterval });
export const dispatchChangePreviewAnimating = (animating: boolean) => ({ type: actions.CHANGE_PREVIEW_ANIMATING, animating });
export const dispatchToggleOnionSkinEnabled = () => ({ type: actions.TOGGLE_ONION_SKIN_ENABLED })
export const dispatchChangeOverlayEnabled = (enabled: boolean) => ({ type: actions.CHANGE_OVERLAY_ENABLED, enabled })
export const dispatchChangeZoom = (zoom: number) => ({ type: actions.CHANGE_CANVAS_ZOOM, zoom });
export const dispatchShowAlert = (title: string, text: string, options?: AlertOption[]) => ({ type: actions.SHOW_ALERT, title, text, options });
export const dispatchHideAlert = () => ({ type: actions.HIDE_ALERT });

export const dispatchSwapBackgroundForeground = () => ({ type: actions.SWAP_FOREGROUND_BACKGROUND });
export const dispatchChangeBackgroundColor = (backgroundColor: number) => ({ type: actions.CHANGE_BACKGROUND_COLOR, backgroundColor })
export const dispatchSetInitialFrames = (frames: pxt.sprite.ImageState[], interval: number) => ({ type: actions.SET_INITIAL_FRAMES, frames, interval });
export const dispatchSetInitialState = (state: EditorState, past: AnimationState[]) => ({ type: actions.SET_INITIAL_STATE, state, past });
export const dispatchSetInitialTilemap = (tilemap: pxt.sprite.BitmapData, tileset: pxt.sprite.TileSet, gallery: GalleryTile[], layers: pxt.sprite.BitmapData[], nextId: number, referencedTiles: number[]) => ({ type: actions.SET_INITIAL_TILEMAP, tilemap, tileset, layers, gallery, nextId, referencedTiles });
export const dispatchChangeTilePaletteCategory = (category: TileCategory) => ({ type: actions.CHANGE_TILE_PALETTE_CATEGORY, category });
export const dispatchChangeTilePalettePage = (page: number) => ({ type: actions.CHANGE_TILE_PALETTE_PAGE, page });
export const dispatchChangeDrawingMode = (drawingMode: TileDrawingMode) => ({ type: actions.CHANGE_DRAWING_MODE, drawingMode });
export const dispatchCreateNewTile = (bitmap: pxt.sprite.BitmapData, foreground: number, background: number, qualifiedName?: string) => ({ type: actions.CREATE_NEW_TILE, bitmap, foreground, background, qualifiedName });
export const dispatchSetGalleryOpen = (open: boolean) => ({ type: actions.SET_GALLERY_OPEN, open })
export const dispatchOpenTileEditor = (editIndex?: number) => ({ type: actions.OPEN_TILE_EDITOR, index: editIndex })
export const dispatchCloseTileEditor = (result?: pxt.sprite.BitmapData, index?: number) => ({ type: actions.CLOSE_TILE_EDITOR, result, index })
export const dispatchDeleteTile = (index: number) => ({ type: actions.DELETE_TILE, index });
export const dispatchDisableResize = () => ({ type: actions.DISABLE_RESIZE })