// TODO: enable reference so we don't need to use: (pxt as any).py
//      the issue is that this creates a circular dependency. This
//      is easily handled if we used proper TS modules.
//// <reference path="../../built/pxtpy.d.ts"/>

namespace ts.pxtc.transpile {
    export interface TranspileCodeResult {
        outfiles: pxt.Map<string>,
        sourceMap: SourceInterval[],
        syntaxInfo?: SyntaxInfo,
        globalNames?: pxt.Map<SymbolInfo>,
    }
    export interface TranspileResult extends TranspileCodeResult {
        diagnostics: pxtc.KsDiagnostic[],
        success: boolean,
    }

    const mainName = (l: CodeLang) => `main.${l}`

    export function pyToTs(options: pxtc.CompileOptions, filename: string = mainName("py")): TranspileResult {
        return (pxt as any).py.py2ts(options) as TranspileResult;
    }

    export function tsToPy(program: ts.Program, filename: string = mainName("ts")): TranspileResult {
        return (pxt as any).py.decompileToPython(program, filename) as TranspileResult;
    }
}