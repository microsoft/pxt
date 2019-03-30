namespace pxt.py {
    import B = pxt.blocks;
    import SK = pxtc.SymbolKind

    interface Ctx {
        currModule: py.Module;
        currClass: py.ClassDef;
        currFun: py.FunctionDef;
    }

    // global state
    let externalApis: pxt.Map<SymbolInfo> // slurped from libraries
    let internalApis: pxt.Map<SymbolInfo> // defined in Python
    let ctx: Ctx
    let currIteration = 0
    let typeId = 0
    // this measures if we gained additional information about type state
    // we run conversion several times, until we have all information possible
    let numUnifies = 0
    let autoImport = true
    let currErrorCtx = "???"
    let verboseTypes = false
    let lastAST: AST
    let lastFile: string
    let diagnostics: pxtc.KsDiagnostic[]
    let compileOptions: pxtc.CompileOptions
    let syntaxInfo: pxtc.SyntaxInfo
    let infoNode: AST
    let infoScope: ScopeDef

    function stmtTODO(v: py.Stmt) {
        return B.mkStmt(B.mkText("TODO: " + v.kind))
    }

    function exprTODO(v: py.Expr) {
        return B.mkText(" {TODO: " + v.kind + "} ")
    }

    function docComment(cmt: string) {
        if (cmt.trim().split(/\n/).length <= 1)
            cmt = cmt.trim()
        else
            cmt = cmt + "\n"
        return B.mkStmt(B.mkText("/** " + cmt + " */"))
    }

    function defName(n: string, tp: Type): Name {
        return {
            kind: "Name",
            id: n,
            isdef: true,
            ctx: "Store",
            tsType: tp
        } as any
    }

    const tpString = mkType({ primType: "string" })
    const tpNumber = mkType({ primType: "number" })
    const tpBoolean = mkType({ primType: "boolean" })
    const tpVoid = mkType({ primType: "void" })
    const tpAny = mkType({ primType: "any" })
    let tpBuffer: Type


    const builtInTypes: Map<Type> = {
        "string": tpString,
        "number": tpNumber,
        "boolean": tpBoolean,
        "void": tpVoid,
        "any": tpAny,
    }

    function cleanSymbol(s: SymbolInfo): pxtc.SymbolInfo {
        let r = U.flatClone(s)
        delete r.pyAST
        delete r.pyInstanceType
        delete r.pyRetType
        delete r.pySymbolType
        delete r.moduleTypeMarker
        if (r.parameters)
            r.parameters = r.parameters.map(p => {
                p = U.flatClone(p)
                delete p.pyType
                return p
            })
        return r
    }

    function mapTsType(tp: string): Type {
        if (tp[0] == "(" && U.endsWith(tp, ")")) {
            return mapTsType(tp.slice(1, -1))
        }

        const arrowIdx = tp.indexOf(" => ")
        if (arrowIdx > 0) {
            const retTypeStr = tp.slice(arrowIdx + 4)
            if (retTypeStr.indexOf(")[]") == -1) {
                const retType = mapTsType(retTypeStr)
                const argsStr = tp.slice(1, arrowIdx - 1)
                const argsWords = argsStr ? argsStr.split(/, /) : []
                const argTypes = argsWords.map(a => mapTsType(a.replace(/\w+\??: /, "")))
                return mkFunType(retType, argTypes)
            }
        }

        if (U.endsWith(tp, "[]")) {
            return mkArrayType(mapTsType(tp.slice(0, -2)))
        }

        const t = U.lookup(builtInTypes, tp)
        if (t) return t

        if (tp == "T" || tp == "U") // TODO hack!
            return mkType({ primType: "'" + tp })

        let sym = lookupApi(tp + "@type") || lookupApi(tp)
        if (!sym) {
            error(null, 9501, U.lf("unknown type '{0}' near '{1}'", tp, currErrorCtx || "???"))
            return mkType({ primType: tp })
        }

        if (sym.kind == SK.EnumMember)
            return tpNumber

        // sym.pyInstanceType might not be initialized yet and we don't want to call symbolType() here to avoid infinite recursion
        if (sym.kind == SK.Class || sym.kind == SK.Interface)
            return sym.pyInstanceType || mkType({ classType: sym })

        if (sym.kind == SK.Enum)
            return tpNumber

        error(null, 9502, U.lf("'{0}' is not a type near '{1}'", tp, currErrorCtx || "???"))
        return mkType({ primType: tp })
    }

    // img/hex literal
    function isTaggedTemplate(sym: SymbolInfo) {
        return sym.attributes.shim && sym.attributes.shim[0] == "@"
    }

    function symbolType(sym: SymbolInfo): Type {
        if (!sym.pySymbolType) {
            currErrorCtx = sym.pyQName

            if (sym.parameters) {
                if (isTaggedTemplate(sym)) {
                    sym.parameters = [{
                        "name": "literal",
                        "description": "",
                        "type": "string",
                        "options": {}
                    }]
                }
                for (let p of sym.parameters) {
                    if (!p.pyType)
                        p.pyType = mapTsType(p.type)
                }
            }

            const prevRetType = sym.pyRetType

            if (isModule(sym)) {
                sym.pyRetType = mkType({ moduleType: sym })
            } else {
                if (sym.retType)
                    sym.pyRetType = mapTsType(sym.retType)
                else if (sym.pyRetType) {
                    // nothing to do
                } else {
                    U.oops("no type for: " + sym.pyQName)
                    sym.pyRetType = mkType({})
                }
            }

            if (prevRetType)
                unify(sym.pyAST, prevRetType, sym.pyRetType)

            if (sym.kind == SK.Function || sym.kind == SK.Method)
                sym.pySymbolType = mkFunType(sym.pyRetType, sym.parameters.map(p => p.pyType))
            else
                sym.pySymbolType = sym.pyRetType

            if (sym.kind == SK.Class || sym.kind == SK.Interface) {
                sym.pyInstanceType = mkType({ classType: sym })
            }

            currErrorCtx = null
        }
        return sym.pySymbolType
    }

    function fillTypes(sym: SymbolInfo) {
        if (sym)
            symbolType(sym)
        return sym
    }

    function lookupApi(name: string) {
        return U.lookup(internalApis, name) || U.lookup(externalApis, name)
    }

    function lookupGlobalSymbol(name: string): SymbolInfo {
        if (!name) return null
        return fillTypes(lookupApi(name))
    }

    function initApis(apisInfo: pxtc.ApisInfo) {
        internalApis = {}
        externalApis = {}

        for (let sym of U.values(apisInfo.byQName)) {
            // sym.pkg == null - from main package - skip these
            if (sym.pkg != null) {
                let sym2 = sym as SymbolInfo

                if (sym2.extendsTypes)
                    sym2.extendsTypes = sym2.extendsTypes.filter(e => e != sym2.qName)

                externalApis[sym2.pyQName] = sym2
                externalApis[sym2.qName] = sym2
            }
        }

        // TODO this is for testing mostly; we can do this lazily
        for (let sym of U.values(externalApis)) {
            fillTypes(sym)
        }

        tpBuffer = mapTsType("Buffer")
    }

    function mkType(o: py.TypeOptions = {}) {
        let r: Type = U.flatClone(o) as any
        r.tid = ++typeId
        return r
    }

    function mkArrayType(eltTp: Type) {
        return mkType({ primType: "@array", typeArgs: [eltTp] })
    }

    function mkFunType(retTp: Type, argTypes: Type[]) {
        return mkType({ primType: "@fn" + argTypes.length, typeArgs: [retTp].concat(argTypes) })
    }

    function instanceType(sym: SymbolInfo) {
        symbolType(sym)
        return sym.pyInstanceType
    }

    function currentScope(): py.ScopeDef {
        return ctx.currFun || ctx.currClass || ctx.currModule
    }

    function isTopLevel() {
        return ctx.currModule.name == "main" && !ctx.currFun && !ctx.currClass
    }

    function addImport(a: AST, name: string, scope?: ScopeDef) {
        const sym = lookupGlobalSymbol(name)
        if (!sym)
            error(a, 9503, U.lf("No module named '{0}'", name))
        return sym
    }

    function defvar(n: string, opts: py.VarDescOptions, scope?: ScopeDef) {
        if (!scope)
            scope = currentScope()
        let v = scope.vars[n]
        if (!v) {
            let pref = getFullName(scope)
            if (pref) pref += "."
            let qn = pref + n
            if (isLocalScope(scope))
                v = mkSymbol(SK.Variable, n)
            else
                v = addSymbol(SK.Variable, qn)
            scope.vars[n] = v
        }
        for (let k of Object.keys(opts)) {
            (v as any)[k] = (opts as any)[k]
        }
        return v
    }

    function find(t: Type) {
        if (t.union) {
            t.union = find(t.union)
            return t.union
        }
        return t
    }

    // TODO cache it?
    function getFullName(n: py.AST): string {
        let s = n as py.ScopeDef
        let pref = ""
        if (s.parent) {
            pref = getFullName(s.parent)
            if (!pref) pref = ""
            else pref += "."
        }
        let nn = n as py.FunctionDef
        if (n.kind == "Module" && nn.name == "main")
            return ""
        if (nn.name) return pref + nn.name
        else return pref + "?" + n.kind
    }

    function applyTypeMap(s: string) {
        let over = U.lookup(typeMap, s)
        if (over) return over
        for (let v of U.values(ctx.currModule.vars)) {
            if (!v.isImport)
                continue
            if (v.expandsTo == s) return v.pyName
            if (v.isImport && U.startsWith(s, v.expandsTo + ".")) {
                return v.pyName + s.slice(v.expandsTo.length)
            }
        }
        return s
    }

    function t2s(t: Type): string {
        t = find(t)
        const suff = (s: string) => verboseTypes ? s : ""
        if (t.primType) {
            if (t.primType == "@array")
                return t2s(t.typeArgs[0]) + "[]"

            if (U.startsWith(t.primType, "@fn"))
                return "(" + t.typeArgs.slice(1).map(t => "_: " + t2s(t)).join(", ") + ") => " + t2s(t.typeArgs[0])

            return t.primType + suff("/P")
        }

        if (t.classType)
            return applyTypeMap(t.classType.pyQName) + suff("/C")
        else if (t.moduleType)
            return applyTypeMap(t.moduleType.pyQName) + suff("/M")
        else
            return "?" + t.tid
    }

    function mkDiag(astNode: py.AST, category: pxtc.DiagnosticCategory, code: number, messageText: string): pxtc.KsDiagnostic {
        if (!astNode) astNode = lastAST
        if (!astNode || !ctx || !ctx.currModule) {
            return {
                fileName: lastFile,
                start: 0,
                length: 0,
                line: undefined,
                column: undefined,
                code,
                category,
                messageText,
            }
        } else {
            return {
                fileName: lastFile,
                start: astNode.startPos,
                length: astNode.endPos - astNode.startPos,
                line: undefined,
                column: undefined,
                code,
                category,
                messageText,
            }
        }
    }

    // next free error 9520; 9550-9599 reserved for parser
    function error(astNode: py.AST, code: number, msg: string) {
        diagnostics.push(mkDiag(astNode, pxtc.DiagnosticCategory.Error, code, msg))
        //const pos = position(astNode ? astNode.startPos || 0 : 0, mod.source)
        //currErrs += U.lf("{0} near {1}{2}", msg, mod.tsFilename.replace(/\.ts/, ".py"), pos) + "\n"
    }

    function typeError(a: py.AST, t0: Type, t1: Type) {
        error(a, 9500, U.lf("types not compatible: {0} and {1}", t2s(t0), t2s(t1)))
    }

    function typeCtor(t: Type): any {
        if (t.primType) return t.primType
        else if (t.classType) return t.classType
        else if (t.moduleType) {
            // a class SymbolInfo can be used as both classType and moduleType
            // but these are different constructors (one is instance, one is class itself)
            if (!t.moduleType.moduleTypeMarker)
                t.moduleType.moduleTypeMarker = {}
            return t.moduleType.moduleTypeMarker
        }
        return null
    }

    function isFree(t: Type) {
        return !typeCtor(find(t))
    }

    function canUnify(t0: Type, t1: Type): boolean {
        t0 = find(t0)
        t1 = find(t1)

        if (t0 === t1)
            return true

        let c0 = typeCtor(t0)
        let c1 = typeCtor(t1)

        if (!c0 || !c1)
            return true
        if (c0 !== c1)
            return false

        if (t0.typeArgs && t1.typeArgs) {
            for (let i = 0; i < Math.min(t0.typeArgs.length, t1.typeArgs.length); ++i)
                if (!canUnify(t0.typeArgs[i], t1.typeArgs[i]))
                    return false
        }
        return true
    }

    function unifyClass(a: AST, t: Type, cd: SymbolInfo) {
        t = find(t)
        if (t.classType == cd) return
        if (isFree(t)) {
            t.classType = cd
            return
        }
        unify(a, t, instanceType(cd))
    }

    function unifyTypeOf(e: Expr, t1: Type): void {
        unify(e, typeOf(e), t1)
    }

    function unify(a: AST, t0: Type, t1: Type): void {
        if (t0 === t1)
            return

        t0 = find(t0)
        t1 = find(t1)

        if (t0 === t1)
            return

        const c0 = typeCtor(t0)
        const c1 = typeCtor(t1)

        if (c0 && c1) {
            if (c0 === c1) {
                t0.union = t1 // no type-state change here - actual change would be in arguments only
                if (t0.typeArgs && t1.typeArgs) {
                    for (let i = 0; i < Math.min(t0.typeArgs.length, t1.typeArgs.length); ++i)
                        unify(a, t0.typeArgs[i], t1.typeArgs[i])
                }
                t0.union = t1
            } else {
                typeError(a, t0, t1)
            }
        } else if (c0 && !c1) {
            unify(a, t1, t0)
        } else {
            // the type state actually changes here
            numUnifies++
            t0.union = t1
            // detect late unifications
            // if (currIteration > 2) error(a, `unify ${t2s(t0)} ${t2s(t1)}`)
        }
    }

    function mkSymbol(kind: SK, qname: string): SymbolInfo {
        let m = /(.*)\.(.*)/.exec(qname)
        let name = m ? m[2] : qname
        let ns = m ? m[1] : ""
        return {
            kind: kind,
            name: name,
            pyName: name,
            qName: qname,
            pyQName: qname,
            namespace: ns,
            attributes: {} as any,
            pyRetType: mkType()
        } as any
    }

    function addSymbol(kind: SK, qname: string) {
        let sym = internalApis[qname]
        if (sym) {
            sym.kind = kind
            return sym
        }
        sym = mkSymbol(kind, qname)
        internalApis[sym.pyQName] = sym
        return sym
    }

    function isLocalScope(scope: ScopeDef) {
        while (scope) {
            if (scope.kind == "FunctionDef")
                return true
            scope = scope.parent
        }
        return false
    }

    function addSymbolFor(k: SK, n: py.Symbol, scope?: ScopeDef) {
        if (!n.symInfo) {
            let qn = getFullName(n)
            if (U.endsWith(qn, ".__init__"))
                qn = qn.slice(0, -9) + ".__constructor"
            scope = scope || currentScope()
            if (isLocalScope(scope))
                n.symInfo = mkSymbol(k, qn)
            else
                n.symInfo = addSymbol(k, qn)
            const sym = n.symInfo
            sym.pyAST = n
            scope.vars[sym.pyName] = sym
        }
        return n.symInfo
    }

    // TODO optimize ?
    function listClassFields(cd: ClassDef) {
        let qn = cd.symInfo.qName
        return U.values(internalApis).filter(e => e.namespace == qn && e.kind == SK.Property)
    }

    function getClassField(ct: SymbolInfo, n: string, checkOnly = false, skipBases = false) {
        let qid = ct.pyQName + "." + n
        let f = lookupGlobalSymbol(qid)
        if (f)
            return f

        if (!skipBases) {
            for (let b of ct.extendsTypes || []) {
                let sym = lookupGlobalSymbol(b)
                if (sym) {
                    if (sym == ct)
                        U.userError("field lookup loop on: " + sym.qName + " / " + n)
                    f = getClassField(sym, n, true)
                    if (f) return f
                }
            }
        }

        if (!checkOnly && ct.pyAST && ct.pyAST.kind == "ClassDef") {
            let sym = addSymbol(SK.Property, qid)
            sym.isInstance = true
            return sym
        }
        return null
    }

    function getTypeField(recv: Expr, n: string, checkOnly = false) {
        let t = find(typeOf(recv))

        let ct = t.classType

        if (!ct && t.primType == "@array")
            ct = lookupApi("Array")

        if (ct) {
            let f = getClassField(ct, n, checkOnly)

            if (f) {
                if (!f.isInstance)
                    error(null, 9504, U.lf("the field '{0}' of '{1}' is static", n, ct.pyQName))
                if (isSuper(recv) ||
                    (isThis(recv) && f.namespace != ctx.currClass.symInfo.qName)) {
                    f.isProtected = true
                }
            }

            return f
        }

        ct = t.moduleType
        if (ct) {
            let f = getClassField(ct, n, checkOnly)
            if (f && f.isInstance)
                error(null, 9505, U.lf("the field '{0}' of '{1}' is not static", n, ct.pyQName))
            return f
        }

        return null
    }

    function lookupVar(n: string) {
        let s = currentScope()
        while (s) {
            let v = U.lookup(s.vars, n)
            if (v) return v
            // go to parent, excluding class scopes
            do {
                s = s.parent
            } while (s && s.kind == "ClassDef")
        }
        //if (autoImport && lookupGlobalSymbol(n)) {
        //    return addImport(currentScope(), n, ctx.currModule)
        //}
        return null
    }

    function lookupSymbol(n: string) {
        if (!n)
            return null

        const firstDot = n.indexOf(".")
        if (firstDot > 0) {
            const v = lookupVar(n.slice(0, firstDot))
            // expand name if needed
            if (v && v.pyQName != v.pyName)
                n = v.pyQName + n.slice(firstDot)
        } else {
            const v = lookupVar(n)
            if (v) return v
        }
        return lookupGlobalSymbol(n)
    }

    function getClassDef(e: py.Expr) {
        let n = getName(e)
        let s = lookupSymbol(n)
        if (s && s.pyAST && s.pyAST.kind == "ClassDef")
            return s.pyAST as py.ClassDef
        return null
    }

    function typeOf(e: py.Expr): Type {
        if (e.tsType) {
            return find(e.tsType)
        } else {
            e.tsType = mkType()
            return e.tsType
        }
    }

    function isOfType(e: py.Expr, name: string) {
        let t = typeOf(e)
        if (t.classType && t.classType.pyQName == name)
            return true
        if (t2s(t) == name)
            return true
        return false
    }

    function resetCtx(m: py.Module) {
        ctx = {
            currClass: null,
            currFun: null,
            currModule: m
        }
        lastFile = m.tsFilename.replace(/\.ts$/, ".py")
    }

    function isModule(s: SymbolInfo) {
        if (!s) return false
        switch (s.kind) {
            case SK.Module:
            case SK.Interface:
            case SK.Class:
            case SK.Enum:
                return true
            default:
                return false
        }
    }

    function scope(f: () => B.JsNode) {
        const prevCtx = U.flatClone(ctx)
        let r: B.JsNode;
        try {
            r = f()
        } finally {
            ctx = prevCtx
        }
        return r;
    }

    function todoExpr(name: string, e: B.JsNode) {
        if (!e)
            return B.mkText("")
        return B.mkGroup([B.mkText("/* TODO: " + name + " "), e, B.mkText(" */")])
    }

    function todoComment(name: string, n: B.JsNode[]) {
        if (n.length == 0)
            return B.mkText("")
        return B.mkGroup([B.mkText("/* TODO: " + name + " "), B.mkGroup(n), B.mkText(" */"), B.mkNewLine()])
    }

    function doKeyword(k: py.Keyword) {
        let t = expr(k.value)
        if (k.arg)
            return B.mkInfix(B.mkText(k.arg), "=", t)
        else
            return B.mkGroup([B.mkText("**"), t])
    }

    function compileType(e: Expr): Type {
        if (!e)
            return mkType()
        let tpName = getName(e)
        if (tpName) {
            let sym = lookupApi(tpName + "@type") || lookupApi(tpName)
            if (sym) {
                symbolType(sym)
                if (sym.kind == SK.Enum)
                    return tpNumber

                if (sym.pyInstanceType)
                    return sym.pyInstanceType
            }
            error(e, 9506, U.lf("cannot find type '{0}'", tpName))
        }

        error(e, 9507, U.lf("invalid type syntax"))
        return mkType({})
    }

    function doArgs(n: FunctionDef, isMethod: boolean) {
        const args = n.args
        if (args.kwonlyargs.length)
            error(n, 9517, U.lf("keyword-only arguments not supported yet"))
        let nargs = args.args.slice()
        if (isMethod) {
            if (nargs[0].arg != "self")
                error(n, 9518, U.lf("first argument of method has to be called 'self'"))
            nargs.shift()
        } else {
            if (nargs.some(a => a.arg == "self"))
                error(n, 9519, U.lf("non-methods cannot have an argument called 'self'"))
        }
        if (!n.symInfo.parameters) {
            let didx = args.defaults.length - nargs.length
            n.symInfo.parameters = nargs.map(a => {
                let tp = compileType(a.annotation)
                let defl = ""
                if (didx >= 0) {
                    defl = B.flattenNode([expr(args.defaults[didx])]).output
                    unify(a, tp, typeOf(args.defaults[didx]))
                }
                didx++
                return {
                    name: a.arg,
                    description: "",
                    type: "",
                    initializer: defl,
                    default: defl,
                    pyType: tp
                }
            })
        }


        let lst = n.symInfo.parameters.map(p => {
            let v = defvar(p.name, { isParam: true })
            unify(n, symbolType(v), p.pyType)
            let res = [quote(p.name), typeAnnot(p.pyType)]
            if (p.default) {
                res.push(B.mkText(" = " + p.default))
            }
            return B.mkGroup(res)
        })

        if (args.vararg)
            lst.push(B.mkText("TODO *" + args.vararg.arg))
        if (args.kwarg)
            lst.push(B.mkText("TODO **" + args.kwarg.arg))

        return B.H.mkParenthesizedExpression(B.mkCommaSep(lst))
    }

    function accessAnnot(f: SymbolInfo) {
        if (f.pyName[0] != "_")
            return B.mkText("")
        return f.isProtected ? B.mkText("protected ") : B.mkText("private ")
    }

    const numOps: Map<number> = {
        Sub: 1,
        Div: 1,
        Pow: 1,
        LShift: 1,
        RShift: 1,
        BitOr: 1,
        BitXor: 1,
        BitAnd: 1,
        FloorDiv: 1,
        Mult: 1, // this can be also used on strings and arrays, but let's ignore that for now
    }

    const opMapping: Map<string> = {
        Add: "+",
        Sub: "-",
        Mult: "*",
        MatMult: "Math.matrixMult",
        Div: "/",
        Mod: "%",
        Pow: "**",
        LShift: "<<",
        RShift: ">>",
        BitOr: "|",
        BitXor: "^",
        BitAnd: "&",
        FloorDiv: "Math.idiv",

        And: "&&",
        Or: "||",

        Eq: "==",
        NotEq: "!=",
        Lt: "<",
        LtE: "<=",
        Gt: ">",
        GtE: ">=",

        Is: "===",
        IsNot: "!==",
        In: "py.In",
        NotIn: "py.NotIn",
    }

    const prefixOps: Map<string> = {
        Invert: "~",
        Not: "!",
        UAdd: "P+",
        USub: "P-",
    }

    const typeMap: pxt.Map<string> = {
        "adafruit_bus_device.i2c_device.I2CDevice": "pins.I2CDevice"
    }

    function stmts(ss: py.Stmt[]) {
        return B.mkBlock(ss.map(stmt))
    }

    function exprs0(ee: py.Expr[]) {
        ee = ee.filter(e => !!e)
        return ee.map(expr)
    }

    function setupScope(n: py.ScopeDef) {
        if (!n.vars) {
            n.vars = {}
            n.parent = currentScope()
        }
    }

    function typeAnnot(t: Type) {
        let s = t2s(t)
        if (s[0] == "?")
            return B.mkText(": any; /** TODO: type **/")
        return B.mkText(": " + t2s(t))
    }

    function guardedScope(v: py.AST, f: () => B.JsNode) {
        try {
            return scope(f);
        }
        catch (e) {
            console.log(e)
            return B.mkStmt(todoComment(`conversion failed for ${(v as any).name || v.kind}`, []));
        }
    }

    const stmtMap: Map<(v: py.Stmt) => B.JsNode> = {
        FunctionDef: (n: py.FunctionDef) => guardedScope(n, () => {
            const isMethod = !!ctx.currClass && !ctx.currFun

            const topLev = isTopLevel()

            setupScope(n)
            const sym = addSymbolFor(isMethod ? SK.Method : SK.Function, n)

            if (isMethod) sym.isInstance = true
            ctx.currFun = n
            let prefix = ""
            let funname = n.name
            const remainingDecorators = n.decorator_list.filter(d => {
                if (getName(d) == "property") {
                    prefix = "get"
                    return false
                }
                if (d.kind == "Attribute" && (d as py.Attribute).attr == "setter" &&
                    (d as py.Attribute).value.kind == "Name") {
                    funname = ((d as py.Attribute).value as py.Name).id
                    prefix = "set"
                    return false
                }
                return true
            })
            let nodes = [
                todoComment("decorators", remainingDecorators.map(expr))
            ]
            if (n.body.length >= 1 && n.body[0].kind == "Raise")
                n.alwaysThrows = true
            if (isMethod) {
                if (n.name == "__init__") {
                    nodes.push(B.mkText("constructor"))
                    unifyClass(n, sym.pyRetType, ctx.currClass.symInfo)
                } else {
                    if (funname == "__get__" || funname == "__set__") {
                        let vv = n.vars["value"]
                        if (funname == "__set__" && vv) {
                            let cf = getClassField(ctx.currClass.symInfo, "__get__")
                            if (cf.pyAST && cf.pyAST.kind == "FunctionDef")
                                unify(n, vv.pyRetType, cf.pyRetType)
                        }
                        funname = funname.replace(/_/g, "")
                    }
                    if (!prefix) {
                        prefix = funname[0] == "_" ? (sym.isProtected ? "protected" : "private") : "public"
                    }
                    nodes.push(B.mkText(prefix + " "), quote(funname))
                }
            } else {
                U.assert(!prefix)
                if (n.name[0] == "_" || topLev)
                    nodes.push(B.mkText("function "), quote(funname))
                else
                    nodes.push(B.mkText("export function "), quote(funname))
            }
            nodes.push(
                doArgs(n, isMethod),
                n.returns ? typeAnnot(compileType(n.returns)) : B.mkText(""))

            // make sure type is initialized
            symbolType(sym)

            let body = n.body.map(stmt)
            if (n.name == "__init__") {
                for (let f of listClassFields(ctx.currClass)) {
                    let p = f.pyAST as Assign
                    if (p.value) {
                        body.push(
                            B.mkStmt(B.mkText(`this.${quoteStr(f.pyName)} = `), expr(p.value))
                        )
                    }
                }
            }

            nodes.push(B.mkBlock(body))

            return B.mkStmt(B.mkGroup(nodes))
        }),

        ClassDef: (n: py.ClassDef) => guardedScope(n, () => {
            setupScope(n)

            const sym = addSymbolFor(SK.Class, n)

            U.assert(!ctx.currClass)
            let topLev = isTopLevel()
            ctx.currClass = n
            let nodes = [
                todoComment("keywords", n.keywords.map(doKeyword)),
                todoComment("decorators", n.decorator_list.map(expr)),
                B.mkText(topLev ? "class " : "export class "),
                quote(n.name)
            ]
            if (n.bases.length > 0) {
                if (getName(n.bases[0]) == "Enum") {
                    n.isEnum = true
                } else {
                    nodes.push(B.mkText(" extends "))
                    nodes.push(B.mkCommaSep(n.bases.map(expr)))
                    let b = getClassDef(n.bases[0])
                    if (b) {
                        n.baseClass = b
                        sym.extendsTypes = [b.symInfo.pyQName]
                    }
                }
            }
            let body = stmts(n.body)
            nodes.push(body)

            let fieldDefs = listClassFields(n)
                .filter(f => f.kind == SK.Property && f.isInstance)
                .map((f) => B.mkStmt(accessAnnot(f), quote(f.pyName), typeAnnot(f.pyRetType)))
            body.children = fieldDefs.concat(body.children)

            return B.mkStmt(B.mkGroup(nodes))
        }),

        Return: (n: py.Return) => {
            if (n.value) {
                let f = ctx.currFun
                if (f) unifyTypeOf(n.value, f.symInfo.pyRetType)
                return B.mkStmt(B.mkText("return "), expr(n.value))
            } else {
                return B.mkStmt(B.mkText("return"))

            }
        },
        AugAssign: (n: py.AugAssign) => {
            let op = opMapping[n.op]
            if (op.length > 3)
                return B.mkStmt(B.mkInfix(
                    expr(n.target),
                    "=",
                    B.H.mkCall(op, [expr(n.target), expr(n.value)])
                ))
            else
                return B.mkStmt(
                    expr(n.target),
                    B.mkText(" " + op + "= "),
                    expr(n.value)
                )
        },
        Assign: (n: py.Assign) => {
            if (n.targets.length != 1)
                return stmtTODO(n)
            let pref = ""
            let isConstCall = isCallTo(n.value, "const")
            let nm = getName(n.targets[0]) || ""
            let isUpperCase = nm && !/[a-z]/.test(nm)
            if (!isTopLevel() && !ctx.currClass && !ctx.currFun && nm[0] != "_")
                pref = "export "
            if (nm && ctx.currClass && !ctx.currFun) {
                // class fields can't be const
                isConstCall = false;
                let fd = getClassField(ctx.currClass.symInfo, nm)
                /*
                let src = expr(n.value)
                let attrTp = typeOf(n.value)
                let getter = getTypeField(n.value, "__get__", true)
                if (getter) {
                    unify(n, fd.pyRetType, getter.pyRetType)
                    let implNm = "_" + nm
                    let fdBack = getClassField(ctx.currClass.symInfo, implNm)
                    unify(n, fdBack.pyRetType, attrTp)
                    let setter = getTypeField(attrTp, "__set__", true)
                    let res = [
                        B.mkNewLine(),
                        B.mkStmt(B.mkText("private "), quote(implNm), typeAnnot(attrTp))
                    ]
                    if (!getter.fundef.alwaysThrows)
                        res.push(B.mkStmt(B.mkText(`get ${quoteStr(nm)}()`), typeAnnot(fd.type), B.mkBlock([
                            B.mkText(`return this.${quoteStr(implNm)}.get(this.i2c_device)`),
                            B.mkNewLine()
                        ])))
                    if (!setter.fundef.alwaysThrows)
                        res.push(B.mkStmt(B.mkText(`set ${quoteStr(nm)}(value`), typeAnnot(fd.type),
                            B.mkText(`) `), B.mkBlock([
                                B.mkText(`this.${quoteStr(implNm)}.set(this.i2c_device, value)`),
                                B.mkNewLine()
                            ])))
                    fdBack.initializer = n.value
                    fd.isGetSet = true
                    fdBack.isGetSet = true
                    return B.mkGroup(res)
                } else 
                */
                if (currIteration < 2) {
                    return B.mkText("/* skip for now */")
                }
                unifyTypeOf(n.targets[0], fd.pyRetType)
                fd.isInstance = false
                pref = "static "
            }
            unifyTypeOf(n.targets[0], typeOf(n.value))
            if (isConstCall || isUpperCase) {
                // first run would have "let" in it
                defvar(getName(n.targets[0]), {})
                let s = pref;
                if (!/^static /.test(pref))
                    s += "const ";
                return B.mkStmt(B.mkText(s), B.mkInfix(expr(n.targets[0]), "=", expr(n.value)))
            }
            if (!pref && n.targets[0].kind == "Tuple") {
                let res = [
                    B.mkStmt(B.mkText("const tmp = "), expr(n.value))
                ]
                let tup = n.targets[0] as py.Tuple
                tup.elts.forEach((e, i) => {
                    res.push(
                        B.mkStmt(B.mkInfix(expr(e), "=", B.mkText("tmp[" + i + "]")))
                    )
                })
                return B.mkGroup(res)
            }
            return B.mkStmt(B.mkText(pref), B.mkInfix(expr(n.targets[0]), "=", expr(n.value)))
        },
        For: (n: py.For) => {
            U.assert(n.orelse.length == 0)
            if (isCallTo(n.iter, "range")) {
                let r = n.iter as py.Call
                let def = expr(n.target)
                let ref = quote(getName(n.target))
                unifyTypeOf(n.target, tpNumber)
                let start = r.args.length == 1 ? B.mkText("0") : expr(r.args[0])
                let stop = expr(r.args[r.args.length == 1 ? 0 : 1])
                return B.mkStmt(
                    B.mkText("for ("),
                    B.mkInfix(def, "=", start),
                    B.mkText("; "),
                    B.mkInfix(ref, "<", stop),
                    B.mkText("; "),
                    r.args.length >= 3 ?
                        B.mkInfix(ref, "+=", expr(r.args[2])) :
                        B.mkInfix(null, "++", ref),
                    B.mkText(")"),
                    stmts(n.body))
            }
            unifyTypeOf(n.iter, mkArrayType(typeOf(n.target)))
            return B.mkStmt(
                B.mkText("for ("),
                expr(n.target),
                B.mkText(" of "),
                expr(n.iter),
                B.mkText(")"),
                stmts(n.body))
        },
        While: (n: py.While) => {
            U.assert(n.orelse.length == 0)
            return B.mkStmt(
                B.mkText("while ("),
                expr(n.test),
                B.mkText(")"),
                stmts(n.body))
        },
        If: (n: py.If) => {
            let innerIf = (n: py.If) => {
                let nodes = [
                    B.mkText("if ("),
                    expr(n.test),
                    B.mkText(")"),
                    stmts(n.body)
                ]
                if (n.orelse.length) {
                    nodes[nodes.length - 1].noFinalNewline = true
                    if (n.orelse.length == 1 && n.orelse[0].kind == "If") {
                        // else if
                        nodes.push(B.mkText(" else "))
                        U.pushRange(nodes, innerIf(n.orelse[0] as py.If))
                    } else {
                        nodes.push(B.mkText(" else"), stmts(n.orelse))
                    }
                }
                return nodes
            }
            return B.mkStmt(B.mkGroup(innerIf(n)))
        },
        With: (n: py.With) => {
            if (n.items.length == 1 && isOfType(n.items[0].context_expr, "pins.I2CDevice")) {
                let it = n.items[0]
                let id = getName(it.optional_vars)
                let res: B.JsNode[] = []
                let devRef = expr(it.context_expr)
                if (id) {
                    let v = defvar(id, { isLocal: true })
                    id = quoteStr(id)
                    res.push(B.mkStmt(B.mkText("const " + id + " = "), devRef))
                    unifyTypeOf(it.context_expr, v.pyRetType)
                    devRef = B.mkText(id)
                }
                res.push(B.mkStmt(B.mkInfix(devRef, ".", B.mkText("begin()"))))
                U.pushRange(res, n.body.map(stmt))
                res.push(B.mkStmt(B.mkInfix(devRef, ".", B.mkText("end()"))))
                return B.mkGroup(res)
            }

            let cleanup: B.JsNode[] = []
            let stmts = n.items.map((it, idx) => {
                let varName = "with" + idx
                if (it.optional_vars) {
                    let id = getName(it.optional_vars)
                    U.assert(id != null)
                    defvar(id, { isLocal: true })
                    varName = quoteStr(id)
                }
                cleanup.push(B.mkStmt(B.mkText(varName + ".end()")))
                return B.mkStmt(B.mkText("const " + varName + " = "),
                    B.mkInfix(expr(it.context_expr), ".", B.mkText("begin()")))
            })
            U.pushRange(stmts, n.body.map(stmt))
            U.pushRange(stmts, cleanup)
            return B.mkBlock(stmts)
        },
        Raise: (n: py.Raise) => {
            let ex = n.exc || n.cause
            if (!ex)
                return B.mkStmt(B.mkText("throw"))
            let msg: B.JsNode
            if (ex && ex.kind == "Call") {
                let cex = ex as py.Call
                if (cex.args.length == 1) {
                    msg = expr(cex.args[0])
                }
            }
            // didn't find string - just compile and quote; and hope for the best
            if (!msg)
                msg = B.mkGroup([B.mkText("`"), expr(ex), B.mkText("`")])
            return B.mkStmt(B.H.mkCall("control.fail", [msg]))
        },
        Assert: (n: py.Assert) => B.mkStmt(B.H.mkCall("control.assert", exprs0([n.test, n.msg]))),
        Import: (n: py.Import) => {
            for (let nm of n.names) {
                if (nm.asname)
                    defvar(nm.asname, {
                        expandsTo: nm.name
                    })
                addImport(n, nm.name)
            }
            return B.mkText("")
        },
        ImportFrom: (n: py.ImportFrom) => {
            let res: B.JsNode[] = []
            for (let nn of n.names) {
                if (nn.name == "*")
                    defvar(n.module, {
                        isImportStar: true
                    })
                else {
                    let fullname = n.module + "." + nn.name
                    let sym = lookupGlobalSymbol(fullname)
                    let currname = nn.asname || nn.name
                    if (isModule(sym)) {
                        defvar(currname, {
                            isImport: sym,
                            expandsTo: fullname
                        })
                        res.push(B.mkStmt(B.mkText(`import ${quoteStr(currname)} = ${fullname}`)))
                    } else {
                        defvar(currname, {
                            expandsTo: fullname
                        })
                    }
                }
            }
            return B.mkGroup(res)
        },
        ExprStmt: (n: py.ExprStmt) =>
            n.value.kind == "Str" ?
                docComment((n.value as py.Str).s) :
                B.mkStmt(expr(n.value)),
        Pass: (n: py.Pass) => B.mkStmt(B.mkText(";")),
        Break: (n: py.Break) => B.mkStmt(B.mkText("break")),
        Continue: (n: py.Continue) => B.mkStmt(B.mkText("break")),

        Delete: (n: py.Delete) => stmtTODO(n),
        Try: (n: py.Try) => {
            let r = [
                B.mkText("try"),
                stmts(n.body.concat(n.orelse)),
            ]
            for (let e of n.handlers) {
                r.push(B.mkText("catch ("), e.name ? quote(e.name) : B.mkText("_"))
                // This isn't JS syntax, but PXT doesn't support try at all anyway
                if (e.type)
                    r.push(B.mkText("/* instanceof "), expr(e.type), B.mkText(" */"))
                r.push(B.mkText(")"), stmts(e.body))
            }
            if (n.finalbody.length)
                r.push(B.mkText("finally"), stmts(n.finalbody))
            return B.mkStmt(B.mkGroup(r))
        },
        AnnAssign: (n: py.AnnAssign) => stmtTODO(n),
        AsyncFunctionDef: (n: py.AsyncFunctionDef) => stmtTODO(n),
        AsyncFor: (n: py.AsyncFor) => stmtTODO(n),
        AsyncWith: (n: py.AsyncWith) => stmtTODO(n),
        Global: (n: py.Global) =>
            B.mkStmt(B.mkText("TODO: global: "), B.mkGroup(n.names.map(B.mkText))),
        Nonlocal: (n: py.Nonlocal) =>
            B.mkStmt(B.mkText("TODO: nonlocal: "), B.mkGroup(n.names.map(B.mkText))),
    }

    function possibleDef(n: py.Name) {
        let id = n.id
        if (n.isdef === undefined) {
            let curr = lookupSymbol(id)
            if (!curr) {
                if (ctx.currClass && !ctx.currFun) {
                    n.isdef = false // field
                    curr = defvar(id, {})
                } else {
                    n.isdef = true
                    curr = defvar(id, { isLocal: true })
                }
            } else {
                n.isdef = false
            }
            n.symbolInfo = curr
            unify(n, n.tsType, curr.pyRetType)
        }

        if (n.isdef)
            return B.mkGroup([B.mkText("let "), quote(id)])
        else
            return quote(id)
    }

    function quoteStr(id: string) {
        if (B.isReservedWord(id))
            return id + "_"
        else if (!id)
            return id
        else
            return id
        //return id.replace(/([a-z0-9])_([a-zA-Z0-9])/g, (f: string, x: string, y: string) => x + y.toUpperCase())
    }

    function getName(e: py.Expr): string {
        if (e == null)
            return null
        if (e.kind == "Name") {
            let s = (e as py.Name).id
            let v = lookupVar(s)
            if (v && v.expandsTo) return v.expandsTo
            else return s
        }
        if (e.kind == "Attribute") {
            let pref = getName((e as py.Attribute).value)
            if (pref)
                return pref + "." + (e as py.Attribute).attr
        }
        return null
    }

    function quote(id: py.identifier) {
        if (id == "self")
            return B.mkText("this")
        return B.mkText(quoteStr(id))
    }

    function isCallTo(n: py.Expr, fn: string) {
        if (n.kind != "Call")
            return false
        let c = n as py.Call
        return getName(c.func) == fn
    }

    function binop(left: B.JsNode, pyName: string, right: B.JsNode) {
        let op = opMapping[pyName]
        U.assert(!!op)
        if (op.length > 3)
            return B.H.mkCall(op, [left, right])
        else
            return B.mkInfix(left, op, right)
    }

    interface FunOverride {
        n: string;
        t: Type;
        scale?: number;
    }

    const funMap: Map<FunOverride> = {
        "memoryview": { n: "", t: tpBuffer },
        "const": { n: "", t: tpNumber },
        "micropython.const": { n: "", t: tpNumber },
        "int": { n: "Math.trunc", t: tpNumber },
        "len": { n: ".length", t: tpNumber },
        "min": { n: "Math.min", t: tpNumber },
        "max": { n: "Math.max", t: tpNumber },
        "string.lower": { n: ".toLowerCase()", t: tpString },
        "string.upper": { n: ".toUpperCase()", t: tpString },
        "ord": { n: ".charCodeAt(0)", t: tpNumber },
        "bytearray": { n: "pins.createBuffer", t: tpBuffer },
        "bytes": { n: "pins.createBufferFromArray", t: tpBuffer },
        "bool": { n: "!!", t: tpBoolean },
        "Array.index": { n: ".indexOf", t: tpNumber },
    }

    function isSuper(v: py.Expr) {
        return isCallTo(v, "super") && (v as py.Call).args.length == 0
    }

    function isThis(v: py.Expr) {
        return v.kind == "Name" && (v as py.Name).id == "self"
    }

    function handleFmt(n: py.BinOp) {
        if (n.op == "Mod" && n.left.kind == "Str" &&
            (n.right.kind == "Tuple" || n.right.kind == "List")) {
            let fmt = (n.left as py.Str).s
            let elts = (n.right as py.List).elts
            elts = elts.slice()
            let res = [B.mkText("`")]
            fmt.replace(/([^%]+)|(%[\d\.]*([a-zA-Z%]))/g,
                (f: string, reg: string, f2: string, flet: string) => {
                    if (reg)
                        res.push(B.mkText(reg.replace(/[`\\$]/g, f => "\\" + f)))
                    else {
                        let ee = elts.shift()
                        let et = ee ? expr(ee) : B.mkText("???")
                        /* tslint:disable:no-invalid-template-strings */
                        res.push(B.mkText("${"), et, B.mkText("}"))
                        /* tslint:enable:no-invalid-template-strings */
                    }
                    return ""
                })
            res.push(B.mkText("`"))
            return B.mkGroup(res)
        }
        return null
    }

    function forceBackticks(n: B.JsNode) {
        if (n.type == B.NT.Prefix && n.op[0] == "\"") {
            return B.mkText(B.backtickLit(JSON.parse(n.op)))
        }
        return n
    }

    function nodeInInfoRange(n: AST) {
        return syntaxInfo && n.startPos <= syntaxInfo.position && syntaxInfo.position <= n.endPos
    }

    function markInfoNode(n: AST, tp: pxtc.InfoType) {
        if (currIteration > 100 && syntaxInfo &&
            infoNode == null && (syntaxInfo.type == tp || syntaxInfo.type == "symbol") &&
            nodeInInfoRange(n)) {
            infoNode = n
            infoScope = currentScope()
        }
    }

    const exprMap: Map<(v: py.Expr) => B.JsNode> = {
        BoolOp: (n: py.BoolOp) => {
            let r = expr(n.values[0])
            for (let i = 1; i < n.values.length; ++i) {
                r = binop(r, n.op, expr(n.values[i]))
            }
            return r
        },
        BinOp: (n: py.BinOp) => {
            let r = handleFmt(n)
            if (r) return r
            r = binop(expr(n.left), n.op, expr(n.right))
            if (numOps[n.op]) {
                unifyTypeOf(n.left, tpNumber)
                unifyTypeOf(n.right, tpNumber)
                unify(n, n.tsType, tpNumber)
            }
            return r
        },
        UnaryOp: (n: py.UnaryOp) => {
            let op = prefixOps[n.op]
            U.assert(!!op)
            return B.mkInfix(null, op, expr(n.operand))
        },
        Lambda: (n: py.Lambda) => exprTODO(n),
        IfExp: (n: py.IfExp) =>
            B.mkInfix(B.mkInfix(expr(n.test), "?", expr(n.body)), ":", expr(n.orelse)),
        Dict: (n: py.Dict) => exprTODO(n),
        Set: (n: py.Set) => exprTODO(n),
        ListComp: (n: py.ListComp) => exprTODO(n),
        SetComp: (n: py.SetComp) => exprTODO(n),
        DictComp: (n: py.DictComp) => exprTODO(n),
        GeneratorExp: (n: py.GeneratorExp) => {
            if (n.generators.length == 1 && n.generators[0].kind == "Comprehension") {
                let comp = n.generators[0] as py.Comprehension
                if (comp.ifs.length == 0) {
                    return scope(() => {
                        let v = getName(comp.target)
                        defvar(v, { isParam: true }) // TODO this leaks the scope...
                        return B.mkInfix(expr(comp.iter), ".", B.H.mkCall("map", [
                            B.mkGroup([quote(v), B.mkText(" => "), expr(n.elt)])
                        ]))
                    })
                }
            }
            return exprTODO(n)
        },
        Await: (n: py.Await) => exprTODO(n),
        Yield: (n: py.Yield) => exprTODO(n),
        YieldFrom: (n: py.YieldFrom) => exprTODO(n),
        Compare: (n: py.Compare) => {
            if (n.ops.length == 1 && (n.ops[0] == "In" || n.ops[0] == "NotIn")) {
                if (find(typeOf(n.comparators[0])) == tpString)
                    unifyTypeOf(n.left, tpString)
                let idx = B.mkInfix(expr(n.comparators[0]), ".", B.H.mkCall("indexOf", [expr(n.left)]))
                return B.mkInfix(idx, n.ops[0] == "In" ? ">=" : "<", B.mkText("0"))
            }
            let r = binop(expr(n.left), n.ops[0], expr(n.comparators[0]))
            for (let i = 1; i < n.ops.length; ++i) {
                r = binop(r, "And", binop(expr(n.comparators[i - 1]), n.ops[i], expr(n.comparators[i])))
            }
            return r
        },
        Call: (n: py.Call) => {
            let namedSymbol = lookupSymbol(getName(n.func))
            let isClass = namedSymbol && namedSymbol.kind == SK.Class

            let fun = namedSymbol

            let recvTp: Type
            let recv: py.Expr
            let methName: string

            if (isClass) {
                fun = lookupSymbol(namedSymbol.pyQName + ".__constructor")
            } else {
                if (n.func.kind == "Attribute") {
                    let attr = n.func as py.Attribute
                    recv = attr.value
                    recvTp = typeOf(recv)
                    if (recvTp.classType) {
                        methName = attr.attr
                        fun = getTypeField(recv, methName, true)
                        if (fun) methName = fun.name
                    }
                }
            }

            let orderedArgs = n.args.slice()

            let nm = getName(n.func)

            if (nm == "super" && orderedArgs.length == 0) {
                if (ctx.currClass && ctx.currClass.baseClass)
                    unifyClass(n, n.tsType, ctx.currClass.baseClass.symInfo)
                return B.mkText("super")
            }

            if (!fun) {
                let over = U.lookup(funMap, nm)
                if (over)
                    methName = ""

                if (methName) {
                    nm = t2s(recvTp) + "." + methName
                    over = U.lookup(funMap, nm)
                    if (!over && typeCtor(find(recvTp)) == "@array") {
                        nm = "Array." + methName
                        over = U.lookup(funMap, nm)
                    }
                }

                methName = ""

                if (over) {
                    if (over.n[0] == "." && orderedArgs.length) {
                        recv = orderedArgs.shift()
                        recvTp = typeOf(recv)
                        methName = over.n.slice(1)
                        fun = getTypeField(recv, methName)
                        if (fun && fun.kind == SK.Property)
                            return B.mkInfix(expr(recv), ".", B.mkText(methName))
                    } else {
                        fun = lookupGlobalSymbol(over.n)
                    }
                }
            }

            if (!fun)
                error(n, 9508, U.lf("can't find called function"))

            let formals = fun ? fun.parameters : null
            let allargs: B.JsNode[] = []

            if (!formals) {
                if (fun)
                    error(n, 9509, U.lf("calling non-function"))
                allargs = orderedArgs.map(expr)
            } else {
                if (orderedArgs.length > formals.length)
                    error(n, 9510, U.lf("too many arguments in call to '{0}'", fun.pyQName))

                while (orderedArgs.length < formals.length)
                    orderedArgs.push(null)
                orderedArgs = orderedArgs.slice(0, formals.length)

                for (let kw of n.keywords) {
                    let idx = formals.findIndex(f => f.name == kw.arg)
                    if (idx < 0)
                        error(kw, 9511, U.lf("'{0}' doesn't have argument named '{1}'", fun.pyQName, kw.arg))
                    else if (orderedArgs[idx] != null)
                        error(kw, 9512, U.lf("argument '{0} already specified in call to '{1}'", kw.arg, fun.pyQName))
                    else
                        orderedArgs[idx] = kw.value
                }

                // skip optional args
                for (let i = orderedArgs.length - 1; i >= 0; i--) {
                    if (formals[i].initializer == "undefined" && orderedArgs[i] == null)
                        orderedArgs.pop()
                    else
                        break
                }

                for (let i = 0; i < orderedArgs.length; ++i) {
                    let arg = orderedArgs[i]
                    if (arg == null && !formals[i].initializer) {
                        error(n, 9513, U.lf("missing argument '{0}' in call to '{1}'", formals[i].name, fun.pyQName))
                        allargs.push(B.mkText("null"))
                    } else if (arg) {
                        unifyTypeOf(arg, formals[i].pyType)
                        allargs.push(expr(arg))
                    } else {
                        allargs.push(B.mkText(formals[i].initializer))
                    }
                }
            }

            if (!infoNode && syntaxInfo && syntaxInfo.type == "signature" && nodeInInfoRange(n)) {
                infoNode = n
                infoScope = currentScope()
                syntaxInfo.auxResult = 0
                // foo, bar
                for (let i = 0; i < orderedArgs.length; ++i) {
                    if (orderedArgs[i] && syntaxInfo.position <= orderedArgs[i].endPos) {
                        syntaxInfo.auxResult = i
                    }
                }
            }

            if (fun) {
                unifyTypeOf(n, fun.pyRetType)
                n.symbolInfo = fun
            }

            let fn = methName ? B.mkInfix(expr(recv), ".", B.mkText(methName)) : expr(n.func)

            let nodes = [
                fn,
                B.mkText("("),
                B.mkCommaSep(allargs),
                B.mkText(")")
            ]

            if (fun && allargs.length == 1 && isTaggedTemplate(fun))
                nodes = [fn, forceBackticks(allargs[0])]

            if (isClass) {
                nodes[0] = B.mkText(applyTypeMap(namedSymbol.pyQName))
                nodes.unshift(B.mkText("new "))
            }

            return B.mkGroup(nodes)
        },
        Num: (n: py.Num) => {
            unify(n, n.tsType, tpNumber)
            return B.mkText(n.ns)
        },
        Str: (n: py.Str) => {
            unify(n, n.tsType, tpString)
            return B.mkText(B.stringLit(n.s))
        },
        FormattedValue: (n: py.FormattedValue) => exprTODO(n),
        JoinedStr: (n: py.JoinedStr) => exprTODO(n),
        Bytes: (n: py.Bytes) => {
            return B.mkText(`hex\`${U.toHex(new Uint8Array(n.s))}\``)
        },
        NameConstant: (n: py.NameConstant) => {
            if (n.value != null)
                unify(n, n.tsType, tpBoolean)
            return B.mkText(JSON.stringify(n.value))
        },
        Ellipsis: (n: py.Ellipsis) => exprTODO(n),
        Constant: (n: py.Constant) => exprTODO(n),
        Attribute: (n: py.Attribute) => {
            let lhs = expr(n.value) // run it first, in case it wants to capture infoNode
            let part = typeOf(n.value)
            let fd = getTypeField(n.value, n.attr)
            let nm = n.attr
            markInfoNode(n, "memberCompletion")
            if (fd) {
                n.symbolInfo = fd
                unify(n, n.tsType, fd.pyRetType)
                nm = fd.name
            } else if (part.moduleType) {
                let sym = lookupGlobalSymbol(part.moduleType.pyQName + "." + n.attr)
                if (sym) {
                    n.symbolInfo = sym
                    unifyTypeOf(n, symbolType(sym))
                    nm = sym.name
                } else
                    error(n, 9514, U.lf("module '{0}' has no attribute '{1}'", part.moduleType.pyQName, n.attr))
            } else {
                if (currIteration > 2)
                    error(n, 9515, U.lf("unknown object type; cannot lookup attribute '{0}'", n.attr))
            }
            return B.mkInfix(lhs, ".", B.mkText(quoteStr(nm)))
        },
        Subscript: (n: py.Subscript) => {
            if (n.slice.kind == "Index") {
                let idx = (n.slice as py.Index).value
                if (currIteration > 2 && isFree(typeOf(idx))) {
                    unifyTypeOf(idx, tpNumber)
                }
                return B.mkGroup([
                    expr(n.value),
                    B.mkText("["),
                    expr(idx),
                    B.mkText("]"),
                ])
            } else if (n.slice.kind == "Slice") {
                let s = n.slice as py.Slice
                return B.mkInfix(expr(n.value), ".",
                    B.H.mkCall("slice", [s.lower ? expr(s.lower) : B.mkText("0"),
                    s.upper ? expr(s.upper) : null].filter(x => !!x)))
            }
            else {
                return exprTODO(n)
            }
        },
        Starred: (n: py.Starred) => B.mkGroup([B.mkText("... "), expr(n.value)]),
        Name: (n: py.Name) => {
            markInfoNode(n, "identifierCompletion")

            // shortcut, but should work
            if (n.id == "self" && ctx.currClass) {
                unifyClass(n, n.tsType, ctx.currClass.symInfo)
                return B.mkText("this")
            }

            let v = lookupSymbol(n.id)
            if (v) {
                n.symbolInfo = v
                unify(n, n.tsType, symbolType(v))
                if (v.isImport)
                    return quote(v.name) // it's import X = Y.Z.X, use X not Y.Z.X
            } else if (currIteration > 0) {
                error(n, 9516, U.lf("name '{0}' is not defined", n.id))
            }

            if (n.ctx.indexOf("Load") >= 0) {
                return quote(v ? v.qName : getName(n))
            } else
                return possibleDef(n)
        },
        List: mkArrayExpr,
        Tuple: mkArrayExpr,
    }

    function mkArrayExpr(n: py.List | py.Tuple) {
        unify(n, n.tsType, mkArrayType(n.elts[0] ? typeOf(n.elts[0]) : mkType()))
        return B.mkGroup([
            B.mkText("["),
            B.mkCommaSep(n.elts.map(expr)),
            B.mkText("]"),
        ])
    }

    function expr(e: py.Expr): B.JsNode {
        lastAST = e
        let f = exprMap[e.kind]
        if (!f) {
            U.oops(e.kind + " - unknown expr")
        }
        typeOf(e)
        return f(e)
    }

    function stmt(e: py.Stmt): B.JsNode {
        lastAST = e
        let f = stmtMap[e.kind]
        if (!f) {
            U.oops(e.kind + " - unknown stmt")
        }

        let cmts: string[] = (e._comments || []).map(c => c.value)

        let r = f(e)
        if (cmts.length) {
            r = B.mkGroup(cmts.map(c => B.mkStmt(B.H.mkComment(c))).concat(r))
        }
        return r
    }

    function isEmpty(b: B.JsNode): boolean {
        if (!b) return true
        if (b.type == B.NT.Prefix && b.op == "")
            return b.children.every(isEmpty)
        if (b.type == B.NT.NewLine)
            return true
        return false
    }

    // TODO look at scopes of let

    function toTS(mod: py.Module): B.JsNode[] {
        U.assert(mod.kind == "Module")
        if (mod.tsBody)
            return null
        resetCtx(mod)
        if (!mod.vars) mod.vars = {}
        let res = mod.body.map(stmt)
        if (res.every(isEmpty)) return null
        else if (mod.name == "main") return res
        return [
            B.mkText("namespace " + mod.name + " "),
            B.mkBlock(res)
        ]
    }

    function iterPy(e: py.AST, f: (v: py.AST) => void) {
        if (!e) return
        f(e)
        U.iterMap(e as any, (k: string, v: any) => {
            if (!v || k == "parent")
                return
            if (v && v.kind) iterPy(v, f)
            else if (Array.isArray(v))
                v.forEach((x: any) => iterPy(x, f))
        })
    }

    function resetPass(iter: number) {
        currIteration = iter
        diagnostics = []
        numUnifies = 0
        lastAST = null
    }

    export function py2ts(opts: pxtc.CompileOptions) {
        let modules: py.Module[] = []
        const generated: Map<string> = {}
        diagnostics = []

        let pyFiles = opts.sourceFiles.filter(fn => U.endsWith(fn, ".py"))
        if (pyFiles.length == 0)
            return { generated, diagnostics }

        lastFile = pyFiles[0] // make sure there's some location info for errors from API init
        initApis(opts.apisInfo)

        compileOptions = opts
        syntaxInfo = null

        if (!opts.generatedFiles)
            opts.generatedFiles = []

        for (const fn of pyFiles) {
            let sn = fn
            let modname = fn.replace(/\.py$/, "").replace(/.*\//, "")
            let src = opts.fileSystem[fn]

            try {
                lastFile = fn
                let tokens = pxt.py.lex(src)
                //console.log(pxt.py.tokensToString(tokens))
                let res = pxt.py.parse(src, sn, tokens)
                //console.log(pxt.py.dump(stmts))

                U.pushRange(diagnostics, res.diagnostics)

                modules.push({
                    kind: "Module",
                    body: res.stmts,
                    name: modname,
                    source: src,
                    tsFilename: sn.replace(/\.py$/, ".ts")
                } as any)
            } catch (e) {
                // TODO
                console.log("Parse error", e)
            }
        }

        const parseDiags = diagnostics

        for (let i = 0; i < 5; ++i) {
            resetPass(i)
            for (let m of modules) {
                try {
                    toTS(m)
                    // console.log(`after ${currIteration} - ${numUnifies}`)
                } catch (e) {
                    console.log("Conv pass error", e);
                }
            }
            if (numUnifies == 0)
                break
        }

        resetPass(1000)
        infoNode = null
        syntaxInfo = opts.syntaxInfo
        for (let m of modules) {
            try {
                let nodes = toTS(m)
                if (!nodes) continue
                let res = B.flattenNode(nodes)
                opts.sourceFiles.push(m.tsFilename)
                opts.generatedFiles.push(m.tsFilename)
                opts.fileSystem[m.tsFilename] = res.output
                generated[m.tsFilename] = res.output
            } catch (e) {
                console.log("Conv error", e);
            }
        }

        diagnostics = parseDiags.concat(diagnostics)

        const isGlobalSymbol = (si: SymbolInfo) => {
            switch (si.kind) {
                case SK.Enum:
                case SK.EnumMember:
                case SK.Variable:
                case SK.Function:
                case SK.Module:
                    return true
                case SK.Property:
                case SK.Method:
                    return !si.isInstance
                default:
                    return false
            }
        }

        if (syntaxInfo) syntaxInfo.symbols = []

        if (syntaxInfo && infoNode) {
            const apis = U.values(externalApis).concat(U.values(internalApis))

            syntaxInfo.beginPos = infoNode.startPos
            syntaxInfo.endPos = infoNode.endPos

            if (syntaxInfo.type == "memberCompletion" && infoNode.kind == "Attribute") {
                const attr = infoNode as Attribute
                const tp = typeOf(attr.value)
                if (tp.moduleType) {
                    for (let v of apis) {
                        if (!v.isInstance && v.namespace == tp.moduleType.qName) {
                            syntaxInfo.symbols.push(v)
                        }
                    }
                } else if (tp.classType) {
                    let types = tp.classType.extendsTypes.concat(tp.classType.qName)
                    for (let v of apis) {
                        if (v.isInstance && types.indexOf(v.namespace) >= 0) {
                            syntaxInfo.symbols.push(v)
                        }
                    }
                }
            } else if (syntaxInfo.type == "identifierCompletion") {
                let existing: SymbolInfo[] = []
                const addSym = (v: SymbolInfo) => {
                    if (isGlobalSymbol(v) && existing.indexOf(v) < 0)
                        syntaxInfo.symbols.push(v)
                }
                existing = syntaxInfo.symbols.slice()
                for (let s = infoScope; s; s = s.parent) {
                    if (s.vars)
                        U.values(s.vars).forEach(addSym)
                }
                apis.forEach(addSym)
            } else {
                let sym = (infoNode as Expr).symbolInfo
                if (sym)
                    syntaxInfo.symbols.push(sym)
            }

            syntaxInfo.symbols = syntaxInfo.symbols.map(cleanSymbol)
        }

        return {
            generated,
            diagnostics: patchedDiags()
        }

        function patchedDiags() {
            for (let d of diagnostics) {
                patchPosition(d, opts.fileSystem[d.fileName])
            }
            return diagnostics
        }
    }

    export function convert(opts: pxtc.CompileOptions) {
        if (opts.target.preferredEditor == pxt.PYTHON_PROJECT_NAME) {
            const r = py2ts(opts)
            return r.diagnostics
        }
        return []
    }

    pxt.conversionPasses.push(convert)
}
