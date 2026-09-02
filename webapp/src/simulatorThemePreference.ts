import * as auth from "./auth";
import * as data from "./data";
import {
    getDefaultSimulatorThemePreference,
    isImplicitSimulatorThemePreference,
} from "../../react-common/components/theming/simulatorThemeDefaults";
import { ThemeManager } from "../../react-common/components/theming/themeManager";

// Embedded hosts can update the active simulator without writing the account preference.
let sessionSimulatorThemePreference: pxt.auth.SimulatorThemePreference;

export function getSimulatorThemePreference(): pxt.auth.SimulatorThemePreference | undefined {
    if (sessionSimulatorThemePreference) return sessionSimulatorThemePreference;
    const preferences = data.getData<pxt.auth.SimulatorThemesState>(auth.SIMULATOR_THEMES);
    const preference = preferences?.[pxt.appTarget.id];
    return pxt.auth.isValidSimulatorThemePreference(preference) ? preference : undefined;
}

export function getEffectiveSimulatorThemePreference(): pxt.auth.SimulatorThemePreference | undefined {
    return getSimulatorThemePreference() || getDefaultSimulatorThemePreference(
        ThemeManager.getInstance(document).getCurrentColorTheme(),
        pxt.appTarget.simulator?.themePresets
    );
}

export async function setSimulatorThemePreference(preference: pxt.auth.SimulatorThemePreference | undefined): Promise<void> {
    if (preference && !pxt.auth.isValidSimulatorThemePreference(preference)) return;
    const persistedPreference = preference && !isImplicitSimulatorThemePreference(
        preference,
        pxt.appTarget.simulator?.themePresets
    ) ? preference : undefined;
    const previousSessionPreference = sessionSimulatorThemePreference;
    await auth.setSimulatorThemePrefAsync(persistedPreference);
    if (sessionSimulatorThemePreference === previousSessionPreference) {
        sessionSimulatorThemePreference = undefined;
    }
}

export function setSessionSimulatorThemePreference(preference: pxt.auth.SimulatorThemePreference): void {
    if (!pxt.auth.isValidSimulatorThemePreference(preference)) return;
    sessionSimulatorThemePreference = preference;
}
