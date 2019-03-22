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
    // TODO handle types at initialization when ambiguous (e.g. x = [], x = None)

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
            case ts.SyntaxKind.ForOfStatement:
                return emitForOfStmt(s as ts.ForOfStatement)
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
        fromIncl: string,
        toExcl: string
    }
    function isNormalInteger(str: string) {
        let asInt = Math.floor(Number(str));
        return asInt !== Infinity && String(asInt) === str
    }
    function getSimpleForRange(s: ts.ForStatement): RangeItr | null {
        let result: RangeItr = {
            name: null,
            fromIncl: null,
            toExcl: null
        }

        // must be (let i = X; ...)
        if (!s.initializer)
            return null
        if (s.initializer.kind !== ts.SyntaxKind.VariableDeclarationList)
            return null

        let initDecls = s.initializer as ts.VariableDeclarationList
        if (initDecls.declarations.length !== 1)
            return null

        let decl = initDecls.declarations[0]
        result.name = decl.name.getText()

        if (!isConstExp(decl.initializer)) {
            // TODO allow variables?
            // TODO restrict to numbers?
            return null
        }

        let [fromNum, fromNumSup] = emitExp(decl.initializer)
        if (fromNumSup.length)
            return null

        result.fromIncl = fromNum

        // must be (...; i < Y; ...)
        if (!s.condition)
            return null
        if (!ts.isBinaryExpression(s.condition))
            return null
        if (!ts.isIdentifier(s.condition.left))
            return null
        if (s.condition.left.text != result.name)
            return null
        if (!isConstExp(s.condition.right)) {
            // TODO allow variables?
            // TODO restrict to numbers?
            return null
        }
        let [toNum, toNumSup] = emitExp(s.condition.right)
        if (toNumSup.length)
            return null

        result.toExcl = toNum
        if (s.condition.operatorToken.kind === SyntaxKind.LessThanEqualsToken) {
            if (isNormalInteger(toNum))
                result.toExcl = "" + (Number(toNum) + 1)
            else
                result.toExcl += " + 1"
        }
        else if (s.condition.operatorToken.kind !== SyntaxKind.LessThanToken)
            return null

        // must be (...; i++)
        // TODO allow += 1
        if (!s.incrementor)
            return null
        if (!ts.isPostfixUnaryExpression(s.incrementor))
            return null
        if (s.incrementor.operator !== SyntaxKind.PlusPlusToken)
            return null

        // must be X < Y
        if (!(result.fromIncl < result.toExcl))
            return null

        return result
    }
    function emitBody(s: ts.Statement): string[] {
        let body = emitStmt(s)
            .map(indent1)
        if (body.length < 1)
            body = [indent1("pass")]
        return body
    }
    function emitForOfStmt(s: ts.ForOfStatement): string[] {
        if (!ts.isVariableDeclarationList(s.initializer))
            throw Error("Unsupported expression in for..of initializer: " + s.initializer.getText()) // TOOD

        let names = s.initializer.declarations
            .map(d => d.name.getText())
        if (names.length !== 1)
            throw Error("Unsupported multiple declerations in for..of: " + s.initializer.getText()) // TODO
        let name = names[0]

        let [exp, expSup] = emitExp(s.expression)

        let out = expSup
        out.push(`for ${name} in ${exp}:`)

        let body = emitBody(s.statement)

        out = out.concat(body)

        return out
    }
    function emitForStmt(s: ts.ForStatement): string[] {
        let rangeItr = getSimpleForRange(s)
        if (rangeItr) {
            // special case (aka "repeat z times" block):
            // for (let x = y; x < z; x++)
            // ->
            // for x in range(y, z):
            // TODO ensure x and z can't be mutated in the loop body
            let { name, fromIncl, toExcl } = rangeItr;

            let forStmt = fromIncl === "0"
                ? `for ${name} in range(${toExcl}):`
                : `for ${name} in range(${fromIncl}, ${toExcl}):`;

            let body = emitBody(s.statement)

            return [forStmt].concat(body)
        }

        // general case:
        // for (<inits>; <cond>; <updates>)
        // ->
        // <inits>
        // while <cond>:
        //   # body
        //   <updates>
        let out: string[] = []

        // initializer(s)
        if (s.initializer) {
            if (ts.isVariableDeclarationList(s.initializer)) {
                let decls = s.initializer.declarations
                    .map(emitVarDecl)
                    .reduce((p, c) => p.concat(c), [])
                out = out.concat(decls)
            } else {
                let [exp, expSup] = emitExp(s.initializer)
                out = out.concat(expSup).concat([exp])
            }
        }

        // condition(s)
        let cond: string;
        if (s.condition) {
            let [condStr, condSup] = emitExp(s.condition)
            out = out.concat(condSup)
            cond = condStr
        } else {
            cond = "True"
        }
        let whileStmt = `while ${cond}:`
        out.push(whileStmt)

        // body
        let body = emitStmt(s.statement)
            .map(indent1)
        if (body.length === 0 && !s.incrementor)
            body = [indent1("pass")]
        out = out.concat(body)

        // updater(s)
        if (s.incrementor) {
            let [inc, incSup] = emitExp(s.incrementor)
            out = out.concat(incSup)
                .concat([indent1(inc)])
        }

        return out
    }
    function emitIf(s: ts.IfStatement): string[] {
        let { supportStmts, ifStmt, rest } = emitIfHelper(s)
        return supportStmts.concat([ifStmt]).concat(rest)
    }
    function emitIfHelper(s: ts.IfStatement): { supportStmts: string[], ifStmt: string, rest: string[] } {
        let sup: string[] = []

        let [cond, condSup] = emitExp(s.expression)
        sup = sup.concat(condSup)

        let ifStmt = `if ${cond}:`

        let ifRest: string[] = []
        let th = emitStmt(s.thenStatement)
            .map(indent1)
        ifRest = ifRest.concat(th)

        // TODO: handle else if
        // TODO: confirm else works

        if (s.elseStatement) {
            if (ts.isIfStatement(s.elseStatement)) {
                let { supportStmts, ifStmt, rest } = emitIfHelper(s.elseStatement)
                let elif = `el${ifStmt}`
                sup = sup.concat(supportStmts)
                ifRest.push(elif)
                ifRest = ifRest.concat(rest)
            }
            else {
                ifRest.push("else:")
                let el = emitStmt(s.elseStatement)
                    .map(indent1)
                ifRest = ifRest.concat(el)
            }
        }

        return { supportStmts: sup, ifStmt: ifStmt, rest: ifRest };
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
            case ts.SyntaxKind.Constructor:
                return emitFuncDecl(s as ts.ConstructorDeclaration)
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
    function tryEmitIncDecUnaryStmt(s: ts.ExpressionStatement): string[] {
        // special case ++ or -- as a statement
        let e = s.expression;
        if (!ts.isPrefixUnaryExpression(e) &&
            !ts.isPostfixUnaryExpression(e))
            return null
        if (e.operator !== ts.SyntaxKind.MinusMinusToken &&
            e.operator !== ts.SyntaxKind.PlusPlusToken)
            return null

        let [operand, sup] = emitExp(e.operand)
        let incDec = e.operator === ts.SyntaxKind.MinusMinusToken ? " -= 1" : " += 1"

        let out = sup
        out.push(`${operand}${incDec}`)

        return out
    }
    function emitExpStmt(s: ts.ExpressionStatement): string[] {
        let unaryExp = tryEmitIncDecUnaryStmt(s);
        if (unaryExp)
            return unaryExp

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
    function emitFuncDecl(s: ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression | ts.ConstructorDeclaration | ts.ArrowFunction, name: string = null): string[] {
        // TODO emit lambda if no name and body is single line
        // TODO helper function for determining if an expression can be a python expression
        let paramList: string[] = []

        if (s.kind === ts.SyntaxKind.MethodDeclaration ||
            s.kind === ts.SyntaxKind.Constructor) {
            paramList.push("self")
        }

        paramList = paramList
            .concat(s.parameters.map(emitParamDecl))

        let params = paramList.join(", ")

        let out = []

        let fnName: string

        if (s.kind === ts.SyntaxKind.Constructor) {
            fnName = "__init__"
        }
        else {
            fnName = name || s.name.getText()
        }

        out.push(`def ${fnName}(${params}):`)

        let stmts: string[]
        if (ts.isBlock(s.body))
            stmts = emitBlock(s.body)
        else {
            let [exp, sup] = emitExp(s.body)
            stmts = stmts.concat(sup)
            stmts.push(exp)
        }
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
    /// EXPRESSIONS
    ///
    type ExpRes = [/*expression:*/string, /*supportingStatements:*/string[]]
    function asExpRes(str: string): ExpRes {
        return [str, []]
    }
    function emitOp(s: ts.BinaryOperator | ts.PrefixUnaryOperator | ts.PostfixUnaryOperator): string {
        switch (s) {
            case ts.SyntaxKind.BarBarToken:
                return "or"
            case ts.SyntaxKind.AmpersandAmpersandToken:
                return "and"
            case ts.SyntaxKind.ExclamationToken:
                return "not"
            case ts.SyntaxKind.LessThanToken:
                return "<"
            case ts.SyntaxKind.LessThanEqualsToken:
                return "<="
            case ts.SyntaxKind.GreaterThanToken:
                return ">"
            case ts.SyntaxKind.GreaterThanEqualsToken:
                return ">="
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsToken:
                // TODO distinguish === from == ?
                return "=="
            case ts.SyntaxKind.EqualsToken:
                return "="
            case ts.SyntaxKind.PlusToken:
                return "+"
            case ts.SyntaxKind.MinusToken:
                return "-"
            case ts.SyntaxKind.AsteriskToken:
                return "*"
            case ts.SyntaxKind.PlusEqualsToken:
                return "+="
            case ts.SyntaxKind.MinusEqualsToken:
                return "-="
            case ts.SyntaxKind.PercentToken:
                return "%"
            case ts.SyntaxKind.SlashToken:
                return "/"
            case ts.SyntaxKind.PlusPlusToken:
            case ts.SyntaxKind.MinusMinusToken:
                // TODO handle -- generally. Seperate prefix and postfix cases.
                // This is tricky because it needs to return the value and the mutate after.
                throw Error("Unsupported ++ and -- in an expression (not a statement or for loop)")
            case ts.SyntaxKind.AmpersandToken:
                return "&"
            case ts.SyntaxKind.CaretToken:
                return "^"
            case ts.SyntaxKind.LessThanLessThanToken:
                return "<<"
            case ts.SyntaxKind.GreaterThanGreaterThanToken:
                return ">>"
            case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                throw Error("Unsupported operator: >>>")
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
        if (right === "length") {
            // TODO confirm the type is correct!
            return [`len(${left})`, leftSup]
        }
        else {
            return [`${left}.${right}`, leftSup];
        }
    }
    function emitCallExp(s: ts.CallExpression | ts.NewExpression): ExpRes {
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
    function emitFnExp(s: ts.FunctionExpression | ts.ArrowFunction): ExpRes {
        // TODO handle case if body is only 1 line
        let fnName = nextFnName()
        let fnDef = emitFuncDecl(s, fnName)

        return [fnName, fnDef]
    }
    function getUnaryOpSpacing(s: ts.SyntaxKind): string {
        switch (s) {
            case ts.SyntaxKind.ExclamationToken: // not
                return " "
            case ts.SyntaxKind.PlusToken:
            case ts.SyntaxKind.MinusToken:
                return ""
            default:
                return " "
        }
    }
    function emitPreUnaryExp(s: ts.PrefixUnaryExpression): ExpRes {
        let op = emitOp(s.operator);
        let [exp, expSup] = emitExp(s.operand)
        // TODO handle order-of-operations ? parenthesis?
        let space = getUnaryOpSpacing(s.operator)
        let res = `${op}${space}${exp}`
        return [res, expSup]
    }
    function emitPostUnaryExp(s: ts.PostfixUnaryExpression): ExpRes {
        let op = emitOp(s.operator);
        let [exp, expSup] = emitExp(s.operand)
        // TODO handle order-of-operations ? parenthesis?
        let space = getUnaryOpSpacing(s.operator)
        let res = `${exp}${space}${op}`
        return [res, expSup]
    }
    function emitArrayLitExp(s: ts.ArrayLiteralExpression): ExpRes {
        let els = s.elements
            .map(emitExp);
        let sup = els
            .map(([_, sup]) => sup)
            .reduce((p, c) => p.concat(c), [])
        let inner = els
            .map(([e, _]) => e)
            .join(", ")
        let exp = `[${inner}]`
        return [exp, sup]
    }
    function emitElAccessExp(s: ts.ElementAccessExpression): ExpRes {
        let [left, leftSup] = emitExp(s.expression)
        let [arg, argSup] = emitExp(s.argumentExpression)
        let sup = leftSup.concat(argSup)
        let exp = `${left}[${arg}]`
        return [exp, sup]
    }
    function emitParenthesisExp(s: ts.ParenthesizedExpression): ExpRes {
        let [inner, innerSup] = emitExp(s.expression)
        return [`(${inner})`, innerSup]
    }
    function emitMultiLnStrLitExp(s: ts.NoSubstitutionTemplateLiteral): ExpRes {
        return asExpRes(`"""${s.text}"""`)
    }
    function emitIdentifierExp(s: ts.Identifier): ExpRes {
        let id = s.text;
        if (id == "undefined")
            return asExpRes("None")
        return asExpRes(id);
    }
    function isConstExp(s: ts.Expression): boolean {
        // TODO be more precise
        if (ts.isBinaryExpression(s)) {
            return isConstExp(s.left) && isConstExp(s.right)
        } else if (ts.isPropertyAccessExpression(s)) {
            return isConstExp(s.expression)
        } else if (ts.isPrefixUnaryExpression(s) || ts.isPostfixUnaryExpression(s)) {
            return s.operator !== ts.SyntaxKind.PlusPlusToken
                && s.operator !== ts.SyntaxKind.MinusMinusToken
                && isConstExp(s.operand)
        } else if (ts.isParenthesizedExpression(s)) {
            return isConstExp(s.expression)
        } else if (ts.isArrayLiteralExpression(s)) {
            return s.elements
                .map(isConstExp)
                .reduce((p, c) => p && c, true)
        } else if (ts.isElementAccessExpression(s)) {
            return isConstExp(s.expression)
                && (!s.argumentExpression || isConstExp(s.argumentExpression))
        }

        switch (s.kind) {
            case ts.SyntaxKind.TrueKeyword:
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.NullKeyword:
            case ts.SyntaxKind.UndefinedKeyword:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                return true
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.ThisKeyword:
                return false
        }

        return false
    }
    function emitExp(s: ts.Expression): ExpRes {
        switch (s.kind) {
            case ts.SyntaxKind.BinaryExpression:
                return emitBinExp(s as ts.BinaryExpression)
            case ts.SyntaxKind.PropertyAccessExpression:
                return emitDotExp(s as ts.PropertyAccessExpression)
            case ts.SyntaxKind.CallExpression:
                return emitCallExp(s as ts.CallExpression)
            case ts.SyntaxKind.NewExpression:
                return emitCallExp(s as ts.NewExpression)
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
                return emitFnExp(s as ts.FunctionExpression | ts.ArrowFunction)
            case ts.SyntaxKind.PrefixUnaryExpression:
                return emitPreUnaryExp(s as ts.PrefixUnaryExpression);
            case ts.SyntaxKind.PostfixUnaryExpression:
                return emitPostUnaryExp(s as ts.PostfixUnaryExpression);
            case ts.SyntaxKind.ParenthesizedExpression:
                return emitParenthesisExp(s as ts.ParenthesizedExpression)
            case ts.SyntaxKind.ArrayLiteralExpression:
                return emitArrayLitExp(s as ts.ArrayLiteralExpression)
            case ts.SyntaxKind.ElementAccessExpression:
                return emitElAccessExp(s as ts.ElementAccessExpression)
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                return emitMultiLnStrLitExp(s as ts.NoSubstitutionTemplateLiteral)
            case ts.SyntaxKind.TrueKeyword:
                return asExpRes("True")
            case ts.SyntaxKind.FalseKeyword:
                return asExpRes("False")
            case ts.SyntaxKind.ThisKeyword:
                return asExpRes("self")
            case ts.SyntaxKind.NullKeyword:
            case ts.SyntaxKind.UndefinedKeyword:
                return asExpRes("None")
            case ts.SyntaxKind.Identifier:
                return emitIdentifierExp(s as ts.Identifier)
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
                // TODO handle weird syntax?
                return asExpRes(s.getText())
            default:
                // TODO handle more expressions
                // return asExpRes(s.getText())
                // throw Error("Unknown expression: " + s.kind)
                return [s.getText(), ["# unknown expression:  " + s.kind]]
        }
    }
}