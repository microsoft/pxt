import { simulatorThemeColorsEqual } from "../../react-common/components/theming/simulatorThemeDefaults";

export type SimulatorThemePreference = pxt.auth.SimulatorThemePreference;

function isColor(value: string): boolean {
    return /^#[0-9a-f]{6}$/i.test(value || "");
}

export function isValidSimulatorTheme(theme: pxt.SimulatorTheme): boolean {
    return !!theme
        && isColor(theme["background-color"])
        && isColor(theme["button-stroke"])
        && isColor(theme["text-color"])
        && isColor(theme["button-fill"])
        && isColor(theme["dpad-fill"])
        && isColor(theme["joystick-handle-stroke"])
        && !!theme.layout;
}

export function getSimulatorThemePresetId(
    theme: string | pxt.Map<string> | undefined,
    presets: pxt.SimulatorThemePreset[]
): string | undefined {
    if (!theme) return undefined;
    if (typeof theme === "string") {
        return presets.find(preset => preset.id.toLowerCase() === theme.toLowerCase())?.id;
    }
    return presets.find(preset => simulatorThemeColorsEqual(preset.theme, theme))?.id;
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
