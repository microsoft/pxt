import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore, TilemapState, TileCategory, TileDrawingMode, GalleryTile } from '../store/imageReducer';
import { dispatchChangeSelectedColor, dispatchChangeBackgroundColor, dispatchSwapBackgroundForeground,
    dispatchChangeTilePaletteCategory, dispatchChangeTilePalettePage, dispatchChangeDrawingMode,
    dispatchCreateNewTile, dispatchSetGalleryOpen, dispatchOpenTileEditor, dispatchDeleteTile,
    dispatchShowAlert, dispatchHideAlert } from '../actions/dispatch';
import { TimelineFrame } from '../TimelineFrame';
import { Dropdown, DropdownOption } from '../Dropdown';
import { Pivot, PivotOption } from '../Pivot';
import { IconButton } from '../Button';
import { AlertOption } from '../Alert';

export interface TilePaletteProps {
    colors: string[];
    tileset: pxt.sprite.TileSet;
    selected: number;
    backgroundColor: number;

    referencedTiles: number[];

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
    dispatchCreateNewTile: (bitmap: pxt.sprite.BitmapData, foreground: number, background: number, qualifiedName?: string) => void;
    dispatchSetGalleryOpen: (open: boolean) => void;
    dispatchOpenTileEditor: (editIndex?: number) => void;
    dispatchDeleteTile: (index: number) => void;
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

type RenderedTile = GalleryTile | UserTile

class TilePaletteImpl extends React.Component<TilePaletteProps,{}> {
    protected canvas: HTMLCanvasElement;
    protected renderedTiles: RenderedTile[];
    protected categoryTiles: RenderedTile[];
    protected categories: Category[];

    constructor(props: TilePaletteProps) {
        super(props);

        const { gallery, tileset } = props;
        options.forEach(opt => {
            if (opt.tiles.length == 0) {
                opt.tiles.push.apply(opt.tiles,
                    gallery.filter(t => t.tags.indexOf(opt.id) !== -1 && t.tileWidth === tileset.tileWidth));
                }
        })

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

        this.categories = options.concat(Object.keys(extraCategories).map(key => extraCategories[key]));
    }

    componentDidMount() {
        this.canvas = this.refs["tile-canvas-surface"] as HTMLCanvasElement;
        this.updateGalleryTiles();
        this.redrawCanvas();
    }

    componentWillReceiveProps(nextProps: TilePaletteProps) {
        if (this.props.selected != nextProps.selected) {
            this.jumpToPageContaining(nextProps.selected);
        } else if (this.props.backgroundColor != nextProps.backgroundColor) {
            this.jumpToPageContaining(nextProps.backgroundColor);
        }
    }

    componentDidUpdate() {
        this.updateGalleryTiles();
        this.redrawCanvas();
    }

