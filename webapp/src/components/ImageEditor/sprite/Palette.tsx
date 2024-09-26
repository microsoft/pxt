import * as React from 'react';
import { changeBackgroundColor, changeSelectedColor, ImageEditorContext, swapForegroundBackground } from '../state';


export const Palette = () => {
    const { state, dispatch } = React.useContext(ImageEditorContext);

    const { selectedColor, backgroundColor } = state.editor
    const { colors } = state.store.present;

    const SPACER = 1;
    const HEIGHT = 10;

    const width = 3 * SPACER + 2 * HEIGHT;

    const onColorSelected = (index: number, ev: React.MouseEvent<HTMLDivElement>) => {
        if (ev.button === 0) {
            dispatch(changeSelectedColor(index));
        }
        else {
            dispatch(changeBackgroundColor(index));
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    const preventContextMenu = React.useCallback((ev: React.MouseEvent) => {
        ev.preventDefault();
    }, [])

    const onBackgroundForegroundClick = React.useCallback(() => {
        dispatch(swapForegroundBackground());
    }, [dispatch])

    return (
        <div>
            <svg xmlns="http://www.w3.org/2000/svg" className="image-editor-colors" viewBox={`0 0 ${width} ${HEIGHT * 1.5}`} onClick={onBackgroundForegroundClick}>
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
                        fill={selectedColor ? colors[selectedColor] : "url(#alpha-background)"}
                        x={SPACER << 1}
                        y={SPACER}
                        width={HEIGHT * 1.5}
                        height={HEIGHT}
                        stroke="#3c3c3c"
                        strokeWidth="0.5"
                    >
                        <title>{colorTooltip(selectedColor, colors[selectedColor])}</title>
                    </rect>
                </g>
            </svg>
            <div className="image-editor-color-buttons" onContextMenu={preventContextMenu}>
                {colors.map((color, index) =>
                    <div key={index}
                        className={`image-editor-button ${index === 0 ? "checkerboard" : ""}`}
                        role="button"
                        title={colorTooltip(index, color)}
                        onMouseDown={ev => onColorSelected(index, ev)}
                        style={index === 0 ? null : { backgroundColor: color }}
                    />
                )}
            </div>
        </div>
    );
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
