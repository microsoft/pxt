namespace pxt.commands {
    export interface DeployOptions {
        reportError?: (e: string) => void;
        showNotification?: (msg: string) => void;
        reportDeviceNotFoundAsync?: (docPath: string, resp?: ts.pxtc.CompileResult) => Promise<void>;
    }

    // overriden by targets
    export let deployCoreAsync: (r: ts.pxtc.CompileResult, d?: DeployOptions) => Promise<void> = undefined;
    export let patchCompileResultAsync: (r: pxtc.CompileResult) => Promise<void> = undefined;
    export let browserDownloadAsync: (text: string, name: string, contentType: string) => Promise<void> = undefined;
    export let saveOnlyAsync: (r: ts.pxtc.CompileResult) => Promise<void> = undefined;
    export let showUploadInstructionsAsync: (fn: string, url: string, confirmAsync: (options: any) => Promise<number>) => Promise<void> = undefined;
    export let saveProjectAsync: (project: pxt.cpp.HexFile) => Promise<void> = undefined;
    export let electronDeployAsync: (r: ts.pxtc.CompileResult) => Promise<void> = undefined; // A pointer to the Electron deploy function, so that targets can access it in their extension.ts
    export let webUsbPairDialogAsync: (confirmAsync: (options: any) => Promise<number>) => Promise<number> = undefined;
}