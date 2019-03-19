namespace ts.pxtc.decompiler {
    export function decompileToPython(file: ts.SourceFile): pxtc.CompileResult {
        let result: pxtc.CompileResult = {
            blocksInfo: null,
            outfiles: {},
            diagnostics: [],
            success: false,
            times: {}
        }
        return result
    }
}