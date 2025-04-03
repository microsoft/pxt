/// <reference path="pxtpackage.d.ts" />

declare namespace pxt.electron {
    export interface ElectronManifest {
        latest: string;
        banned?: string[];
        timeStamp?: string; // In the format of (new Date()).toISOString()
        isDriveDeployBanned?: boolean;
        isFileDeployBanned?: boolean;
    }

    export const enum UpdateStatus {
        UpdatingCritical = "updating-critical",
        BannedWithoutUpdate = "banned-without-update",
        UpdateAvailable = "update-available",
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

    // Request to deploy files to a specified location
    export interface FileDeployRequest {
        location: string; // id for location to attempt to deploy to
        files: pxt.Map<string>; // Files to write, key is filename in subpath, value is b64 file content
    }

    // The object that gets injected into the window
    export interface PxtElectron {
        onTelemetry: (handler: (ev: TelemetryEvent) => void) => void; // Registers a handler to invoke when the app shell requests a telemetry event to be sent to AI.
        onUpdateInstalled: (handler: () => void) => void; // Registers a handler to invoke when the app shell notifies that an update was installed.
        onUpdateStatus: (handler: (st: UpdateStatus) => void) => void; // Registers a handler to invoke when the app shell replies with the current update status.
        onCriticalUpdateFailed: (handler: () => void) => void; // Registers a handler to invoke when the app shell notifies us that a critical update has failed.
        onDriveDeployResult: (handler: (isSuccess: boolean) => void) => void; // Registers a handler to invoke when the app shell replies with the result of the last drive deploy attempt.
        onFileDeployResult: (handler: (isSuccess: boolean) => void) => void; // Registers a handler to invoke when the app shell replies with the result of the last file deploy attempt.

        sendUpdateStatusCheck: () => void; // Asks the app shell about the current update status. The answer will come as a separate, asynchronous message.
        sendQuit: () => void; // Asks the app shell to quit.
        sendOpenDevTools: () => void; // Asks the app shell to open dev tools.
        sendDriveDeploy: (compileResult: CompileResult) => void; // Asks the app to deploy the program to the device via USB file copy.
        sendFileDeploy: (files: FileDeployRequest) => void // Asks the app to deploy the given files to a known folder.
        versions: VersionInfo; // Various versions for telemetry base properties
    }
}