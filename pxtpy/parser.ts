// Grammar is here: https://docs.python.org/3/reference/grammar.html

namespace pxt.py {
    let inParens: number
    let tokens: Token[]
    let source: string
    let filename: string
    let nextToken: number
    let currComments: Token[]
    let indentStack: number[]
    let prevToken: Token
    let diags: pxtc.KsDiagnostic[]
    let traceParser = false
    let traceLev = ""

    type Parse = () => AST

    function fakeToken(tp: TokenType, val: string): Token {
        return {
            type: tp,
            value: val,
            startPos: 0,
            endPos: 0
        }
    }

    function traceAST(tp: string, r: AST) {
        if (traceParser) {
            pxt.log(traceLev + tp + ": " + r.kind)
        }
    }

    function peekToken() {
        return tokens[nextToken]
    }

    function skipTokens() {
        for (; tokens[nextToken]; nextToken++) {
            let t = tokens[nextToken]
            if (t.type == TokenType.Comment) {
                currComments.push(t)
                continue
            }

            if (inParens >= 0 && t.type == TokenType.Op)
                switch (t.value) {
                    case "LParen":
                    case "LSquare":
                    case "LBracket":
                        inParens++
                        break
                    case "RParen":
                    case "RSquare":
                    case "RBracket":
                        inParens--
                        break
                }

            if (t.type == TokenType.Error) {
                error(9551, t.value)
                continue
            }

            if (inParens > 0) {
                if (t.type == TokenType.NewLine || t.type == TokenType.Indent)
                    continue
            } else {
                if (t.type == TokenType.Indent) {
                    if (tokens[nextToken + 1].type == TokenType.NewLine) {
                        nextToken++
                        continue // skip empty lines
                    }
                    let curr = parseInt(t.value)
                    let top = indentStack[indentStack.length - 1]
                    if (curr == top)
                        continue
                    else if (curr > top) {
                        indentStack.push(curr)
                        return
                    } else {
                        t.type = TokenType.Dedent
                        let numPop = 0
                        while (indentStack.length) {
                            let top = indentStack[indentStack.length - 1]
                            if (top > curr) {
                                indentStack.pop()
                                numPop++
                            } else {
                                if (top != curr)
                                    error(9552, U.lf("inconsitent indentation"))
                                // in case there is more than one dedent, replicate current dedent token
                                while (numPop > 1) {
                                    tokens.splice(nextToken, 0, t)
                                    numPop--
                                }
                                return
                            }
                        }
                    }
                }
            }
            return
        }
    }

    function shiftToken() {
        prevToken = peekToken()
        if (prevToken.type == TokenType.EOF)
            return
        nextToken++
        skipTokens()
        // console.log(`TOK: ${tokenToString(peekToken())}`)
    }

    // next error 9574 (limit 9599)
    function error(code?: number, msg?: string) {
        if (!msg) msg = U.lf("invalid syntax")
        if (!code) code = 9550

        const tok = peekToken()

        const d: pxtc.KsDiagnostic = {
            code,
            category: pxtc.DiagnosticCategory.Error,
            messageText: U.lf("{0} near {1}", msg, friendlyTokenToString(tok, source)),
            fileName: filename,
            start: tok.startPos,
            length: tok.endPos ? tok.endPos - tok.startPos : 0,
            line: 0,
            column: 0
        }
        patchPosition(d, source)

        if (traceParser)
            pxt.log(`${traceLev}TS${code} ${d.messageText} at ${d.line + 1},${d.column + 1}`)

        diags.push(d)

        if (code != 9572 && diags.length > 100)
            U.userError(U.lf("too many parse errors"))
    }

    function expect(tp: TokenType, val: string) {
        const t = peekToken()
        if (t.type != tp || t.value != val) {
            error(9553, U.lf("expecting {0}", tokenToString(fakeToken(tp, val))))
            if (t.type == TokenType.NewLine)
                return // don't shift
        }
        shiftToken()
    }

    function expectNewline() {
        expect(TokenType.NewLine, "")
    }

    function expectKw(kw: string) {
        expect(TokenType.Keyword, kw)
    }

    function expectOp(op: string) {
        expect(TokenType.Op, op)
    }

    function currentKw() {
        let t = peekToken()
        if (t.type == TokenType.Keyword)
            return t.value
        return ""
    }

    function currentOp() {
        let t = peekToken()
        if (t.type == TokenType.Op)
            return t.value
        return ""
    }

    const compound_stmt_map: Map<() => Stmt> = {
        "if": if_stmt,
        "while": while_stmt,
        "for": for_stmt,
        "try": try_stmt,
        "with": with_stmt,
        "def": funcdef,
        "class": classdef,
    }

    const small_stmt_map: Map<() => Stmt> = {
        "del": del_stmt,
        "pass": pass_stmt,
        "break": break_stmt,
        "continue": continue_stmt,
        "return": return_stmt,
        "raise": raise_stmt,
        "global": global_stmt,
        "nonlocal": nonlocal_stmt,
        "import": import_name,
        "from": import_from,
        "assert": assert_stmt,
        "yield": yield_stmt,
    }

