namespace ts.pxt {
    export var assert = Util.assert;
    export var oops = Util.oops;
    export type StringMap<T> = Util.Map<T>;
    export import U = ts.pxt.Util;

    export const BINARY_JS = "binary.js";
    export const BINARY_HEX = "binary.hex";
    export const BINARY_ASM = "binary.asm";

    let EK = ir.EK;
    export var SK = SyntaxKind;

    export function stringKind(n: Node) {
        if (!n) return "<null>"
        return (<any>ts).SyntaxKind[n.kind]
    }

    function inspect(n: Node) {
        console.log(stringKind(n))
    }

    function userError(msg: string, secondary = false): Error {
        let e = new Error(msg);
        (<any>e).ksEmitterUserError = true;
        if (secondary && inCatchErrors) {
            if (!lastSecondaryError)
                lastSecondaryError = msg
            return e
        }
        debugger;
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
        switch (node.kind) {
            case SK.TemplateHead:
            case SK.TemplateMiddle:
            case SK.TemplateTail:
            case SK.StringLiteral:
            case SK.NoSubstitutionTemplateLiteral:
                return true;
            default: return false;
        }
    }

    function isEmptyStringLiteral(e: Expression | TemplateLiteralFragment) {
        return isStringLiteral(e) && (e as LiteralExpression).text == ""
    }

    function getEnclosingMethod(node: Node): MethodDeclaration {
        if (!node) return null;
        if (node.kind == SK.MethodDeclaration || node.kind == SK.Constructor)
            return <MethodDeclaration>node;
        return getEnclosingMethod(node.parent)
    }

    function getEnclosingFunction(node0: Node) {
        let node = node0
        while (true) {
            node = node.parent
            if (!node)
                userError(lf("cannot determine parent of {0}", stringKind(node0)))
            if (node.kind == SK.FunctionDeclaration ||
                node.kind == SK.ArrowFunction ||
                node.kind == SK.FunctionExpression ||
                node.kind == SK.MethodDeclaration ||
                node.kind == SK.Constructor)
                return <FunctionLikeDeclaration>node
            if (node.kind == SK.SourceFile) return null
        }
    }

    function isGlobalVar(d: Declaration) {
        return d.kind == SK.VariableDeclaration && !getEnclosingFunction(d)
    }

    function isLocalVar(d: Declaration) {
        return d.kind == SK.VariableDeclaration && !isGlobalVar(d);
    }

    function isParameter(d: Declaration) {
        return d.kind == SK.Parameter
    }

    function isTopLevelFunctionDecl(decl: Declaration) {
        return (decl.kind == SK.FunctionDeclaration && !getEnclosingFunction(decl)) ||
            decl.kind == SK.MethodDeclaration ||
            decl.kind == SK.Constructor
    }

    function isSideEffectfulInitializer(init: Expression) {
        if (!init) return false;
        switch (init.kind) {
            case SK.NullKeyword:
            case SK.NumericLiteral:
            case SK.StringLiteral:
            case SK.TrueKeyword:
            case SK.FalseKeyword:
                return false;
            default:
                return true;
        }
    }

    export interface CommentAttrs {
        debug?: boolean; // requires ?dbg=1
        shim?: string;
        enumval?: string;
        helper?: string;
        help?: string;
        async?: boolean;
        promise?: boolean;
        hidden?: boolean;
        callingConvention: ir.CallingConvention;
        block?: string;
        blockId?: string;
        blockGap?: string;
        blockExternalInputs?: boolean;
        blockImportId?: string;
        blockBuiltin?: boolean;
        blockNamespace?: string;
        color?: string;
        icon?: string;
        imageLiteral?: number;
        weight?: number;

        // on interfaces
        indexerGet?: string;
        indexerSet?: string;

        _name?: string;
        jsDoc?: string;
        paramHelp?: Util.Map<string>;
        // foo.defl=12 -> paramDefl: { foo: "12" }
        paramDefl: Util.Map<string>;
    }

    export interface CallInfo {
        decl: Declaration;
        qName: string;
        attrs: CommentAttrs;
        args: Expression[];
    }

    interface ClassInfo {
        reffields: PropertyDeclaration[];
        primitivefields: PropertyDeclaration[];
        allfields: PropertyDeclaration[];
        attrs: CommentAttrs;
    }

    let lf = thumb.lf;
    let checker: TypeChecker;
    let lastSecondaryError: string
    let inCatchErrors = 0

    export function getComments(node: Node) {
        let src = getSourceFileOfNode(node)
        let doc = getLeadingCommentRangesOfNodeFromText(node, src.text)
        if (!doc) return "";
        let cmt = doc.map(r => src.text.slice(r.pos, r.end)).join("\n")
        return cmt;
    }

