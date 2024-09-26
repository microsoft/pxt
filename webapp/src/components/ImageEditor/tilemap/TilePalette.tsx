import * as React from 'react';

import { TimelineFrame } from '../TimelineFrame';
import { Dropdown, DropdownOption } from '../Dropdown';
import { Pivot, PivotOption } from '../Pivot';
import { IconButton } from '../Button';
import { AlertOption } from '../Alert';
import { createTile } from '../../../assets';
import { changeBackgroundColor, changeDrawingMode, changeSelectedColor, changeTilePaletteCategory, changeTilePalettePage, createNewTile, deleteTile, hideAlert, ImageEditorContext, openTileEditor, setGalleryOpen, showAlert, swapForegroundBackground, TilemapState, TileCategory, TileDrawingMode, GalleryTile } from '../state';
import { classList } from '../../../../../react-common/components/util';

export interface TilePaletteProps {
    colors: string[];
    tileset: pxt.TileSet;
    selected: number;
    backgroundColor: number;

    referencedTiles: string[];

    category: TileCategory;
    page: number;

    gallery: GalleryTile[];
    galleryOpen: boolean;
    drawingMode: TileDrawingMode;

    dispatchChangeSelectedColor: (index: number) => void;
    dispatchChangeBackgroundColor: (index: number) => void;
    dispatchSwapBackgroundForeground: () => void;
    dispatchChangeTilePalettePage: (index: number) => void;
    dispatchChangeTilePaletteCategory: (category: TileCategory) => void;
    dispatchChangeDrawingMode: (drawingMode: TileDrawingMode) => void;
    dispatchCreateNewTile: (tile: pxt.Tile, foreground: number, background: number, qualifiedName?: string) => void;
    dispatchSetGalleryOpen: (open: boolean) => void;
    dispatchOpenTileEditor: (editIndex?: number, editID?: string) => void;
    dispatchDeleteTile: (index: number, id: string) => void;
    dispatchShowAlert: (title: string, text: string, options?: AlertOption[]) => void;
    dispatchHideAlert: () => void;
}

/**
 * This is a scaling factor for all of the pixels in the canvas. Scaling is not needed for browsers
 * that support "image-rendering: pixelated," so only scale for Microsoft Edge.
 */
const SCALE = pxt.BrowserUtils.isEdge() ? 25 : 1;

const TILES_PER_PAGE = 16;

interface Category extends DropdownOption {
    tiles: GalleryTile[];
}

const options: Category[] = [
    {
        id: "forest",
        text: lf("Forest"),
        tiles: []
    }, {
        id: "aquatic",
        text: lf("Aquatic"),
        tiles: []
    }, {
        id: "dungeon",
        text: lf("Dungeon"),
        tiles: []
    }, {
        id: "misc",
        text: lf("Miscellaneous"),
        tiles: []
    }
];

const tabs: PivotOption[] = [
    {
        id: "custom",
        text: lf("My Tiles")
    }, {
        id: "gallery",
        text: lf("Gallery")
    }
]

const emptyTile = new pxt.sprite.Bitmap(16, 16);

interface UserTile {
    index: number;
    bitmap: pxt.sprite.BitmapData;
}

type RenderedTile = GalleryTile | UserTile;

interface GalleryState {
    categoryTiles: RenderedTile[];
    renderedTiles: RenderedTile[];
    categories: Category[];
    selectedColor?: number;
    backgroundColor?: number;
}

