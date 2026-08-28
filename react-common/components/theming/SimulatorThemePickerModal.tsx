import * as React from "react";

import { Input } from "../controls/Input";
import { Modal } from "../controls/Modal";
import { ThemePickerToggle } from "./ThemePickerModal";

type SimulatorThemeColor =
    | "background-color"
    | "button-stroke"
    | "text-color"
    | "button-fill"
    | "dpad-fill";

export interface SimulatorThemePickerModalProps {
    presets: pxt.SimulatorThemePreset[];
    initialPreference?: pxt.auth.SimulatorThemePreference;
    renderPreview: (theme: pxt.SimulatorTheme) => React.ReactNode;
    onEditorThemeClicked: () => void;
    onSave: (preference: pxt.auth.SimulatorThemePreference) => void | Promise<void>;
    onClose: () => void;
}

const CUSTOM_PRESET_ID = "custom";

function getThemeColors(): { id: SimulatorThemeColor; label: string }[] {
    return [
        { id: "background-color", label: lf("Console") },
        { id: "button-stroke", label: lf("Button outline") },
        { id: "text-color", label: lf("Button labels") },
        { id: "button-fill", label: lf("Buttons") },
        { id: "dpad-fill", label: lf("D-pad") },
    ];
}

function copyTheme(theme: pxt.SimulatorTheme): pxt.SimulatorTheme {
    return { ...theme };
}

function getPresetId(theme: pxt.SimulatorTheme, presets: pxt.SimulatorThemePreset[]): string | undefined {
    return presets.find(preset => {
        const presetKeys = Object.keys(preset.theme);
        return presetKeys.length === Object.keys(theme).length
            && presetKeys.every(key => preset.theme[key] === theme[key]);
    })?.id;
}

export const SimulatorThemePickerModal = (props: SimulatorThemePickerModalProps) => {
    const { presets, initialPreference, renderPreview, onEditorThemeClicked, onSave, onClose } = props;
    const themeColors = getThemeColors();
    const initialPresetId = initialPreference
        ? getPresetId(initialPreference.theme, presets) || CUSTOM_PRESET_ID
        : presets[0].id;
    const [presetId, setPresetId] = React.useState(initialPresetId);
    const [theme, setTheme] = React.useState<pxt.SimulatorTheme>(
        copyTheme(initialPreference?.theme || presets[0].theme)
    );

    const selectPreset = (id: string) => {
        const preset = presets.find(candidate => candidate.id === id);
        if (!preset) return;
        setPresetId(id);
        setTheme(copyTheme(preset.theme));
    };

    const updateColor = (part: SimulatorThemeColor, color: string) => {
        const normalized = color.startsWith("#") ? color : `#${color}`;
        if (!/^#[0-9a-f]{6}$/i.test(normalized)) return;
        setPresetId(CUSTOM_PRESET_ID);
        setTheme({
            ...theme,
            [part]: normalized.toUpperCase(),
        });
    };

    return <Modal
        id="simulator-theme-picker-modal"
        title={lf("Simulator Theme")}
        hideTitle={true}
        className="simulator-theme-picker-modal"
        onClose={onClose}
        rightHeader={<ThemePickerToggle
            selected="simulator"
            onEditorThemeClicked={onEditorThemeClicked}
            onSimulatorThemeClicked={() => {}} />}
        actions={[
            { label: lf("Save"), className: "primary", onClick: () => onSave({ presetId, theme }) },
        ]}>
        <div className="simulator-theme-picker">
            {renderPreview(theme)}
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
