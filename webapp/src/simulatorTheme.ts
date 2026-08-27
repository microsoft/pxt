const SIMULATOR_THEME_STORAGE_KEY = "simulator-theme";

export interface SimulatorThemePreference {
    presetId: string;
    theme: pxt.SimulatorTheme;
}

function storageKey(): string {
    return `${SIMULATOR_THEME_STORAGE_KEY}:${pxt.appTarget.id}`;
}

function isColor(value: string): boolean {
    return /^#[0-9a-f]{6}$/i.test(value || "");
}

export function isValidSimulatorTheme(theme: pxt.SimulatorTheme): boolean {
    return !!theme
        && isColor(theme["background-color"])
        && isColor(theme["button-stroke"])
        && isColor(theme["text-color"])
        && isColor(theme["button-fill"])
        && isColor(theme["dpad-fill"]);
}

export function getSimulatorThemePreference(): SimulatorThemePreference | undefined {
    const preference = pxt.Util.jsonTryParse(pxt.storage.getLocal(storageKey())) as SimulatorThemePreference;
    return preference?.presetId && isValidSimulatorTheme(preference.theme) ? preference : undefined;
}

export function setSimulatorThemePreference(preference: SimulatorThemePreference): void {
    if (!preference?.presetId || !isValidSimulatorTheme(preference.theme)) return;
    pxt.storage.setLocal(storageKey(), JSON.stringify(preference));
}

export function clearSimulatorThemePreference(): void {
    pxt.storage.removeLocal(storageKey());
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