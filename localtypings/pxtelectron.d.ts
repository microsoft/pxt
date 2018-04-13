/// <reference path="pxtpackage.d.ts" />

declare namespace pxt.electron {
    export interface ElectronManifest {
        latest: string;
        timeStamp?: string;
    }

    export interface TelemetryEvent {
        event: string;
        data: pxt.Map<string | number>;
    }

    export type TelemetryHandler = (id: string, data?: pxt.Map<string | number>) => void;

    // The object that gets injected into the window
    export interface PxtElectron {
        registerTelemetryHandler: (telemetryHandler: TelemetryHandler) => void;
        registerUpdateHandler: (updateHandler: () => void) => void;
    }
}