    function colon_suite(): Stmt[] {
        expectOp("Colon")
        return suite()
    }

    function suite(): Stmt[] {
        if (peekToken().type == TokenType.NewLine) {
            const prevTr = traceLev
            if (traceParser) {
                pxt.log(traceLev + "{")
                traceLev += "  "
            }

            shiftToken()
            let level = NaN
            if (peekToken().type != TokenType.Indent) {
                error(9554, U.lf("expecting indent"))
            } else {
                level = parseInt(peekToken().value)
            }
            shiftToken()
            let r = stmt()
            for (; ;) {
                if (peekToken().type == TokenType.Dedent) {
                    const isFinal = (isNaN(level) || parseInt(peekToken().value) < level)
                    shiftToken()
                    if (isFinal)
                        break
                }
                U.pushRange(r, stmt())
            }
            if (traceParser) {
                traceLev = prevTr
                pxt.log(traceLev + "}")
            }
            return r
        } else {
            return simple_stmt()
        }
    }

    function mkAST(kind: string, beg?: Token): AST {
        let t = beg || peekToken()
        return {
            startPos: t.startPos,
            endPos: t.endPos,
            kind
        }
    }

    function finish<T extends AST>(v: T): T {
        v.endPos = prevToken.endPos
        return v
    }

    function orelse() {
        if (currentKw() == "else") {
            shiftToken()
            return colon_suite()
        }
        return []
    }

    function while_stmt() {
        let r = mkAST("While") as While
        expectKw("while")
        r.test = test()
        r.body = colon_suite()
        r.orelse = orelse()
        return finish(r)
    }

    function if_stmt(): Stmt {
        let r = mkAST("If") as If
        shiftToken()
        r.test = test()
        r.body = colon_suite()
        if (currentKw() == "elif") {
            r.orelse = [if_stmt()]
        } else {
            r.orelse = orelse()
        }
        return finish(r)
    }

    function for_stmt(): Stmt {
        let r = mkAST("For") as For
        expectKw("for")
        r.target = exprlist()
        setStoreCtx(r.target)
        expectKw("in")
        r.iter = testlist()
        r.body = colon_suite()
        r.orelse = orelse()
        return finish(r)
    }

    function try_stmt(): Stmt {
        let r = mkAST("Try") as Try
        expectKw("try")
        r.body = colon_suite()
        r.handlers = []
        let sawDefault = false
        for (; ;) {
            if (currentKw() == "except") {
                let eh = mkAST("ExceptHandler") as ExceptHandler
                r.handlers.push(eh)
                shiftToken()
                if (currentOp() != "Colon") {
                    if (sawDefault)
                        error()
                    eh.type = test()
                    if (currentKw() == "as") {
                        shiftToken()
                        eh.name = name()
                    } else {
                        eh.name = null
                    }
                } else {
                    sawDefault = true
                    eh.type = null
                    eh.name = null
                }
                eh.body = colon_suite()
            } else {
                break
            }
        }
        r.orelse = orelse()
        if (r.handlers.length == 0 && r.orelse.length)
            error()
        if (currentKw() == "finally") {
            shiftToken()
            r.finalbody = colon_suite()
        } else {
            r.finalbody = []
        }
        return finish(r)
    }

    function raise_stmt(): Stmt {
        let r = mkAST("Raise") as Raise
        expectKw("raise")
        r.exc = null
        r.cause = null
        if (!atStmtEnd()) {
            r.exc = test()
            if (currentKw() == "from") {
                shiftToken()
                r.cause = test()
            }
        }
        return finish(r)
    }

    function with_item() {
        let r = mkAST("WithItem") as WithItem
        r.context_expr = test()
        r.optional_vars = null
        if (currentKw() == "as") {
            shiftToken()
            r.optional_vars = expr()
        }
        return finish(r)
    }

    function with_stmt(): Stmt {
        let r = mkAST("With") as With
        expectKw("with")
        r.items = parseSepList(U.lf("with item"), with_item)
        r.body = colon_suite()
        return finish(r)
    }

    function funcdef(): Stmt {
        let r = mkAST("FunctionDef") as FunctionDef
        expectKw("def")
        r.name = name()
        expectOp("LParen")
        r.args = parse_arguments(true)
        expectOp("RParen")
        r.returns = null
        if (currentOp() == "Arrow") {
            shiftToken()
            r.returns = test()
        }
        r.body = colon_suite()
        return finish(r)
    }

    function classdef(): Stmt {
        let r = mkAST("ClassDef") as ClassDef
        expectKw("class")
        r.name = name()
        if (currentOp() == "LParen") {
            let rr = parseArgs()
            r.bases = rr.args
            r.keywords = rr.keywords
        } else {
            r.bases = []
            r.keywords = []
        }
        r.body = colon_suite()
        return finish(r)
    }

