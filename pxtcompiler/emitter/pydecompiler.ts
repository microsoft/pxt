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

    // TODO map names from camel case to snake case
    // TODO disallow keywords & builtins (e.g. "range", "print")
    // TODO handle shadowing

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
            case ts.SyntaxKind.WhileStatement:
                return emitWhileStmt(s as ts.WhileStatement)
            case ts.SyntaxKind.Block:
                let block = s as ts.Block
                return block.getChildren()
                    .map(emitNode)
                    .reduce((p, c) => p.concat(c), [])
            default:
                throw Error(`Not implemented: statement kind ${s.kind}`);
        }
    }
    function emitWhileStmt(s: ts.WhileStatement): string[] {
        let [cond, condSup] = emitExp(s.expression)
        let body = emitStmt(s.statement)
            .map(indent1)
        let whileStmt = `while ${cond}:`;
        return condSup.concat([whileStmt]).concat(body)
    }
    type RangeItr = {
        name: string,
        fromIncl: number,
        toExcl: number
    }
    function isNormalInteger(str: string) {
        let asInt = Math.floor(Number(str));
        return asInt !== Infinity && String(asInt) === str
    }
    function getSimpleForRange(s: ts.ForStatement): RangeItr | null {
        let result: RangeItr = {
            name: null,
            fromIncl: Infinity,
            toExcl: Infinity
        }

        // must be (let i = X; ...)
        if (s.initializer.kind !== ts.SyntaxKind.VariableDeclarationList)
            return null;

        let initDecls = s.initializer as ts.VariableDeclarationList
        if (initDecls.declarations.length !== 1)
            return null

        let decl = initDecls.declarations[0]
        result.name = decl.name.getText()

        if (!ts.isNumericLiteral(decl.initializer)) {
            // TODO allow variables?
            return null;
        }

        let fromNum = decl.initializer.text
        if (!isNormalInteger(fromNum)) {
            // TODO allow floats?
            return null;
        }

        result.fromIncl = Number(fromNum)

        // must be (...; i < Y; ...)
        if (!ts.isBinaryExpression(s.condition))
            return null
        if (!ts.isIdentifier(s.condition.left))
            return null
        if (s.condition.left.text != result.name)
            return null
        if (!ts.isNumericLiteral(s.condition.right))
            return null;
        let toNum = s.condition.right.text
        if (!isNormalInteger(toNum))
            return null;
        if (s.condition.operatorToken.kind !== SyntaxKind.LessThanToken)
            return null;

        result.toExcl = Number(toNum);

        // must be (...; i++)
        // TODO allow += 1
        if (!ts.isPostfixUnaryExpression(s.incrementor))
            return null
        if (s.incrementor.operator !== SyntaxKind.PlusPlusToken)
            return null

        // must be X < Y
        if (!(result.fromIncl < result.toExcl))
            return null;

        return result
    }
    function emitForStmt(s: ts.ForStatement): string[] {
        let body = emitStmt(s.statement)
            .map(indent1)

        let rangeItr = getSimpleForRange(s)
        if (rangeItr) {
            // special case ("repeat z times" block):
            // for (let x = y; x < z; x++)
            // ->
            // for x in range(y, z):
            // TODO ensure x and z can't be mutated in the loop body
            let { name, fromIncl, toExcl } = rangeItr;

            let forStmt = fromIncl === 0
                ? `for ${name} in range(${toExcl}):`
                : `for ${name} in range(${fromIncl}, ${toExcl}):`;

            return [forStmt].concat(body)
        }

        // general case:
        // for (<decls>; <cond>; <updates>)
        // ->
        // <decls>
        // while <cond>:
        //   # body
        //   <updates>

        return ["# TODO complicated for loop"]
        // throw Error("TODO complicated for loop")
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
                return ["# unknown ClassElement " + s.kind]
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
    function emitOp(s: ts.BinaryOperator): string {
        switch (s) {
            case ts.SyntaxKind.BarBarToken:
                return "or"
            default:
                return "# TODO unknown op: " + s
        }
    }
    function emitBinExp(s: ts.BinaryExpression): ExpRes {
        let [left, leftSup] = emitExp(s.left)
        let op = emitOp(s.operatorToken.kind)
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
    function emitUnaryOp(s: ts.PrefixUnaryOperator | ts.PostfixUnaryOperator): string {
        switch (s) {
            case ts.SyntaxKind.ExclamationToken:
                return "not"
            default:
                return "# TODO unknown unary operator: " + s
        }
    }
    function emitPreUnaryExp(s: ts.PrefixUnaryExpression): ExpRes {
        let op = emitUnaryOp(s.operator);
        let [exp, expSup] = emitExp(s.operand)
        // TODO handle order-of-operations ? parenthesis?
        let res = `${op} ${exp}`
        return [res, expSup]
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
            case ts.SyntaxKind.PrefixUnaryExpression:
                return emitPreUnaryExp(s as ts.PrefixUnaryExpression);
            case ts.SyntaxKind.ParenthesizedExpression:
                let innerExp = (s as ts.ParenthesizedExpression).expression
                let [inner, innerSup] = emitExp(innerExp)
                return [`(${inner})`, innerSup]
            case ts.SyntaxKind.TrueKeyword:
                return asExpRes("True")
            case ts.SyntaxKind.FalseKeyword:
                return asExpRes("False")
            case ts.SyntaxKind.ThisKeyword:
                return asExpRes("self")
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
                // TODO handle weird syntax?
                return asExpRes(s.getText())
            case ts.SyntaxKind.ArrayLiteralExpression:
            default:
                // TODO handle more expressions
                // return asExpRes(s.getText())
                // throw Error("Unknown expression: " + s.kind)
                return [s.getText(), ["# unknown expression: " + s.kind]]
        }
    }
}