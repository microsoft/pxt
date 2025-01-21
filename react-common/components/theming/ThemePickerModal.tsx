import * as React from "react";
import { Modal } from "../controls/Modal";
import { Button } from "../controls/Button";
import { ThemeManager, ThemeInfo, getThemeAsStyle } from "./themeManager";

// Programmatically generate a preview of the theme using theme colors.
export const ThemePreview = (props: { theme: ThemeInfo }) => {
    const { theme } = props;

    return (
        <div className="theme-info-box">
            <div className="theme-preview-container" style={getThemeAsStyle(theme)}>
                <div className="theme-preview">
                    <div className="theme-preview-header">- {/* Intentional dash to show foreground color */}</div>
                    <div className="theme-preview-workspace">
                        <div className="theme-preview-toolbox-placholder" />
                        <div className="theme-preview-workspace-placeholder" />
                    </div>
                </div>
            </div>
            <div className="theme-picker-item-name">{theme.name}</div>
        </div>
    );
};

export interface ThemePickerModalProps {
    onClose(): void;
}
export const ThemePickerModal = (props: ThemePickerModalProps) => {
    const {} = props;
    const themeManager = ThemeManager.getInstance();

    const [themes, setThemes] = React.useState<ThemeInfo[]>(undefined);

    React.useEffect(() => {
        async function loadThemes() {
            const loadedThemes = await themeManager.getThemes();
            setThemes(loadedThemes);
        }

        loadThemes();
    }, []);

    function onThemeClicked(theme: ThemeInfo) {
        themeManager.switchTheme(theme.id);
    }

    return (
        <Modal id="theme-picker-modal" title={lf("Choose a Theme")} onClose={props.onClose}>
            <div className="theme-picker">
                {themes &&
                    themes.map((theme) => (
                        <div key={theme.id} className="theme-picker-item">
                            <Button onClick={() => onThemeClicked(theme)} title={theme.name} className="theme-button">
                                <ThemePreview theme={theme} />
                            </Button>
                        </div>
                    ))}
            </div>
        </Modal>
    );
};