    function del_stmt(): Stmt {
        let r = mkAST("Delete") as Delete
        expectKw("del")
        r.targets = parseList(U.lf("expression"), expr)
        return finish(r)
    }

    function wrap_expr_stmt(e: Expr) {
        let r = mkAST("ExprStmt") as ExprStmt
        r.startPos = e.startPos
        r.endPos = e.endPos
        r.value = e
        return r
    }

    function yield_stmt(): Stmt {
        let t0 = peekToken()
        shiftToken()
        if (currentKw() == "from") {
            let r = mkAST("YieldFrom") as YieldFrom
            r.value = test()
            return wrap_expr_stmt(finish(r))
        }

        let r = mkAST("Yield") as Yield
        if (!atStmtEnd())
            r.value = testlist()
        return wrap_expr_stmt(finish(r))
    }


    function pass_stmt(): Stmt {
        let r = mkAST("Pass") as Pass
        expectKw("pass")
        return finish(r)
    }

    function atStmtEnd() {
        let t = peekToken()
        return t.type == TokenType.NewLine || (t.type == TokenType.Op && t.value == "Semicolon")
    }

    function break_stmt(): Stmt {
        let r = mkAST("Break") as Break
        shiftToken()
        return finish(r)
    }

    function continue_stmt(): Stmt {
        let r = mkAST("Continue") as Continue
        shiftToken()
        return finish(r)
    }

    function return_stmt(): Stmt {
        let r = mkAST("Return") as Return
        shiftToken()
        if (!atStmtEnd()) {
            r.value = testlist()
        } else {
            r.value = null
        }
        return finish(r)
    }

    function global_stmt(): Stmt {
        let r = mkAST("Global") as Global
        shiftToken()
        r.names = []
        for (; ;) {
            r.names.push(name())
            if (currentOp() == "Comma") {
                shiftToken()
            } else {
                break
            }
        }
        return finish(r)
    }

    function nonlocal_stmt(): Stmt {
        let r = global_stmt()
        r.kind = "Nonlocal"
        return r
    }

    function dotted_name() {
        let s = ""
        for (; ;) {
            s += name()
            if (currentOp() == "Dot") {
                s += "."
                shiftToken()
            } else {
                return s
            }
        }
    }

    function dotted_as_name() {
        let r = mkAST("Alias") as Alias
        r.name = dotted_name()
        if (currentKw() == "as") {
            shiftToken()
            r.asname = name()
        } else {
            r.asname = null
        }
        return finish(r)
    }

    function import_as_name() {
        let r = mkAST("Alias") as Alias
        r.name = name()
        if (currentKw() == "as") {
            shiftToken()
            r.asname = name()
        } else {
            r.asname = null
        }
        return finish(r)
    }

    function dots() {
        let r = 0
        for (; ;) {
            if (currentOp() == "Dot") {
                r += 1
                shiftToken()
            } else if (currentOp() == "Ellipsis") {
                // not currently generated by lexer anyways
                r += 3
                shiftToken()
            } else {
                return r
            }
        }
    }

    function import_name(): Stmt {
        let r = mkAST("Import") as Import
        shiftToken()
        r.names = parseSepList(U.lf("import name"), dotted_as_name)
        return finish(r)
    }

    function import_from(): Stmt {
        let r = mkAST("ImportFrom") as ImportFrom
        shiftToken()
        r.level = dots()
        if (peekToken().type == TokenType.Id)
            r.module = dotted_name()
        else
            r.module = null
        if (!r.level && !r.module)
            error()
        expectKw("import")

        if (currentOp() == "Mult") {
            shiftToken()
            let star = mkAST("Alias") as Alias
            star.name = "*"
            r.names = [star]
        } else if (currentOp() == "LParen") {
            shiftToken()
            r.names = parseList(U.lf("import name"), import_as_name)
            expectOp("RParen")
        } else {
            r.names = parseList(U.lf("import name"), import_as_name)
        }

        return finish(r)
    }

    function assert_stmt(): Stmt {
        let r = mkAST("Assert") as Assert
        shiftToken()
        r.test = test()
        if (currentOp() == "Comma") {
            shiftToken()
            r.msg = test()
        } else r.msg = null
        return finish(r)
    }

    function tuple(t0: Token, exprs: Expr[]) {
        let tupl = mkAST("Tuple", t0) as Tuple
        tupl.elts = exprs
        return finish(tupl)
    }

    function testlist_core(f: () => Expr): Expr {
        let t0 = peekToken()
        let exprs = parseList(U.lf("expression"), f)
        let expr = exprs[0]
        if (exprs.length != 1)
            return tuple(t0, exprs)
        return expr
    }

    function testlist_star_expr(): Expr { return testlist_core(star_or_test) }
    function testlist(): Expr { return testlist_core(test) }
    function exprlist(): Expr { return testlist_core(expr) }

