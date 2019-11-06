import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore, TilemapState } from '../store/imageReducer';
import { dispatchChangeSelectedColor, dispatchChangeBackgroundColor, dispatchSwapBackgroundForeground } from '../actions/dispatch';
import { TimelineFrame } from '../TimelineFrame';

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

class TilePaletteImpl extends React.Component<TilePaletteProps,{}> {
    protected handlers: ((ev: React.MouseEvent<HTMLDivElement>) => void)[] = [];

    render() {
        const { colors, selected, backgroundColor, dispatchSwapBackgroundForeground, tileset } = this.props;
        const SPACER = 1;
        const HEIGHT = 10;

        const width = 3 * SPACER + 2 * HEIGHT;

        return <div className="tile-palette">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${HEIGHT * 1.5}`} onClick={dispatchSwapBackgroundForeground}>
                <defs>
                    <pattern id="alpha-background" width="6" height="6" patternUnits="userSpaceOnUse">
                        <rect x="0" y="0" width="6px" height="6px" fill="#aeaeae" />
                        <rect x="0" y="0" width="3px" height="3px" fill="#dedede"/>
                        <rect x="3" y="3" width="3px" height="3px" fill="#dedede"/>
                    </pattern>
                </defs>
                <g>
                    <rect
                        fill={backgroundColor ? colors[backgroundColor] : "url(#alpha-background)"}
                        x={width - (SPACER << 1) - (HEIGHT * 1.5)}
                        y={SPACER << 2}
                        width={HEIGHT * 1.5}
                        height={HEIGHT}
                        stroke="#3c3c3c"
                        strokeWidth="0.5">
                    </rect>
                    <rect
                        fill={selected ? colors[selected] : "url(#alpha-background)"}
                        x={SPACER << 1}
                        y={SPACER}
                        width={HEIGHT * 1.5}
                        height={HEIGHT}
                        stroke="#3c3c3c"
                        strokeWidth="0.5">
                    </rect>
                </g>
            </svg>
            <div className="image-editor-tile-buttons-outer">
                <div className="image-editor-tile-buttons" onContextMenu={this.preventContextMenu}>
                    { tileset.tiles.map((t, i) =>
                        <div className={`image-editor-tile-button ${i === selected ? selected : 0}`} onClick={this.clickHandler(i)}>
                            <TimelineFrame
                                frames={[{ bitmap: t }]}
                                colors={colors} />
                            </div>
                        )
                    }
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