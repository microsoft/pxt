namespace pxt.py {
    export function decompileToPython(program: ts.Program, filename: string): pxtc.CompileResult {
        try {
            let res = decompileToPythonHelper(program, filename)
            return res
        } catch (e) {
            pxt.reportException(e);
            // TODO better reporting
            let res = emptyResult()
            res.success = false
            return res
        }
    }
    export function decompileToPythonHelper(program: ts.Program, filename: string): pxtc.CompileResult {
        let result = emptyResult()
        let output = tsToPy(program, filename)
        let outFilename = filename.replace(/(\.py)?\.\w*$/i, '') + '.py'
        result.outfiles[outFilename] = output;
        return result
    }
    function emptyResult(): pxtc.CompileResult {
        return {
            blocksInfo: null,
            outfiles: {},
            diagnostics: [],
            success: true,
            times: {}
        }
    }
}

///
/// UTILS
///
const INDENT = "  "
function indent(lvl: number): (s: string) => string {
    return s => `${INDENT.repeat(lvl)}${s}`
}
const indent1 = indent(1)

// TODO map names from camel case to snake case
// TODO disallow keywords & builtins (e.g. "range", "print")
// TODO handle shadowing
// TODO handle types at initialization when ambiguous (e.g. x = [], x = None)

interface Scope {
    vars: pxt.Map<ts.Node>
}

