import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore, TilemapState, TileCategory, TileDrawingMode } from '../store/imageReducer';
import { dispatchChangeSelectedColor, dispatchChangeBackgroundColor, dispatchSwapBackgroundForeground, dispatchChangeTilePaletteCategory, dispatchChangeTilePalettePage, dispatchChangeDrawingMode } from '../actions/dispatch';
import { TimelineFrame } from '../TimelineFrame';
import { Dropdown, DropdownOption } from '../Dropdown';

export interface TilePaletteProps {
    colors: string[];
    tileset: pxt.sprite.TileSet;
    selected: number;
    backgroundColor: number;

    category: TileCategory;
    page: number;

    drawingMode: TileDrawingMode;

    dispatchChangeSelectedColor: (index: number) => void;
    dispatchChangeBackgroundColor: (index: number) => void;
    dispatchSwapBackgroundForeground: () => void;
    dispatchChangeTilePalettePage: (index: number) => void;
    dispatchChangeTilePaletteCategory: (category: TileCategory) => void;
    dispatchChangeDrawingMode: (drawingMode: TileDrawingMode) => void;
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

class TilePaletteImpl extends React.Component<TilePaletteProps,{}> {
    protected canvas: HTMLCanvasElement;
    protected renderedTiles: pxt.sprite.TileInfo[];

    componentDidMount() {
        this.canvas = this.refs["tile-canvas-surface"] as HTMLCanvasElement;
        this.redrawCanvas();
    }

    componentDidUpdate() {
        this.redrawCanvas();
    }

    render() {
        const { colors, selected, backgroundColor, tileset, category, page, drawingMode } = this.props;

        return <div className="tile-palette">
            <div className="tile-palette-fg-bg">
                <div className={`tile-palette-swatch ${drawingMode == TileDrawingMode.Default ? 'selected' : ''}`} onClick={this.foregroundBackgroundClickHandler}>
                    <TimelineFrame
                        frames={[{ bitmap: tileset.tiles[selected].data }]}
                        colors={colors} />
                </div>
                <div className="tile-palette-swatch" onClick={this.foregroundBackgroundClickHandler}>
                    <TimelineFrame
                        frames={[{ bitmap: tileset.tiles[backgroundColor].data }]}
                        colors={colors} />
                </div>
                <div className="tile-palette-spacer"></div>
                <div className={`tile-palette-swatch ${drawingMode == TileDrawingMode.Wall ? 'selected' : ''}`} onClick={this.wallClickHandler}>
                    <TimelineFrame
                        frames={[{ bitmap: tileset.tiles[0].data }]}
                        colors={colors} />
                </div>
            </div>
            <Dropdown onChange={this.dropdownHandler} options={options} selected={category} />
            <div className="tile-canvas-outer" onContextMenu={this.preventContextMenu}>
                <div className="tile-canvas">
                    <canvas ref="tile-canvas-surface" className="paint-surface" onMouseDown={this.canvasClickHandler}></canvas>
                </div>
                <div className="tile-canvas-controls">
                    { pageControls(3, page, this.pageHandler) }
                </div>
            </div>
        </div>;
    }

    protected redrawCanvas() {
        const columns = 4;
        const rows = 4;
        const margin = 1;

        const { tileset, category, page } = this.props;

        const tiles = tileset.tiles.filter(t => t.tags.indexOf(options[category].id) !== -1);
        const startIndex = page * columns * rows;
        this.renderedTiles = tiles.slice(startIndex, startIndex + rows * columns);

        const width = tileset.tileWidth + margin;

        this.canvas.width = (width * columns - margin) * SCALE;
        this.canvas.height = (width * rows - margin) * SCALE;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                const tile = tiles[startIndex + r * columns + c];

                if (tile)
                    this.drawBitmap(pxt.sprite.Bitmap.fromData(tile.data), c * width, r * width)
            }
        }
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

    protected pageHandler = (page: number) => {
        this.props.dispatchChangeTilePalettePage(page);
    }

    protected canvasClickHandler = (ev: React.MouseEvent<HTMLCanvasElement>) => {
        const bounds = this.canvas.getBoundingClientRect();
        const column = ((ev.clientX - bounds.left) / (bounds.width / 4)) | 0;
        const row = ((ev.clientY - bounds.top) / (bounds.height / 4)) | 0;

        const tile = this.renderedTiles[row * 4 + column];
        if (tile) {
            if (ev.button > 0) this.props.dispatchChangeBackgroundColor(tile.globalId);
            else this.props.dispatchChangeSelectedColor(tile.globalId);
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
        drawingMode: editor.drawingMode
    };
}

const mapDispatchToProps = {
    dispatchChangeSelectedColor,
    dispatchChangeBackgroundColor,
    dispatchSwapBackgroundForeground,
    dispatchChangeTilePalettePage,
    dispatchChangeTilePaletteCategory,
    dispatchChangeDrawingMode
};


export const TilePalette = connect(mapStateToProps, mapDispatchToProps)(TilePaletteImpl);