    // somewhat approximate
    function setStoreCtx(e: Expr) {
        if (e.kind == "Tuple") {
            let t = e as Tuple
            t.elts.forEach(setStoreCtx)
        } else {
            (e as AssignmentExpr).ctx = "Store"
        }
    }

    function expr_stmt(): Stmt {
        let t0 = peekToken()
        let expr = testlist_star_expr()
        let op = currentOp()

        if (op == "Assign") {
            let assign = mkAST("Assign") as Assign
            assign.targets = [expr]
            for (; ;) {
                shiftToken()
                expr = testlist_star_expr()
                op = currentOp()
                if (op == "Assign") {
                    assign.targets.push(expr)
                } else {
                    assign.value = expr
                    break
                }
            }
            assign.targets.forEach(setStoreCtx)
            return finish(assign)
        }

        if (op == "Colon") {
            let annAssign = mkAST("AnnAssign") as AnnAssign
            annAssign.target = expr
            shiftToken()
            annAssign.annotation = test()
            if (currentOp() == "Assign") {
                shiftToken()
                annAssign.value = test()
            }
            annAssign.simple = t0.type == TokenType.Id && expr.kind == "Name" ? 1 : 0
            setStoreCtx(annAssign.target)
            return finish(annAssign)
        }

        if (U.endsWith(op, "Assign")) {
            let augAssign = mkAST("AugAssign") as AugAssign
            augAssign.target = expr
            augAssign.op = op.replace("Assign", "") as operator
            shiftToken()
            augAssign.value = testlist()
            setStoreCtx(augAssign.target)
            return finish(augAssign)
        }

        if (peekToken().type == TokenType.NewLine) {
            let exprStmt = mkAST("ExprStmt") as ExprStmt
            exprStmt.value = expr
            return finish(exprStmt)
        }

        error(9555, U.lf("unexpected token"))
        shiftToken()
        return null
    }

    function small_stmt() {
        let fn = U.lookup(small_stmt_map, currentKw())
        if (fn) return fn()
        else return expr_stmt()
    }

    function simple_stmt() {
        let res = [small_stmt()]
        while (currentOp() == "Semicolon") {
            shiftToken()
            if (peekToken().type == TokenType.NewLine)
                break
            res.push(small_stmt())
        }
        expectNewline()
        return res.filter(s => !!s)
    }

    function stmt(): Stmt[] {
        if (peekToken().type == TokenType.Indent) {
            error(9573, U.lf("unexpected indent"))
            shiftToken()
        }

        let prevErr = diags.length

        let decorators: Expr[] = []
        while (currentOp() == "MatMult") {
            shiftToken()
            decorators.push(atom_expr())
            expectNewline()
        }

        let kw = currentKw()
        let fn = U.lookup(compound_stmt_map, currentKw())
        let rr: Stmt[] = []

        let comments = currComments
        currComments = []

        if (kw == "class" || kw == "def") {
            let r = fn() as FunctionDef
            r.decorator_list = decorators
            rr = [r]
        } else if (decorators.length) {
            error(9556, U.lf("decorators not allowed here"))
        } else if (fn) rr = [fn()]
        else rr = simple_stmt()

        if (comments.length && rr.length)
            rr[0]._comments = comments

        // there were errors in this stmt; skip tokens until newline to resync
        let skp: string[] = []
        if (diags.length > prevErr) {
            inParens = -1
            while (prevToken.type != TokenType.Dedent && prevToken.type != TokenType.NewLine) {
                shiftToken()
                if (traceParser)
                    skp.push(tokenToString(peekToken()))
                if (peekToken().type == TokenType.EOF)
                    break
            }
            inParens = 0
            if (traceParser)
                pxt.log(traceLev + "skip: " + skp.join(", "))
        }

        if (traceParser)
            for (let r of rr)
                traceAST("stmt", r)

        return rr
    }

    function parse_arguments(allowTypes: boolean) {
        let r = mkAST("Arguments") as Arguments

        r.args = []
        r.defaults = []
        r.kwonlyargs = []
        r.kw_defaults = []
        r.vararg = undefined

        for (; ;) {
            let o = currentOp()
            if (o == "Colon" || o == "RParen")
                break
            if (o == "Mult") {
                if (r.vararg)
                    error(9557, U.lf("multiple *arg"))
                shiftToken()
                if (peekToken().type == TokenType.Id)
                    r.vararg = pdef()
                else
                    r.vararg = null
            } else if (o == "Pow") {
                if (r.kwarg)
                    error(9558, U.lf("multiple **arg"))
                shiftToken()
                r.kwarg = pdef()
            } else {
                if (r.kwarg)
                    error(9559, U.lf("arguments after **"))
                let a = pdef()
                let defl: Expr = null
                if (currentOp() == "Assign") {
                    shiftToken()
                    defl = test()
                }
                if (r.vararg !== undefined) {
                    r.kwonlyargs.push(a)
                    r.kw_defaults.push(defl)
                } else {
                    r.args.push(a)
                    if (defl)
                        r.defaults.push(defl)
                    else if (r.defaults.length)
                        error(9560, U.lf("non-default argument follows default argument"))
                }
            }

            if (currentOp() == "Comma") {
                shiftToken()
            } else {
                break
            }
        }

        if (!r.kwarg) r.kwarg = null
        if (!r.vararg) r.vararg = null

        return finish(r)

        function pdef() {
            let r = mkAST("Arg") as Arg
            r.arg = name()
            r.annotation = null
            if (allowTypes) {
                if (currentOp() == "Colon") {
                    shiftToken()
                    r.annotation = test()
                }
            }
            return r
        }
    }

