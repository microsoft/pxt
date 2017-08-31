namespace pxt.commands {
    // overriden by targets
    export let deployCoreAsync: (r: ts.pxtc.CompileResult) => Promise<void> = undefined;
    export let browserDownloadAsync: (text: string, name: string, contentType: string) => Promise<void> = undefined;
    export let saveOnlyAsync: (r: ts.pxtc.CompileResult) => Promise<void> = undefined;
}