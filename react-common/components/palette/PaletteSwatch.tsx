import * as React from "react";
import { Palette } from "./Palettes";

export interface PaletteSwatchProps {
    palette: Palette;
}

export const PaletteSwatch = (props: PaletteSwatchProps) => {
    const { palette } = props;


    return <div className="common-palette-swatch">
        <div className="common-palette-swatch-name">
            {palette.name}
        </div>
        <div className="common-palette-color-list">
            {palette.colors.slice(1).map((color, index) => <PaletteColor key={index} color={color} />)}
        </div>
    </div>
}

interface PaletteColorProps {
    color: string;
}

const PaletteColor = (props: PaletteColorProps) =>
    <div className="common-palette-color" style={{backgroundColor: props.color}} />