    function lambdef(noCond?: boolean): Expr {
        let r = mkAST("Lambda") as Lambda
        shiftToken()
        r.args = parse_arguments(false)
        expectOp("Colon")
        r.body = noCond ? test_nocond() : test()
        return finish(r)
    }


    function test(): Expr {
        if (currentKw() == "lambda")
            return lambdef()

        let t0 = peekToken()
        let t = or_test()
        if (currentKw() == "if") {
            let r = mkAST("IfExp", t0) as IfExp
            r.body = t
            expectKw("if")
            r.test = or_test()
            expectKw("else")
            r.orelse = test()
            return finish(r)
        }

        return t
    }

    function bool_test(op: string, f: () => Expr): Expr {
        let t0 = peekToken()
        let r = f()
        if (currentKw() == op) {
            let rr = mkAST("BoolOp", t0) as BoolOp
            rr.op = op == "or" ? "Or" : "And"
            rr.values = [r]
            while (currentKw() == op) {
                expectKw(op)
                rr.values.push(f())
            }
            return finish(rr)
        }
        return r
    }

    function and_test(): Expr {
        return bool_test("and", not_test)
    }

    function or_test(): Expr {
        return bool_test("or", and_test)
    }


    function not_test(): Expr {
        if (currentKw() == "not") {
            let r = mkAST("UnaryOp") as UnaryOp
            shiftToken()
            r.op = "Not"
            r.operand = not_test()
            return finish(r)
        } else
            return comparison()
    }


    const cmpOpMap: Map<cmpop> = {
        'Lt': "Lt",
        'Gt': "Gt",
        'Eq': "Eq",
        'GtE': "GtE",
        'LtE': "LtE",
        'NotEq': "NotEq",
        'in': "In",
        'not': "NotIn",
        'is': "Is",
    }

    function getCmpOp() {
        return cmpOpMap[currentOp()] || cmpOpMap[currentKw()] || null
    }

    function comparison(): Expr {
        let t0 = peekToken()
        let e = expr()

        if (!getCmpOp())
            return e

        let r = mkAST("Compare", t0) as Compare
        r.left = e
        r.comparators = []
        r.ops = []

        while (true) {
            let c = getCmpOp()
            if (!c)
                break
            shiftToken();
            if (c == "NotIn")
                expectKw("in")
            else if (c == "Is") {
                if (currentKw() == "not") {
                    shiftToken()
                    c = "IsNot"
                }
            }
            r.ops.push(c)
            r.comparators.push(expr())
        }

        return finish(r)
    }

    const unOpMap: Map<unaryop> = {
        'Invert': "Invert",
        'Sub': "USub",
        'Add': "UAdd",
    }

    function binOp(f: () => Expr, ops: string): Expr {
        let t0 = peekToken()
        let e = f()
        for (; ;) {
            let o = currentOp()
            if (o && ops.indexOf("," + o + ",") >= 0) {
                let r = mkAST("BinOp", t0) as BinOp
                r.left = e
                r.op = o as operator
                shiftToken()
                r.right = f()
                e = r
            } else {
                return e
            }
        }
    }

    function term() { return binOp(factor, ",Mult,MatMult,Div,Mod,FloorDiv,") }
    function arith_expr() { return binOp(term, ",Add,Sub,") }
    function shift_expr() { return binOp(arith_expr, ",LShift,RShift,") }
    function and_expr() { return binOp(shift_expr, ",BitAnd,") }
    function xor_expr() { return binOp(and_expr, ",BitXor,") }
    function expr() { return binOp(xor_expr, ",BitOr,") }


    function subscript(): AnySlice {
        let t0 = peekToken()
        let lower: Expr = null
        if (currentOp() != "Colon") {
            lower = test()
        }
        if (currentOp() == "Colon") {
            let r = mkAST("Slice", t0) as Slice
            r.lower = lower
            shiftToken()
            let o = currentOp()
            if (o != "Colon" && o != "Comma" && o != "RSquare")
                r.upper = test()
            else
                r.upper = null
            r.step = null
            if (currentOp() == "Colon") {
                shiftToken()
                o = currentOp()
                if (o != "Comma" && o != "RSquare")
                    r.step = test()
            }
            return finish(r)
        } else {
            let r = mkAST("Index") as Index
            r.value = lower
            return finish(r)
        }
    }

