import { lookupAsset } from "../../../assets";
import { Action } from "./actions";
import { AnimationState, EditorState, EditorStore, GalleryTile, ImageEditorStore, ImageEditorTool, initialStore, TileCategory, TileDrawingMode, TilemapState } from "./state";

let tickCallback: (event: string) => void;

export default function reducer(state: ImageEditorStore, action: Action): ImageEditorStore {
    switch (action.type) {
        case "OPEN_TILE_EDITOR":
        case "CHANGE_PREVIEW_ANIMATING":
        case "CHANGE_CANVAS_ZOOM":
        case "CHANGE_IMAGE_TOOL":
        case "CHANGE_CURSOR_SIZE":
        case "CHANGE_SELECTED_COLOR":
        case "CHANGE_CURSOR_LOCATION":
        case "CHANGE_BACKGROUND_COLOR":
        case "SWAP_FOREGROUND_BACKGROUND":
        case "TOGGLE_ONION_SKIN_ENABLED":
        case "CHANGE_OVERLAY_ENABLED":
        case "CHANGE_TILE_PALETTE_PAGE":
        case "CHANGE_TILE_PALETTE_CATEGORY":
        case "CHANGE_DRAWING_MODE":
        case "SET_GALLERY_OPEN":
        case "SHOW_ALERT":
        case "HIDE_ALERT":
        case "DISABLE_RESIZE":
            return {
                ...state,
                editor: editorReducer(state.editor, action, state.store)
            };
        case "SET_INITIAL_STATE":
            const restored: EditorState = action.state;
            return {
                ...state,
                editor: {
                    ...initialStore.editor,
                    selectedColor: restored.selectedColor,
                    backgroundColor: restored.backgroundColor,
                    tilemapPalette: restored.tilemapPalette,
                    tileGalleryOpen: restored.tileGalleryOpen,
                    tileGallery: restored.tileGallery,
                    isTilemap: restored.isTilemap,
                    referencedTiles: state.editor.referencedTiles
                },
                store: {
                    ...state.store,
                    past: action.past || state.store.past,
                    future: action.past ? [] : state.store.future
                }
            };
        case "OPEN_ASSET":
            const toOpen: pxt.Asset = action.asset;
            const gallery = action.gallery || (action.keepPast ? state.editor.tileGallery : [])

            let selectedColor = -1;
            if (toOpen.type === pxt.AssetType.Tilemap) {
                // Add the first gallery tile to the tileset so the editor will have a default
                // selected color. If unused, this will be trimmed when the editor is closed.
                const tilemapData = toOpen.data;
                if (pxt.sprite.isEmptyTilemap(tilemapData)) {
                    const tiles = tilemapData.tileset.tiles || [];
                    const firstTileName = gallery.find(t => t.tags.indexOf("forest") !== -1)?.qualifiedName;
                    const firstTile = lookupAsset(pxt.AssetType.Tile, firstTileName) as pxt.Tile;
                    if (firstTile && !tiles.find(t => t.id === firstTileName)) {
                        tiles.push(firstTile);
                    }
                    selectedColor = tiles.indexOf(firstTile);
                }
            }

            return {
                ...state,
                editor: toOpen.type === pxt.AssetType.Tilemap ? {
                    selectedColor,
                    backgroundColor: -1,
                    isTilemap: true,
                    tilemapPalette: {
                        category: TileCategory.Forest,
                        page: 0
                    },
                    drawingMode: TileDrawingMode.Default,
                    overlayEnabled: true,
                    tileGallery: gallery,
                    tileGalleryOpen: !!gallery,
                    referencedTiles: toOpen.data.projectReferences,
                    previewAnimating: false,
                    onionSkinEnabled: false,
                    tilesetRevision: 0,
                    // Properties below this comment carry over if keep past is true
                    tool: action.keepPast ? state.editor.tool : initialStore.editor.tool,
                    cursorSize: action.keepPast ? state.editor.cursorSize : initialStore.editor.cursorSize,
                    editedTiles: action.keepPast ? state.editor.editedTiles : undefined,
                    deletedTiles: action.keepPast ? state.editor.deletedTiles : undefined

                } : {
                    isTilemap: false,
                    tilesetRevision: 0,

                    // Properties below this comment carry over if keep past is true
                    selectedColor: action.keepPast ? state.editor.selectedColor : initialStore.editor.selectedColor,
                    backgroundColor: action.keepPast ? state.editor.backgroundColor : initialStore.editor.backgroundColor,
                    previewAnimating: action.keepPast ? state.editor.previewAnimating : initialStore.editor.previewAnimating,
                    tool: action.keepPast ? state.editor.tool : initialStore.editor.tool,
                    onionSkinEnabled: action.keepPast ? state.editor.onionSkinEnabled : initialStore.editor.onionSkinEnabled,
                    cursorSize: action.keepPast ? state.editor.cursorSize : initialStore.editor.cursorSize,
                    resizeDisabled: action.keepPast ? state.editor.resizeDisabled : initialStore.editor.resizeDisabled
                },
                store: {
                    ...state.store,
                    past: action.keepPast ? state.store.past : [],
                    present: initialStateForAsset(action.asset, gallery),
                    future: []
                }
            };

        case "CHANGE_ASSET_NAME":
            tickEvent("change-asset-name");
            return {
                ...state,
                store: {
                    past: [...state.store.past, state.store.present],
                    present: {
                        ...state.store.present,
                        asset: {
                            ...state.store.present.asset,
                            meta: {
                                ...(state.store.present.asset.meta || {}),
                                displayName: action.name
                            }
                        }
                    },
                    future: []
                }
            };
        case "UNDO_IMAGE_EDIT":
            if (!state.store.past.length) return state;

            tickEvent(`undo`);
            return {
                ...state,
                store: {
                    ...state.store,
                    past: state.store.past.slice(0, state.store.past.length - 1),
                    present: state.store.past[state.store.past.length - 1],
                    future: [...state.store.future, state.store.present]
                },
                editor: {
                    ...state.editor,
                    tilesetRevision: state.editor.tilesetRevision + 1
                }
            };
        case "REDO_IMAGE_EDIT":
            if (!state.store.future.length) return state;

            tickEvent(`redo`);
            return {
                ...state,
                store: {
                    ...state.store,
                    past: [...state.store.past, state.store.present],
                    present: state.store.future[state.store.future.length - 1],
                    future: state.store.future.slice(0, state.store.future.length - 1),
                },
                editor: {
                    ...state.editor,
                    tilesetRevision: state.editor.tilesetRevision + 1
                }
            };
        default:
            return {
                ...state,
                editor: editorReducer(state.editor, action, state.store),
                store: {
                    ...state.store,
                    past: [...state.store.past, state.store.present],
                    present: state.editor.isTilemap ? tilemapReducer(state.store.present as TilemapState, action) : animationReducer(state.store.present as AnimationState, action),
                    future: []
                }
            }
    }
}


