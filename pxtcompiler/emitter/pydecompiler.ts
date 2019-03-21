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

        let outLns = file.getChildren()
            .map(emitNode)
            .reduce((p, c) => p.concat(c), [])

        let output = outLns.join("\n");

        result.outfiles[file.fileName.replace(/(\.py)?\.\w*$/i, '') + '.py'] = output;

        return result
    }

    ///
    /// SUPPORT
    ///
    const INDENT = "  "
    function indent(lvl: number): (s: string) => string {
        return s => `${INDENT.repeat(lvl)}${s}`
    }
    const indent1 = indent(1)

    ///
    /// NODES & CRUFT
    ///
    function emitNode(s: ts.Node): string[] {
        switch (s.kind) {
            case ts.SyntaxKind.SyntaxList:
                return (s as ts.SyntaxList)._children
                    .map(emitNode)
                    .reduce((p, c) => p.concat(c), [])
            case ts.SyntaxKind.EndOfFileToken:
            case ts.SyntaxKind.OpenBraceToken:
            case ts.SyntaxKind.CloseBraceToken:
                return []
            default:
                return emitStmtWithNewlines(s as ts.Statement)
        }
    }
    function emitStmtWithNewlines(s: ts.Statement): string[] {
        let out: string[] = [];

        let leadingNewlines = 0
        if (s.getLeadingTriviaWidth() > 0) {
            let leading = s.getFullText().slice(0, s.getLeadingTriviaWidth())
            leadingNewlines = leading.split("\n").length - 2; // expect 1 newline, anything more is a blank line
        }
        for (let i = 0; i < leadingNewlines; i++)
            out.push("")

        out = out.concat(emitStmt(s))

        return out;
    }

    ///
    /// STATEMENTS
    ///
    function emitStmt(s: ts.Statement): string[] {
        // TODO(dz): why does the type system not recognize this as discriminated unions?
        switch (s.kind) {
            case ts.SyntaxKind.VariableStatement:
                return emitVarStmt(s as ts.VariableStatement)
            case ts.SyntaxKind.ClassDeclaration:
                return emitClassStmt(s as ts.ClassDeclaration)
            case ts.SyntaxKind.ExpressionStatement:
                return emitExpStmt(s as ts.ExpressionStatement)
            case ts.SyntaxKind.FunctionDeclaration:
                return emitFuncDecl(s as ts.FunctionDeclaration)
            case ts.SyntaxKind.IfStatement:
                return emitIf(s as ts.IfStatement)
            case ts.SyntaxKind.ForStatement:
                return emitForStmt(s as ts.ForStatement)
            case ts.SyntaxKind.Block:
                let block = s as ts.Block
                return block.getChildren()
                    .map(emitNode)
                    .reduce((p, c) => p.concat(c), [])
            default:
                throw Error(`Not implemented: statement kind ${s.kind}`);
        }
    }
    function emitForStmt(s: ts.ForStatement): string[] {
        // special case:
        // for (let x = y; x < z; x++)
        // ->
        // for x in range(y, z):
        // TODO:
        // - ensure x and z can't be mutated in the loop body

        // general case:
        // for (<decls>; <cond>; <updates>)
        // ->
        // <decls>
        // while <cond>:
        //   # body
        //   <updates>

        return ["four!"]
    }
    function emitIf(s: ts.IfStatement): string[] {
        let [cond, condSup] = emitExp(s.expression)
        let out = condSup.concat([`if ${cond}:`])

        let th = emitStmt(s.thenStatement)
            .map(indent1)
        out = out.concat(th)

        // TODO: handle else if
        // TODO: confirm else works

        if (s.elseStatement) {
            out.push("else:")
            let el = emitStmt(s.elseStatement)
                .map(indent1)
            out = out.concat(el)
        }

        return out;
    }
    function emitVarStmt(s: ts.VariableStatement): string[] {
        let decls = s.declarationList.declarations;
        return decls
            .map(emitVarDecl)
            .reduce((p, c) => p.concat(c), [])
    }
    // TODO map names from camel case to snake case
    function emitClassStmt(s: ts.ClassDeclaration): string[] {
        let out: string[] = []

        // TODO handle inheritence

        let isEnum = s.members.every(isEnumMem) // TODO hack?
        if (isEnum)
            out.push(`class ${s.name.getText()}(Enum):`)
        else
            out.push(`class ${s.name.getText()}:`)

        let mems = s.members
            .map(emitClassMem)
            .reduce((p, c) => p.concat(c), [])
            .filter(m => m)
        if (mems.length) {
            out = out.concat(mems.map(indent1))
        }

        return out;
    }
    function isEnumMem(s: ts.ClassElement): boolean {
        if (s.kind !== ts.SyntaxKind.PropertyDeclaration)
            return false
        let prop = s as ts.PropertyDeclaration
        if (!prop.modifiers || prop.modifiers.length !== 1)
            return false
        for (let mod of prop.modifiers)
            if (mod.kind !== ts.SyntaxKind.StaticKeyword)
                return false;
        if (prop.initializer.kind !== ts.SyntaxKind.NumericLiteral)
            return false;

        return true
    }
    function emitClassMem(s: ts.ClassElement): string[] {
        switch (s.kind) {
            case ts.SyntaxKind.PropertyDeclaration:
                return emitPropDecl(s as ts.PropertyDeclaration)
            case ts.SyntaxKind.MethodDeclaration:
                return emitFuncDecl(s as ts.MethodDeclaration)
            default:
                return ["UNKNOWN ClassElement " + s.kind]
        }
    }
    function emitPropDecl(s: ts.PropertyDeclaration): string[] {
        // TODO(dz)
        let nm = s.name.getText()
        if (s.initializer) {
            let [init, initSup] = emitExp(s.initializer)
            return initSup.concat([`${nm} = ${init}`])
        }
        else {
            // can't do declerations without initilization in python
            return []
        }
    }
    function emitExpStmt(s: ts.ExpressionStatement): string[] {
        // TODO
        let [exp, expSup] = emitExp(s.expression)
        return expSup.concat([`${exp}`])
    }
    function emitBlock(s: ts.Block): string[] {
        let stmts = s.statements
            .map(emitStmt)
            .reduce((p, c) => p.concat(c), [])
            .filter(s => s)
        return stmts
    }
    function emitFuncDecl(s: ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression, name: string = null): string[] {
        // TODO
        let paramList: string[] = []

        if (s.kind === ts.SyntaxKind.MethodDeclaration) {
            paramList.push("self")
        }

        paramList = paramList
            .concat(s.parameters.map(emitParamDecl))

        let params = paramList.join(", ")

        let out = []

        let fnName = name || s.name.getText()
        out.push(`def ${fnName}(${params}):`)

        let stmts = emitBlock(s.body)
        if (stmts.length) {
            out = out.concat(stmts.map(indent1))
        } else {
            out.push(indent1("pass")) // cannot have an empty body
        }

        return out
    }
    function emitParamDecl(s: ts.ParameterDeclaration): string {
        // TODO
        let nm = s.name.getText()
        let typ = s.type.getText()
        return `${nm}:${typ}`
    }
    function emitVarDecl(s: ts.VariableDeclaration): string[] {
        let decl = s.name.getText();
        if (s.initializer) {
            let [exp, expSup] = emitExp(s.initializer);
            let declStmt = `${decl} = ${exp}`
            return expSup.concat(declStmt)
        } else {
            // can't do declerations without initilization in python
            return []
        }
    }

    ///
    /// EXPRESIONS
    ///
    type ExpRes = [/*expresion:*/string, /*supportingStatements:*/string[]]
    function asExpRes(str: string): ExpRes {
        return [str, []]
    }
    function emitBinExp(s: ts.BinaryExpression): ExpRes {
        let [left, leftSup] = emitExp(s.left)
        let op = s.operatorToken.getText() // TODO translate operators
        let [right, rightSup] = emitExp(s.right)
        let sup = leftSup.concat(rightSup)
        return [`${left} ${op} ${right}`, sup];
    }
    function emitDotExp(s: ts.PropertyAccessExpression): ExpRes {
        let [left, leftSup] = emitExp(s.expression)
        let right = s.name.getText()
        return [`${left}.${right}`, leftSup];
    }
    function emitCallExp(s: ts.CallExpression): ExpRes {
        let [fn, fnSup] = emitExp(s.expression)
        let argExps = s.arguments
            .map(emitExp)
        let args = argExps
            .map(([a, aSup]) => a)
            .join(", ")
        let sup = argExps
            .map(([a, aSup]) => aSup)
            .reduce((p, c) => p.concat(c), fnSup)
        return [`${fn}(${args})`, sup]
    }

    let nextFnNum = 0
    function nextFnName() {
        // TODO ensure uniqueness
        // TODO add sync lock
        return `function_${nextFnNum++}`
    }
    function emitFnExp(s: ts.FunctionExpression): ExpRes {
        // TODO handle case if body is only 1 line
        let fnName = nextFnName()
        let fnDef = emitFuncDecl(s, fnName)

        return [fnName, fnDef]
    }
    function emitExp(s: ts.Expression): ExpRes {
        switch (s.kind) {
            case ts.SyntaxKind.BinaryExpression:
                return emitBinExp(s as ts.BinaryExpression)
            case ts.SyntaxKind.PropertyAccessExpression:
                return emitDotExp(s as ts.PropertyAccessExpression)
            case ts.SyntaxKind.CallExpression:
                return emitCallExp(s as ts.CallExpression)
            case ts.SyntaxKind.FunctionExpression:
                return emitFnExp(s as ts.FunctionExpression)
            case ts.SyntaxKind.TrueKeyword:
                return asExpRes("True")
            case ts.SyntaxKind.FalseKeyword:
                return asExpRes("False")
            case ts.SyntaxKind.ThisKeyword:
                return asExpRes("self")
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.ArrayLiteralExpression:
            default:
                // TODO handle more expressions
                return asExpRes(s.getText())
            // throw Error("Unknown expression: " + s.kind)
        }
    }
}