import React from "react";
import css from "./styling/BaseThemePicker.module.scss";
import { Dropdown, DropdownItem } from "react-common/components/controls/Dropdown";
import { ThemeManager } from "react-common/components/theming/themeManager";
import { setCurrentEditingTheme } from "../transforms/setCurrentEditingTheme";
import { classList } from "react-common/components/util";

export interface BaseThemePickerProps {
    className?: string;
}
export const BaseThemePicker = (props: BaseThemePickerProps) => {
    const [selectedId, setSelectedId] = React.useState<string>(pxt.appTarget?.appTheme?.defaultColorTheme || "");
    const themeManager = React.useMemo<ThemeManager>(() => ThemeManager.getInstance(document), []);
    const dropdownItems = React.useMemo<DropdownItem[]>(() => {
        const availableThemes = themeManager.getAllColorThemes();
        const items = availableThemes.map(
            theme =>
                ({
                    id: theme.id,
                    title: theme.name,
                    label: theme.name,
                } as DropdownItem)
        );
        return items;
    }, []);

    function handleSelectionChanged(id: string) {
        setSelectedId(id);

        const theme = themeManager.getAllColorThemes().find(t => t.id === id);
        if (theme) {
            setCurrentEditingTheme(theme);
        }
    }

    return (
        <div className={classList(props.className, css["base-theme-picker-container"])}>
            <label htmlFor="base-theme-dropdown" className={classList(css["base-theme-picker-label"], "common-input-label")}>
                {lf("Base Theme")}
            </label>
            <Dropdown
                id={"base-theme-dropdown"}
                className={css["base-theme-dropdown"]}
                selectedId={selectedId}
                items={dropdownItems}
                onItemSelected={handleSelectionChanged}
            />
        </div>
    );
};
