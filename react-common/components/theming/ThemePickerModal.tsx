import * as React from "react";
import { Modal } from "../controls/Modal";
import { EditorToggle } from "../controls/EditorToggle";
import { ThemeCard } from "./ThemeCard";

export type ThemePickerMode = "editor" | "simulator";

export interface ThemePickerToggleProps {
    selected: ThemePickerMode;
    onModeChanged: (mode: ThemePickerMode) => void;
}

export const ThemePickerToggle = (props: ThemePickerToggleProps) => {
    const { selected, onModeChanged } = props;
    const selectMode = (mode: ThemePickerMode) => {
        if (mode !== selected) onModeChanged(mode);
    };

    return <div className="theme-picker-toggle">
        <EditorToggle
            id="theme-picker-toggle"
            ariaLabel={lf("Theme type")}
            selected={selected === "editor" ? 0 : 1}
            items={[
                {
                    label: lf("Editor"),
                    title: lf("Editor theme"),
                    icon: "fas fa-paint-brush",
                    focusable: true,
                    onClick: () => selectMode("editor"),
                },
                {
                    label: lf("Simulator"),
                    title: lf("Simulator theme"),
                    icon: "fas fa-gamepad",
                    focusable: true,
                    onClick: () => selectMode("simulator"),
                },
            ]} />
    </div>;
};

export interface ThemePickerModalProps {
    themes: pxt.ColorThemeInfo[];
    selectedThemeId?: string;
    onThemeChanged: (theme: pxt.ColorThemeInfo) => void;
    onSave: (theme: pxt.ColorThemeInfo) => void;
    onSimulatorThemeClicked?: () => void;
    onClose(): void;
}
export const ThemePickerModal = (props: ThemePickerModalProps) => {
    const [selectedThemeId, setSelectedThemeId] = React.useState(
        props.selectedThemeId || props.themes[0]?.id
    );
    const selectedTheme = props.themes.find(theme => theme.id === selectedThemeId);

    return (
        <Modal
            id="theme-picker-modal"
            title={lf("Choose a Theme")}
            hideTitle={!!props.onSimulatorThemeClicked}
            onClose={props.onClose}
            className="theme-picker-modal"
            rightHeader={props.onSimulatorThemeClicked && <ThemePickerToggle
                selected="editor"
                onModeChanged={props.onSimulatorThemeClicked} />}
            actions={[{
                label: lf("Apply"),
                className: "primary",
                disabled: !selectedTheme,
                onClick: () => selectedTheme && props.onSave(selectedTheme),
            }]}
        >
            <div
                className="theme-picker"
                role="list"
                aria-label={lf("List of available themes")}
            >
                {props.themes.map(theme =>
                    <ThemeCard
                        key={theme.id}
                        theme={theme}
                        selected={theme.id === selectedThemeId}
                        onClick={selected => {
                            setSelectedThemeId(selected.id);
                            props.onThemeChanged(selected);
                        }}
                    />
                )}
            </div>
        </Modal>
    );
};
