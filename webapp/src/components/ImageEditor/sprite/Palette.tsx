import * as React from 'react';
import { connect } from 'react-redux';
import { ImageEditorStore, AnimationState } from '../store/imageReducer';
import { dispatchChangeSelectedColor, dispatchChangeBackgroundColor, dispatchSwapBackgroundForeground } from '../actions/dispatch';
import { Button } from '../../../../../react-common/components/controls/Button';
import { classList } from '../../../../../react-common/components/util';

export interface PaletteProps {
    colors: string[];
    selected: number;
    backgroundColor: number;
    dispatchChangeSelectedColor: (index: number) => void;
    dispatchChangeBackgroundColor: (index: number) => void;
    dispatchSwapBackgroundForeground: () => void;
}

class PaletteImpl extends React.Component<PaletteProps,{}> {
    render() {
        const { colors, selected, backgroundColor, dispatchSwapBackgroundForeground } = this.props;
        const SPACER = 1;
        const HEIGHT = 10;

        const width = 3 * SPACER + 2 * HEIGHT;

        return <div>
            <svg xmlns="http://www.w3.org/2000/svg" className="image-editor-colors" viewBox={`0 0 ${width} ${HEIGHT * 1.5}`} onClick={dispatchSwapBackgroundForeground}>
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
                        strokeWidth="0.5"
                    >
                        <title>{colorTooltip(backgroundColor, colors[backgroundColor])}</title>
                    </rect>
                    <rect
                        fill={selected ? colors[selected] : "url(#alpha-background)"}
                        x={SPACER << 1}
                        y={SPACER}
                        width={HEIGHT * 1.5}
                        height={HEIGHT}
                        stroke="#3c3c3c"
                        strokeWidth="0.5"
                    >
                        <title>{colorTooltip(selected, colors[selected])}</title>
                    </rect>
                </g>
            </svg>
            <div className="image-editor-color-buttons" onContextMenu={this.preventContextMenu}>
                {this.props.colors.map((color, index) =>
                    <Button
                        key={index}
                        className={classList("image-editor-button", index === 0 && "checkerboard")}
                        title={colorTooltip(index, color)}
                        style={index === 0 ? null : { "--preview-color": color } as React.CSSProperties}
                        onClick={() => this.props.dispatchChangeSelectedColor(index)}
                        onRightClick={() => this.props.dispatchChangeBackgroundColor(index)}
                    />
                )}
            </div>
        </div>;
    }

    protected preventContextMenu = (ev: React.MouseEvent<any>) => ev.preventDefault();
}

function colorTooltip(index: number, color: string) {
    const namedColor = index === 0 ? lf("transparency") : hexToNamedColor(color);
    return namedColor ? lf("Color {0} ({1})", index, namedColor) : lf("Color {0}", index);
}

function hexToNamedColor(color: string) {
    /**
     * Default colors for arcade; match the default colors set as palette in
     * https://github.com/microsoft/pxt-arcade/blob/master/libs/device/pxt.json#L32
     * and names for those colors described in
     * https://arcade.makecode.com/reference/scene/background-color#color-number
     */
    switch (color?.toLowerCase()) {
        case "#ffffff":
            return lf("white");
        case "#ff2121":
            return lf("red");
        case "#ff93c4":
            return lf("pink");
        case "#ff8135":
            return lf("orange");
        case "#fff609":
            return lf("yellow");
        case "#249ca3":
            return lf("teal");
        case "#78dc52":
            return lf("green");
        case "#003fad":
            return lf("blue");
        case "#87f2ff":
            return lf("light blue");
        case "#8e2ec4":
            return lf("purple");
        case "#a4839f":
            return lf("light purple");
        case "#5c406c":
            return lf("dark purple");
        case "#e5cdc4":
            return lf("tan")
        case "#91463d":
            return lf("brown");
        case "#000000":
            return lf("black");
        default:
            return undefined;
    }
}

function mapStateToProps({ store: { present }, editor }: ImageEditorStore, ownProps: any) {
    let state = (present as AnimationState);
    if (!state) return {};
    return {
        selected: editor.selectedColor,
        backgroundColor: editor.backgroundColor,
        colors: state.colors
    };
}

const mapDispatchToProps = {
    dispatchChangeSelectedColor,
    dispatchChangeBackgroundColor,
    dispatchSwapBackgroundForeground,
};


export const Palette = connect(mapStateToProps, mapDispatchToProps)(PaletteImpl);
