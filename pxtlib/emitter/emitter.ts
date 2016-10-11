/// <reference path="../../built/pxtarget.d.ts"/>
/// <reference path="../../built/pxtpackage.d.ts"/>

namespace ts.pxtc {
    export const assert = Util.assert;
    export const oops = Util.oops;
    export import U = pxtc.Util;

    export const BINARY_JS = "binary.js";
    export const BINARY_HEX = "binary.hex";
    export const BINARY_ASM = "binary.asm";

    let EK = ir.EK;
    export const SK = SyntaxKind;

    export const numReservedGlobals = 1;

    interface NodeWithId extends Node {
        pxtNodeId: number;
        pxtNodeWave: number;
    }

    export interface FieldWithAddInfo extends PropertyDeclaration {
        irGetter?: MethodDeclaration;
        irSetter?: MethodDeclaration;
    }

    let lastNodeId = 0
    let currNodeWave = 1
    export function getNodeId(n: Node) {
        let nn = n as NodeWithId
        if (nn.pxtNodeWave !== currNodeWave) {
            nn.pxtNodeId = ++lastNodeId
            nn.pxtNodeWave = currNodeWave
        }
        return nn.pxtNodeId
    }

    export function stringKind(n: Node) {
        if (!n) return "<null>"
        return (<any>ts).SyntaxKind[n.kind]
    }

    interface NodeWithCache extends Expression {
        cachedIR: ir.Expr;
        needsIRCache: boolean;
    }

    function inspect(n: Node) {
        console.log(stringKind(n))
    }

    // next free error 9259
    function userError(code: number, msg: string, secondary = false): Error {
        let e = new Error(msg);
        (<any>e).ksEmitterUserError = true;
        (<any>e).ksErrorCode = code;
        if (secondary && inCatchErrors) {
            if (!lastSecondaryError) {
                lastSecondaryError = msg
                lastSecondaryErrorCode = code
            }
            return e
        }
        throw e;
    }

    function isRefType(t: Type) {
        checkType(t);
        if (t.flags & TypeFlags.ThisType)
            return true
        if (t.flags & TypeFlags.Null)
            return false
        if (t.flags & TypeFlags.Undefined)
            return false
        if (t.flags & TypeFlags.TypeParameter) {
            let b = lookupTypeParameter(t)
            if (b) return b.isRef
            U.oops("unbound type parameter: " + checker.typeToString(t))
        }
        return !(t.flags & (TypeFlags.NumberLike | TypeFlags.Boolean))
    }

    function isRefDecl(def: Declaration) {
        if ((<any>def).isThisParameter)
            return true;
        //let tp = checker.getDeclaredTypeOfSymbol(def.symbol)
        let tp = typeOf(def)
        return isRefType(tp)
    }


    function getBitSize(decl: TypedDecl) {
        if (!decl || !decl.type) return BitSize.None
        if (!(typeOf(decl).flags & TypeFlags.Number)) return BitSize.None
        if (decl.type.kind != SK.TypeReference) return BitSize.None
        switch ((decl.type as TypeReferenceNode).typeName.getText()) {
            case "int8": return BitSize.Int8
            case "int16": return BitSize.Int16
            case "int32": return BitSize.Int32
            case "uint8": return BitSize.UInt8
            case "uint16": return BitSize.UInt16
            default: return BitSize.None
        }
    }

    export function sizeOfBitSize(b: BitSize) {
        switch (b) {
            case BitSize.None: return 4
            case BitSize.Int8: return 1
            case BitSize.Int16: return 2
            case BitSize.Int32: return 4
            case BitSize.UInt8: return 1
            case BitSize.UInt16: return 2
            default: throw oops()
        }
    }

