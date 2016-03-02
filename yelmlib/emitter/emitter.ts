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

    export function setLocationProps(l: ir.Cell) {
        l._isRef = isRefDecl(l.def)
        l._isLocal = isLocalVar(l.def)
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

    function getFunctionLabel(node: FunctionLikeDeclaration) {
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
            bin.serialize();
            bin.patchSrcHash();

            let writeFileSync = (fn: string, data: string) =>
                host.writeFile(fn, data, false, null);
            // this doesn't actully write file, it just stores it for the cli.ts to write it
            writeFileSync("microbit.asm", bin.csource)
            bin.assemble();
            const myhex = hex.patchHex(bin, false).join("\r\n") + "\r\n"
            writeFileSync("microbit.asm", bin.csource) // optimized
            writeFileSync("microbit.hex", myhex)
            writeFileSync("microbit.js", bin.jssource)
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

            bin.emitLiteral(".balign 4");
            bin.emitLiteral(lbl + ": .short 0xffff")
            bin.emitLiteral("        .short " + w + ", " + h)
            let jsLit = "new rt.micro_bit.Image(" + w + ", [" + lit + "])"
            if (lit.length % 4 != 0)
                lit += "42" // pad
            bin.emitLiteral("        .byte " + lit)

            return <any>{
                kind: SyntaxKind.NumericLiteral,
                imageLiteral: lbl,
                jsLit
            }
        }

        function emitLocalLoad(decl: VarOrParam) {
            let l = lookupCell(decl)
            recordUse(decl)
            return l.load()
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
                    let ptr = ir.ptrlit(lbl, JSON.stringify(node.text))
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
                    return ir.rtcall(collType + "::at", [arr, idx])
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

                return rtcallMask("action::run" + suff, args)
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
                    proc.emitExpr(ir.op(EK.ProcCall, args.map(emitExpr), ctor))
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
            let lbl = getFunctionLabel(node) + "_Lit"
            let r = ir.ptrlit(lbl, lbl)
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
            let bogus = isBogusReturn(expr)
            let pre = ir.shared(emitExpr(expr.operand))
            let post = ir.rtcall(meth, [pre, ir.numlit(1)])
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

        function isBogusReturn(node: Expression) {
            let par = node.parent
            if (!(par.kind == SyntaxKind.ExpressionStatement ||
                (par.kind == SyntaxKind.ForStatement &&
                    (<ForStatement>par).incrementor == node || (<ForStatement>par).initializer == node)))
                return false

            if (node.kind == SyntaxKind.PrefixUnaryExpression || node.kind == SyntaxKind.PostfixUnaryExpression) {
                let iexpr = <PrefixUnaryExpression | PostfixUnaryExpression>node
                return iexpr.operator == SyntaxKind.PlusPlusToken || iexpr.operator == SyntaxKind.MinusMinusToken
            }

            if (node.kind == SyntaxKind.BinaryExpression) {
                let bexpr = <BinaryExpression>node
                return (bexpr.operatorToken.kind == SyntaxKind.EqualsToken)
            }

            return false
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
            if (!(a.flags & TypeFlags.Void) && !isBogusReturn(node)) {
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

    module hex {
        var funcInfo: StringMap<FuncInfo>;
        var hex: string[];
        var jmpStartAddr: number;
        var jmpStartIdx: number;
        var bytecodeStartAddr: number;
        var bytecodeStartIdx: number;

        function swapBytes(str: string) {
            var r = ""
            for (var i = 0; i < str.length; i += 2)
                r = str[i] + str[i + 1] + r
            assert(i == str.length)
            return r
        }


        export function isSetupFor(extInfo: ExtensionInfo) {
            return currentSetup == extInfo.sha
        }

        function parseHexBytes(bytes: string): number[] {
            bytes = bytes.replace(/^[\s:]/, "")
            if (!bytes) return []
            var m = /^([a-f0-9][a-f0-9])/i.exec(bytes)
            if (m)
                return [parseInt(m[1], 16)].concat(parseHexBytes(bytes.slice(2)))
            else
                throw oops("bad bytes " + bytes)
        }

        var currentSetup: string = null;
        export function setupFor(extInfo: ExtensionInfo, bytecodeInfo: any) {
            if (isSetupFor(extInfo))
                return;

            currentSetup = extInfo.sha;

            var jsinf = bytecodeInfo
            hex = jsinf.hex;

            var i = 0;
            var upperAddr = "0000"
            var lastAddr = 0
            var lastIdx = 0
            bytecodeStartAddr = 0
            for (; i < hex.length; ++i) {
                var m = /:02000004(....)/.exec(hex[i])
                if (m) {
                    upperAddr = m[1]
                }
                m = /^:..(....)00/.exec(hex[i])
                if (m) {
                    var newAddr = parseInt(upperAddr + m[1], 16)
                    if (!bytecodeStartAddr && newAddr >= 0x3C000) {
                        var bytes = parseHexBytes(hex[lastIdx])
                        if (bytes[0] != 0x10) {
                            bytes.pop() // checksum
                            bytes[0] = 0x10;
                            while (bytes.length < 20)
                                bytes.push(0x00)
                            hex[lastIdx] = hexBytes(bytes)
                        }
                        assert((bytes[2] & 0xf) == 0)

                        bytecodeStartAddr = lastAddr + 16
                        bytecodeStartIdx = lastIdx + 1
                    }
                    lastIdx = i
                    lastAddr = newAddr
                }
                m = /^:10....000108010842424242010801083ED8E98D/.exec(hex[i])
                if (m) {
                    jmpStartAddr = lastAddr
                    jmpStartIdx = i
                }
            }

            if (!jmpStartAddr)
                oops("No hex start")

            funcInfo = {};
            var funs: FuncInfo[] = jsinf.functions.concat(extInfo.functions);

            var addEnum = (enums: any) =>
                Object.keys(enums).forEach(k => {
                    funcInfo[k] = {
                        name: k,
                        type: "E",
                        args: 0,
                        value: enums[k]
                    }
                })

            addEnum(extInfo.enums)
            addEnum(jsinf.enums)

            for (var i = jmpStartIdx + 1; i < hex.length; ++i) {
                var m = /^:10(....)00(.{16})/.exec(hex[i])

                if (!m) continue;

                var s = hex[i].slice(9)
                while (s.length >= 8) {
                    var inf = funs.shift()
                    if (!inf) return;
                    funcInfo[inf.name] = inf;
                    let hexb = s.slice(0, 8)
                    //console.log(inf.name, hexb)
                    inf.value = parseInt(swapBytes(hexb), 16) & 0xfffffffe
                    if (!inf.value) {
                        U.oops("No value for " + inf.name + " / " + hexb)
                    }
                    s = s.slice(8)
                }
            }

            oops();
        }

        export function lookupFunc(name: string) {
            if (/^uBit\./.test(name))
                name = name.replace(/^uBit\./, "micro_bit::").replace(/\.(.)/g, (x, y) => y.toUpperCase())
            return funcInfo[name]
        }

        export function lookupFunctionAddr(name: string) {
            var inf = lookupFunc(name)
            if (inf)
                return inf.value - bytecodeStartAddr
            return null
        }


        export function hexTemplateHash() {
            var sha = currentSetup ? currentSetup.slice(0, 16) : ""
            while (sha.length < 16) sha += "0"
            return sha.toUpperCase()
        }

        function hexBytes(bytes: number[]) {
            var chk = 0
            var r = ":"
            bytes.forEach(b => chk += b)
            bytes.push((-chk) & 0xff)
            bytes.forEach(b => r += ("0" + b.toString(16)).slice(-2))
            return r.toUpperCase();
        }

        export function patchHex(bin: Binary, shortForm: boolean) {
            var myhex = hex.slice(0, bytecodeStartIdx)

            assert(bin.buf.length < 32000)

            var ptr = 0

            function nextLine(buf: number[], addr: number) {
                var bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0]
                for (var j = 0; j < 8; ++j) {
                    bytes.push((buf[ptr] || 0) & 0xff)
                    bytes.push((buf[ptr] || 0) >>> 8)
                    ptr++
                }
                return bytes
            }

            var hd = [0x4207, bin.globals.length, bytecodeStartAddr & 0xffff, bytecodeStartAddr >>> 16]
            var tmp = hexTemplateHash()
            for (var i = 0; i < 4; ++i)
                hd.push(parseInt(swapBytes(tmp.slice(i * 4, i * 4 + 4)), 16))

            myhex[jmpStartIdx] = hexBytes(nextLine(hd, jmpStartAddr))

            ptr = 0

            if (shortForm) myhex = []

            var addr = bytecodeStartAddr;
            var upper = (addr - 16) >> 16
            while (ptr < bin.buf.length) {
                if ((addr >> 16) != upper) {
                    upper = addr >> 16
                    myhex.push(hexBytes([0x02, 0x00, 0x00, 0x04, upper >> 8, upper & 0xff]))
                }

                myhex.push(hexBytes(nextLine(bin.buf, addr)))
                addr += 16
            }

            if (!shortForm)
                hex.slice(bytecodeStartIdx).forEach(l => myhex.push(l))

            return myhex;
        }


    }

    function asmline(s: string) {
        if (!/(^[\s;])|(:$)/.test(s))
            s = "    " + s
        return s + "\n"
    }

    export var peepDbg = false;

    class Location {
        isarg = false;
        iscap = false;

        constructor(public index: number, public def: Declaration, public info: VariableAddInfo) {
            if (!isRefDecl(this.def) && typeOf(this.def).flags & TypeFlags.Void) {
                oops("void-typed variable, " + this.toString())
            }
        }

        toString() {
            var n = ""
            if (this.def) n += (<any>this.def.name).text || "?"
            if (this.isarg) n = "ARG " + n
            if (this.isRef()) n = "REF " + n
            if (this.isByRefLocal()) n = "BYREF " + n
            return "[" + n + "]"
        }

        isRef() {
            return this.def && isRefDecl(this.def)
        }

        isGlobal() {
            return isGlobalVar(this.def)
        }

        isLocal() {
            return isLocalVar(this.def) || isParameter(this.def)
        }

        refSuff() {
            if (this.isRef()) return "Ref"
            else return ""
        }

        isByRefLocal() {
            return this.isLocal() && this.info.captured && this.info.written
        }

        emitStoreByRef(proc: Procedure) {
            if (this.isByRefLocal()) {
                this.emitLoadLocal(proc);
                proc.emit("pop {r1}");
                proc.emitCallRaw("bitvm::stloc" + this.refSuff()); // unref internal
            } else {
                this.emitStore(proc)
            }
        }

        asmref(proc: Procedure) {
            if (this.iscap) {
                assert(0 <= this.index && this.index < 32)
                return "[r5, #4*" + this.index + "]"
            } else if (this.isarg) {
                var idx = proc.args.length - this.index - 1
                return "[sp, args@" + idx + "] ; " + this.toString()
            } else {
                var idx = this.index
                return "[sp, locals@" + idx + "] ; " + this.toString()
            }
        }

        emitStoreCore(proc: Procedure) {
            proc.emit("str r0, " + this.asmref(proc))
        }

        emitStore(proc: Procedure) {
            if (this.iscap && proc.binary.finalPass) {
                debugger
                oops("store for captured")
            }

            if (this.isGlobal()) {
                proc.emitInt(this.index)
                proc.emitCall("bitvm::stglb" + this.refSuff(), 0); // unref internal
            } else {
                assert(!this.isByRefLocal())
                if (this.isRef()) {
                    this.emitLoadCore(proc);
                    proc.emitCallRaw("bitvm::decr");
                }
                proc.emit("pop {r0}");
                this.emitStoreCore(proc)
            }
        }

        emitLoadCore(proc: Procedure) {
            proc.emit("ldr r0, " + this.asmref(proc))
        }

        emitLoadByRef(proc: Procedure) {
            if (this.isByRefLocal()) {
                this.emitLoadLocal(proc);
                proc.emitCallRaw("bitvm::ldloc" + this.refSuff())
                proc.emit("push {r0}");
            } else this.emitLoad(proc);
        }

        emitLoadLocal(proc: Procedure) {
            this.emitLoadCore(proc)
        }

        emitLoad(proc: Procedure, direct = false) {
            if (this.isGlobal()) {
                proc.emitInt(this.index)
                proc.emitCall("bitvm::ldglb" + this.refSuff(), 0); // unref internal
            } else {
                assert(direct || !this.isByRefLocal())
                this.emitLoadLocal(proc);
                proc.emit("push {r0}");
                if (this.isRef() || this.isByRefLocal()) {
                    proc.emitCallRaw("bitvm::incr");
                }
            }
        }

        emitClrIfRef(proc: Procedure) {
            assert(!this.isGlobal() && !this.iscap)
            if (this.isRef() || this.isByRefLocal()) {
                this.emitLoadCore(proc);
                proc.emitCallRaw("bitvm::decr");
            }
        }
    }

    class Procedure {
        numArgs = 0;
        action: FunctionLikeDeclaration;
        info: FunctionAddInfo;
        seqNo: number;
        lblNo = 0;
        isRoot = false;

        prebody = "";
        body = "";
        locals: Location[] = [];
        captured: Location[] = [];
        args: Location[] = [];
        binary: Binary;
        parent: Procedure;

        hasReturn() {
            let sig = checker.getSignatureFromDeclaration(this.action)
            let rettp = checker.getReturnTypeOfSignature(sig)
            return !(rettp.flags & TypeFlags.Void)
        }

        toString() {
            return this.prebody + this.body
        }

        getName() {
            let text = this.action && this.action.name ? (<Identifier>this.action.name).text : null
            return text || "inline"
        }

        mkLocal(def: Declaration, info: VariableAddInfo) {
            var l = new Location(this.locals.length, def, info)
            //if (def) console.log("LOCAL: " + def.getName() + ": ref=" + def.isByRef() + " cap=" + def._isCaptured + " mut=" + def._isMutable)
            this.locals.push(l)
            return l
        }

        localIndex(l: Declaration, noargs = false): Location {
            return this.captured.filter(n => n.def == l)[0] ||
                this.locals.filter(n => n.def == l)[0] ||
                (noargs ? null : this.args.filter(n => n.def == l)[0])
        }

        emitClrs() {
            if (this.isRoot) return;
            var lst = this.locals.concat(this.args)
            lst.forEach(p => {
                p.emitClrIfRef(this)
            })
        }

        emitCallRaw(name: string) {
            var inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented raw function: " + name)
            this.emit("bl " + name + " ; *" + inf.type + inf.args + " (raw)")
        }

        emitCall(name: string, mask: number, isAsync = false) {
            var inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented function: " + name)

            assert(inf.args <= 4)

            if (inf.args >= 4)
                this.emit("pop {r3}");
            if (inf.args >= 3)
                this.emit("pop {r2}");
            if (inf.args >= 2)
                this.emit("pop {r1}");
            if (inf.args >= 1)
                this.emit("pop {r0}");

            var reglist: string[] = []

            for (var i = 0; i < 4; ++i) {
                if (mask & (1 << i))
                    reglist.push("r" + i)
            }

            var numMask = reglist.length

            if (inf.type == "F" && mask != 0) {
                // reserve space for return val
                reglist.push("r7")
                this.emit("@stackmark retval")
            }

            assert((mask & ~0xf) == 0)

            if (reglist.length > 0)
                this.emit("push {" + reglist.join(",") + "}")

            let lbl = ""
            if (isAsync)
                lbl = this.mkLabel("async")

            this.emit("bl " + name + " ; *" + inf.type + inf.args + " " + lbl)

            if (lbl) this.emitLbl(lbl)

            if (inf.type == "F") {
                if (mask == 0)
                    this.emit("push {r0}");
                else {
                    this.emit("str r0, [sp, retval@-1]")
                }
            }
            else if (inf.type == "P") {
                // ok
            }
            else oops("invalid call type " + inf.type)

            while (numMask-- > 0) {
                this.emitCall("bitvm::decr", 0);
            }
        }

        emitJmp(trg: string, name = "JMP") {
            var lbl = ""
            if (name == "JMPZ") {
                lbl = this.mkLabel("jmpz")
                this.emit("pop {r0}");
                this.emit("*cmp r0, #0")
                this.emit("*bne " + lbl) // this is to *skip* the following 'b' instruction; bne itself has a very short range
                this.emit("@js if (!r0)")
            } else if (name == "JMPNZ") {
                lbl = this.mkLabel("jmpnz")
                this.emit("pop {r0}");
                this.emit("*cmp r0, #0")
                this.emit("*beq " + lbl)
                this.emit("@js if (r0)")
            } else if (name == "JMP") {
                // ok
            } else {
                oops("bad jmp");
            }

            this.emit("bb " + trg)
            if (lbl)
                this.emitLbl(lbl)
        }

        mkLabel(root: string): string {
            return "." + root + "." + this.seqNo + "." + this.lblNo++;
        }

        emitLbl(lbl: string) {
            this.emit(lbl + ":")
        }

        emit(name: string) {
            this.body += asmline(name)
        }

        emitMov(v: number) {
            assert(0 <= v && v <= 255)
            this.emit("movs r0, #" + v)
        }

        emitAdd(v: number) {
            assert(0 <= v && v <= 255)
            this.emit("adds r0, #" + v)
        }

        emitLdPtr(lbl: string, push = false) {
            assert(!!lbl)
            this.emit("*movs r0, " + lbl + "@hi  ; ldptr " + lbl)
            this.emit("*lsls r0, r0, #8")
            this.emit("*adds r0, " + lbl + "@lo  ; endldptr");
            if (push)
                this.emit("push {r0}")
        }

        emitInt(v: number, keepInR0 = false) {
            assert(v != null);

            var n = Math.floor(v)
            var isNeg = false
            if (n < 0) {
                isNeg = true
                n = -n
            }

            if (n <= 255) {
                this.emitMov(n)
            } else if (n <= 0xffff) {
                this.emitMov((n >> 8) & 0xff)
                this.emit("lsls r0, r0, #8")
                this.emitAdd(n & 0xff)
            } else {
                this.emitMov((n >> 24) & 0xff)
                this.emit("lsls r0, r0, #8")
                this.emitAdd((n >> 16) & 0xff)
                this.emit("lsls r0, r0, #8")
                this.emitAdd((n >> 8) & 0xff)
                this.emit("lsls r0, r0, #8")
                this.emitAdd((n >> 0) & 0xff)
            }
            if (isNeg) {
                this.emit("negs r0, r0")
            }

            if (!keepInR0)
                this.emit("push {r0}")
        }

        stackEmpty() {
            this.emit("@stackempty locals");
        }

        pushLocals() {
            assert(this.prebody == "")
            this.prebody = this.body
            this.body = ""
        }

        popLocals() {
            var suff = this.body
            this.body = this.prebody

            var len = this.locals.length

            if (len > 0) this.emit("movs r0, #0")
            this.locals.forEach(l => {
                this.emit("push {r0} ; loc")
            })
            this.emit("@stackmark locals")

            this.body += suff

            assert(0 <= len && len < 127);
            if (len > 0) this.emit("add sp, #4*" + len + " ; pop locals " + len)
        }
    }



    class Binary {
        procs: ir.Procedure[] = [];
        globals: ir.Cell[] = [];
        buf: number[];
        csource = "";
        jssource = "";
        finalPass = false;

        strings: StringMap<string> = {};
        stringsBody = "";
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


        stringLiteral(s: string) {
            var r = "\""
            for (var i = 0; i < s.length; ++i) {
                // TODO generate warning when seeing high character ?
                var c = s.charCodeAt(i) & 0xff
                var cc = String.fromCharCode(c)
                if (cc == "\\" || cc == "\"")
                    r += "\\" + cc
                else if (cc == "\n")
                    r += "\\n"
                else if (c <= 0xf)
                    r += "\\x0" + c.toString(16)
                else if (c < 32 || c > 127)
                    r += "\\x" + c.toString(16)
                else
                    r += cc;
            }
            return r + "\""
        }

        emitLiteral(s: string) {
            this.stringsBody += s + "\n"
        }

        emitString(s: string): string {
            if (this.strings.hasOwnProperty(s))
                return this.strings[s]

            var lbl = "_str" + this.lblNo++
            this.strings[s] = lbl;
            this.emitLiteral(".balign 4");
            this.emitLiteral(lbl + "meta: .short 0xffff, " + s.length)
            this.emitLiteral(lbl + ": .string " + this.stringLiteral(s))
            return lbl
        }

        emit(s: string) {
            this.csource += asmline(s)
        }

        serialize() {
            assert(this.csource == "");

            this.emit("; start")
            this.emit(".hex 708E3B92C615A841C49866C975EE5197")
            this.emit(".hex " + hex.hexTemplateHash() + " ; hex template hash")
            this.emit(".hex 0000000000000000 ; @SRCHASH@")
            this.emit(".space 16 ; reserved")

            this.procs.forEach(p => {
                this.csource += "\n" + irToAssembly(this, p)
            })

            this.csource += "_end_js:\n"

            this.csource += this.stringsBody

            this.emit("_program_end:");
        }

        patchSrcHash() {
            //TODO
            //var srcSha = Random.sha256buffer(Util.stringToUint8Array(Util.toUTF8(this.csource)))
            //this.csource = this.csource.replace(/\n.*@SRCHASH@\n/, "\n    .hex " + srcSha.slice(0, 16).toUpperCase() + " ; program hash\n")
        }

        assemble() {
            thumb.test(); // just in case

            var b = new thumb.File();
            b.lookupExternalLabel = hex.lookupFunctionAddr;
            b.normalizeExternalLabel = s => {
                let inf = hex.lookupFunc(s)
                if (inf) return inf.name;
                return s
            }
            // b.throwOnError = true;
            b.emit(this.csource);
            this.csource = b.getSource(!peepDbg);
            this.jssource = b.savedJs || b.js;
            if (b.errors.length > 0) {
                var userErrors = ""
                b.errors.forEach(e => {
                    var m = /^user(\d+)/.exec(e.scope)
                    if (m) {
                        // This generally shouldn't happen, but it may for certin kind of global 
                        // errors - jump range and label redefinitions
                        var no = parseInt(m[1])
                        var proc = this.procs.filter(p => p.seqNo == no)[0]
                        if (proc && proc.action)
                            userErrors += lf("At function {0}:\n", proc.getName())
                        else
                            userErrors += lf("At inline assembly:\n")
                        userErrors += e.message
                    }
                })

                if (userErrors) {
                    //TODO
                    console.log(lf("errors in inline assembly"))
                    console.log(userErrors)
                } else {
                    throw new Error(b.errors[0].message)
                }
            } else {
                this.buf = b.buf;
            }
        }
    }


    function irToAssembly(bin: Binary, proc: ir.Procedure) {
        let jmpLblNo = 0
        let resText = ""
        let write = (s: string) => { resText += asmline(s); }
        
        console.log(proc.toString())

        write(`
;
; Function ${proc.getName()}
;
.section code
${getFunctionLabel(proc.action)}:
    @stackmark func
    @stackmark args
    push {lr}
`)

        let numlocals = proc.locals.length
        if (numlocals > 0) write("movs r0, #0")
        proc.locals.forEach(l => {
            write("push {r0} ; loc")
        })
        write("@stackmark locals")

        proc.resolve()

        let exprStack: ir.Expr[] = []

        for (let i = 0; i < proc.body.length; ++i) {
            emitStmt(proc.body[i])
        }

        assert(0 <= numlocals && numlocals < 127);
        if (numlocals > 0)
            write("add sp, #4*" + numlocals + " ; pop locals " + numlocals)
        write("pop {pc}");
        write("@stackempty func");
        write("@stackempty args")

        if (proc.args.length <= 2)
            emitLambdaWrapper()

        return resText

        function emitStmt(s: ir.Stmt) {
            switch (s.stmtKind) {
                case ir.SK.Expr:
                    emitExpr(s.expr)
                    break;
                case ir.SK.StackEmpty:
                    U.assert(exprStack.length == 0)
                    write("@stackempty locals")
                    break;
                case ir.SK.Jmp:
                    emitJmp(s);
                    break;
                case ir.SK.Label:
                    write(s.lblName + ":")
                    break;
                default: oops();
            }
        }

        function emitJmp(jmp: ir.Stmt) {
            if (jmp.jmpMode == ir.JmpMode.Always) {
                if (jmp.expr)
                    emitExpr(jmp.expr)
                write("bb " + jmp.lblName + " ; with expression")
            } else {
                let lbl = ".jmpz." + jmpLblNo++
                emitExpr(jmp.expr)

                write("*cmp r0, #0")
                if (jmp.jmpMode == ir.JmpMode.IfZero) {
                    write("*beq " + lbl) // this is to *skip* the following 'b' instruction; beq itself has a very short range
                    write("@js if (r0)")
                } else {
                    write("*bne " + lbl)
                    write("@js if (!r0)")
                }

                write("bb " + jmp.lblName)
                write(lbl + ":")
            }
        }

        function clearStack() {
            let numEntries = 0
            while (exprStack.length > 0 && exprStack[0].currUses == exprStack[0].totalUses) {
                numEntries++;
                exprStack.shift()
            }
            if (numEntries)
                write("add sp, #4*" + numEntries + " ; clear stack")
        }

        function withRef(name: string, isRef: boolean) {
            return name + (isRef ? "Ref" : "")
        }

        function emitExprInto(e: ir.Expr, reg: string) {
            switch (e.exprKind) {
                case EK.NumberLiteral:
                    if (e.data === true) emitInt(1, reg);
                    else if (e.data === false) emitInt(0, reg);
                    else if (e.data === null) emitInt(0, reg);
                    else if (typeof e.data == "number") emitInt(e.data, reg)
                    else oops();
                    break;
                case EK.PointerLiteral:
                    emitLdPtr(e.data, reg);
                    write(`@js ${reg} = ${e.jsInfo}`)
                    break;
                case EK.Shared:
                    let arg = e.args[0]
                    U.assert(!!arg.currUses) // not first use
                    U.assert(arg.currUses < arg.totalUses)
                    arg.currUses++
                    let idx = exprStack.indexOf(arg)
                    U.assert(idx >= 0)
                    if (idx == 0 && arg.totalUses == arg.currUses) {
                        write(`pop {${reg}}  ; tmpref`)
                        exprStack.shift()
                        clearStack()
                    } else {
                        write(`ldr ${reg}, [sp, #4*${idx}]   ; tmpref`)
                    }
                    break;
                case EK.CellRef:
                    write(`ldr ${reg}, ${cellref(e.data)}`)
                    break;
                default: oops();
            }
        }

        // result in R0
        function emitExpr(e: ir.Expr): void {
            switch (e.exprKind) {
                case EK.JmpValue:
                    write("; jmp value (already in r0)")
                    break;
                case EK.Incr:
                    emitExpr(e.args[0])
                    emitCallRaw("bitvm::incr")
                    break;
                case EK.Decr:
                    emitExpr(e.args[0])
                    emitCallRaw("bitvm::decr")
                    break;
                case EK.FieldAccess:
                    let info = e.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    return emitExpr(ir.rtcall(withRef("bitvm::ldfld", info.isRef), [e.args[0], ir.numlit(info.idx)]))
                case EK.Store:
                    return emitStore(e.args[0], e.args[1])
                case EK.RuntimeCall:
                    return emitRtCall(e);
                case EK.ProcCall:
                    return emitProcCall(e)
                case EK.Shared:
                    return emitSharedDef(e)
                case EK.Sequence:
                    return e.args.forEach(emitExpr)
                default:
                    return emitExprInto(e, "r0")
            }
        }

        function emitSharedDef(e: ir.Expr) {
            let arg = e.args[0]
            U.assert(!!arg.totalUses)
            if (arg.currUses > 0)
                return emitExprInto(e, "r0") // cached use
            arg.currUses = 1
            if (arg.totalUses == 1)
                return emitExpr(arg)
            else {
                exprStack.unshift(arg)
                write("push {r0}")
            }
        }

        function emitRtCall(e: ir.Expr) {
            let didStateUpdate = false
            let complexArgs: ir.Expr[] = []
            for (let a of U.reversed(e.args)) {
                if (a.isStateless()) continue
                if (a.exprKind == EK.CellRef && !didStateUpdate) continue
                if (a.canUpdateCells()) didStateUpdate = true
                complexArgs.push(a)
            }
            complexArgs.reverse()
            let precomp: ir.Expr[] = []
            let flattened = e.args.map(a => {
                let idx = complexArgs.indexOf(a)
                if (idx >= 0) {
                    let shared = a
                    if (a.exprKind == EK.Shared) {
                        a.args[0].totalUses++
                    } else if (a.exprKind != EK.Shared) {
                        shared = ir.shared(a)
                        a.totalUses = 2
                    }
                    precomp.push(shared)
                    return shared
                } else return a
            })

            precomp.forEach(emitExpr)

            flattened.forEach((a, i) => {
                U.assert(i <= 3)
                emitExprInto(a, "r" + i)
            })

            let name: string = e.data
            let lbl = e.isAsync ? ".rtcall." + jmpLblNo++ : ""
            write(`bl ${name}  ; *F${e.args.length} ${lbl}`)
            if (lbl)
                write(lbl + ":")
        }

        function emitProcCall(e: ir.Expr) {
            let stackBottom = 0
            let argStmts = e.args.map((a, i) => {
                emitExpr(e)
                if (i == 0) stackBottom = exprStack.length
                write("push {r0} ; proc-arg")
                a.totalUses = 1
                a.currUses = 0
                exprStack.push(a)
                U.assert(exprStack.length - stackBottom == i)
                return a
            })

            let proc = bin.procs.filter(p => p.action == e.data)[0]

            let lbl = ".call." + jmpLblNo++
            write("bl " + getFunctionLabel(proc.action) + " ; *R " + lbl)
            write(lbl + ":")

            for (let a of argStmts) {
                a.currUses = 1
            }
            clearStack()
        }

        function emitStore(trg: ir.Expr, src: ir.Expr) {
            switch (trg.exprKind) {
                case EK.CellRef:
                    emitExpr(src)
                    write("str r0, " + cellref(trg.data))
                    break;
                case EK.FieldAccess:
                    let info = trg.data as FieldAccessInfo
                    // it does the decr itself, no mask
                    emitExpr(ir.rtcall(withRef("bitvm::stfld", info.isRef), [trg.args[0], ir.numlit(info.idx), src]))
                    break;
            }
        }

        function cellref(cell: ir.Cell) {
            if (cell.iscap) {
                assert(0 <= cell.index && cell.index < 32)
                return "[r5, #4*" + cell.index + "]"
            } else if (cell.isarg) {
                let idx = proc.args.length - cell.index - 1
                return "[sp, args@" + idx + "] ; " + cell.toString()
            } else {
                return "[sp, locals@" + cell.index + "] ; " + cell.toString()
            }
        }

        function emitLambdaWrapper() {
            let node = proc.action
            write("")
            write(".section code");
            write(".balign 4");
            write(getFunctionLabel(node) + "_Lit");
            write(".short 0xffff, 0x0000   ; action literal");
            write("@stackmark litfunc");
            write("push {r5, lr}");
            write("mov r5, r1");

            let parms = proc.args.map(a => a.def)
            parms.forEach((p, i) => {
                if (i >= 2)
                    userError(lf("only up to two parameters supported in lambdas"))
                write(`push {r${i + 2}}`)
            })
            write("@stackmark args");

            write("bl " + getFunctionLabel(node))

            write("@stackempty args")
            if (parms.length)
                write("add sp, #4*" + parms.length + " ; pop args")
            write("pop {r5, pc}");
            write("@stackempty litfunc");
        }

        function emitCallRaw(name: string) {
            var inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented raw function: " + name)
            write("bl " + name + " ; *" + inf.type + inf.args + " (raw)")
        }

        function writeCall(name: string, mask: number, isAsync = false) {
            var inf = hex.lookupFunc(name)
            assert(!!inf, "unimplemented function: " + name)

            assert(inf.args <= 4)

            if (inf.args >= 4)
                write("pop {r3}");
            if (inf.args >= 3)
                write("pop {r2}");
            if (inf.args >= 2)
                write("pop {r1}");
            if (inf.args >= 1)
                write("pop {r0}");

            var reglist: string[] = []

            for (var i = 0; i < 4; ++i) {
                if (mask & (1 << i))
                    reglist.push("r" + i)
            }

            var numMask = reglist.length

            if (inf.type == "F" && mask != 0) {
                // reserve space for return val
                reglist.push("r7")
                write("@stackmark retval")
            }

            assert((mask & ~0xf) == 0)

            if (reglist.length > 0)
                write("push {" + reglist.join(",") + "}")

            let lbl = ""
            if (isAsync)
                lbl = ".async." + jmpLblNo++

            write("bl " + name + " ; *" + inf.type + inf.args + " " + lbl)

            if (lbl) write(lbl + ":")

            if (inf.type == "F") {
                if (mask == 0)
                    write("push {r0}");
                else {
                    write("str r0, [sp, retval@-1]")
                }
            }
            else if (inf.type == "P") {
                // ok
            }
            else oops("invalid call type " + inf.type)

            while (numMask-- > 0) {
                writeCall("bitvm::decr", 0);
            }
        }

        function emitLdPtr(lbl: string, reg: string) {
            assert(!!lbl)
            write(`*movs ${reg}, ${lbl}@hi  ; ldptr`)
            write(`*lsls ${reg}, ${reg}, #8`)
            write(`*adds ${reg}, ${lbl}@lo`);
        }

        function emitInt(v: number, reg: string) {
            function writeMov(v: number) {
                assert(0 <= v && v <= 255)
                write(`movs ${reg}, #${v}`)
            }

            function writeAdd(v: number) {
                assert(0 <= v && v <= 255)
                write(`adds ${reg}, #${v}`)
            }

            function shift() {
                write(`lsls ${reg}, ${reg}, #8`)
            }

            assert(v != null);

            var n = Math.floor(v)
            var isNeg = false
            if (n < 0) {
                isNeg = true
                n = -n
            }

            if (n <= 255) {
                writeMov(n)
            } else if (n <= 0xffff) {
                writeMov((n >> 8) & 0xff)
                shift()
                writeAdd(n & 0xff)
            } else if (n <= 0xffffff) {
                writeMov((n >> 16) & 0xff)
                shift()
                writeAdd((n >> 8) & 0xff)
                shift()
                writeAdd(n & 0xff)
            } else {
                writeMov((n >> 24) & 0xff)
                shift()
                writeAdd((n >> 16) & 0xff)
                shift()
                writeAdd((n >> 8) & 0xff)
                shift()
                writeAdd((n >> 0) & 0xff)
            }
            if (isNeg) {
                write(`negs ${reg}, ${reg}`)
            }
        }


    }


}
