import * as React from "react";
import * as ReactDOM from 'react-dom';
import { Modal } from "../controls/Modal";
import { Button } from "../controls/Button";
import { ThemeManager, ThemeInfo } from "./themeManager";

const ThemePreviewInner = () => {
    return (
    <div className="theme-preview">
        <div className="theme-preview-header">
            - { /* Intentional dash to show foreground color */ }
        </div>
        <div className="theme-preview-workspace">
            <div className="theme-preview-toolbox-placholder" />
            <div className="theme-preview-workspace-placeholder" />
        </div>
    </div>);
}

// Programmatically generate a preview of the theme using theme colors.
export const ThemePreview = (props: { theme: ThemeInfo }) => {
    const { theme } = props;

    // We use Shadow DOM here to encapsulate the otherwise global styles of the theme's style sheet,
    // which allows us to apply the theme's style to just the preview inside the button.
    const shadowRootRef = React.useRef<HTMLDivElement>(null);
    const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot>(null);

    React.useEffect(() => {
        if(shadowRootRef.current) {
            const shadowRoot = shadowRootRef.current.attachShadow({mode: "open"});

            console.log('Creating Shadow DOM for theme:', theme.name);

            // Create a link element to include main document styles
            const inheritStyleLink = document.createElement('link');
            inheritStyleLink.rel = 'stylesheet';
            inheritStyleLink.href = '/blb/semantic.css'; // TODO thsparks - is there a better way to do this?
            shadowRoot.appendChild(inheritStyleLink);

            // Create a link element to include theme styles
            const themeStyleLink = document.createElement("link");
            themeStyleLink.rel = 'stylesheet';
            themeStyleLink.href = theme.url;
            shadowRoot.appendChild(themeStyleLink);

            console.log('Loaded theme stylesheet:', theme.url);

            setShadowRoot(shadowRoot);
        }
    }, [theme.url]);
    
    return <div className="theme-info-box">
            <div className="theme-preview-container" ref={shadowRootRef} />
            { /* Add the inner preview to the container */ }
            { shadowRoot && ReactDOM.createPortal(<ThemePreviewInner />, shadowRoot)}
            <div className="theme-picker-item-name">{theme.name}</div>
        </div>
}


export interface ThemePickerModalProps {
    onClose(): void;
}
export const ThemePickerModal = (props: ThemePickerModalProps) => {
    const {
    } = props;
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

    return <Modal id="theme-picker-modal" title={lf("Choose a Theme")} onClose={props.onClose}>
        <div className="theme-picker">
            {themes && themes.map(theme => <div key={theme.id} className="theme-picker-item">
                <Button onClick={() => onThemeClicked(theme)} title={theme.name} className="theme-button">
                    <ThemePreview theme={theme} />
                </Button>
            </div>)}
        </div>
    </Modal>
}
