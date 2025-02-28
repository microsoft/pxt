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

export const ThemeEditorPane = () => {
    const { state } = React.useContext(AppStateContext);
    const { editingTheme } = state;

    const colorHeirarchy: { [baseColorId: string]: string[] } = React.useMemo(() => {
        return state.editingTheme?.colors ? getColorHeirarchy(Object.keys(state.editingTheme.colors)) : {};
    }, [state.editingTheme?.colors]);
    const baseColorIds = Object.keys(colorHeirarchy);

    function handleSaveClicked() {
        if (!editingTheme) return;
        exportTheme(editingTheme);
    }

    return (
        <div className={css["theme-editor-container"]}>
            <div className={css["theme-editor-header"]}>
                <BaseThemePicker className={css["base-picker"]} />
                <Button className={classList(css["save-button"])} leftIcon="fas fa-save" title={lf("Save Theme")} onClick={handleSaveClicked} />
            </div>
            <Input
                className={css["theme-name-input"]}
                label={lf("Theme Name")}
                onBlur={setThemeName}
                onEnterKey={setThemeName}
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
