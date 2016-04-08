namespace pxt.commands {
    
    
    // overriden by targets    
    export let deployCoreAsync: (r: ts.pxt.CompileResult) => Promise<void> = undefined;
}