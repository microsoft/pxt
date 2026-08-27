import * as React from "react";

import { Button } from "../../../react-common/components/controls/Button";
import { Dropdown } from "../../../react-common/components/controls/Dropdown";
import { Input } from "../../../react-common/components/controls/Input";
import { Modal } from "../../../react-common/components/controls/Modal";
import * as simulator from "../simulator";
import { SimulatorThemePreference } from "../simulatorTheme";

type SimulatorThemeColor =
    | "background-color"
    | "button-stroke"
    | "text-color"
    | "button-fill"
    | "dpad-fill";

export interface SimulatorThemePickerModalProps {
    presets: pxt.SimulatorThemePreset[];
    initialPreference?: SimulatorThemePreference;
    onSave: (preference: SimulatorThemePreference) => void;
    onReset: () => void;
    onClose: () => void;
}

const themeColors: { id: SimulatorThemeColor; label: string }[] = [
    { id: "background-color", label: lf("Console") },
    { id: "button-stroke", label: lf("Button outline") },
    { id: "text-color", label: lf("Button labels") },
    { id: "button-fill", label: lf("Buttons") },
    { id: "dpad-fill", label: lf("D-pad") },
];

function copyTheme(theme: pxt.SimulatorTheme): pxt.SimulatorTheme {
    return { ...theme };
}

export const SimulatorThemePickerModal = (props: SimulatorThemePickerModalProps) => {
    const { presets, initialPreference, onSave, onReset, onClose } = props;
    const initialPreset = presets.find(preset => preset.id === initialPreference?.presetId) || presets[0];
    const [presetId, setPresetId] = React.useState(initialPreset.id);
    const [theme, setTheme] = React.useState<pxt.SimulatorTheme>(
        copyTheme(initialPreference?.theme || initialPreset.theme)
    );
    const previewContainer = React.useRef<HTMLDivElement>();
    const currentTheme = React.useRef(theme);

    const applyPreviewTheme = (nextTheme: pxt.SimulatorTheme) => {
        currentTheme.current = nextTheme;
        simulator.setPreviewSimulatorTheme(nextTheme);
    };

    React.useEffect(() => {
        const loanedSimulator = simulator.driver?.loanSimulator();
        const container = previewContainer.current;
        if (!loanedSimulator || !container) return undefined;

        container.appendChild(loanedSimulator);
        const frame = loanedSimulator.querySelector("iframe");
        const onLoad = () => applyPreviewTheme(currentTheme.current);
        frame?.addEventListener("load", onLoad);
        applyPreviewTheme(currentTheme.current);

        return () => {
            frame?.removeEventListener("load", onLoad);
            simulator.driver?.unloanSimulator();
        };
    }, []);

    const selectPreset = (id: string) => {
        const preset = presets.find(candidate => candidate.id === id);
        if (!preset) return;
        const nextTheme = copyTheme(preset.theme);
        setPresetId(id);
        setTheme(nextTheme);
        applyPreviewTheme(nextTheme);
    };

    const updateColor = (part: SimulatorThemeColor, color: string) => {
        const normalized = color.startsWith("#") ? color : `#${color}`;
        if (!/^#[0-9a-f]{6}$/i.test(normalized)) return;
        const nextTheme = {
            ...theme,
            [part]: normalized.toUpperCase(),
        };
        setTheme(nextTheme);
        applyPreviewTheme(nextTheme);
    };

    return <Modal
        id="simulator-theme-picker-modal"
        title={lf("Simulator Theme")}
        className="simulator-theme-picker-modal"
        onClose={onClose}
        actions={[
            { label: lf("Cancel"), onClick: onClose },
            { label: lf("Save"), className: "primary", onClick: () => onSave({ presetId, theme }) },
        ]}>
        <div className="simulator-theme-picker">
            <div className="simulator-theme-preview" role="group" aria-label={lf("Simulator theme preview")}>
                <div ref={previewContainer} />
            </div>
            <div className="simulator-theme-controls">
                <label htmlFor="simulator-theme-preset">{lf("Built-in theme")}</label>
                <Dropdown
                    id="simulator-theme-preset"
                    ariaLabel={lf("Built-in simulator theme")}
                    selectedId={presetId}
                    items={presets.map(preset => ({
                        id: preset.id,
                        label: pxt.Util.rlf(preset.name),
                        title: pxt.Util.rlf(preset.name),
                    }))}
                    onItemSelected={selectPreset} />
                <div className="simulator-theme-color-list">
                    {themeColors.map(part => <div className="simulator-theme-color" key={part.id}>
                        <span>{part.label}</span>
                        <input
                            type="color"
                            aria-label={lf("{0} color", part.label)}
                            value={theme[part.id]}
                            onChange={event => updateColor(part.id, event.target.value)} />
                        <Input
                            ariaLabel={lf("{0} hex color", part.label)}
                            initialValue={theme[part.id]}
                            onChange={value => updateColor(part.id, value)}
                            onBlur={value => updateColor(part.id, value)}
                            onEnterKey={value => updateColor(part.id, value)}
                            validator={(value, previousValue) => {
                                const normalized = value.startsWith("#") ? value : `#${value}`;
                                return /^#[0-9a-f]{6}$/i.test(normalized)
                                    ? normalized.toUpperCase()
                                    : previousValue;
                            }} />
                                </div>)}
                </div>
                <Button
                    className="secondary simulator-theme-reset"
                    label={lf("Use Default")}
                    title={lf("Use the default simulator theme")}
                    leftIcon="fas fa-undo"
                    onClick={onReset} />
            </div>
        </div>
    </Modal>;
};