    function star_or_test() {
        if (currentOp() == "Mult") {
            let r = mkAST("Starred") as Starred
            r.value = expr()
            return finish(r)
        } else {
            return test()
        }
    }

    function test_nocond() {
        if (currentKw() == "lambda")
            return lambdef(true)
        else
            return or_test()
    }

    function comp_for(): Comprehension[] {
        let rr: Comprehension[] = []

        for (; ;) {
            let r = mkAST("Comprehension") as Comprehension
            r.is_async = 0
            rr.push(r)
            expectKw("for")
            r.target = exprlist()
            setStoreCtx(r.target)
            expectKw("in")
            r.iter = or_test()
            r.ifs = []
            for (; ;) {
                if (currentKw() == "if") {
                    shiftToken()
                    r.ifs.push(test_nocond())
                } else break
            }
            if (currentKw() != "for")
                return rr
        }
    }

    function argument(): Expr | Keyword {
        let t0 = peekToken()
        if (currentOp() == "Mult") {
            let r = mkAST("Starred") as Starred
            shiftToken()
            r.value = test()
            return finish(r)
        }
        if (currentOp() == "Pow") {
            let r = mkAST("Keyword") as Keyword
            shiftToken()
            r.arg = null
            r.value = test()
            return finish(r)
        }

        let e = test()
        if (currentOp() == "Assign") {
            if (e.kind != "Name") {
                error(9561, U.lf("invalid keyword argument; did you mean ==?"))
            }
            shiftToken()
            let r = mkAST("Keyword", t0) as Keyword
            r.arg = (e as Name).id || "???"
            r.value = test()
            return finish(r)
        } else if (currentKw() == "for") {
            let r = mkAST("GeneratorExp", t0) as GeneratorExp
            r.elt = e
            r.generators = comp_for()
            return finish(r)
        } else {
            return e
        }
    }

    function dictorsetmaker() {
        let t0 = peekToken()

        shiftToken()

        if (currentOp() == "Pow") {
            shiftToken()
            return dict(null, expr())
        } else if (currentOp() == "RBracket") {
            let r = mkAST("Dict", t0) as Dict
            shiftToken()
            r.keys = []
            r.values = []
            return finish(r)
        } else {
            let e = star_or_test()
            if (e.kind != "Starred" && currentOp() == "Colon") {
                shiftToken()
                return dict(e, test())
            } else {
                return set(e)
            }
        }


        function set(e: Expr) {
            if (currentKw() == "for") {
                if (e.kind == "Starred")
                    error(9562, U.lf("iterable unpacking cannot be used in comprehension"))
                let r = mkAST("SetComp", t0) as SetComp
                r.elt = e
                r.generators = comp_for()
                return finish(r)
            }

            let r = mkAST("Set", t0) as Set
            r.elts = [e]

            if (currentOp() == "Comma") {
                let rem = parseParenthesizedList("RBracket", U.lf("set element"), star_or_test)
                r.elts = [e].concat(rem)
            } else {
                expectOp("RBracket")
            }

            return finish(r)
        }

        function dictelt() {
            if (currentOp() == "Pow") {
                shiftToken()
                return [null, expr()]
            } else {
                let e = test()
                expectOp("Colon")
                return [e, test()]
            }
        }

        function dict(key0: Expr, value0: Expr) {
            if (currentKw() == "for") {
                if (!key0)
                    error(9563, U.lf("dict unpacking cannot be used in dict comprehension"))
                let r = mkAST("DictComp", t0) as DictComp
                r.key = key0
                r.value = value0
                r.generators = comp_for()
                return finish(r)
            }

            let r = mkAST("Dict", t0) as Dict
            r.keys = [key0]
            r.values = [value0]

            if (currentOp() == "Comma") {
                let rem = parseParenthesizedList("RBracket", U.lf("dict element"), dictelt)
                for (let e of rem) {
                    r.keys.push(e[0])
                    r.values.push(e[1])
                }
            } else {
                expectOp("RBracket")
            }

            return finish(r)
        }
    }

    function shiftAndFake() {
        let r = mkAST("NameConstant") as NameConstant
        r.value = null
        shiftToken()
        return finish(r)
    }