    export function parseCommentString(cmt: string): CommentAttrs {
        let res: CommentAttrs = { paramDefl: {}, callingConvention: ir.CallingConvention.Plain }
        let didSomething = true
        while (didSomething) {
            didSomething = false
            cmt = cmt.replace(/\/\/%[ \t]*([\w\.]+)(=(("[^"\n]+")|'([^'\n]+)'|([^\s]*)))?/,
                (f: string, n: string, d0: string, d1: string,
                    v0: string, v1: string, v2: string) => {
                    let v = v0 ? JSON.parse(v0) : (d0 ? (v0 || v1 || v2) : "true");
                    if (U.endsWith(n, ".defl")) {
                        res.paramDefl[n.slice(0, n.length - 5)] = v
                    } else {
                        (<any>res)[n] = v;
                    }
                    didSomething = true
                    return "//% "
                })
        }

        if (typeof res.weight == "string")
            res.weight = parseInt(res.weight as any)

        res.paramHelp = {}
        res.jsDoc = ""
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

        if (res.async)
            res.callingConvention = ir.CallingConvention.Async
        if (res.promise)
            res.callingConvention = ir.CallingConvention.Promise

        return res
    }

    export function parseCommentsOnSymbol(symbol: Symbol): CommentAttrs {
        let cmts = ""
        for (let decl of symbol.declarations) {
            cmts += getComments(decl)
        }
        return parseCommentString(cmts)
    }

    export function parseComments(node: Node): CommentAttrs {
        if (!node || (node as any).isRootFunction) return parseCommentString("")
        let res = parseCommentString(getComments(node))
        res._name = getName(node)
        return res
    }

    export function getName(node: Node & { name?: any; }) {
        if (!node.name || node.name.kind != SK.Identifier)
            return "???"
        return (node.name as Identifier).text
    }

    function isArrayType(t: Type) {
        return (t.flags & TypeFlags.Reference) && t.symbol.name == "Array"
    }

    function isInterfaceType(t: Type) {
        return t.flags & TypeFlags.Interface;
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
            if (isInterfaceType(t)) return t;
            if (deconstructFunctionType(t)) return t;
            userError(lf("unsupported type: {0} 0x{1}", checker.typeToString(t), t.flags.toString(16)), true)
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

    function funcHasReturn(fun: FunctionLikeDeclaration) {
        let sig = checker.getSignatureFromDeclaration(fun)
        let rettp = checker.getReturnTypeOfSignature(sig)
        return !(rettp.flags & TypeFlags.Void)
    }

    export function getDeclName(node: Declaration) {
        let text = node && node.name ? (<Identifier>node.name).text : null
        if (!text && node.kind == SK.Constructor)
            text = "constructor"
        if (node.parent && node.parent.kind == SK.ClassDeclaration)
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
        shimName: string;
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

    export function compileBinary(program: Program, host: CompilerHost, opts: CompileOptions, res: CompileResult): EmitResult {
        const diagnostics = createDiagnosticCollection();
        checker = program.getTypeChecker();
        let classInfos: StringMap<ClassInfo> = {}
        let usedDecls: StringMap<boolean> = {}
        let usedWorkList: Declaration[] = []
        let variableStatus: StringMap<VariableAddInfo> = {};
        let functionInfo: StringMap<FunctionAddInfo> = {};
        let brkMap: U.Map<Breakpoint> = {}

        if (opts.target.isNative) {
            if (!opts.hexinfo) {
                // we may have not been able to compile or download the hex file
                return {
                    diagnostics: [{
                        file: program.getSourceFiles()[0],
                        start: 0,
                        length: 0,
                        category: DiagnosticCategory.Error,
                        code: 9043,
                        messageText: lf("The hex file is not available, please connect to internet and try again.")
                    }],
                    emitSkipped: true
                };
            }

            hex.setupFor(opts.extinfo || emptyExtInfo(), opts.hexinfo);
            hex.setupInlineAssembly(opts);
        }

        if (opts.breakpoints)
            res.breakpoints = [{
                id: 0,
                isDebuggerStmt: false,
                fileName: "bogus",
                start: 0,
                length: 0,
                line: 0,
                character: 0
            }]

        let bin: Binary;
        let proc: ir.Procedure;

        function reset() {
            bin = new Binary();
            bin.res = res;
            bin.target = opts.target;
            proc = null
        }

        let allStmts = Util.concat(program.getSourceFiles().map(f => f.statements))

        let src = program.getSourceFiles()[0]
        let rootFunction = <any>{
            kind: SK.FunctionDeclaration,
            parameters: [],
            name: {
                text: "<main>",
                pos: 0,
                end: 0
            },
            body: {
                kind: SK.Block,
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

            catchErrors(rootFunction, finalEmit)
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
            if (diagnostics.getModificationCount() || opts.noEmit || !host)
                return;

            bin.writeFile = (fn: string, data: string) =>
                host.writeFile(fn, data, false, null);

            if (opts.target.isNative) {
                thumbEmit(bin, opts)
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
                    allfields: null,
                    attrs: parseComments(decl)
                }
                classInfos[id + ""] = info;
                for (let mem of decl.members) {
                    if (mem.kind == SK.PropertyDeclaration) {
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

            let lbl = "_img" + bin.lblNo++
            if (lit.length % 4 != 0)
                lit += "42" // pad

            bin.otherLiterals.push(`
.balign 4
${lbl}: .short 0xffff
        .short ${w}, ${h}
        .byte ${lit}
`)
            let jsLit = "new pxsim.Image(" + w + ", [" + lit + "])"

            return <any>{
                kind: SK.NumericLiteral,
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

        function emitFunLiteral(f: FunctionDeclaration) {
            let attrs = parseComments(f);
            if (attrs.shim)
                userError(lf("built-in functions cannot be yet used as values; did you forget ()?"))
            let info = getFunctionInfo(f)
            if (info.location) {
                return info.location.load()
            } else {
                assert(!bin.finalPass || info.capturedVars.length == 0)
                return emitFunLitCore(f)
            }
        }

        function emitIdentifier(node: Identifier): ir.Expr {
            let decl = getDecl(node)
            if (decl && (decl.kind == SK.VariableDeclaration || decl.kind == SK.Parameter)) {
                return emitLocalLoad(<VarOrParam>decl)
            } else if (decl && decl.kind == SK.FunctionDeclaration) {
                return emitFunLiteral(decl as FunctionDeclaration)
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
            if (node.kind == SK.NumericLiteral) {
                if ((<any>node).imageLiteral) {
                    return ir.ptrlit((<any>node).imageLiteral, (<any>node).jsLit)
                } else {
                    return ir.numlit(parseInt(node.text))
                }
            } else if (isStringLiteral(node)) {
                if (node.text == "") {
                    return ir.rtcall("String_::mkEmpty", [])
                } else {
                    let lbl = bin.emitString(node.text)
                    let ptr = ir.ptrlit(lbl + "meta", JSON.stringify(node.text))
                    return ir.rtcall("pxt::ptrOfLiteral", [ptr])
                }
            } else {
                throw oops();
            }
        }

        function emitTemplateExpression(node: TemplateExpression) {
            let concat = (a: ir.Expr, b: Expression | TemplateLiteralFragment) =>
                isEmptyStringLiteral(b) ? a :
                    ir.rtcallMask("String_::concat", 3, ir.CallingConvention.Plain, [
                        a,
                        emitAsString(b)
                    ])
            // TODO could optimize for the case where node.head is empty
            let expr = emitAsString(node.head)
            for (let span of node.templateSpans) {
                expr = concat(expr, span.expression)
                expr = concat(expr, span.literal)
            }
            return expr
        }

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
            let coll = ir.shared(ir.rtcall("Array_::mk", [ir.numlit(flag)]))
            for (let elt of node.elements) {
                let e = ir.shared(emitExpr(elt))
                proc.emitExpr(ir.rtcall("Array_::push", [coll, e]))
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
            let callInfo: CallInfo = {
                decl,
                qName: getFullName(checker, decl.symbol),
                attrs,
                args: []
            };
            (node as any).callInfo = callInfo;
            if (decl.kind == SK.EnumMember) {
                let ev = attrs.enumval
                if (!ev) {
                    let val = checker.getConstantValue(decl as EnumMember)
                    if (val == null) {
                        if ((decl as EnumMember).initializer)
                            return emitExpr((decl as EnumMember).initializer)
                        userError(lf("Cannot compute enum value"))
                    }
                    ev = val + ""
                }
                if (/^\d+$/.test(ev))
                    return ir.numlit(parseInt(ev));
                return ir.rtcall(ev, [])
            } else if (decl.kind == SK.PropertySignature) {
                if (attrs.shim) {
                    callInfo.args.push(node.expression)
                    return emitShim(decl, node, [node.expression])
                } else {
                    throw unhandled(node, "no {shim:...}");
                }
            } else if (decl.kind == SK.PropertyDeclaration) {
                let idx = fieldIndex(node)
                callInfo.args.push(node.expression)
                return ir.op(EK.FieldAccess, [emitExpr(node.expression)], idx)
            } else if (decl.kind == SK.MethodDeclaration || decl.kind == SK.MethodSignature) {
                throw userError(lf("cannot use method as lambda; did you forget '()' ?"))
            } else if (decl.kind == SK.FunctionDeclaration) {
                return emitFunLiteral(decl as FunctionDeclaration)
            } else {
                throw unhandled(node, stringKind(decl));
            }
        }

        function emitIndexedAccess(node: ElementAccessExpression, assign: ir.Expr = null): ir.Expr {
            let t = typeOf(node.expression)

            let indexer = ""
            if (!assign && t.flags & TypeFlags.String)
                indexer = "String_::charAt"
            else if (isArrayType(t))
                indexer = assign ? "Array_::setAt" : "Array_::getAt"
            else if (isInterfaceType(t)) {
                let attrs = parseCommentsOnSymbol(t.symbol)
                indexer = assign ? attrs.indexerSet : attrs.indexerGet
            }

            if (indexer) {
                if (typeOf(node.argumentExpression).flags & TypeFlags.Number) {
                    let arr = emitExpr(node.expression)
                    let idx = emitExpr(node.argumentExpression)
                    let args = [node.expression, node.argumentExpression]
                    return rtcallMask(indexer, args, ir.CallingConvention.Plain, assign ? [assign] : [])
                } else {
                    throw unhandled(node, lf("non-numeric indexer on {0}", indexer))
                }
            } else {
                throw unhandled(node, "unsupported indexer")
            }
        }

        function isOnDemandDecl(decl: Declaration) {
            let res = (isGlobalVar(decl) && !isSideEffectfulInitializer((<VariableDeclaration>decl).initializer)) ||
                isTopLevelFunctionDecl(decl)
            if (opts.testMode && res) {
                if (!U.startsWith(getSourceFileOfNode(decl).fileName, "pxt_modules"))
                    return false
            }
            return res
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
            if (e.kind == SK.NullKeyword || e.kind == SK.NumericLiteral)
                return false
            // no point doing the incr/decr for these - they are statically allocated anyways
            if (isStringLiteral(e))
                return false
            return isRefType(typeOf(e))
        }
        function getMask(args: Expression[]) {
            assert(args.length <= 8)
            let m = 0
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

            if (opts.target.isNative) {
                hex.validateShim(getDeclName(decl), attrs, hasRet, args.length);
            }

            return rtcallMask(attrs.shim, args, attrs.callingConvention)
        }

        function isNumericLiteral(node: Expression) {
            switch (node.kind) {
                case SK.NullKeyword:
                case SK.TrueKeyword:
                case SK.FalseKeyword:
                case SK.NumericLiteral:
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
                        p.valueDeclaration.kind == SK.Parameter) {
                        let prm = <ParameterDeclaration>p.valueDeclaration
                        if (!prm.initializer) {
                            let defl = attrs.paramDefl[getName(prm)]
                            args.push(<any>{
                                kind: SK.NullKeyword,
                                valueOverride: defl ? parseInt(defl) : undefined
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
            let callInfo: CallInfo = {
                decl,
                qName: getFullName(checker, decl.symbol),
                attrs,
                args: args.slice(0)
            };
            (node as any).callInfo = callInfo

            if (!decl)
                unhandled(node, "no declaration")

            function emitPlain() {
                return emitPlainCall(decl, args, hasRet)
            }

            addDefaultParameters(checker.getResolvedSignature(node), args, attrs);

            if (decl.kind == SK.FunctionDeclaration) {
                let info = getFunctionInfo(<FunctionDeclaration>decl)

                if (!info.location) {
                    if (attrs.shim) {
                        return emitShim(decl, node, args);
                    }

                    return emitPlain();
                }
            }

            if (decl.kind == SK.MethodSignature ||
                decl.kind == SK.MethodDeclaration) {
                if (node.expression.kind == SK.PropertyAccessExpression) {
                    let recv = (<PropertyAccessExpression>node.expression).expression
                    args.unshift(recv)
                    callInfo.args.unshift(recv)
                } else
                    unhandled(node, "strange method call")
                if (attrs.shim) {
                    return emitShim(decl, node, args);
                } else if (attrs.helper) {
                    let syms = checker.getSymbolsInScope(node, SymbolFlags.Module)
                    let helpersModule = <ModuleDeclaration>syms.filter(s => s.name == "helpers")[0].valueDeclaration;
                    let helperStmt = (<ModuleBlock>helpersModule.body).statements.filter(s => s.symbol.name == attrs.helper)[0]
                    if (!helperStmt)
                        userError(lf("helpers.{0} not found", attrs.helper))
                    if (helperStmt.kind != SK.FunctionDeclaration)
                        userError(lf("helpers.{0} isn't a function", attrs.helper))
                    decl = <FunctionDeclaration>helperStmt;
                    markUsed(decl)
                    return emitPlain();
                } else {
                    markUsed(decl)
                    return emitPlain();
                }
            }

            if (decl.kind == SK.VariableDeclaration ||
                decl.kind == SK.FunctionDeclaration || // this is lambda
                decl.kind == SK.Parameter) {
                if (args.length > 1)
                    userError("lambda functions with more than 1 argument not supported")

                if (hasRet)
                    userError("lambda functions cannot yet return values")

                let suff = args.length + ""

                args.unshift(node.expression)
                callInfo.args.unshift(node.expression)

                return rtcallMask("pxt::runAction" + suff, args, ir.CallingConvention.Async)
            }

            if (decl.kind == SK.ModuleDeclaration) {
                if (getName(decl) == "String")
                    userError(lf("to convert X to string use: X + \"\""))
                else
                    userError(lf("namespaces cannot be called directly"))
            }

            throw unhandled(node, stringKind(decl))
        }

        function emitNewExpression(node: NewExpression) {
            let t = typeOf(node)
            if (isArrayType(t)) {
                throw oops();
            } else if (isClassType(t)) {
                let classDecl = <ClassDeclaration>getDecl(node.expression)
                if (classDecl.kind != SK.ClassDeclaration) {
                    userError("new expression only supported on class types")
                }
                let ctor = classDecl.members.filter(n => n.kind == SK.Constructor)[0]
                let info = getClassInfo(t)

                let obj = ir.shared(ir.rtcall("pxt::mkRecord", [ir.numlit(info.reffields.length), ir.numlit(info.allfields.length)]))

                if (ctor) {
                    markUsed(ctor)
                    let args = node.arguments.slice(0)
                    let ctorAttrs = parseComments(ctor)
                    addDefaultParameters(checker.getResolvedSignature(node), args, ctorAttrs)
                    let compiled = args.map(emitExpr)
                    if (ctorAttrs.shim)
                        // we drop 'obj' variable
                        return ir.rtcall(ctorAttrs.shim, compiled)
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
        function emitAsExpression(node: AsExpression) {
            return emitExpr(node.expression)
        }
        function emitParenExpression(node: ParenthesizedExpression) {
            return emitExpr(node.expression)
        }

        function getParameters(node: FunctionLikeDeclaration) {
            let res = node.parameters.slice(0)
            if (node.kind == SK.MethodDeclaration || node.kind == SK.Constructor) {
                let info = getFunctionInfo(node)
                if (!info.thisParameter) {
                    info.thisParameter = <any>{
                        kind: SK.Parameter,
                        name: { text: "this" },
                        isThisParameter: true,
                        parent: node
                    }
                }
                res.unshift(info.thisParameter)
            }
            return res
        }

        function emitFunLitCore(node: FunctionLikeDeclaration, raw = false) {
            let lbl = getFunctionLabel(node)
            let r = ir.ptrlit(lbl + "_Lit", lbl)
            if (!raw) {
                r = ir.rtcall("pxt::ptrOfLiteral", [r])
            }
            return r
        }

        function emitFunctionDeclaration(node: FunctionLikeDeclaration) {
            if (!isUsed(node))
                return;

            let attrs = parseComments(node)
            if (attrs.shim != null) {
                if (opts.target.isNative) {
                    hex.validateShim(getDeclName(node),
                        attrs,
                        funcHasReturn(node),
                        getParameters(node).length);
                }
                return
            }

            if (node.flags & NodeFlags.Ambient)
                return;

            if (!node.body)
                return;

            let info = getFunctionInfo(node)

            let isExpression = node.kind == SK.ArrowFunction || node.kind == SK.FunctionExpression

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
                lit = ir.shared(ir.rtcall("pxt::mkAction", [ir.numlit(refs.length), ir.numlit(caps.length), emitFunLitCore(node, true)]))
                caps.forEach((l, i) => {
                    let loc = proc.localIndex(l)
                    if (!loc)
                        userError("cannot find captured value: " + checker.symbolToString(l.symbol))
                    let v = loc.loadCore()
                    if (loc.isRef() || loc.isByRefLocal())
                        v = ir.op(EK.Incr, [v])
                    proc.emitExpr(ir.rtcall("pxtrt::stclo", [lit, ir.numlit(i), v]))
                })
                if (node.kind == SK.FunctionDeclaration) {
                    info.location = proc.mkLocal(node, getVarInfo(node))
                    proc.emitExpr(info.location.storeDirect(lit))
                    lit = null
                }
            } else {
                if (isExpression) {
                    lit = emitFunLitCore(node)
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
                        let tmp = ir.shared(ir.rtcall("pxtrt::mkloc" + l.refSuff(), []))
                        proc.emitExpr(ir.rtcall("pxtrt::stloc" + l.refSuff(), [tmp, l.loadCore()]))
                        proc.emitExpr(l.storeDirect(tmp))
                    }
                })

                emit(node.body);

                proc.emitLblDirect(getLabels(node).ret)

                proc.stackEmpty();

                if (funcHasReturn(proc.action)) {
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
                if (node.operator == SK.ExclamationToken) {
                    return rtcallMask("Boolean_::bang", [node.operand])
                }
            }

            if (tp.flags & TypeFlags.Number) {
                switch (node.operator) {
                    case SK.PlusPlusToken:
                        return emitIncrement(node.operand, "thumb::adds", false)
                    case SK.MinusMinusToken:
                        return emitIncrement(node.operand, "thumb::subs", false)
                    case SK.MinusToken:
                        return ir.rtcall("thumb::subs", [ir.numlit(0), emitExpr(node.operand)])
                    case SK.PlusToken:
                        return emitExpr(node.operand) // no-op
                    default: unhandled(node, "postfix unary number")
                }
            }

            throw unhandled(node, "prefix unary");
        }

        function prepForAssignment(trg: Expression) {
            let left = emitExpr(trg)
            let storeCache: ir.Expr = null
            if (left.exprKind == EK.FieldAccess) {
                left.args[0] = ir.shared(left.args[0])
                storeCache = emitExpr(trg) // clone
                storeCache.args[0] = ir.op(EK.Incr, [left.args[0]])
                proc.emitExpr(left.args[0])
            }
            left = ir.shared(left)
            return { left, storeCache }
        }

        function emitIncrement(trg: Expression, meth: string, isPost: boolean, one: Expression = null) {
            let tmp = prepForAssignment(trg)
            let oneExpr = one ? emitExpr(one) : ir.numlit(1)
            let result = ir.shared(ir.rtcall(meth, [tmp.left, oneExpr]))
            emitStore(trg, result, tmp.storeCache)
            return isPost ? tmp.left : result
        }

        function emitPostfixUnaryExpression(node: PostfixUnaryExpression): ir.Expr {
            let tp = typeOf(node.operand)

            if (tp.flags & TypeFlags.Number) {
                switch (node.operator) {
                    case SK.PlusPlusToken:
                        return emitIncrement(node.operand, "thumb::adds", true)
                    case SK.MinusMinusToken:
                        return emitIncrement(node.operand, "thumb::subs", true)
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
                let attrs = parseComments(fld)
                return {
                    idx: info.allfields.indexOf(fld),
                    name: pacc.name.text,
                    isRef: isRefType(typeOf(pacc)),
                    shimName: attrs.shim
                }
            } else {
                throw unhandled(pacc, "bad field access")
            }
        }

        function refSuff(e: Expression) {
            if (isRefType(typeOf(e))) return "Ref"
            else return ""
        }

        function emitStore(trg: Expression, src: ir.Expr, cachedTrg: ir.Expr = null) {
            if (trg.kind == SK.Identifier) {
                let decl = getDecl(trg)
                if (decl && (decl.kind == SK.VariableDeclaration || decl.kind == SK.Parameter)) {
                    let l = lookupCell(decl)
                    recordUse(<VarOrParam>decl, true)
                    proc.emitExpr(l.storeByRef(src))
                } else {
                    unhandled(trg, "target identifier")
                }
            } else if (trg.kind == SK.PropertyAccessExpression) {
                proc.emitExpr(ir.op(EK.Store, [cachedTrg || emitExpr(trg), src]))
            } else if (trg.kind == SK.ElementAccessExpression) {
                proc.emitExpr(emitIndexedAccess(trg as ElementAccessExpression, src))
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

        function rtcallMask(name: string, args: Expression[], callingConv = ir.CallingConvention.Plain, append: ir.Expr[] = null) {
            let args2 = args.map(emitExpr)
            if (append) args2 = args2.concat(append)
            return ir.rtcallMask(name, getMask(args), callingConv, args2)
        }

        function emitInJmpValue(expr: ir.Expr) {
            let lbl = proc.mkLabel("ldjmp")
            proc.emitJmp(lbl, expr, ir.JmpMode.Always)
            proc.emitLbl(lbl)
        }

        function emitLazyBinaryExpression(node: BinaryExpression) {
            let lbl = proc.mkLabel("lazy")
            // TODO what if the value is of ref type?
            if (node.operatorToken.kind == SK.BarBarToken) {
                proc.emitJmp(lbl, emitExpr(node.left), ir.JmpMode.IfNotZero)
            } else if (node.operatorToken.kind == SK.AmpersandAmpersandToken) {
                proc.emitJmpZ(lbl, emitExpr(node.left))
            } else {
                oops()
            }

            proc.emitJmp(lbl, emitExpr(node.right), ir.JmpMode.Always)
            proc.emitLbl(lbl)

            return ir.op(EK.JmpValue, [])
        }

        function stripEquals(k: SyntaxKind) {
            switch (k) {
                case SK.PlusEqualsToken: return SK.PlusToken;
                case SK.MinusEqualsToken: return SK.MinusToken;
                case SK.AsteriskEqualsToken: return SK.AsteriskToken;
                case SK.AsteriskAsteriskEqualsToken: return SK.AsteriskAsteriskToken;
                case SK.SlashEqualsToken: return SK.SlashToken;
                case SK.PercentEqualsToken: return SK.PercentToken;
                case SK.LessThanLessThanEqualsToken: return SK.LessThanLessThanToken;
                case SK.GreaterThanGreaterThanEqualsToken: return SK.GreaterThanGreaterThanToken;
                case SK.GreaterThanGreaterThanGreaterThanEqualsToken: return SK.GreaterThanGreaterThanGreaterThanToken;
                case SK.AmpersandEqualsToken: return SK.AmpersandToken;
                case SK.BarEqualsToken: return SK.BarToken;
                case SK.CaretEqualsToken: return SK.CaretToken;
                default: return SK.Unknown;
            }
        }

        function emitBrk(node: Node) {
            if (!opts.breakpoints) return
            let brk = U.lookup(brkMap, nodeKey(node))
            if (!brk) {
                let src = getSourceFileOfNode(node)
                if (opts.justMyCode && U.startsWith(src.fileName, "pxt_modules"))
                    return;
                let pos = node.pos
                while (/^\s$/.exec(src.text[pos]))
                    pos++;
                let p = ts.getLineAndCharacterOfPosition(src, pos)
                brk = {
                    id: res.breakpoints.length,
                    isDebuggerStmt: node.kind == SK.DebuggerStatement,
                    fileName: src.fileName,
                    start: pos,
                    length: node.end - pos,
                    line: p.line,
                    character: p.character
                }
                brkMap[nodeKey(node)] = brk
                res.breakpoints.push(brk)
            }
            let st = ir.stmt(ir.SK.Breakpoint, null)
            st.breakpointInfo = brk
            proc.emit(st)
        }

        function simpleInstruction(k: SyntaxKind) {
            switch (k) {
                case SK.PlusToken: return "thumb::adds";
                case SK.MinusToken: return "thumb::subs";
                // we could expose __aeabi_idiv directly...
                case SK.SlashToken: return "Number_::div";
                case SK.PercentToken: return "Number_::mod";
                case SK.AsteriskToken: return "thumb::muls";
                case SK.AmpersandToken: return "thumb::ands";
                case SK.BarToken: return "thumb::orrs";
                case SK.CaretToken: return "thumb::eors";
                case SK.LessThanLessThanToken: return "thumb::lsls";
                case SK.GreaterThanGreaterThanToken: return "thumb::asrs"
                case SK.GreaterThanGreaterThanGreaterThanToken: return "thumb::lsrs"
                // these could be compiled to branches butthis is more code-size efficient
                case SK.LessThanEqualsToken: return "Number_::le";
                case SK.LessThanToken: return "Number_::lt";
                case SK.GreaterThanEqualsToken: return "Number_::ge";
                case SK.GreaterThanToken: return "Number_::gt";
                case SK.EqualsEqualsToken:
                case SK.EqualsEqualsEqualsToken:
                    return "Number_::eq";
                case SK.ExclamationEqualsEqualsToken:
                case SK.ExclamationEqualsToken:
                    return "Number_::neq";

                default: return null;
            }

        }

        function emitBinaryExpression(node: BinaryExpression): ir.Expr {
            if (node.operatorToken.kind == SK.EqualsToken) {
                return handleAssignment(node);
            }

            let lt = typeOf(node.left)
            let rt = typeOf(node.right)

            let shim = (n: string) => rtcallMask(n, [node.left, node.right]);

            if ((lt.flags & TypeFlags.Number) && (rt.flags & TypeFlags.Number)) {
                let noEq = stripEquals(node.operatorToken.kind)
                let shimName = simpleInstruction(noEq || node.operatorToken.kind)
                if (!shimName)
                    unhandled(node.operatorToken, "numeric operator")
                if (noEq)
                    return emitIncrement(node.left, shimName, false, node.right)
                return shim(shimName)
            }

            if (node.operatorToken.kind == SK.PlusToken) {
                if ((lt.flags & TypeFlags.String) || (rt.flags & TypeFlags.String)) {
                    return ir.rtcallMask("String_::concat", 3, ir.CallingConvention.Plain, [
                        emitAsString(node.left),
                        emitAsString(node.right)])
                }
            }

            if (node.operatorToken.kind == SK.PlusEqualsToken &&
                (lt.flags & TypeFlags.String)) {

                let tmp = prepForAssignment(node.left)
                let post = ir.shared(ir.rtcallMask("String_::concat", 3, ir.CallingConvention.Plain, [
                    tmp.left,
                    emitAsString(node.right)]))
                emitStore(node.left, post, tmp.storeCache)
                return ir.op(EK.Incr, [post])
            }


            if ((lt.flags & TypeFlags.String) && (rt.flags & TypeFlags.String)) {
                switch (node.operatorToken.kind) {
                    case SK.LessThanEqualsToken:
                    case SK.LessThanToken:
                    case SK.GreaterThanEqualsToken:
                    case SK.GreaterThanToken:
                    case SK.EqualsEqualsToken:
                    case SK.EqualsEqualsEqualsToken:
                    case SK.ExclamationEqualsEqualsToken:
                    case SK.ExclamationEqualsToken:
                        return ir.rtcall(
                            simpleInstruction(node.operatorToken.kind),
                            [shim("String_::compare"), ir.numlit(0)])
                    default:
                        unhandled(node.operatorToken, "numeric operator")
                }
            }

            switch (node.operatorToken.kind) {
                case SK.EqualsEqualsToken:
                case SK.EqualsEqualsEqualsToken:
                    return shim("Number_::eq");
                case SK.ExclamationEqualsEqualsToken:
                case SK.ExclamationEqualsToken:
                    return shim("Number_::neq");
                case SK.BarBarToken:
                case SK.AmpersandAmpersandToken:
                    return emitLazyBinaryExpression(node);
                default:
                    throw unhandled(node.operatorToken, "generic operator")
            }
        }

        function emitAsString(e: Expression | TemplateLiteralFragment): ir.Expr {
            let r = emitExpr(e)
            // TS returns 'any' as type of template elements
            if (isStringLiteral(e))
                return r;
            let tp = typeOf(e)
            if (tp.flags & TypeFlags.Number)
                return ir.rtcall("Number_::toString", [r])
            else if (tp.flags & TypeFlags.Boolean)
                return ir.rtcall("Boolean_::toString", [r])
            else if (tp.flags & TypeFlags.String)
                return r // OK
            else
                throw userError(lf("don't know how to convert to string"))
        }

        function emitConditionalExpression(node: ConditionalExpression) {
            let els = proc.mkLabel("condexprz")
            let fin = proc.mkLabel("condexprfin")
            // TODO what if the value is of ref type?
            proc.emitJmp(els, emitExpr(node.condition), ir.JmpMode.IfZero)
            proc.emitJmp(fin, emitExpr(node.whenTrue), ir.JmpMode.Always)
            proc.emitLbl(els)
            proc.emitJmp(fin, emitExpr(node.whenFalse), ir.JmpMode.Always)
            proc.emitLbl(fin)
            return ir.op(EK.JmpValue, [])
        }

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
            emitBrk(node)
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
            emitBrk(node)
            let l = getLabels(node)
            proc.emitLblDirect(l.cont);
            emit(node.statement)
            proc.emitJmpZ(l.brk, emitExpr(node.expression));
            proc.emitJmp(l.cont);
            proc.emitLblDirect(l.brk);
        }

        function emitWhileStatement(node: WhileStatement) {
            emitBrk(node)
            let l = getLabels(node)
            proc.emitLblDirect(l.cont);
            proc.emitJmpZ(l.brk, emitExpr(node.expression));
            emit(node.statement)
            proc.emitJmp(l.cont);
            proc.emitLblDirect(l.brk);
        }

        function emitExprAsStmt(node: Expression) {
            if (!node) return;
            switch (node.kind) {
                case SK.Identifier:
                case SK.StringLiteral:
                case SK.NumericLiteral:
                case SK.NullKeyword:
                    return; // no-op
            }
            emitBrk(node)
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
            if (node.initializer && node.initializer.kind == SK.VariableDeclarationList)
                (<VariableDeclarationList>node.initializer).declarations.forEach(emit);
            else
                emitExprAsStmt(<Expression>node.initializer);
            emitBrk(node)
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
            emitBrk(node)
            let label = node.label ? node.label.text : null
            let isBreak = node.kind == SK.BreakStatement
            function findOuter(parent: Node): Statement {
                if (!parent) return null;
                if (label && parent.kind == SK.LabeledStatement &&
                    (<LabeledStatement>parent).label.text == label)
                    return (<LabeledStatement>parent).statement;
                if (parent.kind == SK.SwitchStatement && !label && isBreak)
                    return parent as Statement
                if (!label && isIterationStatement(parent, false))
                    return parent as Statement
                return findOuter(parent.parent);
            }
            let stmt = findOuter(node)
            if (!stmt)
                error(node, lf("cannot find outer loop"))
            else {
                let l = getLabels(stmt)
                if (node.kind == SK.ContinueStatement) {
                    if (!isIterationStatement(stmt, false))
                        error(node, lf("continue on non-loop"));
                    else proc.emitJmp(l.cont)
                } else if (node.kind == SK.BreakStatement) {
                    proc.emitJmp(l.brk)
                } else {
                    oops();
                }
            }
        }

        function emitReturnStatement(node: ReturnStatement) {
            emitBrk(node)
            let v: ir.Expr = null
            if (node.expression) {
                v = emitExpr(node.expression)
            } else if (funcHasReturn(proc.action)) {
                v = ir.numlit(null) // == return undefined
            }
            proc.emitJmp(getLabels(proc.action).ret, v, ir.JmpMode.Always)
        }

        function emitWithStatement(node: WithStatement) { }

        function emitSwitchStatement(node: SwitchStatement) {
            emitBrk(node)
            if (!(typeOf(node.expression).flags & (TypeFlags.Number | TypeFlags.Enum))) {
                userError(lf("switch() only supported over numbers or enums"))
            }

            let l = getLabels(node)
            let hasDefault = false
            let expr = emitExpr(node.expression)
            emitInJmpValue(expr)
            let lbls = node.caseBlock.clauses.map(cl => {
                let lbl = proc.mkLabel("switch")
                if (cl.kind == SK.CaseClause) {
                    let cc = cl as CaseClause
                    proc.emitJmp(lbl, emitExpr(cc.expression), ir.JmpMode.IfJmpValEq)
                } else {
                    hasDefault = true
                    proc.emitJmp(lbl)
                }
                return lbl
            })
            if (!hasDefault)
                proc.emitJmp(l.brk);

            node.caseBlock.clauses.forEach((cl, i) => {
                proc.emitLbl(lbls[i])
                cl.statements.forEach(emit)
            })

            proc.emitLblDirect(l.brk);
        }

        function emitCaseOrDefaultClause(node: CaseOrDefaultClause) { }
        function emitLabeledStatement(node: LabeledStatement) {
            let l = getLabels(node.statement)
            emit(node.statement)
            proc.emitLblDirect(l.brk)
        }
        function emitThrowStatement(node: ThrowStatement) { }
        function emitTryStatement(node: TryStatement) { }
        function emitCatchClause(node: CatchClause) { }
        function emitDebuggerStatement(node: Node) {
            emitBrk(node)
        }
        function emitVariableDeclaration(node: VariableDeclaration) {
            if (!isUsed(node))
                return;
            typeCheckVar(node)
            let loc = isGlobalVar(node) ?
                lookupCell(node) : proc.mkLocal(node, getVarInfo(node))
            if (loc.isByRefLocal()) {
                proc.emitClrIfRef(loc) // we might be in a loop
                proc.emitExpr(loc.storeDirect(ir.rtcall("pxtrt::mkloc" + loc.refSuff(), [])))
            }
            // TODO make sure we don't emit code for top-level globals being initialized to zero
            if (node.initializer) {
                emitBrk(node)
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
        function emitEnumDeclaration(node: EnumDeclaration) {
        }
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

        function catchErrors<T>(node: Node, f: (node: Node) => T): T {
            let prevErr = lastSecondaryError
            inCatchErrors++
            try {
                lastSecondaryError = null
                let res = f(node)
                if (lastSecondaryError)
                    userError(lastSecondaryError)
                lastSecondaryError = prevErr
                inCatchErrors--
                return res
            } catch (e) {
                inCatchErrors--
                lastSecondaryError = null
                if (!e.ksEmitterUserError)
                    console.log(e.stack)
                error(node, e.message)
                return null
            }
        }

        function emitExpr(node: Node) {
            return catchErrors(node, emitExprInner) || ir.numlit(0)
        }

        function emitExprInner(node: Node): ir.Expr {
            let expr = emitExprCore(node);
            if (expr.isExpr()) return expr
            throw new Error("expecting expression")
        }

        function emit(node: Node): void {
            catchErrors(node, emitNodeCore)
        }

        function emitNodeCore(node: Node): void {
            switch (node.kind) {
                case SK.SourceFile:
                    return emitSourceFileNode(<SourceFile>node);
                case SK.InterfaceDeclaration:
                    return emitInterfaceDeclaration(<InterfaceDeclaration>node);
                case SK.VariableStatement:
                    return emitVariableStatement(<VariableStatement>node);
                case SK.ModuleDeclaration:
                    return emitModuleDeclaration(<ModuleDeclaration>node);
                case SK.EnumDeclaration:
                    return emitEnumDeclaration(<EnumDeclaration>node);
                //case SyntaxKind.MethodSignature:
                case SK.FunctionDeclaration:
                case SK.Constructor:
                case SK.MethodDeclaration:
                    emitFunctionDeclaration(<FunctionLikeDeclaration>node);
                    return
                case SK.ExpressionStatement:
                    return emitExpressionStatement(<ExpressionStatement>node);
                case SK.Block:
                case SK.ModuleBlock:
                    return emitBlock(<Block>node);
                case SK.VariableDeclaration:
                    return emitVariableDeclaration(<VariableDeclaration>node);
                case SK.IfStatement:
                    return emitIfStatement(<IfStatement>node);
                case SK.WhileStatement:
                    return emitWhileStatement(<WhileStatement>node);
                case SK.DoStatement:
                    return emitDoStatement(<DoStatement>node);
                case SK.ForStatement:
                    return emitForStatement(<ForStatement>node);
                case SK.ContinueStatement:
                case SK.BreakStatement:
                    return emitBreakOrContinueStatement(<BreakOrContinueStatement>node);
                case SK.LabeledStatement:
                    return emitLabeledStatement(<LabeledStatement>node);
                case SK.ReturnStatement:
                    return emitReturnStatement(<ReturnStatement>node);
                case SK.ClassDeclaration:
                    return emitClassDeclaration(<ClassDeclaration>node);
                case SK.PropertyDeclaration:
                case SK.PropertyAssignment:
                    return emitPropertyAssignment(<PropertyDeclaration>node);
                case SK.SwitchStatement:
                    return emitSwitchStatement(<SwitchStatement>node);
                case SK.TypeAliasDeclaration:
                    // skip
                    return
                case SK.DebuggerStatement:
                    return emitDebuggerStatement(node);
                default:
                    unhandled(node);
            }
        }

        function emitExprCore(node: Node): ir.Expr {
            switch (node.kind) {
                case SK.NullKeyword:
                    let v = (node as any).valueOverride;
                    return ir.numlit(v || null);
                case SK.TrueKeyword:
                    return ir.numlit(true);
                case SK.FalseKeyword:
                    return ir.numlit(false);
                case SK.TemplateHead:
                case SK.TemplateMiddle:
                case SK.TemplateTail:
                case SK.NumericLiteral:
                case SK.StringLiteral:
                case SK.NoSubstitutionTemplateLiteral:
                    //case SyntaxKind.RegularExpressionLiteral:                    
                    return emitLiteral(<LiteralExpression>node);
                case SK.PropertyAccessExpression:
                    return emitPropertyAccess(<PropertyAccessExpression>node);
                case SK.BinaryExpression:
                    return emitBinaryExpression(<BinaryExpression>node);
                case SK.PrefixUnaryExpression:
                    return emitPrefixUnaryExpression(<PrefixUnaryExpression>node);
                case SK.PostfixUnaryExpression:
                    return emitPostfixUnaryExpression(<PostfixUnaryExpression>node);
                case SK.ElementAccessExpression:
                    return emitIndexedAccess(<ElementAccessExpression>node);
                case SK.ParenthesizedExpression:
                    return emitParenExpression(<ParenthesizedExpression>node);
                case SK.TypeAssertionExpression:
                    return emitTypeAssertion(<TypeAssertion>node);
                case SK.ArrayLiteralExpression:
                    return emitArrayLiteral(<ArrayLiteralExpression>node);
                case SK.NewExpression:
                    return emitNewExpression(<NewExpression>node);
                case SK.ThisKeyword:
                    return emitThis(node);
                case SK.CallExpression:
                    return emitCallExpression(<CallExpression>node);
                case SK.FunctionExpression:
                case SK.ArrowFunction:
                    return emitFunctionDeclaration(<FunctionLikeDeclaration>node);
                case SK.Identifier:
                    return emitIdentifier(<Identifier>node);
                case SK.ConditionalExpression:
                    return emitConditionalExpression(<ConditionalExpression>node);
                case SK.AsExpression:
                    return emitAsExpression(<AsExpression>node);
                case SyntaxKind.TemplateExpression:
                    return emitTemplateExpression(<TemplateExpression>node);

                default:
                    unhandled(node);
                    return null

                /*    
                case SyntaxKind.TemplateSpan:
                    return emitTemplateSpan(<TemplateSpan>node);
                case SyntaxKind.Parameter:
                    return emitParameter(<ParameterDeclaration>node);
                case SyntaxKind.GetAccessor:
                case SyntaxKind.SetAccessor:
                    return emitAccessor(<AccessorDeclaration>node);
                case SyntaxKind.SuperKeyword:
                    return emitSuper(node);
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
                case SyntaxKind.DeleteExpression:
                    return emitDeleteExpression(<DeleteExpression>node);
                case SyntaxKind.TypeOfExpression:
                    return emitTypeOfExpression(<TypeOfExpression>node);
                case SyntaxKind.VoidExpression:
                    return emitVoidExpression(<VoidExpression>node);
                case SyntaxKind.AwaitExpression:
                    return emitAwaitExpression(<AwaitExpression>node);
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
                case SyntaxKind.CaseClause:
                case SyntaxKind.DefaultClause:
                    return emitCaseOrDefaultClause(<CaseOrDefaultClause>node);
                case SyntaxKind.ThrowStatement:
                    return emitThrowStatement(<ThrowStatement>node);
                case SyntaxKind.TryStatement:
                    return emitTryStatement(<TryStatement>node);
                case SyntaxKind.CatchClause:
                    return emitCatchClause(<CatchClause>node);
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

    export interface YottaConfig {
        dependencies?: U.Map<string>;
        config?: any;
        configIsJustDefaults?: boolean;
    }

    export interface ExtensionInfo {
        functions: FuncInfo[];
        generatedFiles: U.Map<string>;
        extensionFiles: U.Map<string>;
        yotta: YottaConfig;
        sha: string;
        compileData: string;
        shimsDTS: string;
        enumsDTS: string;
        onlyPublic: boolean;
    }

    export function emptyExtInfo(): ExtensionInfo {
        return {
            functions: [],
            generatedFiles: {},
            extensionFiles: {},
            sha: "",
            compileData: "",
            shimsDTS: "",
            enumsDTS: "",
            onlyPublic: true,
            yotta: {
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
        res: CompileResult;

        strings: StringMap<string> = {};
        otherLiterals: string[] = [];
        lblNo = 0;

        isDataRecord(s: string) {
            if (!s) return false
            let m = /^:......(..)/.exec(s)
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
            let lbl = "_str" + this.lblNo++
            this.strings[s] = lbl;
            return lbl
        }
    }
}
