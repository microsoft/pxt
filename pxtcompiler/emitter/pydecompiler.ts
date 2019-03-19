namespace ts.pxtc.decompiler {
    // TODO(dz): code share with blocks decompiler
    export function decompileToPython(file: ts.SourceFile): pxtc.CompileResult {
        let result: pxtc.CompileResult = {
            blocksInfo: null,
            outfiles: {},
            diagnostics: [],
            success: true,
            times: {}
        }

        let stmts: NodeArray<ts.Statement> = file.statements;
        // const env: DecompilerEnv = {
        //     blocks: blocksInfo,
        //     declaredFunctions: {},
        //     declaredEnums: {},
        //     functionParamIds: {},
        //     attrs: attrs,
        //     compInfo: compInfo,
        //     localReporters: [],
        //     opts: options || {}
        // };

        let emitStmt = (s: ts.Statement) => {
            // TODO(dz): why does the type system not recognize this as discriminated unions?
            switch (s.kind) {
                case ts.SyntaxKind.VariableStatement:
                    return emitVarStmt(s as ts.VariableStatement)
                default:
                    throw "Not implemented";
            }
        }
        let emitVarStmt = (s: ts.VariableStatement) => {
        }

        let printStmt = (s: ts.Statement) => {
            console.log(s.getFullText())
            console.log("s")
            console.log(s)
            // let foo = [s.kind, s.modifiers, s.symbol]
            // console.log(foo)
            // console.log("s.parent")
            // console.log(s.parent)
            // s.declarationList
        }
        stmts.forEach(printStmt)

        let output: string = "";

        output += "print('Hello, world!')"

        result.outfiles[file.fileName.replace(/(\.py)?\.\w*$/i, '') + '.py'] = output;

        return result
    }
}