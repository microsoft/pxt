import { Modal } from "../controls/Modal";
import { ThemeCard } from "./ThemeCard";

export interface ThemePickerModalProps {
    themes: pxt.ColorThemeInfo[];
    onThemeClicked(them: pxt.ColorThemeInfo): void;
    onSimulatorThemeClicked?: () => void;
    onClose(): void;
}
export const ThemePickerModal = (props: ThemePickerModalProps) => {
    return (
        <Modal
            id="theme-picker-modal" 
            title={lf("Choose a Theme")}
            onClose={props.onClose}
            className="theme-picker-modal"
            actions={props.onSimulatorThemeClicked ? [{
                label: lf("Simulator Theme"),
                leftIcon: "fas fa-gamepad",
                onClick: props.onSimulatorThemeClicked,
            }] : undefined}
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
