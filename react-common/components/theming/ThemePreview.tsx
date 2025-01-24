import { ThemeInfo, getThemeAsStyle } from "./themeManager";

// Programmatically generate a preview of the theme using theme colors.
export const ThemePreview = (props: { theme: ThemeInfo }) => {
    const { theme } = props;

    const miniLogo = <img className="ui logo" src="./static/Micorsoft_logo_rgb_W-white_D-square.png" alt="Microsoft MakeCode Logo" />;

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
                    <div className="theme-preview-editor-tools">
                        <div className="theme-preview-editor-tool-button" />
                        <div className="theme-preview-editor-tool-button" />
                    </div>
                </div>
            </div>
        </div>
    );
};