    function atom(): Expr {
        let t = peekToken()

        if (t.type == TokenType.Id) {
            let r = mkAST("Name") as Name
            shiftToken()
            r.id = t.value
            r.ctx = "Load"
            return finish(r)
        } else if (t.type == TokenType.Number) {
            let r = mkAST("Num") as Num
            shiftToken()
            r.ns = t.value
            r.n = t.auxValue
            return finish(r)
        } else if (t.type == TokenType.String) {
            shiftToken()
            let s = t.value
            while (peekToken().type == TokenType.String) {
                s += peekToken().value
                shiftToken()
            }
            if (t.stringPrefix == "b") {
                let r = mkAST("Bytes", t) as Bytes
                r.s = U.toArray(U.stringToUint8Array(s))
                return finish(r)
            } else {
                let r = mkAST("Str", t) as Str
                r.s = s
                return finish(r)
            }
        } else if (t.type == TokenType.Keyword) {
            if (t.value == "None" || t.value == "True" || t.value == "False") {
                let r = mkAST("NameConstant") as NameConstant
                shiftToken()
                r.value = t.value == "True" ? true : t.value == "False" ? false : null
                return finish(r)
            } else {
                error(9564, U.lf("expecting atom"))
                return shiftAndFake()
            }
        } else if (t.type == TokenType.Op) {
            let o = t.value
            if (o == "LParen") {
                return parseParens("RParen", "Tuple", "GeneratorExp")
            } else if (o == "LSquare") {
                return parseParens("RSquare", "List", "ListComp")
            } else if (o == "LBracket") {
                return dictorsetmaker()
            } else {
                error(9565, U.lf("unexpected operator"))
                return shiftAndFake()
            }
        } else {
            error(9566, U.lf("unexpected token"))
            return shiftAndFake()
        }
    }

    function atListEnd() {
        let op = currentOp()
        if (op == "RParen" || op == "RSquare" || op == "RBracket" ||
            op == "Colon" || op == "Semicolon")
            return true
        if (U.endsWith(op, "Assign"))
            return true
        let kw = currentKw()
        if (kw == "in")
            return true
        if (peekToken().type == TokenType.NewLine)
            return true
        return false
    }

    function parseList<T>(
        category: string,
        f: () => T,
    ): T[] {
        let r: T[] = []

        if (atListEnd())
            return r

        for (; ;) {
            r.push(f())

            let hasComma = currentOp() == "Comma"

            if (hasComma)
                shiftToken()

            // final comma is allowed, so no "else if" here
            if (atListEnd()) {
                return r
            } else {
                if (!hasComma) {
                    error(9567, U.lf("expecting {0}", category))
                    return r
                }
            }
        }
    }

    function parseSepList<T>(
        category: string,
        f: () => T,
    ): T[] {
        let r: T[] = []
        for (; ;) {
            r.push(f())
            if (currentOp() == "Comma")
                shiftToken()
            else
                break
        }
        return r
    }

    function parseParenthesizedList<T>(
        cl: string,
        category: string,
        f: () => T
    ): T[] {
        shiftToken()

        let r: T[] = []

        if (currentOp() != cl)
            for (; ;) {
                r.push(f())

                let hasComma = currentOp() == "Comma"
                if (hasComma)
                    shiftToken()

                // final comma is allowed, so no "else if" here
                if (currentOp() == cl) {
                    break
                } else {
                    if (!hasComma) {
                        error(9568, U.lf("expecting {0}", category))
                        break
                    }
                }
            }

        expectOp(cl)
        return r
    }

    function parseParens(cl: string, tuple: string, comp: string): Expr {
        let t0 = peekToken()
        shiftToken()
        if (currentOp() == cl) {
            shiftToken()
            let r = mkAST(tuple, t0) as Tuple
            r.elts = []
            return finish(r)
        }

        let e0 = star_or_test()
        if (currentKw() == "for") {
            let r = mkAST(comp, t0) as GeneratorExp
            r.elt = e0
            r.generators = comp_for()
            expectOp(cl)
            return finish(r)
        }

        if (currentOp() == "Comma") {
            let r = mkAST(tuple, t0) as Tuple
            shiftToken()
            r.elts = parseList(U.lf("expression"), star_or_test)
            r.elts.unshift(e0)
            expectOp(cl)

            return finish(r)
        }

        expectOp(cl)

        if (tuple == "List") {
            let r = mkAST(tuple, t0) as List
            r.elts = [e0]
            return finish(r)
        }

        return e0
    }

    function name() {
        let t = peekToken()
        if (t.type != TokenType.Id)
            error(9569, U.lf("expecting identifier"))
        shiftToken()
        return t.value
    }

    function parseArgs() {
        let args = parseParenthesizedList("RParen", U.lf("argument"), argument)
        let rargs: Expr[] = []
        let rkeywords: Keyword[] = []
        for (let e of args) {
            if (e.kind == "Keyword")
                rkeywords.push(e as Keyword)
            else {
                if (rkeywords.length)
                    error(9570, U.lf("positional argument follows keyword argument"))
                rargs.push(e as Expr)
            }
        }
        return { args: rargs, keywords: rkeywords }
    }

