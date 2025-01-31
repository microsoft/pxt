import * as React from "react";
import { ThemeInfo, getFullThemeCss } from "./themeManager";
import { classList } from "../util";

// Programmatically generate a preview of the theme using theme colors.
export const ThemePreview = (props: { theme: ThemeInfo }) => {
    const { theme } = props;
    const styleRef = React.useRef<HTMLStyleElement | null>(null);
    const uniqueContainerClassName = `theme-preview-container-${theme.id}`;
    const uniqueInnerClassName = `theme-preview-${theme.id}`; // Useful for override css adjusting previews

    const miniLogo = <img className="ui logo" src="./static/Micorsoft_logo_rgb_W-white_D-square.png" alt="Microsoft MakeCode Logo" />;

    React.useEffect(() => {
        if (styleRef?.current) {
            const themeCss = getFullThemeCss(theme);
            // Set textContent instead of innerHTML to avoid XSS
            styleRef.current.textContent = `.${uniqueContainerClassName} { ${themeCss} }`;
        }
    }, [theme]);

    return (
        <div className={classList("theme-preview-container", uniqueContainerClassName)}>
            <style ref={styleRef} />
            <div className={classList("theme-preview", uniqueInnerClassName)}>
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
