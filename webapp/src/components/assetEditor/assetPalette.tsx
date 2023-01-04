import * as pkg from "../../package";
import { useEffect, useState } from "react";
import { Modal, ModalAction } from "../../../../react-common/components/controls/Modal";
import { Input } from "../../../../react-common/components/controls/Input";
import { Button } from "../../../../react-common/components/controls/Button";
import { PalettePicker } from "../../../../react-common/components/palette/PalettePicker";
import { PaletteEditor } from "../../../../react-common/components/palette/PaletteEditor";
import { AllPalettes as BuiltinPalettes, Arcade, Palette } from "../../../../react-common/components/palette/Palettes";


export interface CustomPalettes {
    nextPaletteID: number;
    palettes: pxt.Map<Palette>;
}
export interface AssetPaletteProps {
    onClose: (paletteChanged: boolean) => void;
}

export const AssetPalette = (props: AssetPaletteProps) => {
    const { onClose } = props;

    const [showExitModal, setShowExitModal] = useState<boolean>(false);

    const [showNameModal, setShowNameModal] = useState<boolean>(false);

    const [customPalettes, setCustomPalettes] = useState<CustomPalettes>(undefined);

    const [initialPalette, setinitialPalette] = useState<Palette | undefined>(undefined);

    const [currentPalette, setCurrentPalette] = useState<Palette | undefined>(undefined);

    const [disableButtons, setDisableButtons] = useState<boolean>(true);

    useEffect(() => {
        initiatePalettes();
    }, []);

    useEffect(() => {
        if (currentPalette && !isSameColors(currentPalette.colors, initialPalette.colors)) {
            setDisableButtons(false);
        } else {
            setDisableButtons(true);
        }
    }, [currentPalette]);

    const onPaletteEdit = (selected: Palette) => {
        if (currentPalette && !isSameColors(currentPalette.colors, selected.colors)) {
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
                setCustomPalettes({
                    ...customPalettes,
                    nextPaletteID: ++customPalettes.nextPaletteID,
                    palettes: {
                        ...customPalettes.palettes,
                        [customPalette.id]: customPalette
                    }
                });
                setCurrentPalette(customPalette);
                setShowNameModal(true);
            } else { // custom palette edited
                setCustomPalettes({
                    ...customPalettes,
                    palettes: {
                        ...customPalettes.palettes,
                        [currentPalette.id]: selected
                    }
                });
                setCurrentPalette(selected);
            }
        }
    }

    const onFinalClose = (paletteChanged: boolean) => {
        pkg.mainEditorPkg().setFile("_palettes.json", JSON.stringify(customPalettes, undefined, 4)); // TODO: make virtual file after testing
        if (paletteChanged) {
            pxt.tickEvent("palette.modified", {id: currentPalette.id})
            // save pxt.json
            pkg.mainEditorPkg().updateConfigAsync(cfg => cfg.palette = currentPalette.colors);
        }
        onClose(paletteChanged);
    }

    const onModalClose = () => {
        // check whether exiting without applied changes
        if (isSameColors(currentPalette.colors, initialPalette.colors)) {
            onFinalClose(false);
        } else {
            setShowExitModal(true);
        }
    }

    const onExit = () => {
        setShowExitModal(false);
        onFinalClose(false);
    }

    const onReset = () => {
        setCurrentPalette(initialPalette);
    }

    const onApply = () => {
        onFinalClose(true);
    }

    const onGoBack = () => {
        setShowExitModal(false);
    }

    const onNameDone = () => {
        setShowNameModal(false);
    }

    const setName = (name: string) => {
        setCustomPalettes({
            ...customPalettes,
            palettes: {
                ...customPalettes.palettes,
                [currentPalette.id]: {
                    ...currentPalette,
                    name: name
                }
            }
        });
        setCurrentPalette({ ...currentPalette, name: name });
    }

    const deletePalette = () => {
        setCustomPalettes({
            ...customPalettes,
            palettes: {
                ...customPalettes.palettes,
                [currentPalette.id]: undefined
            }
        });
        setCurrentPalette(Arcade);
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
        let initialCustomPalettes: CustomPalettes = undefined;
        if (f) {
            initialCustomPalettes = JSON.parse(f.content) as CustomPalettes;
        } else {
            initialCustomPalettes = {nextPaletteID: 0, palettes: {}};
        }
        const paletteOptions = Object.values(initialCustomPalettes?.palettes).concat(BuiltinPalettes);
        const colors = pkg.mainPkg.config.palette || pxt.appTarget.runtime.palette;
        let match = false;
        for (const palette of paletteOptions) {
            if (isSameColors(colors, palette.colors)) {
                match = true;
                setinitialPalette(palette);
                setCurrentPalette(palette);
                break;
            }
        }
        if (!match) {
            const customPalette = {
                id: "custom" + initialCustomPalettes.nextPaletteID++,
                name: lf("Custom Palette"),
                colors: colors,
                custom: true
            }
            initialCustomPalettes.palettes[customPalette.id] = customPalette;
            setinitialPalette(customPalette);
            setCurrentPalette(customPalette);
        }
        setCustomPalettes(initialCustomPalettes);
    }

    const isBuiltinPalette = (palette: Palette) => {
        return BuiltinPalettes.some(p => p.id === palette.id);
    }

    if (!customPalettes) {
        return <div />
    }

    const definedPalettes = Object.values(customPalettes.palettes).filter(p => p !== undefined);
    const paletteOptions = definedPalettes.reverse().concat(BuiltinPalettes);

    const actions: ModalAction[] = [
        { label: lf("Reset"), onClick: onReset, leftIcon: 'icon undo', className: 'palette-transparent-button', disabled: disableButtons },
        { label: lf("Apply"), onClick: onApply, className: 'green palette-apply-button', disabled: disableButtons }
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
                    selectedId={currentPalette?.id || Arcade.id}
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
        {showExitModal && <Modal title={lf("Exit Without Applying Changes?")} onClose={onGoBack} actions={exitActions}>
            <div>{lf("Your palette changes will be reverted.")}</div>
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