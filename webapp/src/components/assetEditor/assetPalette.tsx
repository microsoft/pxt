import * as pkg from "../../package";
import { useEffect, useState } from "react";
import { Modal } from "../../../../react-common/components/controls/Modal";
import { PalettePicker } from "../../../../react-common/components/palette/PalettePicker";
import { PaletteEditor } from "../../../../react-common/components/palette/PaletteEditor";
import { AllPalettes, Palette } from "../../../../react-common/components/palette/Palettes";

export interface AssetPaletteProps {
    onClose: (paletteChanged: boolean) => void;
}

export const AssetPalette = (props: AssetPaletteProps) => {
    const { onClose } = props;

    const [initialColors, setInitialColors] = useState<string[] | undefined>(pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette);

    const [currentColors, setCurrentColors] = useState<string[] | undefined>(pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette);

    useEffect(() => {
        // save pxt.json
        pkg.mainEditorPkg().updateConfigAsync(cfg => cfg.palette = currentColors);
    }, [currentColors]);

    const onPaletteEdit = (selected: Palette) => {
        setCurrentColors(selected.colors);
    }

    const onModalClose = () => {
        // check whether there is a change and update project view accordingly
        onClose(!isSameAsCurrentColors(initialColors));
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
        if (currentColors) {
            for (const palette of AllPalettes) {
                if (isSameAsCurrentColors(palette.colors)) return palette;
            }
        }

        return {
            id: "custom",
            name: lf("Custom Palette"),
            colors: currentColors
        };
    }

    const isSameAsCurrentColors = (colorSet: string[]) => {
        let isEqual = true;
        for (let i = 0; i < colorSet.length; i++) {
            if (currentColors[i].toLowerCase() !== colorSet[i].toLowerCase()) {
                isEqual = false;
                break;
            }
        }
        return isEqual;
    }

    return renderPaletteModal();
}