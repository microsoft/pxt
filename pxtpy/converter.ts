namespace pxt.py {
    import B = pxt.blocks;
    import SK = pxtc.SymbolKind

    interface Ctx {
        currModule: py.Module;
        currClass: py.ClassDef;
        currFun: py.FunctionDef;
    }

    // global state
    let moduleAst: Map<py.Module> = {}
    let apisInfo: pxtc.ApisInfo
    let externalApis: pxt.Map<SymbolInfo> // slurped from libraries
    let internalApis: pxt.Map<SymbolInfo> // defined in Python
    let ctx: Ctx
    let currIteration = 0
    let typeId = 0
    let numUnifies = 0
    let currErrs = ""
    let autoImport = true

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
    let tpBuffer: Type


    const builtInTypes: Map<Type> = {
        "string": tpString,
        "number": tpNumber,
        "boolean": tpBoolean,
        "void": tpVoid,
    }

    function mapTsType(tp: string) {
        const t = U.lookup(builtInTypes, tp)
        if (t) return t

        let ai = lookupGlobalSymbol(tp)
        if (!ai) {
            error(null, U.lf("unknown type '{0}'", tp))
            return mkType({ primType: tp })
        }

        if (ai.kind == SK.Enum)
            return tpNumber

        if (ai.kind == SK.Class || ai.kind == SK.Interface)
            return mkType({ classType: ai })

        error(null, U.lf("'{0}' is not a type", tp))
        return mkType({ primType: tp })
    }

    function mapTypes(sym: SymbolInfo) {
        if (!sym || sym.retType) return sym
        sym.pyRetType = mapTsType(sym.retType)
        for (let p of sym.parameters || [])
            p.pyType = mapTsType(p.type)
        return sym
    }

    function lookupGlobalSymbol(name: string): SymbolInfo {
        if (!name) return null
        return mapTypes(U.lookup(internalApis, name) || U.lookup(externalApis, name))
    }

    function initApis() {
        externalApis = apisInfo.byQName as any
        for (let sym of U.values(externalApis)) {
            sym.members = []
            mapTypes(sym) // TODO remove when done
        }
        for (let sym of U.values(externalApis)) {
            if (sym.namespace && sym.namespace != sym.qName) {
                let par = externalApis[sym.namespace]
                if (par)
                    par.members.push(sym)
            }
        }
        tpBuffer = mapTsType("Buffer")
    }

    function mkType(o: py.TypeOptions = {}) {
        let r: Type = U.flatClone(o) as any
        r.tid = ++typeId
        return r
    }

    function currentScope(): py.ScopeDef {
        return ctx.currFun || ctx.currClass || ctx.currModule
    }

    function isTopLevel() {
        return ctx.currModule.name == "main" && !ctx.currFun && !ctx.currClass
    }

    function addImport(a: AST, name: string, scope?: ScopeDef) {
        const v = defvar(name, { isPlainImport: true }, scope)
        const sym = lookupGlobalSymbol(name)
        if (!sym)
            error(a, U.lf("No module named '{0}'", name))
        else
            unify(a, v.type, mkType({ moduleType: sym }))
        return v
    }

    function defvar(n: string, opts: py.VarDescOptions, scope?: ScopeDef) {
        let scopeDef = scope || currentScope()
        let v = scopeDef.vars[n]
        if (!v) {
            v = scopeDef.vars[n] = { type: mkType(), name: n }
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

    function getFullName(n: py.AST): string {
        let s = n as py.ScopeDef
        let pref = ""
        if (s.parent) {
            pref = getFullName(s.parent)
            if (!pref) pref = ""
            else pref += "."
        }
        let nn = n as py.FunctionDef
        if (nn.name) return pref + nn.name
        else return pref + "?" + n.kind
    }

    function applyTypeMap(s: string) {
        let over = U.lookup(typeMap, s)
        if (over) return over
        for (let v of U.values(ctx.currModule.vars)) {
            if (!v.isImport)
                continue
            if (v.expandsTo == s) return v.name
            if (v.isImport && U.startsWith(s, v.expandsTo + ".")) {
                return v.name + s.slice(v.expandsTo.length)
            }
        }
        return s
    }

    function t2s(t: Type): string {
        t = find(t)
        if (t.primType)
            return t.primType
        else if (t.classType)
            return applyTypeMap(t.classType.qName)
        else if (t.moduleType)
            return applyTypeMap(t.moduleType.name)
        else if (t.arrayType)
            return t2s(t.arrayType) + "[]"
        else
            return "?" + t.tid
    }

    function error(a: py.AST, msg: string) {
        if (!ctx || !ctx.currModule) {
            currErrs += msg + "\n"
        } else {
            const mod = ctx.currModule
            const pos = position(a ? a.startPos || 0 : 0, mod.source)
            currErrs += U.lf("{0} near {1}{2}", msg, mod.tsFilename.replace(/\.ts/, ".py"), pos) + "\n"
        }
    }

    function typeError(a: py.AST, t0: Type, t1: Type) {
        error(a, U.lf("types not comaptible: {0} and {1}", t2s(t0), t2s(t1)))
    }

    function typeCtor(t: Type): any {
        if (t.primType) return t.primType
        else if (t.classType) return t.classType
        else if (t.moduleType) return t.moduleType
        else if (t.arrayType) return "array"
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

        if (c0 == "array") {
            return canUnify(t0.arrayType, t1.arrayType)
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
        unify(a, t, mkType({ classType: cd }))
    }

    function unifyTypeOf(e: Expr, t1: Type): void {
        unify(e, typeOf(e), t1)
    }

    function unify(a: AST, t0: Type, t1: Type): void {
        t0 = find(t0)
        t1 = find(t1)
        if (t0 === t1)
            return
        if (!canUnify(t0, t1)) {
            typeError(a, t0, t1)
            return
        }
        if (typeCtor(t0) && !typeCtor(t1))
            return unify(a, t1, t0)
        numUnifies++
        t0.union = t1
        if (t0.arrayType && t1.arrayType)
            unify(a, t0.arrayType, t1.arrayType)
    }

    function addSymbol(kind: SK, qname: string) {
        let m = /(.*)\.(.*)/.exec(qname)
        let sym: SymbolInfo = {
            kind: kind,
            name: m ? m[2] : qname,
            qName: qname,
            namespace: m ? m[1] : "",
            pyRetType: mkType(),
            attributes: {} as any
        } as any
        internalApis[sym.qName] = sym
        return sym
    }

    function getClassField(ct: SymbolInfo, n: string, checkOnly = false, skipBases = false) {
        let qid = ct.qName + "." + n
        let f = lookupGlobalSymbol(qid)
        if (f) {
            if (f.isInstance) return f
            if (!checkOnly)
                error(null, U.lf("the field '{0}' of '{1}' is static", n, ct.qName))
            return null
        }

        if (!skipBases) {
            for (let b of ct.extendsTypes || []) {
                let sym = lookupGlobalSymbol(b)
                if (sym) {
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

    function getTypeField(t: Type, n: string, checkOnly = false) {
        t = find(t)
        let ct = t.classType
        if (ct)
            return getClassField(ct, n, checkOnly)
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
        if (autoImport && lookupGlobalSymbol(n)) {
            return addImport(currentScope(), n, ctx.currModule)
        }
        return null
    }

    function getClassDef(e: py.Expr) {
        let n = getName(e)
        let v = lookupVar(n)
        if (v)
            return v.classdef
        let s = lookupGlobalSymbol(n)
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
        if (t.classType && t.classType.name == name)
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

    function symbolType(s: SymbolInfo): Type {
        if (isModule(s))
            return mkType({ moduleType: s })
        else if (s.kind == SK.Property)
            return s.pyRetType
        else
            return mkType({})
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
        // TODO
        if (e.kind == "Name") {
            return mkType({ primType: (e as Name).id })
        } else {
            return mkType({})
        }
    }

    function doArgs(args: py.Arguments, isMethod: boolean) {
        U.assert(!args.kwonlyargs.length)
        let nargs = args.args.slice()
        if (isMethod) {
            U.assert(nargs[0].arg == "self")
            nargs.shift()
        } else {
            U.assert(!nargs[0] || nargs[0].arg != "self")
        }
        let didx = args.defaults.length - nargs.length
        let lst = nargs.map(a => {
            let v = defvar(a.arg, { isParam: true })
            if (!a.type && a.annotation) {
                a.type = compileType(a.annotation)
                unify(a, a.type, v.type)
            }
            if (!a.type) a.type = v.type
            let res = [quote(a.arg), typeAnnot(v.type)]
            if (didx >= 0) {
                res.push(B.mkText(" = "))
                res.push(expr(args.defaults[didx]))
                unify(a, a.type, typeOf(args.defaults[didx]))
            }
            didx++
            return B.mkGroup(res)
        })

        if (args.vararg)
            lst.push(B.mkText("TODO *" + args.vararg.arg))
        if (args.kwarg)
            lst.push(B.mkText("TODO **" + args.kwarg.arg))

        return B.H.mkParenthesizedExpression(B.mkCommaSep(lst))
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
            return B.mkStmt(todoComment(`conversion failed for ${(v as any).name || v.kind}`, []));
        }
    }

    const stmtMap: Map<(v: py.Stmt) => B.JsNode> = {
        FunctionDef: (n: py.FunctionDef) => guardedScope(n, () => {
            let isMethod = !!ctx.currClass && !ctx.currFun
            if (!isMethod)
                defvar(n.name, { fundef: n })

            let topLev = isTopLevel()

            setupScope(n)
            ctx.currFun = n
            if (!n.retType) n.retType = mkType()
            let prefix = ""
            let funname = n.name
            let decs = n.decorator_list.filter(d => {
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
                todoComment("decorators", decs.map(expr))
            ]
            if (isMethod) {
                let fd = getClassField(ctx.currClass.symInfo, funname, false, true)
                if (n.body.length == 1 && n.body[0].kind == "Raise")
                    n.alwaysThrows = true
                if (n.name == "__init__") {
                    nodes.push(B.mkText("constructor"))
                    unifyClass(n, n.retType, ctx.currClass.symInfo)
                } else {
                    if (funname == "__get__" || funname == "__set__") {
                        let i2cArg = "i2cDev"
                        let vv = n.vars[i2cArg]
                        vv = n.vars["value"]
                        if (funname == "__set__" && vv) {
                            let cf = getClassField(ctx.currClass.symInfo, "__get__")
                            if (cf.pyAST && cf.pyAST.kind == "FunctionDef")
                                unify(n, vv.type, (cf.pyAST as FunctionDef).retType)
                        }
                        let nargs = n.args.args
                        if (nargs[1].arg == "obj") {
                            // rewrite
                            nargs[1].arg = i2cArg
                            if (nargs[nargs.length - 1].arg == "objtype") {
                                nargs.pop()
                                n.args.defaults.pop()
                            }
                            iterPy(n, e => {
                                if (e.kind == "Attribute") {
                                    let a = e as py.Attribute
                                    if (a.attr == "i2c_device" && getName(a.value) == "obj") {
                                        let nm = e as py.Name
                                        nm.kind = "Name"
                                        nm.id = i2cArg
                                        delete a.attr
                                        delete a.value
                                    }
                                }
                            })
                        }
                        funname = funname.replace(/_/g, "")
                    }
                    if (!prefix) {
                        prefix = funname[0] == "_" ? (fd.isProtected ? "protected" : "private") : "public"
                    }
                    nodes.push(B.mkText(prefix + " "), quote(funname))
                }
                fd.pyAST = n
            } else {
                U.assert(!prefix)
                if (n.name[0] == "_" || topLev)
                    nodes.push(B.mkText("function "), quote(funname))
                else
                    nodes.push(B.mkText("export function "), quote(funname))
            }
            nodes.push(
                doArgs(n.args, isMethod),
                n.returns ? typeAnnot(compileType(n.returns)) : B.mkText(""))

            let body = n.body.map(stmt)
            if (n.name == "__init__") {
                for (let f of U.values(ctx.currClass.fields)) {
                    if (f.initializer) {
                        body.push(
                            B.mkStmt(B.mkText(`this.${quoteStr(f.name)} = `), expr(f.initializer))
                        )
                    }
                }
            }

            nodes.push(B.mkBlock(body))

            return B.mkStmt(B.mkGroup(nodes))
        }),

        ClassDef: (n: py.ClassDef) => guardedScope(n, () => {
            setupScope(n)
            defvar(n.name, { classdef: n })
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
                nodes.push(B.mkText(" extends "))
                nodes.push(B.mkCommaSep(n.bases.map(expr)))
                let b = getClassDef(n.bases[0])
                if (b)
                    n.baseClass = b
            }
            let body = stmts(n.body)
            nodes.push(body)

            let fieldDefs = U.values(n.fields)
                .filter(f => !f.fundef && !f.isStatic && !f.isGetSet)
                .map((f) => B.mkStmt(quote(f.name), typeAnnot(f.type)))
            body.children = fieldDefs.concat(body.children)

            return B.mkStmt(B.mkGroup(nodes))
        }),

        Return: (n: py.Return) => {
            if (n.value) {
                let f = ctx.currFun
                if (f) unifyTypeOf(n.value, f.retType)
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
                let src = expr(n.value)
                let fd = getClassField(ctx.currClass.symInfo, nm)
                let attrTp = typeOf(n.value)
                let getter = getTypeField(attrTp, "__get__", true)
                /*
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
            unifyTypeOf(n.iter, mkType({ arrayType: typeOf(n.target) }))
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
                    unifyTypeOf(it.context_expr, v.type)
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
            let curr = lookupVar(id)
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
            unify(n, n.tsType, curr.type)
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
        "ord": { n: ".charCodeAt(0)", t: tpNumber },
        "bytearray": { n: "pins.createBuffer", t: tpBuffer },
        "bytes": { n: "pins.createBufferFromArray", t: tpBuffer },
        "ustruct.pack": { n: "pins.packBuffer", t: tpBuffer },
        "ustruct.pack_into": { n: "pins.packIntoBuffer", t: tpVoid },
        "ustruct.unpack": { n: "pins.unpackBuffer", t: mkType({ arrayType: tpNumber }) },
        "ustruct.unpack_from": { n: "pins.unpackBuffer", t: mkType({ arrayType: tpNumber }) },
        "ustruct.calcsize": { n: "pins.packedSize", t: tpNumber },
        "pins.I2CDevice.read_into": { n: ".readInto", t: tpVoid },
        "bool": { n: "!!", t: tpBoolean },
        "Array.index": { n: ".indexOf", t: tpNumber },
        "time.sleep": { n: "pause", t: tpVoid, scale: 1000 }
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
            let cd = getClassDef(n.func)
            let recvTp: Type
            let recv: py.Expr
            let methName: string
            let fd: py.FunctionDef

            if (cd) {
                if (cd.fields) {
                    let ff = cd.fields["__init__"]
                    if (ff)
                        fd = ff.fundef
                }
            } else {
                if (n.func.kind == "Attribute") {
                    let attr = n.func as py.Attribute
                    recv = attr.value
                    recvTp = typeOf(recv)
                    methName = attr.attr
                    let field = getTypeField(recvTp, methName)
                    /*
                    if (field) {
                        if (isSuper(recv) || (isThis(recv) && field.inClass != ctx.currClass)) {
                            field.isProtected = true
                        }
                    }
                    if (field && field.fundef)
                        fd = field.fundef
                        */
                }
                if (!fd) {
                    let name = getName(n.func)
                    let v = lookupVar(name)
                    if (v)
                        fd = v.fundef
                }
            }

            let allargs: B.JsNode[] = []
            let fdargs = fd ? fd.args.args : []
            if (fdargs[0] && fdargs[0].arg == "self")
                fdargs = fdargs.slice(1)
            for (let i = 0; i < n.args.length; ++i) {
                let e = n.args[i]
                allargs.push(expr(e))
                if (fdargs[i] && fdargs[i].type) {
                    unifyTypeOf(e, fdargs[i].type)
                }
            }

            if (fd) {
                unifyTypeOf(n, fd.retType)
            }

            let nm = getName(n.func)
            let over = U.lookup(funMap, nm)
            if (over) {
                methName = ""
                recv = null
            }

            if (methName) {
                nm = t2s(recvTp) + "." + methName
                over = U.lookup(funMap, nm)
                if (!over && find(recvTp).arrayType) {
                    nm = "Array." + methName
                    over = U.lookup(funMap, nm)
                }
            }

            if (n.keywords.length > 0) {
                if (fd && !fd.args.kwarg) {
                    let formals = fdargs.slice(n.args.length)
                    let defls = fd.args.defaults.slice()
                    while (formals.length > 0) {
                        let last = formals[formals.length - 1]
                        if (n.keywords.some(k => k.arg == last.arg))
                            break
                        formals.pop()
                        defls.pop()
                    }
                    while (defls.length > formals.length)
                        defls.shift()
                    while (defls.length < formals.length)
                        defls.unshift(null)

                    let actual = U.toDictionary(n.keywords, k => k.arg)
                    let idx = 0
                    for (let formal of formals) {
                        let ex = U.lookup(actual, formal.arg)
                        if (ex)
                            allargs.push(expr(ex.value))
                        else {
                            allargs.push(expr(defls[idx]))
                        }
                        idx++
                    }
                } else {
                    let keywords = n.keywords.slice()
                    if (keywords.length) {
                        let kwargs = keywords.map(kk =>
                            B.mkGroup([quote(kk.arg), B.mkText(": "), expr(kk.value)]))
                        allargs.push(B.mkGroup([
                            B.mkText("{"),
                            B.mkCommaSep(kwargs),
                            B.mkText("}")
                        ]))
                    }
                }
            }

            if (nm == "super" && allargs.length == 0) {
                if (ctx.currClass && ctx.currClass.baseClass)
                    unifyClass(n, n.tsType, ctx.currClass.baseClass.symInfo)
                return B.mkText("super")
            }

            if (over != null) {
                if (recv)
                    allargs.unshift(expr(recv))
                let overName = over.n
                if (over.t)
                    unifyTypeOf(n, over.t)
                if (over.scale) {
                    allargs = allargs.map(a => {
                        let s = "?"
                        if (a.type == B.NT.Prefix && a.children.length == 0)
                            s = a.op
                        let n = parseFloat(s)
                        if (!isNaN(n)) {
                            return B.mkText((over.scale * n) + "")
                        } else {
                            return B.mkInfix(a, "*", B.mkText(over.scale + ""))
                        }
                    })
                }
                if (overName == "") {
                    if (allargs.length == 1)
                        return allargs[0]
                } else if (overName[0] == ".") {
                    if (allargs.length == 1)
                        return B.mkInfix(allargs[0], ".", B.mkText(overName.slice(1)))
                    else
                        return B.mkInfix(allargs[0], ".", B.H.mkCall(overName.slice(1), allargs.slice(1)))
                } else {
                    return B.H.mkCall(overName, allargs)
                }
            }

            let fn = expr(n.func)

            if (recvTp && recvTp.arrayType) {
                if (methName == "append") {
                    methName = "push"
                    unifyTypeOf(n.args[0], recvTp.arrayType)
                }
                fn = B.mkInfix(expr(recv), ".", B.mkText(methName))
            }

            let nodes = [
                fn,
                B.mkText("("),
                B.mkCommaSep(allargs),
                B.mkText(")")
            ]

            if (cd) {
                nodes[0] = B.mkText(applyTypeMap(getFullName(cd)))
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
            return B.mkText(`hex \`${U.toHex(new Uint8Array(n.s))}\``)
        },
        NameConstant: (n: py.NameConstant) => {
            if (n.value != null)
                unify(n, n.tsType, tpBoolean)
            return B.mkText(JSON.stringify(n.value))
        },
        Ellipsis: (n: py.Ellipsis) => exprTODO(n),
        Constant: (n: py.Constant) => exprTODO(n),
        Attribute: (n: py.Attribute) => {
            let part = typeOf(n.value)
            let fd = getTypeField(part, n.attr)
            if (fd) unify(n, n.tsType, fd.pyRetType)
            else if (part.moduleType) {
                let sym = lookupGlobalSymbol(part.moduleType.name + "." + n.attr)
                if (sym)
                    unifyTypeOf(n, symbolType(sym))
                else
                    error(n, U.lf("module '{0}' has no attribute '{1}'", part.moduleType.name, n.attr))
            } else {
                error(n, U.lf("unknown object type; cannot lookup attribute '{0}'", n.attr))
            }
            return B.mkInfix(expr(n.value), ".", B.mkText(quoteStr(n.attr)))
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
            // shortcut, but should work
            if (n.id == "self" && ctx.currClass) {
                unifyClass(n, n.tsType, ctx.currClass.symInfo)
                return B.mkText("this")
            }

            let v = lookupVar(n.id)
            if (v) {
                unify(n, n.tsType, v.type)
                if (v.isImport)
                    return quote(n.id) // it's import X = Y.Z.X, use X not Y.Z.X
            } else if (currIteration > 0) {
                error(n, U.lf("name '{0}' is not defined", n.id))
            }

            if (n.ctx.indexOf("Load") >= 0) {
                let nm = getName(n)
                return quote(nm)
            } else
                return possibleDef(n)
        },
        List: mkArrayExpr,
        Tuple: mkArrayExpr,
    }

    function mkArrayExpr(n: py.List | py.Tuple) {
        unify(n, n.tsType, mkType({ arrayType: n.elts[0] ? typeOf(n.elts[0]) : mkType() }))
        return B.mkGroup([
            B.mkText("["),
            B.mkCommaSep(n.elts.map(expr)),
            B.mkText("]"),
        ])
    }

    function expr(e: py.Expr): B.JsNode {
        let f = exprMap[e.kind]
        if (!f) {
            U.oops(e.kind + " - unknown expr")
        }
        typeOf(e)
        return f(e)
    }

    function stmt(e: py.Stmt): B.JsNode {
        let f = stmtMap[e.kind]
        if (!f) {
            U.oops(e.kind + " - unknown stmt")
        }

        let cmts: string[] = (e._comments || []).map(c => c.value)

        let r = f(e)
        if (currErrs) {
            for (let err of currErrs.split("\n"))
                if (err)
                    cmts.push("ERROR: " + err)
            currErrs = ""
        }
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

    export function py2ts(opts: pxtc.CompileOptions) {
        moduleAst = {}
        apisInfo = opts.apisInfo
        if (!apisInfo)
            U.oops()
        internalApis = {}
        initApis()

        if (!opts.generatedFiles)
            opts.generatedFiles = []

        for (const fn of opts.sourceFiles) {
            if (!U.endsWith(fn, ".py"))
                continue
            let sn = fn
            let modname = fn.replace(/\.py$/, "").replace(/.*\//, "")
            let src = opts.fileSystem[fn]

            try {
                let tokens = pxt.py.lex(src)
                //console.log(pxt.py.tokensToString(tokens))
                let stmts = pxt.py.parse(src, sn, tokens)
                //console.log(pxt.py.dump(stmts))

                moduleAst[modname] = {
                    kind: "Module",
                    body: stmts,
                    name: modname,
                    source: src,
                    tsFilename: sn.replace(/\.py$/, ".ts")
                } as any
            } catch (e) {
                // TODO
                console.log("Parse error", e)
            }

        }

        for (let i = 0; i < 5; ++i) {
            currIteration = i
            for (let m of U.values(moduleAst)) {
                try {
                    toTS(m)
                } catch (e) {
                    console.log("Conv pass error", e);
                }
            }
        }

        currIteration = 1000
        currErrs = ""
        for (let m of U.values(moduleAst)) {
            try {
                let nodes = toTS(m)
                if (!nodes) continue
                let res = B.flattenNode(nodes)
                opts.sourceFiles.push(m.tsFilename)
                opts.generatedFiles.push(m.tsFilename)
                opts.fileSystem[m.tsFilename] = res.output
            } catch (e) {
                console.log("Conv error", e);
            }
        }

        return opts
    }

    export function convert(opts: pxtc.CompileOptions) {
        if (opts.target.preferredEditor == pxt.PYTHON_PROJECT_NAME) {
            py2ts(opts)
        }
    }

    pxt.conversionPasses.push(convert)
}