export const TilePalette = () => {
    const { state, dispatch } = React.useContext(ImageEditorContext);

    const { drawingMode, selectedColor, backgroundColor, tileGalleryOpen, referencedTiles, tilemapPalette, tileGallery } = state.editor;
    const { page, category } = tilemapPalette;
    const { tilemap, tileset, colors } = (state.store.present as TilemapState);

    const fg = tileset.tiles[selectedColor] ? tileset.tiles[selectedColor].bitmap : emptyTile.data();
    const bg = tileset.tiles[backgroundColor] ? tileset.tiles[backgroundColor].bitmap : emptyTile.data();

    const galleryState = React.useRef<GalleryState>({ categories: [], renderedTiles: [], categoryTiles: [] });

    if (!galleryState.current.categories.length) {
        galleryState.current.categories = getGalleryCategories(tileGallery, tileset)
    }

    const updateGalleryTiles = React.useCallback(() => {
        if (tileGalleryOpen) {
            galleryState.current.categoryTiles = galleryState.current.categories[category].tiles;
        }
        else {
            galleryState.current.categoryTiles = getCustomTiles(tileset).map(([t, i]) => ({ index: i, bitmap: t.bitmap }));
        }

        const startIndex = page * TILES_PER_PAGE;
        galleryState.current.renderedTiles = galleryState.current.categoryTiles.slice(startIndex, startIndex + TILES_PER_PAGE);
    }, [page, tileGallery, tileGalleryOpen, tileset, category]);

    updateGalleryTiles();

    let totalPages = Math.ceil(galleryState.current.categoryTiles.length / TILES_PER_PAGE);

    // Add an empty page for the tile create button if the last page is full
    if (!tileGalleryOpen && galleryState.current.categoryTiles.length % 16 === 0) totalPages++;

    const showCreateTile = !tileGalleryOpen && (totalPages === 1 || page === totalPages - 1);
    const controlsDisabled = tileGalleryOpen || !galleryState.current.renderedTiles.some(t => !isGalleryTile(t) && t.index === selectedColor);

    const canvasRef = React.useRef<HTMLCanvasElement>();
    const createTileButtonRef = React.useRef<HTMLDivElement>();

    const onForegroundBackgroundClick = React.useCallback(() => {
        if (drawingMode != TileDrawingMode.Default) {
            dispatch(changeDrawingMode(TileDrawingMode.Default));
        }
        else {
            dispatch(swapForegroundBackground());
        }
    }, [dispatch, drawingMode]);

    const onWallClick = React.useCallback(() => {
        if (drawingMode === TileDrawingMode.Wall) {
            dispatch(changeDrawingMode(TileDrawingMode.Default));
        }
        else {
            dispatch(changeDrawingMode(TileDrawingMode.Wall));
        }
    }, [dispatch, drawingMode]);

    const onTileEditClick = React.useCallback(() => {
        const tileToEdit = tileset.tiles[selectedColor];
        if (!tileToEdit?.isProjectTile || selectedColor === 0) return;

        dispatch(openTileEditor(selectedColor, tileToEdit.id));
    }, [dispatch, selectedColor, tileset]);

    const onTileDuplicateClick = React.useCallback(() => {
        const tile = tileset.tiles[selectedColor];
        if (!tile?.isProjectTile || selectedColor === 0) return;

        dispatch(createNewTile(createTile(tile.bitmap, null, tile.meta?.displayName), tileset.tiles.length, backgroundColor));
    }, [dispatch, selectedColor, tileset, backgroundColor]);

    const onTileDeleteClick = React.useCallback(() => {
        const info = tileset.tiles[selectedColor];

        if (!selectedColor || !info || !info.isProjectTile) return;

        const hideAlertCallback = () => dispatch(hideAlert());
        const deleteTileCallback = () => {
            const deleted = tileset.tiles[selectedColor];

            if (deleted) {
                dispatch(deleteTile(selectedColor, deleted.id));
            }
        }

        // tile cannot be deleted because it is referenced in the code
        if (referencedTiles && referencedTiles.indexOf(info.id) !== -1) {
            dispatch(showAlert(
                lf("Unable to delete"),
                lf("This tile is used in your game. Remove all blocks using the tile before deleting."),
                [{ label: lf("Cancel"), onClick: () => hideAlertCallback }]
            ));
            return;
        }

        dispatch(showAlert(
            lf("Are you sure?"),
            lf("Deleting this tile will remove it from all other tile maps in your game."),
            [
                { label: lf("Yes"), onClick: deleteTileCallback},
                { label: lf("No"), onClick: () => hideAlertCallback }
            ]
        ));
    }, [dispatch, referencedTiles, tileset, selectedColor]);

    const onTileCreateClick = React.useCallback(() => {
        dispatch(openTileEditor());
    }, [dispatch]);

    const handleCanvasClickCore = React.useCallback((clientX: number, clientY: number, isRightClick: boolean) => {
        const getTileIndex = (tile: GalleryTile) => {
            for (let i = 0; i < tileset.tiles.length; i++) {
                if (tileset.tiles[i].id === tile.qualifiedName) return i;
            }

            return -1;
        }
        const bounds = canvasRef.current.getBoundingClientRect();
        const column = ((clientX - bounds.left) / (bounds.width / 4)) | 0;
        const row = ((clientY - bounds.top) / (bounds.height / 4)) | 0;

        const tile = galleryState.current.renderedTiles[row * 4 + column];
        if (tile) {
            let index: number;
            let qname: string;

            if (isGalleryTile(tile)) {
                index = getTileIndex(tile);
                qname = tile.qualifiedName;
            }
            else {
                index = tile.index;
            }

            if (index >= 0) {
                if (isRightClick) {
                    dispatch(changeBackgroundColor(index));
                }
                else {
                    dispatch(changeSelectedColor(index));
                }
            }
            else {
                const newIndex = tileset.tiles.length || 1; // transparent is index 0, so default to 1

                dispatch(createNewTile(
                    null,
                    isRightClick ? selectedColor : newIndex,
                    isRightClick ? newIndex : backgroundColor,
                    qname
                ));
            }
            // automatically switch into tile drawing mode
            dispatch(changeDrawingMode(TileDrawingMode.Default))
        }
    }, [dispatch, selectedColor, backgroundColor, tileset]);

    const onCanvasClick = React.useCallback((ev: React.MouseEvent) => {
        handleCanvasClickCore(ev.clientX, ev.clientY, ev.button > 0);
    }, [handleCanvasClickCore]);

    const onCanvasTouch = React.useCallback((ev: React.TouchEvent) => {
        handleCanvasClickCore(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY, false);
    }, [handleCanvasClickCore]);

    const preventContextMenu = React.useCallback((ev: React.MouseEvent) => {
        ev.preventDefault();
    }, []);

    const pivotHandler = React.useCallback((option: PivotOption, index: number) => {
        dispatch(setGalleryOpen(index === 1));
    }, [dispatch]);

    const dropdownHandler = React.useCallback((option: DropdownOption, index: number) => {
        dispatch(changeTilePaletteCategory(index));
    }, [dispatch]);

    const onPageSelected = React.useCallback((index: number) => {
        dispatch(changeTilePalettePage(index));
    }, [dispatch]);

    React.useEffect(() => {
        updateGalleryTiles();

        // Draw the tile palette canvas
        const columns = 4;
        const rows = 4;
        const margin = 1;

        const startIndex = page * columns * rows;

        const width = tileset.tileWidth + margin;

        canvasRef.current.width = (width * columns + margin) * SCALE;
        canvasRef.current.height = (width * rows + margin) * SCALE;

        const context = canvasRef.current.getContext("2d");

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                const tile = galleryState.current.categoryTiles[startIndex + r * columns + c];

                if (tile) {
                    if (!isGalleryTile(tile) && tile.index === selectedColor) {
                        context.fillStyle = "#ff0000";
                        context.fillRect(c * width, r * width, width + 1, width + 1);
                    }

                    context.fillStyle = "#333333";
                    context.fillRect(c * width + 1, r * width + 1, width - 1, width - 1);

                    drawBitmap(colors, pxt.sprite.Bitmap.fromData(tile.bitmap), 1 + c * width, 1 + r * width, true, SCALE, canvasRef.current);
                }
            }
        }

        // Position the tile create button
        const button = createTileButtonRef.current;

        if (button) {
            const column = galleryState.current.categoryTiles.length % 4;
            const row = Math.floor(galleryState.current.categoryTiles.length / 4) % 4;

            button.style.position = "absolute";
            button.style.left = "calc(" + (column / 4) + " * (100% - 0.5rem) + 0.25rem)";
            button.style.top = "calc(" + (row / 4) + " * (100% - 0.5rem) + 0.25rem)";
        }
    }, [tileset, page, category, tileGalleryOpen, selectedColor, colors, updateGalleryTiles]);

    React.useEffect(() => {
        refreshGallery(tileGallery, tileset);
    }, [tileGallery, tileset]);

    React.useEffect(() => {
        const jumpToPageContaining = (index: number) => {
            if (!index || index < 0 || index >= tileset.tiles.length) return;

            const tile = tileset.tiles[index];
            if (!tile.isProjectTile) {
                // For gallery tile, find the category then the page within the category
                const category = galleryState.current.categories.find(opt => opt.tiles.findIndex(t => t.qualifiedName == tile.id) !== -1);
                if (!category || !category.tiles) return;
                const page = Math.max(Math.floor(category.tiles.findIndex(t => t.qualifiedName == tile.id) / TILES_PER_PAGE), 0);

                dispatch(setGalleryOpen(true));
                dispatch(changeTilePaletteCategory(galleryState.current.categories.indexOf(category) as TileCategory));
                dispatch(changeTilePalettePage(page));
            }
            else {
                // For custom tile, find the page
                const categoryTiles = getCustomTiles(tileset).map(([t, i]) => t);
                if (!categoryTiles) return;
                const page = Math.max(Math.floor(categoryTiles.findIndex(t => t.id == tile.id) / TILES_PER_PAGE), 0);

                dispatch(setGalleryOpen(false));
                dispatch(changeTilePalettePage(page));
            }
        }

        if (selectedColor !== galleryState.current.selectedColor) {
            jumpToPageContaining(selectedColor);
        }
        else if (backgroundColor !== galleryState.current.backgroundColor) {
            jumpToPageContaining(backgroundColor)
        }
        galleryState.current.selectedColor = selectedColor;
        galleryState.current.backgroundColor = backgroundColor;
    }, [tileset, selectedColor, backgroundColor])

    return (
        <div className="tile-palette">
            <div className="tile-palette-fg-bg">
                <div
                    className={classList("tile-palette-swatch fg",drawingMode == TileDrawingMode.Default && "selected")}
                    onClick={onForegroundBackgroundClick}
                    role="button"
                >
                    <TimelineFrame
                        frames={[{ bitmap: fg }]}
                        colors={colors}
                    />
                </div>
                <div
                    className="tile-palette-swatch bg"
                    onClick={onForegroundBackgroundClick}
                    role="button"
                >
                    <TimelineFrame
                        frames={[{ bitmap: bg }]}
                        colors={colors}
                    />
                    <IconButton
                        iconClass={"ms-Icon ms-Icon--ReturnKey"}
                        title={lf("Swap the background and foreground colors.")}
                        toggle={true}
                    />
                </div>
                <div
                    className={classList("tile-palette-swatch wall", drawingMode == TileDrawingMode.Wall && "selected")}
                    onClick={onWallClick}
                    title={lf("Draw walls")}
                    role="button"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
                        <path d="M 968.49289,108.05443 771.30518,3.7581533 183.65231,166.0694 l 2.58963,202.62638 -156.247366,54.4148 0.872799,492.65563 179.544267,81.08212 758.08125,-222.4989 z M 765.6275,42.836761 916.79721,122.02922 412.26526,262.35026 250.08966,187.43643 Z M 934.62189,739.077 234.56171,946.92199 233.81426,554.79578 422.38222,493.25053 423.42046,300.4059 934.62189,157.54989 Z M 204.96854,402.33519 361.49056,473.98651 222.88861,518.46222 75.008408,444.5191 Z" />
                    </svg>
                </div>
            </div>
            <Pivot
                options={tabs}
                selected={tileGalleryOpen ? 1 : 0}
                onChange={pivotHandler}
            />
            <div className="tile-palette-controls-outer">
                {tileGalleryOpen &&
                    <Dropdown
                        onChange={dropdownHandler}
                        options={galleryState.current.categories.filter(c => !!c.tiles.length)}
                        selected={category}
                    />
                }

                {!tileGalleryOpen &&
                    <div className="tile-palette-controls">
                        <IconButton
                            onClick={onTileEditClick}
                            iconClass="ms-Icon ms-Icon--SingleColumnEdit"
                            title={lf("Edit the selected tile")}
                            disabled={controlsDisabled}
                            toggle={!controlsDisabled}
                        />
                        <IconButton
                            onClick={onTileDuplicateClick}
                            iconClass="ms-Icon ms-Icon--Copy"
                            title={lf("Duplicate the selected tile")}
                            disabled={controlsDisabled}
                            toggle={!controlsDisabled}
                        />
                        <IconButton
                            onClick={onTileDeleteClick}
                            iconClass="ms-Icon ms-Icon--Delete"
                            title={lf("Delete the selected tile")}
                            disabled={controlsDisabled}
                            toggle={!controlsDisabled}
                        />
                    </div>
                }
            </div>

            <div className="tile-canvas-outer" onContextMenu={preventContextMenu}>
                <div className="tile-canvas">
                    <canvas
                        ref={canvasRef}
                        className="paint-surface"
                        onMouseDown={onCanvasClick}
                        onTouchStart={onCanvasTouch}
                        role="complementary"
                    />
                    { showCreateTile &&
                        <div ref={createTileButtonRef}>
                            <IconButton
                                onClick={onTileCreateClick}
                                iconClass={"ms-Icon ms-Icon--Add"}
                                title={lf("Create a new tile")}
                                toggle={true}
                            />
                        </div>
                    }
                </div>
                <div className="tile-canvas-controls">
                    <PageControls
                        pages={totalPages}
                        selected={page}
                        onPageSelected={onPageSelected}
                    />
                </div>
            </div>
        </div>
    );
}