const animationReducer = (state: AnimationState, action: Action): AnimationState => {
    switch (action.type) {
        case "TOGGLE_ASPECT_RATIO":
            tickEvent(`toggle-aspect-ratio-lock`);
            return { ...state, aspectRatioLocked: !state.aspectRatioLocked };
        case "CHANGE_CURRENT_FRAME":
            tickEvent(`change-frame`);
            return { ...state, currentFrame: action.index };
        case "CHANGE_INTERVAL":
            tickEvent(`change-interval`);
            return { ...state, interval: action.interval };
        case "CHANGE_IMAGE_DIMENSIONS":
            tickEvent(`change-dimensions`);
            const { width, height } = action;
            return {
                ...state,
                frames: state.frames.map((frame, index) => ({
                    ...frame,
                    bitmap: pxt.sprite.Bitmap.fromData(frame.bitmap).resize(width, height).data()
                }))
            };
        case "IMAGE_EDIT":
            tickEvent(`image-edit`);
            return {
                ...state,
                frames: state.frames.map((frame, index) => (
                    index === state.currentFrame ? action.newState : frame))
            };
        case "DELETE_FRAME":
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
        case "DUPLICATE_FRAME":
            tickEvent(`duplicate-frame`);
            const frames = state.frames.slice();
            frames.splice(action.index, 0, cloneImage(state.frames[action.index]))
            return {
                ...state,
                frames,
                currentFrame: action.index + 1
            };
        case "NEW_FRAME":
            tickEvent(`new-frame`);
            return {
                ...state,
                frames: [...state.frames, emptyFrame(state.frames[0].bitmap.width, state.frames[0].bitmap.height)],
                currentFrame: state.frames.length,
            };
        case "MOVE_FRAME":
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
        case "SET_FRAMES":
            tickEvent(`set-frames`);
            return {
                ...state,
                frames: action.frames,
                currentFrame: 0
            };
        default:
            return state;
    }
}

