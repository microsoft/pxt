/// <reference path="pxtpackage.d.ts" />

declare namespace pxt.electron {
    export interface ElectronManifest {
        latest: string;
        banned?: string[];
        timeStamp?: string; // In the format of (new Date()).toISOString()
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

    interface VersionInfo {
        electronVersion: string;
        chromiumVersion: string;
        nodeVersion: string;
        pxtTargetVersion: string;
        pxtCoreVersion: string;
        pxtElectronVersion: string;
        isProd: number; // If the app is production, this will be set to 1
    }

    // The object that gets injected into the window
    export interface PxtElectron {
        onTelemetry: (handler: (ev: TelemetryEvent) => void) => void;
        onUpdateInstalled: (handler: () => void) => void;
        onUpdateStatus: (handler: (st: UpdateStatus) => void) => void;
        onCriticalUpdateFailed: (handler: () => void) => void;
        onDriveDeployResult: (handler: (isSuccess: boolean) => void) => void;

        sendUpdateStatusCheck: () => void;
        sendQuit: () => void;
        sendOpenDevTools: () => void;
        sendDriveDeploy: (compileResult: pxtc.CompileResult) => void;
        versions: VersionInfo;
    }
}