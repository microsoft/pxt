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

function getDefaultColorFields(theme: pxt.SimulatorTheme): pxt.SimulatorThemeColorField[] {
    const labels: pxt.Map<string> = {
        "background-color": lf("Console"),
        "button-stroke": lf("Button outline"),
        "text-color": lf("Button labels"),
        "button-fill": lf("Buttons"),
        "dpad-fill": lf("D-pad"),
        "joystick-handle-stroke": lf("Joystick handle outline"),
    };
    return pxt.auth.DEFAULT_SIMULATOR_THEME_COLOR_PROPERTIES.map(property => ({
        property,
        label: labels[property],
        defaultValue: theme[property],
    }));
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
    const defaultColorFields = getDefaultColorFields(presets[0].theme);
    const getColorFields = (layoutId: string) => {
        const fields = layouts?.find(layout => layout.id === layoutId)?.colorFields;
        return fields?.map(field => ({
            ...field,
            label: pxt.Util.rlf(`{id:simulator-theme-field}${field.label}`),
        })) || defaultColorFields;
    };
    const savedPreset = presets.find(preset => preset.id === initialPreference?.presetId);
    const initialPresetId = savedPreset
        ? savedPreset.id
        : initialPreference
            ? getPresetId(initialPreference.theme, presets) || CUSTOM_PRESET_ID
        : onUseAccountTheme
            ? ACCOUNT_PRESET_ID
            : presets[0].id;
    const initialThemeSource = initialPresetId === "default"
        ? defaultTheme || initialPreference?.theme || savedPreset?.theme || presets[0].theme
        : initialPreference?.theme || savedPreset?.theme || accountTheme || presets[0].theme;
    const initialLayoutId = initialPreference?.theme.layout
        || initialThemeSource.layout
        || pxt.auth.DEFAULT_SIMULATOR_LAYOUT;
    const initialTheme = getSimulatorThemeForLayout(
        initialThemeSource,
        initialLayoutId,
        getColorFields(initialLayoutId)
    );
    const [presetId, setPresetId] = React.useState(initialPresetId);
    const [theme, setTheme] = React.useState<pxt.SimulatorTheme>(initialTheme);
    const layoutId = theme.layout;
    const layoutIsKnown = layoutId === pxt.auth.DEFAULT_SIMULATOR_LAYOUT || layouts?.some(layout => layout.id === layoutId);
    const colorFields = getColorFields(layoutId);

    const selectPreset = (id: string) => {
        if (id === ACCOUNT_PRESET_ID && onUseAccountTheme) {
            setPresetId(id);
            const nextTheme = copySimulatorTheme(accountTheme || presets[0].theme);
            setTheme(getSimulatorThemeForLayout(nextTheme, nextTheme.layout, getColorFields(nextTheme.layout)));
            return;
        }
        const preset = presets.find(candidate => candidate.id === id);
        if (!preset) return;
        const presetTheme = copySimulatorTheme(id === "default" ? defaultTheme || preset.theme : preset.theme);
        const nextTheme = getSimulatorThemeForLayout(
            presetTheme,
            presetTheme.layout,
            getColorFields(presetTheme.layout)
        );
        setPresetId(id);
        setTheme(nextTheme);
        onThemeChanged?.({ presetId: id, theme: nextTheme });
    };

    const updateColor = (property: string, color: string) => {
        const normalized = normalizeColor(color);
        if (!normalized) return;
        const nextTheme = {
            ...theme,
            [property]: normalized,
        };
        setPresetId(CUSTOM_PRESET_ID);
        setTheme(nextTheme);
        onThemeChanged?.({ presetId: CUSTOM_PRESET_ID, theme: nextTheme });
    };

    const selectLayout = (id: string) => {
        const nextTheme = getSimulatorThemeForLayout(theme, id, getColorFields(id));
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
                label: lf("Apply"),
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
                    {colorFields.map(field => <div className="simulator-theme-color" key={field.property}>
                        <span>{field.label}</span>
                        <input
                            type="color"
                            aria-label={lf("{0} color", field.label)}
                            value={theme[field.property]}
                            onChange={event => updateColor(field.property, event.target.value)} />
                        <Input
                            ariaLabel={lf("{0} hex color", field.label)}
                            initialValue={theme[field.property]}
                            onChange={value => updateColor(field.property, value)}
                            validator={(value, previousValue) => normalizeColor(value) || previousValue} />
                    </div>)}
                </div>
            </div>
        </div>
    </Modal>;
};
