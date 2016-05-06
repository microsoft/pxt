namespace pxt.commands {
    // overriden by targets    
    export let deployCoreAsync: (r: ts.pxt.CompileResult) => Promise<void> = undefined;
    export let browserDownloadAsync: (text: string, name: string, contentType: string) => Promise<void> = undefined;
}