    export function setCellProps(l: ir.Cell) {
        l._isRef = isRefDecl(l.def)
        l._isLocal = isLocalVar(l.def) || isParameter(l.def)
        l._isGlobal = isGlobalVar(l.def)
        if (!l.isRef() && typeOf(l.def).flags & TypeFlags.Void) {
            oops("void-typed variable, " + l.toString())
        }
        l.bitSize = getBitSize(l.def)
        if (l.isLocal() && l.bitSize != BitSize.None) {
            l.bitSize = BitSize.None
            userError(9256, lf("bit sizes are not supported for locals and parameters"))
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

    function isStatic(node: Declaration) {
        return node.modifiers && node.modifiers.some(m => m.kind == SK.StaticKeyword)
    }

    function classFunctionPref(node: Node) {
        if (!node) return null;
        switch (node.kind) {
            case SK.MethodDeclaration: return "";
            case SK.Constructor: return "new/";
            case SK.GetAccessor: return "get/";
            case SK.SetAccessor: return "set/";
            default:
                return null
        }
    }

    function classFunctionKey(node: Node) {
        return classFunctionPref(node) + getName(node)
    }

    function isClassFunction(node: Node) {
        return classFunctionPref(node) != null
    }

    function getEnclosingMethod(node: Node): MethodDeclaration {
        if (!node) return null;
        if (isClassFunction(node))
            return <MethodDeclaration>node;
        return getEnclosingMethod(node.parent)
    }

    function isInAnyWayGeneric(node: FunctionLikeDeclaration) {
        return isGenericFunction(node) || hasGenericParent(node)
    }

    function hasGenericParent(node: Node): boolean {
        let par = getEnclosingFunction(node)
        if (par)
            return isGenericFunction(par) || hasGenericParent(par)
        return false
    }

    function getEnclosingFunction(node0: Node) {
        let node = node0
        while (true) {
            node = node.parent
            if (!node)
                userError(9229, lf("cannot determine parent of {0}", stringKind(node0)))
            switch (node.kind) {
                case SK.MethodDeclaration:
                case SK.Constructor:
                case SK.GetAccessor:
                case SK.SetAccessor:
                case SK.FunctionDeclaration:
                case SK.ArrowFunction:
                case SK.FunctionExpression:
                    return <FunctionLikeDeclaration>node
                case SK.SourceFile:
                    return null
            }
        }
    }

    function isGlobalVar(d: Declaration) {
        if (!d) return false
        return (d.kind == SK.VariableDeclaration && !getEnclosingFunction(d)) ||
            (d.kind == SK.PropertyDeclaration && isStatic(d))
    }

    function isLocalVar(d: Declaration) {
        return d.kind == SK.VariableDeclaration && !isGlobalVar(d);
    }

    function isParameter(d: Declaration) {
        return d.kind == SK.Parameter
    }

    function isTopLevelFunctionDecl(decl: Declaration) {
        return (decl.kind == SK.FunctionDeclaration && !getEnclosingFunction(decl)) ||
            isClassFunction(decl)
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

    export const enum BitSize {
        None,
        Int8,
        UInt8,
        Int16,
        UInt16,
        Int32,
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
        blockIdentity?: string;
        color?: string;
        icon?: string;
        imageLiteral?: number;
        weight?: number;
        parts?: string;
        trackArgs?: number[];
        advanced?: boolean;

        // on interfaces
        indexerGet?: string;
        indexerSet?: string;

        _name?: string;
        jsDoc?: string;
        paramHelp?: pxt.Map<string>;
        // foo.defl=12 -> paramDefl: { foo: "12" }
        paramDefl: pxt.Map<string>;
    }

    const numberAttributes = ["weight", "imageLiteral"]

    export interface CallInfo {
        decl: Declaration;
        qName: string;
        attrs: CommentAttrs;
        args: Expression[];
        isExpression: boolean;
    }

    export interface ClassInfo {
        id: string;
        baseClassInfo: ClassInfo;
        decl: ClassDeclaration;
        numRefFields: number;
        allfields: FieldWithAddInfo[];
        methods: FunctionLikeDeclaration[];
        refmask: boolean[];
        attrs: CommentAttrs;
        isUsed?: boolean;
        vtable?: ir.Procedure[];
        itable?: ir.Procedure[];
        itableInfo?: string[];
        bindings: TypeBinding[];
        ctor?: ir.Procedure;
    }

    let lf = assembler.lf;
    let checker: TypeChecker;
    let lastSecondaryError: string
    let lastSecondaryErrorCode = 0
    let inCatchErrors = 0

    export interface TypeBinding {
        tp: Type;
        isRef: boolean;
    }
    let typeBindings: TypeBinding[] = []

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

        for (let n of numberAttributes) {
            if (typeof (res as any)[n] == "string")
                (res as any)[n] = parseInt((res as any)[n])
        }

        if (res.trackArgs) {
            res.trackArgs = ((res.trackArgs as any) as string).split(/[ ,]+/).map(s => parseInt(s) || 0)
        }

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
        if (!node || (node as any).isBogusFunction) return parseCommentString("")
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

    function genericRoot(t: Type) {
        if (t.flags & TypeFlags.Reference) {
            let r = t as TypeReference
            if (r.typeArguments && r.typeArguments.length)
                return r.target
        }
        return null
    }

    function isClassType(t: Type) {
        // check if we like the class?
        return !!(t.flags & TypeFlags.Class) || !!(t.flags & TypeFlags.ThisType)
    }

    function isPossiblyGenericClassType(t: Type) {
        let g = genericRoot(t)
        if (g) return isClassType(g)
        return isClassType(t)
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

    function lookupTypeParameter(t: Type) {
        if (!(t.flags & TypeFlags.TypeParameter)) return null
        for (let i = typeBindings.length - 1; i >= 0; --i)
            if (typeBindings[i].tp == t) return typeBindings[i]
        return null
    }

    function checkType(t: Type) {
        let ok = TypeFlags.String | TypeFlags.Number | TypeFlags.Boolean |
            TypeFlags.Void | TypeFlags.Enum | TypeFlags.Null | TypeFlags.Undefined
        if ((t.flags & ok) == 0) {
            if (isArrayType(t)) return t;
            if (isClassType(t)) return t;
            if (isInterfaceType(t)) return t;
            if (deconstructFunctionType(t)) return t;
            if (lookupTypeParameter(t)) return t;

            let g = genericRoot(t)
            if (g) {
                checkType(g);
                (t as TypeReference).typeArguments.forEach(checkType)
                return t
            }

            userError(9201, lf("unsupported type: {0} 0x{1}", checker.typeToString(t), t.flags.toString(16)), true)
        }
        return t
    }

    function typeOf(node: Node) {
        let r: Type;
        if ((node as any).typeOverride)
            return (node as any).typeOverride as Type
        if (isExpression(node))
            r = checker.getContextualType(<Expression>node)
        if (!r) {
            try {
                r = checker.getTypeAtLocation(node);
            }
            catch (e) {
                userError(9203, lf("Unknown type for expression"))
            }
        }
        return checkType(r)
    }

    function isGenericFunction(fun: FunctionLikeDeclaration) {
        return getTypeParameters(fun).length > 0
    }

    function getTypeParameters(fun: FunctionLikeDeclaration) {
        // TODO add check for methods of generic classes
        if (fun.typeParameters && fun.typeParameters.length)
            return fun.typeParameters
        if (isClassFunction(fun) || fun.kind == SK.MethodSignature) {
            if (fun.parent.kind == SK.ClassDeclaration || fun.parent.kind == SK.InterfaceDeclaration) {
                let tp: TypeParameterDeclaration[] = (fun.parent as ClassLikeDeclaration).typeParameters
                return tp || []
            }
        }
        return []
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
        if (node && node.parent && node.parent.kind == SK.ClassDeclaration)
            text = (<ClassDeclaration>node.parent).name.text + "." + text
        text = text || "inline"
        return text;
    }

    function getTypeBindings(t: Type) {
        let g = genericRoot(t)
        if (!g) return []
        return getTypeBindingsCore(g.typeParameters, (t as TypeReference).typeArguments)
    }

    function getTypeBindingsCore(typeParameters: TypeParameter[], args: Type[]): TypeBinding[] {
        U.assert(typeParameters.length == args.length)
        return typeParameters.map((tp, i) => ({ tp: tp, isRef: isRefType(args[i]) }))
    }

    function getEnclosingTypeBindings(func: Declaration) {
        let bindings: TypeBinding[] = []
        addEnclosingTypeBindings(bindings, func)
        return bindings
    }

    function addEnclosingTypeBindings(bindings: TypeBinding[], func: Declaration) {
        if (!func) return
        for (let outer = getEnclosingFunction(func); outer; outer = getEnclosingFunction(outer)) {
            for (let tp of getTypeParameters(outer)) {
                let res = checker.getTypeAtLocation(tp)
                let binding = typeBindings.filter(b => b.tp == res)[0]
                if (!binding) {
                    U.oops("cannot find binding for: " + checker.typeToString(res))
                }
                bindings.push(binding)
            }
        }
    }

    function refMask(types: TypeBinding[]) {
        if (!types || !types.length) return ""
        return "_" + types.map(t => t.isRef ? "R" : "P").join("")
    }

    export function getFunctionLabel(node: FunctionLikeDeclaration, bindings: TypeBinding[]) {
        let text = getDeclName(node)
        return "_" + text.replace(/[^\w]+/g, "_") + "_" + getNodeId(node) + refMask(bindings)
    }

    export interface FieldAccessInfo {
        idx: number;
        name: string;
        isRef: boolean;
        shimName: string;
    }

    export type VarOrParam = VariableDeclaration | ParameterDeclaration | PropertyDeclaration;
    export type TypedDecl = Declaration & { type?: TypeNode }

    export interface VariableAddInfo {
        captured?: boolean;
        written?: boolean;
    }

    export interface FunctionAddInfo {
        capturedVars: VarOrParam[];
        decl: FunctionLikeDeclaration;
        location?: ir.Cell;
        thisParameter?: ParameterDeclaration; // a bit bogus
        usages?: TypeBinding[][];
        prePassUsagesEmitted?: number;
        virtualRoot?: FunctionAddInfo;
        virtualInstances?: FunctionAddInfo[];
        virtualIndex?: number;
        isUsed?: boolean;
        parentClassInfo?: ClassInfo;
    }

    function mkBogusMethod(info: ClassInfo, name: string) {
        let rootFunction = <any>{
            kind: SK.MethodDeclaration,
            parameters: [],
            name: {
                kind: SK.Identifier,
                text: name,
                pos: 0,
                end: 0
            },
            body: {
                kind: SK.Block,
                statements: []
            },
            parent: info.decl,
            pos: 0,
            end: 0,
            isBogusFunction: true,
        }
        return rootFunction as MethodDeclaration
    }

    export function compileBinary(program: Program, host: CompilerHost, opts: CompileOptions, res: CompileResult): EmitResult {
        const diagnostics = createDiagnosticCollection();
        checker = program.getTypeChecker();
        let classInfos: pxt.Map<ClassInfo> = {}
        let usedDecls: pxt.Map<Node> = {}
        let usedWorkList: Declaration[] = []
        let variableStatus: pxt.Map<VariableAddInfo> = {};
        let functionInfo: pxt.Map<FunctionAddInfo> = {};
        let irCachesToClear: NodeWithCache[] = []
        let ifaceMembers: pxt.Map<number> = {}
        let nextIfaceMemberId = 0;

        lastNodeId = 0
        currNodeWave++

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

            opts.breakpoints = true
        }

        let bin = new Binary()
        let proc: ir.Procedure;
        bin.res = res;
        bin.options = opts;
        bin.target = opts.target;

        function reset() {
            bin.reset()
            proc = null
            res.breakpoints = [{
                id: 0,
                isDebuggerStmt: false,
                fileName: "bogus",
                start: 0,
                length: 0,
                line: 0,
                character: 0,
                successors: null
            }]
        }

        if (opts.computeUsedSymbols) {
            res.usedSymbols = {}
            res.usedArguments = {}
        }

        let allStmts = opts.forceEmit && res.diagnostics.length > 0
            ? [] // TODO: panic
            : Util.concat(program.getSourceFiles().map(f => f.statements))

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
            isRootFunction: true,
            isBogusFunction: true
        }

        markUsed(rootFunction);
        usedWorkList = [];

        reset();
        emit(rootFunction)
        layOutGlobals()
        emitVTables()

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

        function error(node: Node, code: number, msg: string, arg0?: any, arg1?: any, arg2?: any) {
            diagnostics.add(createDiagnosticForNode(node, <any>{
                code: code,
                message: msg,
                key: msg.replace(/^[a-zA-Z]+/g, "_"),
                category: DiagnosticCategory.Error,
            }, arg0, arg1, arg2));
        }

        function unhandled(n: Node, info?: string, code: number = 9202) {
            // If we have info then we may as well present that instead
            if (info) {
                return userError(code, info)
            }

            if (!n) {
                userError(code, lf("Sorry, this language feature isn't supported"))
            }

            let syntax = stringKind(n)
            let maybeSupportInFuture = false
            let alternative: string = null
            switch (n.kind) {
                case ts.SyntaxKind.ForInStatement:
                    syntax = lf("for in loops")
                    break
                case ts.SyntaxKind.ForOfStatement:
                    syntax = lf("for of loops")
                    maybeSupportInFuture = true
                    break
                case ts.SyntaxKind.PropertyAccessExpression:
                    syntax = lf("property access")
                    break
                case ts.SyntaxKind.DeleteExpression:
                    syntax = lf("delete")
                    break
                case ts.SyntaxKind.GetAccessor:
                    syntax = lf("get accessor method")
                    maybeSupportInFuture = true
                    break
                case ts.SyntaxKind.SetAccessor:
                    syntax = lf("set accessor method")
                    maybeSupportInFuture = true
                    break
                case ts.SyntaxKind.TaggedTemplateExpression:
                    syntax = lf("tagged templates")
                    break
                case ts.SyntaxKind.TypeOfExpression:
                    syntax = lf("typeof")
                    break
                case ts.SyntaxKind.SpreadElementExpression:
                    syntax = lf("spread")
                    break
                case ts.SyntaxKind.TryStatement:
                case ts.SyntaxKind.CatchClause:
                case ts.SyntaxKind.FinallyKeyword:
                case ts.SyntaxKind.ThrowStatement:
                    syntax = lf("throwing and catching exceptions")
                    break
                case ts.SyntaxKind.ClassExpression:
                    syntax = lf("class expressions")
                    alternative = lf("declare a class as class C {} not let C = class {}")
                    break
                default:
                    break
            }

            let msg = ""
            if (maybeSupportInFuture) {
                msg = lf("{0} not currently supported", syntax)
            }
            else {
                msg = lf("{0} not supported", syntax)
            }

            if (alternative) {
                msg += " - " + alternative
            }

            return userError(code, msg)
        }

        function nodeKey(f: Node) {
            return getNodeId(f) + ""
        }

        function getFunctionInfo(f: FunctionLikeDeclaration) {
            let key = nodeKey(f)
            let info = functionInfo[key]
            if (!info)
                functionInfo[key] = info = {
                    decl: f,
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
            let varParent = getEnclosingFunction(v)
            if (varParent == null || varParent == proc.action) {
                // not captured
            } else {
                let curr = proc.action
                while (curr && curr != varParent) {
                    let info2 = getFunctionInfo(curr)
                    if (info2.capturedVars.indexOf(v) < 0)
                        info2.capturedVars.push(v);
                    curr = getEnclosingFunction(curr)
                }
                info.captured = true;
            }
        }

        function scope(f: () => void) {
            let prevProc = proc;
            let prevBindings = typeBindings.slice()
            try {
                f();
            } finally {
                proc = prevProc;
                typeBindings = prevBindings
            }
        }

        function getIfaceMemberId(name: string) {
            let v = U.lookup(ifaceMembers, name)
            if (v != null) return v
            for (let inf of bin.usedClassInfos) {
                for (let m of inf.methods) {
                    if (getName(m) == name)
                        markFunctionUsed(m, inf.bindings)
                }
            }
            v = ifaceMembers[name] = nextIfaceMemberId++
            return v
        }

        function finalEmit() {
            if (diagnostics.getModificationCount() || opts.noEmit || !host)
                return;

            bin.writeFile = (fn: string, data: string) =>
                host.writeFile(fn, data, false, null);

            if (opts.target.isNative) {
                thumbEmit(bin, opts, res)
            } else {
                jsEmit(bin)
            }
        }

        function typeCheckVar(decl: Declaration) {
            if (!decl) {
                userError(9203, lf("variable has unknown type"))
            }
            if (typeOf(decl).flags & TypeFlags.Void) {
                userError(9203, lf("void-typed variables not supported"))
            }
        }

        function lookupCell(decl: Declaration): ir.Cell {
            if (isGlobalVar(decl)) {
                markUsed(decl)
                typeCheckVar(decl)
                let ex = bin.globals.filter(l => l.def == decl)[0]
                if (!ex) {
                    ex = new ir.Cell(null, decl, getVarInfo(decl))
                    bin.globals.push(ex)
                }
                return ex
            } else {
                let res = proc.localIndex(decl)
                if (!res) {
                    if (bin.finalPass)
                        userError(9204, lf("cannot locate identifer"))
                    else
                        res = proc.mkLocal(decl, getVarInfo(decl))
                }
                return res
            }
        }

        function getBaseClassInfo(node: ClassDeclaration) {
            if (node.heritageClauses)
                for (let h of node.heritageClauses) {
                    switch (h.token) {
                        case SK.ExtendsKeyword:
                            if (!h.types || h.types.length != 1)
                                throw userError(9228, lf("invalid extends clause"))
                            let tp = typeOf(h.types[0])
                            if (isClassType(tp)) {
                                return getClassInfo(tp)
                            } else {
                                throw userError(9228, lf("cannot inherit from this type"))
                            }
                        // ignore it - implementation of interfaces is implicit
                        case SK.ImplementsKeyword:
                            break
                        default:
                            throw userError(9228, lf("invalid heritage clause"))
                    }
                }
            return null
        }

        function getVTable(inf: ClassInfo) {
            assert(inf.isUsed)
            if (inf.vtable)
                return inf.vtable
            let tbl = inf.baseClassInfo ? getVTable(inf.baseClassInfo).slice(0) : []

            scope(() => {
                U.pushRange(typeBindings, inf.bindings)

                for (let m of inf.methods) {
                    let minf = getFunctionInfo(m)
                    if (minf.virtualRoot) {
                        let key = classFunctionKey(m)
                        let done = false
                        let proc = lookupProc(m, inf.bindings)
                        for (let i = 0; i < tbl.length; ++i) {
                            if (classFunctionKey(tbl[i].action) == key) {
                                tbl[i] = proc
                                minf.virtualIndex = i
                                done = true
                            }
                        }
                        if (!done) {
                            minf.virtualIndex = tbl.length
                            tbl.push(proc)
                        }
                    }
                }
                inf.vtable = tbl
                inf.itable = []
                inf.itableInfo = []

                let storeIface = (name: string, proc: ir.Procedure) => {
                    let id = getIfaceMemberId(name)
                    inf.itable[id] = proc
                    inf.itableInfo[id] = name
                    assert(!!proc)
                }

                let emitSynthetic = (fn: MethodDeclaration, fill: (p: ir.Procedure) => void) => {
                    let proc = lookupProc(fn, inf.bindings)
                    if (!proc) {
                        scope(() => {
                            emitFuncCore(fn, inf.bindings)
                            proc = lookupProc(fn, inf.bindings)
                            proc.body = []
                            fill(proc)
                        })
                    }
                    assert(!!proc)
                    storeIface(getName(fn), proc)
                }

                for (let fld0 of inf.allfields) {
                    let fld = fld0 as FieldWithAddInfo
                    let fname = getName(fld)
                    let setname = "set/" + fname

                    if (isIfaceMemberUsed(fname)) {
                        if (!fld.irGetter)
                            fld.irGetter = mkBogusMethod(inf, fname)
                        let idx = fieldIndexCore(inf, fld, typeOf(fld))
                        emitSynthetic(fld.irGetter, (proc) => {
                            // we skip final decr, but the ldfld call will do its own decr
                            let access = ir.op(EK.FieldAccess, [proc.args[0].loadCore()], idx)
                            emitInJmpValue(access)
                        })
                    }

                    if (isIfaceMemberUsed(setname)) {
                        if (!fld.irSetter) {
                            fld.irSetter = mkBogusMethod(inf, setname)
                            fld.irSetter.parameters.unshift({
                                kind: SK.Parameter,
                                name: { text: "v" },
                                parent: fld.irSetter,
                                typeOverride: typeOf(fld)
                            } as any)
                        }
                        let idx = fieldIndexCore(inf, fld, typeOf(fld))
                        emitSynthetic(fld.irSetter, (proc) => {
                            // decrs work out
                            let access = ir.op(EK.FieldAccess, [proc.args[0].loadCore()], idx)
                            proc.emitExpr(ir.op(EK.Store, [access, proc.args[1].loadCore()]))
                        })
                    }
                }
                for (let curr = inf; curr; curr = curr.baseClassInfo) {
                    for (let m of curr.methods) {
                        let n = getName(m)
                        if (isIfaceMemberUsed(n)) {
                            let id = getIfaceMemberId(n)
                            if (!inf.itable[id]) {
                                storeIface(n, lookupProc(m, curr.bindings))
                            }
                        }
                    }
                }
                for (let i = 0; i < inf.itable.length; ++i)
                    if (!inf.itable[i])
                        inf.itable[i] = null // avoid undefined
                for (let k of Object.keys(ifaceMembers)) {
                    inf.itableInfo[ifaceMembers[k]] = k
                }
            })

            return inf.vtable
        }


        function getClassInfo(t: Type, decl: ClassDeclaration = null, bindings: TypeBinding[] = null) {
            if (!decl)
                decl = <ClassDeclaration>t.symbol.valueDeclaration
            if (!bindings)
                bindings = t
                    ? getTypeBindings(t)
                    : decl.typeParameters
                        ? decl.typeParameters.map(p => ({ isRef: true, tp: checker.getTypeAtLocation(p) }))
                        : []
            let id = "C" + getNodeId(decl) + refMask(bindings)
            let info: ClassInfo = classInfos[id]
            if (!info) {
                let reffields: PropertyDeclaration[] = []
                let primitivefields: PropertyDeclaration[] = []
                info = {
                    id: id,
                    numRefFields: 0,
                    allfields: [],
                    attrs: parseComments(decl),
                    decl: decl,
                    refmask: null,
                    baseClassInfo: null,
                    methods: [],
                    bindings: bindings
                }
                classInfos[id] = info;
                // only do it after storing our in case we run into cycles (which should be errors)
                info.baseClassInfo = getBaseClassInfo(decl)
                scope(() => {
                    U.pushRange(typeBindings, bindings)
                    for (let mem of decl.members) {
                        if (mem.kind == SK.PropertyDeclaration) {
                            let pdecl = <PropertyDeclaration>mem
                            if (isRefType(typeOf(pdecl)))
                                reffields.push(pdecl)
                            else primitivefields.push(pdecl)
                            info.allfields.push(pdecl)
                        } else if (isClassFunction(mem) && mem.kind != SK.Constructor) {
                            let minf = getFunctionInfo(mem as any)
                            minf.parentClassInfo = info
                            info.methods.push(mem as any)
                        }
                    }
                    if (info.baseClassInfo) {
                        info.allfields = info.baseClassInfo.allfields.concat(info.allfields)
                        info.numRefFields = -1
                        let nameMap: pxt.Map<FunctionLikeDeclaration> = {}
                        for (let curr = info.baseClassInfo; !!curr; curr = curr.baseClassInfo) {
                            for (let m of curr.methods) {
                                nameMap[classFunctionKey(m)] = m
                            }
                        }
                        for (let m of info.methods) {
                            let prev = U.lookup(nameMap, classFunctionKey(m))
                            if (prev) {
                                let minf = getFunctionInfo(m)
                                let pinf = getFunctionInfo(prev)
                                if (prev.parameters.length != m.parameters.length)
                                    error(m, 9255, lf("the overriding method is currently required to have the same number of arguments as the base one"))
                                minf.virtualRoot = pinf
                                if (!pinf.virtualRoot)
                                    pinf.virtualRoot = pinf
                                assert(pinf.virtualRoot == pinf)
                                if (!pinf.virtualInstances)
                                    pinf.virtualInstances = []
                                pinf.virtualInstances.push(minf)
                            }
                        }
                    } else {
                        info.allfields = reffields.concat(primitivefields)
                        info.numRefFields = reffields.length
                    }
                    info.refmask = info.allfields.map(f => isRefType(typeOf(f)))
                })

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
                                userError(9205, lf("lines in image literal have to have the same width (got {0} and then {1} pixels)", w, x))
                            x = 0;
                            h++;
                        }
                        break;
                    default:
                        userError(9206, lf("Only 0 . _ (off) and 1 # * (on) are allowed in image literals"))
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
                userError(9207, lf("built-in functions cannot be yet used as values; did you forget ()?"))
            if (isGenericFunction(f))
                userError(9232, lf("generic functions cannot be yet used as values; did you forget ()?"))
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
                if (node.text == "undefined")
                    return ir.numlit(null)
                else
                    throw unhandled(node, lf("Unknown or undeclared identifier"), 9235)
            }
        }

        function emitParameter(node: ParameterDeclaration) { }
        function emitAccessor(node: AccessorDeclaration) {
            emitFunctionDeclaration(node)
        }
        function emitThis(node: Node) {
            let meth = getEnclosingMethod(node)
            if (!meth)
                userError(9208, lf("'this' used outside of a method"))
            let inf = getFunctionInfo(meth)
            if (!inf.thisParameter) {
                //console.log("get this param,", meth.kind, nodeKey(meth))
                //console.log("GET", meth)
                oops("no this")
            }
            return emitLocalLoad(inf.thisParameter)
        }
        function emitSuper(node: Node) { }
        function emitStringLiteral(str: string) {
            if (str == "") {
                return ir.rtcall("String_::mkEmpty", [])
            } else {
                let lbl = bin.emitString(str)
                let ptr = ir.ptrlit(lbl + "meta", JSON.stringify(str))
                return ir.rtcall("pxt::ptrOfLiteral", [ptr])
            }
        }
        function emitLiteral(node: LiteralExpression) {
            if (node.kind == SK.NumericLiteral) {
                if ((<any>node).imageLiteral) {
                    return ir.ptrlit((<any>node).imageLiteral, (<any>node).jsLit)
                } else {
                    const parsed = parseFloat(node.text)
                    if (!opts.target.floatingPoint) {
                        if (Math.floor(parsed) !== parsed) {
                            userError(9257, lf("Decimal numbers are not supported"))
                        }
                        else if (parsed << 0 !== parsed) {
                            userError(9258, lf("Number is either too big or too small"))
                        }
                    }
                    return ir.numlit(parsed)
                }
            } else if (isStringLiteral(node)) {
                return emitStringLiteral(node.text)
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
        function emitObjectLiteral(node: ObjectLiteralExpression) {
            let expr = ir.shared(ir.rtcall("pxtrt::mkMap", []))
            node.properties.forEach((p: PropertyAssignment) => {
                let refSuff = ""
                if (isRefCountedExpr(p.initializer))
                    refSuff = "Ref"
                proc.emitExpr(ir.rtcall("pxtrt::mapSet" + refSuff, [
                    ir.op(EK.Incr, [expr]),
                    ir.numlit(getIfaceMemberId(p.name.getText())),
                    emitExpr(p.initializer)
                ]))
            })
            return expr
        }
        function emitPropertyAssignment(node: PropertyDeclaration) {
            if (isStatic(node)) {
                emitVariableDeclaration(node)
                return
            }
            if (node.initializer)
                userError(9209, lf("class field initializers not supported"))
            // do nothing
        }
        function emitShorthandPropertyAssignment(node: ShorthandPropertyAssignment) { }
        function emitComputedPropertyName(node: ComputedPropertyName) { }
        function emitPropertyAccess(node: PropertyAccessExpression): ir.Expr {
            let decl = getDecl(node);
            if (decl.kind == SK.GetAccessor) {
                return emitCallCore(node, node, [], null)
            }
            let attrs = parseComments(decl);
            let callInfo: CallInfo = {
                decl,
                qName: getFullName(checker, decl.symbol),
                attrs,
                args: [],
                isExpression: true
            };
            (node as any).callInfo = callInfo;
            if (decl.kind == SK.EnumMember) {
                let ev = attrs.enumval
                if (!ev) {
                    let val = checker.getConstantValue(decl as EnumMember)
                    if (val == null) {
                        if ((decl as EnumMember).initializer)
                            return emitExpr((decl as EnumMember).initializer)
                        userError(9210, lf("Cannot compute enum value"))
                    }
                    ev = val + ""
                }
                if (/^\d+$/.test(ev))
                    return ir.numlit(parseInt(ev));
                return ir.rtcall(ev, [])
            } else if (decl.kind == SK.PropertySignature) {
                return emitCallCore(node, node, [], null, decl as any, node.expression)
                /*
                if (attrs.shim) {
                    callInfo.args.push(node.expression)
                    return emitShim(decl, node, [node.expression])
                } else {
                    throw unhandled(node, lf("no {shim:...}"), 9236);
                }*/
            } else if (decl.kind == SK.PropertyDeclaration) {
                if (isStatic(decl)) {
                    return emitLocalLoad(decl as PropertyDeclaration)
                }
                let idx = fieldIndex(node)
                callInfo.args.push(node.expression)
                return ir.op(EK.FieldAccess, [emitExpr(node.expression)], idx)
            } else if (isClassFunction(decl) || decl.kind == SK.MethodSignature) {
                throw userError(9211, lf("cannot use method as lambda; did you forget '()' ?"))
            } else if (decl.kind == SK.FunctionDeclaration) {
                return emitFunLiteral(decl as FunctionDeclaration)
            } else {
                throw unhandled(node, lf("Unknown property access for {0}", stringKind(decl)), 9237);
            }
        }

        function emitIndexedAccess(node: ElementAccessExpression, assign: ir.Expr = null): ir.Expr {
            let t = typeOf(node.expression)

            let indexer: string = null
            if (!assign && t.flags & TypeFlags.String)
                indexer = "String_::charAt"
            else if (isArrayType(t))
                indexer = assign ? "Array_::setAt" : "Array_::getAt"
            else if (isInterfaceType(t)) {
                let attrs = parseCommentsOnSymbol(t.symbol)
                indexer = assign ? attrs.indexerSet : attrs.indexerGet
            }

            if (indexer) {
                if (typeOf(node.argumentExpression).flags & TypeFlags.NumberLike) {
                    let args = [node.expression, node.argumentExpression]
                    return rtcallMask(indexer, args, ir.CallingConvention.Plain, assign ? [assign] : [])
                } else {
                    throw unhandled(node, lf("non-numeric indexer on {0}", indexer), 9238)
                }
            } else {
                throw unhandled(node, lf("unsupported indexer"), 9239)
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

        function markFunctionUsed(decl: FunctionLikeDeclaration, bindings: TypeBinding[]) {
            if (!bindings || !bindings.length) markUsed(decl)
            else {
                let info = getFunctionInfo(decl)
                if (!info.usages) {
                    usedDecls[nodeKey(decl)] = decl
                    info.usages = []
                    info.prePassUsagesEmitted = 0

                    if (opts.computeUsedSymbols && decl && decl.symbol)
                        res.usedSymbols[getFullName(checker, decl.symbol)] = null
                }
                let mask = refMask(bindings)
                if (!info.usages.some(u => refMask(u) == mask)) {
                    info.usages.push(bindings)
                    usedWorkList.push(decl)
                }
            }
        }

        function markUsed(decl: Declaration) {
            if (opts.computeUsedSymbols && decl && decl.symbol)
                res.usedSymbols[getFullName(checker, decl.symbol)] = null

            if (decl && !isUsed(decl)) {
                usedDecls[nodeKey(decl)] = decl
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
                return !!(e as any).isRefOverride
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
                            args.push(irToNode(defl ? ir.numlit(parseInt(defl)) : null))
                        } else {
                            if (!isNumericLiteral(prm.initializer)) {
                                userError(9212, lf("only numbers, null, true and false supported as default arguments"))
                            }
                            args.push(prm.initializer)
                        }
                    } else {
                        userError(9213, lf("unsupported default argument (shouldn't happen)"))
                    }
                })
            }

            if (attrs.imageLiteral) {
                if (!isStringLiteral(args[0])) {
                    userError(9214, lf("Only image literals (string literals) supported here; {0}", stringKind(args[0])))
                }

                args[0] = emitImageLiteral((args[0] as StringLiteral).text)
            }
        }

        function emitCallExpression(node: CallExpression): ir.Expr {
            let sig = checker.getResolvedSignature(node)
            return emitCallCore(node, node.expression, node.arguments, sig)
        }

        function emitCallCore(
            node: Expression,
            funcExpr: Expression,
            callArgs: Expression[],
            sig: Signature,
            decl: FunctionLikeDeclaration = null,
            recv: Expression = null
        ): ir.Expr {
            if (!decl)
                decl = getDecl(funcExpr) as FunctionLikeDeclaration
            let isMethod = false
            if (decl)
                switch (decl.kind) {
                    case SK.PropertySignature:
                    case SK.MethodDeclaration:
                    case SK.MethodSignature:
                    case SK.GetAccessor:
                    case SK.SetAccessor:
                        isMethod = true
                        break;
                    case SK.ModuleDeclaration:
                    case SK.FunctionDeclaration:
                        // has special handling
                        break;
                    default:
                        decl = null; // no special handling
                        break;
                }

            let attrs = parseComments(decl)
            let hasRet = !(typeOf(node).flags & TypeFlags.Void)
            let args = callArgs.slice(0)
            let callInfo: CallInfo = {
                decl,
                qName: decl ? getFullName(checker, decl.symbol) : "?",
                attrs,
                args: args.slice(0),
                isExpression: hasRet
            };
            (node as any).callInfo = callInfo

            let bindings: TypeBinding[] = []

            if (sig) {
                let trg: Signature = (sig as any).target
                let typeParams = sig.typeParameters || (trg ? trg.typeParameters : null) || []
                bindings = getTypeBindingsCore(typeParams, typeParams.map(x => (sig as any).mapper(x)))
            }
            let isSelfGeneric = bindings.length > 0
            addEnclosingTypeBindings(bindings, decl)

            if (res.usedArguments && attrs.trackArgs) {
                let tracked = attrs.trackArgs.map(n => args[n]).map(e => {
                    let d = getDecl(e)
                    if (d && d.kind == SK.EnumMember)
                        return getFullName(checker, d.symbol)
                    else return "*"
                }).join(",")
                let fn = getFullName(checker, decl.symbol)
                let lst = res.usedArguments[fn]
                if (!lst) {
                    lst = res.usedArguments[fn] = []
                }
                if (lst.indexOf(tracked) < 0)
                    lst.push(tracked)
            }

            function emitPlain() {
                return mkProcCall(decl, args.map(emitExpr), bindings)
            }

            addDefaultParameters(sig, args, attrs);

            if (decl && decl.kind == SK.FunctionDeclaration) {
                let info = getFunctionInfo(<FunctionDeclaration>decl)

                if (!info.location) {
                    if (attrs.shim && !hasShimDummy(decl)) {
                        return emitShim(decl, node, args);
                    }

                    markFunctionUsed(decl, bindings)
                    return emitPlain();
                }
            }

            if (funcExpr.kind == SK.SuperKeyword) {
                let baseCtor = proc.classInfo.baseClassInfo.ctor
                assert(!bin.finalPass || !!baseCtor)
                let ctorArgs = args.map(emitExpr)
                ctorArgs.unshift(emitThis(funcExpr))
                return mkProcCallCore(baseCtor, null, ctorArgs)
            }

            if (isMethod) {
                let isSuper = false
                if (isStatic(decl)) {
                    // no additional arguments
                } else if (recv || funcExpr.kind == SK.PropertyAccessExpression) {
                    if (!recv)
                        recv = (<PropertyAccessExpression>funcExpr).expression
                    if (recv.kind == SK.SuperKeyword) {
                        isSuper = true
                    }
                    args.unshift(recv)
                    callInfo.args.unshift(recv)
                    bindings = getTypeBindings(typeOf(recv)).concat(bindings)
                } else
                    unhandled(node, lf("strange method call"), 9241)
                let info = getFunctionInfo(decl)
                if (info.virtualRoot) info = info.virtualRoot
                if (!info.isUsed) {
                    info.isUsed = true
                    for (let vinst of info.virtualInstances || []) {
                        if (vinst.parentClassInfo.isUsed)
                            markFunctionUsed(vinst.decl, bindings)
                    }
                }
                if (info.virtualRoot && !isSuper) {
                    assert(!bin.finalPass || info.virtualIndex != null)
                    return mkProcCallCore(null, info.virtualIndex, args.map(emitExpr))
                }
                if (attrs.shim && !hasShimDummy(decl)) {
                    return emitShim(decl, node, args);
                } else if (attrs.helper) {
                    let syms = checker.getSymbolsInScope(node, SymbolFlags.Module)
                    let helpersModule = <ModuleDeclaration>syms.filter(s => s.name == "helpers")[0].valueDeclaration;
                    let helperStmt = (<ModuleBlock>helpersModule.body).statements.filter(s => s.symbol.name == attrs.helper)[0]
                    if (!helperStmt)
                        userError(9215, lf("helpers.{0} not found", attrs.helper))
                    if (helperStmt.kind != SK.FunctionDeclaration)
                        userError(9216, lf("helpers.{0} isn't a function", attrs.helper))
                    decl = <FunctionDeclaration>helperStmt;
                    let sig = checker.getSignatureFromDeclaration(decl)
                    let tp = sig.getTypeParameters() || []
                    if (tp.length != bindings.length)
                        U.oops("helpers type parameter mismatch") // can it happen?
                    bindings.forEach((b, i) => {
                        b.tp = tp[i]
                    })
                    markFunctionUsed(decl, bindings)
                    return emitPlain();
                } else if (decl.kind == SK.MethodSignature || decl.kind == SK.PropertySignature) {
                    let name = getName(decl)
                    let res = mkProcCallCore(null, null, args.map(emitExpr), getIfaceMemberId(name))
                    if (decl.kind == SK.PropertySignature) {
                        let pid = res.data as ir.ProcId
                        pid.mapIdx = pid.ifaceIndex
                        let refSuff = ""
                        if (args.length == 2) {
                            if (isRefCountedExpr(args[1]))
                                refSuff = "Ref"
                            pid.ifaceIndex = getIfaceMemberId("set/" + name)
                            pid.mapMethod = "pxtrt::mapSet" + refSuff
                        } else {
                            if (isRefType(typeOf(node)))
                                refSuff = "Ref"
                            pid.mapMethod = "pxtrt::mapGet" + refSuff
                        }
                    }
                    return res
                } else {
                    markFunctionUsed(decl, bindings)
                    return emitPlain();
                }
            }

            if (isSelfGeneric)
                U.oops("invalid generic call")

            if (decl && decl.kind == SK.ModuleDeclaration) {
                if (getName(decl) == "String")
                    userError(9219, lf("to convert X to string use: X + \"\""))
                else
                    userError(9220, lf("namespaces cannot be called directly"))
            }

            // otherwise we assume a lambda

            if (args.length > 3)
                userError(9217, lf("lambda functions with more than 3 arguments not supported"))

            let suff = args.length + ""

            args.unshift(funcExpr)
            callInfo.args.unshift(funcExpr)

            // lambdas do not decr() arguments themselves; do it normally with getMask()
            return ir.rtcallMask("pxt::runAction" + suff, getMask(args), ir.CallingConvention.Async, args.map(emitExpr))
        }

        function mkProcCallCore(proc: ir.Procedure, vidx: number, args: ir.Expr[], ifaceIdx: number = null) {
            let data: ir.ProcId = {
                proc: proc,
                virtualIndex: vidx,
                ifaceIndex: ifaceIdx
            }
            return ir.op(EK.ProcCall, args, data)
        }

        function lookupProc(decl: ts.Declaration, bindings: TypeBinding[]) {
            let id: ir.ProcQuery = { action: decl as ts.FunctionLikeDeclaration, bindings }
            return bin.procs.filter(p => p.matches(id))[0]
        }

        function mkProcCall(decl: ts.Declaration, args: ir.Expr[], bindings: TypeBinding[]) {
            let proc = lookupProc(decl, bindings)
            assert(!!proc || !bin.finalPass)
            return mkProcCallCore(proc, null, args)
        }

        function layOutGlobals() {
            let globals = bin.globals.slice(0)
            // stable-sort globals, with smallest first, because "strh/b" have
            // smaller immediate range than plain "str" (and same for "ldr")
            globals.forEach((g, i) => g.index = i)
            globals.sort((a, b) =>
                sizeOfBitSize(a.bitSize) - sizeOfBitSize(b.bitSize) ||
                a.index - b.index)
            let currOff = numReservedGlobals * 4
            for (let g of globals) {
                let sz = sizeOfBitSize(g.bitSize)
                while (currOff & (sz - 1))
                    currOff++ // align
                g.index = currOff
                currOff += sz
            }
            bin.globalsWords = (currOff + 3) >> 2
        }

        function emitVTables() {
            for (let info of bin.usedClassInfos) {
                getVTable(info) // gets cached
            }
        }

        function getCtor(decl: ClassDeclaration) {
            return decl.members.filter(m => m.kind == SK.Constructor)[0] as ConstructorDeclaration
        }

        function isIfaceMemberUsed(name: string) {
            return U.lookup(ifaceMembers, name) != null
        }

        function markClassUsed(info: ClassInfo) {
            if (info.isUsed) return
            info.isUsed = true
            if (info.baseClassInfo) markClassUsed(info.baseClassInfo)
            bin.usedClassInfos.push(info)
            for (let m of info.methods) {
                let minf = getFunctionInfo(m)
                if (isIfaceMemberUsed(getName(m)) || (minf.virtualRoot && minf.virtualRoot.isUsed))
                    markFunctionUsed(m, info.bindings)
            }

            let ctor = getCtor(info.decl)
            if (ctor) {
                markFunctionUsed(ctor, info.bindings)
            }
        }

        function emitNewExpression(node: NewExpression) {
            let t = typeOf(node)
            if (isArrayType(t)) {
                throw oops();
            } else if (isPossiblyGenericClassType(t)) {
                let classDecl = <ClassDeclaration>getDecl(node.expression)
                if (classDecl.kind != SK.ClassDeclaration) {
                    userError(9221, lf("new expression only supported on class types"))
                }
                let ctor: ClassElement
                let info = getClassInfo(typeOf(node), classDecl)

                // find ctor to call in base chain
                for (let parinfo = info; parinfo; parinfo = parinfo.baseClassInfo) {
                    ctor = getCtor(parinfo.decl)
                    if (ctor) break
                }

                markClassUsed(info)

                let lbl = info.id + "_VT"
                let obj = ir.rtcall("pxt::mkClassInstance", [ir.ptrlit(lbl, lbl)])
                obj = ir.shared(obj)

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
                    proc.emitExpr(mkProcCall(ctor, compiled, []))
                    return obj
                } else {
                    if (node.arguments && node.arguments.length)
                        userError(9222, lf("constructor with arguments not found"));
                    return obj;
                }
            } else {
                throw unhandled(node, lf("unknown type for new"), 9243)
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
            if (!isStatic(node) && isClassFunction(node)) {
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
            let lbl = getFunctionLabel(node, getEnclosingTypeBindings(node))
            let r = ir.ptrlit(lbl + "_Lit", lbl)
            if (!raw) {
                r = ir.rtcall("pxt::ptrOfLiteral", [r])
            }
            return r
        }

        function emitFuncCore(node: FunctionLikeDeclaration, bindings: TypeBinding[]) {
            let info = getFunctionInfo(node)
            let lit: ir.Expr = null

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

            // forbid: let x = function<T>(a:T) { }
            if (isExpression && isGenericFunction(node))
                userError(9233, lf("function expressions cannot be generic"))

            if (caps.length > 0 && isGenericFunction(node))
                userError(9234, lf("nested functions cannot be generic yet"))

            // if no captured variables, then we can get away with a plain pointer to code
            if (caps.length > 0) {
                assert(getEnclosingFunction(node) != null)
                lit = ir.shared(ir.rtcall("pxt::mkAction", [ir.numlit(refs.length), ir.numlit(caps.length), emitFunLitCore(node, true)]))
                caps.forEach((l, i) => {
                    let loc = proc.localIndex(l)
                    if (!loc)
                        userError(9223, lf("cannot find captured value: {0}", checker.symbolToString(l.symbol)))
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

            let id: ir.ProcQuery = { action: node, bindings }
            let existing = bin.procs.filter(p => p.matches(id))[0]

            if (existing) {
                proc = existing
                proc.reset()
            } else {
                assert(!bin.finalPass)
                proc = new ir.Procedure();
                proc.isRoot = !!(node as any).isRootFunction
                proc.action = node;
                proc.info = info;
                proc.bindings = bindings;
                bin.addProc(proc);
            }

            proc.captured = locals;

            if (node.parent.kind == SK.ClassDeclaration) {
                let parClass = node.parent as ClassDeclaration
                let numTP = parClass.typeParameters ? parClass.typeParameters.length : 0
                assert(bindings.length >= numTP)
                let classInfo = getClassInfo(null, parClass, bindings.slice(0, numTP))
                if (proc.classInfo)
                    assert(proc.classInfo == classInfo)
                else
                    proc.classInfo = classInfo
                if (node.kind == SK.Constructor) {
                    if (classInfo.ctor)
                        assert(classInfo.ctor == proc)
                    else
                        classInfo.ctor = proc
                }
            }

            U.pushRange(typeBindings, bindings)

            proc.args = getParameters(node).map((p, i) => {
                let l = new ir.Cell(i, p, getVarInfo(p))
                l.isarg = true
                return l
            })

            proc.args.forEach(l => {
                //console.log(l.toString(), l.info)
                if (l.isByRefLocal()) {
                    // TODO add C++ support function to do this
                    let tmp = ir.shared(ir.rtcall("pxtrt::mkloc" + l.refSuffix(), []))
                    proc.emitExpr(ir.rtcall("pxtrt::stloc" + l.refSuffix(), [tmp, l.loadCore()]))
                    proc.emitExpr(l.storeDirect(tmp))
                }
            })

            if (node.body.kind == SK.Block) {
                emit(node.body);
            } else {
                let v = emitExpr(node.body)
                proc.emitJmp(getLabels(node).ret, v, ir.JmpMode.Always)
            }

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

            return lit
        }

        function hasShimDummy(node: Declaration) {
            if (opts.target.isNative)
                return false
            let f = node as FunctionLikeDeclaration
            return f.body && (f.body.kind != SK.Block || (f.body as Block).statements.length > 0)
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
                if (!hasShimDummy(node))
                    return
            }

            if (node.flags & NodeFlags.Ambient)
                return;

            if (!node.body)
                return;

            let info = getFunctionInfo(node)
            let lit: ir.Expr = null

            if (isGenericFunction(node)) {
                if (!info.usages) {
                    assert(opts.testMode && !usedDecls[nodeKey(node)] && !bin.finalPass)
                    // test mode - make fake binding
                    let bindings = getTypeParameters(node).map(t => ({
                        tp: checker.getTypeAtLocation(t),
                        isRef: true
                    }))
                    addEnclosingTypeBindings(bindings, node)
                    U.assert(bindings.length > 0)
                    info.usages = [bindings]
                }
                U.assert(info.usages.length > 0, "no generic usages recorded")
                let todo = info.usages
                if (!bin.finalPass) {
                    todo = info.usages.slice(info.prePassUsagesEmitted)
                    info.prePassUsagesEmitted = info.usages.length
                }
                for (let bindings of todo) {
                    scope(() => {
                        let nolit = emitFuncCore(node, bindings)
                        U.assert(nolit == null)
                    })
                }
            } else {
                scope(() => {
                    lit = emitFuncCore(node, getEnclosingTypeBindings(node))
                })
            }

            return lit
        }

        function emitDeleteExpression(node: DeleteExpression) { }
        function emitTypeOfExpression(node: TypeOfExpression) { }
        function emitVoidExpression(node: VoidExpression) { }
        function emitAwaitExpression(node: AwaitExpression) { }
        function emitPrefixUnaryExpression(node: PrefixUnaryExpression): ir.Expr {
            let tp = typeOf(node.operand)
            if (node.operator == SK.ExclamationToken) {
                return ir.rtcall("Boolean_::bang", [emitCondition(node.operand)])
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
                    default:
                        break
                }
            }

            throw unhandled(node, lf("unsupported prefix unary operation"), 9245)
        }

        function doNothing() { }

        function needsCache(e: Expression) {
            let c = e as NodeWithCache
            c.needsIRCache = true
            irCachesToClear.push(c)
        }

        function prepForAssignment(trg: Expression, src: Expression = null) {
            let prev = irCachesToClear.length
            if (trg.kind == SK.PropertyAccessExpression || trg.kind == SK.ElementAccessExpression) {
                needsCache((trg as PropertyAccessExpression).expression)
            }
            if (src)
                needsCache(src)
            if (irCachesToClear.length == prev)
                return doNothing
            else
                return () => {
                    for (let i = prev; i < irCachesToClear.length; ++i) {
                        irCachesToClear[i].cachedIR = null
                        irCachesToClear[i].needsIRCache = false
                    }
                    irCachesToClear.splice(prev, irCachesToClear.length - prev)
                }
        }

        function irToNode(expr: ir.Expr, isRef = false): Expression {
            return {
                kind: SK.NullKeyword,
                isRefOverride: isRef,
                valueOverride: expr
            } as any
        }

        function emitIncrement(trg: Expression, meth: string, isPost: boolean, one: Expression = null) {
            let cleanup = prepForAssignment(trg)
            let oneExpr = one ? emitExpr(one) : ir.numlit(1)
            let prev = ir.shared(emitExpr(trg))
            let result = ir.shared(ir.rtcall(meth, [prev, oneExpr]))
            emitStore(trg, irToNode(result))
            cleanup()
            return isPost ? prev : result
        }

        function emitPostfixUnaryExpression(node: PostfixUnaryExpression): ir.Expr {
            let tp = typeOf(node.operand)

            if (tp.flags & TypeFlags.Number) {
                switch (node.operator) {
                    case SK.PlusPlusToken:
                        return emitIncrement(node.operand, "thumb::adds", true)
                    case SK.MinusMinusToken:
                        return emitIncrement(node.operand, "thumb::subs", true)
                    default:
                        break
                }
            }
            throw unhandled(node, lf("unsupported postfix unary operation"), 9246)
        }

        function fieldIndexCore(info: ClassInfo, fld: FieldWithAddInfo, t: Type) {
            let attrs = parseComments(fld)
            return {
                idx: info.allfields.indexOf(fld),
                name: getName(fld),
                isRef: isRefType(t),
                shimName: attrs.shim
            }
        }

        function fieldIndex(pacc: PropertyAccessExpression): FieldAccessInfo {
            let tp = typeOf(pacc.expression)
            if (isPossiblyGenericClassType(tp)) {
                let info = getClassInfo(tp)
                let fld = info.allfields.filter(f => (<Identifier>f.name).text == pacc.name.text)[0]
                if (!fld)
                    userError(9224, lf("field {0} not found", pacc.name.text))
                return fieldIndexCore(info, fld, typeOf(pacc))
            } else {
                throw unhandled(pacc, lf("bad field access"), 9247)
            }
        }

        function emitStore(trg: Expression, src: Expression) {
            let decl = getDecl(trg)
            let isGlobal = isGlobalVar(decl)
            if (trg.kind == SK.Identifier || isGlobal) {
                if (decl && (isGlobal || decl.kind == SK.VariableDeclaration || decl.kind == SK.Parameter)) {
                    let l = lookupCell(decl)
                    recordUse(<VarOrParam>decl, true)
                    proc.emitExpr(l.storeByRef(emitExpr(src)))
                } else {
                    unhandled(trg, lf("bad target identifier"), 9248)
                }
            } else if (trg.kind == SK.PropertyAccessExpression) {
                let decl = getDecl(trg)
                if (decl && decl.kind == SK.GetAccessor) {
                    decl = getDeclarationOfKind(decl.symbol, SK.SetAccessor)
                    if (!decl) {
                        unhandled(trg, lf("setter not available"), 9253)
                    }
                    proc.emitExpr(emitCallCore(trg, trg, [src], null, decl as FunctionLikeDeclaration))
                } else if (decl && decl.kind == SK.PropertySignature) {
                    proc.emitExpr(emitCallCore(trg, trg, [src], null, decl as FunctionLikeDeclaration))
                } else {
                    proc.emitExpr(ir.op(EK.Store, [emitExpr(trg), emitExpr(src)]))
                }
            } else if (trg.kind == SK.ElementAccessExpression) {
                proc.emitExpr(emitIndexedAccess(trg as ElementAccessExpression, emitExpr(src)))
            } else {
                unhandled(trg, lf("bad assignment target"), 9249)
            }
        }

        function handleAssignment(node: BinaryExpression) {
            let cleanup = prepForAssignment(node.left, node.right)
            emitStore(node.left, node.right)
            let res = emitExpr(node.right)
            cleanup()
            return res
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
            let left = emitExpr(node.left)
            let isString = typeOf(node.left).flags & TypeFlags.String
            if (node.operatorToken.kind == SK.BarBarToken) {
                if (isString)
                    left = ir.rtcall("pxtrt::emptyToNull", [left])
                proc.emitJmp(lbl, left, ir.JmpMode.IfNotZero)
            } else if (node.operatorToken.kind == SK.AmpersandAmpersandToken) {
                left = ir.shared(left)
                if (isString) {
                    let slbl = proc.mkLabel("lazyStr")
                    proc.emitJmp(slbl, ir.rtcall("pxtrt::emptyToNull", [left]), ir.JmpMode.IfNotZero)
                    proc.emitJmp(lbl, left, ir.JmpMode.Always, left)
                    proc.emitLbl(slbl)
                    if (isRefCountedExpr(node.left))
                        proc.emitExpr(ir.op(EK.Decr, [left]))
                    else
                        // make sure we have reference and the stack is cleared
                        proc.emitExpr(ir.rtcall("thumb::ignore", [left]))
                } else {
                    if (isRefCountedExpr(node.left))
                        proc.emitExpr(ir.op(EK.Decr, [left]))
                    proc.emitJmpZ(lbl, left)
                }
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
            let src = getSourceFileOfNode(node)
            if (opts.justMyCode && U.startsWith(src.fileName, "pxt_modules"))
                return;
            let pos = node.pos
            while (/^\s$/.exec(src.text[pos]))
                pos++;
            let p = ts.getLineAndCharacterOfPosition(src, pos)
            let brk: Breakpoint = {
                id: res.breakpoints.length,
                isDebuggerStmt: node.kind == SK.DebuggerStatement,
                fileName: src.fileName,
                start: pos,
                length: node.end - pos,
                line: p.line,
                character: p.character,
                successors: null
            }
            res.breakpoints.push(brk)
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

            if (node.operatorToken.kind == SK.CommaToken) {
                if (isNoopExpr(node.left))
                    return emitExpr(node.right)
                else {
                    let v = emitIgnored(node.left)
                    return ir.op(EK.Sequence, [v, emitExpr(node.right)])
                }
            }

            switch (node.operatorToken.kind) {
                case SK.BarBarToken:
                case SK.AmpersandAmpersandToken:
                    return emitLazyBinaryExpression(node);
            }

            if ((lt.flags & TypeFlags.NumberLike) && (rt.flags & TypeFlags.NumberLike)) {
                let noEq = stripEquals(node.operatorToken.kind)
                let shimName = simpleInstruction(noEq || node.operatorToken.kind)
                if (!shimName)
                    unhandled(node.operatorToken, lf("unsupported numeric operator"), 9250)
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

                let cleanup = prepForAssignment(node.left)
                let post = ir.shared(ir.rtcallMask("String_::concat", 3, ir.CallingConvention.Plain, [
                    emitExpr(node.left),
                    emitAsString(node.right)]))
                emitStore(node.left, irToNode(post))
                cleanup();
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
                        unhandled(node.operatorToken, lf("unknown string operator"), 9251)
                }
            }

            switch (node.operatorToken.kind) {
                case SK.EqualsEqualsToken:
                case SK.EqualsEqualsEqualsToken:
                    return shim("Number_::eq");
                case SK.ExclamationEqualsEqualsToken:
                case SK.ExclamationEqualsToken:
                    return shim("Number_::neq");
                default:
                    throw unhandled(node.operatorToken, lf("unknown generic operator"), 9252)
            }
        }

        function emitAsString(e: Expression | TemplateLiteralFragment): ir.Expr {
            let r = emitExpr(e)
            // TS returns 'any' as type of template elements
            if (isStringLiteral(e))
                return r;
            let tp = typeOf(e)
            if (tp.flags & TypeFlags.NumberLike)
                return ir.rtcall("Number_::toString", [r])
            else if (tp.flags & TypeFlags.Boolean)
                return ir.rtcall("Boolean_::toString", [r])
            else if (tp.flags & TypeFlags.String)
                return r // OK
            else {
                let decl = tp.symbol ? tp.symbol.valueDeclaration : null
                if (decl && (decl.kind == SK.ClassDeclaration || decl.kind == SK.InterfaceDeclaration)) {
                    let classDecl = decl as ClassDeclaration
                    let toString = classDecl.members.filter(m =>
                        (m.kind == SK.MethodDeclaration || m.kind == SK.MethodSignature) &&
                        (m as MethodDeclaration).parameters.length == 0 &&
                        getName(m) == "toString")[0] as MethodDeclaration
                    if (toString) {
                        let ee = e as Expression
                        return emitCallCore(ee, ee, [], null, toString, ee)
                    } else {
                        throw userError(9254, lf("type {0} lacks toString() method", getName(decl)))
                        //return emitStringLiteral("[" + getName(decl) + "]")
                    }
                }
                throw userError(9225, lf("don't know how to convert to string"))
            }
        }

        function emitConditionalExpression(node: ConditionalExpression) {
            let els = proc.mkLabel("condexprz")
            let fin = proc.mkLabel("condexprfin")
            proc.emitJmp(els, emitCondition(node.condition), ir.JmpMode.IfZero)
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
        function emitCondition(expr: Expression) {
            let inner = emitExpr(expr)
            // in both cases unref is internal, so no mask
            if (typeOf(expr).flags & TypeFlags.String) {
                return ir.rtcall("pxtrt::stringToBool", [inner])
            } else if (isRefCountedExpr(expr)) {
                return ir.rtcall("pxtrt::ptrToBool", [inner])
            } else {
                return inner
            }
        }
        function emitIfStatement(node: IfStatement) {
            emitBrk(node)
            let elseLbl = proc.mkLabel("else")
            proc.emitJmpZ(elseLbl, emitCondition(node.expression))
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
            proc.emitJmpZ(l.brk, emitCondition(node.expression));
            proc.emitJmp(l.cont);
            proc.emitLblDirect(l.brk);
        }

        function emitWhileStatement(node: WhileStatement) {
            emitBrk(node)
            let l = getLabels(node)
            proc.emitLblDirect(l.cont);
            proc.emitJmpZ(l.brk, emitCondition(node.expression));
            emit(node.statement)
            proc.emitJmp(l.cont);
            proc.emitLblDirect(l.brk);
        }

        function isNoopExpr(node: Expression) {
            if (!node) return true;
            switch (node.kind) {
                case SK.Identifier:
                case SK.StringLiteral:
                case SK.NumericLiteral:
                case SK.NullKeyword:
                    return true; // no-op
            }
            return false
        }

        function emitIgnored(node: Expression) {
            let v = emitExpr(node);
            let a = typeOf(node)
            if (!(a.flags & TypeFlags.Void)) {
                if (isRefType(a)) {
                    v = ir.op(EK.Decr, [v])
                }
            }
            return v
        }

        function emitExprAsStmt(node: Expression) {
            if (isNoopExpr(node)) return
            emitBrk(node)
            let v = emitIgnored(node)
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
                proc.emitJmpZ(l.brk, emitCondition(node.condition));
            emit(node.statement)
            proc.emitLblDirect(l.cont);
            emitExprAsStmt(node.incrementor);
            proc.emitJmp(l.fortop);
            proc.emitLblDirect(l.brk);
        }

        function emitForOfStatement(node: ForOfStatement) {
            if (!(node.initializer && node.initializer.kind == SK.VariableDeclarationList)) {
                unhandled(node, "only a single variable may be used to iterate a collection")
                return
            }

            let declList = <VariableDeclarationList>node.initializer;
            if (declList.declarations.length != 1) {
                unhandled(node, "only a single variable may be used to iterate a collection")
                return
            }

            //Typecheck the expression being iterated over
            let t = typeOf(node.expression)

            let indexer = ""
            let length = ""
            if (t.flags & TypeFlags.String) {
                indexer = "String_::charAt"
                length = "String_::length"
            }
            else if (isArrayType(t)) {
                indexer = "Array_::getAt"
                length = "Array_::length"
            }
            else {
                unhandled(node.expression, "cannot use for...of with this expression")
                return
            }

            //As the iterator isn't declared in the usual fashion we must mark it as used, otherwise no cell will be allocated for it
            markUsed(declList.declarations[0])
            let iterVar = emitVariableDeclaration(declList.declarations[0]) // c
            //Start with null, TODO: Is this necessary
            proc.emitExpr(iterVar.storeByRef(ir.numlit(0)))
            proc.stackEmpty()

            // Store the expression (it could be a string literal, for example) for the collection being iterated over
            // Note that it's alaways a ref-counted type
            let collectionVar = proc.mkLocalUnnamed(true); // a
            proc.emitExpr(collectionVar.storeByRef(emitExpr(node.expression)))

            // Declaration of iterating variable
            let intVarIter = proc.mkLocalUnnamed(); // i
            proc.emitExpr(intVarIter.storeByRef(ir.numlit(0)))
            proc.stackEmpty();

            emitBrk(node);

            let l = getLabels(node);

            proc.emitLblDirect(l.fortop);
            // i < a.length()
            // we use loadCore() on collection variable so that it doesn't get incr()ed
            // we could have used load() and rtcallMask to be more regular
            proc.emitJmpZ(l.brk, ir.rtcall("Number_::lt", [intVarIter.load(), ir.rtcall(length, [collectionVar.loadCore()])]))

            // c = a[i]
            proc.emitExpr(iterVar.storeByRef(ir.rtcall(indexer, [collectionVar.loadCore(), intVarIter.load()])))

            emit(node.statement);
            proc.emitLblDirect(l.cont);

            // i = i + 1
            proc.emitExpr(intVarIter.storeByRef(ir.rtcall("thumb::adds", [intVarIter.load(), ir.numlit(1)])))

            proc.emitJmp(l.fortop);
            proc.emitLblDirect(l.brk);

            proc.emitExpr(collectionVar.storeByRef(ir.numlit(0))) // clear it, so it gets GCed
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
                error(node, 9230, lf("cannot find outer loop"))
            else {
                let l = getLabels(stmt)
                if (node.kind == SK.ContinueStatement) {
                    if (!isIterationStatement(stmt, false))
                        error(node, 9231, lf("continue on non-loop"));
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

            let switchType = typeOf(node.expression)
            let isNumber = !!(switchType.flags & TypeFlags.NumberLike)

            let l = getLabels(node)
            let defaultLabel: ir.Stmt
            let quickCmpMode = isNumber

            let expr = ir.shared(emitExpr(node.expression))
            let plainExpr = expr
            if (isNumber) {
                emitInJmpValue(expr)
            }

            let lbls = node.caseBlock.clauses.map(cl => {
                let lbl = proc.mkLabel("switch")
                if (cl.kind == SK.CaseClause) {
                    let cc = cl as CaseClause
                    let cmpExpr = emitExpr(cc.expression)
                    if (switchType.flags & TypeFlags.String) {
                        let cmpCall = ir.rtcallMask("String_::compare",
                            isRefCountedExpr(cc.expression) ? 3 : 2,
                            ir.CallingConvention.Plain, [cmpExpr, expr])
                        expr = ir.op(EK.Incr, [expr])
                        proc.emitJmp(lbl, cmpCall, ir.JmpMode.IfZero, plainExpr)
                    } else if (isRefCountedExpr(cc.expression)) {
                        let cmpCall = ir.rtcallMask("Number_::eq", 3,
                            ir.CallingConvention.Plain, [cmpExpr, expr])
                        quickCmpMode = false
                        expr = ir.op(EK.Incr, [expr])
                        proc.emitJmp(lbl, cmpCall, ir.JmpMode.IfNotZero, plainExpr)
                    } else {
                        if (cmpExpr.exprKind == EK.NumberLiteral) {
                            if (!quickCmpMode) {
                                emitInJmpValue(expr)
                                quickCmpMode = true
                            }
                            proc.emitJmp(lbl, cmpExpr, ir.JmpMode.IfJmpValEq, plainExpr)
                        } else {
                            let cmpCall = ir.rtcallMask("Number_::eq", 0,
                                ir.CallingConvention.Plain, [cmpExpr, expr])
                            quickCmpMode = false
                            proc.emitJmp(lbl, cmpCall, ir.JmpMode.IfNotZero, plainExpr)
                        }
                    }
                } else if (cl.kind == SK.DefaultClause) {
                    // Save default label for emit at the end of the
                    // tests section. Default label doesn't have to come at the
                    // end in JS.
                    assert(!defaultLabel)
                    defaultLabel = lbl
                } else {
                    oops()
                }
                return lbl
            })

            if (defaultLabel)
                proc.emitJmp(defaultLabel, plainExpr)
            else
                proc.emitJmp(l.brk, plainExpr);

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
        function emitVariableDeclaration(node: VarOrParam): ir.Cell {
            typeCheckVar(node)
            if (!isUsed(node)) {
                return null;
            }
            let loc = isGlobalVar(node) ?
                lookupCell(node) : proc.mkLocal(node, getVarInfo(node))
            if (loc.isByRefLocal()) {
                proc.emitClrIfRef(loc) // we might be in a loop
                proc.emitExpr(loc.storeDirect(ir.rtcall("pxtrt::mkloc" + loc.refSuffix(), [])))
            }
            // TODO make sure we don't emit code for top-level globals being initialized to zero
            if (node.initializer) {
                emitBrk(node)
                proc.emitExpr(loc.storeByRef(emitExpr(node.initializer)))
                proc.stackEmpty();
            }
            return loc;
        }

        function emitClassExpression(node: ClassExpression) { }
        function emitClassDeclaration(node: ClassDeclaration) {
            getClassInfo(null, node)
            node.members.forEach(emit)
        }
        function emitInterfaceDeclaration(node: InterfaceDeclaration) {
            //userError(9228, lf("interfaces are not currently supported"))
        }
        function emitEnumDeclaration(node: EnumDeclaration) {
            //No code needs to be generated, enum names are replaced by constant values in generated code
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
                    userError(lastSecondaryErrorCode, lastSecondaryError)
                lastSecondaryError = prevErr
                inCatchErrors--
                return res
            } catch (e) {
                inCatchErrors--
                lastSecondaryError = null
                if (!e.ksEmitterUserError)
                    console.log(e.stack)
                let code = e.ksErrorCode || 9200
                error(node, code, e.message)
                return null
            }
        }

        function emitExpr(node0: Node): ir.Expr {
            let node = node0 as NodeWithCache
            if (node.cachedIR) {
                if (isRefCountedExpr(node0 as Expression))
                    return ir.op(EK.Incr, [node.cachedIR])
                return node.cachedIR
            }
            let res = catchErrors(node, emitExprInner) || ir.numlit(0)
            if (node.needsIRCache) {
                node.cachedIR = ir.shared(res)
                return node.cachedIR
            }
            return res
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
                    emitVariableDeclaration(<VariableDeclaration>node);
                    return
                case SK.IfStatement:
                    return emitIfStatement(<IfStatement>node);
                case SK.WhileStatement:
                    return emitWhileStatement(<WhileStatement>node);
                case SK.DoStatement:
                    return emitDoStatement(<DoStatement>node);
                case SK.ForStatement:
                    return emitForStatement(<ForStatement>node);
                case SK.ForOfStatement:
                    return emitForOfStatement(<ForOfStatement>node);
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
                case SK.GetAccessor:
                case SK.SetAccessor:
                    return emitAccessor(<AccessorDeclaration>node);
                case SK.ImportEqualsDeclaration:
                    // this doesn't do anything in compiled code
                    return emitImportEqualsDeclaration(<ImportEqualsDeclaration>node);
                default:
                    unhandled(node);
            }
        }

        function emitExprCore(node: Node): ir.Expr {
            switch (node.kind) {
                case SK.NullKeyword:
                    let v = (node as any).valueOverride;
                    if (v) return v
                    return ir.numlit(null);
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
                case SK.SuperKeyword:
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
                case SK.TemplateExpression:
                    return emitTemplateExpression(<TemplateExpression>node);
                case SK.ObjectLiteralExpression:
                    return emitObjectLiteral(<ObjectLiteralExpression>node);
                default:
                    unhandled(node);
                    return null

                /*
                case SyntaxKind.TemplateSpan:
                    return emitTemplateSpan(<TemplateSpan>node);
                case SyntaxKind.Parameter:
                    return emitParameter(<ParameterDeclaration>node);
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
                case SyntaxKind.ExportDeclaration:
                    return emitExportDeclaration(<ExportDeclaration>node);
                case SyntaxKind.ExportAssignment:
                    return emitExportAssignment(<ExportAssignment>node);
                */
            }
        }
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
        globalsWords: number;
        finalPass = false;
        target: CompileTarget;
        writeFile = (fn: string, cont: string) => { };
        res: CompileResult;
        options: CompileOptions;
        usedClassInfos: ClassInfo[] = [];

        strings: Map<string> = {};
        otherLiterals: string[] = [];
        codeHelpers: Map<string> = {};
        lblNo = 0;

        reset() {
            this.lblNo = 0
            this.otherLiterals = []
            this.strings = {}
        }

        addProc(proc: ir.Procedure) {
            assert(!this.finalPass)
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

