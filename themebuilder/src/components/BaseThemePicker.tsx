import React from "react";
import css from "./styling/BaseThemePicker.module.scss";
import { Dropdown, DropdownItem } from "react-common/components/controls/Dropdown";
import { ThemeManager } from "react-common/components/theming/themeManager";
import { setCurrentEditingTheme } from "../transforms/setCurrentEditingTheme";
import { classList } from "react-common/components/util";
import * as auth from "../services/authClient";

export interface BaseThemePickerProps {
    className?: string;
}
export const BaseThemePicker = (props: BaseThemePickerProps) => {
    const [selectedId, setSelectedId] = React.useState<string>(pxt.appTarget?.appTheme?.defaultColorTheme || "");
    const [dropdownItems, setDropdownItems] = React.useState<DropdownItem[]>([]);

    const themeManager = React.useMemo<ThemeManager>(() => ThemeManager.getInstance(document), []);

    React.useEffect(() => {
        const themeToDropdownItem = (theme: pxt.ColorThemeInfo) => {
            return {
                id: theme.id,
                title: theme.name,
                label: theme.name,
            } as DropdownItem;
        };
        async function loadDropdownItems() {
            const availableThemes = await getColorThemes();
            const items = availableThemes.map(themeToDropdownItem);
            setDropdownItems(items);
        }

        // Initial set with just built-in themes, then call async function to get user themes
        themeManager.getAllColorThemes().map(themeToDropdownItem);
        loadDropdownItems();
    }, []);

    async function handleSelectionChanged(id: string) {
        setSelectedId(id);

        const themes = await getColorThemes();
        const theme = themes.find(t => t.id === id);
        if (theme) {
            setCurrentEditingTheme(theme);
        }
    }

    async function getColorThemes() {
        const builtInThemes = themeManager.getAllColorThemes();
        const userThemes = (await auth.getCustomColorThemesAsync())?.sort((a, b) => a.id.localeCompare(b.id));
        let themes = [...builtInThemes];
        if (userThemes) {
            // Inefficient but I'm in a rush and we're talking < 100 here.
            for (const theme of userThemes) {
                themes = themes.filter(t => t.id !== theme.id);
                theme.isCustom = true;
                themes.push(theme);
            }
        }
        return themes;
    }

    return (
        <div className={classList(props.className, css["base-theme-picker-container"])}>
            <label
                htmlFor="base-theme-dropdown"
                className={classList(css["base-theme-picker-label"], "common-input-label")}
            >
                {lf("Base Theme")}
            </label>
            {dropdownItems.length > 0 && (
                <Dropdown
                    id={"base-theme-dropdown"}
                    className={css["base-theme-dropdown"]}
                    selectedId={selectedId}
                    items={dropdownItems}
                    onItemSelected={handleSelectionChanged}
                />
            )}
        </div>
    );
};
