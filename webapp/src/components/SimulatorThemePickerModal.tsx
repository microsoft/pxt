import * as React from "react";

import { Input } from "../../../react-common/components/controls/Input";
import { Modal } from "../../../react-common/components/controls/Modal";
import { ThemePickerToggle } from "../../../react-common/components/theming/ThemePickerModal";
import * as simulator from "../simulator";
import { getSimulatorThemePresetId, SimulatorThemePreference } from "../simulatorTheme";

type SimulatorThemeColor =
    | "background-color"
    | "button-stroke"
    | "text-color"
    | "button-fill"
    | "dpad-fill";

export interface SimulatorThemePickerModalProps {
    presets: pxt.SimulatorThemePreset[];
    initialPreference?: SimulatorThemePreference;
    onEditorThemeClicked: () => void;
    onSave: (preference: SimulatorThemePreference) => void;
    onClose: () => void;
}

const CUSTOM_PRESET_ID = "custom";

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
    const { presets, initialPreference, onEditorThemeClicked, onSave, onClose } = props;
    const storedPresetId = getSimulatorThemePresetId(initialPreference?.theme, presets);
    const initialPresetId = initialPreference
        ? storedPresetId
            ? storedPresetId
            : CUSTOM_PRESET_ID
        : presets[0].id;
    const [presetId, setPresetId] = React.useState(initialPresetId);
    const [theme, setTheme] = React.useState<pxt.SimulatorTheme>(
        copyTheme(initialPreference?.theme || presets[0].theme)
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
        setPresetId(CUSTOM_PRESET_ID);
        setTheme(nextTheme);
        applyPreviewTheme(nextTheme);
    };

    return <Modal
        id="simulator-theme-picker-modal"
        title={lf("Simulator Theme")}
        className="simulator-theme-picker-modal"
        onClose={onClose}
        actions={[
            { label: lf("Save"), className: "primary", onClick: () => onSave({ presetId, theme }) },
        ]}>
        <ThemePickerToggle
            selected="simulator"
            onEditorThemeClicked={onEditorThemeClicked}
            onSimulatorThemeClicked={() => {}} />
        <div className="simulator-theme-picker">
            <div className="simulator-theme-preview" role="group" aria-label={lf("Simulator theme preview")}>
                <div ref={previewContainer} />
            </div>
            <div className="simulator-theme-controls">
                <label htmlFor="simulator-theme-preset">{lf("Built-in theme")}</label>
                <select
                    id="simulator-theme-preset"
                    aria-label={lf("Built-in simulator theme")}
                    className="simulator-theme-preset-select"
                    value={presetId}
                    onChange={event => selectPreset(event.target.value)}>
                    {presetId === CUSTOM_PRESET_ID && <option value={CUSTOM_PRESET_ID} disabled>{lf("Custom")}</option>}
                    {presets.map(preset => <option key={preset.id} value={preset.id}>
                        {pxt.Util.rlf(`{id:simulator-theme-name}${preset.name}`)}
                    </option>)}
                </select>
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
            </div>
        </div>
    </Modal>;
};