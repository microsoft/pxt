// Needs to be in its own file to avoid a circular dependency: util.ts -> main.ts -> util.ts

namespace pxt {
    export interface TelemetryEventOptions {
        interactiveConsent: boolean;
    }

    /**
     * Track an event.
     */
    export let tickEvent: (id: string, data?: Map<string | number>, opts?: TelemetryEventOptions) => void = function (id) { }
}
