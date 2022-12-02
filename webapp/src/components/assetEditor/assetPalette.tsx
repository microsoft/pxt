import * as React from "react";
import * as pkg from "../../package";
import { useEffect } from "react";
import { Modal } from "../../../../react-common/components/controls/Modal";
import { PalettePicker } from "../../../../react-common/components/palette/PalettePicker";
import { PaletteEditor } from "../../../../react-common/components/palette/PaletteEditor";
import { AllPalettes, Palette } from "../../../../react-common/components/palette/Palettes";

export interface AssetPaletteProps {
    onClose: () => void;
}

export const AssetPalette = (props: AssetPaletteProps) => {
    const { onClose } = props;

    const [currentColors, setCurrentColors] = React.useState<string[] | undefined>(pxt.appTarget.runtime.palette);
        
    useEffect(() => {
        // save pxt.json
        pkg.mainEditorPkg().updateConfigAsync(cfg => cfg.palette = currentColors);
        
    }, [currentColors]);

    const onPaletteEdit = (selected: Palette) => {
        setCurrentColors(selected.colors);
    }

    const onModalClose = () => {
        onClose();
        // force project view update
        // possibly check whether there is a change and only update accordingly
    }

    const renderPaletteModal = () => {
        const currentPalette = getCurrentPalette();
        let paletteOptions = AllPalettes.slice();

        if (!paletteOptions.some(p => p.id === currentPalette.id)) {
            paletteOptions.unshift(currentPalette)
        }

        return <Modal title={lf("Edit Palette")} onClose={onModalClose}>
            <PalettePicker 
                palettes={paletteOptions}
                selectedId={currentPalette.id}
                onPaletteSelected={onPaletteEdit}
            />
            <PaletteEditor palette={currentPalette} onPaletteChanged={onPaletteEdit}/>
        </Modal>
    }

    const getCurrentPalette = () => {
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


    return renderPaletteModal();
}