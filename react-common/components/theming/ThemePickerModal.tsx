import { Modal } from "../controls/Modal";
import { ThemeCard } from "./ThemeCard";

export interface ThemePickerModalProps {
    themes: pxt.ColorThemeInfo[];
    onThemeClicked(theme: pxt.ColorThemeInfo): void;
    onClose(): void;
}
export const ThemePickerModal = (props: ThemePickerModalProps) => {
    return (
        <Modal
            id="theme-picker-modal" 
            title={lf("Choose a Theme")}
            onClose={props.onClose}
            className="theme-picker-modal"
        >
            <div
                className="theme-picker"
                role="list"
                aria-label={lf("List of available themes")}
            >
                {props.themes && props.themes.map(theme => 
                    <ThemeCard
                        key={theme.id}
                        theme={theme}
                        onClick={props.onThemeClicked}
                    />
                )}
            </div>
        </Modal>
    );
};
