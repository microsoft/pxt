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
                case ts.SyntaxKind.ClassDeclaration:
                    return emitClassStmt(s as ts.ClassDeclaration)
                default:
                    throw Error(`Not implemented: statement kind ${s.kind}`);
            }
        }
        let emitVarStmt = (s: ts.VariableStatement) => {
            // console.log("s.declarationList")
            // console.log(s.declarationList)
            let decls = s.declarationList.declarations;
            return decls.map(emitVarDecl)
        }
        // TODO map names from camel case to snake case
        let emitClassStmt = (s: ts.ClassDeclaration) => {
            // TODO inheritence
            return `class ${s.name}:`
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

        // output += "print('Hello, world!')"

        result.outfiles[file.fileName.replace(/(\.py)?\.\w*$/i, '') + '.py'] = output;

        return result
    }
}