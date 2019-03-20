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
                case ts.SyntaxKind.ExpressionStatement:
                    return emitExpStmt(s as ts.ExpressionStatement)
                case ts.SyntaxKind.FunctionDeclaration:
                    return emitFuncDeclStmt(s as ts.FunctionDeclaration)
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
            let out = `class ${s.name.getText()}:`

            if (s.members.length) {
                let mems = s.members.map(emitClassMem)
                out += "\n"
                out += mems
                    .map(m => `\t${m}`)
                    .join("\n")
            }

            return out;
        }
        let emitClassMem = (s: ts.ClassElement) => {
            switch (s.kind) {
                case ts.SyntaxKind.PropertyDeclaration:
                    return emitPropDecl(s as ts.PropertyDeclaration)
                default:
                    return "UNKNOWN ClassElement " + s.kind
            }
        }
        let emitPropDecl = (s: ts.PropertyDeclaration) => {
            // TODO(dz)
            return s.name.getText()
        }
        let emitExpStmt = (s: ts.ExpressionStatement) => {
            // TODO
            let exp = emitExp(s.expression)
            return `${exp}`
        }
        let emitFuncDeclStmt = (s: ts.FunctionDeclaration) => {
            // TODO
            let params = s.parameters
                .map(emitParamDecl)
                .join(", ")
            return `def ${s.name.getText()}(${params}):`
        }
        let emitParamDecl = (s: ts.ParameterDeclaration) => {
            // TODO
            let nm = s.name.getText()
            let typ = s.type.getText()
            return `${nm}:${typ}`
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