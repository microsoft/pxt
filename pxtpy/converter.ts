namespace pxt.py {
    import B = pxt.blocks;
    import SK = pxtc.SymbolKind

    interface Ctx {
        currModule: py.Module;
        currClass?: py.ClassDef;
        currFun?: py.FunctionDef;
        blockDepth: number;
    }

    interface OverrideTextPart {
        kind: "text";
        text: string;
    }

    interface OverrideArgPart {
        kind: "arg";
        index: number;
        isOptional: boolean;
        prefix?: string;
        default?: string;
    }

    type OverridePart = OverrideArgPart | OverrideTextPart;

    interface TypeScriptOverride {
        parts: OverridePart[];
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
    let currErrorCtx: string | undefined = "???"
    let verboseTypes = false
    let lastAST: AST | undefined = undefined
    let lastFile: string
    let diagnostics: pxtc.KsDiagnostic[]
    let compileOptions: pxtc.CompileOptions
    let syntaxInfo: pxtc.SyntaxInfo | undefined
    let infoNode: AST | undefined = undefined
    let infoScope: ScopeDef

    // TODO: move to utils
    function isFalsy<T>(t: T | null | undefined): t is null | undefined {
        return t === null || t === undefined
    }
    function isTruthy<T>(t: T | null | undefined): t is T {
        return t !== null && t !== undefined
    }

    function stmtTODO(v: py.Stmt) {
        pxt.tickEvent("python.todo.statement", { kind: v.kind })
        return B.mkStmt(B.mkText("TODO: " + v.kind))
    }

    function exprTODO(v: py.Expr) {
        pxt.tickEvent("python.todo.expression", { kind: v.kind })
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
    let tpBuffer: Type | undefined = undefined


    const builtInTypes: Map<Type> = {
        "str": tpString,
        "string": tpString,
        "number": tpNumber,
        "bool": tpBoolean,
        "void": tpVoid,
        "any": tpAny,
    }

    function ts2PyType(syntaxKind: ts.SyntaxKind): Type {
        switch (syntaxKind) {
            case ts.SyntaxKind.StringKeyword:
                return tpString
            case ts.SyntaxKind.NumberKeyword:
                return tpNumber
            case ts.SyntaxKind.BooleanKeyword:
                return tpBoolean
            case ts.SyntaxKind.VoidKeyword:
                return tpVoid
            case ts.SyntaxKind.AnyKeyword:
                return tpAny
            default: {
                // TODO: this could be null
                return tpBuffer!
            }
        }
    }

    function cleanSymbol(s: SymbolInfo): pxtc.SymbolInfo {
        let r = U.flatClone(s)
        delete r.pyAST
        delete r.pyInstanceType
        delete r.pyRetType
        delete r.pySymbolType
        delete r.moduleTypeMarker
        delete r.declared
        if (r.parameters)
            r.parameters = r.parameters.map(p => {
                p = U.flatClone(p)
                delete p.pyType
                return p
            })
        return r
    }

    function mapTsType(tp: string): Type {
        // TODO handle specifc generic types like: SparseArray<number[]>

        // wrapped in (...)
        if (tp[0] == "(" && U.endsWith(tp, ")")) {
            return mapTsType(tp.slice(1, -1))
        }

        // lambda (...) => ...
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

        // array ...[]
        if (U.endsWith(tp, "[]")) {
            return mkArrayType(mapTsType(tp.slice(0, -2)))
        }
        if (tp === "_py.Array") {
            return mkArrayType(tpAny);
        }

        // builtin
        const t = U.lookup(builtInTypes, tp)
        if (t) return t

        // handle number litterals like "-20" (b/c TS loves to give specific types to const's)
        let isNum = !!tp && !isNaN(tp as any as number) // https://stackoverflow.com/questions/175739
        if (isNum)
            return tpNumber

        // generic
        if (tp == "T" || tp == "U") // TODO hack!
            return mkType({ primType: "'" + tp })

        // union
        if (tp.indexOf("|") >= 0) {
            const parts = tp.split("|")
                .map(p => p.trim())
            return mkType({
                primType: "@union",
                typeArgs: parts.map(mapTsType)
            })
        }

        // defined by a symbol,
        //  either in external (non-py) APIs (like default/common packages)
        //  or in internal (py) APIs (probably main.py)
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

    function getOrSetSymbolType(sym: SymbolInfo): Type {
        if (!sym.pySymbolType) {
            currErrorCtx = sym.pyQName

            if (sym.parameters) {
                if (pxtc.service.isTaggedTemplate(sym)) {
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
                if (sym.retType) {
                    if (sym.qName?.endsWith(".__constructor") && sym.retType === "void") {
                        // This must be a TS class. Because python treats constructors as functions,
                        // set the return type to be the class instead of void
                        const classSym = lookupGlobalSymbol(sym.qName.substring(0, sym.qName.lastIndexOf(".")));

                        if (classSym) {
                            sym.pyRetType = mkType({
                                classType: classSym
                            });
                        }
                        else {
                            sym.pyRetType = mapTsType(sym.retType)
                        }
                    }
                    else {
                        sym.pyRetType = mapTsType(sym.retType)
                    }
                }
                else if (sym.pyRetType) {
                    // nothing to do
                } else {
                    U.oops("no type for: " + sym.pyQName)
                    sym.pyRetType = mkType({})
                }
            }

            if (prevRetType) {
                unify(sym.pyAST, prevRetType, sym.pyRetType)
            }

            if (sym.kind == SK.Function || sym.kind == SK.Method) {
                let paramTypes = sym.parameters.map(p => p.pyType)
                if (paramTypes.some(isFalsy)) {
                    error(null, 9526, U.lf("function symbol is missing parameter types near '{1}'", currErrorCtx || "???"))
                    return mkType({})
                }
                sym.pySymbolType = mkFunType(sym.pyRetType, paramTypes.filter(isTruthy))
            }
            else
                sym.pySymbolType = sym.pyRetType

            if (sym.kind == SK.Class || sym.kind == SK.Interface) {
                sym.pyInstanceType = mkType({ classType: sym })
            }

            currErrorCtx = undefined
        }
        return sym.pySymbolType
    }

    function lookupApi(name: string) {
        return U.lookup(internalApis, name) || U.lookup(externalApis, name)
    }

    function lookupGlobalSymbol(name: string): SymbolInfo | undefined {
        if (!name) return undefined
        let sym = lookupApi(name)
        if (sym)
            getOrSetSymbolType(sym)
        else if (name.indexOf(".") && !name.endsWith(".__constructor")) {
            const base = name.substring(0, name.lastIndexOf("."));
            const baseSymbol = lookupGlobalSymbol(base);

            if (baseSymbol?.kind === SK.Class && baseSymbol.extendsTypes?.length) {
                return lookupGlobalSymbol(baseSymbol.extendsTypes[0] + name.substring(base.length));
            }
        }
        return sym
    }

    function initApis(apisInfo: pxtc.ApisInfo, tsShadowFiles: string[]) {
        internalApis = {}
        externalApis = {}

        let tsShadowFilesSet = U.toDictionary(tsShadowFiles, t => t)
        for (let sym of U.values(apisInfo.byQName)) {
            if (tsShadowFilesSet.hasOwnProperty(sym.fileName)) {
                continue
            }

            let sym2 = sym as SymbolInfo

            if (sym2.extendsTypes)
                sym2.extendsTypes = sym2.extendsTypes.filter(e => e != sym2.qName)

            if (!sym2.pyQName || !sym2.qName) {
                error(null, 9526, U.lf("Symbol '{0}' is missing qName for '{1}'", sym2.name, !sym2.pyQName ? "py" : "ts"))
            }
            externalApis[sym2.pyQName!] = sym2
            externalApis[sym2.qName!] = sym2
        }

        // TODO this is for testing mostly; we can do this lazily
        // for (let sym of U.values(externalApis)) {
        //     if (sym)
        //         getOrSetSymbolType(sym)
        // }

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
    function isFunType(t: Type): boolean {
        return !!U.startsWith(t.primType || "", "@fn")
    }
    function isPrimativeType(t: Type): boolean {
        return !!t.primType && !U.startsWith(t.primType, "@")
    }
    function isUnionType(t: Type): boolean {
        return !!U.startsWith(t.primType || "", "@union")
    }

    function instanceType(sym: SymbolInfo): Type {
        getOrSetSymbolType(sym)
        if (!sym.pyInstanceType)
            error(null, 9527, U.lf("Instance type symbol '{0}' is missing pyInstanceType", sym))
        return sym.pyInstanceType!
    }

    function currentScope(): py.ScopeDef {
        return ctx.currFun || ctx.currClass || ctx.currModule
    }

    function topScope(): py.ScopeDef {
        let current = currentScope();

        while (current && current.parent) {
            current = current.parent;
        }

        return current;
    }

    function isTopLevel() {
        return ctx.currModule.name == "main" && !ctx.currFun && !ctx.currClass
    }

    function addImport(a: AST, name: string, scope?: ScopeDef): SymbolInfo {
        const sym = lookupGlobalSymbol(name)
        if (!sym)
            error(a, 9503, U.lf("No module named '{0}'", name))
        return sym!
    }

    function getHelperVariableName() {
        const scope = currentScope();

        if (scope.nextHelperVariableId === undefined) {
            scope.nextHelperVariableId = 0;
        }

        return "___tempvar" + scope.nextHelperVariableId++
    }

    function defvar(name: string, opts: py.VarDescOptions, modifier?: VarModifier, scope?: ScopeDef): ScopeSymbolInfo {
        if (!scope)
            scope = currentScope()
        let varScopeSym = scope.vars[name]
        let varSym = varScopeSym?.symbol;
        if (!varSym) {
            let pref = getFullName(scope)
            if (pref) {
                pref += "."
            }
            let qualifiedName = pref + name

            if (scope.kind === "ClassDef") {
                varSym = addSymbol(SK.Property, qualifiedName)
            }
            else if (isLocalScope(scope)
                && (modifier === VarModifier.Global
                    || modifier === VarModifier.NonLocal)) {
                varSym = addSymbol(SK.Variable, name)
            }
            else if (isLocalScope(scope))
                varSym = mkSymbol(SK.Variable, name)
            else
                varSym = addSymbol(SK.Variable, qualifiedName)
            varScopeSym = {
                symbol: varSym,
                modifier,
            };
            scope.vars[name] = varScopeSym;
        }
        for (let k of Object.keys(opts)) {
            (varSym as any)[k] = (opts as any)[k]
        }
        return varScopeSym
    }

    function canonicalize(t: Type): Type {
        if (t.unifyWith) {
            t.unifyWith = canonicalize(t.unifyWith)
            return t.unifyWith
        }
        return t
    }

    // TODO cache it?
    function getFullName(n: py.AST): string {
        let s = n as py.ScopeDef
        let pref = ""
        if (s.parent && s.parent.kind !== "FunctionDef" && s.parent.kind !== "AsyncFunctionDef") {
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

    function applyTypeMap(s: string): string {
        let over = U.lookup(typeMap, s)
        if (over) return over
        for (let scopeVar of U.values(ctx.currModule.vars)) {
            let v = scopeVar.symbol
            if (!v.isImport)
                continue
            if (v.expandsTo == s) {
                if (!v.pyName)
                    error(null, 9553, lf("missing pyName"));
                return v.pyName!
            }
            if (v.isImport && U.startsWith(s, (v.expandsTo || "") + ".")) {
                return v.pyName + s.slice(v.expandsTo!.length)
            }
        }
        return s
    }

    function t2s(t: Type): string {
        t = canonicalize(t)
        const suff = (s: string) => verboseTypes ? s : ""
        if (t.primType) {
            if (t.typeArgs && t.primType == "@array") {
                return t2s(t.typeArgs[0]) + "[]"
            }

            if (isFunType(t) && t.typeArgs)
                return "(" + t.typeArgs.slice(1).map(t => "_: " + t2s(t)).join(", ") + ") => " + t2s(t.typeArgs[0])

            if (isUnionType(t) && t.typeArgs) {
                return t.typeArgs.map(t2s).join(" | ")
            }

            return t.primType + suff("/P")
        }

        if (t.classType && t.classType.pyQName)
            return applyTypeMap(t.classType.pyQName) + suff("/C")
        else if (t.moduleType && t.moduleType.pyQName)
            return applyTypeMap(t.moduleType.pyQName) + suff("/M")
        else
            return "any"
    }

    function mkDiag(astNode: py.AST | undefined | null, category: pxtc.DiagnosticCategory, code: number, messageText: string): pxtc.KsDiagnostic {
        if (!astNode)
            astNode = lastAST
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

    // next free error 9576
    function error(astNode: py.AST | null | undefined, code: number, msg: string) {
        diagnostics.push(mkDiag(astNode, pxtc.DiagnosticCategory.Error, code, msg))
        //const pos = position(astNode ? astNode.startPos || 0 : 0, mod.source)
        //currErrs += U.lf("{0} near {1}{2}", msg, mod.tsFilename.replace(/\.ts/, ".py"), pos) + "\n"
    }

    function typeError(a: py.AST | undefined, t0: Type, t1: Type) {
        error(a, 9500, U.lf("types not compatible: {0} and {1}", t2s(t0), t2s(t1)))
    }

    function typeCtor(t: Type): string | SymbolInfo | {} | null {
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
        return !typeCtor(canonicalize(t))
    }

    function canUnify(t0: Type, t1: Type): boolean {
        t0 = canonicalize(t0)
        t1 = canonicalize(t1)

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
        t = canonicalize(t)
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

    function unify(a: AST | undefined, t0: Type, t1: Type): void {
        if (t0 === t1)
            return

        t0 = canonicalize(t0)
        t1 = canonicalize(t1)

        // We don't handle generic types yet, so bail out. Worst case
        // scenario is that we infer some extra types as "any"
        if (t0 === t1 || isGenericType(t0) || isGenericType(t1))
            return

        if (t0.primType === "any") {
            t0.unifyWith = t1
            return
        }

        const c0 = typeCtor(t0)
        const c1 = typeCtor(t1)

        if (c0 && c1) {
            if (c0 === c1) {
                t0.unifyWith = t1 // no type-state change here - actual change would be in arguments only
                if (t0.typeArgs && t1.typeArgs) {
                    for (let i = 0; i < Math.min(t0.typeArgs.length, t1.typeArgs.length); ++i)
                        unify(a, t0.typeArgs[i], t1.typeArgs[i])
                }
                t0.unifyWith = t1
            } else {
                typeError(a, t0, t1)
            }
        } else if (c0 && !c1) {
            unify(a, t1, t0)
        } else {
            // the type state actually changes here
            numUnifies++
            t0.unifyWith = t1
            // detect late unifications
            // if (currIteration > 2) error(a, `unify ${t2s(t0)} ${t2s(t1)}`)
        }
    }

    function isAssignable(fromT: Type, toT: Type): boolean {
        // TODO: handle assignablity beyond interfaces and classes, e.g. "any", generics, arrays, ...

        const t0 = canonicalize(fromT)
        const t1 = canonicalize(toT)

        if (t0 === t1)
            return true;

        const c0 = typeCtor(t0)
        const c1 = typeCtor(t1)

        if (c0 === c1)
            return true;

        if (c0 && c1) {
            if (isSymbol(c0) && isSymbol(c1)) {
                // check extends relationship (e.g. for interfaces & classes)
                if (c0.extendsTypes && c0.extendsTypes.length) {
                    if (c0.extendsTypes.some(e => e === c1.qName)) {
                        return true
                    }
                }
            }
            // check unions
            if (isUnionType(t1)) {
                for (let uT of t1.typeArgs || []) {
                    if (isAssignable(t0, uT))
                        return true
                }
                return false
            }
        }

        return false
    }

    function narrow(e: Expr, constrainingType: Type): void {
        const t0 = canonicalize(typeOf(e))
        const t1 = canonicalize(constrainingType)

        if (isAssignable(t0, t1)) {
            return;
        }

        // if we don't know if two types are assignable, we can try to unify them in common cases
        // TODO: unification is too strict but should always be sound
        if (isFunType(t0) || isFunType(t1)
            || isPrimativeType(t0) || isPrimativeType(t1)) {
            unify(e, t0, t1)
        } else {
            // if we're not sure about assinability or unification, we do nothing as future
            // iterations may unify or make assinability clear.
            // TODO: Ideally what we should do is track a "constraining type" similiar to how we track .union
            // per type, and ensure the constraints are met as we unify or narrow types. The difficulty is that
            // this depends on a more accurate assignability check which will take some work to get right.
        }
    }

    function isSymbol(c: string | SymbolInfo | {} | null): c is SymbolInfo {
        return !!(c as SymbolInfo)?.name
    }

    function isGenericType(t: Type) {
        return !!(t?.primType?.startsWith("'"));
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
        if (!sym.pyQName)
            error(null, 9527, U.lf("Symbol '{0}' is missing pyQName", qname))

        internalApis[sym.pyQName!] = sym
        return sym
    }

    function isLocalScope(scope: ScopeDef) {
        let s: ScopeDef | undefined = scope
        while (s) {
            if (s.kind == "FunctionDef")
                return true
            s = s.parent
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
            if (!sym.pyName)
                error(null, 9528, U.lf("Symbol '{0}' is missing pyName", sym.qName || sym.name))
            scope.vars[sym.pyName!] = {
                symbol: sym
            }
        }
        return n.symInfo
    }

    // TODO optimize ?
    function listClassFields(cd: ClassDef) {
        let qn = cd.symInfo.qName
        return U.values(internalApis).filter(e => e.namespace == qn && e.kind == SK.Property)
    }

    function getClassField(ct: SymbolInfo, n: string, isStatic: boolean, checkOnly = false, skipBases = false): SymbolInfo | null {
        let qid: string;

        if (n === "__init__") {
            qid = ct.pyQName + ".__constructor"
        }
        else {
            if (n.startsWith(ct.pyQName + ".")) {
                qid = n;
            }
            else {
                qid = ct.pyQName + "." + n;
            }
        }

        let f = lookupGlobalSymbol(qid)
        if (f)
            return f

        if (!skipBases) {
            for (let b of ct.extendsTypes || []) {
                let sym = lookupGlobalSymbol(b)
                if (sym) {
                    if (sym == ct)
                        U.userError("field lookup loop on: " + sym.qName + " / " + n)
                    let classF = getClassField(sym, n, isStatic, true)
                    if (classF)
                        return classF
                }
            }
        }

        if (!checkOnly && ct.pyAST && ct.pyAST.kind == "ClassDef") {
            let sym = addSymbol(SK.Property, qid)
            sym.isInstance = !isStatic;
            return sym
        }
        return null
    }

    function getTypesForFieldLookup(recvType: Type): SymbolInfo[] {
        let t = canonicalize(recvType)
        return [
            t.classType,
            ...resolvePrimTypes(t.primType),
            t.moduleType
        ].filter(isTruthy)
    }

    function getTypeField(recv: Expr, n: string, checkOnly = false) {
        const recvType = typeOf(recv)
        const constructorTypes = getTypesForFieldLookup(recvType)

        for (let ct of constructorTypes) {
            let isModule = !!recvType.moduleType
            let f = getClassField(ct, n, isModule, checkOnly)
            if (f) {
                if (isModule) {
                    if (f.isInstance)
                        error(null, 9505, U.lf("the field '{0}' of '{1}' is not static", n, ct.pyQName))
                } else {
                    if (isSuper(recv))
                        f.isProtected = true
                    else if (isThis(recv)) {
                        if (!ctx.currClass)
                            error(null, 9529, U.lf("no class context found for {0}", f.pyQName))
                        if (f.namespace != ctx.currClass!.symInfo.qName) {
                            f.isProtected = true
                        }
                    }
                }
                return f
            }
        }
        return null
    }

    function resolvePrimTypes(primType: string | undefined): SymbolInfo[] {
        let res: SymbolInfo[] = []
        if (primType == "@array") {
            res = [lookupApi("_py.Array"), lookupApi("Array")]
        } else if (primType == "string") {
            // we need to check both the special "_py" namespace and the typescript "String"
            // class because for example ".length" is only defined in the latter
            res = [lookupApi("_py.String"), lookupApi("String")]
        }
        return res.filter(a => !!a)
    }

    function lookupVar(n: string): ScopeSymbolInfo | null {
        let s: ScopeDef | undefined = currentScope()
        let v = U.lookup(s.vars, n)
        if (v) return v
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

    function lookupScopeSymbol(n: string | undefined): ScopeSymbolInfo | undefined | null {
        if (!n)
            return null

        const firstDot = n.indexOf(".")
        if (firstDot > 0) {
            const scopeVar = lookupVar(n.slice(0, firstDot))
            const v = scopeVar?.symbol;
            // expand name if needed
            if (v && v.pyQName != v.pyName)
                n = v.pyQName + n.slice(firstDot)
        } else {
            const v = lookupVar(n)
            if (v) return v
        }
        let globalSym = lookupGlobalSymbol(n)
        if (!globalSym)
            return undefined
        return {
            symbol: globalSym
        }
    }

    function lookupSymbol(n: string | undefined): SymbolInfo | undefined | null {
        return lookupScopeSymbol(n)?.symbol
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
            return canonicalize(e.tsType)
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
            currClass: undefined,
            currFun: undefined,
            currModule: m,
            blockDepth: 0
        }
        lastFile = m.tsFilename.replace(/\.ts$/, ".py")
    }

    function isModule(s: SymbolInfo | undefined) {
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
        let tpName = tryGetName(e)
        if (tpName) {
            let sym = lookupApi(tpName + "@type") || lookupApi(tpName)
            if (sym) {
                getOrSetSymbolType(sym)
                if (sym.kind == SK.Enum)
                    return tpNumber

                if (sym.pyInstanceType)
                    return sym.pyInstanceType
            }
            else if (builtInTypes[tpName])
                return builtInTypes[tpName]

            error(e, 9506, U.lf("cannot find type '{0}'", tpName))
        }
        else {
            // translate Python to TS type annotation for arrays
            // example: List[str] => string[]
            if (isSubscript(e)/*i.e. [] syntax*/) {
                let isList = tryGetName(e.value) === "List"
                if (isList) {
                    if (isIndex(e.slice)) {
                        let listTypeArg = compileType(e.slice.value)
                        let listType = mkArrayType(listTypeArg)
                        return listType
                    }
                }
            }
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
            if (nargs[0]?.arg !== "self") n.symInfo.isStatic = true;
            else {
                nargs.shift();
            }
        } else {
            if (nargs.some(a => a.arg == "self"))
                error(n, 9519, U.lf("non-methods cannot have an argument called 'self'"))
        }
        if (!n.symInfo.parameters) {
            let didx = args.defaults.length - nargs.length
            n.symInfo.parameters = nargs.map(a => {
                if (!a.annotation)
                    error(n, 9519, U.lf("Arg '{0}' missing annotation", a.arg))
                let tp = compileType(a.annotation!)
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
            let scopeV = defvar(p.name, { isParam: true })
            let v = scopeV?.symbol
            if (!p.pyType)
                error(n, 9530, U.lf("parameter '{0}' missing pyType", p.name))
            unify(n, getOrSetSymbolType(v), p.pyType!)
            let res = [quote(p.name), typeAnnot(p.pyType!, true)]
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
        if (!f.pyName || f.pyName[0] != "_")
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

    const arithmeticCompareOps: Map<number> = {
        Eq: 1,
        NotEq: 1,
        Lt: 1,
        LtE: 1,
        Gt: 1,
        GtE: 1
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
        ctx.blockDepth++;
        const res = B.mkBlock(ss.map(stmt));
        ctx.blockDepth--;
        return res;
    }

    function exprs0(ee: py.Expr[]) {
        ee = ee.filter(e => !!e)
        return ee.map(expr)
    }

    function setupScope(n: py.ScopeDef) {
        if (!n.vars) {
            n.vars = {}
            n.parent = currentScope()
            n.blockDepth = ctx.blockDepth;
        }
    }

    function typeAnnot(t: Type, defaultToAny = false) {
        let s = t2s(t)
        if (s === "any") {
            // TODO:
            // example from minecraft doc snippet:
            // player.onChat("while",function(num1){while(num1<10){}})
            // -> py -> ts ->
            // player.onChat("while",function(num1:any;/**TODO:type**/){while(num1<10){;}})
            // work around using any:
            // return B.mkText(": any /** TODO: type **/")
            // but for now we can just omit the type and most of the type it'll be inferable
            return defaultToAny ? B.mkText(": any") : B.mkText("")
        }
        return B.mkText(": " + t2s(t))
    }

    function guardedScope(v: py.AST, f: () => B.JsNode) {
        try {
            return scope(f);
        }
        catch (e) {
            pxt.log(e)
            return B.mkStmt(todoComment(`conversion failed for ${(v as any).name || v.kind}`, []));
        }
    }

    function shouldInlineFunction(si: SymbolInfo | undefined) {
        if (!si || !si.pyAST)
            return false
        if (si.pyAST.kind != "FunctionDef")
            return false
        const fn = si.pyAST as FunctionDef
        if (!fn.callers || fn.callers.length != 1)
            return false
        if (fn.callers[0].inCalledPosition)
            return false
        return true
    }

    function emitFunctionDef(n: FunctionDef, inline = false) {
        return guardedScope(n, () => {
            const isMethod = !!ctx.currClass && !ctx.currFun

            const topLev = isTopLevel()
            const nested = !!ctx.currFun;

            setupScope(n)
            const existing = lookupSymbol(getFullName(n));
            const sym = addSymbolFor(isMethod ? SK.Method : SK.Function, n)

            if (!inline) {
                if (existing && existing.declared === currIteration) {
                    error(n, 9520, lf("Duplicate function declaration"));
                }

                sym.declared = currIteration;

                if (shouldInlineFunction(sym)) {
                    return B.mkText("")
                }
            }

            if (isMethod) sym.isInstance = true
            ctx.currFun = n
            let prefix = ""
            let funname = n.name
            const remainingDecorators = n.decorator_list.filter(d => {
                if (tryGetName(d) == "property") {
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
                if (!ctx.currClass)
                    error(n, 9531, lf("method '{0}' is missing current class context", sym.pyQName));
                if (!sym.pyRetType)
                    error(n, 9532, lf("method '{0}' is missing a return type", sym.pyQName));
                if (n.name == "__init__") {
                    nodes.push(B.mkText("constructor"))
                    unifyClass(n, sym.pyRetType!, ctx.currClass!.symInfo)
                } else {
                    if (funname == "__get__" || funname == "__set__") {
                        let scopeValueVar = n.vars["value"]
                        let valueVar = scopeValueVar?.symbol
                        if (funname == "__set__" && valueVar) {
                            let cf = getClassField(ctx.currClass!.symInfo, "__get__", false)
                            if (cf && cf.pyAST && cf.pyAST.kind == "FunctionDef")
                                unify(n, valueVar.pyRetType!, cf.pyRetType!)
                        }
                        funname = funname.replace(/_/g, "")
                    }
                    if (!prefix) {
                        prefix = funname[0] == "_" ? (sym.isProtected ? "protected" : "private") : "public"
                        if (n.symInfo.isStatic) {
                            prefix += " static";
                        }
                    }

                    nodes.push(B.mkText(prefix + " "), quote(funname))
                }
            } else {
                U.assert(!prefix)
                if (n.name[0] == "_" || topLev || inline || nested)
                    nodes.push(B.mkText("function "), quote(funname))
                else
                    nodes.push(B.mkText("export function "), quote(funname))
            }
            let retType = n.name == "__init__" ? undefined : (n.returns ? compileType(n.returns) : sym.pyRetType);
            nodes.push(
                doArgs(n, isMethod),
                retType && canonicalize(retType) != tpVoid ? typeAnnot(retType) : B.mkText(""))

            // make sure type is initialized
            getOrSetSymbolType(sym)

            let body = n.body.map(stmt)
            if (n.name == "__init__") {
                if (!ctx.currClass)
                    error(n, 9533, lf("__init__ method '{0}' is missing current class context", sym.pyQName));

                if (ctx.currClass?.baseClass) {
                    const firstStatement = n.body[0]

                    const superConstructor = ctx.currClass.baseClass.pyQName + ".__constructor"

                    if (((firstStatement as ExprStmt).value as Call)?.func?.symbolInfo?.pyQName !== superConstructor) {
                        error(n, 9575, lf("Sub classes must call 'super().__init__' as the first statement inside an __init__ method"));
                    }
                }

                for (let f of listClassFields(ctx.currClass!)) {
                    let p = f.pyAST as Assign
                    if (p && p.value) {
                        body.push(
                            B.mkStmt(B.mkText(`this.${quoteStr(f.pyName!)} = `), expr(p.value))
                        )
                    }
                }
            }

            const hoisted: B.JsNode[] = collectHoistedDeclarations(n);

            nodes.push(B.mkBlock(hoisted.concat(body)))

            let ret = B.mkGroup(nodes)

            if (inline)
                nodes[nodes.length - 1].noFinalNewline = true
            else
                ret = B.mkStmt(ret)

            return ret
        })
    }

    const stmtMap: Map<(v: py.Stmt) => B.JsNode> = {
        FunctionDef: (n: py.FunctionDef) => emitFunctionDef(n),

        ClassDef: (n: py.ClassDef) => guardedScope(n, () => {
            setupScope(n)

            const sym = addSymbolFor(SK.Class, n)

            U.assert(!ctx.currClass)
            let topLev = isTopLevel()
            ctx.currClass = n
            n.isNamespace = n.decorator_list.some(d => d.kind == "Name" && (<Name>d).id == "namespace");
            let nodes = n.isNamespace ?
                [B.mkText("namespace "), quote(n.name)]
                : [
                    todoComment("keywords", n.keywords.map(doKeyword)),
                    todoComment("decorators", n.decorator_list.map(expr)),
                    B.mkText(topLev ? "class " : "export class "),
                    quote(n.name)
                ]
            if (!n.isNamespace && n.bases.length > 0) {
                if (tryGetName(n.bases[0]) == "Enum") {
                    n.isEnum = true
                } else {
                    nodes.push(B.mkText(" extends "))
                    nodes.push(B.mkCommaSep(n.bases.map(expr)))
                    let b = getClassDef(n.bases[0])
                    if (b) {
                        n.baseClass = b.symInfo
                        sym.extendsTypes = [b.symInfo.pyQName!]
                    }
                    else {
                        const nm = tryGetName(n.bases[0]);

                        if (nm) {
                            const localSym = lookupSymbol(nm);
                            const globalSym = lookupGlobalSymbol(nm);

                            n.baseClass = localSym || globalSym;

                            if (n.baseClass) sym.extendsTypes = [n.baseClass.pyQName!]
                        }
                    }
                }
            }

            const classDefs = n.body.filter(s => n.isNamespace || s.kind === "FunctionDef");
            const staticStmts = n.isNamespace ? [] : n.body.filter(s => classDefs.indexOf(s) === -1 && s.kind !== "Pass");

            let body = stmts(classDefs)
            nodes.push(body)

            // Python classes allow arbitrary statements in their bodies, sort of like namespaces.
            // Take all of these statements and put them in a static method that we can call when
            // the class is defined.
            let generatedInitFunction = false;
            if (staticStmts.length) {
                generatedInitFunction = true;

                const staticBody = stmts(staticStmts);

                const initFun = B.mkStmt(B.mkGroup([
                    B.mkText(`public static __init${n.name}() `),
                    staticBody
                ]))

                body.children.unshift(initFun);
            }

            if (!n.isNamespace) {

                const fieldDefs = listClassFields(n)
                    .map(f => {
                        if (!f.pyName || !f.pyRetType)
                            error(n, 9535, lf("field definition missing py name or return type", f.qName));
                        return f
                    });
                const staticFieldSymbols = fieldDefs.filter(f => !f.isInstance);

                const instanceFields = fieldDefs.filter(f => f.isInstance)
                    .map((f) => B.mkStmt(accessAnnot(f), quote(f.pyName!), typeAnnot(f.pyRetType!)));
                const staticFields = staticFieldSymbols
                    .map((f) =>
                    B.mkGroup([
                        B.mkStmt(accessAnnot(f), B.mkText("static "), quote(f.pyName!), typeAnnot(f.pyRetType!)),
                        declareLocalStatic(quoteStr(n.name), quoteStr(f.pyName!), t2s(f.pyRetType!))
                    ]));

                body.children = staticFields.concat(instanceFields).concat(body.children)
            }

            if (generatedInitFunction) {
                nodes = [
                    B.mkStmt(B.mkGroup(nodes)),
                    B.mkStmt(B.mkText(`${n.name}.__init${n.name}()`))
                ]
            }

            return B.mkStmt(B.mkGroup(nodes))
        }),

        Return: (n: py.Return) => {
            if (n.value) {
                let f = ctx.currFun
                if (f) {
                    if (!f.symInfo.pyRetType)
                        error(n, 9536, lf("function '{0}' missing return type", f.symInfo.pyQName));
                    unifyTypeOf(n.value, f.symInfo.pyRetType!)
                }
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
            return convertAssign(n)
        },
        AnnAssign: (n: py.AnnAssign) => {
            return convertAssign(n)
        },
        For: (n: py.For) => {
            U.assert(n.orelse.length == 0)
            n.target.forTargetEndPos = n.endPos
            if (isCallTo(n.iter, "range")) {
                let r = n.iter as py.Call
                let def = expr(n.target)
                let ref = quote(getName(n.target))
                unifyTypeOf(n.target, tpNumber)
                let start = r.args.length == 1 ? B.mkText("0") : expr(r.args[0])
                let stop = expr(r.args[r.args.length == 1 ? 0 : 1])

                if (r.args.length <= 2) {
                    return B.mkStmt(
                        B.mkText("for ("),
                        B.mkInfix(def, "=", start),
                        B.mkText("; "),
                        B.mkInfix(ref, "<", stop),
                        B.mkText("; "),
                        B.mkPostfix([ref], "++"),
                        B.mkText(")"),
                        stmts(n.body)
                    );
                }

                // If there are three range arguments, the comparator we need to use
                // will either be > or < depending on the sign of the third argument.
                let numValue = r.args[2].kind === "Num" ? (r.args[2] as Num).n : undefined;

                if (numValue == undefined && r.args[2].kind === "UnaryOp") {
                    const uOp = r.args[2] as UnaryOp;

                    if (uOp.operand.kind === "Num") {
                        if (uOp.op === "UAdd") numValue = (uOp.operand as Num).n;
                        else if (uOp.op === "USub") numValue = -(uOp.operand as Num).n
                    }
                }

                // If the third argument is not a number, we can't know the sign so we
                // have to emit a for-of loop instead
                if (numValue !== undefined) {
                    const comparator = numValue > 0 ? "<" : ">";
                    return B.mkStmt(
                        B.mkText("for ("),
                        B.mkInfix(def, "=", start),
                        B.mkText("; "),
                        B.mkInfix(ref, comparator, stop),
                        B.mkText("; "),
                        B.mkInfix(ref, "+=", expr(r.args[2])),
                        B.mkText(")"),
                        stmts(n.body)
                    );
                }
            }

            if (currIteration > 1) {
                const typeOfTarget = typeOf(n.target);
                /**
                 * The type the variable to iterate over must be `string | Iterable<typeof Target>`,
                 * but we can't model that with the current state of the python type checker.
                 * If we can identify the type of the value we're iterating over to be a string elsewhere,
                 * try and allow this by unifying with just the target type;
                 * otherwise, it is assumed to be an array.
                 */
                unifyTypeOf(n.iter, typeOf(n.iter) == tpString ? typeOfTarget : mkArrayType(typeOfTarget));
            }

            return B.mkStmt(
                B.mkText("for ("),
                expr(n.target),
                B.mkText(" of "),
                expr(n.iter),
                B.mkText(")"),
                stmts(n.body)
            );
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
                let res: B.JsNode[] = []
                let devRef = expr(it.context_expr)
                if (it.optional_vars) {
                    let id = tryGetName(it.optional_vars)
                    if (id) {
                        let scopeV = defvar(id, { isLocal: true })
                        let v = scopeV?.symbol
                        id = quoteStr(id)
                        res.push(B.mkStmt(B.mkText("const " + id + " = "), devRef))
                        if (!v.pyRetType)
                            error(n, 9537, lf("function '{0}' missing return type", v.pyQName));
                        unifyTypeOf(it.context_expr, v.pyRetType!)
                        devRef = B.mkText(id)
                    }
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
            let msg: B.JsNode | undefined = undefined
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
        Assert: (n: py.Assert) => {
            if (!n.msg)
                error(n, 9537, lf("assert missing message"));
            return B.mkStmt(B.H.mkCall("control.assert", exprs0([n.test, n.msg!])))
        },
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
                if (nn.name == "*") {
                    if (!n.module)
                        error(n, 9538, lf("import missing module name"));
                    defvar(n.module!, {
                        isImportStar: true
                    })
                }
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
        Pass: (n: py.Pass) => B.mkStmt(B.mkText("")),
        Break: (n: py.Break) => B.mkStmt(B.mkText("break")),
        Continue: (n: py.Continue) => B.mkStmt(B.mkText("continue")),

        Delete: (n: py.Delete) => {
            error(n, 9550, U.lf("delete statements are unsupported"));
            return stmtTODO(n)
        },
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
        AsyncFunctionDef: (n: py.AsyncFunctionDef) => {
            error(n, 9551, U.lf("async function definitions are unsupported"));
            return stmtTODO(n)
        },
        AsyncFor: (n: py.AsyncFor) => {
            error(n, 9552, U.lf("async for statements are unsupported"));
            return stmtTODO(n)
        },
        AsyncWith: (n: py.AsyncWith) => {
            error(n, 9553, U.lf("async with statements are unsupported"));
            return stmtTODO(n)
        },
        Global: (n: py.Global) => {
            const globalScope = topScope();
            const current = currentScope();

            for (const name of n.names) {
                const existing = U.lookup(globalScope.vars, name);

                if (!existing) {
                    error(n, 9521, U.lf("No binding found for global variable"));
                }

                const sym = defvar(name, {}, VarModifier.Global);

                if (sym.firstRefPos! < n.startPos) {
                    error(n, 9522, U.lf("Variable referenced before global declaration"))
                }
            }
            return B.mkStmt(B.mkText(""));
        },
        Nonlocal: (n: py.Nonlocal) => {
            const globalScope = topScope();
            const current = currentScope();

            for (const name of n.names) {
                const declaringScope = findNonlocalDeclaration(name, current);

                // Python nonlocal variables cannot refer to globals
                if (!declaringScope || declaringScope === globalScope || declaringScope.vars[name].modifier === VarModifier.Global) {
                    error(n, 9523, U.lf("No binding found for nonlocal variable"));
                }

                const sym = defvar(name, {}, VarModifier.NonLocal);

                if (sym.firstRefPos! < n.startPos) {
                    error(n, 9524, U.lf("Variable referenced before nonlocal declaration"))
                }
            }
            return B.mkStmt(B.mkText(""));
        }
    }

    function convertAssign(n: py.AnnAssign | py.Assign): B.JsNode {
        let annotation: Expr | null;
        let annotAsType: Type | null;
        let value: Expr | null;
        let target: Expr;
        // TODO handle more than 1 target
        if (n.kind === "Assign") {
            if (n.targets.length != 1) {
                error(n, 9553, U.lf("multi-target assignment statements are unsupported"));
                return stmtTODO(n)
            }
            target = n.targets[0]
            value = n.value
            annotation = null
            annotAsType = null
        } else if (n.kind === "AnnAssign") {
            target = n.target
            value = n.value || null
            annotation = n.annotation
            annotAsType = compileType(annotation);

            // process annotated type, unify with target
            unifyTypeOf(target, annotAsType);
        } else {
            return n;
        }

        let pref = ""
        let isConstCall = value ? isCallTo(value, "const") : false
        let nm = tryGetName(target) || ""
        if (!isTopLevel() && !ctx.currClass && !ctx.currFun && nm[0] != "_")
            pref = "export "
        if (nm && ctx.currClass && !ctx.currFun) {
            // class fields can't be const
            // hack: value in @namespace should always be const
            isConstCall = !!(value && ctx.currClass.isNamespace);
            let fd = getClassField(ctx.currClass.symInfo, nm, true)
            if (!fd)
                error(n, 9544, lf("cannot get class field"));
            // TODO: use or remove this code
            /*
            let src = expr(value)
            let attrTp = typeOf(value)
            let getter = getTypeField(value, "__get__", true)
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
                fdBack.initializer = value
                fd.isGetSet = true
                fdBack.isGetSet = true
                return B.mkGroup(res)
            } else
            */
            if (currIteration == 0) {
                return B.mkText("/* skip for now */")
            }
            if (!fd!.pyRetType)
                error(n, 9539, lf("function '{0}' missing return type", fd!.pyQName));
            unifyTypeOf(target, fd!.pyRetType!)
            fd!.isInstance = false

            if (ctx.currClass.isNamespace) {
                pref = `export ${isConstCall ? "const" : "let"} `;
            }
        }
        if (value)
            unifyTypeOf(target, typeOf(value))
        else {
            error(n, 9555, U.lf("unable to determine value of assignment"));
            return stmtTODO(n)
        }
        if (isConstCall) {
            // first run would have "let" in it
            defvar(getName(target), {})
            if (!/^static /.test(pref) && !/const/.test(pref))
                pref += "const ";
            return B.mkStmt(B.mkText(pref), B.mkInfix(expr(target), "=", expr(value)))
        }
        if (!pref && target.kind == "Tuple") {

            return convertDestructuring(n, target as py.Tuple, value);

        }
        if (target.kind === "Name") {
            const scopeSym = currentScope().vars[nm];
            const sym = scopeSym?.symbol

            // Mark the assignment only if the variable is declared in this scope
            if (sym && sym.kind === SK.Variable && scopeSym.modifier === undefined) {
                if (scopeSym.firstAssignPos === undefined
                    || scopeSym.firstAssignPos > target.startPos) {
                    scopeSym.firstAssignPos = target.startPos
                    scopeSym.firstAssignDepth = ctx.blockDepth;
                }
            }
        }

        let lExp: B.JsNode | undefined = undefined;
        if (annotation && annotAsType) {
            // if we have a type annotation, emit it in these cases if the r-value is:
            //  - null / undefined
            //  - empty list
            if (value.kind === "NameConstant" && (value as NameConstant).value === null
                || value.kind === "List" && (value as List).elts.length === 0) {
                const annotStr = t2s(annotAsType);

                lExp = B.mkInfix(expr(target), ":", B.mkText(annotStr))
            }
        }
        if (!lExp)
            lExp = expr(target)

        return B.mkStmt(B.mkText(pref), B.mkInfix(lExp, "=", expr(value)))
    }

    function convertDestructuring(parent: py.AnnAssign | py.Assign, targets: py.Tuple, value: py.Expr) {
        let nonNames = targets.elts.filter(e => e.kind !== "Name")
        if (nonNames.length) {
            error(parent, 9556, U.lf("non-trivial tuple assignment unsupported"));
            return stmtTODO(parent)
        }

        const names = targets.elts.map(tryGetName);

        const symbols = names
            .map(nm => nm ? currentScope().vars[nm] : undefined);

        if (symbols.some(s => s?.modifier !== undefined)) {
            const helperVar = getHelperVariableName();
            const valueAssign = B.mkStmt(
                B.mkInfix(
                    B.mkGroup(
                        [B.mkText("let "), B.mkText(helperVar)]
                    ),
                    "=",
                    expr(value)
                )
            );

            const assignStatements = [valueAssign];

            for (let i = 0; i < symbols.length; i++) {
                const name = convertName(targets.elts[i] as py.Name);

                assignStatements.push(
                    B.mkStmt(
                        B.mkInfix(
                           name,
                            "=",
                            B.mkGroup(
                                [B.mkText(helperVar), B.mkText(`[${i}]`)]
                            )
                        )
                    )
                )
            }

            return B.mkGroup(assignStatements);
        }
        else {
            let targs = [B.mkText("let "), B.mkText("[")]
            let tupNames = targets.elts
                .map(e => e as py.Name)
                .map(e => convertName(e, true))
            targs.push(B.mkCommaSep(tupNames))
            targs.push(B.mkText("]"))
            return B.mkStmt(B.mkInfix(B.mkGroup(targs), "=", expr(value)))
        }

        function convertName(n: py.Name, excludeLet = false) {
            // TODO resuse with Name expr
            markInfoNode(n, "identifierCompletion")
            typeOf(n)
            let v = lookupName(n)
            return possibleDef(n, excludeLet)
        }
    }

    function possibleDef(n: py.Name, excludeLet: boolean = false) {
        let id = n.id
        let currScopeVar = lookupScopeSymbol(id)
        let curr = currScopeVar?.symbol
        let localScopeVar = currentScope().vars[id];
        let local = localScopeVar?.symbol

        if (n.isdef === undefined) {
            if (!curr || (curr.kind === SK.Variable && curr !== local)) {
                if (ctx.currClass && !ctx.currFun) {
                    n.isdef = false // field
                    currScopeVar = defvar(id, {})
                } else {
                    n.isdef = true
                    currScopeVar = defvar(id, { isLocal: true })
                }
                curr = currScopeVar.symbol
            } else {
                n.isdef = false
            }
            n.symbolInfo = curr
            if (!n.tsType)
                error(n, 9540, lf("definition missing ts type"));
            if (!curr.pyRetType)
                error(n, 9568, lf("missing py return type"));
            unify(n, n.tsType!, curr.pyRetType!)
        }

        if (n.isdef && shouldHoist(currScopeVar!, currentScope())) {
            n.isdef = false;
        }

        markUsage(currScopeVar, n);

        if (n.isdef && !excludeLet) {
            return B.mkGroup([B.mkText("let "), quote(id)])
        }
        else if (curr?.namespace && curr?.qName && !(ctx.currClass?.isNamespace && ctx.currClass?.name === curr?.namespace)) {
            // If this is a static variable in a class, we want the full qname
            return quote(curr.qName);
        }
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

    function tryGetName(e: py.Expr): string | undefined {
        if (e.kind == "Name") {
            let s = (e as py.Name).id
            let scopeV = lookupVar(s)
            let v = scopeV?.symbol
            if (v) {
                if (v.expandsTo) return v.expandsTo
                else if (ctx.currClass && !ctx.currFun && !scopeV?.modifier && v.qName) return v.qName
            }
            return s
        }
        if (e.kind == "Attribute") {
            let pref = tryGetName((e as py.Attribute).value)
            if (pref)
                return pref + "." + (e as py.Attribute).attr
        }
        if (isSuper(e) && ctx.currClass?.baseClass) {
            return ctx.currClass.baseClass.qName
        }
        return undefined!
    }
    function getName(e: py.Expr): string {
        let name = tryGetName(e)
        if (!name)
            error(null, 9542, lf("Cannot get name of unknown expression kind '{0}'", e.kind));
        return name!
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
        return tryGetName(c.func) === fn
    }

    function binop(left: B.JsNode, pyName: string, right: B.JsNode) {
        let op = opMapping[pyName]
        U.assert(!!op)
        if (op.length > 3)
            return B.H.mkCall(op, [left, right])
        else
            return B.mkInfix(left, op, right)
    }

    interface FunOverride extends pxtc.FunOverride {
        t: Type | undefined;
    }

    const funMapExtension: Map<FunOverride> = {
        "memoryview": { n: "", t: tpBuffer },
        "const": { n: "", t: tpNumber },
        "micropython.const": { n: "", t: tpNumber }
    }

    function getPy2TsFunMap(): Map<FunOverride> {
        let funMap: Map<FunOverride> = {};
        Object.keys(pxtc.ts2PyFunNameMap).forEach(k => {
            let tsOverride = pxtc.ts2PyFunNameMap[k];
            if (tsOverride && tsOverride.n) {
                let py2TsOverride: FunOverride = {
                    n: k,
                    t: ts2PyType(tsOverride.t),
                    scale: tsOverride.scale
                }

                funMap[tsOverride.n] = py2TsOverride;
            }
        })

        Object.keys(funMapExtension).forEach(k => {
            funMap[k] = funMapExtension[k]
        })

        return funMap
    }

    const py2TsFunMap: Map<FunOverride> = getPy2TsFunMap();

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
                        res.push(B.mkText("${"), et, B.mkText("}"))
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

    function addCaller(e: Expr, v: SymbolInfo) {
        if (v && v.pyAST && v.pyAST.kind == "FunctionDef") {
            let fn = v.pyAST as FunctionDef
            if (!fn.callers) fn.callers = []
            if (fn.callers.indexOf(e) < 0)
                fn.callers.push(e)
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

            const left = expr(n.left);
            const right = expr(n.right);

            if (isArrayType(n.left) && isArrayType(n.right)) {
                if (n.op === "Add") {
                    return B.H.extensionCall("concat", [left, right], false);
                }
            }

            r = binop(left, n.op, right)

            if (numOps[n.op]) {
                unifyTypeOf(n.left, tpNumber)
                unifyTypeOf(n.right, tpNumber)
                if (!n.tsType)
                    error(n, 9570, lf("binary op missing ts type"));
                unify(n, n.tsType!, tpNumber)
            }
            return r
        },
        UnaryOp: (n: py.UnaryOp) => {
            let op = prefixOps[n.op]
            U.assert(!!op)
            return B.mkInfix(null!, op, expr(n.operand))
        },
        Lambda: (n: py.Lambda) => {
            error(n, 9574, U.lf("lambda expressions are not supported yet"))
            return exprTODO(n)
        },
        IfExp: (n: py.IfExp) =>
            B.mkInfix(B.mkInfix(expr(n.test), "?", expr(n.body)), ":", expr(n.orelse)),
        Dict: (n: py.Dict) => {
            ctx.blockDepth++;
            const elts = n.keys.map((k, i) => {
                const v = n.values[i]
                if (k === undefined)
                    return exprTODO(n)
                return B.mkStmt(B.mkInfix(expr(k), ":", expr(v)), B.mkText(","))
            })
            const res = B.mkBlock(elts);
            ctx.blockDepth--;
            return res
        },
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
                if (canonicalize(typeOf(n.comparators[0])) == tpString)
                    unifyTypeOf(n.left, tpString)
                let idx = B.mkInfix(expr(n.comparators[0]), ".", B.H.mkCall("indexOf", [expr(n.left)]))
                return B.mkInfix(idx, n.ops[0] == "In" ? ">=" : "<", B.mkText("0"))
            }
            let left = expr(n.left);
            let right = expr(n.comparators[0]);

            // Special handling for comparisons of literal types, e.g. 0 === 5
            const castIfLiteralComparison = (op: string, leftExpr: Expr, rightExpr: Expr) => {
                if (arithmeticCompareOps[op]) {
                    if (isNumStringOrBool(leftExpr) && isNumStringOrBool(rightExpr) && B.flattenNode([left]) !== B.flattenNode([right])) {
                        left = B.H.mkParenthesizedExpression(
                            B.mkGroup([left, B.mkText(" as any")])
                        );

                        right = B.H.mkParenthesizedExpression(
                            B.mkGroup([right, B.mkText(" as any")])
                        );
                    }
                }
            }

            castIfLiteralComparison(n.ops[0], n.left, n.comparators[0]);

            let r = binop(left, n.ops[0], right)
            for (let i = 1; i < n.ops.length; ++i) {
                left = expr(n.comparators[i - 1]);
                right = expr(n.comparators[i]);
                castIfLiteralComparison(n.ops[i], n.comparators[i - 1], n.comparators[i]);
                r = binop(r, "And", binop(left, n.ops[i], right))
            }
            return r
        },
        Call: (n: py.Call) => {
            // TODO(dz): move body out; needs seperate PR that doesn't touch content
            n.func.inCalledPosition = true

            let nm = tryGetName(n.func)
            let namedSymbol = lookupSymbol(nm)
            let isClass = namedSymbol && namedSymbol.kind == SK.Class

            let fun = namedSymbol

            let recvTp: Type | undefined = undefined;
            let recv: py.Expr | undefined = undefined
            let methName: string = ""

            if (isClass) {
                fun = lookupSymbol(namedSymbol!.pyQName + ".__constructor")

                if (!fun) {
                    fun = addSymbolFor(SK.Function, createDummyConstructorSymbol(namedSymbol?.pyAST as ClassDef))
                }
            } else {
                if (n.func.kind == "Attribute") {
                    let attr = n.func as py.Attribute
                    recv = attr.value
                    recvTp = typeOf(recv)
                    if (recvTp.classType || recvTp.primType) {
                        methName = attr.attr
                        fun = getTypeField(recv, methName, true)
                        if (fun) methName = fun.name
                    }
                }
            }

            let orderedArgs: (Expr | null)[] = n.args.slice()

            if (nm == "super" && orderedArgs.length == 0) {
                if (ctx.currClass && ctx.currClass.baseClass) {
                    if (!n.tsType)
                        error(n, 9543, lf("call expr missing ts type"));
                    unifyClass(n, n.tsType!, ctx.currClass.baseClass)
                }
                return B.mkText("super")
            }

            if (isCallTo(n, "int") && orderedArgs.length === 1 && orderedArgs[0]) {
                // int() compiles to either Math.trunc or parseInt depending on how it's used. Our builtin
                // function mapping doesn't handle this well so we special case that here.
                // TODO: consider generalizing this approach.
                const arg = orderedArgs[0]
                const argN = expr(arg)
                const argT = typeOf(arg)
                if (argT.primType === "string") {
                    return B.mkGroup([
                        B.mkText(`parseInt`),
                        B.mkText("("),
                        argN,
                        B.mkText(")")
                    ]);
                } else if (argT.primType === "number") {
                    return B.mkGroup([
                        B.mkInfix(B.mkText(`Math`), ".", B.mkText(`trunc`)),
                        B.mkText("("),
                        argN,
                        B.mkText(")")
                    ]);
                }
            }

            if (!fun) {
                let over = U.lookup(py2TsFunMap, nm!)
                if (over)
                    methName = ""

                if (methName) {
                    nm = t2s(recvTp!) + "." + methName
                    over = U.lookup(py2TsFunMap, nm)
                    if (!over && typeCtor(canonicalize(recvTp!)) == "@array") {
                        nm = "Array." + methName
                        over = U.lookup(py2TsFunMap, nm)
                    }
                }

                methName = ""

                if (over) {
                    if (over.n[0] == "." && orderedArgs.length) {
                        recv = orderedArgs.shift()!
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

            if (isCallTo(n, "str")) {
                // Our standard method of toString in TypeScript is to concatenate with the empty string
                unify(n, n.tsType!, tpString);
                return B.mkInfix(B.mkText(`""`), "+", expr(n.args[0]))
            }

            const isSuperAttribute = n.func.kind === "Attribute" && isSuper((n.func as Attribute).value);

            if (!fun && isSuperAttribute) {
                fun = lookupGlobalSymbol(nm!);
            }

            const isSuperConstructor = ctx.currFun?.name === "__init__" &&
                fun?.name === "__constructor" &&
                ctx.currClass?.baseClass?.pyQName === fun?.namespace &&
                isSuperAttribute;

            if (isSuperConstructor) {
                fun = lookupSymbol(ctx.currClass?.baseClass?.pyQName + ".__constructor");
            }

            if (!fun) {
                error(n, 9508, U.lf("can't find called function '{0}'", nm))
            }

            let formals = fun ? fun.parameters : null
            let allargs: B.JsNode[] = []

            if (!formals) {
                if (fun)
                    error(n, 9509, U.lf("calling non-function"))
                allargs = orderedArgs.map(expr)
            } else {
                if (orderedArgs.length > formals.length)
                    error(n, 9510, U.lf("too many arguments in call to '{0}'", fun!.pyQName))

                while (orderedArgs.length < formals.length)
                    orderedArgs.push(null)
                orderedArgs = orderedArgs.slice(0, formals.length)

                for (let kw of n.keywords) {
                    let idx = formals.findIndex(f => f.name == kw.arg)
                    if (idx < 0)
                        error(kw, 9511, U.lf("'{0}' doesn't have argument named '{1}'", fun!.pyQName, kw.arg))
                    else if (orderedArgs[idx] != null)
                        error(kw, 9512, U.lf("argument '{0} already specified in call to '{1}'", kw.arg, fun!.pyQName))
                    else
                        orderedArgs[idx] = kw.value
                }

                // skip optional args or args with initializers
                for (let i = orderedArgs.length - 1; i >= 0; i--) {
                    if (!!formals[i].initializer && orderedArgs[i] == null)
                        orderedArgs.pop()
                    else
                        break
                }

                for (let i = 0; i < orderedArgs.length; ++i) {
                    let arg = orderedArgs[i]
                    if (arg == null && !formals[i].initializer) {
                        error(n, 9513, U.lf("missing argument '{0}' in call to '{1}'", formals[i].name, fun!.pyQName))
                        allargs.push(B.mkText("null"))
                    } else if (arg) {
                        if (!formals[i].pyType)
                            error(n, 9545, lf("formal arg missing py type"));
                        const expectedType = formals[i].pyType!;
                        if (expectedType.primType !== "any") {
                            narrow(arg, expectedType)
                        }
                        if (arg.kind == "Name" && shouldInlineFunction(arg.symbolInfo)) {
                            allargs.push(emitFunctionDef(arg.symbolInfo!.pyAST as FunctionDef, true))
                        } else {
                            allargs.push(expr(arg))
                        }
                    } else {
                        if (!formals[i].initializer)
                            error(n, 9547, lf("formal arg missing initializer"));
                        allargs.push(B.mkText(formals[i].initializer!))
                    }
                }
            }

            if (!infoNode && syntaxInfo && syntaxInfo.type == "signature" && nodeInInfoRange(n)) {
                infoNode = n
                infoScope = currentScope()
                syntaxInfo.auxResult = 0
                // foo, bar
                for (let i = 0; i < orderedArgs.length; ++i) {
                    syntaxInfo.auxResult = i
                    let arg = orderedArgs[i]
                    if (!arg) {
                        // if we can't parse this next argument, but the cursor is beyond the
                        // previous arguments, assume it's here
                        break
                    }
                    if (arg.startPos <= syntaxInfo.position && syntaxInfo.position <= arg.endPos) {
                        break
                    }
                }
            }

            if (fun) {
                if (!fun.pyRetType)
                    error(n, 9549, lf("function missing pyRetType"));

                if (recv && isArrayType(recv) && recvTp) {
                    unifyArrayType(n, fun, recvTp);
                }
                else {
                    unifyTypeOf(n, fun.pyRetType!)
                }
                n.symbolInfo = fun

                if (fun.attributes.py2tsOverride) {
                    const override = parseTypeScriptOverride(fun.attributes.py2tsOverride);
                    if (override) {
                        if (methName && !recv)
                            error(n, 9550, lf("missing recv"));

                        let res = buildOverride(override, allargs, methName ? expr(recv!) : undefined);
                        if (!res)
                            error(n, 9555, lf("buildOverride failed unexpectedly"));
                        return res!
                    }
                }
                else if (fun.attributes.pyHelper) {
                    return B.mkGroup([
                        B.mkInfix(B.mkText("_py"), ".", B.mkText(fun.attributes.pyHelper)),
                        B.mkText("("),
                        B.mkCommaSep(recv ? [expr(recv)].concat(allargs) : allargs),
                        B.mkText(")")
                    ]);
                }
            }

            let fn: B.JsNode;

            if (isSuperConstructor) {
                fn = B.mkText("super");
            }
            else {
                if (methName) {
                    fn = B.mkInfix(expr(recv!), ".", B.mkText(methName));
                    markInfoNode(n.func, "memberCompletion");
                }
                else {
                    fn = expr(n.func);
                }
            }

            let nodes = [
                fn,
                B.mkText("("),
                B.mkCommaSep(allargs),
                B.mkText(")")
            ]

            if (fun && allargs.length == 1 && pxtc.service.isTaggedTemplate(fun))
                nodes = [fn, forceBackticks(allargs[0])]

            if (isClass) {
                if (!namedSymbol || !namedSymbol.pyQName)
                    error(n, 9551, lf("missing namedSymbol or pyQName"));
                nodes[0] = B.mkText(applyTypeMap(namedSymbol!.pyQName!))
                nodes.unshift(B.mkText("new "))
            }

            return B.mkGroup(nodes)
        },
        Num: (n: py.Num) => {
            if (!n.tsType)
                error(n, 9556, lf("tsType missing"));
            unify(n, n.tsType!, tpNumber)
            return B.mkText(n.ns)
        },
        Str: (n: py.Str) => {
            if (!n.tsType)
                error(n, 9557, lf("tsType missing"));
            unify(n, n.tsType!, tpString)
            return B.mkText(B.stringLit(n.s))
        },
        FormattedValue: (n: py.FormattedValue) => exprTODO(n),
        JoinedStr: (n: py.JoinedStr) => exprTODO(n),
        Bytes: (n: py.Bytes) => {
            return B.mkText(`hex\`${U.toHex(new Uint8Array(n.s))}\``)
        },
        NameConstant: (n: py.NameConstant) => {
            if (n.value !== null) {
                if (!n.tsType)
                    error(n, 9558, lf("tsType missing"));
                unify(n, n.tsType!, tpBoolean)
            }
            return B.mkText(JSON.stringify(n.value))
        },
        Ellipsis: (n: py.Ellipsis) => exprTODO(n),
        Constant: (n: py.Constant) => exprTODO(n),
        Attribute: (n: py.Attribute) => {
            // e.g. in "foo.bar", n.value is ["foo" expression] and n.attr is "bar"
            let lhs = expr(n.value) // run it first, in case it wants to capture infoNode
            let lhsType = typeOf(n.value)
            let fieldSymbol = getTypeField(n.value, n.attr)
            let fieldName = n.attr
            markInfoNode(n, "memberCompletion")
            if (fieldSymbol) {
                n.symbolInfo = fieldSymbol
                addCaller(n, fieldSymbol)
                if (!n.tsType || !fieldSymbol.pyRetType)
                    error(n, 9559, lf("tsType or pyRetType missing"));
                unify(n, n.tsType!, fieldSymbol.pyRetType!)
                fieldName = fieldSymbol.name
            } else if (lhsType.moduleType) {
                let sym = lookupGlobalSymbol(lhsType.moduleType.pyQName + "." + n.attr)
                if (sym) {
                    n.symbolInfo = sym
                    addCaller(n, sym)
                    unifyTypeOf(n, getOrSetSymbolType(sym))
                    fieldName = sym.name
                } else
                    error(n, 9514, U.lf("module '{0}' has no attribute '{1}'", lhsType.moduleType.pyQName, n.attr))
            } else {
                if (currIteration > 2) {
                    error(n, 9515, U.lf("unknown object type; cannot lookup attribute '{0}'", n.attr))
                }
            }
            return B.mkInfix(lhs, ".", B.mkText(quoteStr(fieldName)))
        },
        Subscript: (n: py.Subscript) => {
            if (n.slice.kind == "Index") {
                const objType = canonicalize(typeOf(n.value));
                if (isArrayType(n.value)) {
                    // indexing into an array
                    const eleType = objType.typeArgs![0];
                    unifyTypeOf(n, eleType)
                } else if (objType.primType === "string") {
                    // indexing into a string
                    unifyTypeOf(n, objType)
                } else if (currIteration > 2 && isFree(typeOf(n))) {
                    // indexing into an object
                    unifyTypeOf(n, tpAny)
                }

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
                const valueType = typeOf(n.value);
                unifyTypeOf(n, valueType);
                let s = n.slice as py.Slice

                if (s.step) {
                    const isString = valueType?.primType === "string";

                    return B.H.mkCall(isString ? "_py.stringSlice" : "_py.slice", [
                        expr(n.value),
                        s.lower ? expr(s.lower) : B.mkText("null"),
                        s.upper ? expr(s.upper) : B.mkText("null"),
                        expr(s.step)
                    ]);
                }

                return B.mkInfix(expr(n.value), ".",
                    B.H.mkCall("slice", [s.lower ? expr(s.lower) : B.mkText("0"),
                    s.upper ? expr(s.upper) : null].filter(isTruthy)))
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
                if (!n.tsType)
                    error(n, 9560, lf("missing tsType"));
                unifyClass(n, n.tsType!, ctx.currClass.symInfo)
                return B.mkText("this")
            }

            let scopeV = lookupName(n)
            let v = scopeV?.symbol

            // handle import
            if (v && v.isImport) {
                return quote(v.name) // it's import X = Y.Z.X, use X not Y.Z.X
            }

            markUsage(scopeV, n);

            if (n.ctx.indexOf("Load") >= 0) {
                if (!v)
                    return quote(getName(n))
                if (!v?.qName) {
                    error(n, 9561, lf("missing qName"));
                    return quote("unknown")
                }

                // Note: We track types like String as "String@type" but when actually emitting them
                // we want to elide the the "@type"
                const nm = v.qName.replace("@type", "")

                return quote(nm)
            } else {
                return possibleDef(n)
            }
        },
        List: mkArrayExpr,
        Tuple: mkArrayExpr,
    }

    function lookupName(n: py.Name): ScopeSymbolInfo {
        let scopeV = lookupScopeSymbol(n.id)
        let v = scopeV?.symbol
        if (!scopeV) {
            // check if the symbol has an override py<->ts mapping
            let over = U.lookup(py2TsFunMap, n.id)
            if (over) {
                scopeV = lookupScopeSymbol(over.n)
            }
        }
        if (scopeV && v) {
            n.symbolInfo = v
            if (!n.tsType)
                error(n, 9562, lf("missing tsType"));
            unify(n, n.tsType!, getOrSetSymbolType(v))
            if (v.isImport)
                return scopeV
            addCaller(n, v)
            if (n.forTargetEndPos && scopeV.forVariableEndPos !== n.forTargetEndPos) {
                if (scopeV.forVariableEndPos)
                    // defined in more than one 'for'; make sure it's hoisted
                    scopeV.lastRefPos = scopeV.forVariableEndPos + 1
                else
                    scopeV.forVariableEndPos = n.forTargetEndPos
            }
        } else if (currIteration > 0) {
            error(n, 9516, U.lf("name '{0}' is not defined", n.id))
        }
        return scopeV!
    }

    function markUsage(s: ScopeSymbolInfo | null | undefined, location: py.AST) {
        if (s) {
            if (s.modifier === VarModifier.Global) {
                const declaringScope = topScope();

                if (declaringScope && declaringScope.vars[s.symbol.name]) {
                    s = declaringScope.vars[s.symbol.name];
                }
            }
            else if (s.modifier === VarModifier.NonLocal) {
                const declaringScope = findNonlocalDeclaration(s.symbol.name, currentScope());

                if (declaringScope) {
                    s = declaringScope.vars[s.symbol.name];
                }
            }

            if (s.firstRefPos === undefined || s.firstRefPos > location.startPos) {
                s.firstRefPos = location.startPos;
            }
            if (s.lastRefPos === undefined || s.lastRefPos < location.startPos) {
                s.lastRefPos = location.startPos;
            }
        }
    }

    function mkArrayExpr(n: py.List | py.Tuple) {
        if (!n.tsType)
            error(n, 9563, lf("missing tsType"));
        unify(n, n.tsType!, mkArrayType(n.elts[0] ? typeOf(n.elts[0]) : mkType()))
        return B.mkGroup([
            B.mkText("["),
            B.mkCommaSep(n.elts.map(expr)),
            B.mkText("]"),
        ])
    }

    function sourceMapId(e: py.AST): string {
        return `${e.startPos}:${e.endPos}`
    }

    function expr(e: py.Expr): B.JsNode {
        lastAST = e
        let f = exprMap[e.kind]
        if (!f) {
            U.oops(e.kind + " - unknown expr")
        }
        typeOf(e)
        const r = f(e)
        r.id = sourceMapId(e)
        return r
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
        r.id = sourceMapId(e)
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

    function declareVariable(s: SymbolInfo) {
        const name = quote(s.name);
        const type = t2s(getOrSetSymbolType(s));

        return B.mkStmt(B.mkGroup([B.mkText("let "), name, B.mkText(": " + type + ";")]));
    }

    function findNonlocalDeclaration(name: string, scope: py.ScopeDef | undefined): py.ScopeDef | undefined {
        if (!scope)
            return undefined

        const symbolInfo = scope.vars && scope.vars[name];

        if (symbolInfo && symbolInfo.modifier != VarModifier.NonLocal) {
            return scope;
        }
        else {
            return findNonlocalDeclaration(name, scope.parent);
        }
    }

    function collectHoistedDeclarations(scope: py.ScopeDef) {
        const hoisted: B.JsNode[] = [];
        let current: ScopeSymbolInfo;
        for (const varName of Object.keys(scope.vars)) {
            current = scope.vars[varName];

            if (shouldHoist(current, scope)) {
                hoisted.push(declareVariable(current?.symbol));
            }
        }
        return hoisted;
    }

    function shouldHoist(sym: ScopeSymbolInfo, scope: py.ScopeDef): boolean {
        let result =
            sym.symbol.kind === SK.Variable
            && !sym.symbol.isParam
            && sym.modifier === undefined
            && (sym.lastRefPos! > sym.forVariableEndPos!
                || sym.firstRefPos! < sym.firstAssignPos!
                || sym.firstAssignDepth! > scope.blockDepth!)
            && !(isTopLevelScope(scope) && sym.firstAssignDepth! === 0);
        return !!result
    }

    function isTopLevelScope(scope: py.ScopeDef) {
        return scope.kind === "Module" && (scope as py.Module).name === "main";
    }

    // TODO look at scopes of let

    function toTS(mod: py.Module): B.JsNode[] | undefined {
        U.assert(mod.kind == "Module")
        if (mod.tsBody)
            return undefined
        resetCtx(mod)
        if (!mod.vars) mod.vars = {}

        const hoisted = collectHoistedDeclarations(mod);
        let res = hoisted.concat(mod.body.map(stmt))
        if (res.every(isEmpty)) return undefined
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
        lastAST = undefined
    }

    export interface Py2TsRes {
        diagnostics: pxtc.KsDiagnostic[],
        success: boolean,
        outfiles: { [key: string]: string },
        syntaxInfo?: pxtc.SyntaxInfo,
        globalNames?: pxt.Map<SymbolInfo>,
        sourceMap: pxtc.SourceInterval[]
    }
    export function py2ts(opts: pxtc.CompileOptions): Py2TsRes {
        let modules: py.Module[] = []
        const outfiles: Map<string> = {}
        diagnostics = []

        U.assert(!!opts.sourceFiles, "missing sourceFiles! Cannot convert py to ts")

        // find .ts files that are copies of / shadowed by the .py files
        let pyFiles = opts.sourceFiles!.filter(fn => U.endsWith(fn, ".py"))
        if (pyFiles.length == 0)
            return { outfiles, diagnostics, success: diagnostics.length === 0, sourceMap: [] }
        let removeEnd = (file: string, ext: string) => file.substr(0, file.length - ext.length)
        let pyFilesSet = U.toDictionary(pyFiles, p => removeEnd(p, ".py"))
        let tsFiles = opts.sourceFiles!
            .filter(fn => U.endsWith(fn, ".ts"))
        let tsShadowFiles = tsFiles
            .filter(fn => removeEnd(fn, ".ts") in pyFilesSet)

        U.assert(!!opts.apisInfo, "missing apisInfo! Cannot convert py to ts")

        lastFile = pyFiles[0] // make sure there's some location info for errors from API init
        initApis(opts.apisInfo!, tsShadowFiles)

        compileOptions = opts
        syntaxInfo = undefined

        if (!opts.generatedFiles)
            opts.generatedFiles = []

        for (const fn of pyFiles) {
            let sn = fn
            let modname = fn.replace(/\.py$/, "").replace(/.*\//, "")
            let src = opts.fileSystem[fn]

            try {
                lastFile = fn
                let tokens = pxt.py.lex(src)
                //pxt.log(pxt.py.tokensToString(tokens))
                let res = pxt.py.parse(src, sn, tokens)
                //pxt.log(pxt.py.dump(stmts))

                U.pushRange(diagnostics, res.diagnostics)

                modules.push({
                    kind: "Module",
                    body: res.stmts,
                    blockDepth: 0,
                    name: modname,
                    source: src,
                    tsFilename: sn.replace(/\.py$/, ".ts")
                } as any)
            } catch (e) {
                // TODO
                pxt.log("Parse error", e)
            }
        }

        const parseDiags = diagnostics

        for (let i = 0; i < 5; ++i) {
            resetPass(i)
            for (let m of modules) {
                try {
                    toTS(m)
                    // pxt.log(`after ${currIteration} - ${numUnifies}`)
                } catch (e) {
                    pxt.log("Conv pass error", e);
                }
            }
            if (numUnifies == 0)
                break
        }

        resetPass(1000)
        infoNode = undefined
        syntaxInfo = opts.syntaxInfo || {
            position: 0,
            type: "symbol"
        }
        let sourceMap: pxtc.SourceInterval[] = []
        for (let m of modules) {
            try {
                let nodes = toTS(m)
                if (!nodes) continue
                let res = B.flattenNode(nodes)
                opts.sourceFiles!.push(m.tsFilename)
                opts.generatedFiles.push(m.tsFilename)
                opts.fileSystem[m.tsFilename] = res.output
                outfiles[m.tsFilename] = res.output
                let rawSrcMap = res.sourceMap
                function unpackInterval(i: B.BlockSourceInterval): pxtc.SourceInterval | undefined {
                    let splits = i.id.split(":")
                    if (splits.length != 2)
                        return undefined
                    let py = splits.map(i => parseInt(i))
                    return {
                        py: {
                            startPos: py[0],
                            endPos: py[1]
                        },
                        ts: {
                            startPos: i.startPos,
                            endPos: i.endPos
                        }
                    }
                }
                sourceMap = rawSrcMap
                    .map(unpackInterval)
                    .filter(i => !!i) as pxtc.SourceInterval[]
            } catch (e) {
                pxt.log("Conv error", e);
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

        // always return global symbols because we might need to check for
        // name collisions downstream
        let globalNames: pxt.Map<SymbolInfo> = {}
        const apis = U.values(externalApis).concat(U.values(internalApis))
        let existing: SymbolInfo[] = []
        const addSym = (v: SymbolInfo) => {
            if (isGlobalSymbol(v) && existing.indexOf(v) < 0) {
                let s = cleanSymbol(v)
                globalNames[s.qName || s.name] = s
            }
        }
        for (let s: ScopeDef | undefined = infoScope; !!s; s = s.parent) {
            if (s && s.vars)
                U.values(s.vars)
                    .map(v => v.symbol)
                    .forEach(addSym)
        }
        apis.forEach(addSym)

        if (syntaxInfo && infoNode) {
            infoNode = infoNode as AST

            syntaxInfo.beginPos = infoNode.startPos
            syntaxInfo.endPos = infoNode.endPos

            if (!syntaxInfo.symbols)
                syntaxInfo.symbols = []

            existing = syntaxInfo.symbols.slice()

            if (syntaxInfo.type == "memberCompletion" && infoNode.kind == "Attribute") {
                const attr = infoNode as Attribute
                const tp = typeOf(attr.value)
                if (tp.moduleType) {
                    for (let v of apis) {
                        if (!v.isInstance && v.namespace == tp.moduleType.qName) {
                            syntaxInfo.symbols.push(v)
                        }
                    }
                } else if (tp.classType || tp.primType) {
                    const ct = tp.classType
                        || resolvePrimTypes(tp.primType).reduce((p, n) => p || n, null);

                    if (ct) {
                        if (!ct.extendsTypes || !ct.qName)
                            error(null, 9567, lf("missing extendsTypes or qName"));
                        let types = ct.extendsTypes!.concat(ct.qName!)
                        for (let v of apis) {
                            if (v.isInstance && types.indexOf(v.namespace) >= 0) {
                                syntaxInfo.symbols.push(v)
                            }
                        }
                    }
                }

            } else if (syntaxInfo.type == "identifierCompletion") {
                syntaxInfo.symbols = pxt.U.values(globalNames)
            } else {
                let sym = (infoNode as Expr).symbolInfo
                if (sym)
                    syntaxInfo.symbols.push(sym)
            }

            syntaxInfo.symbols = syntaxInfo.symbols.map(cleanSymbol)
        }

        let outDiag = patchedDiags()
        return {
            outfiles: outfiles,
            success: outDiag.length === 0,
            diagnostics: outDiag,
            syntaxInfo,
            globalNames,
            sourceMap: sourceMap
        }

        function patchedDiags() {
            for (let d of diagnostics) {
                patchPosition(d, opts.fileSystem[d.fileName])
            }
            return diagnostics
        }
    }

    /**
     * Override example syntax:
     *      indexOf()       (no arguments)
     *      indexOf($1, $0) (arguments in different order)
     *      indexOf($0?)    (optional argument)
     *      indexOf($0=0)   (default value; can be numbers, single quoted strings, false, true, null, undefined)
     */
    function parseTypeScriptOverride(src: string): TypeScriptOverride {
        const regex = new RegExp(/([^\$]*\()?([^\$\(]*)\$(\d)(?:(?:(?:=(\d+|'[a-zA-Z0-9_]*'|false|true|null|undefined))|(\?)|))/, 'y');
        const parts: OverridePart[] = [];

        let match;
        let lastIndex = 0;

        do {
            lastIndex = regex.lastIndex;

            match = regex.exec(src);

            if (match) {
                if (match[1]) {
                    parts.push({
                        kind: "text",
                        text: match[1]
                    });
                }

                parts.push({
                    kind: "arg",
                    prefix: match[2],
                    index: parseInt(match[3]),
                    default: match[4],
                    isOptional: !!match[5]
                })
            }
        } while (match)

        if (lastIndex != undefined) {
            parts.push({
                kind: "text",
                text: src.substr(lastIndex)
            });
        }
        else {
            parts.push({
                kind: "text",
                text: src
            });
        }

        return {
            parts
        };
    }

    function isArrayType(expr: py.Expr) {
        const t = canonicalize(typeOf(expr));

        return t && t.primType === "@array";
    }

    function isNumStringOrBool(expr: py.Expr) {
        switch (expr.kind) {
            case "Num":
            case "Str":
                return true;
            case "NameConstant":
                return (expr as NameConstant).value !== null;
        }

        return false;
    }

    function buildOverride(override: TypeScriptOverride, args: B.JsNode[], recv?: B.JsNode) {
        const result: B.JsNode[] = [];

        for (const part of override.parts) {
            if (part.kind === "text") {
                result.push(B.mkText(part.text));
            }
            else if (args[part.index] || part.default) {
                if (part.prefix) result.push(B.mkText(part.prefix))

                if (args[part.index]) {
                    result.push(args[part.index]);
                }
                else {
                    result.push(B.mkText(part.default!))
                }
            }
            else if (part.isOptional) {
                // do nothing
            }
            else {
                return undefined;
            }
        }

        if (recv) {
            return B.mkInfix(recv, ".", B.mkGroup(result));
        }

        return B.mkGroup(result);
    }

    function unifyArrayType(e: Expr, fun: SymbolInfo, arrayType: Type) {
        // Do our best to unify the generic types by special casing everything
        switch (fun.qName!) {
            case "Array.pop":
            case "Array.removeAt":
            case "Array.shift":
            case "Array.find":
            case "Array.get":
            case "Array._pickRandom":
                unifyTypeOf(e, arrayType.typeArgs![0]);
                break;
            case "Array.concat":
            case "Array.slice":
            case "Array.filter":
            case "Array.fill":
                unifyTypeOf(e, arrayType);
                break;
            case "Array.reduce":
                if (e.kind === "Call" && (e as Call).args.length > 1) {
                    const accumulatorType = typeOf((e as Call).args[1]);
                    if (accumulatorType) unifyTypeOf(e, accumulatorType)
                }
                break;
            case "Array.map":
                // TODO: infer type properly from function instead of bailing out here
                unifyTypeOf(e, mkArrayType(tpAny));
                break;
            default:
                unifyTypeOf(e, fun.pyRetType!);
                break;
        }
    }

    function createDummyConstructorSymbol(def: py.ClassDef, sym = def.symInfo): py.Symbol {
        const existing = lookupApi(sym.pyQName + ".__constructor");

        if (!existing && sym.extendsTypes?.length) {
            const parentSymbol = lookupSymbol(sym.extendsTypes[0]) || lookupGlobalSymbol(sym.extendsTypes[0]);

            if (parentSymbol) {
                return createDummyConstructorSymbol(def, parentSymbol);
            }
        }

        const result = {
            kind: "FunctionDef",
            name: "__init__",
            startPos: def.startPos,
            endPos: def.endPos,
            parent: def,
            body: [],
            args: {
                kind: "Arguments",
                startPos: 0,
                endPos: 0,
                args: [{
                    startPos: 0,
                    endPos: 0,
                    kind: "Arg",
                    arg: "self"
                }],
                kw_defaults: [],
                kwonlyargs: [],
                defaults: []
            },
            decorator_list: [],
            vars: {},
            symInfo: mkSymbol(SK.Function, def.symInfo.qName + ".__constructor")
        } as any as py.FunctionDef;


        result.symInfo.parameters = [];
        result.symInfo.pyRetType = mkType({ classType: def.symInfo });

        if (existing) {
            result.args.args.push(...existing.parameters.map(p => ({
                startPos: 0,
                endPos: 0,
                kind: "Arg",
                arg: p.name,
            } as Arg)))
            result.symInfo.parameters.push(...existing.parameters.map(p => {
                if (p.pyType) return p;

                const res = {
                    ...p,
                    pyType: mapTsType(p.type)
                }
                return res;
            }))
        }

        return result;
    }

    function declareLocalStatic(className: string, name: string, type: string) {
        const isSetVar = `___${name}_is_set`;
        const localVar = `___${name}`;

        return B.mkStmt(
            B.mkStmt(B.mkText(`private ${isSetVar}: boolean`)),
            B.mkStmt(B.mkText(`private ${localVar}: ${type}`)),
            B.mkStmt(
                B.mkText(`get ${name}(): ${type}`),
                B.mkBlock([
                    B.mkText(`return this.${isSetVar} ? this.${localVar} : ${className}.${name}`)
                ])
            ),
            B.mkStmt(
                B.mkText(`set ${name}(value: ${type})`),
                B.mkBlock([
                    B.mkStmt(B.mkText(`this.${isSetVar} = true`)),
                    B.mkStmt(B.mkText(`this.${localVar} = value`)),
                ])
            )
        );
    }
}
