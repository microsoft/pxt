namespace ts.pxtc.decompiler {
    export function decompileToPython(file: ts.SourceFile): pxtc.CompileResult {
        let result: pxtc.CompileResult = {
            blocksInfo: null,
            outfiles: {},
            diagnostics: [],
            success: true,
            times: {}
        }

        result.outfiles[file.fileName.replace(/(\.blocks)?\.\w*$/i, '') + '.py'] = "print('Hello, world!')";

        return result
    }
}