    render() {
        const { colors, selected, backgroundColor, tileset, category, page, drawingMode, galleryOpen } = this.props;

        const fg = tileset.tiles[selected] ? tileset.tiles[selected].data : emptyTile.data();
        const bg = tileset.tiles[backgroundColor] ? tileset.tiles[backgroundColor].data : emptyTile.data();
        const wall = emptyTile.data();
        this.updateGalleryTiles();

        let totalPages = Math.ceil(this.categoryTiles.length / TILES_PER_PAGE);

        // Add an empty page for the tile create button if the last page is full
        if (!galleryOpen && this.categoryTiles.length % 16 === 0) totalPages++;

        const showCreateTile = !galleryOpen && (totalPages === 1 || page === totalPages - 1);
        const controlsDisabled = galleryOpen || !this.renderedTiles.some(t => !isGalleryTile(t) && t.index === selected);

        return <div className="tile-palette">
            <div className="tile-palette-fg-bg">
                <div className={`tile-palette-swatch fg ${drawingMode == TileDrawingMode.Default ? 'selected' : ''}`} onClick={this.foregroundBackgroundClickHandler} role="button">
                    <TimelineFrame
                        frames={[{ bitmap: fg }]}
                        colors={colors} />
                </div>
                <div className="tile-palette-swatch bg" onClick={this.foregroundBackgroundClickHandler} role="button">
                    <TimelineFrame
                        frames={[{ bitmap: bg }]}
                        colors={colors} />
                    <IconButton
                        iconClass={"ms-Icon ms-Icon--ReturnKey"}
                        title={lf("Swap the background and foreground colors.")}
                        toggle={true} />
                </div>
                <div className={`tile-palette-swatch wall ${drawingMode == TileDrawingMode.Wall ? 'selected' : ''}`}
                    onClick={this.wallClickHandler}
                    title={lf("Draw walls")}
                    role="button">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
                        <path d="M 968.49289,108.05443 771.30518,3.7581533 183.65231,166.0694 l 2.58963,202.62638 -156.247366,54.4148 0.872799,492.65563 179.544267,81.08212 758.08125,-222.4989 z M 765.6275,42.836761 916.79721,122.02922 412.26526,262.35026 250.08966,187.43643 Z M 934.62189,739.077 234.56171,946.92199 233.81426,554.79578 422.38222,493.25053 423.42046,300.4059 934.62189,157.54989 Z M 204.96854,402.33519 361.49056,473.98651 222.88861,518.46222 75.008408,444.5191 Z" />
                    </svg>
                </div>
            </div>
            <Pivot options={tabs} selected={galleryOpen ? 1 : 0} onChange={this.pivotHandler} />
            <div className="tile-palette-controls-outer">
                { galleryOpen && <Dropdown onChange={this.dropdownHandler} options={this.categories} selected={category} /> }

                { !galleryOpen &&
                    <div className="tile-palette-controls">
                        <IconButton
                            onClick={this.tileEditHandler}
                            iconClass={"ms-Icon ms-Icon--SingleColumnEdit"}
                            title={lf("Edit the selected tile")}
                            disabled={controlsDisabled}
                            toggle={!controlsDisabled}
                        />
                        <IconButton
                            onClick={this.tileDuplicateHandler}
                            iconClass={"ms-Icon ms-Icon--Copy"}
                            title={lf("Duplicate the selected tile")}
                            disabled={controlsDisabled}
                            toggle={!controlsDisabled}
                        />
                        <IconButton
                            onClick={this.tileDeleteAlertHandler}
                            iconClass={"ms-Icon ms-Icon--Delete"}
                            title={lf("Delete the selected tile")}
                            disabled={controlsDisabled}
                            toggle={!controlsDisabled}
                        />
                    </div>
                }
            </div>

            <div className="tile-canvas-outer" onContextMenu={this.preventContextMenu}>
                <div className="tile-canvas">
                    <canvas ref="tile-canvas-surface" className="paint-surface" onMouseDown={this.canvasClickHandler} onTouchStart={this.canvasTouchHandler} role="complementary"></canvas>
                    { showCreateTile &&
                        <div ref="create-tile-ref">
                            <IconButton
                                onClick={this.tileCreateHandler}
                                iconClass={"ms-Icon ms-Icon--Add"}
                                title={lf("Create a new tile")}
                                toggle={true}
                            />
                        </div>
                    }
                </div>
                <div className="tile-canvas-controls">
                    { pageControls(totalPages, page, this.pageHandler) }
                </div>
            </div>
        </div>;
    }

    protected updateGalleryTiles() {
        const { page, category, galleryOpen } = this.props;

        if (galleryOpen) {
            this.categoryTiles = this.categories[category].tiles;
        }
        else {
            this.categoryTiles = this.getCustomTiles().map(([t, i]) => ({ index: i, bitmap: t.data }));
        }

        const startIndex = page * TILES_PER_PAGE;
        this.renderedTiles = this.categoryTiles.slice(startIndex, startIndex + TILES_PER_PAGE);
    }

    protected jumpToPageContaining(index: number) {
        const { tileset, dispatchSetGalleryOpen, dispatchChangeTilePaletteCategory,
            dispatchChangeTilePalettePage } = this.props;
        if (!index || index < 0 || index >= tileset.tiles.length) return;

        const tile = tileset.tiles[index];
        if (!!tile.qualifiedName) {
            // For gallery tile, find the category then the page within the category
            const category = this.categories.find(opt => opt.tiles.findIndex(t => t.qualifiedName == tile.qualifiedName) !== -1);
            if (!category || !category.tiles) return;
            const page = Math.max(Math.floor(category.tiles.findIndex(t => t.qualifiedName == tile.qualifiedName) / TILES_PER_PAGE), 0);

            dispatchSetGalleryOpen(true);
            dispatchChangeTilePaletteCategory(this.categories.indexOf(category) as TileCategory);
            dispatchChangeTilePalettePage(page);
        } else {
            // For custom tile, find the page
            const categoryTiles = this.getCustomTiles().map(([t, i]) => t);
            if (!categoryTiles) return;
            const page = Math.max(Math.floor(categoryTiles.findIndex(t => t.projectId == tile.projectId) / TILES_PER_PAGE), 0);

            dispatchSetGalleryOpen(false);
            dispatchChangeTilePalettePage(page);
        }
    }