    function trailer(t0: Token, e: Expr) {
        let o = currentOp()
        if (o == "LParen") {
            let r = mkAST("Call", t0) as Call
            r.func = e
            let rr = parseArgs()
            r.args = rr.args
            r.keywords = rr.keywords
            return finish(r)
        } else if (o == "LSquare") {
            let t1 = peekToken()
            let r = mkAST("Subscript", t0) as Subscript
            r.value = e
            let sl = parseParenthesizedList("RSquare", U.lf("subscript"), subscript)
            if (sl.length == 0)
                error(9571, U.lf("need non-empty index list"))
            else if (sl.length == 1)
                r.slice = sl[0]
            else {
                if (sl.every(s => s.kind == "Index")) {
                    let q = sl[0] as Index
                    q.value = tuple(t1, sl.map(e => (e as Index).value))
                    r.slice = q
                } else {
                    let extSl = mkAST("ExtSlice", t1) as ExtSlice
                    extSl.dims = sl
                    r.slice = finish(extSl)
                }
            }
            return finish(r)
        } else if (o == "Dot") {
            let r = mkAST("Attribute", t0) as Attribute
            r.value = e
            shiftToken()
            r.attr = name()
            return finish(r)
        } else {
            return e
        }
    }

    function atom_expr(): Expr {
        let t0 = peekToken()
        let e = atom()
        for (; ;) {
            let ee = trailer(t0, e)
            if (ee === e)
                return e
            e = ee
        }
    }

    function power(): Expr {
        let t0 = peekToken()
        let e = atom_expr()
        if (currentOp() == "Pow") {
            let r = mkAST("BinOp") as BinOp
            shiftToken()
            r.left = e
            r.op = "Pow"
            r.right = factor()
            return finish(r)
        } else {
            return e
        }
    }

    function factor(): Expr {
        if (unOpMap[currentOp()]) {
            let r = mkAST("UnaryOp") as UnaryOp
            r.op = unOpMap[currentOp()]
            shiftToken()
            r.operand = factor()
            return finish(r)
        } else {
            return power()
        }
    }

    const fieldOrder: Map<number> = {
        kind: 1, id: 2, n: 3, s: 4, func: 5, key: 6, elt: 7, elts: 8, keys: 9, left: 10,
        ops: 11, comparators: 12, names: 13, items: 14, test: 15, targets: 16, dims: 17,
        context_expr: 18, name: 19, bases: 20, type: 21, inClass: 22, target: 23,
        annotation: 24, simple: 25, op: 26, operand: 27, right: 28, values: 29, iter: 30,
        ifs: 31, is_async: 32, value: 33, slice: 34, attr: 35, generators: 36, args: 37,
        keywords: 38, body: 39, handlers: 40, orelse: 41, finalbody: 42, decorator_list: 43,
        kwonlyargs: 44, kw_defaults: 45, defaults: 46, arg: 47,
    }
    const fieldsIgnore = {
        lineno: 1,
        col_offset: 1,
        startPos: 1,
        endPos: 1,
        kind: 1,
    }
    const stmtFields = {
        body: 1,
        orelse: 1,
        finalbody: 1
    }
    const cmpIgnore = {
        _comments: 1,
        ctx: 1,
        ns: 1,
    }

    export function dump(asts: AST[], cmp = false) {
        const rec = (ind: string, v: any): any => {
            if (Array.isArray(v)) {
                let s = ""
                for (let i = 0; i < v.length; ++i) {
                    if (i > 0) s += ", "
                    s += rec(ind, v[i])
                }
                return "[" + s + "]"
            }

            if (!v || !v.kind)
                return JSON.stringify(v)

            let r = ""
            let keys = Object.keys(v)
            keys.sort((a, b) => (fieldOrder[a] || 100) - (fieldOrder[b] || 100) || U.strcmp(a, b))
            for (let k of keys) {
                if (U.lookup(fieldsIgnore, k))
                    continue
                if (cmp && U.lookup(cmpIgnore, k))
                    continue
                if (r)
                    r += ", "
                r += k + "="
                if (Array.isArray(v[k]) && v[k].length && U.lookup(stmtFields, k)) {
                    r += "[\n"
                    let i2 = ind + "  "
                    for (let e of v[k]) {
                        r += i2 + rec(i2, e) + "\n"
                    }
                    r += ind + "]"
                } else if (k == "_comments") {
                    r += "[\n"
                    let i2 = ind + "  "
                    for (let e of v[k] as Token[]) {
                        r += i2 + JSON.stringify(e.value) + "\n"
                    }
                    r += ind + "]"
                } else {
                    r += rec(ind, v[k])
                }
            }
            return v.kind + "(" + r + ")"
        }

        let r = ""
        for (let e of asts) {
            r += rec("", e) + "\n"
        }
        return r
    }

    export function parse(_source: string, _filename: string, _tokens: Token[]) {
        source = _source
        filename = _filename
        tokens = _tokens
        inParens = 0
        nextToken = 0
        currComments = []
        indentStack = [0]
        diags = []
        let res: Stmt[] = []

        try {
            prevToken = tokens[0]
            skipTokens()

            if (peekToken().type != TokenType.EOF) {
                res = stmt()
                while (peekToken().type != TokenType.EOF)
                    U.pushRange(res, stmt())
            }
        } catch (e) {
            error(9572, U.lf("exception: {0}", e.message))
        }

        return {
            stmts: res,
            diagnostics: diags
        }
    }
}