const editorReducer = (state: EditorState, action: Action, store: EditorStore): EditorState => {
    let editedTiles: string[];
    switch (action.type) {
        case "CHANGE_PREVIEW_ANIMATING":
            tickEvent(`preview-animate-${action.isAnimating ? "on" : "off"}`)
            return { ...state, previewAnimating: action.isAnimating };
        case "CHANGE_CANVAS_ZOOM":
            if (action.zoom > 0 || action.zoom < 0) {
                tickEvent(`zoom-${action.zoom > 0 ? "in" : "out"}`);
            }
            return { ...state, zoomDelta: action.zoom };
        case "CHANGE_IMAGE_TOOL":
            tickEvent(`change-tool-${ImageEditorTool[action.tool]}`);
            return { ...state, tool: action.tool };
        case "CHANGE_CURSOR_SIZE":
            tickEvent(`change-cursor-size-${action.cursorSize}`);
            return { ...state, cursorSize: action.cursorSize };
        case "CHANGE_SELECTED_COLOR":
            tickEvent(`foreground-color-${action.selectedColor}`);

            // If the selected tool is the eraser, make sure to switch to pencil
            return {
                ...state,
                selectedColor: action.selectedColor,
                tool: state.tool === ImageEditorTool.Erase ? ImageEditorTool.Paint : state.tool
            };
        case "CHANGE_CURSOR_LOCATION":
            return { ...state, cursorLocation: action.cursor };
        case "CHANGE_BACKGROUND_COLOR":
            tickEvent(`background-color-${action.color}`);
            return { ...state, backgroundColor: action.color };
        case "SWAP_FOREGROUND_BACKGROUND":
            tickEvent(`swap-foreground-background`);
            return { ...state, backgroundColor: state.selectedColor, selectedColor: state.backgroundColor };
        case "TOGGLE_ONION_SKIN_ENABLED":
            tickEvent(`toggle-onion-skin`);
            return { ...state, onionSkinEnabled: !state.onionSkinEnabled };
        case "CHANGE_TILE_PALETTE_CATEGORY":
            tickEvent(`change-tile-category-${TileCategory[action.category]}`);
            return { ...state, tilemapPalette: { ...state.tilemapPalette, category: action.category, page: 0 } };
        case "CHANGE_TILE_PALETTE_PAGE":
            tickEvent(`change-tile-page`);
            return { ...state, tilemapPalette: { ...state.tilemapPalette, page: action.page } };
        case "CHANGE_DRAWING_MODE":
            tickEvent(`change-drawing-mode`);
            return { ...state, drawingMode: action.drawingMode || TileDrawingMode.Default };
        case "CHANGE_OVERLAY_ENABLED":
            tickEvent(`change-overlay-enabled`);
            return { ...state, overlayEnabled: action.isEnabled };
        case "CREATE_NEW_TILE":
            // tick event covered elsewhere
            editedTiles = state.editedTiles;
            if (action.tile && (!editedTiles || editedTiles.indexOf(action.tile.id) === -1)) {
                editedTiles = (editedTiles || []).concat([action.tile.id]);
            }
            return {
                ...state,
                editedTiles,
                selectedColor: action.foreground,
                backgroundColor: action.background
            };
        case "SET_GALLERY_OPEN":
            tickEvent(`set-gallery-open-${action.isOpen}`);
            return { ...state, tileGalleryOpen: action.isOpen, tilemapPalette: { ...state.tilemapPalette, page: 0 } };
        case "DELETE_TILE":
            return {
                ...state,
                deletedTiles: (state.deletedTiles || []).concat([action.id]),
                selectedColor: action.index === state.selectedColor ? 0 : state.selectedColor,
                backgroundColor: action.index === state.backgroundColor ? 0 : state.backgroundColor,
                tilesetRevision: state.tilesetRevision + 1
            };
        case "OPEN_TILE_EDITOR":
            const editType = action.index ? "edit" : "new";
            tickEvent(`open-tile-editor-${editType}`);

            return {
                ...state,
                editingTile: {
                    type: editType,
                    tilesetIndex: action.index
                }
            };
        case "CLOSE_TILE_EDITOR":
            editedTiles = state.editedTiles;
            if (action.result && (!editedTiles || editedTiles.indexOf(action.result.id) === -1)) {
                editedTiles = (editedTiles || []).concat([action.result.id])
            }
            return {
                ...state,
                editedTiles,
                selectedColor: action.index || (store.present as TilemapState).tileset.tiles.length,
                editingTile: undefined,
                tilesetRevision: state.tilesetRevision + 1
            };
        case "SHOW_ALERT":
            tickEvent("show-alert");
            return {
                ...state,
                alert: {
                    title: action.title,
                    text: action.text,
                    options: action.options
                }
            }
        case "HIDE_ALERT":
            tickEvent("hide-alert");
            return {
                ...state,
                alert: null
            }
        case "DISABLE_RESIZE":
            // no tick, this is not initiated by the user
            return {
                ...state,
                resizeDisabled: true
            }
    }
    return state;
}

