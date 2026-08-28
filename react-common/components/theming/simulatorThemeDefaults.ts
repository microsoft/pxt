export function getSimulatorThemePreferenceForColorThemeChange(
    preference: pxt.auth.SimulatorThemePreference | undefined,
    previousColorTheme: pxt.ColorThemeInfo | undefined,
    nextColorTheme: pxt.ColorThemeInfo | undefined,
    presets: pxt.SimulatorThemePreset[] | undefined
): pxt.auth.SimulatorThemePreference | undefined {
    if (!presets?.length || previousColorTheme?.id === nextColorTheme?.id) return preference;

    const nextDefault = getDefaultSimulatorThemePreference(nextColorTheme, presets);
    if (!nextDefault) return preference;

    if (preference) {
        if (preference.presetId !== nextDefault.presetId) return preference;
        if (simulatorThemesEqual(preference.theme, nextDefault.theme)) return preference;
    }
    else if (!nextColorTheme?.defaultSimulatorTheme) {
        return preference;
    }

    return nextDefault;
}

export function getDefaultSimulatorThemePreference(
    colorTheme: pxt.ColorThemeInfo | undefined,
    presets: pxt.SimulatorThemePreset[] | undefined
): pxt.auth.SimulatorThemePreference | undefined {
    const defaultPreset = presets?.find(candidate => candidate.id === "default") || presets?.[0];
    if (!defaultPreset) return undefined;

    const configuredDefault = colorTheme?.defaultSimulatorTheme;
    const configuredPreset = typeof configuredDefault === "string"
        ? presets?.find(candidate => candidate.id === configuredDefault)
        : undefined;
    const theme = typeof configuredDefault === "object"
        ? { ...defaultPreset.theme, ...configuredDefault }
        : configuredPreset?.theme || defaultPreset.theme;
    return {
        presetId: defaultPreset.id,
        theme: { ...theme } as pxt.SimulatorTheme,
    };
}

function simulatorThemesEqual(left: pxt.SimulatorTheme, right: pxt.SimulatorTheme): boolean {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
        && leftKeys.every(key => left[key] === right[key]);
}