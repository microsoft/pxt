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
        if (pxt.auth.simulatorThemeColorsEqual(preference.theme, nextDefault.theme)
            && preference.theme.layout === nextDefault.theme.layout) return preference;
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
        theme: copySimulatorTheme(theme as pxt.SimulatorTheme),
    };
}

export function isImplicitSimulatorThemePreference(
    preference: pxt.auth.SimulatorThemePreference,
    presets: pxt.SimulatorThemePreset[] | undefined
): boolean {
    const defaultPreset = presets?.find(candidate => candidate.id === "default") || presets?.[0];
    return preference.presetId === defaultPreset?.id
        && preference.theme.layout === pxt.auth.DEFAULT_SIMULATOR_LAYOUT;
}

export function copySimulatorTheme(theme: pxt.SimulatorTheme): pxt.SimulatorTheme {
    const result = { layout: theme.layout || pxt.auth.DEFAULT_SIMULATOR_LAYOUT } as pxt.SimulatorTheme;
    for (const property of Object.keys(theme)) {
        if (pxt.auth.isSimulatorThemeColorProperty(property)
            && pxt.auth.isSimulatorThemeColor(theme[property])) {
            result[property] = theme[property];
        }
    }
    return result;
}

export function getSimulatorThemeForLayout(
    theme: pxt.SimulatorTheme,
    layoutId: string,
    colorFields: pxt.SimulatorThemeColorField[] = []
): pxt.SimulatorTheme {
    const nextTheme = copySimulatorTheme(theme);
    nextTheme.layout = layoutId;
    for (const field of colorFields) {
        if (!pxt.auth.isSimulatorThemeColor(nextTheme[field.property])) {
            nextTheme[field.property] = field.defaultValue;
        }
    }
    return nextTheme;
}
