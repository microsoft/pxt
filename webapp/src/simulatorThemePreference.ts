import * as auth from "./auth";
import * as data from "./data";
import {
    getDefaultSimulatorThemePreference,
    isImplicitSimulatorThemePreference,
} from "../../react-common/components/theming/simulatorThemeDefaults";
import { ThemeManager } from "../../react-common/components/theming/themeManager";

// Embedded hosts can update the active simulator without writing the account preference.
let sessionSimulatorThemePreference: pxt.auth.SimulatorThemePreference;
// per listener added with addSimulatorThemePreferenceListener: its subscription to the account preference
const preferenceListeners = new Map<() => void, data.DataSubscriber>();

/**
 * Adds a listener called each time the simulator theme preference may have
 * changed, whether or not it did: synchronously when the session preference
 * is set or cleared, and from a later task when the account preference is
 * invalidated.
 */
export function addSimulatorThemePreferenceListener(listener: () => void): void {
    if (preferenceListeners.has(listener)) return;
    const subscriber: data.DataSubscriber = { subscriptions: [], onDataChanged: () => listener() };
    preferenceListeners.set(listener, subscriber);
    data.subscribe(subscriber, auth.SIMULATOR_THEMES);
}

/** Removes a listener added with addSimulatorThemePreferenceListener. */
export function removeSimulatorThemePreferenceListener(listener: () => void): void {
    const subscriber = preferenceListeners.get(listener);
    if (!subscriber) return;
    preferenceListeners.delete(listener);
    data.unsubscribe(subscriber);
}

function setSessionPreference(preference: pxt.auth.SimulatorThemePreference | undefined) {
    sessionSimulatorThemePreference = preference;
    preferenceListeners.forEach((_, listener) => listener());
}

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
    if (sessionSimulatorThemePreference === previousSessionPreference && previousSessionPreference) {
        setSessionPreference(undefined);
    }
}

export function setSessionSimulatorThemePreference(preference: pxt.auth.SimulatorThemePreference): void {
    if (!pxt.auth.isValidSimulatorThemePreference(preference)) return;
    setSessionPreference(preference);
}
