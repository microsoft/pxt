import * as pkg from "../../package";
import { useEffect, useRef, useState } from "react";
import { Modal, ModalAction } from "../../../../react-common/components/controls/Modal";
import { PalettePicker } from "../../../../react-common/components/palette/PalettePicker";
import { PaletteEditor } from "../../../../react-common/components/palette/PaletteEditor";
import { AllPalettes, Palette } from "../../../../react-common/components/palette/Palettes";

export interface AssetPaletteProps {
    onClose: (paletteChanged: boolean) => void;
}

export const AssetPalette = (props: AssetPaletteProps) => {
    const { onClose } = props;

    const [showExitModal, setShowExitModal] = useState<boolean>(false);

    const inExitModal = useRef<boolean>(false);

    const initialColors = useRef<string[] | undefined>(pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette)

    const [prevColors, setPrevColors] = useState<string[] | undefined>(pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette);

    const [currentColors, setCurrentColors] = useState<string[] | undefined>(pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette);

    const [disableButtons, setDisableButtons] = useState<boolean>(true);

    useEffect(() => {
        // save pxt.json
        pkg.mainEditorPkg().updateConfigAsync(cfg => cfg.palette = currentColors);
        if (inExitModal.current) {
            onFinalClose();
            inExitModal.current = false;
        }
    }, [currentColors]);

    const onPaletteEdit = (selected: Palette) => {
        setCurrentColors(selected.colors);
        if (!isSameAsCurrentColors(prevColors)) {
            setDisableButtons(false);
        } else {
            setDisableButtons(true);
        }
    }

    const onFinalClose = () => {
        const paletteChanged = !isSameAsCurrentColors(initialColors.current);
        onClose(paletteChanged);
        if (paletteChanged) {
            pxt.tickEvent("palette.modified", {id: getCurrentPalette().id})
        }
    }

    const onModalClose = () => {
        // check whether exiting without saved changes
        if (!isSameAsCurrentColors(prevColors)) {
            setShowExitModal(true);
        } else {
            onFinalClose();
        }
    }

    const onExit = () => {
        inExitModal.current = true;
        setShowExitModal(false);
        setCurrentColors(prevColors);
    }

    const onReset = () => {
        setCurrentColors(prevColors);
        setDisableButtons(true);
    }

    const onSave = () => {
        setPrevColors(currentColors);
        setDisableButtons(true);
    }

    const onGoBack = () => {
        setShowExitModal(false);
    }

    const renderPaletteModal = () => {
        const currentPalette = getCurrentPalette();
        let paletteOptions = AllPalettes.slice();

        if (!paletteOptions.some(p => p.id === currentPalette.id)) {
            paletteOptions.unshift(currentPalette)
        }

        const actions: ModalAction[] = [
            { label: lf("Reset"), onClick: onReset, leftIcon: 'icon undo', className: 'palette-transparent-button', disabled: disableButtons },
            { label: lf("Save"), onClick: onSave, className: 'green palette-save-button', disabled: disableButtons }
        ];

        const exitActions: ModalAction[] = [
            { label: lf("Exit"), onClick: onExit, className: 'teal' }
        ];

        return <div>
            <Modal title={lf("Project Color Palette")} onClose={onModalClose} actions={actions}>
                <PalettePicker
                    palettes={paletteOptions}
                    selectedId={currentPalette.id}
                    onPaletteSelected={onPaletteEdit} />
                <PaletteEditor palette={currentPalette} onPaletteChanged={onPaletteEdit} />
            </Modal>
            {showExitModal && <Modal title={lf("Exit Without Saving")} onClose={onGoBack} actions={exitActions}>
                <div>{lf("Exit without saving? Your palette changes will be reverted.")}</div>
            </Modal>}
        </div>
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