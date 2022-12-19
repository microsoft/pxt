import * as pkg from "../../package";
import { useEffect, useRef, useState } from "react";
import { Modal, ModalAction } from "../../../../react-common/components/controls/Modal";
import { PalettePicker } from "../../../../react-common/components/palette/PalettePicker";
import { PaletteEditor } from "../../../../react-common/components/palette/PaletteEditor";
import { AllPalettes as BuiltinPalettes, Palette } from "../../../../react-common/components/palette/Palettes";
import { Input } from "../../../../react-common/components/controls/Input";

export interface CustomPalettes {
    nextPaletteID: number;
    initialPalette: Palette; // could be custom or built-in
    palettes: Palette[];
}
export interface AssetPaletteProps {
    onClose: (paletteChanged: boolean) => void;
}

export const AssetPalette = (props: AssetPaletteProps) => {
    const { onClose } = props;

    const [showExitModal, setShowExitModal] = useState<boolean>(false);

    const [showNameModal, setShowNameModal] = useState<boolean>(false);

    const inExitModal = useRef<boolean>(false);

    const firstRender = useRef<boolean>(true);

    const customPalettes = useRef<CustomPalettes | undefined>(undefined);

    const [prevPalette, setPrevPalette] = useState<Palette | undefined>(undefined);

    const [currentPalette, setCurrentPalette] = useState<Palette | undefined>(undefined);

    const [disableButtons, setDisableButtons] = useState<boolean>(true);

    useEffect(() => {
        firstRender.current = false;
        setPrevPalette(customPalettes.current.initialPalette);
        setCurrentPalette(customPalettes.current.initialPalette);
    }, []);

    useEffect(() => {
        // save pxt.json
        pkg.mainEditorPkg().updateConfigAsync(cfg => cfg.palette = currentPalette.colors);
        if (inExitModal.current) {
            onFinalClose();
            inExitModal.current = false;
        }
    }, [currentPalette]);

    const onPaletteEdit = (selected: Palette) => {
        if (!firstRender.current && !isSameColors(currentPalette.colors, selected.colors)) {
            setDisableButtons(false);
            if (selected.id !== currentPalette.id) { // palette selected
                setCurrentPalette(selected);
            } else if (isBuiltinPalette(selected)) { // builtin palette edited
                // create new custom palette and prompt user to name custom palette
                const customPalette = {
                    id: "custom" + customPalettes.current.nextPaletteID++,
                    name: lf("Custom Palette"),
                    colors: selected.colors,
                    custom: true
                }
                customPalettes.current.palettes.unshift(customPalette);
                setCurrentPalette(customPalette);
                setShowNameModal(true);
            } else { // custom palette edited
                const i = customPalettes.current.palettes.findIndex(p => p.id === currentPalette.id);
                customPalettes.current.palettes[i].colors = selected.colors;
                setCurrentPalette(selected);
            }
        }
    }

    const onFinalClose = () => {
        const paletteChanged = !isSameColors(customPalettes.current.initialPalette.colors, prevPalette.colors);
        onClose(paletteChanged);
        if (paletteChanged) {
            pxt.tickEvent("palette.modified", {id: currentPalette.id})
        }
    }

    const onModalClose = () => {
        // check whether exiting without saved changes
        if (isSameColors(currentPalette.colors, prevPalette.colors)) {
            onFinalClose();
        } else {
            setShowExitModal(true);
        }
    }

    const onExit = () => {
        inExitModal.current = true;
        setShowExitModal(false);
        setCurrentPalette(prevPalette);
    }

    const onReset = () => {
        setCurrentPalette(prevPalette);
        setDisableButtons(true);
    }

    const onSave = () => {
        setPrevPalette(currentPalette);
        setDisableButtons(true);
    }

    const onGoBack = () => {
        setShowExitModal(false);
    }

    const onNameDone = () => {
        setShowNameModal(false);
    }

    const setName = (name: string) => {
        const i = customPalettes.current.palettes.findIndex(p => p.id === currentPalette.id);
        customPalettes.current.palettes[i].name = name;
        setCurrentPalette({...currentPalette, name: name});
    }

    const renderPaletteModal = () => {
        if (firstRender.current) {
            const f = pkg.mainEditorPkg().lookupFile("this/_palettes.json");
            if (f) {
                customPalettes.current = JSON.parse(f.content) as CustomPalettes;
            } else {
                initiatePalettes();
            }
        }

        let paletteOptions = customPalettes.current.palettes.concat(BuiltinPalettes);

        if (!paletteOptions.some(p => p.id === (currentPalette?.id || customPalettes.current.initialPalette.id))) {
            paletteOptions.unshift(currentPalette || customPalettes.current.initialPalette)
        }

        const actions: ModalAction[] = [
            { label: lf("Reset"), onClick: onReset, leftIcon: 'icon undo', className: 'palette-transparent-button', disabled: disableButtons },
            { label: lf("Save"), onClick: onSave, className: 'green palette-save-button', disabled: disableButtons }
        ];

        const exitActions: ModalAction[] = [
            { label: lf("Exit"), onClick: onExit, className: 'teal' }
        ];

        const nameActions: ModalAction[] = [
            { label: lf("Done"), onClick: onNameDone, className: 'teal' }
        ];

        return <div>
            <Modal title={lf("Project Color Palette")} onClose={onModalClose} actions={actions}>
                <PalettePicker
                    palettes={paletteOptions}
                    selectedId={currentPalette?.id  || customPalettes.current.initialPalette.id}
                    onPaletteSelected={onPaletteEdit} />
                <PaletteEditor palette={currentPalette || customPalettes.current.initialPalette} onPaletteChanged={onPaletteEdit} />
            </Modal>
            {showExitModal && <Modal title={lf("Exit Without Saving")} onClose={onGoBack} actions={exitActions}>
                <div>{lf("Exit without saving? Your palette changes will be reverted.")}</div>
            </Modal>}
            {showNameModal && <Modal title={lf("Name Your Custom Palette")} onClose={onNameDone} actions={nameActions}>
                <Input
                    className="palette-name-input"
                    initialValue={currentPalette.name}
                    placeholder={lf("Palette Name")}
                    onBlur={setName}
                    onEnterKey={setName} />
            </Modal>}
        </div>
    }

    const isSameColors = (colorSet1: string[], colorSet2: string[]) => {
        let isEqual = true;
        for (let i = 0; i < colorSet1.length; i++) {
            if (colorSet1[i].toLowerCase() !== colorSet2[i].toLowerCase()) {
                isEqual = false;
                break;
            }
        }
        return isEqual;
    }

    const initiatePalettes = () => {
        const colors = pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette;
        let match = false;
        for (const palette of BuiltinPalettes) {
            if (isSameColors(colors, palette.colors)) {
                match = true;
                customPalettes.current = {
                    nextPaletteID: 0,
                    initialPalette: palette,
                    palettes: []
                };
                break;
            }
        }
        if (!match) {
            const customPalette = {
                id: "custom0",
                name: lf("Custom Palette"),
                colors: colors,
                custom: true
            }
            customPalettes.current = {
                nextPaletteID: 1,
                initialPalette: customPalette,
                palettes: [customPalette]
            };
        }
    }

    const isBuiltinPalette = (palette: Palette) => {
        return BuiltinPalettes.some(p => p.id === palette.id);
    }

    return renderPaletteModal();
}