import * as React from "react";
import css from "./styling/ThemeEditor.module.scss";
import { Input } from "react-common/components/controls/Input";
import { AppStateContext } from "../state/appStateContext";
import { setThemeName } from "../transforms/setThemeName";
import { getColorHeirarchy } from "../utils/colorUtils";
import { ThemeColorFamily } from "./ThemeColorFamily";
import { BaseThemePicker } from "./BaseThemePicker";
import { exportTheme } from "../services/fileSystemService";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import * as auth from "../services/authClient";

export interface SaveState {
    icon: string;
    bgColor: string;
    fgColor: string;
}

export const ThemeEditorPane = () => {
    const defaultSaveState = {
        icon: "fas fa-save",
        bgColor: "var(--pxt-neutral-background1)",
        fgColor: "var(--pxt-neutral-foreground1)",
    };
    const { state } = React.useContext(AppStateContext);
    const { editingTheme } = state;
    const [saveState, setSaveState] = React.useState<SaveState>(defaultSaveState);

    const colorHeirarchy: { [baseColorId: string]: string[] } = React.useMemo(() => {
        return state.editingTheme?.colors ? getColorHeirarchy(Object.keys(state.editingTheme.colors)) : {};
    }, [state.editingTheme?.colors]);
    const baseColorIds = Object.keys(colorHeirarchy);

    function setTemporarySaveIcon(state: SaveState, timeoutMs: number) {
        setSaveState(state);
        setTimeout(() => {
            setSaveState(defaultSaveState);
        }, timeoutMs);
    }

    function handleDownloadClicked() {
        if (!editingTheme) return;
        exportTheme(editingTheme);
    }

    async function handleSaveToProfileClicked() {
        if (!editingTheme) return;
        const success = await auth.addCustomColorThemeAsync(editingTheme);
        if (success) {
            setTemporarySaveIcon(
                {
                    icon: "fas fa-check",
                    bgColor: "var(--pxt-colors-green-background)",
                    fgColor: "var(--pxt-colors-green-foreground)",
                },
                2000
            );
        } else {
            setTemporarySaveIcon(
                {
                    icon: "fas fa-exclamation-triangle",
                    bgColor: "var(--pxt-colors-red-background)",
                    fgColor: "var(--pxt-colors-red-foreground)",
                },
                2000
            );
        }
    }

    return (
        <div className={css["theme-editor-container"]}>
            <div className={css["theme-editor-header"]}>
                <BaseThemePicker className={css["base-picker"]} />
                <Button
                    className={classList(css["export-button"], css["header-icon-button"])}
                    leftIcon={saveState.icon}
                    title={lf("Save Theme to Profile")}
                    onClick={handleSaveToProfileClicked}
                    style={{
                        backgroundColor: saveState.bgColor,
                        color: saveState.fgColor,
                        borderColor: saveState.fgColor,
                    }}
                />
                <Button
                    className={classList(css["save-button"], css["header-icon-button"])}
                    leftIcon="fas fa-file-export"
                    title={lf("Download Theme As File")}
                    onClick={handleDownloadClicked}
                />
            </div>
            <Input
                className={css["theme-name-input"]}
                label={lf("Theme Name")}
                onChange={setThemeName}
                preserveValueOnBlur={true}
                initialValue={editingTheme?.name}
            />
            <div className={css["theme-colors-list"]}>
                {baseColorIds.map(baseColorId => (
                    <ThemeColorFamily
                        key={`base-color-${baseColorId}`}
                        baseColorId={baseColorId}
                        derivedColorIds={colorHeirarchy[baseColorId]}
                    />
                ))}
            </div>
        </div>
    );
};
