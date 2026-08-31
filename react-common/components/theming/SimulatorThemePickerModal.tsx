import * as React from "react";

import { Input } from "../controls/Input";
import { Modal } from "../controls/Modal";
import { copySimulatorTheme, getSimulatorThemeForLayout } from "./simulatorThemeDefaults";
import { ThemePickerToggle } from "./ThemePickerModal";

export interface SimulatorThemePickerModalProps {
    presets: pxt.SimulatorThemePreset[];
    layouts?: pxt.SimulatorThemeLayout[];
    initialPreference?: pxt.auth.SimulatorThemePreference;
    defaultTheme?: pxt.SimulatorTheme;
    accountTheme?: pxt.SimulatorTheme;
    renderPreview: (theme: pxt.SimulatorTheme) => React.ReactNode;
    onEditorThemeClicked?: () => void;
    onUseAccountTheme?: () => void | Promise<void>;
    onThemeChanged?: (preference: pxt.auth.SimulatorThemePreference) => void;
    onSave: (preference: pxt.auth.SimulatorThemePreference) => void | Promise<void>;
    onClose: () => void;
}

const CUSTOM_PRESET_ID = "custom";
const ACCOUNT_PRESET_ID = "account";

function getThemeColors(): { id: pxt.auth.SimulatorThemeColor; label: string }[] {
    const labels: Record<pxt.auth.SimulatorThemeColor, string> = {
        "background-color": lf("Console"),
        "button-stroke": lf("Button outline"),
        "text-color": lf("Button labels"),
        "button-fill": lf("Buttons"),
        "dpad-fill": lf("D-pad"),
        "joystick-handle-stroke": lf("Joystick handle outline"),
    };
    return pxt.auth.SIMULATOR_THEME_COLOR_PROPERTIES.map(id => ({ id, label: labels[id] }));
}

function getPresetId(theme: pxt.SimulatorTheme, presets: pxt.SimulatorThemePreset[]): string | undefined {
    return presets.find(preset => pxt.auth.simulatorThemeColorsEqual(preset.theme, theme))?.id;
}

function normalizeColor(value: string): string | undefined {
    const normalized = value.startsWith("#") ? value : `#${value}`;
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : undefined;
}

