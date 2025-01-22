import * as React from "react";
import { Modal } from "../controls/Modal";
import { Button } from "../controls/Button";
import { ThemeManager, ThemeInfo, getThemeAsStyle } from "./themeManager";

// Programmatically generate a preview of the theme using theme colors.
export const ThemePreview = (props: { theme: ThemeInfo }) => {
    const { theme } = props;

    const miniLogo = <div className="theme-preview-logo">
        <div className="theme-preview-logo-row">
            <div className="theme-preview-logo-square" />
            <div className="theme-preview-logo-square" />
        </div>
        <div className="theme-preview-logo-row">
            <div className="theme-preview-logo-square" />
            <div className="theme-preview-logo-square" />
        </div>
    </div>;

    return (
        <div className="theme-preview-container" style={getThemeAsStyle(theme)}>
            <div className="theme-preview">
                <div className="theme-preview-header">
                    {miniLogo}
                    <i className="fas fa-user-circle" />
                </div>
                <div className="theme-preview-workspace">
                    <div className="theme-preview-sim-sidebar">
                        <div className="theme-preview-sim" />
                        <div className="theme-preview-sim-buttons">
                            <div className="theme-preview-sim-button" />
                            <div className="theme-preview-sim-button" />
                            <div className="theme-preview-sim-button" />
                        </div>
                    </div>
                    <div className="theme-preview-toolbox">
                        <hr className="toolbox-divider" />
                        <hr className="toolbox-divider" />
                        <hr className="toolbox-divider" />
                    </div>
                    <div className="theme-preview-workspace-content" />
                </div>
                <div className="theme-preview-footer">
                    <div className="theme-preview-download-button" />
                </div>
            </div>
        </div>
    );
};

interface ThemeCardProps {
    theme: ThemeInfo;
    onClick?: (theme: ThemeInfo) => void;
}

export class ThemeCard extends React.Component<ThemeCardProps> {
    render() {
        const { onClick, theme } = this.props;

        return (
            <div key={theme.id} className="theme-picker-item">
                <Button
                    className="ui card link card-selected theme-card"
                    role="listitem"
                    title={theme.name}
                    onClick={() => onClick(theme)}
                    label={
                        <div className="theme-info-box">
                            <ThemePreview theme={theme} />
                            <div className="theme-picker-item-name">{theme.name}</div>
                        </div>
                    }
                />
            </div>
        );
    }
}

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
            <div className="ui cards centered theme-picker" role="list" aria-label={lf("List of available themes")}>
                {themes && themes.map((theme) => <ThemeCard key={theme.id} theme={theme} onClick={onThemeClicked} />)}
            </div>
        </Modal>
    );
};