    protected redrawCanvas() {
        const columns = 4;
        const rows = 4;
        const margin = 1;

        const { tileset, page, selected } = this.props;

        const startIndex = page * columns * rows;

        const width = tileset.tileWidth + margin;

        this.canvas.width = (width * columns + margin) * SCALE;
        this.canvas.height = (width * rows + margin) * SCALE;

        const context = this.canvas.getContext("2d");

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                const tile = this.categoryTiles[startIndex + r * columns + c];

                if (tile) {
                    if (!isGalleryTile(tile) && tile.index === selected) {
                        context.fillStyle = "#ff0000";
                        context.fillRect(c * width, r * width, width + 1, width + 1);
                    }

                    context.fillStyle = "#333333";
                    context.fillRect(c * width + 1, r * width + 1, width - 1, width - 1);

                    this.drawBitmap(pxt.sprite.Bitmap.fromData(tile.bitmap), 1 + c * width, 1 + r * width)
                }
            }
        }

        this.positionCreateTileButton();
    }

    protected drawBitmap(bitmap: pxt.sprite.Bitmap, x0 = 0, y0 = 0, transparent = true, cellWidth = SCALE, target = this.canvas) {
        const { colors } = this.props;

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

    protected dropdownHandler = (option: DropdownOption, index: number) => {
        this.props.dispatchChangeTilePaletteCategory(index);
    }

    protected pivotHandler = (option: PivotOption, index: number) => {
        this.props.dispatchSetGalleryOpen(index === 1);
    }

    protected pageHandler = (page: number) => {
        this.props.dispatchChangeTilePalettePage(page);
    }

    protected tileCreateHandler = () => {
        this.props.dispatchOpenTileEditor();
    }

    protected tileEditHandler = () => {
        const { tileset, selected, dispatchOpenTileEditor } = this.props;

        if (!tileset.tiles[selected] || tileset.tiles[selected].qualifiedName || selected === 0) return;

        dispatchOpenTileEditor(selected);
    }

    protected tileDuplicateHandler = () => {
        const { tileset, selected, backgroundColor, dispatchCreateNewTile } = this.props;

        if (!tileset.tiles[selected] || tileset.tiles[selected].qualifiedName || selected === 0) return;

        dispatchCreateNewTile(tileset.tiles[selected].data, tileset.tiles.length, backgroundColor);
    }

    protected tileDeleteAlertHandler = () => {
        const { tileset, selected, dispatchShowAlert, dispatchHideAlert, referencedTiles } = this.props;

        const info = tileset.tiles[selected];

        if (!selected || !info || info.qualifiedName) return;

        // tile cannot be deleted because it is referenced in the code
        if (referencedTiles && referencedTiles.indexOf(info.projectId) !== -1) {
            dispatchShowAlert(lf("Unable to delete"),
                lf("This tile is used in your game. Remove all blocks using the tile before deleting."),
                [{ label: lf("Cancel"), onClick: dispatchHideAlert }]);
            return;
        }

        dispatchShowAlert(lf("Are you sure?"),
            lf("Deleting this tile will remove it from all other tile maps in your game."),
            [{ label: lf("Yes"), onClick: this.deleteTile}, { label: lf("No"), onClick: dispatchHideAlert }]);
    }

    protected deleteTile = () => {
        this.props.dispatchDeleteTile(this.props.selected);
    }

    protected canvasClickHandler = (ev: React.MouseEvent<HTMLCanvasElement>) => {
        this.handleCanvasClickCore(ev.clientX, ev.clientY, ev.button > 0);
    }

    protected canvasTouchHandler = (ev: React.TouchEvent<HTMLCanvasElement>) => {
        this.handleCanvasClickCore(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY, false);
    }

    protected handleCanvasClickCore(clientX: number, clientY: number, isRightClick: boolean) {
        const bounds = this.canvas.getBoundingClientRect();
        const column = ((clientX - bounds.left) / (bounds.width / 4)) | 0;
        const row = ((clientY - bounds.top) / (bounds.height / 4)) | 0;

        const tile = this.renderedTiles[row * 4 + column];
        if (tile) {
            let index: number;
            let qname: string;

            if (isGalleryTile(tile)) {
                index = this.getTileIndex(tile);
                qname = tile.qualifiedName;
            }
            else {
                index = tile.index;
            }

            if (index >= 0) {
                if (isRightClick) this.props.dispatchChangeBackgroundColor(index);
                else this.props.dispatchChangeSelectedColor(index);
            }
            else {
                const { selected, backgroundColor, tileset } = this.props;
                const newIndex = tileset.tiles.length || 1; // transparent is index 0, so default to 1

                this.props.dispatchCreateNewTile(
                    tile.bitmap,
                    isRightClick ? selected : newIndex,
                    isRightClick ? newIndex : backgroundColor,
                    qname
                );
            }
            // automatically switch into tile drawing mode
            this.props.dispatchChangeDrawingMode(TileDrawingMode.Default);
        }
    }

    protected positionCreateTileButton() {
        const button = this.refs["create-tile-ref"] as HTMLDivElement;

        if (button) {
            const column = this.categoryTiles.length % 4;
            const row = Math.floor(this.categoryTiles.length / 4) % 4;

            button.style.position = "absolute";
            button.style.left = "calc(" + (column / 4) + " * (100% - 0.5rem) + 0.25rem)";
            button.style.top = "calc(" + (row / 4) + " * (100% - 0.5rem) + 0.25rem)";
        }
    }

    protected foregroundBackgroundClickHandler = () => {
        if (this.props.drawingMode != TileDrawingMode.Default) {
            this.props.dispatchChangeDrawingMode(TileDrawingMode.Default);
        } else {
            this.props.dispatchSwapBackgroundForeground();
        }
    }

    protected wallClickHandler = () => {
        this.props.dispatchChangeDrawingMode(TileDrawingMode.Wall);
    }

    protected preventContextMenu = (ev: React.MouseEvent<any>) => ev.preventDefault();

    // Returns all custom tiles and their index in the entire tileset, sorted by index.
    protected getCustomTiles() {
        return this.props.tileset.tiles
            .map((t, i) => ([t, i] as [pxt.sprite.TileInfo, number]))
            .filter(([t]) => t.projectId != undefined && t.data)
            .sort(([a], [b]) => a.projectId - b.projectId);
    }

    protected getTileIndex(g: GalleryTile) {
        const { tileset } = this.props;

        for (let i = 0; i < tileset.tiles.length; i++) {
            if (tileset.tiles[i].qualifiedName === g.qualifiedName) return i;
        }

        return -1;
    }
}


