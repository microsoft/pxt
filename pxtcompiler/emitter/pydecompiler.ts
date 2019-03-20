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

        let outLns = stmts
            .map(emitStmt)
            .reduce((p, c) => p.concat(c), [])

        let output = outLns.join("\n");

        result.outfiles[file.fileName.replace(/(\.py)?\.\w*$/i, '') + '.py'] = output;

        return result
    }

    // TODO(dz):
    const INDENT = "  "

    function ind(lvl: number): (s: string) => string {
        return s => `${INDENT.repeat(lvl)}${s}`
    }

    function emitStmt(s: ts.Statement): string[] {
        // TODO(dz): why does the type system not recognize this as discriminated unions?
        switch (s.kind) {
            case ts.SyntaxKind.VariableStatement:
                return emitVarStmt(s as ts.VariableStatement)
            case ts.SyntaxKind.ClassDeclaration:
                return emitClassStmt(s as ts.ClassDeclaration)
            case ts.SyntaxKind.ExpressionStatement:
                return [emitExpStmt(s as ts.ExpressionStatement)]
            case ts.SyntaxKind.FunctionDeclaration:
                return emitFuncDecl(s as ts.FunctionDeclaration)
            default:
                throw Error(`Not implemented: statement kind ${s.kind}`);
        }
    }
    function emitVarStmt(s: ts.VariableStatement): string[] {
        // console.log("s.declarationList")
        // console.log(s.declarationList)
        let decls = s.declarationList.declarations;
        return decls.map(emitVarDecl)
    }
    // TODO map names from camel case to snake case
    function emitClassStmt(s: ts.ClassDeclaration): string[] {
        // TODO inheritence
        let out = [`class ${s.name.getText()}:`]

        let mems = s.members
            .map(emitClassMem)
            .reduce((p, c) => p.concat(c), [])
            .filter(m => m)
        if (mems.length) {
            out = out.concat(mems.map(ind(1)))
        }
        out.push("") // leave newline after class

        return out;
    }
    function emitClassMem(s: ts.ClassElement): string[] {
        switch (s.kind) {
            case ts.SyntaxKind.PropertyDeclaration:
                return [emitPropDecl(s as ts.PropertyDeclaration)]
            case ts.SyntaxKind.MethodDeclaration:
                return emitFuncDecl(s as ts.MethodDeclaration)
            default:
                return ["UNKNOWN ClassElement " + s.kind]
        }
    }
    function emitPropDecl(s: ts.PropertyDeclaration): string {
        // TODO(dz)
        let nm = s.name.getText()
        if (s.initializer) {
            let init = emitExp(s.initializer)
            return `${nm} = ${init}`
        }
        else {
            // TODO can't do declerations without initilization in python
            return ""
        }
    }
    function emitExpStmt(s: ts.ExpressionStatement): string {
        // TODO
        let exp = emitExp(s.expression)
        return `${exp}`
    }
    function emitFuncDecl(s: ts.FunctionDeclaration | ts.MethodDeclaration): string[] {
        // TODO
        let paramList: string[] = []

        if (s.kind === ts.SyntaxKind.MethodDeclaration) {
            paramList.push("self")
        }

        paramList = paramList
            .concat(s.parameters.map(emitParamDecl))

        let params = paramList.join(", ")

        let out = []

        out.push(`def ${s.name.getText()}(${params}):`)

        let stmts = s.body.statements
            .map(emitStmt)
            .reduce((p, c) => p.concat(c), [])
            .filter(s => s)
        if (stmts.length) {
            out = out.concat(stmts.map(ind(1)))
        }

        return out
    }
    function emitParamDecl(s: ts.ParameterDeclaration): string {
        // TODO
        let nm = s.name.getText()
        let typ = s.type.getText()
        return `${nm}:${typ}`
    }
    function emitVarDecl(s: ts.VariableDeclaration): string {
        let decl = s.name.getText();
        if (s.initializer) {
            let exp = emitExp(s.initializer);
            return `${decl} = ${exp}`
        } else {
            // TODO can't do declerations without initilization in python
            return ""
        }
    }
    function emitBinExp(s: ts.BinaryExpression): string {
        let left = emitExp(s.left)
        let op = s.operatorToken.getText() // TODO
        let right = emitExp(s.right)
        return `${left} ${op} ${right}`;
    }
    function emitDotExp(s: ts.PropertyAccessExpression): string {
        let left = emitExp(s.expression)
        let right = s.name.getText()
        return `${left}.${right}`;
    }
    function emitCallExp(s: ts.CallExpression): string {
        let fn = emitExp(s.expression)
        let args = s.arguments
            .map(emitExp)
            .join(", ")
        return `${fn}(${args})`
    }
    function emitExp(s: ts.Expression): string {
        switch (s.kind) {
            case ts.SyntaxKind.TrueKeyword:
                return "True"
            case ts.SyntaxKind.FalseKeyword:
                return "False"
            case ts.SyntaxKind.BinaryExpression:
                return emitBinExp(s as ts.BinaryExpression)
            case ts.SyntaxKind.PropertyAccessExpression:
                return emitDotExp(s as ts.PropertyAccessExpression)
            case ts.SyntaxKind.ThisKeyword:
                return "self"
            case ts.SyntaxKind.CallExpression:
                return emitCallExp(s as ts.CallExpression)
            default:
                // TODO(dz) !!
                return s.getText()
        }
    }
}