namespace pxt.commands {
    // overriden by targets
    export interface DeployOptions {
        reportError?: (e: string) => void;
        reportDeviceNotFoundAsync?: (docPath: string, resp?: ts.pxtc.CompileResult) => Promise<void>;
    }
    export let deployCoreAsync: (r: ts.pxtc.CompileResult, d?: DeployOptions) => Promise<void> = undefined;
    export let browserDownloadAsync: (text: string, name: string, contentType: string) => Promise<void> = undefined;
    export let saveOnlyAsync: (r: ts.pxtc.CompileResult) => Promise<void> = undefined;
}