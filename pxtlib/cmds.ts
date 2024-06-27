namespace pxt.commands {
    export enum WebUSBPairResult {
        Failed = 0,
        Success = 1,
        UserRejected = 2,
    }

    export interface RecompileOptions {
        recompile: boolean;
        useVariants: string[];
    }


    export interface DeployOptions {
        reportError: (e: string) => void;
        showNotification: (msg: string) => void;
    }

    // overriden by targets
    export type DeployFnAsync = (r: ts.pxtc.CompileResult, d?: DeployOptions) => Promise<void>
    export let deployCoreAsync: DeployFnAsync = undefined;
    export let deployFallbackAsync: DeployFnAsync = undefined;
    export let hasDeployFn = () => deployCoreAsync || deployFallbackAsync
    export let deployAsync: DeployFnAsync = (r: ts.pxtc.CompileResult, d?: DeployOptions) => {
        return (deployCoreAsync || deployFallbackAsync)(r, d)
    }
    export let patchCompileResultAsync: (r: pxtc.CompileResult) => Promise<void> = undefined;
    export let browserDownloadAsync: (text: string, name: string, contentType: string) => Promise<void> = undefined;
    export let saveOnlyAsync: (r: ts.pxtc.CompileResult) => Promise<void> = undefined;
    export let renderBrowserDownloadInstructions: (saveOnly?: boolean, redeploy?: () => Promise<void>) => any /* JSX.Element */ = undefined;
    export let renderUsbPairDialog: (firmwareUrl?: string, failedOnce?: boolean) => any /* JSX.Element */ = undefined;
    export let renderIncompatibleHardwareDialog: (unsupportedParts: string[]) => any /* JSX.Element */ = undefined;
    export let renderDisconnectDialog: () => { header: string, jsx: any, helpUrl: string }
    export let showUsbDeviceForgottenDialog: (confirmAsync: (options: any) => Promise<number>) => Promise<void>;
    export let showUploadInstructionsAsync: (fn: string, url: string, confirmAsync: (options: any) =>    Promise<number>, saveOnly?: boolean, redeploy?: () => Promise<void>) => Promise<void> = undefined;
    export let showProgramTooLargeErrorAsync: (variants: string[], confirmAsync: (options: any) => Promise<number>, saveOnly?: boolean) => Promise<RecompileOptions>;
    export let saveProjectAsync: (project: pxt.cpp.HexFile) => Promise<void> = undefined;
    export let saveCompiledProjectAsync: (project: pxt.cpp.HexFile, compileResult: pxtc.CompileResult, confirmAsync: (options: any) => Promise<number>) => Promise<void> = undefined;
    export let electronDeployAsync: (r: ts.pxtc.CompileResult) => Promise<void> = undefined; // A pointer to the Electron deploy function, so that targets can access it in their extension.ts
    export let webUsbPairDialogAsync: (pairAsync: () => Promise<boolean>, confirmAsync: (options: any) => Promise<WebUSBPairResult>, implicitlyCalled?: boolean) => Promise<WebUSBPairResult> = undefined;
    export let onTutorialCompleted: () => void = undefined;
    export let workspaceLoadedAsync: () => Promise<void> = undefined;
}