function tsToPy(prog: ts.Program, filename: string): string {
    // state
    // TODO pass state explicitly
    let nextFnNum = 0
    let global: Scope = { vars: {} } // TODO populate global scope
    let env: Scope[] = [global]

    // helpers
    let tc = prog.getTypeChecker()
    let lhost = new ts.pxtc.LSHost(prog)
    // let ls = ts.createLanguageService(lhost) // TODO
    let file = prog.getSourceFile(filename)
    let renameMap = ts.pxtc.decompiler.buildRenameMap(prog, file)

    // ts->py 
    return emitFile(file)
    ///
    /// ENVIRONMENT
    ///
    // TODO: it's possible this parallel scope construction isn't necessary if we can get the info we need from the TS semantic info
    function pushScope(): Scope {
        let newScope = mkScope()
        env.unshift(newScope)
        return newScope
        function mkScope(): Scope {
            return { vars: {} }
        }
    }
    function popScope(): Scope {
        return env.shift()
    }
    function getName(name: ts.Identifier | ts.BindingPattern | ts.PropertyName) {
        if (!ts.isIdentifier(name))
            throw Error("Unsupported advanced name format: " + name.getText())
        if (renameMap) {
            const rename = renameMap.getRenameForPosition(name.getStart());
            if (rename) {
                return rename.name;
            }
        }
        return name.text;
    }
    // TODO decide on strategy for tracking variable scope(s)
    // function introVar(name: string, decl: ts.Node): string {
    //     let scope = env[0]
    //     let maxItr = 100
    //     let newName = name
    //     for (let i = 0; i < maxItr && newName in scope.vars; i++) {
    //         let matches = newName.match(/\d+$/);
    //         if (matches) {
    //             let num = parseInt(matches[0], 10)
    //             num++
    //             newName = newName.replace(/\d+$/, num.toString())
    //         } else {
    //             newName += 1
    //         }
    //     }
    //     if (newName in scope.vars)
    //         throw Error("Implementation error: unable to find an alternative variable name for: " + newName)
    //     if (newName !== name) {
    //         // do rename
    //         let locs = ls.findRenameLocations(filename, decl.pos + 1, false, false)
    //         for (let l of locs) {
    //             // ts.getNode

    //         }
    //     }
    //     scope.vars[newName] = decl
    //     return newName
    // }

    ///
    /// TYPE UTILS
    ///
    function hasTypeFlag(t: ts.Type, fs: ts.TypeFlags) {
        return (t.flags & fs) !== 0
    }
    function isType(s: ts.Expression, fs: ts.TypeFlags): boolean {
        let type = tc.getTypeAtLocation(s)
        return hasTypeFlag(type, fs)
    }
    function isStringType(s: ts.Expression): boolean {
        return isType(s, ts.TypeFlags.StringLike)
    }
    function isNumberType(s: ts.Expression): boolean {
        return isType(s, ts.TypeFlags.NumberLike)
    }

    ///
    /// NEWLINES, COMMENTS, and WRAPPERS
    ///
    function emitFile(file: ts.SourceFile): string {
        // emit file
        let outLns = file.getChildren()
            .map(emitNode)
            .reduce((p, c) => p.concat(c), [])
            .join("\n")

        return outLns
    }
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

        if (s.getLeadingTriviaWidth() > 0) {
            let leading = s.getFullText().slice(0, s.getLeadingTriviaWidth())
            let lns = leading.split("\n")
            type TriviaLine = "unknown" | "blank" | ["comment", string]
            const getTriviaLine = (s: string): TriviaLine => {
                let trimmed = s.trim()
                if (!trimmed)
                    return "blank"
                if (!trimmed.startsWith("//"))
                    return "unknown"
                let com = "#" + trimmed.slice(2, trimmed.length)
                return ["comment", com]
            }
            let trivia = lns
                .map(getTriviaLine)
                .filter(s => s !== "unknown")
                .map(s => s === "blank" ? "" : s[1])
            if (trivia && !trivia[0])
                trivia.shift()
            if (trivia && !trivia[trivia.length - 1])
                trivia.pop()
            out = out.concat(trivia)
        }

        out = out.concat(emitStmt(s))

        return out;
    }

    ///
    /// STATEMENTS
    ///
    function emitStmt(s: ts.Statement): string[] {
        if (ts.isVariableStatement(s)) {
            return emitVarStmt(s)
        } else if (ts.isClassDeclaration(s)) {
            return emitClassStmt(s)
        } else if (ts.isEnumDeclaration(s)) {
            return emitEnumStmt(s)
        } else if (ts.isExpressionStatement(s)) {
            return emitExpStmt(s)
        } else if (ts.isFunctionDeclaration(s)) {
            return emitFuncDecl(s)
        } else if (ts.isIfStatement(s)) {
            return emitIf(s)
        } else if (ts.isForStatement(s)) {
            return emitForStmt(s)
        } else if (ts.isForOfStatement(s)) {
            return emitForOfStmt(s)
        } else if (ts.isWhileStatement(s)) {
            return emitWhileStmt(s)
        } else if (ts.isReturnStatement(s)) {
            return emitReturnStmt(s)
        } else if (ts.isBlock(s)) {
            return emitBlock(s)
        } else {
            throw Error(`Not implemented: statement kind ${s.kind}`);
        }
    }
    function emitReturnStmt(s: ts.ReturnStatement): string[] {
        if (!s.expression)
            return ['return']

        let [exp, expSup] = emitExp(s.expression)
        let stmt = `return ${exp}`
        return expSup.concat([stmt])
    }
    function emitWhileStmt(s: ts.WhileStatement): string[] {
        let [cond, condSup] = emitExp(s.expression)
        let body = emitBody(s.statement)
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
        result.name = getName(decl.name)

        if (!isConstExp(decl.initializer) || !isNumberType(decl.initializer)) {
            // TODO allow variables?
            // TODO restrict to numbers?
            return null
        }

        let [fromNum, fromNumSup] = emitExp(decl.initializer)
        if (fromNumSup.length)
            return null

        result.fromIncl = fromNum

        // TODO body must not mutate loop variable

        // must be (...; i < Y; ...)
        if (!s.condition)
            return null
        if (!ts.isBinaryExpression(s.condition))
            return null
        if (!ts.isIdentifier(s.condition.left))
            return null
        if (s.condition.left.text != result.name)
            return null
        if (!isConstExp(s.condition.right) || !isNumberType(s.condition.right)) {
            // TODO allow variables?
            // TODO restrict to numbers?
            return null
        }
        let [toNum, toNumSup] = emitExp(s.condition.right)
        if (toNumSup.length)
            return null

        result.toExcl = toNum
        if (s.condition.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken) {
            if (isNormalInteger(toNum))
                result.toExcl = "" + (Number(toNum) + 1)
            else
                result.toExcl += " + 1"
        }
        else if (s.condition.operatorToken.kind !== ts.SyntaxKind.LessThanToken)
            return null

        // must be (...; i++)
        // TODO allow += 1
        if (!s.incrementor)
            return null
        if (!ts.isPostfixUnaryExpression(s.incrementor)
            && !ts.isPrefixUnaryExpression(s.incrementor))
            return null
        if (s.incrementor.operator !== ts.SyntaxKind.PlusPlusToken)
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
            .map(d => getName(d.name))
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
            let unaryIncDec = tryEmitIncDecUnaryStmt(s.incrementor)
            if (unaryIncDec) {
                // special case: ++ or --
                out = out.concat(unaryIncDec.map(indent1))
            }
            else {
                // general case
                let [inc, incSup] = emitExp(s.incrementor)
                out = out.concat(incSup)
                    .concat([indent1(inc)])
            }
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
        let th = emitBody(s.thenStatement)
        ifRest = ifRest.concat(th)

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
                let el = emitBody(s.elseStatement)
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
        let name = getName(s.name)
        if (isEnum)
            out.push(`class ${name}(Enum):`)
        else
            out.push(`class ${name}:`)

        let mems = s.members
            .map(emitClassMem)
            .reduce((p, c) => p.concat(c), [])
            .filter(m => m)
        if (mems.length) {
            out = out.concat(mems.map(indent1))
        }

        return out;
    }
    function emitEnumStmt(s: ts.EnumDeclaration): string[] {
        let out: string[] = []

        out.push(`class ${getName(s.name)}(Enum):`)

        let allInit = s.members
            .every(m => !!m.initializer)
        let noInit = !s.members
            .every(m => !!m.initializer)

        if (!allInit && !noInit)
            throw Error("Unsupported enum decleration: has mixture of explicit and implicit initialization") // TODO

        if (allInit) {
            let memAndSup = s.members
                .map(m => [m, emitExp(m.initializer)] as [ts.EnumMember, ExpRes])
            throw Error("Unsupported: explicit enum initialization") // TODO
        }

        let val = 0
        for (let m of s.members) {
            out.push(indent1(`${getName(m.name)} = ${val++}`))
        }

        return out
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
        let nm = getName(s.name)
        if (s.initializer) {
            let [init, initSup] = emitExp(s.initializer)
            return initSup.concat([`${nm} = ${init}`])
        }
        else {
            // can't do declerations without initilization in python
            return []
        }
    }
    function isUnaryPlusPlusOrMinusMinus(e: ts.Expression): e is ts.PrefixUnaryExpression | ts.PostfixUnaryExpression {
        if (!ts.isPrefixUnaryExpression(e) &&
            !ts.isPostfixUnaryExpression(e))
            return false
        if (e.operator !== ts.SyntaxKind.MinusMinusToken &&
            e.operator !== ts.SyntaxKind.PlusPlusToken)
            return false
        return true
    }
    function tryEmitIncDecUnaryStmt(e: ts.Expression): string[] {
        // special case ++ or -- as a statement
        if (!isUnaryPlusPlusOrMinusMinus(e))
            return null

        let [operand, sup] = emitExp(e.operand)
        let incDec = e.operator === ts.SyntaxKind.MinusMinusToken ? " -= 1" : " += 1"

        let out = sup
        out.push(`${operand}${incDec}`)

        return out
    }
    function emitExpStmt(s: ts.ExpressionStatement): string[] {
        let unaryExp = tryEmitIncDecUnaryStmt(s.expression);
        if (unaryExp)
            return unaryExp

        let [exp, expSup] = emitExp(s.expression)
        return expSup.concat([`${exp}`])
    }
    function emitBlock(s: ts.Block): string[] {
        let stmts = s.getChildren()
            .map(emitNode)
            .reduce((p, c) => p.concat(c), [])
        // TODO figuring out variable scoping..
        // let syms = tc.getSymbolsInScope(s, ts.SymbolFlags.Variable)
        // let symTxt = "#ts@ " + syms.map(s => s.name).join(", ")
        // stmts.unshift(symTxt)
        // stmts.unshift("# {") // TODO
        // let pyVars = "#py@ " + Object.keys(env[0].vars).join(", ")
        // stmts.push(pyVars)
        // stmts.push("# }")
        return stmts
    }
    function emitFuncDecl(s: ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression | ts.ConstructorDeclaration | ts.ArrowFunction, name: string = null): string[] {
        // TODO determine captured variables, then determine global and nonlocal directives
        // TODO helper function for determining if an expression can be a python expression
        let paramList: string[] = []

        if (s.kind === ts.SyntaxKind.MethodDeclaration ||
            s.kind === ts.SyntaxKind.Constructor) {
            paramList.push("self")
        }

        paramList = paramList
            .concat(s.parameters.map(p => emitParamDecl(p)))

        let params = paramList.join(", ")

        let out = []

        let fnName: string

        if (s.kind === ts.SyntaxKind.Constructor) {
            fnName = "__init__"
        }
        else {
            fnName = name || getName(s.name)
        }

        out.push(`def ${fnName}(${params}):`)

        pushScope() // functions start a new scope in python

        let stmts: string[] = []
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

        popScope()

        return out
    }
    function emitParamDecl(s: ts.ParameterDeclaration, inclTypesIfAvail = true): string {
        let nm = getName(s.name)
        if (s.type && inclTypesIfAvail) {
            let typ = s.type.getText()
            return `${nm}:${typ}`
        } else {
            return nm
        }
    }
    function emitVarDecl(s: ts.VariableDeclaration): string[] {
        let out: string[] = []
        let varNm = getName(s.name);
        // out.push(`#let ${varNm}`) // TODO debug
        // varNm = introVar(varNm, s.name)
        if (s.initializer) {
            // TODO
            // let syms = tc.getSymbolsInScope(s, ts.SymbolFlags.Variable)
            // let symTxt = "#@ " + syms.map(s => s.name).join(", ")
            // out.push(symTxt)
            let [exp, expSup] = emitExp(s.initializer);
            out = out.concat(expSup)
            let declStmt: string;
            if (s.type) {
                declStmt = `${varNm}: ${s.type.getText()} = ${exp}`
            } else {
                declStmt = `${varNm} = ${exp}`
            }
            out.push(declStmt)
            return out
        } else {
            // can't do declerations without initilization in python
        }
        return out
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
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsToken:
                // TODO distinguish !== from != ?
                return "!="
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
                // TODO handle "--" & "++" generally. Seperate prefix and postfix cases.
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
        // handle string concatenation
        // TODO handle implicit type conversions more generally
        let isLStr = isStringType(s.left)
        let isRStr = isStringType(s.right)
        let isStrConcat = s.operatorToken.kind === ts.SyntaxKind.PlusToken
            && (isLStr || isRStr)
        let wrap = (s: string) => `str(${s})`

        let [left, leftSup] = emitExp(s.left)
        if (isStrConcat && !isLStr)
            left = wrap(left)

        let op = emitOp(s.operatorToken.kind)

        let [right, rightSup] = emitExp(s.right)
        if (isStrConcat && !isRStr)
            right = wrap(right)
        let sup = leftSup.concat(rightSup)

        return [`${left} ${op} ${right}`, sup];
    }
    function emitDotExp(s: ts.PropertyAccessExpression): ExpRes {
        let [left, leftSup] = emitExp(s.expression)
        let right = getName(s.name)
        // special: foo.length
        if (right === "length") {
            // TODO confirm the type is correct!
            return [`len(${left})`, leftSup]
        }
        // special casing
        // TODO make this safer. This is syntactic matching, but we really need semantics
        if (left === "Math") {
            let mathFn = ""
            if (right === "max") {
                mathFn = "max"
            } else if (right === "min") {
                mathFn = "min"
            } else if (right === "randomRange") {
                mathFn = "random.randint"
            } else {
                throw Error(`Unsupported math fn: ${left}.${right}`);
            }
            return [mathFn, leftSup]
        } else if (left === "console") {
            if (right === "log") {
                return ["print", leftSup]
            }
        }

        return [`${left}.${right}`, leftSup];
    }
    function emitCallExp(s: ts.CallExpression | ts.NewExpression): ExpRes {
        // TODO inspect type info to rewrite things like console.log, Math.max, etc.
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
    function nextFnName() {
        // TODO ensure uniqueness
        // TODO add sync lock
        // TODO infer friendly name from context
        return `function_${nextFnNum++}`
    }
    function emitFnExp(s: ts.FunctionExpression | ts.ArrowFunction): ExpRes {
        // if the anonymous function is simple enough, use a lambda
        if (!ts.isBlock(s.body)) {
            // TODO this speculation is only safe if emitExp is pure. It's not quite today (e.g. nextFnNumber)
            let [fnBody, fnSup] = emitExp(s.body as ts.Expression)
            if (fnSup.length === 0) {
                let paramList = s.parameters
                    .map(p => emitParamDecl(p, false))
                    .join(", ");

                let stmt = paramList.length
                    ? `lambda ${paramList}: ${fnBody}`
                    : `lambda: ${fnBody}`;
                return asExpRes(stmt)
            }
        }

        let fnName = s.name ? getName(s.name) : nextFnName()
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
    function emitMultiLnStrLitExp(s: ts.NoSubstitutionTemplateLiteral | ts.TaggedTemplateExpression): ExpRes {
        if (ts.isNoSubstitutionTemplateLiteral(s))
            return asExpRes(`"""${s.text}"""`)

        let [tag, tagSup] = emitExp(s.tag)
        let [temp, tempSup] = emitExp(s.template)
        let sup = tagSup.concat(tempSup)
        let exp = `${tag}(${temp})`;
        return [exp, sup]
    }
    function emitIdentifierExp(s: ts.Identifier): ExpRes {
        // TODO disallow keywords and built-ins? 
        // TODO why isn't undefined showing up as a keyword?
        // let id = s.text;
        if (s.text == "undefined")
            return asExpRes("None")
        let name = getName(s)
        return asExpRes(name);
    }
    function visitExp(s: ts.Expression, fn: (e: ts.Expression) => boolean): boolean {
        let visitRecur = (s: ts.Expression) =>
            visitExp(s, fn)

        if (ts.isBinaryExpression(s)) {
            return visitRecur(s.left) && visitRecur(s.right)
        } else if (ts.isPropertyAccessExpression(s)) {
            return visitRecur(s.expression)
        } else if (ts.isPrefixUnaryExpression(s) || ts.isPostfixUnaryExpression(s)) {
            return s.operator !== ts.SyntaxKind.PlusPlusToken
                && s.operator !== ts.SyntaxKind.MinusMinusToken
                && visitRecur(s.operand)
        } else if (ts.isParenthesizedExpression(s)) {
            return visitRecur(s.expression)
        } else if (ts.isArrayLiteralExpression(s)) {
            return s.elements
                .map(visitRecur)
                .reduce((p, c) => p && c, true)
        } else if (ts.isElementAccessExpression(s)) {
            return visitRecur(s.expression)
                && (!s.argumentExpression || visitRecur(s.argumentExpression))
        }

        return fn(s)
    }
    function isConstExp(s: ts.Expression): boolean {
        let isConst = (s: ts.Expression): boolean => {
            switch (s.kind) {
                case ts.SyntaxKind.PropertyAccessExpression:
                case ts.SyntaxKind.BinaryExpression:
                case ts.SyntaxKind.ParenthesizedExpression:
                case ts.SyntaxKind.ArrayLiteralExpression:
                case ts.SyntaxKind.ElementAccessExpression:
                case ts.SyntaxKind.TrueKeyword:
                case ts.SyntaxKind.FalseKeyword:
                case ts.SyntaxKind.NullKeyword:
                case ts.SyntaxKind.UndefinedKeyword:
                case ts.SyntaxKind.NumericLiteral:
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                    return true
                case ts.SyntaxKind.CallExpression:
                case ts.SyntaxKind.NewExpression:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.Identifier:
                case ts.SyntaxKind.ThisKeyword:
                    return false
                case ts.SyntaxKind.PrefixUnaryExpression:
                case ts.SyntaxKind.PostfixUnaryExpression:
                    let e = s as ts.PrefixUnaryExpression | ts.PostfixUnaryExpression
                    return e.operator !== ts.SyntaxKind.PlusPlusToken
                        && e.operator !== ts.SyntaxKind.MinusMinusToken
            }
            return false
        }
        return visitExp(s, isConst)
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
            case ts.SyntaxKind.TaggedTemplateExpression:
                return emitMultiLnStrLitExp(s as ts.TaggedTemplateExpression)
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
                return [s.getText(), ["# unknown expression:  " + s.kind]] // uncomment for easier locating
            // throw Error("Unknown expression: " + s.kind)
        }
    }
}