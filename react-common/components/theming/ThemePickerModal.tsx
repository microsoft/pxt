import * as React from "react";
import { Modal } from "../controls/Modal";
import { ThemeManager, ThemeInfo } from "./themeManager";
import { ThemeCard } from "./ThemeCard";

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
        <Modal id="theme-picker-modal" title={lf("Choose a Theme")} onClose={props.onClose} className="theme-picker-modal">
            <div className="ui cards centered theme-picker" role="list" aria-label={lf("List of available themes")}>
                {themes && themes.map((theme) => <ThemeCard key={theme.id} theme={theme} onClick={onThemeClicked} />)}
            </div>
        </Modal>
    );
};
