export function getSimulatorThemePresetId(
    theme: string | pxt.Map<string> | undefined,
    presets: pxt.SimulatorThemePreset[]
): string | undefined {
    if (!theme) return undefined;
    if (typeof theme === "string") {
        return presets.find(preset => preset.id.toLowerCase() === theme.toLowerCase())?.id;
    }
    return presets.find(preset => pxt.auth.simulatorThemeColorsEqual(preset.theme, theme))?.id;
}

export function getProjectSimulatorThemePreference(
    projectTheme: string | pxt.Map<string> | undefined,
    presets: pxt.SimulatorThemePreset[],
    accountTheme: pxt.SimulatorTheme
): pxt.auth.SimulatorThemePreference | undefined {
    if (!projectTheme) return undefined;

    if (typeof projectTheme === "string") {
        const preset = presets.find(candidate => candidate.id.toLowerCase() === projectTheme.toLowerCase());
        return preset
            ? { presetId: preset.id, theme: { ...preset.theme } }
            : { presetId: "custom", theme: { ...accountTheme, layout: projectTheme } };
    }

    const theme = { ...accountTheme, ...projectTheme } as pxt.SimulatorTheme;
    if (!pxt.auth.isValidSimulatorTheme(theme)) return undefined;
    return {
        presetId: getSimulatorThemePresetId(theme, presets) || "custom",
        theme,
    };
}

export function serializeProjectSimulatorThemePreference(
    preference: pxt.auth.SimulatorThemePreference,
    presets: pxt.SimulatorThemePreset[]
): string | pxt.SimulatorTheme {
    const preset = presets.find(candidate => candidate.id === preference.presetId);
    return preset
        && preset.theme.layout === preference.theme.layout
        && pxt.auth.simulatorThemeColorsEqual(preset.theme, preference.theme)
        ? preset.id
        : { ...preference.theme };
}

export function removeSimulatorThemeFromFiles(files: pxt.workspace.ScriptText): pxt.workspace.ScriptText {
    if (!files?.[pxt.CONFIG_NAME]) return files;

    try {
        const config = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        if (config.theme === undefined) return files;
        delete config.theme;
        return {
            ...files,
            [pxt.CONFIG_NAME]: pxt.Package.stringifyConfig(config),
        };
    } catch {
        return files;
    }
}

export function addSimulatorThemeToFiles(
    files: pxt.workspace.ScriptText,
    theme: pxt.SimulatorTheme
): pxt.workspace.ScriptText {
    if (!theme || !files?.[pxt.CONFIG_NAME]) return files;

    try {
        const config = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig;
        config.theme = theme;
        return {
            ...files,
            [pxt.CONFIG_NAME]: pxt.Package.stringifyConfig(config),
        };
    } catch {
        return files;
    }
}

export function resolveSimulatorTheme(
    projectTheme: string | pxt.Map<string> | undefined,
    deviceTheme: string | undefined,
    userTheme: pxt.SimulatorTheme | undefined,
    multiplayer: boolean
): string | pxt.Map<string> | undefined {
    if (multiplayer) return undefined;
    return projectTheme || deviceTheme || userTheme;
}