const tilemapReducer = (state: TilemapState, action: Action): TilemapState => {
    switch (action.type) {
        case "TOGGLE_ASPECT_RATIO":
            tickEvent(`toggle-aspect-ratio-lock`);
            return { ...state, aspectRatioLocked: !state.aspectRatioLocked };
        case "CHANGE_IMAGE_DIMENSIONS":
            tickEvent(`change-dimensions`);
            const { width, height } = action;
            return {
                ...state,
                tilemap: {
                    ...state.tilemap,
                    bitmap: resizeTilemap(state.tilemap.bitmap, width, height),
                    overlayLayers: state.tilemap.overlayLayers && state.tilemap.overlayLayers.map(o => resizeBitmap(o, width, height))
                }
            };
        case "CREATE_NEW_TILE":
            const isCustomTile = !action.qualifiedName;
            tickEvent(!isCustomTile ? `used-tile-${action.qualifiedName}` : `new-tile`);

            let newTile: pxt.Tile;
            if (isCustomTile) {
                newTile = action.tile;
                newTile.isProjectTile = true;
            }
            else {
                newTile = lookupAsset(pxt.AssetType.Tile, action.qualifiedName) as pxt.Tile;
            }

            return {
                ...state,
                tileset: {
                    ...state.tileset,
                    tiles: state.tileset.tiles.concat([newTile])
                },
                nextId: isCustomTile ? state.nextId + 1 : state.nextId
            }
        case "CLOSE_TILE_EDITOR":
            tickEvent("close-tile-editor");
            if (!action.result) return state;
            else if (action.index) {
                return {
                    ...state,
                    tileset: editTile(state.tileset, action.index, action.result)
                }
            }
            else {
                return {
                    ...state,
                    tileset: {
                        ...state.tileset,
                        tiles: state.tileset.tiles.concat([action.result])
                    },
                    nextId: state.nextId + 1
                }
            }
        case "DELETE_TILE":
            tickEvent("delete-tile");
            const newTiles = state.tileset.tiles.slice();
            newTiles.splice(action.index, 1);

            return {
                ...state,
                tilemap: {
                    ...state.tilemap,
                    bitmap: deleteTile(action.index, pxt.sprite.Tilemap.fromData(state.tilemap.bitmap)).data()
                },
                tileset: {
                    ...state.tileset,
                    tiles: newTiles
                }
            }
        case "IMAGE_EDIT":
            tickEvent(`image-edit`);
            return {
                ...state,
                tilemap: action.newState
            };
        default:
            return state;
    }
}

