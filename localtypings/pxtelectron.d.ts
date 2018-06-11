/// <reference path="pxtpackage.d.ts" />

declare namespace pxt.electron {
    export interface ElectronManifest {
        latest: string;
        banned?: string[];
        timeStamp?: string; // In the format of (new Date()).toISOString()
        isDriveDeployBanned?: boolean;
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

    // Have to duplicate this here because of typings issue when building
    export interface CompileResult {
        outfiles: pxt.Map<string>;
        diagnostics: any[];
        success: boolean;
        times: pxt.Map<number>;
        //ast?: Program; // Not needed, moved to pxtcompiler
        breakpoints?: any[];
        procDebugInfo?: any[];
        blocksInfo?: any;
        usedSymbols?: pxt.Map<any>; // q-names of symbols used
        usedArguments?: pxt.Map<string[]>;
        // client options
        saveOnly?: boolean;
        userContextWindow?: Window;
        downloadFileBaseName?: string;
        confirmAsync?: (confirmOptions: {}) => Promise<number>;
        configData?: any[];
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
        sendDriveDeploy: (compileResult: CompileResult) => void;
        versions: VersionInfo;
    }
}