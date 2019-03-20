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
                    throw Error("Not implemented");
            }
        }
        let emitVarStmt = (s: ts.VariableStatement) => {
            // console.log("s.declarationList")
            // console.log(s.declarationList)
            let decls = s.declarationList.declarations;
            return decls.map(emitVarDecl)
        }
        let emitVarDecl = (s: ts.VariableDeclaration) => {
            let decl = s.name.getText();
            if (s.initializer) {
                let exp = emitExp(s.initializer);
                return `${decl} = ${exp}`
            } else {
                // TODO can't forward declare variables in python (I think)
                return ""
            }
        }
        let emitExp = (s: ts.Expression) => {
            // TODO
            return s.getText();
        }

        let outLns = stmts.map(emitStmt)
        // TODO VariableDeclarationList

        let output: string = outLns.join("\n");

        console.log("INPUT")
        console.log(file.getText())
        console.log("OUTPUT")
        console.log(output)

        // output += "print('Hello, world!')"

        result.outfiles[file.fileName.replace(/(\.py)?\.\w*$/i, '') + '.py'] = output;

        return result
    }
}