function editTile(t: pxt.TileSet, index: number, newTile: pxt.Tile): pxt.TileSet {
    return {
        ...t,
        tiles: t.tiles.map((tile, i) => i === index ? newTile : tile)
    }
}

function emptyFrame(width: number, height: number): pxt.sprite.ImageState {
    return {
        bitmap: new pxt.sprite.Bitmap(width, height).data()
    }
}

function cloneImage(state: pxt.sprite.ImageState): pxt.sprite.ImageState {
    let floating, bitmap, overlayLayers;
    if (state.floating) {
        if (state.floating.bitmap) bitmap = pxt.sprite.Bitmap.fromData(state.floating.bitmap).copy().data();
        if (state.floating.overlayLayers) overlayLayers = state.floating.overlayLayers.map(el => pxt.sprite.Bitmap.fromData(el).copy().data());
        floating = { bitmap, overlayLayers };
    }
    return {
        ...state,
        bitmap: pxt.sprite.Bitmap.fromData(state.bitmap).copy().data(),
        overlayLayers: state.overlayLayers && state.overlayLayers.map(el => pxt.sprite.Bitmap.fromData(el).copy().data()),
        floating
    };
}

function tickEvent(event: string) {
    if (tickCallback) {
        tickCallback(event)
    }
}

function restoreSprites(tileset: pxt.TileSet, gallery: GalleryTile[]) {
    for (const t of tileset.tiles) {
        if (!t.jresData && !t.isProjectTile) {
            for (const g of gallery) {
                if (g.qualifiedName === t.id) {
                    t.bitmap = g.bitmap;
                    break;
                }
            }
        }
    }

    return tileset;
}

function deleteTile(index: number, tilemap: pxt.sprite.Tilemap) {
    const result = tilemap.copy();
    for (let x = 0; x < result.width; x++) {
        for (let y = 0; y < result.height; y++) {
            const value = result.get(x, y);
            if (value === index) {
                result.set(x, y, 0)
            }
            else if (value > index) {
                result.set(x, y, value - 1);
            }
        }
    }

    return result;
}

function resizeBitmap(data: pxt.sprite.BitmapData, newWidth: number, newHeight: number) {
    return pxt.sprite.Bitmap.fromData(data).resize(newWidth, newHeight).data();
}

function resizeTilemap(data: pxt.sprite.BitmapData, newWidth: number, newHeight: number) {
    return pxt.sprite.Tilemap.fromData(data).resize(newWidth, newHeight).data();
}


function initialStateForAsset(asset: pxt.Asset, gallery: GalleryTile[]) {
    if (asset.type === pxt.AssetType.Tilemap) {
        return initialTilemapStateForAsset(asset, gallery);
    }
    else {
        return initialAnimationStateForAsset(asset as pxt.ProjectImage | pxt.Animation | pxt.Tile);
    }
}

function initialAnimationStateForAsset(asset: pxt.ProjectImage | pxt.Animation | pxt.Tile): AnimationState {
    return {
        kind: "Animation",
        asset,
        visible: true,
        colors: pxt.appTarget.runtime.palette.slice(),

        aspectRatioLocked: asset.type === pxt.AssetType.Tile,

        currentFrame: 0,
        frames: asset.type === pxt.AssetType.Animation ? asset.frames.map(bitmap => ({ bitmap })) : [{ bitmap: asset.bitmap }],
        interval: asset.type === pxt.AssetType.Animation ? asset.interval : 100
    }
}

function initialTilemapStateForAsset(asset: pxt.ProjectTilemap, gallery: GalleryTile[]): TilemapState {
    return {
        kind: "Tilemap",
        asset,
        colors: pxt.appTarget.runtime.palette.slice(),
        aspectRatioLocked: false,
        tilemap: {
            bitmap: asset.data.tilemap.data(),
            overlayLayers: [asset.data.layers]
        },
        tileset: restoreSprites(asset.data.tileset, gallery),
        nextId: asset.data.nextId
    }
}


export function setTelemetryFunction(cb: (event: string) => void) {
    tickCallback = cb;
}