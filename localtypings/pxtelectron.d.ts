/// <reference path="pxtpackage.d.ts" />

declare namespace pxt.electron {
    export interface ElectronManifest {
        latest: string;
        banned?: string[];
        timeStamp?: string;
    }

    export const enum UpdateStatus {
        UpdatingCritical = "updating-critical",
        BannedWithoutUpdate = "banned-without-update",
        Ok = "ok"
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