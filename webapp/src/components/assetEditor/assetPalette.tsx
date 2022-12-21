import * as pkg from "../../package";
import { useEffect, useRef, useState } from "react";
import { Modal, ModalAction } from "../../../../react-common/components/controls/Modal";
import { Input } from "../../../../react-common/components/controls/Input";
import { Button } from "../../../../react-common/components/controls/Button";
import { PalettePicker } from "../../../../react-common/components/palette/PalettePicker";
import { PaletteEditor } from "../../../../react-common/components/palette/PaletteEditor";
import { AllPalettes as BuiltinPalettes, Arcade, Palette } from "../../../../react-common/components/palette/Palettes";


export interface CustomPalettes {
    nextPaletteID: number;
    palettes: Palette[];
}
export interface AssetPaletteProps {
    onClose: (paletteChanged: boolean) => void;
}

export const AssetPalette = (props: AssetPaletteProps) => {
    const { onClose } = props;

    const [showExitModal, setShowExitModal] = useState<boolean>(false);

    const [showNameModal, setShowNameModal] = useState<boolean>(false);

    const [customPalettes, setCustomPalettes] = useState<CustomPalettes>({nextPaletteID: 0, palettes: []});

    const [initialPalette, setinitialPalette] = useState<Palette | undefined>(undefined);

    const [prevPalette, setPrevPalette] = useState<Palette | undefined>(undefined);

    const [currentPalette, setCurrentPalette] = useState<Palette | undefined>(undefined);

    const [disableButtons, setDisableButtons] = useState<boolean>(true);

    useEffect(() => {
        initiatePalettes();
    }, []);

    const onPaletteEdit = (selected: Palette) => {
        if (currentPalette && !isSameColors(currentPalette.colors, selected.colors)) {
            setDisableButtons(false);
            if (selected.id !== currentPalette.id) { // palette selected
                setCurrentPalette(selected);
            } else if (isBuiltinPalette(selected)) { // builtin palette edited
                // create new custom palette and prompt user to name custom palette
                const customPalette = {
                    id: "custom" + customPalettes.nextPaletteID,
                    name: lf("Custom Palette"),
                    colors: selected.colors,
                    custom: true
                }
                customPalettes.palettes.unshift(customPalette);
                setCustomPalettes({
                    ...customPalettes,
                    nextPaletteID: ++customPalettes.nextPaletteID,
                    palettes: customPalettes.palettes});
                setCurrentPalette(customPalette);
                setShowNameModal(true);
            } else { // custom palette edited
                const i = customPalettes.palettes.findIndex(p => p.id === currentPalette.id);
                customPalettes.palettes[i].colors = selected.colors;
                setCustomPalettes({...customPalettes, palettes: customPalettes.palettes});
                setCurrentPalette(selected);
            }
        }
    }

    const onFinalClose = () => {
        const paletteChanged = !isSameColors(initialPalette.colors, prevPalette.colors);
        if (paletteChanged) {
            pxt.tickEvent("palette.modified", {id: prevPalette.id})
            // save pxt.json
            pkg.mainEditorPkg().updateConfigAsync(cfg => cfg.palette = prevPalette.colors);
        }
        onClose(paletteChanged);
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
        setShowExitModal(false);
        onFinalClose();
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
        const i = customPalettes.palettes.findIndex(p => p.id === currentPalette.id);
        customPalettes.palettes[i].name = name;
        setCustomPalettes({...customPalettes, palettes: customPalettes.palettes});
        setCurrentPalette({...currentPalette, name: name});
    }

    const deletePalette = () => {
        setCurrentPalette(Arcade);
        customPalettes.palettes = customPalettes.palettes.filter(p => p.id !== currentPalette.id);
        setCustomPalettes({...customPalettes, palettes: customPalettes.palettes});
    }

    const renderPaletteModal = () => {
        const paletteOptions = customPalettes.palettes.concat(BuiltinPalettes);

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
                <div className="common-palette-picker">
                    <PalettePicker
                        palettes={paletteOptions}
                        selectedId={currentPalette?.id  || Arcade.id}
                        onPaletteSelected={onPaletteEdit} />
                    {(currentPalette?.custom) && <Button
                        label={lf("Delete")}
                        title={lf("Delete the selected palete")}
                        ariaLabel={lf("Delete the selected palette")}
                        className="palette-delete-button"
                        leftIcon="icon trash"
                        onClick={deletePalette} />}
                </div>
                <PaletteEditor palette={currentPalette || Arcade} onPaletteChanged={onPaletteEdit} />
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
        const f = pkg.mainEditorPkg().lookupFile("this/_palettes.json");
        if (f) {
            setCustomPalettes(JSON.parse(f.content) as CustomPalettes);
        }
        const paletteOptions = customPalettes.palettes.concat(BuiltinPalettes);
        const colors = pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette;
        let match = false;
        for (const palette of paletteOptions) {
            if (isSameColors(colors, palette.colors)) {
                match = true;
                setinitialPalette(palette);
                setPrevPalette(palette);
                setCurrentPalette(palette);
                break;
            }
        }
        if (!match) {
            const customPalette = {
                id: "custom" + customPalettes.nextPaletteID,
                name: lf("Custom Palette"),
                colors: colors,
                custom: true
            }
            customPalettes.palettes.unshift(customPalette);
            setCustomPalettes({
                ...customPalettes,
                nextPaletteID: ++customPalettes.nextPaletteID,
                palettes: customPalettes.palettes});
            setinitialPalette(customPalette);
            setPrevPalette(customPalette);
            setCurrentPalette(customPalette);
        }
    }

    const isBuiltinPalette = (palette: Palette) => {
        return BuiltinPalettes.some(p => p.id === palette.id);
    }

    return renderPaletteModal();
}