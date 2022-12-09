import * as pkg from "../../package";
import { useEffect, useState } from "react";
import { Modal, ModalAction } from "../../../../react-common/components/controls/Modal";
import { PalettePicker } from "../../../../react-common/components/palette/PalettePicker";
import { PaletteEditor } from "../../../../react-common/components/palette/PaletteEditor";
import { AllPalettes, Palette } from "../../../../react-common/components/palette/Palettes";

export interface AssetPaletteProps {
    onClose: () => void;
}

export const AssetPalette = (props: AssetPaletteProps) => {
    const { onClose } = props;

    const [currentColors, setCurrentColors] = useState<string[] | undefined>(pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette);

    useEffect(() => {
        // save pxt.json
        pkg.mainEditorPkg().updateConfigAsync(cfg => cfg.palette = currentColors);
    }, [currentColors]);

    const onPaletteEdit = (selected: Palette) => {
        setCurrentColors(selected.colors);
    }

    const onModalClose = () => {
        // force project view update
        // possibly check whether there is a change and only update accordingly
        onClose();
    }

    const onResetColors = () => {

    }

    const onSave = () => {

    }

    const renderPaletteModal = () => {
        const currentPalette = getCurrentPalette();
        let paletteOptions = AllPalettes.slice();

        if (!paletteOptions.some(p => p.id === currentPalette.id)) {
            paletteOptions.unshift(currentPalette)
        }

        const actions: ModalAction[] = [
            { label: lf("Reset Colors"), onClick: onResetColors, leftIcon: 'icon undo', className: 'palette-reset-button' },
            { label: lf("Save new palette"), onClick: onSave, className: 'green palette-save-button' }
        ];

        return <Modal title={lf("Edit Palette")} onClose={onModalClose} actions={actions}>
            <PalettePicker
                palettes={paletteOptions}
                selectedId={currentPalette.id}
                onPaletteSelected={onPaletteEdit} />
            <PaletteEditor palette={currentPalette} onPaletteChanged={onPaletteEdit}/>
        </Modal>
    }

    const getCurrentPalette = () => {
        if (currentColors) {
            for (const palette of AllPalettes) {
                let isEqual = true;
                for (let i = 0; i < palette.colors.length; i++) {
                    if (currentColors[i].toLowerCase() !== palette.colors[i].toLowerCase()) {
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
            colors: currentColors
        };
    }


    return renderPaletteModal();
}