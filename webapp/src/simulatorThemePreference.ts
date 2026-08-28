import * as auth from "./auth";
import * as data from "./data";
import { isValidSimulatorTheme, SimulatorThemePreference } from "./simulatorTheme";

const LEGACY_SIMULATOR_THEME_STORAGE_KEY = "simulator-theme";
let sessionSimulatorThemePreference: SimulatorThemePreference;

function legacyStorageKey(): string {
    return `${LEGACY_SIMULATOR_THEME_STORAGE_KEY}:${pxt.appTarget.id}`;
}

export function getSimulatorThemePreference(): SimulatorThemePreference | undefined {
    if (sessionSimulatorThemePreference) return sessionSimulatorThemePreference;
    const preferences = data.getData<pxt.auth.SimulatorThemesState>(auth.SIMULATOR_THEMES);
    const preference = preferences?.[pxt.appTarget.id]
        || pxt.Util.jsonTryParse(pxt.storage.getLocal(legacyStorageKey())) as SimulatorThemePreference;
    return preference?.presetId && isValidSimulatorTheme(preference.theme) ? preference : undefined;
}

export async function setSimulatorThemePreference(preference: SimulatorThemePreference): Promise<void> {
    if (!preference?.presetId || !isValidSimulatorTheme(preference.theme)) return;
    await auth.setSimulatorThemePrefAsync(preference);
    pxt.storage.removeLocal(legacyStorageKey());
}

export function setSessionSimulatorThemePreference(preference: SimulatorThemePreference): void {
    if (!preference?.presetId || !isValidSimulatorTheme(preference.theme)) return;
    sessionSimulatorThemePreference = preference;
}
