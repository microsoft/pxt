namespace ts.yelm {
    export var assert = Util.assert;
    export var oops = Util.oops;
    export type StringMap<T> = Util.Map<T>;
    export import U = ts.yelm.Util;

    let EK = ir.EK;

    function stringKind(n: Node) {
        if (!n) return "<null>"
        return (<any>ts).SyntaxKind[n.kind]
    }

    function inspect(n: Node) {
        console.log(stringKind(n))
    }

    function userError(msg: string): Error {
        debugger;
        var e = new Error(msg);
        (<any>e).bitvmUserError = true;
        throw e;
    }

    function isRefType(t: Type) {
        checkType(t);
        return !(t.flags & (TypeFlags.Number | TypeFlags.Boolean | TypeFlags.Enum))
    }

    function isRefDecl(def: Declaration) {
        if ((<any>def).isThisParameter)
            return true;
        //let tp = checker.getDeclaredTypeOfSymbol(def.symbol)
        let tp = typeOf(def)
        return isRefType(tp)
    }

    export function setCellProps(l: ir.Cell) {
        l._isRef = isRefDecl(l.def)
        l._isLocal = isLocalVar(l.def) || isParameter(l.def)
        l._isGlobal = isGlobalVar(l.def)
        if (!l.isRef() && typeOf(l.def).flags & TypeFlags.Void) {
            oops("void-typed variable, " + l.toString())
        }
    }

    function isStringLiteral(node: Node) {
        return (node.kind == SyntaxKind.StringLiteral || node.kind == SyntaxKind.NoSubstitutionTemplateLiteral)
    }

    function getEnclosingMethod(node: Node): MethodDeclaration {
        if (!node) return null;
        if (node.kind == SyntaxKind.MethodDeclaration || node.kind == SyntaxKind.Constructor)
            return <MethodDeclaration>node;
        return getEnclosingMethod(node.parent)
    }

    function getEnclosingFunction(node0: Node) {
        let node = node0
        while (true) {
            node = node.parent
            if (!node)
                userError(lf("cannot determine parent of {0}", stringKind(node0)))
            if (node.kind == SyntaxKind.FunctionDeclaration ||
                node.kind == SyntaxKind.ArrowFunction ||
                node.kind == SyntaxKind.FunctionExpression ||
                node.kind == SyntaxKind.MethodDeclaration ||
                node.kind == SyntaxKind.Constructor)
                return <FunctionLikeDeclaration>node
            if (node.kind == SyntaxKind.SourceFile) return null
        }
    }

    function isGlobalVar(d: Declaration) {
        return d.kind == SyntaxKind.VariableDeclaration && !getEnclosingFunction(d)
    }

    function isLocalVar(d: Declaration) {
        return d.kind == SyntaxKind.VariableDeclaration && !isGlobalVar(d);
    }

    function isParameter(d: Declaration) {
        return d.kind == SyntaxKind.Parameter
    }

    function isTopLevelFunctionDecl(decl: Declaration) {
        return (decl.kind == SyntaxKind.FunctionDeclaration && !getEnclosingFunction(decl)) ||
            decl.kind == SyntaxKind.MethodDeclaration ||
            decl.kind == SyntaxKind.Constructor
    }

    function isSideEffectfulInitializer(init: Expression) {
        if (!init) return false;
        switch (init.kind) {
            case SyntaxKind.NullKeyword:
            case SyntaxKind.NumericLiteral:
            case SyntaxKind.StringLiteral:
            case SyntaxKind.TrueKeyword:
            case SyntaxKind.FalseKeyword:
                return false;
            default:
                return true;
        }
    }

    function isOnDemandDecl(decl: Declaration) {
        return (isGlobalVar(decl) && !isSideEffectfulInitializer((<VariableDeclaration>decl).initializer)) ||
            isTopLevelFunctionDecl(decl)
    }

    export interface CommentAttrs {
        shim?: string;
        enumval?: string;
        helper?: string;
        help?: string;
        async?: boolean;
        block?: string;
        blockId?: string;
        blockGap?: string;
        blockExternalInputs?: boolean;
        color?: string;
        icon?: string;
        imageLiteral?: number;
        weight?: number;

        _name?: string;
        jsDoc?: string;
        paramHelp?: Util.Map<string>;
    }

    interface ClassInfo {
        reffields: PropertyDeclaration[];
        primitivefields: PropertyDeclaration[];
        allfields: PropertyDeclaration[];
    }

    let lf = thumb.lf;
    let checker: TypeChecker;

    function getComments(node: Node) {
        let src = getSourceFileOfNode(node)
        let doc = getLeadingCommentRangesOfNodeFromText(node, src.text)
        if (!doc) return "";
        let cmt = doc.map(r => src.text.slice(r.pos, r.end)).join("\n")
        return cmt;
    }

    export function parseComments(node: Node): CommentAttrs {
        if (!node || (node as any).isRootFunction) return {}
        let cmt = getComments(node)
        let res: CommentAttrs = {}
        let didSomething = true
        while (didSomething) {
            didSomething = false
            cmt = cmt.replace(/\/\/%[ \t]*(\w+)(=(("[^"\n]+")|'([^'\n]+)'|([^\s]+)))?/,
                (f: string, n: string, d0: string, d1: string,
                    v0: string, v1: string, v2: string) => {
                    let v = v0 ? JSON.parse(v0) : (d0 ? (v0 || v1 || v2) : "true");
                    (<any>res)[n] = v;
                    didSomething = true
                    return "//% "
                })
        }

        if (typeof res.weight == "string")
            res.weight = parseInt(res.weight as any)

        res.paramHelp = {}
        res.jsDoc = ""
        res._name = getName(node)
        cmt = cmt.replace(/\/\*\*([^]*?)\*\//g, (full: string, doccmt: string) => {
            doccmt = doccmt.replace(/\n\s*(\*\s*)?/g, "\n")
            doccmt = doccmt.replace(/^\s*@param\s+(\w+)\s+(.*)$/mg, (full: string, name: string, desc: string) => {
                res.paramHelp[name] = desc
                return ""
            })
            res.jsDoc += doccmt
            return ""
        })

        res.jsDoc = res.jsDoc.trim()

        return res
    }


    export function getName(node: Node & { name?: any; }) {
        if (!node.name || node.name.kind != SyntaxKind.Identifier)
            return "???"
        return (node.name as Identifier).text
    }

    function isArrayType(t: Type) {
        return (t.flags & TypeFlags.Reference) && t.symbol.name == "Array"
    }

    function isClassType(t: Type) {
        // check if we like the class?
        return (t.flags & TypeFlags.Class) || (t.flags & TypeFlags.ThisType)
    }

    function arrayElementType(t: Type): Type {
        if (isArrayType(t))
            return checkType((<TypeReference>t).typeArguments[0])
        return null;
    }

    function deconstructFunctionType(t: Type) {
        let sigs = checker.getSignaturesOfType(t, SignatureKind.Call)
        if (sigs && sigs.length == 1)
            return sigs[0]
        return null
    }

    function checkType(t: Type) {
        let ok = TypeFlags.String | TypeFlags.Number | TypeFlags.Boolean |
            TypeFlags.Void | TypeFlags.Enum | TypeFlags.Null
        if ((t.flags & ok) == 0) {
            if (isArrayType(t)) return t;
            if (isClassType(t)) return t;
            if (deconstructFunctionType(t)) return t;
            userError(lf("unsupported type: {0} 0x{1}", checker.typeToString(t), t.flags.toString(16)))
        }
        return t
    }

    function typeOf(node: Node) {
        let r: Type;
        if (isExpression(node))
            r = checker.getContextualType(<Expression>node)
        if (!r) r = checker.getTypeAtLocation(node);
        return checkType(r)
    }

    function procHasReturn(proc: ir.Procedure) {
        let sig = checker.getSignatureFromDeclaration(proc.action)
        let rettp = checker.getReturnTypeOfSignature(sig)
        return !(rettp.flags & TypeFlags.Void)
    }

    export function getDeclName(node: Declaration) {
        let text = node && node.name ? (<Identifier>node.name).text : null
        if (!text && node.kind == SyntaxKind.Constructor)
            text = "constructor"
        if (node.parent && node.parent.kind == SyntaxKind.ClassDeclaration)
            text = (<ClassDeclaration>node.parent).name.text + "." + text
        text = text || "inline"
        return text;
    }

    export function getFunctionLabel(node: FunctionLikeDeclaration) {
        let text = getDeclName(node)
        return "_" + text.replace(/[^\w]+/g, "_") + "_" + getNodeId(node)
    }

    export interface FieldAccessInfo {
        idx: number;
        name: string;
        isRef: boolean;
    }

    export type VarOrParam = VariableDeclaration | ParameterDeclaration;

    export interface VariableAddInfo {
        captured?: boolean;
        written?: boolean;
    }

    export interface FunctionAddInfo {
        capturedVars: VarOrParam[];
        location?: ir.Cell;
        thisParameter?: ParameterDeclaration; // a bit bogus
    }

    export function compileBinary(program: Program, host: CompilerHost, opts: CompileOptions): EmitResult {
        const diagnostics = createDiagnosticCollection();
        checker = program.getTypeChecker();
        let classInfos: StringMap<ClassInfo> = {}
        let usedDecls: StringMap<boolean> = {}
        let usedWorkList: Declaration[] = []
        let variableStatus: StringMap<VariableAddInfo> = {};
        let functionInfo: StringMap<FunctionAddInfo> = {};

        hex.setupFor(opts.extinfo || emptyExtInfo(), opts.hexinfo);

        let bin: Binary;
        let proc: ir.Procedure;

        function reset() {
            bin = new Binary();
            bin.target = opts.target;
            proc = null
        }

        let allStmts = Util.concat(program.getSourceFiles().map(f => f.statements))

        let src = program.getSourceFiles()[0]
        let rootFunction = <any>{
            kind: SyntaxKind.FunctionDeclaration,
            parameters: [],
            name: {
                text: "<main>",
                pos: 0,
                end: 0
            },
            body: {
                kind: SyntaxKind.Block,
                statements: allStmts
            },
            parent: src,
            pos: 0,
            end: 0,
            isRootFunction: true
        }

        markUsed(rootFunction);
        usedWorkList = [];

        reset();
        emit(rootFunction)

        if (diagnostics.getModificationCount() == 0) {
            reset();
            bin.finalPass = true
            emit(rootFunction)

            try {
                finalEmit();
            } catch (e) {
                handleError(rootFunction, e)
            }
        }

        return {
            diagnostics: diagnostics.getDiagnostics(),
            emitSkipped: !!opts.noEmit
        }

        function error(node: Node, msg: string, arg0?: any, arg1?: any, arg2?: any) {
            diagnostics.add(createDiagnosticForNode(node, <any>{
                code: 9042,
                message: msg,
                key: msg.replace(/^[a-zA-Z]+/g, "_"),
                category: DiagnosticCategory.Error,
            }, arg0, arg1, arg2));
        }

        function unhandled(n: Node, addInfo = "") {
            if (addInfo)
                addInfo = " (" + addInfo + ")"
            return userError(lf("Unsupported syntax node: {0}", stringKind(n)) + addInfo);
        }

        function nodeKey(f: Node) {
            return getNodeId(f) + ""
        }

        function getFunctionInfo(f: FunctionLikeDeclaration) {
            let key = nodeKey(f)
            let info = functionInfo[key]
            if (!info)
                functionInfo[key] = info = {
                    capturedVars: []
                }
            return info
        }

        function getVarInfo(v: Declaration) {
            let key = getNodeId(v) + ""
            let info = variableStatus[key]
            if (!info)
                variableStatus[key] = info = {}
            return info;
        }

        function recordUse(v: VarOrParam, written = false) {
            let info = getVarInfo(v)
            if (written)
                info.written = true;
            let outer = getEnclosingFunction(v)
            if (outer == null || outer == proc.action) {
                // not captured
            } else {
                if (proc.info.capturedVars.indexOf(v) < 0)
                    proc.info.capturedVars.push(v);
                info.captured = true;
            }
        }

        function scope(f: () => void) {
            let prevProc = proc;
            try {
                f();
            } finally {
                proc = prevProc;
            }
        }

        function finalEmit() {
            if (diagnostics.getModificationCount() || opts.noEmit)
                return;

            bin.writeFile = (fn: string, data: string) =>
                host.writeFile(fn, data, false, null);

            if (opts.target.isNative) {
                thumbEmit(bin)
            } else {
                jsEmit(bin)
            }
        }

        function typeCheckVar(decl: Declaration) {
            if (typeOf(decl).flags & TypeFlags.Void)
                userError("void-typed variables not supported")
        }

        function lookupCell(decl: Declaration): ir.Cell {
            if (isGlobalVar(decl)) {
                markUsed(decl)
                typeCheckVar(decl)
                let ex = bin.globals.filter(l => l.def == decl)[0]
                if (!ex) {
                    ex = new ir.Cell(bin.globals.length, decl, getVarInfo(decl))
                    bin.globals.push(ex)
                }
                return ex
            } else {
                let res = proc.localIndex(decl)
                if (!res) {
                    if (bin.finalPass)
                        userError(lf("cannot locate identifer"))
                    else
                        res = proc.mkLocal(decl, getVarInfo(decl))
                }
                return res
            }
        }

        function getClassInfo(t: Type) {
            let decl = <ClassDeclaration>t.symbol.valueDeclaration
            let id = getNodeId(decl)
            let info = classInfos[id + ""]
            if (!info) {
                info = {
                    reffields: [],
                    primitivefields: [],
                    allfields: null
                }
                classInfos[id + ""] = info;
                for (let mem of decl.members) {
                    if (mem.kind == SyntaxKind.PropertyDeclaration) {
                        let pdecl = <PropertyDeclaration>mem
                        if (isRefType(typeOf(pdecl)))
                            info.reffields.push(pdecl)
                        else info.primitivefields.push(pdecl)
                    }
                }
                info.allfields = info.reffields.concat(info.primitivefields)
            }
            return info;
        }

        function emitImageLiteral(s: string): LiteralExpression {
            if (!s) s = "0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n";

            let x = 0;
            let w = 0;
            let h = 0;
            let lit = "";
            s += "\n"
            for (let i = 0; i < s.length; ++i) {
                switch (s[i]) {
                    case ".":
                    case "_":
                    case "0": lit += "0,"; x++; break;
                    case "#":
                    case "*":
                    case "1": lit += "1,"; x++; break;
                    case "\t":
                    case "\r":
                    case " ": break;
                    case "\n":
                        if (x) {
                            if (w == 0)
                                w = x;
                            else if (x != w)
                                userError(lf("lines in image literal have to have the same width (got {0} and then {1} pixels)", w, x))
                            x = 0;
                            h++;
                        }
                        break;
                    default:
                        userError(lf("Only 0 . _ (off) and 1 # * (on) are allowed in image literals"))
                }
            }

            var lbl = "_img" + bin.lblNo++
            if (lit.length % 4 != 0)
                lit += "42" // pad

            bin.otherLiterals.push(`
.balign 4
${lbl}: .short 0xffff
        .short ${w}, ${h}
        .byte ${lit}
`)
            let jsLit = "new rt.micro_bit.Image(" + w + ", [" + lit + "])"

            return <any>{
                kind: SyntaxKind.NumericLiteral,
                imageLiteral: lbl,
                jsLit
            }
        }

        function emitLocalLoad(decl: VarOrParam) {
            let l = lookupCell(decl)
            recordUse(decl)
            let r = l.load()
            //console.log("LOADLOC", l.toString(), r.toString())
            return r
        }

        function emitIdentifier(node: Identifier): ir.Expr {
            let decl = getDecl(node)
            if (decl && (decl.kind == SyntaxKind.VariableDeclaration || decl.kind == SyntaxKind.Parameter)) {
                return emitLocalLoad(<VarOrParam>decl)
            } else if (decl && decl.kind == SyntaxKind.FunctionDeclaration) {
                let f = <FunctionDeclaration>decl
                let info = getFunctionInfo(f)
                if (info.location) {
                    return info.location.load()
                } else {
                    assert(!bin.finalPass || info.capturedVars.length == 0)
                    return emitFunLit(f)
                }
            } else {
                throw unhandled(node, "id")
            }
        }

        function emitParameter(node: ParameterDeclaration) { }
        function emitAccessor(node: AccessorDeclaration) { }
        function emitThis(node: Node) {
            let meth = getEnclosingMethod(node)
            if (!meth)
                userError("'this' used outside of a method")
            let inf = getFunctionInfo(meth)
            if (!inf.thisParameter) {
                //console.log("get this param,", meth.kind, nodeKey(meth))
                //console.log("GET", meth)
                oops("no this")
            }
            return emitLocalLoad(inf.thisParameter)
        }
        function emitSuper(node: Node) { }
        function emitLiteral(node: LiteralExpression) {
            if (node.kind == SyntaxKind.NumericLiteral) {
                if ((<any>node).imageLiteral) {
                    return ir.ptrlit((<any>node).imageLiteral, (<any>node).jsLit)
                } else {
                    return ir.numlit(parseInt(node.text))
                }
            } else if (isStringLiteral(node)) {
                if (node.text == "") {
                    return ir.rtcall("string::mkEmpty", [])
                } else {
                    let lbl = bin.emitString(node.text)
                    let ptr = ir.ptrlit(lbl + "meta", JSON.stringify(node.text))
                    return ir.rtcall("bitvm::stringData", [ptr])
                }
            } else {
                throw oops();
            }
        }
        function emitTemplateExpression(node: TemplateExpression) { }
        function emitTemplateSpan(node: TemplateSpan) { }
        function emitJsxElement(node: JsxElement) { }
        function emitJsxSelfClosingElement(node: JsxSelfClosingElement) { }
        function emitJsxText(node: JsxText) { }
        function emitJsxExpression(node: JsxExpression) { }
        function emitQualifiedName(node: QualifiedName) { }
        function emitObjectBindingPattern(node: BindingPattern) { }
        function emitArrayBindingPattern(node: BindingPattern) { }
        function emitBindingElement(node: BindingElement) { }
        function emitArrayLiteral(node: ArrayLiteralExpression) {
            let eltT = arrayElementType(typeOf(node))
            let isRef = isRefType(eltT)
            let flag = 0
            if (eltT.flags & TypeFlags.String)
                flag = 3;
            else if (isRef)
                flag = 1;
            let coll = ir.shared(ir.rtcall("collection::mk", [ir.numlit(flag)]))
            for (let elt of node.elements) {
                let e = ir.shared(emitExpr(elt))
                proc.emitExpr(ir.rtcall("collection::add", [coll, e]))
                if (isRef) {
                    proc.emitExpr(ir.op(EK.Decr, [e]))
                }
            }
            return coll
        }
        function emitObjectLiteral(node: ObjectLiteralExpression) { }
        function emitPropertyAssignment(node: PropertyDeclaration) {
            if (node.initializer)
                userError(lf("class field initializers not supported"))
            // do nothing
        }
        function emitShorthandPropertyAssignment(node: ShorthandPropertyAssignment) { }
        function emitComputedPropertyName(node: ComputedPropertyName) { }
        function emitPropertyAccess(node: PropertyAccessExpression): ir.Expr {
            let decl = getDecl(node);
            let attrs = parseComments(decl);
            if (decl.kind == SyntaxKind.EnumMember) {
                let ev = attrs.enumval
                if (!ev)
                    userError(lf("{enumval:...} missing"))
                if (/^\d+$/.test(ev))
                    return ir.numlit(parseInt(ev));
                var inf = hex.lookupFunc(ev)
                if (!inf)
                    userError(lf("unhandled enum value: {0}", ev))
                if (inf.type == "E")
                    return ir.numlit(inf.value)
                else if (inf.type == "F" && inf.args == 0)
                    return ir.rtcall(ev, [])
                else
                    throw userError(lf("not valid enum: {0}; is it procedure name?", ev))
            } else if (decl.kind == SyntaxKind.PropertySignature) {
                if (attrs.shim) {
                    return emitShim(decl, node, [node.expression])
                } else {
                    throw unhandled(node, "no {shim:...}");
                }
            } else if (decl.kind == SyntaxKind.PropertyDeclaration) {
                let idx = fieldIndex(node)
                return ir.op(EK.FieldAccess, [emitExpr(node.expression)], idx)
                //OLD proc.emitCall("bitvm::ldfld" + refSuff(node), 0) // internal unref
            } else {
                throw unhandled(node, stringKind(decl));
            }
        }

        function emitIndexedAccess(node: ElementAccessExpression): ir.Expr {
            let t = typeOf(node.expression)

            let collType = ""
            if (t.flags & TypeFlags.String)
                collType = "string"
            else if (isArrayType(t))
                collType = "collection"

            if (collType) {
                if (typeOf(node.argumentExpression).flags & TypeFlags.Number) {
                    let arr = emitExpr(node.expression)
                    let idx = emitExpr(node.argumentExpression)
                    return rtcallMask(collType + "::at", [node.expression, node.argumentExpression])
                } else {
                    throw unhandled(node, lf("non-numeric indexer on {0}", collType))
                }
            } else {
                throw unhandled(node, "unsupported indexer")
            }
        }

        function isUsed(decl: Declaration) {
            return !isOnDemandDecl(decl) || usedDecls.hasOwnProperty(nodeKey(decl))
        }

        function markUsed(decl: Declaration) {
            if (!isUsed(decl)) {
                usedDecls[nodeKey(decl)] = true
                usedWorkList.push(decl)
            }
        }

        function getDecl(node: Node): Declaration {
            if (!node) return null
            let sym = checker.getSymbolAtLocation(node)
            let decl: Declaration = sym ? sym.valueDeclaration : null
            markUsed(decl)
            return decl
        }
        function isRefCountedExpr(e: Expression) {
            // we generate a fake NULL expression for default arguments
            // we also generate a fake numeric literal for image literals
            if (e.kind == SyntaxKind.NullKeyword || e.kind == SyntaxKind.NumericLiteral)
                return false
            // no point doing the incr/decr for these - they are statically allocated anyways
            if (isStringLiteral(e))
                return false
            return isRefType(typeOf(e))
        }
        function getMask(args: Expression[]) {
            assert(args.length <= 8)
            var m = 0
            args.forEach((a, i) => {
                if (isRefCountedExpr(a))
                    m |= (1 << i)
            })
            return m
        }

        function emitShim(decl: Declaration, node: Node, args: Expression[]): ir.Expr {
            let attrs = parseComments(decl)
            let hasRet = !(typeOf(node).flags & TypeFlags.Void)
            let nm = attrs.shim

            if (nm == "TD_NOOP") {
                assert(!hasRet)
                return ir.numlit(0)
            }

            if (nm == "TD_ID") {
                assert(args.length == 1)
                return emitExpr(args[0])
            }

            if (opts.target.hasHex) {
                let inf = hex.lookupFunc(attrs.shim)
                if (inf) {
                    if (!hasRet) {
                        if (inf.type != "P")
                            userError("expecting procedure for " + nm);
                    } else {
                        if (inf.type != "F")
                            userError("expecting function for " + nm);
                    }
                    if (args.length != inf.args)
                        userError("argument number mismatch: " + args.length + " vs " + inf.args)
                } else {
                    userError("function not found: " + nm)
                }
            }

            return rtcallMask(attrs.shim, args, attrs.async)
        }

        function isNumericLiteral(node: Expression) {
            switch (node.kind) {
                case SyntaxKind.NullKeyword:
                case SyntaxKind.TrueKeyword:
                case SyntaxKind.FalseKeyword:
                case SyntaxKind.NumericLiteral:
                    return true;
                default:
                    return false;
            }
        }

        function emitPlainCall(decl: Declaration, args: Expression[], hasRet = false) {
            return ir.op(EK.ProcCall, args.map(emitExpr), decl)
        }

        function addDefaultParameters(sig: Signature, args: Expression[], attrs: CommentAttrs) {
            if (!sig) return;
            let parms = sig.getParameters();
            if (parms.length > args.length) {
                parms.slice(args.length).forEach(p => {
                    if (p.valueDeclaration &&
                        p.valueDeclaration.kind == SyntaxKind.Parameter) {
                        let prm = <ParameterDeclaration>p.valueDeclaration
                        if (!prm.initializer) {
                            args.push(<any>{
                                kind: SyntaxKind.NullKeyword
                            })
                        } else {
                            if (!isNumericLiteral(prm.initializer)) {
                                userError("only numbers, null, true and false supported as default arguments")
                            }
                            args.push(prm.initializer)
                        }
                    } else {
                        userError("unsupported default argument (shouldn't happen)")
                    }
                })
            }

            if (attrs.imageLiteral) {
                if (!isStringLiteral(args[0])) {
                    userError(lf("Only image literals (string literals) supported here; {0}", stringKind(args[0])))
                }

                args[0] = emitImageLiteral((args[0] as StringLiteral).text)
            }
        }

        function emitCallExpression(node: CallExpression): ir.Expr {
            let decl = getDecl(node.expression)
            let attrs = parseComments(decl)
            let hasRet = !(typeOf(node).flags & TypeFlags.Void)
            let args = node.arguments.slice(0)

            if (!decl)
                unhandled(node, "no declaration")

            function emitPlain() {
                return emitPlainCall(decl, args, hasRet)
            }

            addDefaultParameters(checker.getResolvedSignature(node), args, attrs);

            if (decl.kind == SyntaxKind.FunctionDeclaration) {
                let info = getFunctionInfo(<FunctionDeclaration>decl)

                if (!info.location) {
                    if (attrs.shim) {
                        return emitShim(decl, node, args);
                    }

                    return emitPlain();
                }
            }

            if (decl.kind == SyntaxKind.MethodSignature ||
                decl.kind == SyntaxKind.MethodDeclaration) {
                if (node.expression.kind == SyntaxKind.PropertyAccessExpression)
                    args.unshift((<PropertyAccessExpression>node.expression).expression)
                else
                    unhandled(node, "strange method call")
                if (attrs.shim) {
                    return emitShim(decl, node, args);
                } else if (attrs.helper) {
                    let syms = checker.getSymbolsInScope(node, SymbolFlags.Module)
                    let helpersModule = <ModuleDeclaration>syms.filter(s => s.name == "helpers")[0].valueDeclaration;
                    let helperStmt = (<ModuleBlock>helpersModule.body).statements.filter(s => s.symbol.name == attrs.helper)[0]
                    if (!helperStmt)
                        userError(lf("helpers.{0} not found", attrs.helper))
                    if (helperStmt.kind != SyntaxKind.FunctionDeclaration)
                        userError(lf("helpers.{0} isn't a function", attrs.helper))
                    decl = <FunctionDeclaration>helperStmt;
                    markUsed(decl)
                    return emitPlain();
                } else {
                    markUsed(decl)
                    return emitPlain();
                }
            }

            if (decl.kind == SyntaxKind.VariableDeclaration ||
                decl.kind == SyntaxKind.FunctionDeclaration || // this is lambda
                decl.kind == SyntaxKind.Parameter) {
                if (args.length > 1)
                    userError("lambda functions with more than 1 argument not supported")

                if (hasRet)
                    userError("lambda functions cannot yet return values")

                let suff = args.length + ""
                if (suff == "0") suff = ""

                args.unshift(node.expression)

                return rtcallMask("action::run" + suff, args, true)
            }

            throw unhandled(node, stringKind(decl))
        }

        function emitNewExpression(node: NewExpression) {
            let t = typeOf(node)
            if (isArrayType(t)) {
                throw oops();
            } else if (isClassType(t)) {
                let classDecl = <ClassDeclaration>getDecl(node.expression)
                if (classDecl.kind != SyntaxKind.ClassDeclaration) {
                    userError("new expression only supported on class types")
                }
                let ctor = classDecl.members.filter(n => n.kind == SyntaxKind.Constructor)[0]
                let info = getClassInfo(t)

                let obj = ir.shared(ir.rtcall("record::mk", [ir.numlit(info.reffields.length), ir.numlit(info.allfields.length)]))

                if (ctor) {
                    markUsed(ctor)
                    let args = node.arguments.slice(0)
                    addDefaultParameters(checker.getResolvedSignature(node), args, parseComments(ctor))
                    let compiled = args.map(emitExpr)
                    compiled.unshift(ir.op(EK.Incr, [obj]))
                    proc.emitExpr(ir.op(EK.ProcCall, compiled, ctor))
                    return obj
                } else {
                    if (node.arguments && node.arguments.length)
                        userError(lf("constructor with arguments not found"));
                    return obj;
                }
            } else {
                throw unhandled(node)
            }
        }
        function emitTaggedTemplateExpression(node: TaggedTemplateExpression) { }
        function emitTypeAssertion(node: TypeAssertion) {
            return emitExpr(node.expression)
        }
        function emitAsExpression(node: AsExpression) { }
        function emitParenExpression(node: ParenthesizedExpression) {
            return emitExpr(node.expression)
        }

        function getParameters(node: FunctionLikeDeclaration) {
            let res = node.parameters.slice(0)
            if (node.kind == SyntaxKind.MethodDeclaration || node.kind == SyntaxKind.Constructor) {
                let info = getFunctionInfo(node)
                if (!info.thisParameter) {
                    info.thisParameter = <any>{
                        kind: SyntaxKind.Parameter,
                        name: { text: "this" },
                        isThisParameter: true,
                        parent: node
                    }
                }
                res.unshift(info.thisParameter)
            }
            return res
        }

        function emitFunLit(node: FunctionLikeDeclaration, raw = false) {
            let lbl = getFunctionLabel(node)
            let r = ir.ptrlit(lbl + "_Lit", lbl)
            if (!raw) {
                // TODO rename this to functionData or something
                r = ir.rtcall("bitvm::stringData", [r])
            }
            return r
        }

        function emitFunctionDeclaration(node: FunctionLikeDeclaration) {
            if (node.flags & NodeFlags.Ambient)
                return;

            if (!node.body)
                return;

            if (!isUsed(node))
                return;

            let attrs = parseComments(node)
            if (attrs.shim != null)
                return

            let info = getFunctionInfo(node)

            let isExpression = node.kind == SyntaxKind.ArrowFunction || node.kind == SyntaxKind.FunctionExpression

            let isRef = (d: Declaration) => {
                if (isRefDecl(d)) return true
                let info = getVarInfo(d)
                return (info.captured && info.written)
            }

            let refs = info.capturedVars.filter(v => isRef(v))
            let prim = info.capturedVars.filter(v => !isRef(v))
            let caps = refs.concat(prim)
            let locals = caps.map((v, i) => {
                let l = new ir.Cell(i, v, getVarInfo(v))
                l.iscap = true
                return l;
            })

            let lit: ir.Expr = null

            // if no captured variables, then we can get away with a plain pointer to code
            if (caps.length > 0) {
                assert(getEnclosingFunction(node) != null)
                lit = ir.shared(ir.rtcall("action::mk", [ir.numlit(refs.length), ir.numlit(caps.length), emitFunLit(node, true)]))
                caps.forEach((l, i) => {
                    let loc = proc.localIndex(l)
                    if (!loc)
                        userError("cannot find captured value: " + checker.symbolToString(l.symbol))
                    let v = loc.loadCore()
                    if (loc.isRef() || loc.isByRefLocal())
                        v = ir.op(EK.Incr, [v])
                    proc.emitExpr(ir.rtcall("bitvm::stclo", [lit, ir.numlit(i), v]))
                })
                if (node.kind == SyntaxKind.FunctionDeclaration) {
                    info.location = proc.mkLocal(node, getVarInfo(node))
                    proc.emitExpr(info.location.storeDirect(lit))
                    lit = null
                }
            } else {
                if (isExpression) {
                    lit = emitFunLit(node)
                }
            }

            assert(!!lit == isExpression)

            scope(() => {
                let isRoot = proc == null
                proc = new ir.Procedure();
                proc.isRoot = isRoot
                proc.action = node;
                proc.info = info;
                proc.captured = locals;
                bin.addProc(proc);

                proc.args = getParameters(node).map((p, i) => {
                    let l = new ir.Cell(i, p, getVarInfo(p))
                    l.isarg = true
                    return l
                })

                proc.args.forEach(l => {
                    //console.log(l.toString(), l.info)
                    if (l.isByRefLocal()) {
                        // TODO add C++ support function to do this
                        let tmp = ir.shared(ir.rtcall("bitvm::mkloc" + l.refSuff(), []))
                        proc.emitExpr(ir.rtcall("bitvm::stloc" + l.refSuff(), [tmp, l.loadCore()]))
                        proc.emitExpr(l.storeDirect(tmp))
                    }
                })

                emit(node.body);

                proc.emitLblDirect(getLabels(node).ret)

                proc.stackEmpty();

                if (procHasReturn(proc)) {
                    let v = ir.shared(ir.op(EK.JmpValue, []))
                    proc.emitExpr(v) // make sure we save it
                    proc.emitClrs();
                    let lbl = proc.mkLabel("final")
                    proc.emitJmp(lbl, v, ir.JmpMode.Always)
                    proc.emitLbl(lbl)
                } else {
                    proc.emitClrs();
                }

                assert(!bin.finalPass || usedWorkList.length == 0)
                while (usedWorkList.length > 0) {
                    let f = usedWorkList.pop()
                    emit(f)
                }

            })

            return lit
        }

        function emitDeleteExpression(node: DeleteExpression) { }
        function emitTypeOfExpression(node: TypeOfExpression) { }
        function emitVoidExpression(node: VoidExpression) { }
        function emitAwaitExpression(node: AwaitExpression) { }
        function emitPrefixUnaryExpression(node: PrefixUnaryExpression): ir.Expr {
            let tp = typeOf(node.operand)
            if (tp.flags & TypeFlags.Boolean) {
                if (node.operator == SyntaxKind.ExclamationToken) {
                    return rtcallMask("boolean::not_", [node.operand])
                }
            }

            if (tp.flags & TypeFlags.Number) {
                switch (node.operator) {
                    case SyntaxKind.PlusPlusToken:
                        return emitIncrement(node, "number::add", false)
                    case SyntaxKind.MinusMinusToken:
                        return emitIncrement(node, "number::subtract", false)
                    case SyntaxKind.MinusToken:
                        return ir.rtcall("number::subtract", [ir.numlit(0), emitExpr(node.operand)])
                    case SyntaxKind.PlusToken:
                        return emitExpr(node.operand) // no-op
                    default: unhandled(node, "postfix unary number")
                }
            }

            throw unhandled(node, "prefix unary");
        }

        function emitIncrement(expr: PrefixUnaryExpression | PostfixUnaryExpression, meth: string, isPost: boolean) {
            // TODO expr evaluated twice
            let pre = ir.shared(emitExpr(expr.operand))
            let post = ir.shared(ir.rtcall(meth, [pre, ir.numlit(1)]))
            emitStore(expr.operand, post)
            return isPost ? post : pre
        }

        function emitPostfixUnaryExpression(node: PostfixUnaryExpression): ir.Expr {
            let tp = typeOf(node.operand)

            if (tp.flags & TypeFlags.Number) {
                switch (node.operator) {
                    case SyntaxKind.PlusPlusToken:
                        return emitIncrement(node, "number::add", true)
                    case SyntaxKind.MinusMinusToken:
                        return emitIncrement(node, "number::subtract", true)
                    default: unhandled(node, "postfix unary number")
                }
            }
            throw unhandled(node)
        }

        function fieldIndex(pacc: PropertyAccessExpression): FieldAccessInfo {
            let tp = typeOf(pacc.expression)
            if (isClassType(tp)) {
                let info = getClassInfo(tp)
                let fld = info.allfields.filter(f => (<Identifier>f.name).text == pacc.name.text)[0]
                if (!fld)
                    userError(lf("field {0} not found", pacc.name.text))
                return {
                    idx: info.allfields.indexOf(fld),
                    name: pacc.name.text,
                    isRef: isRefType(typeOf(pacc))
                }
            } else {
                throw unhandled(pacc, "bad field access")
            }
        }

        function refSuff(e: Expression) {
            if (isRefType(typeOf(e))) return "Ref"
            else return ""
        }

        function emitStore(trg: Expression, src: ir.Expr) {
            if (trg.kind == SyntaxKind.Identifier) {
                let decl = getDecl(trg)
                if (decl && (decl.kind == SyntaxKind.VariableDeclaration || decl.kind == SyntaxKind.Parameter)) {
                    let l = lookupCell(decl)
                    recordUse(<VarOrParam>decl, true)
                    proc.emitExpr(l.storeByRef(src))
                } else {
                    unhandled(trg, "target identifier")
                }
            } else if (trg.kind == SyntaxKind.PropertyAccessExpression) {
                /*
                // TODO add C++ support function to simplify this
                let pacc = <PropertyAccessExpression>trg
                let tp = typeOf(pacc.expression)
                let idx = fieldIndex(pacc)
                emit(pacc.expression)
                proc.emit("pop {r0}")
                proc.emit("pop {r1}")
                proc.emit("push {r0}")
                proc.emitInt(idx)
                proc.emit("push {r1}")
                proc.emitCall("bitvm::stfld" + refSuff(trg), 0); // it does the decr itself, no mask
                */
                proc.emitExpr(ir.op(EK.Store, [emitExpr(trg), src]))
            } else {
                unhandled(trg, "assignment target")
            }
        }

        function handleAssignment(node: BinaryExpression) {
            let src = ir.shared(emitExpr(node.right))
            emitStore(node.left, src)
            if (isRefType(typeOf(node.right)))
                src = ir.op(EK.Incr, [src])
            return src
        }

        function rtcallMask(name: string, args: Expression[], isAsync = false) {
            return ir.rtcallMask(name, getMask(args), isAsync, args.map(emitExpr))
        }

        function emitLazyBinaryExpression(node: BinaryExpression) {
            let lbl = proc.mkLabel("lazy")
            // TODO what if the value is of ref type?
            if (node.operatorToken.kind == SyntaxKind.BarBarToken) {
                proc.emitJmp(lbl, emitExpr(node.left), ir.JmpMode.IfNotZero)
            } else if (node.operatorToken.kind == SyntaxKind.AmpersandAmpersandToken) {
                proc.emitJmpZ(lbl, emitExpr(node.left))
            } else {
                oops()
            }

            proc.emitJmp(lbl, emitExpr(node.right), ir.JmpMode.Always)
            proc.emitLbl(lbl)

            return ir.op(EK.JmpValue, [])
        }

        function emitBinaryExpression(node: BinaryExpression): ir.Expr {
            if (node.operatorToken.kind == SyntaxKind.EqualsToken) {
                return handleAssignment(node);
            }

            let lt = typeOf(node.left)
            let rt = typeOf(node.right)

            let shim = (n: string) => rtcallMask(n, [node.left, node.right]);

            if ((lt.flags & TypeFlags.Number) && (rt.flags & TypeFlags.Number)) {
                switch (node.operatorToken.kind) {
                    case SyntaxKind.PlusToken:
                        return shim("number::add");
                    case SyntaxKind.MinusToken:
                        return shim("number::subtract");
                    case SyntaxKind.SlashToken:
                        return shim("number::divide");
                    case SyntaxKind.AsteriskToken:
                        return shim("number::multiply");
                    case SyntaxKind.LessThanEqualsToken:
                        return shim("number::le");
                    case SyntaxKind.LessThanToken:
                        return shim("number::lt");
                    case SyntaxKind.GreaterThanEqualsToken:
                        return shim("number::ge");
                    case SyntaxKind.GreaterThanToken:
                        return shim("number::gt");
                    case SyntaxKind.EqualsEqualsToken:
                    case SyntaxKind.EqualsEqualsEqualsToken:
                        return shim("number::eq");
                    case SyntaxKind.ExclamationEqualsEqualsToken:
                    case SyntaxKind.ExclamationEqualsToken:
                        return shim("number::neq");
                    default:
                        unhandled(node.operatorToken, "numeric operator")
                }
            }

            if (node.operatorToken.kind == SyntaxKind.PlusToken) {
                if ((lt.flags & TypeFlags.String) || (rt.flags & TypeFlags.String)) {
                    return ir.rtcallMask("string::concat_op", 3, false, [
                        emitAsString(node.left),
                        emitAsString(node.right)])
                }
            }

            if ((lt.flags & TypeFlags.String) && (rt.flags & TypeFlags.String)) {
                switch (node.operatorToken.kind) {
                    case SyntaxKind.LessThanEqualsToken:
                        return shim("string::le");
                    case SyntaxKind.LessThanToken:
                        return shim("string::lt");
                    case SyntaxKind.GreaterThanEqualsToken:
                        return shim("string::ge");
                    case SyntaxKind.GreaterThanToken:
                        return shim("string::gt");
                    case SyntaxKind.EqualsEqualsToken:
                    case SyntaxKind.EqualsEqualsEqualsToken:
                        return shim("string::equals");
                    case SyntaxKind.ExclamationEqualsEqualsToken:
                    case SyntaxKind.ExclamationEqualsToken:
                        return shim("string::neq");
                    default:
                        unhandled(node.operatorToken, "numeric operator")
                }
            }

            switch (node.operatorToken.kind) {
                case SyntaxKind.EqualsEqualsToken:
                case SyntaxKind.EqualsEqualsEqualsToken:
                    return shim("number::eq");
                case SyntaxKind.ExclamationEqualsEqualsToken:
                case SyntaxKind.ExclamationEqualsToken:
                    return shim("number::neq");
                case SyntaxKind.BarBarToken:
                case SyntaxKind.AmpersandAmpersandToken:
                    return emitLazyBinaryExpression(node);
                default:
                    throw unhandled(node.operatorToken, "generic operator")
            }
        }

        function emitAsString(e: Expression): ir.Expr {
            let r = emitExpr(e)
            let tp = typeOf(e)
            if (tp.flags & TypeFlags.Number)
                return ir.rtcall("number::to_string", [r])
            else if (tp.flags & TypeFlags.Boolean)
                return ir.rtcall("boolean::to_string", [r])
            else if (tp.flags & TypeFlags.String)
                return r // OK
            else
                throw userError(lf("don't know how to convert to string"))
        }

        function emitConditionalExpression(node: ConditionalExpression) { }
        function emitSpreadElementExpression(node: SpreadElementExpression) { }
        function emitYieldExpression(node: YieldExpression) { }
        function emitBlock(node: Block) {
            node.statements.forEach(emit)
        }
        function emitVariableStatement(node: VariableStatement) {
            if (node.flags & NodeFlags.Ambient)
                return;
            node.declarationList.declarations.forEach(emit);
        }
        function emitExpressionStatement(node: ExpressionStatement) {
            emitExprAsStmt(node.expression)
        }
        function emitIfStatement(node: IfStatement) {
            let elseLbl = proc.mkLabel("else")
            proc.emitJmpZ(elseLbl, emitExpr(node.expression))
            emit(node.thenStatement)
            let afterAll = proc.mkLabel("afterif")
            proc.emitJmp(afterAll)
            proc.emitLbl(elseLbl)
            if (node.elseStatement)
                emit(node.elseStatement)
            proc.emitLbl(afterAll)
        }

        function getLabels(stmt: Node) {
            let id = getNodeId(stmt)
            return {
                fortop: ".fortop." + id,
                cont: ".cont." + id,
                brk: ".brk." + id,
                ret: ".ret." + id
            }
        }

        function emitDoStatement(node: DoStatement) {
            let l = getLabels(node)
            proc.emitLblDirect(l.cont);
            emit(node.statement)
            proc.emitJmpZ(l.brk, emitExpr(node.expression));
            proc.emitJmp(l.cont);
            proc.emitLblDirect(l.brk);
        }

        function emitWhileStatement(node: WhileStatement) {
            let l = getLabels(node)
            proc.emitLblDirect(l.cont);
            proc.emitJmpZ(l.brk, emitExpr(node.expression));
            emit(node.statement)
            proc.emitJmp(l.cont);
            proc.emitLblDirect(l.brk);
        }

        function emitExprAsStmt(node: Expression) {
            if (!node) return;
            let v = emitExpr(node);
            let a = typeOf(node)
            if (!(a.flags & TypeFlags.Void)) {
                if (isRefType(a)) {
                    // will pop
                    v = ir.op(EK.Decr, [v])
                }
            }
            proc.emitExpr(v)
            proc.stackEmpty();
        }

        function emitForStatement(node: ForStatement) {
            if (node.initializer && node.initializer.kind == SyntaxKind.VariableDeclarationList)
                (<VariableDeclarationList>node.initializer).declarations.forEach(emit);
            else
                emitExprAsStmt(<Expression>node.initializer);
            let l = getLabels(node)
            proc.emitLblDirect(l.fortop);
            if (node.condition)
                proc.emitJmpZ(l.brk, emitExpr(node.condition));
            emit(node.statement)
            proc.emitLblDirect(l.cont);
            emitExprAsStmt(node.incrementor);
            proc.emitJmp(l.fortop);
            proc.emitLblDirect(l.brk);
        }

        function emitForInOrForOfStatement(node: ForInStatement) { }

        function emitBreakOrContinueStatement(node: BreakOrContinueStatement) {
            let label = node.label ? node.label.text : null
            function findOuter(node: Node): Statement {
                if (!node) return null;
                if (label && node.kind == SyntaxKind.LabeledStatement &&
                    (<LabeledStatement>node).label.text == label)
                    return (<LabeledStatement>node).statement;
                if (!label && isIterationStatement(node, false))
                    return <Statement>node;
                return findOuter(node.parent);
            }
            let stmt = findOuter(node)
            if (!stmt)
                error(node, lf("cannot find outer loop"))
            else {
                let l = getLabels(stmt)
                if (node.kind == SyntaxKind.ContinueStatement) {
                    if (!isIterationStatement(stmt, false))
                        error(node, lf("continue on non-loop"));
                    else proc.emitJmp(l.cont)
                } else if (node.kind == SyntaxKind.BreakStatement) {
                    proc.emitJmp(l.brk)
                } else {
                    oops();
                }
            }
        }

        function emitReturnStatement(node: ReturnStatement) {
            let v: ir.Expr = null
            if (node.expression) {
                v = emitExpr(node.expression)
            } else if (procHasReturn(proc)) {
                v = ir.numlit(null) // == return undefined
            }
            proc.emitJmp(getLabels(proc.action).ret, v, ir.JmpMode.Always)
        }

        function emitWithStatement(node: WithStatement) { }
        function emitSwitchStatement(node: SwitchStatement) { }
        function emitCaseOrDefaultClause(node: CaseOrDefaultClause) { }
        function emitLabeledStatement(node: LabeledStatement) {
            let l = getLabels(node.statement)
            emit(node.statement)
            proc.emitLblDirect(l.brk)
        }
        function emitThrowStatement(node: ThrowStatement) { }
        function emitTryStatement(node: TryStatement) { }
        function emitCatchClause(node: CatchClause) { }
        function emitDebuggerStatement(node: Node) { }
        function emitVariableDeclaration(node: VariableDeclaration) {
            if (!isUsed(node))
                return;
            typeCheckVar(node)
            let loc = isGlobalVar(node) ?
                lookupCell(node) : proc.mkLocal(node, getVarInfo(node))
            if (loc.isByRefLocal()) {
                proc.emitClrIfRef(loc) // we might be in a loop
                proc.emitExpr(loc.storeDirect(ir.rtcall("bitvm::mkloc" + loc.refSuff(), [])))
            }
            // TODO make sure we don't emit code for top-level globals being initialized to zero
            if (node.initializer) {
                proc.emitExpr(loc.storeByRef(emitExpr(node.initializer)))
                proc.stackEmpty();
            }
        }
        function emitClassExpression(node: ClassExpression) { }
        function emitClassDeclaration(node: ClassDeclaration) {
            if (node.typeParameters)
                userError(lf("generic classes not supported"))
            if (node.heritageClauses)
                userError(lf("inheritance not supported"))
            node.members.forEach(emit)
        }
        function emitInterfaceDeclaration(node: InterfaceDeclaration) {
            // nothing
        }
        function emitEnumDeclaration(node: EnumDeclaration) { }
        function emitEnumMember(node: EnumMember) { }
        function emitModuleDeclaration(node: ModuleDeclaration) {
            if (node.flags & NodeFlags.Ambient)
                return;
            emit(node.body);
        }
        function emitImportDeclaration(node: ImportDeclaration) { }
        function emitImportEqualsDeclaration(node: ImportEqualsDeclaration) { }
        function emitExportDeclaration(node: ExportDeclaration) { }
        function emitExportAssignment(node: ExportAssignment) { }
        function emitSourceFileNode(node: SourceFile) {
            node.statements.forEach(emit)
        }

        function handleError(node: Node, e: any) {
            if (!e.bitvmUserError)
                console.log(e.stack)
            error(node, e.message)
        }

        function emitExpr(node: Node): ir.Expr {
            try {
                let expr = emitExprCore(node);
                if (expr.isExpr()) return expr
                throw new Error("expecting expression")
            } catch (e) {
                handleError(node, e);
                return null
            }
        }

        function emit(node: Node): void {
            try {
                emitNodeCore(node);
            } catch (e) {
                handleError(node, e);
                return null
            }
        }

        function emitNodeCore(node: Node): void {
            switch (node.kind) {


                case SyntaxKind.SourceFile:
                    return emitSourceFileNode(<SourceFile>node);
                case SyntaxKind.InterfaceDeclaration:
                    return emitInterfaceDeclaration(<InterfaceDeclaration>node);
                case SyntaxKind.VariableStatement:
                    return emitVariableStatement(<VariableStatement>node);
                case SyntaxKind.ModuleDeclaration:
                    return emitModuleDeclaration(<ModuleDeclaration>node);
                case SyntaxKind.EnumDeclaration:
                    return emitEnumDeclaration(<EnumDeclaration>node);
                //case SyntaxKind.MethodSignature:
                case SyntaxKind.FunctionDeclaration:
                case SyntaxKind.Constructor:
                case SyntaxKind.MethodDeclaration:
                    emitFunctionDeclaration(<FunctionLikeDeclaration>node);
                    return
                case SyntaxKind.ExpressionStatement:
                    return emitExpressionStatement(<ExpressionStatement>node);
                case SyntaxKind.Block:
                case SyntaxKind.ModuleBlock:
                    return emitBlock(<Block>node);
                case SyntaxKind.VariableDeclaration:
                    return emitVariableDeclaration(<VariableDeclaration>node);
                case SyntaxKind.IfStatement:
                    return emitIfStatement(<IfStatement>node);
                case SyntaxKind.WhileStatement:
                    return emitWhileStatement(<WhileStatement>node);
                case SyntaxKind.DoStatement:
                    return emitDoStatement(<DoStatement>node);
                case SyntaxKind.ForStatement:
                    return emitForStatement(<ForStatement>node);
                case SyntaxKind.ContinueStatement:
                case SyntaxKind.BreakStatement:
                    return emitBreakOrContinueStatement(<BreakOrContinueStatement>node);
                case SyntaxKind.LabeledStatement:
                    return emitLabeledStatement(<LabeledStatement>node);
                case SyntaxKind.ReturnStatement:
                    return emitReturnStatement(<ReturnStatement>node);
                case SyntaxKind.ClassDeclaration:
                    return emitClassDeclaration(<ClassDeclaration>node);
                case SyntaxKind.PropertyDeclaration:
                case SyntaxKind.PropertyAssignment:
                    return emitPropertyAssignment(<PropertyDeclaration>node);
                case SyntaxKind.TypeAliasDeclaration:
                    // skip
                    return
                default:
                    unhandled(node);
            }
        }

        function emitExprCore(node: Node): ir.Expr {
            switch (node.kind) {
                case SyntaxKind.NullKeyword:
                    return ir.numlit(null);
                case SyntaxKind.TrueKeyword:
                    return ir.numlit(true);
                case SyntaxKind.FalseKeyword:
                    return ir.numlit(false);
                case SyntaxKind.NumericLiteral:
                case SyntaxKind.StringLiteral:
                case SyntaxKind.NoSubstitutionTemplateLiteral:
                    //case SyntaxKind.RegularExpressionLiteral:                    
                    //case SyntaxKind.TemplateHead:
                    //case SyntaxKind.TemplateMiddle:
                    //case SyntaxKind.TemplateTail:
                    return emitLiteral(<LiteralExpression>node);
                case SyntaxKind.PropertyAccessExpression:
                    return emitPropertyAccess(<PropertyAccessExpression>node);
                case SyntaxKind.BinaryExpression:
                    return emitBinaryExpression(<BinaryExpression>node);
                case SyntaxKind.PrefixUnaryExpression:
                    return emitPrefixUnaryExpression(<PrefixUnaryExpression>node);
                case SyntaxKind.PostfixUnaryExpression:
                    return emitPostfixUnaryExpression(<PostfixUnaryExpression>node);
                case SyntaxKind.ElementAccessExpression:
                    return emitIndexedAccess(<ElementAccessExpression>node);
                case SyntaxKind.ParenthesizedExpression:
                    return emitParenExpression(<ParenthesizedExpression>node);
                case SyntaxKind.TypeAssertionExpression:
                    return emitTypeAssertion(<TypeAssertion>node);
                case SyntaxKind.ArrayLiteralExpression:
                    return emitArrayLiteral(<ArrayLiteralExpression>node);
                case SyntaxKind.NewExpression:
                    return emitNewExpression(<NewExpression>node);
                case SyntaxKind.ThisKeyword:
                    return emitThis(node);
                case SyntaxKind.CallExpression:
                    return emitCallExpression(<CallExpression>node);
                case SyntaxKind.FunctionExpression:
                case SyntaxKind.ArrowFunction:
                    return emitFunctionDeclaration(<FunctionLikeDeclaration>node);
                case SyntaxKind.Identifier:
                    return emitIdentifier(<Identifier>node);

                default:
                    unhandled(node);
                    return null

                /*    
                case SyntaxKind.Parameter:
                    return emitParameter(<ParameterDeclaration>node);
                case SyntaxKind.GetAccessor:
                case SyntaxKind.SetAccessor:
                    return emitAccessor(<AccessorDeclaration>node);
                case SyntaxKind.SuperKeyword:
                    return emitSuper(node);
                case SyntaxKind.TemplateExpression:
                    return emitTemplateExpression(<TemplateExpression>node);
                case SyntaxKind.TemplateSpan:
                    return emitTemplateSpan(<TemplateSpan>node);
                case SyntaxKind.JsxElement:
                    return emitJsxElement(<JsxElement>node);
                case SyntaxKind.JsxSelfClosingElement:
                    return emitJsxSelfClosingElement(<JsxSelfClosingElement>node);
                case SyntaxKind.JsxText:
                    return emitJsxText(<JsxText>node);
                case SyntaxKind.JsxExpression:
                    return emitJsxExpression(<JsxExpression>node);
                case SyntaxKind.QualifiedName:
                    return emitQualifiedName(<QualifiedName>node);
                case SyntaxKind.ObjectBindingPattern:
                    return emitObjectBindingPattern(<BindingPattern>node);
                case SyntaxKind.ArrayBindingPattern:
                    return emitArrayBindingPattern(<BindingPattern>node);
                case SyntaxKind.BindingElement:
                    return emitBindingElement(<BindingElement>node);
                case SyntaxKind.ObjectLiteralExpression:
                    return emitObjectLiteral(<ObjectLiteralExpression>node);
                case SyntaxKind.ShorthandPropertyAssignment:
                    return emitShorthandPropertyAssignment(<ShorthandPropertyAssignment>node);
                case SyntaxKind.ComputedPropertyName:
                    return emitComputedPropertyName(<ComputedPropertyName>node);
                case SyntaxKind.TaggedTemplateExpression:
                    return emitTaggedTemplateExpression(<TaggedTemplateExpression>node);
                case SyntaxKind.AsExpression:
                    return emitAsExpression(<AsExpression>node);
                case SyntaxKind.DeleteExpression:
                    return emitDeleteExpression(<DeleteExpression>node);
                case SyntaxKind.TypeOfExpression:
                    return emitTypeOfExpression(<TypeOfExpression>node);
                case SyntaxKind.VoidExpression:
                    return emitVoidExpression(<VoidExpression>node);
                case SyntaxKind.AwaitExpression:
                    return emitAwaitExpression(<AwaitExpression>node);
                case SyntaxKind.ConditionalExpression:
                    return emitConditionalExpression(<ConditionalExpression>node);
                case SyntaxKind.SpreadElementExpression:
                    return emitSpreadElementExpression(<SpreadElementExpression>node);
                case SyntaxKind.YieldExpression:
                    return emitYieldExpression(<YieldExpression>node);
                case SyntaxKind.OmittedExpression:
                    return;
                case SyntaxKind.EmptyStatement:
                    return;
                case SyntaxKind.ForOfStatement:
                case SyntaxKind.ForInStatement:
                    return emitForInOrForOfStatement(<ForInStatement>node);
                case SyntaxKind.WithStatement:
                    return emitWithStatement(<WithStatement>node);
                case SyntaxKind.SwitchStatement:
                    return emitSwitchStatement(<SwitchStatement>node);
                case SyntaxKind.CaseClause:
                case SyntaxKind.DefaultClause:
                    return emitCaseOrDefaultClause(<CaseOrDefaultClause>node);
                case SyntaxKind.ThrowStatement:
                    return emitThrowStatement(<ThrowStatement>node);
                case SyntaxKind.TryStatement:
                    return emitTryStatement(<TryStatement>node);
                case SyntaxKind.CatchClause:
                    return emitCatchClause(<CatchClause>node);
                case SyntaxKind.DebuggerStatement:
                    return emitDebuggerStatement(node);
                case SyntaxKind.ClassExpression:
                    return emitClassExpression(<ClassExpression>node);
                case SyntaxKind.EnumMember:
                    return emitEnumMember(<EnumMember>node);
                case SyntaxKind.ImportDeclaration:
                    return emitImportDeclaration(<ImportDeclaration>node);
                case SyntaxKind.ImportEqualsDeclaration:
                    return emitImportEqualsDeclaration(<ImportEqualsDeclaration>node);
                case SyntaxKind.ExportDeclaration:
                    return emitExportDeclaration(<ExportDeclaration>node);
                case SyntaxKind.ExportAssignment:
                    return emitExportAssignment(<ExportAssignment>node);
                */
            }
        }
    }

    export interface FuncInfo {
        name: string;
        type: string;
        args: number;
        value: number;
    }

    export interface MicrobitConfig {
        dependencies?: U.Map<string>;
        config?: U.Map<string>;
    }

    export interface ExtensionInfo {
        enums: U.Map<number>;
        functions: FuncInfo[];
        generatedFiles: U.Map<string>;
        extensionFiles: U.Map<string>;
        microbitConfig: MicrobitConfig;
        errors: string;
        sha: string;
        compileData: string;
        hasExtension: boolean;
    }

    export function emptyExtInfo(): ExtensionInfo {
        return {
            enums: {},
            functions: [],
            generatedFiles: {},
            extensionFiles: {},
            errors: "",
            sha: "",
            compileData: "",
            hasExtension: false,
            microbitConfig: {
                dependencies: {},
                config: {}
            }
        }
    }


    export class Binary {
        procs: ir.Procedure[] = [];
        globals: ir.Cell[] = [];
        finalPass = false;
        target: CompileTarget;
        writeFile = (fn: string, cont: string) => { };

        strings: StringMap<string> = {};
        otherLiterals: string[] = [];
        lblNo = 0;

        isDataRecord(s: string) {
            if (!s) return false
            var m = /^:......(..)/.exec(s)
            assert(!!m)
            return m[1] == "00"
        }

        addProc(proc: ir.Procedure) {
            this.procs.push(proc)
            proc.seqNo = this.procs.length
            //proc.binary = this
        }


        emitString(s: string): string {
            if (this.strings.hasOwnProperty(s))
                return this.strings[s]
            var lbl = "_str" + this.lblNo++
            this.strings[s] = lbl;
            return lbl
        }
    }
}