function pageControls(pages: number, selected: number, onClick: (index: number) => void) {
    const width = 16 + (pages - 1) * 5;
    const pageMap: boolean[] = [];
    for (let i = 0; i < pages; i++) pageMap[i] = i === selected;

    return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} 10`} className={`tile-palette-pages ${pages < 2 ?  'disabled' : ''}`}>
        <polygon
            className="tile-palette-page-arrow"
            points="1,5 4,3 4,7"
            onClick={selected ? () => onClick(selected - 1) : undefined} />
        {
            pageMap.map((isSelected, index) =>
                <circle
                    className="tile-palette-page-dot"
                    key={index}
                    cx={8 + index * 5}
                    cy="5"
                    r={isSelected ? 2 : 1}
                    onClick={!isSelected ? () => onClick(index) : undefined}/>
            )
        }
        <polygon
            className="tile-palette-page-arrow"
            points={`${width - 1},5 ${width - 4},3 ${width - 4},7`}
            onClick={(selected < pages - 1) ? () =>  onClick(selected + 1) : undefined} />
    </svg>
}


function mapStateToProps({ store: { present }, editor }: ImageEditorStore, ownProps: any) {
    let state = (present as TilemapState);
    if (!state) return {};
    return {
        selected: editor.selectedColor,
        tileset: state.tileset,
        backgroundColor: editor.backgroundColor,
        category: editor.tilemapPalette.category,
        page: editor.tilemapPalette.page,
        colors: state.colors,
        drawingMode: editor.drawingMode,
        gallery: editor.tileGallery,
        galleryOpen: editor.tileGalleryOpen,
        referencedTiles: editor.referencedTiles
    };
}

function isGalleryTile(t: RenderedTile): t is GalleryTile {
    return !!(t as GalleryTile).qualifiedName;
}

const mapDispatchToProps = {
    dispatchChangeSelectedColor,
    dispatchChangeBackgroundColor,
    dispatchSwapBackgroundForeground,
    dispatchChangeTilePalettePage,
    dispatchChangeTilePaletteCategory,
    dispatchChangeDrawingMode,
    dispatchCreateNewTile,
    dispatchSetGalleryOpen,
    dispatchOpenTileEditor,
    dispatchDeleteTile,
    dispatchShowAlert,
    dispatchHideAlert
};


export const TilePalette = connect(mapStateToProps, mapDispatchToProps)(TilePaletteImpl);