export const SimulatorThemePickerModal = (props: SimulatorThemePickerModalProps) => {
    const {
        presets,
        layouts,
        initialPreference,
        defaultTheme,
        accountTheme,
        renderPreview,
        onEditorThemeClicked,
        onUseAccountTheme,
        onThemeChanged,
        onSave,
        onClose,
    } = props;
    const themeColors = getThemeColors();
    const savedPreset = presets.find(preset => preset.id === initialPreference?.presetId);
    const initialPresetId = savedPreset
        ? savedPreset.id
        : initialPreference
            ? getPresetId(initialPreference.theme, presets) || CUSTOM_PRESET_ID
        : onUseAccountTheme
            ? ACCOUNT_PRESET_ID
            : presets[0].id;
    const initialThemeSource = defaultTheme || initialPreference?.theme || savedPreset?.theme || presets[0].theme;
    const initialTheme = initialPresetId === "default"
        ? getSimulatorThemeForLayout(
            initialThemeSource,
            initialPreference?.theme.layout || initialThemeSource.layout || pxt.auth.DEFAULT_SIMULATOR_LAYOUT
        )
        : copySimulatorTheme(initialPreference?.theme || savedPreset?.theme || accountTheme || presets[0].theme);
    const [presetId, setPresetId] = React.useState(initialPresetId);
    const [theme, setTheme] = React.useState<pxt.SimulatorTheme>(initialTheme);
    const layoutId = theme.layout;
    const layoutIsKnown = layoutId === pxt.auth.DEFAULT_SIMULATOR_LAYOUT || layouts?.some(layout => layout.id === layoutId);

    const selectPreset = (id: string) => {
        if (id === ACCOUNT_PRESET_ID && onUseAccountTheme) {
            setPresetId(id);
            setTheme(copySimulatorTheme(accountTheme || presets[0].theme));
            return;
        }
        const preset = presets.find(candidate => candidate.id === id);
        if (!preset) return;
        const nextTheme = copySimulatorTheme(id === "default" ? defaultTheme || preset.theme : preset.theme);
        setPresetId(id);
        setTheme(nextTheme);
        onThemeChanged?.({ presetId: id, theme: nextTheme });
    };

    const updateColor = (part: pxt.auth.SimulatorThemeColor, color: string) => {
        const normalized = normalizeColor(color);
        if (!normalized) return;
        const nextTheme = {
            ...theme,
            [part]: normalized,
        };
        setPresetId(CUSTOM_PRESET_ID);
        setTheme(nextTheme);
        onThemeChanged?.({ presetId: CUSTOM_PRESET_ID, theme: nextTheme });
    };

    const selectLayout = (id: string) => {
        const nextTheme = getSimulatorThemeForLayout(
            theme,
            id
        );
        const nextPresetId = presetId === ACCOUNT_PRESET_ID ? CUSTOM_PRESET_ID : presetId;
        setPresetId(nextPresetId);
        setTheme(nextTheme);
        onThemeChanged?.({ presetId: nextPresetId, theme: nextTheme });
    };

    return <Modal
        id="simulator-theme-picker-modal"
        title={lf("Simulator Theme")}
        hideTitle={!!onEditorThemeClicked}
        className={`simulator-theme-picker-modal${onEditorThemeClicked ? "" : " standalone"}`}
        onClose={onClose}
        rightHeader={onEditorThemeClicked && <ThemePickerToggle
            selected="simulator"
            onModeChanged={onEditorThemeClicked} />}
        actions={[
            {
                label: lf("Save"),
                className: "primary",
                onClick: () => presetId === ACCOUNT_PRESET_ID
                    ? onUseAccountTheme?.()
                    : onSave({ presetId, theme }),
            },
        ]}>
        <div className="simulator-theme-picker">
            {renderPreview(theme)}
            <div className="simulator-theme-controls">
                <div className="simulator-theme-select-field">
                    <label htmlFor="simulator-theme-preset">
                        {onUseAccountTheme ? lf("Theme") : lf("Built-in theme")}
                    </label>
                    <select
                        id="simulator-theme-preset"
                        aria-label={onUseAccountTheme ? lf("Project simulator theme") : lf("Built-in simulator theme")}
                        className="simulator-theme-select"
                        value={presetId}
                        onChange={event => selectPreset(event.target.value)}>
                        {onUseAccountTheme && <option value={ACCOUNT_PRESET_ID}>{lf("Use account theme")}</option>}
                        {presetId === CUSTOM_PRESET_ID && <option value={CUSTOM_PRESET_ID} disabled>{lf("Custom")}</option>}
                        {presets.map(preset => <option key={preset.id} value={preset.id}>
                            {pxt.Util.rlf(`{id:simulator-theme-name}${preset.name}`)}
                        </option>)}
                    </select>
                </div>
                {!!layouts?.length && <div className="simulator-theme-select-field">
                    <label htmlFor="simulator-theme-layout">{lf("Layout")}</label>
                    <select
                        id="simulator-theme-layout"
                        aria-label={lf("Simulator layout")}
                        className="simulator-theme-select"
                        value={layoutId}
                        onChange={event => selectLayout(event.target.value)}>
                        <option value={pxt.auth.DEFAULT_SIMULATOR_LAYOUT}>{lf("Default")}</option>
                        {!layoutIsKnown && <option value={layoutId} disabled>{lf("Custom ({0})", layoutId)}</option>}
                        {layouts.map(layout => <option key={layout.id} value={layout.id}>
                            {pxt.Util.rlf(`{id:simulator-layout-name}${layout.name}`)}
                        </option>)}
                    </select>
                </div>}
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
                            validator={(value, previousValue) => normalizeColor(value) || previousValue} />
                    </div>)}
                </div>
            </div>
        </div>
    </Modal>;
};
