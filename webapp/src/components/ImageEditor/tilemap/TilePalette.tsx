import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore, TilemapState } from '../store/imageReducer';
import { dispatchChangeSelectedColor, dispatchChangeBackgroundColor, dispatchSwapBackgroundForeground } from '../actions/dispatch';
import { TimelineFrame } from '../TimelineFrame';
import { Dropdown, DropdownOption } from '../Dropdown';

export interface TilePaletteProps {
    colors: string[];
    tileset: pxt.sprite.TileSet;
    selected: number;
    backgroundColor: number;
    dispatchChangeSelectedColor: (index: number) => void;
    dispatchChangeBackgroundColor: (index: number) => void;
    dispatchSwapBackgroundForeground: () => void;
}

/**
 * This is a scaling factor for all of the pixels in the canvas. Scaling is not needed for browsers
 * that support "image-rendering: pixelated," so only scale for Microsoft Edge and Chrome on MacOS.
 *
 * Chrome on MacOS should be fixed in the next release: https://bugs.chromium.org/p/chromium/issues/detail?id=134040
 */
const SCALE = ((pxt.BrowserUtils.isMac() && pxt.BrowserUtils.isChrome()) || pxt.BrowserUtils.isEdge()) ? 25 : 1;

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
    protected handlers: ((ev: React.MouseEvent<HTMLDivElement>) => void)[] = [];

    render() {
        const { colors, selected, backgroundColor, dispatchSwapBackgroundForeground, tileset } = this.props;

        return <div className="tile-palette">
            <div className="tile-palette-fg-bg" onClick={dispatchSwapBackgroundForeground}>
                <div className="tile-palette-swatch fg">
                    <TimelineFrame
                        frames={[{ bitmap: tileset.tiles[selected] }]}
                        colors={colors} />
                </div>
                <div className="tile-palette-swatch">
                    <TimelineFrame
                        frames={[{ bitmap: tileset.tiles[backgroundColor] }]}
                        colors={colors} />
                </div>
                <div className="tile-palette-swatch">
                    <TimelineFrame
                        frames={[{ bitmap: tileset.tiles[backgroundColor] }]}
                        colors={colors} />
                </div>
            </div>
            <Dropdown onChange={this.dropdownHandler} options={options} />
            <div className="tile-canvas-outer">
                <div className="tile-canvas">
                    <canvas ref="tile-canvas-surface"></canvas>
                </div>
                <div className="tile-canvas-controls">

                </div>
            </div>
        </div>;
    }

    protected clickHandler(index: number) {
        if (!this.handlers[index]) this.handlers[index] = (ev: React.MouseEvent<HTMLDivElement>) => {
            if (ev.button === 0) {
                this.props.dispatchChangeSelectedColor(index);
            }
            else {
                this.props.dispatchChangeBackgroundColor(index);
                ev.preventDefault();
                ev.stopPropagation();
            }
        }

        return this.handlers[index];
    }

    protected dropdownHandler = (option: DropdownOption, index: number) => {

    }

    protected preventContextMenu = (ev: React.MouseEvent<any>) => ev.preventDefault();
}

function mapStateToProps({ store: { present }, editor }: ImageEditorStore, ownProps: any) {
    let state = (present as TilemapState);
    if (!state) return {};
    return {
        selected: editor.selectedColor,
        tileset: state.tileset,
        backgroundColor: editor.backgroundColor,
        colors: state.colors
    };
}

const mapDispatchToProps = {
    dispatchChangeSelectedColor,
    dispatchChangeBackgroundColor,
    dispatchSwapBackgroundForeground,
};


export const TilePalette = connect(mapStateToProps, mapDispatchToProps)(TilePaletteImpl);