const PageControls = (props: { pages: number, selected: number, onPageSelected: (index: number) => void }) => {
    const { pages, selected, onPageSelected } = props;

    const width = 16 + (pages - 1) * 5;
    const pageMap: boolean[] = [];
    for (let i = 0; i < pages; i++) pageMap[i] = i === selected;

    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} 10`} className={`tile-palette-pages ${pages < 2 ?  'disabled' : ''}`}>
            <polygon
                className="tile-palette-page-arrow"
                points="1,5 4,3 4,7"
                onClick={selected ? () => onPageSelected(selected - 1) : undefined}
            />
            {
                pageMap.map((isSelected, index) =>
                    <circle
                        className="tile-palette-page-dot"
                        key={index}
                        cx={8 + index * 5}
                        cy="5"
                        r={isSelected ? 2 : 1}
                        onClick={!isSelected ? () => onPageSelected(index) : undefined}
                    />
                )
            }
            <polygon
                className="tile-palette-page-arrow"
                points={`${width - 1},5 ${width - 4},3 ${width - 4},7`}
                onClick={(selected < pages - 1) ? () =>  onPageSelected(selected + 1) : undefined}
            />
        </svg>
    )
}


function getGalleryCategories(gallery: GalleryTile[], tileset: pxt.TileSet) {
    refreshGallery(gallery, tileset);

    if (gallery) {
        const extraCategories: pxt.Map<Category> = {};
        for (const tile of gallery) {
            const categoryName = tile.tags.find(t => pxt.Util.startsWith(t, "category-"));
            if (categoryName) {
                if (!extraCategories[categoryName]) {
                    extraCategories[categoryName] = {
                        id: categoryName,
                        text: pxt.Util.rlf(`{id:tilecategory}${categoryName.substr(9)}`),
                        tiles: []
                    };
                }

                extraCategories[categoryName].tiles.push(tile);
            }
        }

        return options.concat(Object.keys(extraCategories).map(key => extraCategories[key]));
    }

    return [];
}

function refreshGallery(gallery: GalleryTile[], tileset: pxt.TileSet) {
    if (gallery) {
        options.forEach(opt => {
            opt.tiles = gallery.filter(t => t.tags.indexOf(opt.id) !== -1 && t.tileWidth === tileset.tileWidth);
        });
    }
}


function getCustomTiles(tileset: pxt.TileSet) {
    const transparency = "myTiles.transparency" + tileset.tileWidth;

    return tileset.tiles
        .map((t, i) => ([t, i] as [pxt.Tile, number]))
        .filter(([t]) => t.isProjectTile)
        .sort(([a], [b]) => {
            if (a.id == transparency) return -1
            else if (b.id == transparency) return 1
            else return a.internalID - b.internalID;
        });
}

function drawBitmap(colors: string[], bitmap: pxt.sprite.Bitmap, x0 = 0, y0 = 0, transparent = true, cellWidth = SCALE, target: HTMLCanvasElement) {
    const context = target.getContext("2d");
    context.imageSmoothingEnabled = false;
    for (let x = 0; x < bitmap.width; x++) {
        for (let y = 0; y < bitmap.height; y++) {
            const index = bitmap.get(x, y);

            if (index) {
                context.fillStyle = colors[index];
                context.fillRect((x + x0) * cellWidth, (y + y0) * cellWidth, cellWidth, cellWidth);
            }
            else {
                if (!transparent) context.clearRect((x + x0) * cellWidth, (y + y0) * cellWidth, cellWidth, cellWidth);
            }
        }
    }
}

function isGalleryTile(t: RenderedTile): t is GalleryTile {
    return !!(t as GalleryTile).qualifiedName;
}
