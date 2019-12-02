import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore, TilemapState, TileCategory, TileDrawingMode, GalleryTile } from '../store/imageReducer';
import { dispatchChangeSelectedColor, dispatchChangeBackgroundColor, dispatchSwapBackgroundForeground, dispatchChangeTilePaletteCategory, dispatchChangeTilePalettePage, dispatchChangeDrawingMode, dispatchCreateNewTile, dispatchSetGalleryOpen, dispatchOpenTileEditor, dispatchDeleteTile } from '../actions/dispatch';
import { TimelineFrame } from '../TimelineFrame';
import { Dropdown, DropdownOption } from '../Dropdown';
import { Pivot, PivotOption } from '../Pivot';
import { IconButton } from '../Button';

export interface TilePaletteProps {
    colors: string[];
    tileset: pxt.sprite.TileSet;
    selected: number;
    backgroundColor: number;

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
}

/**
 * This is a scaling factor for all of the pixels in the canvas. Scaling is not needed for browsers
 * that support "image-rendering: pixelated," so only scale for Microsoft Edge.
 */
const SCALE = pxt.BrowserUtils.isEdge() ? 25 : 1;

const options: DropdownOption[] = [
    {
        id: "forest",
        text: "Forest"
    }, {
        id: "aquatic",
        text: "Aquatic"
    }, {
        id: "dungeon",
        text: "Dungeon"
    }, {
        id: "misc",
        text: "Miscellaneous"
    }
];

const tabs: PivotOption[] = [
    {
        id: "custom",
        text: "My Tiles"
    }, {
        id: "gallery",
        text: "Gallery"
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

    componentDidMount() {
        this.canvas = this.refs["tile-canvas-surface"] as HTMLCanvasElement;
        this.updateGalleryTiles();
        this.redrawCanvas();
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

        let totalPages = Math.ceil(this.categoryTiles.length / 16);

        // Add an empty page for the tile create button if the last page is full
        if (!galleryOpen && this.categoryTiles.length % 16 === 0) totalPages++;

        const showCreateTile = !galleryOpen && (totalPages === 1 || page === totalPages - 1);
        const controlsDisabled = galleryOpen || !this.renderedTiles.some(t => !isGalleryTile(t) && t.index === selected);

        return <div className="tile-palette">
            <div className="tile-palette-fg-bg">
                <div className={`tile-palette-swatch ${drawingMode == TileDrawingMode.Default ? 'selected' : ''}`} onClick={this.foregroundBackgroundClickHandler} role="button">
                    <TimelineFrame
                        frames={[{ bitmap: fg }]}
                        colors={colors} />
                </div>
                <div className="tile-palette-swatch" onClick={this.foregroundBackgroundClickHandler} role="button">
                    <TimelineFrame
                        frames={[{ bitmap: bg }]}
                        colors={colors} />
                </div>
                <div className="tile-palette-spacer"></div>
                <div className={`tile-palette-swatch ${drawingMode == TileDrawingMode.Wall ? 'selected' : ''}`} onClick={this.wallClickHandler} role="button">
                    <TimelineFrame
                        frames={[{ bitmap: wall }]}
                        colors={colors} />
                </div>
            </div>
            <Pivot options={tabs} selected={galleryOpen ? 1 : 0} onChange={this.pivotHandler} />
            <div className="tile-palette-controls-outer">
                { galleryOpen && <Dropdown onChange={this.dropdownHandler} options={options} selected={category} /> }

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
                            onClick={this.tileDeleteHandler}
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
                    <canvas ref="tile-canvas-surface" className="paint-surface" onMouseDown={this.canvasClickHandler} role="complementary"></canvas>
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
        const { tileset, page, gallery, category, galleryOpen } = this.props;

        if (galleryOpen) {
            this.categoryTiles = gallery.filter(t => t.tags.indexOf(options[category].id) !== -1 && t.tileWidth === tileset.tileWidth);
        }
        else {
            this.categoryTiles = tileset.tiles
                .map((t, i) => ([t, i] as [pxt.sprite.TileInfo, number]))
                .filter(([t]) => !t.qualifiedName && t.data)
                .map(([t, i]) => ({ index: i, bitmap: t.data }));
        }

        const startIndex = page * 16;
        this.renderedTiles = this.categoryTiles.slice(startIndex, startIndex + 16);
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

    protected tileDeleteHandler = () => {
        const { tileset, selected, dispatchDeleteTile } = this.props;

        if (!tileset.tiles[selected] || tileset.tiles[selected].qualifiedName || selected === 0) return;

        dispatchDeleteTile(selected);
    }

    protected canvasClickHandler = (ev: React.MouseEvent<HTMLCanvasElement>) => {
        const bounds = this.canvas.getBoundingClientRect();
        const column = ((ev.clientX - bounds.left) / (bounds.width / 4)) | 0;
        const row = ((ev.clientY - bounds.top) / (bounds.height / 4)) | 0;

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

            const isRightClick = ev.button > 0;

            if (index >= 0) {
                if (isRightClick) this.props.dispatchChangeBackgroundColor(index);
                else this.props.dispatchChangeSelectedColor(index);
                // automatically switch into tile drawing mode
                this.props.dispatchChangeDrawingMode(TileDrawingMode.Default);
            }
            else {
                const { selected, backgroundColor, tileset } = this.props;
                const newIndex = tileset.tiles.length;

                this.props.dispatchCreateNewTile(
                    tile.bitmap,
                    isRightClick ? selected : newIndex,
                    isRightClick ? newIndex : backgroundColor,
                    qname
                );
            }
        }
    }

    protected positionCreateTileButton() {
        const button = this.refs["create-tile-ref"] as HTMLDivElement;

        if (button) {
            const column = this.categoryTiles.length % 4;
            const row = Math.floor(this.categoryTiles.length / 4);

            button.style.position = "absolute";
            button.style.left = (column * 25) + "%";
            button.style.top = (row * 25) + "%";
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

    return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} 10`} className="tile-palette-pages">
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
        galleryOpen: editor.tileGalleryOpen
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
    dispatchDeleteTile
};


export const TilePalette = connect(mapStateToProps, mapDispatchToProps)(TilePaletteImpl);