namespace pxt.commands {
    // overriden by targets
    export let deployCoreAsync: (r: pxtc.CompileResult) => Promise<void> = undefined;
    export let browserDownloadAsync: (text: string, name: string, contentType: string) => Promise<void> = undefined;
}