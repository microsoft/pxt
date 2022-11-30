import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { PalettePicker } from "../../../../react-common/components/palette/PalettePicker";
import { AllPalettes, Palette } from "../../../../react-common/components/palette/Palettes";

export const AssetPalette = () => {
    const [openPalette, setOpenPalette] = React.useState<boolean>(false);

    const [currentColors, setCurrentColors] = React.useState<string[] | undefined>(pxt.appTarget.runtime.palette);

    const openPaletteModal = () => {
        setOpenPalette(!openPalette);
    }

    const onPaletteSelected = (selected: Palette) => {
        //this.config.palette = selected.colors;
        setCurrentColors(selected.colors);
        // save pxt.json
    }

    const renderPalettePicker = () => {
        const currentPalette = getCurrentPalette();
        let paletteOptions = AllPalettes.slice();

        if (!paletteOptions.some(p => p.id === currentPalette.id)) {
            paletteOptions.unshift(currentPalette)
        }

        return <>
            <PalettePicker
                palettes={paletteOptions}
                selectedId={currentPalette.id}
                onPaletteSelected={onPaletteSelected}
            />
        </>
    }

    const getCurrentPalette = () => {
        // const configPalette = this.config.palette || pxt.appTarget.runtime.palette;
        // const configPalette = pxt.appTarget.runtime.palette;
        const configPalette = currentColors || pxt.appTarget.runtime.palette;

        if (configPalette) {
            for (const palette of AllPalettes) {
                let isEqual = true;
                for (let i = 0; i < palette.colors.length; i++) {
                    if (configPalette[i].toLowerCase() !== palette.colors[i].toLowerCase()) {
                        isEqual = false;
                        break;
                    }
                }

                if (isEqual) return palette;
            }
        }

        return {
            id: "custom",
            name: lf("Custom Palette"),
            colors: configPalette
        };
    }


    return <div className="asset-palette">
        <Button className="teal asset-palette-button" title={lf("Color Palette")} label={lf("Color Palette")} leftIcon="fas fa-palette" onClick={openPaletteModal} />
        {openPalette && renderPalettePicker()}
    </div>
}