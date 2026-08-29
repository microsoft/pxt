const simulatorThemeColorProperties = [
    "background-color",
    "button-stroke",
    "text-color",
    "button-fill",
    "dpad-fill",
    "joystick-handle-stroke",
];

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
        if (simulatorThemeColorsEqual(preference.theme, nextDefault.theme)
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
        theme: { ...theme } as pxt.SimulatorTheme,
    };
}

export function copySimulatorTheme(theme: pxt.SimulatorTheme): pxt.SimulatorTheme {
    const result: pxt.SimulatorTheme = {
        "background-color": theme["background-color"],
        "button-stroke": theme["button-stroke"],
        "text-color": theme["text-color"],
        "button-fill": theme["button-fill"],
        "dpad-fill": theme["dpad-fill"],
        "joystick-handle-stroke": theme["joystick-handle-stroke"],
        layout: theme.layout || "default",
    };
    return result;
}

export function getSimulatorThemeForLayout(
    theme: pxt.SimulatorTheme,
    layoutId: string
): pxt.SimulatorTheme {
    const nextTheme = copySimulatorTheme(theme);
    nextTheme.layout = layoutId;
    return nextTheme;
}

export function simulatorThemeColorsEqual(left: pxt.Map<string>, right: pxt.Map<string>): boolean {
    return simulatorThemeColorProperties.every(key => left[key] === right[key]);
}