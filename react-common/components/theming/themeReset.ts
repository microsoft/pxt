import { getDefaultSimulatorThemePreference } from "./simulatorThemeDefaults";

/** Reset this editor's preferences only. */
export async function resetEditorThemesAsync(
    target: Pick<pxt.TargetBundle, "appTheme" | "colorThemeMap" | "simulator">,
    saveColorTheme: (theme: pxt.ColorThemeInfo) => Promise<void>,
    clearSimulatorTheme: () => Promise<void>
): Promise<pxt.auth.SimulatorThemePreference | undefined> {
    const defaultThemeId = target.appTheme?.defaultColorTheme;
    const defaultTheme = defaultThemeId ? target.colorThemeMap?.[defaultThemeId] : undefined;
    if (!defaultTheme) throw new Error("No default editor theme configured");

    await saveColorTheme(defaultTheme);
    await clearSimulatorTheme();
    return getDefaultSimulatorThemePreference(defaultTheme, target.simulator?.themePresets);
}