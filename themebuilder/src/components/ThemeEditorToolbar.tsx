import * as React from "react";
import * as auth from "../services/authClient";
import css from "./styling/ThemeEditor.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { BaseThemePicker } from "./BaseThemePicker";
import { exportTheme } from "../services/fileSystemService";
import { Button } from "react-common/components/controls/Button";
import { classList } from "react-common/components/util";
import { ThemeManager } from "react-common/components/theming/themeManager";

export interface SaveState {
    icon: string;
    bgColor: string;
    fgColor: string;
}

export const ThemeEditorToolbar = () => {
    const defaultSaveState = {
        icon: "fas fa-save",
        bgColor: "var(--pxt-neutral-background1)",
        fgColor: "var(--pxt-neutral-foreground1)",
    };
    const { state } = React.useContext(AppStateContext);
    const { editingTheme } = state;
    const [saveState, setSaveState] = React.useState<SaveState>(defaultSaveState);

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

        // Don't allow overwriting built-in themes
        const builtinThemes = ThemeManager.getInstance(document).getAllColorThemes() || [];
        let success = false;
        if (!builtinThemes.find(t => t.id === editingTheme.id)) {
            success = await auth.addCustomColorThemeAsync(editingTheme);
        }

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
        <div className={css["theme-editor-toolbar"]}>
            <BaseThemePicker className={css["base-picker"]} />
            <Button
                className={classList(css["export-button"], css["toolbar-icon-button"])}
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
                className={classList(css["save-button"], css["toolbar-icon-button"])}
                leftIcon="fas fa-file-export"
                title={lf("Download Theme As File")}
                onClick={handleDownloadClicked}
            />
        </div>
    );
};
