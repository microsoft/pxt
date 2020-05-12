/// <reference path="../../localtypings/pxtarget.d.ts"/>
/// <reference path="../../localtypings/pxtpackage.d.ts"/>

namespace ts {
    export interface Node {
        pxt: pxtc.PxtNode;
    }
}
namespace ts.pxtc {
    export const enum PxtNodeFlags {
        None = 0,
        IsRootFunction = 0x0001,
        IsBogusFunction = 0x0002,
        IsGlobalIdentifier = 0x0004,
        IsUsed = 0x0008,
        InPxtModules = 0x0010,
        FromPreviousCompile = 0x0020,
        IsOverridden = 0x0040,
    }
    export type EmitAction = (bin: Binary) => void;
    export class PxtNode {
        flags: PxtNodeFlags;

        // TSC interface cache
        typeCache: Type;
        symbolCache: Symbol;
        declCache: Declaration;
        commentAttrs: CommentAttrs;
        fullName: string;
        constantFolded: { val: any };

        // compiler state
        functionInfo: FunctionAddInfo;
        variableInfo: VariableAddInfo;
        classInfo: ClassInfo;
        proc: ir.Procedure;
        cell: ir.Cell;

        // set of nodes pulled in by the current node
        usedNodes: pxt.Map<Declaration>;
        // when the current node is pulled in, the actions listed will be run
        usedActions: EmitAction[];

        // exported to clients
        callInfo: CallInfo;
        exprInfo: BinaryExpressionInfo;

        // for wrapping ir.Expr inside of TS Expression
        valueOverride: ir.Expr;

        refresh() {
            // clear IsUsed flag
            this.flags &= ~PxtNodeFlags.IsUsed
            // this happens for top-level function expression - we just re-emit them
            if (this.proc && !this.usedActions && !getEnclosingFunction(this.proc.action))
                this.resetEmit()
            else if (this.proc && !this.proc.cachedJS)
                this.resetEmit()
            else if (this.usedNodes)
                this.flags |= PxtNodeFlags.FromPreviousCompile
            if (this.classInfo)
                this.classInfo.reset()
        }

        resetEmit() {
            // clear IsUsed flag
            this.flags &= ~(PxtNodeFlags.IsUsed | PxtNodeFlags.FromPreviousCompile)
            if (this.proc && this.proc.classInfo && this.proc.classInfo.ctor == this.proc)
                this.proc.classInfo.ctor = null
            this.functionInfo = null;
            this.variableInfo = null;
            this.classInfo = null;
            this.callInfo = null;
            this.proc = null;
            this.cell = null;
            this.exprInfo = null;
            this.usedNodes = null;
            this.usedActions = null;
        }

        resetTSC() {
            // clear all flags except for InPxtModules
            this.flags &= PxtNodeFlags.InPxtModules;
            this.typeCache = null;
            this.symbolCache = null;
            this.commentAttrs = null;
            this.valueOverride = null;
            this.declCache = undefined;
            this.fullName = null;
            this.constantFolded = undefined;
        }

        resetAll() {
            this.resetTSC()
            this.resetEmit()
        }

        constructor(public wave: number, public id: number) {
            this.flags = PxtNodeFlags.None;
            this.resetAll()
        }
    }

    enum HasLiteralType {
        Enum,
        Number,
        String,
        Boolean,
        Unsupported
    }

    // in tagged mode,
    // * the lowest bit set means 31 bit signed integer
    // * the lowest bit clear, and second lowest set means special constant
    // "undefined" is represented by 0
    function taggedSpecialValue(n: number) { return (n << 2) | 2 }
    export const taggedUndefined = 0
    export const taggedNull = taggedSpecialValue(1)
    export const taggedFalse = taggedSpecialValue(2)
    export const taggedNaN = taggedSpecialValue(3)
    export const taggedTrue = taggedSpecialValue(16)
    function fitsTaggedInt(vn: number) {
        if (target.switches.boxDebug) return false
        return (vn | 0) == vn && -1073741824 <= vn && vn <= 1073741823
    }

    export const thumbArithmeticInstr: pxt.Map<boolean> = {
        "adds": true,
        "subs": true,
        "muls": true,
        "ands": true,
        "orrs": true,
        "eors": true,
        "lsls": true,
        "asrs": true,
        "lsrs": true,
    }

    export const numberArithmeticInstr: pxt.Map<boolean> = {
        "div": true,
        "mod": true,
        "le": true,
        "lt": true,
        "ge": true,
        "gt": true,
        "eq": true,
        "neq": true,
    }

    const thumbFuns: pxt.Map<FuncInfo> = {
        "Array_::getAt": {
            name: "_pxt_array_get",
            argsFmt: ["T", "T", "T"],
            value: 0
        },
        "Array_::setAt": {
            name: "_pxt_array_set",
            argsFmt: ["T", "T", "T", "T"],
            value: 0
        },
        "BufferMethods::getByte": {
            name: "_pxt_buffer_get",
            argsFmt: ["T", "T", "T"],
            value: 0
        },
        "BufferMethods::setByte": {
            name: "_pxt_buffer_set",
            argsFmt: ["T", "T", "T", "I"],
            value: 0
        },
        "pxtrt::mapGetGeneric": {
            name: "_pxt_map_get",
            argsFmt: ["T", "T", "S"],
            value: 0
        },
        "pxtrt::mapSetGeneric": {
            name: "_pxt_map_set",
            argsFmt: ["T", "T", "S", "T"],
            value: 0
        },
    }

    let EK = ir.EK;
    export const SK = SyntaxKind;

    export const numReservedGlobals = 1;

    export interface FieldWithAddInfo extends NamedDeclaration {
    }

    type TemplateLiteralFragment = TemplateHead | TemplateMiddle | TemplateTail;
    export type EmittableAsCall = FunctionLikeDeclaration | SignatureDeclaration | ObjectLiteralElementLike | PropertySignature | ModuleDeclaration
        | ParameterDeclaration | PropertyDeclaration;

    let lastNodeId = 0
    let currNodeWave = 1

    export function isInPxtModules(node: Node) {
        if (node.pxt)
            return !!(node.pxt.flags & PxtNodeFlags.InPxtModules)
        const src = getSourceFileOfNode(node)
        return src ? isPxtModulesFilename(src.fileName) : false
    }

    export function pxtInfo(n: Node) {
        if (!n.pxt) {
            const info = new PxtNode(currNodeWave, ++lastNodeId)
            if (isInPxtModules(n))
                info.flags |= PxtNodeFlags.InPxtModules
            n.pxt = info
            return info
        } else {
            const info = n.pxt
            if (info.wave != currNodeWave) {
                info.wave = currNodeWave
                if (!compileOptions || !compileOptions.skipPxtModulesTSC)
                    info.resetAll()
                else {
                    if (info.flags & PxtNodeFlags.InPxtModules) {
                        if (compileOptions.skipPxtModulesEmit)
                            info.refresh()
                        else
                            info.resetEmit()
                    } else
                        info.resetAll()
                }
            }
            return info
        }
    }

    export function getNodeId(n: Node) {
        return pxtInfo(n).id
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

    // next free error 9282
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

    export function isStackMachine() {
        return target.isNative && target.nativeType == NATIVE_TYPE_VM
    }

    export function needsNumberConversions() {
        return target.isNative && target.nativeType != NATIVE_TYPE_VM
    }

    export function isThumb() {
        return target.isNative && (target.nativeType == NATIVE_TYPE_THUMB)
    }

    function isThisType(type: TypeParameter) {
        // Internal TS field
        return (type as any).isThisType;
    }

    function isSyntheticThis(def: Declaration) {
        if ((<any>def).isThisParameter)
            return true;
        else
            return false;
    }

    // everything in numops:: operates on and returns tagged ints
    // everything else (except as indicated with CommentAttrs), operates and returns regular ints

    function fromInt(e: ir.Expr): ir.Expr {
        if (!needsNumberConversions()) return e
        return ir.rtcall("pxt::fromInt", [e])
    }

    function fromBool(e: ir.Expr): ir.Expr {
        if (!needsNumberConversions()) return e
        return ir.rtcall("pxt::fromBool", [e])
    }

    function fromFloat(e: ir.Expr): ir.Expr {
        if (!needsNumberConversions()) return e
        return ir.rtcall("pxt::fromFloat", [e])
    }

    function fromDouble(e: ir.Expr): ir.Expr {
        if (!needsNumberConversions()) return e
        return ir.rtcall("pxt::fromDouble", [e])
    }

    function getBitSize(decl: TypedDecl) {
        if (!decl || !decl.type) return BitSize.None
        if (!(isNumberType(typeOf(decl)))) return BitSize.None
        if (decl.type.kind != SK.TypeReference) return BitSize.None
        switch ((decl.type as TypeReferenceNode).typeName.getText()) {
            case "int8": return BitSize.Int8
            case "int16": return BitSize.Int16
            case "int32": return BitSize.Int32
            case "uint8": return BitSize.UInt8
            case "uint16": return BitSize.UInt16
            case "uint32": return BitSize.UInt32
            default: return BitSize.None
        }
    }

    export function sizeOfBitSize(b: BitSize) {
        switch (b) {
            case BitSize.None: return target.shortPointers ? 2 : 4
            case BitSize.Int8: return 1
            case BitSize.Int16: return 2
            case BitSize.Int32: return 4
            case BitSize.UInt8: return 1
            case BitSize.UInt16: return 2
            case BitSize.UInt32: return 4
            default: throw oops()
        }
    }

    export function isBitSizeSigned(b: BitSize) {
        switch (b) {
            case BitSize.Int8:
            case BitSize.Int16:
            case BitSize.Int32:
                return true
            case BitSize.UInt8:
            case BitSize.UInt16:
            case BitSize.UInt32:
                return false
            default: throw oops()
        }
    }

    export function setCellProps(l: ir.Cell) {
        l._isLocal = isLocalVar(l.def) || isParameter(l.def)
        l._isGlobal = isGlobalVar(l.def)
        if (!isSyntheticThis(l.def)) {
            let tp = typeOf(l.def)
            if (tp.flags & TypeFlags.Void) {
                oops("void-typed variable, " + l.toString())
            }
            l.bitSize = getBitSize(l.def)
            if (l.bitSize != BitSize.None) {
                l._debugType = (isBitSizeSigned(l.bitSize) ? "int" : "uint") + (8 * sizeOfBitSize(l.bitSize))
            } else if (isStringType(tp)) {
                l._debugType = "string"
            } else if (tp.flags & TypeFlags.NumberLike) {
                l._debugType = "number"
            }
        }
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

    export function isStatic(node: Declaration) {
        return node && node.modifiers && node.modifiers.some(m => m.kind == SK.StaticKeyword)
    }

    export function isReadOnly(node: Declaration) {
        return node.modifiers && node.modifiers.some(m => m.kind == SK.ReadonlyKeyword)
    }

    export function getExplicitDefault(attrs: CommentAttrs, name: string) {
        if (!attrs.explicitDefaults)
            return null
        if (attrs.explicitDefaults.indexOf(name) < 0)
            return null
        return attrs.paramDefl[name]
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

    function getEnclosingFunction(node0: Node) {
        let node = node0
        let hadLoop = false
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
                case SK.WhileStatement:
                case SK.DoStatement:
                case SK.ForInStatement:
                case SK.ForOfStatement:
                case SK.ForStatement:
                    hadLoop = true
                    break
                case SK.SourceFile:
                    // don't treat variables declared inside of top-level loops as global
                    if (hadLoop)
                        return _rootFunction
                    return null
            }
        }
    }

    export function isObjectType(t: Type): t is ObjectType {
        return "objectFlags" in t;
    }

    function isVar(d: Declaration): boolean {
        if (!d)
            return false
        if (d.kind == SK.VariableDeclaration)
            return true
        if (d.kind == SK.BindingElement)
            return isVar(d.parent.parent as any)
        return false
    }

    function isGlobalVar(d: Declaration) {
        if (!d) return false
        return (isVar(d) && !getEnclosingFunction(d)) ||
            (d.kind == SK.PropertyDeclaration && isStatic(d))
    }

    function isLocalVar(d: Declaration) {
        return isVar(d) && !isGlobalVar(d);
    }

    function isParameter(d: Declaration): boolean {
        if (!d)
            return false
        if (d.kind == SK.Parameter)
            return true
        if (d.kind == SK.BindingElement)
            return isParameter(d.parent.parent as any)
        return false
    }

    function isTopLevelFunctionDecl(decl: Declaration) {
        return (decl.kind == SK.FunctionDeclaration && !getEnclosingFunction(decl)) ||
            isClassFunction(decl)
    }

    function getRefTagToValidate(tp: string): number {
        switch (tp) {
            case "_Buffer": return pxt.BuiltInType.BoxedBuffer
            case "_Image": return target.imageRefTag || pxt.BuiltInType.RefImage
            case "_Action": return pxt.BuiltInType.RefAction
            case "_RefCollection": return pxt.BuiltInType.RefCollection
            default:
                return null
        }
    }

    export interface CallInfo {
        decl: TypedDecl;
        qName: string;
        args: Expression[];
        isExpression: boolean;
        isAutoCreate?: boolean;
    }

    export interface ITableEntry {
        name: string;
        idx: number;
        info: number;
        proc: ir.Procedure; // null, when name is a simple field
        setProc?: ir.Procedure;
    }

    export class ClassInfo {
        derivedClasses?: ClassInfo[];
        classNo?: number;
        lastSubtypeNo?: number;
        baseClassInfo: ClassInfo = null;
        allfields: FieldWithAddInfo[] = [];
        // indexed by getName(node)
        methods: pxt.Map<FunctionLikeDeclaration[]> = {};
        attrs: CommentAttrs;
        vtable?: ir.Procedure[];
        itable?: ITableEntry[];
        ctor?: ir.Procedure;
        toStringMethod?: ir.Procedure;

        constructor(public id: string, public decl: ClassDeclaration) {
            this.attrs = parseComments(decl)
            this.reset()
        }

        reset() {
            this.vtable = null
            this.itable = null
        }

        get isUsed() {
            return !!(pxtInfo(this.decl).flags & PxtNodeFlags.IsUsed)
        }

        allMethods() {
            const r: FunctionLikeDeclaration[] = []
            for (let k of Object.keys(this.methods))
                for (let m of this.methods[k]) {
                    r.push(m)
                }
            return r
        }

        usedMethods() {
            const r: FunctionLikeDeclaration[] = []
            for (let k of Object.keys(this.methods))
                for (let m of this.methods[k]) {
                    const info = pxtInfo(m)
                    if (info.flags & PxtNodeFlags.IsUsed)
                        r.push(m)
                }
            return r
        }
    }

    export interface BinaryExpressionInfo {
        leftType: string;
        rightType: string;
    }

    let lf = assembler.lf;
    let checker: TypeChecker;
    let _rootFunction: FunctionDeclaration
    export let target: CompileTarget;
    export let compileOptions: CompileOptions;
    let lastSecondaryError: string
    let lastSecondaryErrorCode = 0
    let inCatchErrors = 0

    export function getNodeFullName(checker: TypeChecker, node: Node) {
        const pinfo = pxtInfo(node)
        if (pinfo.fullName == null)
            pinfo.fullName = getFullName(checker, node.symbol)
        return pinfo.fullName
    }

    export function getComments(node: Node) {
        if (node.kind == SK.VariableDeclaration)
            node = node.parent.parent // we need variable stmt

        let cmtCore = (node: Node) => {
            const src = getSourceFileOfNode(node)
            if (!src) return "";
            const doc = getLeadingCommentRangesOfNode(node, src)
            if (!doc) return "";
            const cmt = doc.map(r => src.text.slice(r.pos, r.end)).join("\n")
            return cmt;
        }

        if (node.symbol && node.symbol.declarations && node.symbol.declarations.length > 1) {
            return node.symbol.declarations.map(cmtCore).join("\n")
        } else {
            return cmtCore(node)
        }
    }

    export function parseCommentsOnSymbol(symbol: Symbol): CommentAttrs {
        let cmts = ""
        for (let decl of symbol.declarations) {
            cmts += getComments(decl)
        }
        return parseCommentString(cmts)
    }

    export function parseComments(node: Node): CommentAttrs {
        const pinfo = node ? pxtInfo(node) : null
        if (!pinfo || pinfo.flags & PxtNodeFlags.IsBogusFunction)
            return parseCommentString("")
        if (pinfo.commentAttrs)
            return pinfo.commentAttrs
        let res = parseCommentString(getComments(node))
        res._name = getName(node)
        pinfo.commentAttrs = res
        return res
    }

    export function getName(node: Node & { name?: any; }) {
        if (!node.name || node.name.kind != SK.Identifier)
            return "???"
        return (node.name as Identifier).text
    }

    function genericRoot(t: Type) {
        if (isObjectType(t) && t.objectFlags & ObjectFlags.Reference) {
            let r = t as TypeReference
            if (r.typeArguments && r.typeArguments.length)
                return r.target
        }
        return null
    }

    function isArrayType(t: Type) {
        if (!isObjectType(t)) {
            return false;
        }
        return (t.objectFlags & ObjectFlags.Reference) && t.symbol && t.symbol.name == "Array"
    }

    function isInterfaceType(t: Type) {
        if (!isObjectType(t)) {
            return false;
        }
        return !!(t.objectFlags & ObjectFlags.Interface) || !!(t.objectFlags & ObjectFlags.Anonymous)
    }

    function isClassType(t: Type) {
        if (isThisType(t as TypeParameter)) {
            return true;
        }
        if (!isObjectType(t)) {
            return false;
        }
        // check if we like the class?
        return !!((t.objectFlags & ObjectFlags.Class) || (t.symbol && (t.symbol.flags & SymbolFlags.Class)))
    }

    function isObjectLiteral(t: Type) {
        return t.symbol && (t.symbol.flags & (SymbolFlags.ObjectLiteral | SymbolFlags.TypeLiteral)) !== 0;
    }

    function isStructureType(t: Type) {
        return (isFunctionType(t) == null) && (isClassType(t) || isInterfaceType(t) || isObjectLiteral(t))
    }

    function castableToStructureType(t: Type) {
        return isStructureType(t) || (t.flags & (TypeFlags.Null | TypeFlags.Undefined | TypeFlags.Any))
    }

    function isPossiblyGenericClassType(t: Type) {
        let g = genericRoot(t)
        if (g) return isClassType(g)
        return isClassType(t)
    }

    function arrayElementType(t: Type, idx = -1): Type {
        if (isArrayType(t))
            return checkType((<TypeReference>t).typeArguments[0])
        return checker.getIndexTypeOfType(t, IndexKind.Number);
    }

    function isFunctionType(t: Type) {
        // if an object type represents a function (via 1 signature) then it
        // can't have any other properties or constructor signatures
        if (t.getApparentProperties().length > 0 || t.getConstructSignatures().length > 0)
            return null;
        let sigs = checker.getSignaturesOfType(t, SignatureKind.Call)
        if (sigs && sigs.length == 1)
            return sigs[0]
        // TODO: error message for overloaded function signatures?
        return null
    }

    function isGenericType(t: Type) {
        const g = genericRoot(t);
        return !!(g && g.typeParameters && g.typeParameters.length);
    }

    export function checkType(t: Type): Type {
        // we currently don't enforce any restrictions on type system
        return t
    }

    export function taggedSpecial(v: any) {
        if (v === null) return taggedNull
        else if (v === undefined) return taggedUndefined
        else if (v === false) return taggedFalse
        else if (v === true) return taggedTrue
        else if (isNaN(v)) return taggedNaN
        else return null
    }

    function typeOf(node: Node) {
        let r: Type;
        const info = pxtInfo(node)
        if (info.typeCache)
            return info.typeCache
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
        if (!r)
            return r
        // save for future use; this cuts around 10% of emit() time
        info.typeCache = r
        return checkType(r)
    }

    function checkUnionOfLiterals(t: Type): HasLiteralType {
        if (!(t.flags & TypeFlags.Union)) {
            return HasLiteralType.Unsupported;
        }

        let u = t as UnionType;
        let allGood = true;
        let constituentType: HasLiteralType;

        u.types.forEach(tp => {
            if (constituentType === undefined) {
                if (tp.flags & TypeFlags.NumberLike) constituentType = HasLiteralType.Number;
                else if (tp.flags & TypeFlags.BooleanLike) constituentType = HasLiteralType.Boolean;
                else if (tp.flags & TypeFlags.StringLike) constituentType = HasLiteralType.String;
                else if (tp.flags & TypeFlags.EnumLike) constituentType = HasLiteralType.Enum;
            }
            else {
                switch (constituentType) {
                    case HasLiteralType.Number: allGood = allGood && !!(tp.flags & TypeFlags.NumberLike); break;
                    case HasLiteralType.Boolean: allGood = allGood && !!(tp.flags & TypeFlags.BooleanLike); break;
                    case HasLiteralType.String: allGood = allGood && !!(tp.flags & TypeFlags.StringLike); break;
                    case HasLiteralType.Enum: allGood = allGood && !!(tp.flags & TypeFlags.EnumLike); break;
                }
            }
        });

        return allGood ? constituentType : HasLiteralType.Unsupported;
    }

    function isUnionOfLiterals(t: Type): t is UnionType {
        return checkUnionOfLiterals(t) !== HasLiteralType.Unsupported;
    }

    // does src inherit from tgt via heritage clauses?
    function inheritsFrom(src: ClassDeclaration, tgt: ClassDeclaration): boolean {
        if (src == tgt)
            return true;
        if (src.heritageClauses)
            for (let h of src.heritageClauses) {
                switch (h.token) {
                    case SK.ExtendsKeyword:
                        let tp = typeOf(h.types[0])
                        if (isClassType(tp)) {
                            let parent = <ClassDeclaration>tp.symbol.valueDeclaration
                            return inheritsFrom(parent, tgt)
                        }
                }
            }
        return false;
    }

    function checkInterfaceDeclaration(bin: Binary, decl: InterfaceDeclaration) {
        const check = (d: Declaration) => {
            if (d && d.kind == SK.ClassDeclaration)
                userError(9261, lf("Interface with same name as a class not supported"))
        }
        check(decl.symbol.valueDeclaration)
        if (decl.symbol.declarations)
            decl.symbol.declarations.forEach(check)

        if (decl.heritageClauses)
            for (let h of decl.heritageClauses) {
                switch (h.token) {
                    case SK.ExtendsKeyword:
                        let tp = typeOf(h.types[0])
                        if (isClassType(tp)) {
                            userError(9262, lf("Extending a class by an interface not supported."))
                        }
                }
            }
    }

    function typeCheckSubtoSup(sub: Node | Type, sup: Node | Type) {
        // we leave this function for now, in case we want to enforce some checks in future
    }

    function isGenericFunction(fun: FunctionLikeDeclaration) {
        return getTypeParameters(fun).length > 0
    }

    function getTypeParameters(fun: FunctionLikeDeclaration | SignatureDeclaration): NodeArray<TypeParameterDeclaration> | TypeParameterDeclaration[] {
        // TODO add check for methods of generic classes
        if (fun.typeParameters && fun.typeParameters.length)
            return fun.typeParameters
        if (isClassFunction(fun) || fun.kind == SK.MethodSignature) {
            if (fun.parent.kind == SK.ClassDeclaration || fun.parent.kind == SK.InterfaceDeclaration) {
                return (fun.parent as ClassLikeDeclaration).typeParameters || []
            }
        }
        return []
    }

    function funcHasReturn(fun: FunctionLikeDeclaration) {
        let sig = checker.getSignatureFromDeclaration(fun)
        let rettp = checker.getReturnTypeOfSignature(sig)
        return !(rettp.flags & TypeFlags.Void)
    }

    function isNamedDeclaration(node: Declaration): node is NamedDeclaration {
        return !!(node && (node as NamedDeclaration).name);
    }

    function parentPrefix(node: Node): string {
        if (!node)
            return ""
        switch (node.kind) {
            case SK.ModuleBlock:
                return parentPrefix(node.parent)
            case SK.ClassDeclaration:
            case SK.ModuleDeclaration:
                return parentPrefix(node.parent) + (node as ModuleDeclaration).name.text + "."
            default:
                return ""
        }
    }

    export function getDeclName(node: Declaration) {
        let text = isNamedDeclaration(node) ? (<Identifier>node.name).text : null
        if (!text)
            text = node.kind == SK.Constructor ? "constructor" : "inline"
        return parentPrefix(node.parent) + text;
    }

    function safeName(node: Declaration) {
        let text = getDeclName(node)
        return text.replace(/[^\w]+/g, "_")
    }

    export function getFunctionLabel(node: FunctionLikeDeclaration) {
        return safeName(node) + "__P" + getNodeId(node)
    }

    export interface FieldAccessInfo {
        idx: number;
        name: string;
        isRef: boolean;
        shimName: string;
        classInfo: ClassInfo;
        needsCheck: boolean;
    }

    export type VarOrParam = VariableDeclaration | ParameterDeclaration | PropertyDeclaration | BindingElement;
    export type TypedDecl = Declaration & { type?: TypeNode }

    export interface VariableAddInfo {
        captured?: boolean;
        written?: boolean;
        functionsToDefine?: FunctionDeclaration[];
    }

    export class FunctionAddInfo {
        capturedVars: VarOrParam[] = [];
        location?: ir.Cell;
        thisParameter?: ParameterDeclaration; // a bit bogus
        virtualParent?: FunctionAddInfo;
        virtualIndex?: number;
        parentClassInfo?: ClassInfo;
        usedBeforeDecl?: boolean;
        // these two are only used in native backend
        usedAsValue?: boolean;
        usedAsIface?: boolean;
        alreadyEmitted?: boolean;

        constructor(public decl: EmittableAsCall) { }

        get isUsed() {
            return !!(pxtInfo(this.decl).flags & PxtNodeFlags.IsUsed)
        }
    }

    export function compileBinary(
        program: Program,
        opts: CompileOptions,
        res: CompileResult,
        entryPoint: string): EmitResult {

        if (compilerHooks.preBinary)
            compilerHooks.preBinary(program, opts, res)

        target = opts.target
        compileOptions = opts
        target.debugMode = !!opts.breakpoints
        const diagnostics = createDiagnosticCollection();
        checker = program.getTypeChecker();
        let startTime = U.cpuUs();
        let usedWorkList: Declaration[] = []
        let irCachesToClear: NodeWithCache[] = []
        let autoCreateFunctions: pxt.Map<boolean> = {} // INCTODO
        let configEntries: pxt.Map<ConfigEntry> = {}
        let currJres: pxt.JRes = null
        let currUsingContext: PxtNode = null
        let needsUsingInfo = false
        let pendingFunctionDefinitions: FunctionDeclaration[] = []

        currNodeWave++

        if (opts.target.isNative) {
            if (!opts.extinfo || !opts.extinfo.hexinfo) {
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
                    emittedFiles: [],
                    emitSkipped: true
                };
            }

            hexfile.setupFor(opts.target, opts.extinfo || emptyExtInfo());
            hexfile.setupInlineAssembly(opts);
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
                column: 0,
            }]
        }

        if (opts.computeUsedSymbols) {
            res.usedSymbols = {}
            res.usedArguments = {}
        }

        let allStmts: Statement[] = [];
        if (!opts.forceEmit || res.diagnostics.length == 0) {
            const files = program.getSourceFiles();
            files.forEach(f => {
                f.statements.forEach(s => {
                    allStmts.push(s)
                });
            });
        }

        let mainSrcFile = program.getSourceFiles().filter(f => Util.endsWith(f.fileName, entryPoint))[0];

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
            parent: mainSrcFile,
            pos: 0,
            end: 0,
        }
        _rootFunction = rootFunction
        const pinfo = pxtInfo(rootFunction)
        pinfo.flags |= PxtNodeFlags.IsRootFunction | PxtNodeFlags.IsBogusFunction

        markUsed(rootFunction);
        usedWorkList = [];

        reset();
        needsUsingInfo = true
        emitTopLevel(rootFunction)

        for (; ;) {
            flushWorkQueue()
            if (fixpointVTables())
                break
        }

        layOutGlobals()
        needsUsingInfo = false
        emitVTables()

        let pass0 = U.cpuUs()
        res.times["pass0"] = pass0 - startTime

        let resDiags = diagnostics.getDiagnostics()

        reset();
        needsUsingInfo = false
        bin.finalPass = true
        emit(rootFunction)

        U.assert(usedWorkList.length == 0)

        res.configData = []
        for (let k of Object.keys(configEntries)) {
            if (configEntries["!" + k])
                continue
            res.configData.push({
                name: k.replace(/^\!/, ""),
                key: configEntries[k].key,
                value: configEntries[k].value
            })
        }
        res.configData.sort((a, b) => a.key - b.key)

        let pass1 = U.cpuUs()
        res.times["pass1"] = pass1 - pass0
        catchErrors(rootFunction, finalEmit)
        res.times["passFinal"] = U.cpuUs() - pass1

        if (opts.ast) {
            let pre = U.cpuUs()
            annotate(program, entryPoint, target);
            res.times["passAnnotate"] = U.cpuUs() - pre
        }

        // 12k for decent arcade game
        // res.times["numnodes"] = lastNodeId

        compileOptions = null

        if (resDiags.length == 0)
            resDiags = diagnostics.getDiagnostics()

        if (compilerHooks.postBinary)
            compilerHooks.postBinary(program, opts, res)

        return {
            diagnostics: resDiags,
            emittedFiles: undefined,
            emitSkipped: !!opts.noEmit
        }

        function diag(category: DiagnosticCategory, node: Node, code: number, message: string, arg0?: any, arg1?: any, arg2?: any) {
            diagnostics.add(createDiagnosticForNode(node, <any>{
                code,
                message,
                key: message.replace(/^[a-zA-Z]+/g, "_"),
                category,
            }, arg0, arg1, arg2));
        }

        function warning(node: Node, code: number, msg: string, arg0?: any, arg1?: any, arg2?: any) {
            diag(DiagnosticCategory.Warning, node, code, msg, arg0, arg1, arg2);
        }

        function error(node: Node, code: number, msg: string, arg0?: any, arg1?: any, arg2?: any) {
            diag(DiagnosticCategory.Error, node, code, msg, arg0, arg1, arg2);
        }

        function unhandled(n: Node, info?: string, code: number = 9202) {
            // If we have info then we may as well present that instead
            if (info) {
                return userError(code, info)
            }

            if (!n) {
                userError(code, lf("Sorry, this language feature is not supported"))
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
                case ts.SyntaxKind.SpreadElement:
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
                msg = lf("{0} not supported", ts.SyntaxKind[n.kind])
            }

            if (alternative) {
                msg += " - " + alternative
            }

            return userError(code, msg)
        }

        function nodeKey(f: Node) {
            return getNodeId(f) + ""
        }

        function getFunctionInfo(f: EmittableAsCall) {
            const info = pxtInfo(f)
            if (!info.functionInfo)
                info.functionInfo = new FunctionAddInfo(f)
            return info.functionInfo
        }

        function getVarInfo(v: Declaration) {
            const info = pxtInfo(v)
            if (!info.variableInfo) {
                info.variableInfo = {}
            }
            return info.variableInfo
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

        function recordAction<T>(f: (bin: Binary) => T): T {
            const r = f(bin)
            if (needsUsingInfo)
                bin.recordAction(currUsingContext, f)
            return r
        }

        function getIfaceMemberId(name: string, markUsed = false) {
            return recordAction(bin => {
                if (markUsed) {
                    if (!U.lookup(bin.explicitlyUsedIfaceMembers, name)) {
                        U.assert(!bin.finalPass)
                        bin.explicitlyUsedIfaceMembers[name] = true
                    }
                }

                let v = U.lookup(bin.ifaceMemberMap, name)
                if (v != null) return v
                U.assert(!bin.finalPass)
                // this gets renumbered before the final pass
                v = bin.ifaceMemberMap[name] = -1;
                bin.emitString(name)
                return v
            })
        }

        function finalEmit() {
            if (opts.noEmit)
                return;

            bin.writeFile = (fn: string, data: string) => {
                res.outfiles[fn] = data
            }

            for (let proc of bin.procs)
                if (!proc.cachedJS || proc.inlineBody)
                    proc.resolve()

            if (target.isNative)
                bin.procs = bin.procs.filter(p => p.inlineBody && !p.info.usedAsIface && !p.info.usedAsValue ? false : true)

            if (opts.target.isNative) {
                if (opts.extinfo.yotta)
                    bin.writeFile("yotta.json", JSON.stringify(opts.extinfo.yotta, null, 2));
                if (opts.extinfo.platformio)
                    bin.writeFile("platformio.json", JSON.stringify(opts.extinfo.platformio, null, 2));
                if (opts.target.nativeType == NATIVE_TYPE_VM)
                    vmEmit(bin, opts)
                else
                    processorEmit(bin, opts, res)
            } else {
                jsEmit(bin)
            }
        }

        function typeCheckVar(tp: Type) {
            if (tp.flags & TypeFlags.Void) {
                userError(9203, lf("void-typed variables not supported"))
            }
        }

        function emitGlobal(decl: Declaration) {
            const pinfo = pxtInfo(decl)
            typeCheckVar(typeOf(decl))
            if (!pinfo.cell)
                pinfo.cell = new ir.Cell(null, decl, getVarInfo(decl))
            if (bin.globals.indexOf(pinfo.cell) < 0)
                bin.globals.push(pinfo.cell)
        }

        function lookupCell(decl: Declaration): ir.Cell {
            if (isGlobalVar(decl)) {
                markUsed(decl)
                const pinfo = pxtInfo(decl)
                if (!pinfo.cell)
                    emitGlobal(decl)
                return pinfo.cell
            } else {
                let res = proc.localIndex(decl)
                if (!res) {
                    if (bin.finalPass)
                        userError(9204, lf("cannot locate identifer"))
                    else {
                        res = proc.mkLocal(decl, getVarInfo(decl))
                    }
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
                            let superType = typeOf(h.types[0])
                            if (superType && isClassType(superType) && !isGenericType(superType)) {
                                // check if user defined
                                // let filename = getSourceFileOfNode(tp.symbol.valueDeclaration).fileName
                                // if (program.getRootFileNames().indexOf(filename) == -1) {
                                //    throw userError(9228, lf("cannot inherit from built-in type."))
                                // }

                                // need to redo subtype checking on members
                                let subType = checker.getTypeAtLocation(node)
                                typeCheckSubtoSup(subType, superType)

                                return getClassInfo(superType)
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

        function isToString(m: FunctionLikeDeclaration) {
            return m.kind == SK.MethodDeclaration &&
                (m as MethodDeclaration).parameters.length == 0 &&
                getName(m) == "toString"
        }

        function fixpointVTables() {
            needsUsingInfo = false
            const prevLen = bin.usedClassInfos.length
            for (let ci of bin.usedClassInfos) {
                for (let m of ci.allMethods()) {
                    const pinfo = pxtInfo(m)
                    const info = getFunctionInfo(m)
                    if (pinfo.flags & PxtNodeFlags.IsUsed) {
                        // we need to mark the parent as used, otherwise vtable layout fails, see #3740
                        if (info.virtualParent)
                            markFunctionUsed(info.virtualParent.decl)
                    } else if (info.virtualParent && info.virtualParent.isUsed) {
                        // if our parent method is used, and our vtable is used,
                        // we are also used
                        markFunctionUsed(m)
                    } else if (isToString(m) || isIfaceMemberUsed(getName(m))) {
                        // if the name is used in interface context, also mark as used
                        markFunctionUsed(m)
                    }
                }

                const ctor = getCtor(ci.decl)
                if (ctor) {
                    markFunctionUsed(ctor)
                }
            }
            needsUsingInfo = true
            if (usedWorkList.length == 0 && prevLen == bin.usedClassInfos.length)
                return true
            return false
        }

        function getVTable(inf: ClassInfo) {
            assert(inf.isUsed, "inf.isUsed")
            if (inf.vtable)
                return inf.vtable
            let tbl = inf.baseClassInfo ? getVTable(inf.baseClassInfo).slice(0) : []
            inf.derivedClasses = []
            if (inf.baseClassInfo)
                inf.baseClassInfo.derivedClasses.push(inf)

            for (let m of inf.usedMethods()) {
                bin.numMethods++
                let minf = getFunctionInfo(m)
                const attrs = parseComments(m)
                if (isToString(m) && !attrs.shim) {
                    inf.toStringMethod = lookupProc(m)
                    inf.toStringMethod.info.usedAsIface = true
                }
                if (minf.virtualParent) {
                    bin.numVirtMethods++
                    let key = classFunctionKey(m)
                    let done = false
                    let proc = lookupProc(m)
                    U.assert(!!proc)
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

            for (let fld of inf.allfields) {
                let fname = getName(fld)
                let finfo = fieldIndexCore(inf, fld, false)
                inf.itable.push({
                    name: fname,
                    info: (finfo.idx + 1) * (isStackMachine() ? 1 : 4),
                    idx: getIfaceMemberId(fname),
                    proc: null
                })
            }

            for (let curr = inf; curr; curr = curr.baseClassInfo) {
                for (let m of curr.usedMethods()) {
                    const n = getName(m)
                    const attrs = parseComments(m);
                    if (attrs.shim) continue;

                    const proc = lookupProc(m)
                    const ex = inf.itable.find(e => e.name == n)
                    const isSet = m.kind == SK.SetAccessor
                    const isGet = m.kind == SK.GetAccessor
                    if (ex) {
                        if (isSet && !ex.setProc)
                            ex.setProc = proc
                        else if (isGet && !ex.proc)
                            ex.proc = proc
                    } else {
                        inf.itable.push({
                            name: n,
                            info: 0,
                            idx: getIfaceMemberId(n),
                            proc: !isSet ? proc : null,
                            setProc: isSet ? proc : null
                        })
                    }
                    proc.info.usedAsIface = true
                }
            }

            return inf.vtable
        }

        // this code determines if we will need a vtable entry
        // by checking if we are overriding a method in a super class
        function computeVtableInfo(info: ClassInfo) {
            for (let currMethod of info.allMethods()) {
                let baseMethod: FunctionLikeDeclaration = null
                const key = classFunctionKey(currMethod)
                const k = getName(currMethod)
                for (let base = info.baseClassInfo; !!base; base = base.baseClassInfo) {
                    if (base.methods.hasOwnProperty(k))
                        for (let m2 of base.methods[k])
                            if (classFunctionKey(m2) == key) {
                                baseMethod = m2
                                // note thare's no 'break' here - we'll go to uppermost
                                // matching method
                            }
                }
                if (baseMethod) {
                    let minf = getFunctionInfo(currMethod)
                    let pinf = getFunctionInfo(baseMethod)
                    // TODO we can probably drop this check
                    if (baseMethod.parameters.length != currMethod.parameters.length)
                        error(currMethod, 9255, lf("the overriding method is currently required to have the same number of arguments as the base one"))
                    // pinf is the transitive parent
                    minf.virtualParent = pinf
                    if (!pinf.virtualParent) {
                        needsFullRecompileIfCached(pxtInfo(baseMethod))
                        pinf.virtualParent = pinf
                    }
                    assert(pinf.virtualParent == pinf, "pinf.virtualParent == pinf")
                }
            }
        }

        function needsFullRecompileIfCached(pxtinfo: PxtNode) {
            if ((pxtinfo.flags & PxtNodeFlags.FromPreviousCompile) ||
                (pxtinfo.flags & PxtNodeFlags.InPxtModules &&
                    compileOptions.skipPxtModulesEmit)) {
                res.needsFullRecompile = true;
                throw userError(9200, lf("full recompile required"));
            }
        }

        function getClassInfo(t: Type, decl: ClassDeclaration = null) {
            if (!decl)
                decl = <ClassDeclaration>t.symbol.valueDeclaration
            const pinfo = pxtInfo(decl)
            if (!pinfo.classInfo) {
                const id = safeName(decl) + "__C" + getNodeId(decl)
                const info = new ClassInfo(id, decl)
                pinfo.classInfo = info
                if (info.attrs.autoCreate)
                    autoCreateFunctions[info.attrs.autoCreate] = true
                // only do it after storing ours in case we run into cycles (which should be errors)
                info.baseClassInfo = getBaseClassInfo(decl)
                const prevFields = info.baseClassInfo
                    ? U.toDictionary(info.baseClassInfo.allfields, f => getName(f)) : {}
                const prevMethod =
                    (n: string, c = info.baseClassInfo): FunctionLikeDeclaration[] => {
                        if (!c) return null
                        return c.methods[n] || prevMethod(n, c.baseClassInfo)
                    }

                for (let mem of decl.members) {
                    if (mem.kind == SK.PropertyDeclaration) {
                        let pdecl = <PropertyDeclaration>mem
                        if (!isStatic(pdecl))
                            info.allfields.push(pdecl)
                        const key = getName(pdecl)
                        if (prevMethod(key) || U.lookup(prevFields, key))
                            error(pdecl, 9279, lf("redefinition of '{0}' as field", key))
                    } else if (mem.kind == SK.Constructor) {
                        for (let p of (mem as FunctionLikeDeclaration).parameters) {
                            if (isCtorField(p))
                                info.allfields.push(p)
                        }
                    } else if (isClassFunction(mem)) {
                        let minf = getFunctionInfo(mem as any)
                        minf.parentClassInfo = info
                        const key = getName(mem)
                        if (!info.methods.hasOwnProperty(key))
                            info.methods[key] = []
                        info.methods[key].push(mem as FunctionLikeDeclaration)
                        const pfield = U.lookup(prevFields, key)
                        if (pfield) {
                            const pxtinfo = pxtInfo(pfield)
                            if (!(pxtinfo.flags & PxtNodeFlags.IsOverridden)) {
                                pxtinfo.flags |= PxtNodeFlags.IsOverridden
                                if (pxtinfo.flags & PxtNodeFlags.IsUsed)
                                    getIfaceMemberId(key, true)
                                needsFullRecompileIfCached(pxtinfo)
                            }
                            // error(mem, 9279, lf("redefinition of '{0}' (previously a field)", key))
                        }
                    }
                }
                if (info.baseClassInfo) {
                    info.allfields = info.baseClassInfo.allfields.concat(info.allfields)
                    computeVtableInfo(info)
                }

            }
            return pinfo.classInfo;
        }

        function emitImageLiteral(s: string): LiteralExpression {
            if (!s) s = "0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n";

            let x = 0;
            let w = 0;
            let h = 0;
            let lit = "";
            let c = 0;
            s += "\n"
            for (let i = 0; i < s.length; ++i) {
                switch (s[i]) {
                    case ".":
                    case "_":
                    case "0": lit += "0,"; x++; c++; break;
                    case "#":
                    case "*":
                    case "1": lit += "255,"; x++; c++; break;
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

            // Pad with a 0 if we have an odd number of pixels
            if (c % 2 != 0)
                lit += "0"

            // this is codal's format!
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

        function isGlobalConst(decl: Declaration) {
            if (isGlobalVar(decl) && (decl.parent.flags & NodeFlags.Const))
                return true
            return false
        }

        function isSideEffectfulInitializer(init: Expression): boolean {
            if (!init) return false;
            if (isStringLiteral(init)) return false;
            switch (init.kind) {
                case SK.ArrayLiteralExpression:
                    return (init as ArrayLiteralExpression).elements.some(isSideEffectfulInitializer)
                default:
                    return constantFold(init) == null;
            }
        }

        function emitLocalLoad(decl: VarOrParam) {
            const folded = constantFoldDecl(decl)
            if (folded)
                return emitLit(folded.val)
            if (isGlobalVar(decl)) {
                const attrs = parseComments(decl)
                if (attrs.shim)
                    return emitShim(decl, decl, [])
            }
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
            let info = getFunctionInfo(f)
            markUsageOrder(info);
            if (info.location) {
                return info.location.load()
            } else {
                assert(!bin.finalPass || info.capturedVars.length == 0, "!bin.finalPass || info.capturedVars.length == 0")
                info.usedAsValue = true
                markFunctionUsed(f)
                return emitFunLitCore(f)
            }
        }

        function markUsageOrder(info: FunctionAddInfo) {
            if (info.usedBeforeDecl === undefined)
                info.usedBeforeDecl = true;
            else if (bin.finalPass && info.usedBeforeDecl && info.capturedVars.length) {
                if (getEnclosingFunction(info.decl) && !info.alreadyEmitted)
                    userError(9278, lf("function referenced before all variables it uses are defined"))
            }
        }

        function emitIdentifier(node: Identifier): ir.Expr {
            const decl = getDecl(node)

            const fold = constantFoldDecl(decl)
            if (fold)
                return emitLit(fold.val)

            if (decl && (isVar(decl) || isParameter(decl))) {
                return emitLocalLoad(<VarOrParam>decl)
            } else if (decl && decl.kind == SK.FunctionDeclaration) {
                return emitFunLiteral(decl as FunctionDeclaration)
            } else {
                if (node.text == "undefined")
                    return emitLit(undefined)
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
            let r: ir.Expr
            if (str == "") {
                r = ir.rtcall("String_::mkEmpty", [])
            } else {
                let lbl = emitAndMarkString(str)
                r = ir.ptrlit(lbl, JSON.stringify(str))
            }
            r.isStringLiteral = true
            return r
        }
        function emitLiteral(node: LiteralExpression) {
            if (node.kind == SK.NumericLiteral) {
                if ((<any>node).imageLiteral) {
                    return ir.ptrlit((<any>node).imageLiteral, (<any>node).jsLit)
                } else {
                    const parsed = parseFloat(node.text)
                    return emitLit(parsed)
                }
            } else if (isStringLiteral(node)) {
                return emitStringLiteral(node.text)
            } else {
                throw oops();
            }
        }

        function asString(e: Node) {
            let isRef = isRefCountedExpr(e as Expression)
            let expr = emitExpr(e)
            if (target.isNative || isStringLiteral(e))
                return irToNode(expr, isRef)
            expr = ir.rtcallMask("String_::stringConv", 1, ir.CallingConvention.Async, [expr])
            return irToNode(expr, true)
        }

        function emitTemplateExpression(node: TemplateExpression) {
            let numconcat = 0
            let concat = (a: ir.Expr, b: Expression | TemplateLiteralFragment) => {
                if (isEmptyStringLiteral(b))
                    return a
                numconcat++
                return rtcallMask("String_::concat", [irToNode(a, true), asString(b)], null)
            }
            let expr = pxtInfo(asString(node.head)).valueOverride
            for (let span of node.templateSpans) {
                expr = concat(expr, span.expression)
                expr = concat(expr, span.literal)
            }
            if (numconcat == 0) {
                // make sure `${foo}` == foo.toString(), not just foo
                return rtcallMask("String_::concat", [
                    irToNode(expr, true),
                    irToNode(ir.rtcall("String_::mkEmpty", []), false)], null)
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
        function emitArrayLiteral(node: ArrayLiteralExpression) {
            let eltT = arrayElementType(typeOf(node))
            let coll = ir.shared(ir.rtcall("Array_::mk", []))
            for (let elt of node.elements) {
                let mask = isRefCountedExpr(elt) ? 2 : 0
                proc.emitExpr(ir.rtcall("Array_::push", [coll, emitExpr(elt)], mask))
            }
            return coll
        }
        function emitObjectLiteral(node: ObjectLiteralExpression) {
            let expr = ir.shared(ir.rtcall("pxtrt::mkMap", []))
            node.properties.forEach((p: PropertyAssignment | ShorthandPropertyAssignment) => {
                assert(!p.questionToken) // should be disallowed by TS grammar checker

                let keyName: string
                let init: ir.Expr
                if (p.kind == SK.ShorthandPropertyAssignment) {
                    const sp = p as ShorthandPropertyAssignment
                    assert(!sp.equalsToken && !sp.objectAssignmentInitializer) // disallowed by TS grammar checker
                    keyName = p.name.text;
                    const vsym = checker.getShorthandAssignmentValueSymbol(p)
                    const vname: Identifier = vsym && vsym.valueDeclaration && (vsym.valueDeclaration as any).name
                    if (vname && vname.kind == SK.Identifier)
                        init = emitIdentifier(vname)
                    else
                        throw unhandled(p) // not sure what happened
                } else if (p.name.kind == SK.ComputedPropertyName) {
                    const keyExpr = (p.name as ComputedPropertyName).expression
                    // need to use rtcallMask, so keyExpr gets converted to string
                    proc.emitExpr(rtcallMask("pxtrt::mapSetByString", [
                        irToNode(expr, true),
                        keyExpr,
                        p.initializer
                    ], null))
                    return
                } else {
                    keyName = p.name.kind == SK.StringLiteral ?
                        (p.name as StringLiteral).text : p.name.getText();
                    init = emitExpr(p.initializer)
                }
                const fieldId = target.isNative
                    ? ir.numlit(getIfaceMemberId(keyName))
                    : ir.ptrlit(null, JSON.stringify(keyName))
                const args = [
                    expr,
                    fieldId,
                    init
                ];
                proc.emitExpr(ir.rtcall(target.isNative ? "pxtrt::mapSet" : "pxtrt::mapSetByString", args))
            })
            return expr
        }
        function emitPropertyAssignment(node: PropertyDeclaration) {
            if (isStatic(node)) {
                emitVariableDeclaration(node)
                return
            }
            if (node.initializer) {
                let info = getClassInfo(typeOf(node.parent))
                if (bin.finalPass && info.isUsed && !info.ctor)
                    userError(9209, lf("class field initializers currently require an explicit constructor"))
            }
            // do nothing
        }
        function emitShorthandPropertyAssignment(node: ShorthandPropertyAssignment) { }
        function emitComputedPropertyName(node: ComputedPropertyName) { }
        function emitPropertyAccess(node: PropertyAccessExpression): ir.Expr {
            let decl = getDecl(node);

            const fold = constantFoldDecl(decl)
            if (fold)
                return emitLit(fold.val)

            if (decl.kind == SK.SetAccessor)
                decl = checkGetter(decl)

            if (decl.kind == SK.GetAccessor)
                return emitCallCore(node, node, [], null, decl as GetAccessorDeclaration)

            if (decl.kind == SK.EnumMember) {
                throw userError(9210, lf("Cannot compute enum value"))
            } else if (decl.kind == SK.PropertySignature || decl.kind == SK.PropertyAssignment) {
                return emitCallCore(node, node, [], null, decl as any, node.expression)
            } else if (decl.kind == SK.PropertyDeclaration || decl.kind == SK.Parameter) {
                if (isStatic(decl)) {
                    return emitLocalLoad(decl as PropertyDeclaration)
                }
                if (isSlowField(decl)) {
                    // treat as interface call
                    return emitCallCore(node, node, [], null, decl as any, node.expression)
                } else {
                    let idx = fieldIndex(node)
                    return ir.op(EK.FieldAccess, [emitExpr(node.expression)], idx)
                }
            } else if (isClassFunction(decl) || decl.kind == SK.MethodSignature) {
                // TODO this is now supported in runtime; can be probably relaxed (by using GetAccessor code path above)
                throw userError(9211, lf("cannot use method as lambda; did you forget '()' ?"))
            } else if (decl.kind == SK.FunctionDeclaration) {
                return emitFunLiteral(decl as FunctionDeclaration)
            } else if (isVar(decl)) {
                return emitLocalLoad(decl as VariableDeclaration)
            } else {
                throw unhandled(node, lf("Unknown property access for {0}", stringKind(decl)), 9237);
            }
        }

        function checkGetter(decl: Declaration) {
            const getter = getDeclarationOfKind(decl.symbol, SK.GetAccessor)
            if (getter == null) {
                throw userError(9281, lf("setter currently requires a corresponding getter"))
            } else {
                return getter as GetAccessorDeclaration
            }
        }

        function isSlowField(decl: Declaration) {
            if (decl.kind == SK.Parameter || decl.kind == SK.PropertyDeclaration) {
                const pinfo = pxtInfo(decl)
                return !!target.switches.slowFields || !!(pinfo.flags & PxtNodeFlags.IsOverridden)
            }
            return false
        }

        function emitIndexedAccess(node: ElementAccessExpression, assign: Expression = null): ir.Expr {
            let t = typeOf(node.expression)

            let attrs: CommentAttrs = {
                callingConvention: ir.CallingConvention.Plain,
                paramDefl: {},
            }

            let indexer: string = null
            let stringOk = false
            if (!assign && isStringType(t)) {
                indexer = "String_::charAt"
            } else if (isArrayType(t)) {
                indexer = assign ? "Array_::setAt" : "Array_::getAt"
            } else if (isInterfaceType(t)) {
                attrs = parseCommentsOnSymbol(t.symbol)
                indexer = assign ? attrs.indexerSet : attrs.indexerGet
            }

            if (!indexer && (t.flags & (TypeFlags.Any | TypeFlags.StructuredOrTypeVariable))) {
                indexer = assign ? "pxtrt::mapSetGeneric" : "pxtrt::mapGetGeneric"
                stringOk = true
            }

            if (indexer) {
                if (stringOk || isNumberLike(node.argumentExpression)) {
                    let args = [node.expression, node.argumentExpression]
                    return rtcallMask(indexer, args, attrs, assign ? [assign] : [])
                } else {
                    throw unhandled(node, lf("non-numeric indexer on {0}", indexer), 9238)
                }
            } else {
                throw unhandled(node, lf("unsupported indexer"), 9239)
            }
        }

        function isOnDemandGlobal(decl: Declaration) {
            if (!isGlobalVar(decl))
                return false
            let v = decl as VariableDeclaration
            if (!isSideEffectfulInitializer(v.initializer))
                return true
            let attrs = parseComments(decl)
            if (attrs.whenUsed)
                return true
            return false
        }

        function isOnDemandDecl(decl: Declaration) {
            let res = isOnDemandGlobal(decl) || isTopLevelFunctionDecl(decl) || isClassDeclaration(decl)
            if (target.switches.noTreeShake)
                return false
            if (opts.testMode && res) {
                if (!isInPxtModules(decl))
                    return false
            }
            return res
        }

        function shouldEmitNow(node: Declaration) {
            if (!isOnDemandDecl(node))
                return true
            const info = pxtInfo(node)
            if (bin.finalPass)
                return !!(info.flags & PxtNodeFlags.IsUsed)
            else
                return info == currUsingContext
        }

        function markUsed(decl: Declaration) {
            if (!decl)
                return

            const pinfo = pxtInfo(decl)
            if (pinfo.classInfo) {
                markVTableUsed(pinfo.classInfo)
                return
            }

            if (opts.computeUsedSymbols && decl.symbol)
                res.usedSymbols[getNodeFullName(checker, decl)] = null

            if (isStackMachine() && isClassFunction(decl))
                getIfaceMemberId(getName(decl), true)

            recordUsage(decl)

            if (!(pinfo.flags & PxtNodeFlags.IsUsed)) {
                pinfo.flags |= PxtNodeFlags.IsUsed
                if (isOnDemandDecl(decl))
                    usedWorkList.push(decl)
            }
        }

        function markFunctionUsed(decl: EmittableAsCall) {
            markUsed(decl)
        }

        function emitAndMarkString(str: string) {
            return recordAction(bin => {
                return bin.emitString(str)
            })
        }

        function recordUsage(decl: Declaration) {
            if (!needsUsingInfo)
                return
            if (!currUsingContext) {
                U.oops("no using ctx for: " + getName(decl))
            } else {
                currUsingContext.usedNodes[nodeKey(decl)] = decl
            }
        }

        function getDeclCore(node: Node): Declaration {
            if (!node) return null
            const pinfo = pxtInfo(node)
            if (pinfo.declCache !== undefined)
                return pinfo.declCache
            let sym = checker.getSymbolAtLocation(node)
            let decl: Declaration
            if (sym) {
                decl = sym.valueDeclaration
                if (!decl && sym.declarations) {
                    let decl0 = sym.declarations[0]
                    if (decl0 && decl0.kind == SyntaxKind.ImportEqualsDeclaration) {
                        sym = checker.getSymbolAtLocation((decl0 as ImportEqualsDeclaration).moduleReference)
                        if (sym)
                            decl = sym.valueDeclaration
                    }
                }
            }
            return decl
        }

        function getDecl(node: Node): Declaration {
            let decl = getDeclCore(node)
            markUsed(decl)

            if (!decl && node && node.kind == SK.PropertyAccessExpression) {
                const namedNode = node as PropertyAccessExpression
                decl = {
                    kind: SK.PropertySignature,
                    symbol: { isBogusSymbol: true, name: namedNode.name.getText() },
                    name: namedNode.name,
                } as any
                pxtInfo(decl).flags |= PxtNodeFlags.IsBogusFunction
            }

            pinfo.declCache = decl || null
            return decl
        }
        function isRefCountedExpr(e: Expression) {
            // we generate a fake NULL expression for default arguments
            // we also generate a fake numeric literal for image literals
            if (e.kind == SK.NullKeyword || e.kind == SK.NumericLiteral)
                return !!(e as any).isRefOverride
            // no point doing the incr/decr for these - they are statically allocated anyways (unless on AVR)
            if (isStringLiteral(e))
                return false
            return true
        }
        function getMask(args: Expression[]) {
            assert(args.length <= 8, "args.length <= 8")
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

            if (nm.indexOf('(') >= 0) {
                let parse = /(.*)\((.*)\)$/.exec(nm)
                if (parse) {
                    if (args.length)
                        U.userError("no arguments expected")
                    let litargs: ir.Expr[] = []
                    let strargs = parse[2].replace(/\s/g, "")
                    if (strargs) {
                        for (let a of parse[2].split(/,/)) {
                            let v = parseInt(a)
                            if (isNaN(v)) {
                                v = lookupDalConst(node, a) as number;
                                if (v == null)
                                    v = lookupConfigConst(node, a)
                                if (v == null)
                                    U.userError("invalid argument: " + a + " in " + nm)
                            }
                            litargs.push(ir.numlit(v))
                        }
                        if (litargs.length > 4)
                            U.userError("too many args")
                    }
                    nm = parse[1]
                    if (opts.target.isNative) {
                        hexfile.validateShim(getDeclName(decl), nm, attrs, true, litargs.map(v => true))
                    }
                    return ir.rtcallMask(nm, 0, attrs.callingConvention, litargs)
                }
            }

            if (nm == "TD_NOOP") {
                assert(!hasRet, "!hasRet")
                if (target.switches.profile && attrs.shimArgument == "perfCounter") {
                    if (args[0] && args[0].kind == SK.StringLiteral)
                        proc.perfCounterName = (args[0] as StringLiteral).text
                    if (!proc.perfCounterName)
                        proc.perfCounterName = proc.getFullName()
                }
                return emitLit(undefined)
            }

            if (nm == "TD_ID" || nm === "ENUM_GET") {
                assert(args.length == 1, "args.length == 1")
                return emitExpr(args[0])
            }

            if (opts.target.isNative) {
                hexfile.validateShim(getDeclName(decl), nm, attrs, hasRet, args.map(isNumberLike))
            }

            return rtcallMask(nm, args, attrs)
        }

        function isNumericLiteral(node: Expression) {
            switch (node.kind) {
                case SK.UndefinedKeyword:
                case SK.NullKeyword:
                case SK.TrueKeyword:
                case SK.FalseKeyword:
                case SK.NumericLiteral:
                    return true;
                case SK.PropertyAccessExpression:
                    let r = emitExpr(node)
                    return r.exprKind == EK.NumberLiteral
                default:
                    return false;
            }
        }

        function addDefaultParametersAndTypeCheck(sig: Signature, args: Expression[], attrs: CommentAttrs) {
            if (!sig) return;
            let parms = sig.getParameters();
            // remember the number of arguments passed explicitly
            let goodToGoLength = args.length
            if (parms.length > args.length) {
                parms.slice(args.length).forEach(p => {
                    if (p.valueDeclaration &&
                        p.valueDeclaration.kind == SK.Parameter) {
                        let prm = <ParameterDeclaration>p.valueDeclaration
                        if (!prm.initializer) {
                            let defl = getExplicitDefault(attrs, getName(prm))
                            let expr = defl ? emitLit(parseInt(defl)) : null
                            if (expr == null) {
                                expr = emitLit(undefined)
                            }
                            args.push(irToNode(expr))
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

            // type check for assignment of actual to formal,
            // TODO: checks for the rest needed
            for (let i = 0; i < goodToGoLength; i++) {
                let p = parms[i]
                // there may be more arguments than parameters
                if (p && p.valueDeclaration && p.valueDeclaration.kind == SK.Parameter)
                    typeCheckSubtoSup(args[i], p.valueDeclaration)
            }

            // TODO: this is micro:bit specific and should be lifted out
            if (attrs.imageLiteral) {
                if (!isStringLiteral(args[0])) {
                    userError(9214, lf("Only image literals (string literals) supported here; {0}", stringKind(args[0])))
                }

                args[0] = emitImageLiteral((args[0] as StringLiteral).text)
            }
        }

        function emitCallExpression(node: CallExpression): ir.Expr {
            const sig = checker.getResolvedSignature(node);
            return emitCallCore(node, node.expression, node.arguments, sig);
        }

        function emitCallCore(
            node: Expression,
            funcExpr: Expression,
            callArgs: NodeArray<Expression> | Expression[],
            sig: Signature,
            decl: EmittableAsCall = null,
            recv: Expression = null
        ): ir.Expr {
            if (!decl)
                decl = getDecl(funcExpr) as EmittableAsCall;
            let hasRecv = false
            let forceMethod = false
            let isStaticLike = false
            const noArgs = node === funcExpr

            if (decl) {
                switch (decl.kind) {
                    // these can be implemented by fields
                    case SK.PropertySignature:
                    case SK.PropertyAssignment:
                    case SK.PropertyDeclaration:
                    case SK.MethodSignature:
                        hasRecv = true
                        break
                    case SK.Parameter:
                        if (isCtorField(decl))
                            hasRecv = true
                        break
                    // these are all class members, so cannot be implemented by fields
                    case SK.GetAccessor:
                    case SK.SetAccessor:
                    case SK.MethodDeclaration:
                        hasRecv = true
                        forceMethod = true
                        isStaticLike = isStatic(decl)
                        break
                    case SK.FunctionDeclaration:
                        isStaticLike = true
                        break
                    case SK.ModuleDeclaration:
                        // has special handling
                        break;
                    default:
                        decl = null; // no special handling
                        break;
                }
            } else {
                if (funcExpr.kind == SK.PropertyAccessExpression)
                    hasRecv = true // any-access
            }

            if (target.switches.slowMethods)
                forceMethod = false

            const attrs = parseComments(decl)
            let args = callArgs.slice(0)

            if (hasRecv && isStatic(decl))
                hasRecv = false

            if (hasRecv && !recv && funcExpr.kind == SK.PropertyAccessExpression)
                recv = (<PropertyAccessExpression>funcExpr).expression

            if (res.usedArguments && attrs.trackArgs) {
                let targs = recv ? [recv].concat(args) : args
                let tracked = attrs.trackArgs.map(n => targs[n]).map(e => {
                    let d = getDecl(e)
                    if (d && (d.kind == SK.EnumMember || d.kind == SK.VariableDeclaration))
                        return getNodeFullName(checker, d)
                    else if (e && e.kind == SK.StringLiteral)
                        return (e as StringLiteral).text
                    else return "*"
                }).join(",")
                let fn = getNodeFullName(checker, decl)
                let lst = res.usedArguments[fn]
                if (!lst) {
                    lst = res.usedArguments[fn] = []
                }
                if (lst.indexOf(tracked) < 0)
                    lst.push(tracked)
            }

            function emitPlain() {
                let r = mkProcCall(decl, args.map((x) => emitExpr(x)))
                let pp = r.data as ir.ProcId
                if (args[0] && pp.proc && pp.proc.classInfo)
                    pp.isThis = args[0].kind == SK.ThisKeyword
                return r
            }

            addDefaultParametersAndTypeCheck(sig, args, attrs);

            // first we handle a set of direct cases, note that
            // we are not recursing on funcExpr here, but looking
            // at the associated decl
            if (isStaticLike) {
                let info = getFunctionInfo(<FunctionDeclaration>decl)

                if (!info.location) {
                    if (attrs.shim && !hasShimDummy(decl)) {
                        return emitShim(decl, node, args);
                    }

                    markFunctionUsed(decl)
                    return emitPlain();
                }
            }
            // special case call to super
            if (funcExpr.kind == SK.SuperKeyword) {
                let baseCtor = proc.classInfo.baseClassInfo.ctor
                for (let p = proc.classInfo.baseClassInfo; p && !baseCtor; p = p.baseClassInfo)
                    baseCtor = p.ctor
                if (!baseCtor && bin.finalPass)
                    throw userError(9280, lf("super() call requires an explicit constructor in base class"))
                let ctorArgs = args.map((x) => emitExpr(x))
                ctorArgs.unshift(emitThis(funcExpr))
                return mkProcCallCore(baseCtor, ctorArgs)
            }

            if (hasRecv) {
                U.assert(!isStatic(decl))
                if (recv) {
                    args.unshift(recv)
                } else {
                    unhandled(node, lf("strange method call"), 9241)
                }
                if (!decl) {
                    // TODO in VT accessor/field/method -> different
                    U.assert(funcExpr.kind == SK.PropertyAccessExpression);
                    const fieldName = (funcExpr as PropertyAccessExpression).name.text
                    // completely dynamic dispatch
                    return mkMethodCall(args.map((x) => emitExpr(x)), {
                        ifaceIndex: getIfaceMemberId(fieldName, true),
                        noArgs
                    })
                }
                let info = getFunctionInfo(decl)
                if (info.parentClassInfo)
                    markVTableUsed(info.parentClassInfo)
                markFunctionUsed(decl)

                if (recv.kind == SK.SuperKeyword)
                    return emitPlain()

                const needsVCall = !!info.virtualParent
                const forceIfaceCall = !!isStackMachine() || !!target.switches.slowMethods

                if (needsVCall && !forceIfaceCall) {
                    if (decl.kind == SK.MethodDeclaration) {
                        U.assert(!noArgs)
                    } else if (decl.kind == SK.GetAccessor || decl.kind == SK.SetAccessor) {
                        U.assert(noArgs)
                    } else {
                        U.assert(false)
                    }

                    U.assert(!bin.finalPass || info.virtualIndex != null, "!bin.finalPass || info.virtualIndex != null")
                    return mkMethodCall(args.map((x) => emitExpr(x)), {
                        classInfo: info.parentClassInfo,
                        virtualIndex: info.virtualIndex,
                        noArgs,
                        isThis: args[0].kind == SK.ThisKeyword
                    })
                }

                if (attrs.shim && !hasShimDummy(decl)) {
                    return emitShim(decl, node, args);
                } else if (attrs.helper) {
                    let syms = checker.getSymbolsInScope(node, SymbolFlags.Module)
                    let helperStmt: Statement
                    for (let sym of syms) {
                        if (sym.name == "helpers") {
                            for (let d of sym.declarations || [sym.valueDeclaration]) {
                                if (d.kind == SK.ModuleDeclaration) {
                                    for (let stmt of ((d as ModuleDeclaration).body as ModuleBlock).statements) {
                                        if (stmt.symbol.name == attrs.helper) {
                                            helperStmt = stmt
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (!helperStmt)
                        userError(9215, lf("helpers.{0} not found", attrs.helper))
                    if (helperStmt.kind != SK.FunctionDeclaration)
                        userError(9216, lf("helpers.{0} isn't a function", attrs.helper))
                    decl = <FunctionDeclaration>helperStmt;
                    markFunctionUsed(decl)
                    return emitPlain();
                } else if (needsVCall || target.switches.slowMethods || !forceMethod) {
                    return mkMethodCall(args.map((x) => emitExpr(x)), {
                        ifaceIndex: getIfaceMemberId(getName(decl), true),
                        isSet: noArgs && args.length == 2,
                        noArgs
                    })
                } else {
                    U.assert(decl.kind != SK.MethodSignature)
                    return emitPlain();
                }
            }

            if (decl && decl.kind == SK.ModuleDeclaration) {
                if (getName(decl) == "String")
                    userError(9219, lf("to convert X to string use: X + \"\""))
                else
                    userError(9220, lf("namespaces cannot be called directly"))
            }

            // here's where we will recurse to generate funcExpr
            args.unshift(funcExpr)

            U.assert(!noArgs)
            return mkMethodCall(args.map(x => emitExpr(x)), { virtualIndex: -1, noArgs })
        }

        function mkProcCallCore(proc: ir.Procedure, args: ir.Expr[]) {
            U.assert(!bin.finalPass || !!proc)
            let data: ir.ProcId = {
                proc: proc,
                virtualIndex: null,
                ifaceIndex: null
            }
            return ir.op(EK.ProcCall, args, data)
        }

        function mkMethodCall(args: ir.Expr[], info: ir.ProcId) {
            return ir.op(EK.ProcCall, args, info)
        }

        function lookupProc(decl: ts.Declaration) {
            return pxtInfo(decl).proc
        }

        function mkProcCall(decl: ts.Declaration, args: ir.Expr[]) {
            const proc = lookupProc(decl)
            if (decl.kind == SK.FunctionDeclaration) {
                const info = getFunctionInfo(decl as FunctionDeclaration)
                markUsageOrder(info)
            }
            assert(!!proc || !bin.finalPass, "!!proc || !bin.finalPass")
            return mkProcCallCore(proc, args)
        }

        function layOutGlobals() {
            let globals = bin.globals.slice(0)
            // stable-sort globals, with smallest first, because "strh/b" have
            // smaller immediate range than plain "str" (and same for "ldr")
            // All the pointers go at the end, for GC
            globals.forEach((g, i) => g.index = i)
            const sz = (b: BitSize) => b == BitSize.None ? 10 : sizeOfBitSize(b)
            globals.sort((a, b) =>
                sz(a.bitSize) - sz(b.bitSize) ||
                a.index - b.index)
            let currOff = numReservedGlobals * 4
            let firstPointer = 0
            for (let g of globals) {
                let sz = sizeOfBitSize(g.bitSize)
                while (currOff & (sz - 1))
                    currOff++ // align
                if (!firstPointer && g.bitSize == BitSize.None)
                    firstPointer = currOff
                g.index = currOff
                currOff += sz
            }
            bin.globalsWords = (currOff + 3) >> 2
            bin.nonPtrGlobals = firstPointer ? (firstPointer >> 2) : bin.globalsWords
        }

        function emitVTables() {
            for (let info of bin.usedClassInfos) {
                getVTable(info) // gets cached
            }

            let keys = Object.keys(bin.ifaceMemberMap)
            keys.sort(U.strcmp)
            keys.unshift("") // make sure idx=0 is invalid
            bin.emitString("")
            bin.ifaceMembers = keys
            bin.ifaceMemberMap = {}
            let idx = 0
            for (let k of keys) {
                bin.ifaceMemberMap[k] = idx++
            }

            for (let info of bin.usedClassInfos) {
                for (let e of info.itable) {
                    e.idx = getIfaceMemberId(e.name)
                }
            }

            for (let info of bin.usedClassInfos) {
                info.lastSubtypeNo = undefined
                info.classNo = undefined
            }

            let classNo = pxt.BuiltInType.User0
            const numberClasses = (i: ClassInfo) => {
                U.assert(!i.classNo)
                i.classNo = classNo++
                for (let subt of i.derivedClasses)
                    if (subt.isUsed)
                        numberClasses(subt)
                i.lastSubtypeNo = classNo - 1
            }
            for (let info of bin.usedClassInfos) {
                let par = info
                while (par.baseClassInfo)
                    par = par.baseClassInfo
                if (!par.classNo)
                    numberClasses(par)
            }
        }

        function getCtor(decl: ClassDeclaration) {
            return decl.members.filter(m => m.kind == SK.Constructor)[0] as ConstructorDeclaration
        }

        function isIfaceMemberUsed(name: string) {
            return U.lookup(bin.explicitlyUsedIfaceMembers, name) != null
        }

        function markVTableUsed(info: ClassInfo) {
            recordUsage(info.decl)
            if (info.isUsed) return
            const pinfo = pxtInfo(info.decl)
            pinfo.flags |= PxtNodeFlags.IsUsed
            if (info.baseClassInfo) markVTableUsed(info.baseClassInfo)
            bin.usedClassInfos.push(info)
        }

        function emitNewExpression(node: NewExpression) {
            let t = checker.getTypeAtLocation(node);
            if (t && isArrayType(t)) {
                throw oops();
            } else if (t && isPossiblyGenericClassType(t)) {
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

                markVTableUsed(info)

                let lbl = info.id + "_VT"
                let obj = ir.rtcall("pxt::mkClassInstance", [ir.ptrlit(lbl, lbl)])

                if (ctor) {
                    obj = sharedDef(obj)
                    markUsed(ctor)
                    // arguments undefined on .ctor with optional args
                    let args = (node.arguments || []).slice(0)
                    let ctorAttrs = parseComments(ctor)

                    // unused?
                    // let sig = checker.getResolvedSignature(node)
                    // TODO: can we have overloeads?
                    addDefaultParametersAndTypeCheck(checker.getResolvedSignature(node), args, ctorAttrs)
                    let compiled = args.map((x) => emitExpr(x))
                    if (ctorAttrs.shim) {
                        // TODO need to deal with refMask and tagged ints here
                        // we drop 'obj' variable
                        return ir.rtcall(ctorAttrs.shim, compiled)
                    }
                    compiled.unshift(obj)
                    proc.emitExpr(mkProcCall(ctor, compiled))
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
        /* Requires the following to be declared in global scope:
            //% shim=@hex
            function hex(lits: any, ...args: any[]): Buffer { return null }
        */
        function emitTaggedTemplateExpression(node: TaggedTemplateExpression): ir.Expr {
            function isHexDigit(c: string) {
                return /^[0-9a-f]$/i.test(c)
            }
            function f4PreProcess(s: string) {
                if (!Array.isArray(attrs.groups))
                    throw unhandled(node, lf("missing groups in @f4 literal"), 9272)
                let matrix: number[][] = []
                let line: number[] = []
                let tbl: pxt.Map<number> = {}
                let maxLen = 0
                attrs.groups.forEach((str, n) => {
                    for (let c of str) tbl[c] = n
                })
                s += "\n"
                for (let i = 0; i < s.length; ++i) {
                    let c = s[i]
                    switch (c) {
                        case ' ':
                        case '\t':
                            break
                        case '\n':
                            if (line.length > 0) {
                                matrix.push(line)
                                maxLen = Math.max(line.length, maxLen)
                                line = []
                            }
                            break
                        default:
                            let v = U.lookup(tbl, c)
                            if (v == null) {
                                if (attrs.groups.length == 2)
                                    v = 1 // default anything non-zero to one
                                else
                                    throw unhandled(node, lf("invalid character in image literal: '{0}'", v), 9273)
                            }
                            line.push(v)
                            break
                    }
                }

                let bpp = 8
                if (attrs.groups.length <= 2) {
                    bpp = 1
                } else if (attrs.groups.length <= 16) {
                    bpp = 4
                }
                return f4EncodeImg(maxLen, matrix.length, bpp, (x, y) => matrix[y][x] || 0)
            }

            function parseHexLiteral(node: Node, s: string) {
                let thisJres = currJres
                if (s[0] == '_' && s[1] == '_' && opts.jres[s]) {
                    thisJres = opts.jres[s]
                    s = ""
                }
                if (s == "" && thisJres) {
                    let fontMatch = /font\/x-mkcd-b(\d+)/.exec(thisJres.mimeType)
                    if (fontMatch) {
                        if (!bin.finalPass) {
                            s = "aabbccdd"
                        } else {
                            let chsz = parseInt(fontMatch[1])
                            let data = atob(thisJres.data)
                            let mask = bin.usedChars
                            let buf = ""
                            let incl = ""
                            for (let pos = 0; pos < data.length; pos += chsz) {
                                let charcode = data.charCodeAt(pos) + (data.charCodeAt(pos + 1) << 8)
                                if (charcode < 128 || (mask[charcode >> 5] & (1 << (charcode & 31)))) {
                                    buf += data.slice(pos, pos + chsz)
                                    incl += charcode + ", "
                                }
                            }
                            s = U.toHex(U.stringToUint8Array(buf))
                        }
                    } else if (!thisJres.dataEncoding || thisJres.dataEncoding == "base64") {
                        s = U.toHex(U.stringToUint8Array(ts.pxtc.decodeBase64(thisJres.data)))
                    } else if (thisJres.dataEncoding == "hex") {
                        s = thisJres.data
                    } else {
                        userError(9271, lf("invalid jres encoding '{0}' on '{1}'",
                            thisJres.dataEncoding, thisJres.id))
                    }
                }
                if (/^e[14]/i.test(s) && node.parent && node.parent.kind == SK.CallExpression &&
                    (node.parent as CallExpression).expression.getText() == "image.ofBuffer") {
                    const m = /^e([14])(..)(..)..(.*)/i.exec(s)
                    s = `870${m[1]}${m[2]}00${m[3]}000000${m[4]}`
                }
                let res = ""
                for (let i = 0; i < s.length; ++i) {
                    let c = s[i]
                    if (isHexDigit(c)) {
                        if (isHexDigit(s[i + 1])) {
                            res += c + s[i + 1]
                            i++
                        }
                    } else if (/^[\s\.]$/.test(c))
                        continue
                    else
                        throw unhandled(node, lf("invalid character in hex literal '{0}'", c), 9265)
                }
                if (target.isNative) {
                    const lbl = bin.emitHexLiteral(res.toLowerCase())
                    return ir.ptrlit(lbl, lbl)
                } else {
                    const lbl = "_hex" + nodeKey(node)
                    return ir.ptrlit(lbl, { hexlit: res.toLowerCase() } as any)
                }
            }
            let decl = getDecl(node.tag) as FunctionLikeDeclaration
            if (!decl)
                throw unhandled(node, lf("invalid tagged template"), 9265)
            let attrs = parseComments(decl)
            let res: ir.Expr

            let callInfo: CallInfo = {
                decl,
                qName: decl ? getNodeFullName(checker, decl) : "?",
                args: [node.template],
                isExpression: true
            };
            pxtInfo(node).callInfo = callInfo;

            function handleHexLike(pp: (s: string) => string) {
                if (node.template.kind != SK.NoSubstitutionTemplateLiteral)
                    throw unhandled(node, lf("substitution not supported in hex literal", attrs.shim), 9265);
                res = parseHexLiteral(node, pp((node.template as ts.LiteralExpression).text))
            }

            switch (attrs.shim) {
                case "@hex":
                    handleHexLike(s => s)
                    break
                case "@f4":
                    handleHexLike(f4PreProcess)
                    break
                default:
                    throw unhandled(node, lf("invalid shim '{0}' on tagged template", attrs.shim), 9265)
            }
            if (attrs.helper) {
                res = ir.rtcall(attrs.helper, [res])
            }
            return res
        }
        function emitTypeAssertion(node: TypeAssertion) {
            typeCheckSubtoSup(node.expression, node)
            return emitExpr(node.expression)
        }
        function emitAsExpression(node: AsExpression) {
            typeCheckSubtoSup(node.expression, node)
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
            let lbl = getFunctionLabel(node)
            return ir.ptrlit(lbl + "_Lit", lbl)
        }

        function flushWorkQueue() {
            proc = lookupProc(rootFunction)
            // we emit everything that's left, but only at top level
            // to avoid unbounded stack
            while (usedWorkList.length > 0) {
                let f = usedWorkList.pop()
                emitTopLevel(f)
            }
        }

        function flushHoistedFunctionDefinitions() {
            const curr = pendingFunctionDefinitions
            if (curr.length > 0) {
                pendingFunctionDefinitions = []
                for (let node of curr) {
                    const prevProc = proc;
                    try {
                        emitFuncCore(node);
                    } finally {
                        proc = prevProc;
                    }
                }
            }
        }
        function markVariableDefinition(vi: VariableAddInfo) {
            if (bin.finalPass && vi.functionsToDefine) {
                U.pushRange(pendingFunctionDefinitions, vi.functionsToDefine)
            }
        }

        function emitFuncCore(node: FunctionLikeDeclaration) {
            const info = getFunctionInfo(node)
            let lit: ir.Expr = null

            if (bin.finalPass) {
                if (info.alreadyEmitted) {
                    U.assert(info.usedBeforeDecl)
                    return null
                }
                info.alreadyEmitted = true
            }

            let isExpression = node.kind == SK.ArrowFunction || node.kind == SK.FunctionExpression

            let caps = info.capturedVars.slice(0)
            let locals = caps.map((v, i) => {
                let l = new ir.Cell(i, v, getVarInfo(v))
                l.iscap = true
                return l;
            })

            if (info.usedBeforeDecl === undefined)
                info.usedBeforeDecl = false

            // if no captured variables, then we can get away with a plain pointer to code
            if (caps.length > 0) {
                assert(getEnclosingFunction(node) != null, "getEnclosingFunction(node) != null)")
                lit = ir.shared(ir.rtcall("pxt::mkAction", [ir.numlit(caps.length), emitFunLitCore(node, true)]))
                info.usedAsValue = true
                caps.forEach((l, i) => {
                    let loc = proc.localIndex(l)
                    if (!loc)
                        userError(9223, lf("cannot find captured value: {0}", checker.symbolToString(l.symbol)))
                    let v = loc.loadCore()
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
                    info.usedAsValue = true
                }
            }

            assert(!!lit == isExpression, "!!lit == isExpression")

            let existing = lookupProc(node)

            if (existing) {
                proc = existing
                proc.reset()
            } else {
                assert(!bin.finalPass, "!bin.finalPass")
                const pinfo = pxtInfo(node)
                const myProc = new ir.Procedure()
                myProc.isRoot = !!(pinfo.flags & PxtNodeFlags.IsRootFunction)
                myProc.action = node;
                myProc.info = info;
                pinfo.proc = myProc;
                myProc.usingCtx = currUsingContext;
                proc = myProc
                recordAction(bin => bin.addProc(myProc));
            }

            proc.captured = locals;

            const initalizedFields: PropertyDeclaration[] = []

            if (node.parent.kind == SK.ClassDeclaration) {
                let parClass = node.parent as ClassDeclaration
                let classInfo = getClassInfo(null, parClass)
                if (proc.classInfo)
                    assert(proc.classInfo == classInfo, "proc.classInfo == classInfo")
                else
                    proc.classInfo = classInfo
                if (node.kind == SK.Constructor) {
                    if (classInfo.baseClassInfo) {
                        for (let m of classInfo.baseClassInfo.decl.members) {
                            if (m.kind == SK.Constructor)
                                markFunctionUsed(m as ConstructorDeclaration)
                        }
                    }
                    if (classInfo.ctor)
                        assert(classInfo.ctor == proc, "classInfo.ctor == proc")
                    else
                        classInfo.ctor = proc
                    for (let f of classInfo.allfields) {
                        if (f.kind == SK.PropertyDeclaration && !isStatic(f)) {
                            let fi = f as PropertyDeclaration
                            if (fi.initializer) initalizedFields.push(fi)
                        }
                    }
                }
            }

            const destructuredParameters: ParameterDeclaration[] = []
            const fieldAssignmentParameters: ParameterDeclaration[] = []

            proc.args = getParameters(node).map((p, i) => {
                if (p.name.kind === SK.ObjectBindingPattern) {
                    destructuredParameters.push(p)
                }
                if (node.kind == SK.Constructor && isCtorField(p)) {
                    fieldAssignmentParameters.push(p)
                }
                let l = new ir.Cell(i, p, getVarInfo(p))
                markVariableDefinition(l.info)
                l.isarg = true
                return l
            })

            proc.args.forEach(l => {
                //console.log(l.toString(), l.info)
                if (l.isByRefLocal()) {
                    // TODO add C++ support function to do this
                    let tmp = ir.shared(ir.rtcall("pxtrt::mklocRef", []))
                    proc.emitExpr(ir.rtcall("pxtrt::stlocRef", [tmp, l.loadCore()], 1))
                    proc.emitExpr(l.storeDirect(tmp))
                }
            })

            destructuredParameters.forEach(dp => emitVariableDeclaration(dp))

            // for constructor(public foo:number) generate this.foo = foo;
            for (let p of fieldAssignmentParameters) {
                let idx = fieldIndexCore(proc.classInfo,
                    getFieldInfo(proc.classInfo, getName(p)), false)
                let trg2 = ir.op(EK.FieldAccess, [emitLocalLoad(info.thisParameter)], idx)
                proc.emitExpr(ir.op(EK.Store, [trg2, emitLocalLoad(p)]))
            }

            for (let f of initalizedFields) {
                let idx = fieldIndexCore(proc.classInfo,
                    getFieldInfo(proc.classInfo, getName(f)), false)
                let trg2 = ir.op(EK.FieldAccess, [emitLocalLoad(info.thisParameter)], idx)
                proc.emitExpr(ir.op(EK.Store, [trg2, emitExpr(f.initializer)]))
            }

            flushHoistedFunctionDefinitions()

            if (node.body.kind == SK.Block) {
                emit(node.body);
                if (funcHasReturn(proc.action)) {
                    const last = proc.body[proc.body.length - 1]
                    if (last && last.stmtKind == ir.SK.Jmp && last.jmpMode == ir.JmpMode.Always) {
                        // skip final 'return undefined' as there was 'return something' just above
                    } else {
                        proc.emitJmp(getLabels(node).ret, emitLit(undefined), ir.JmpMode.Always)
                    }
                }
            } else {
                let v = emitExpr(node.body)
                proc.emitJmp(getLabels(node).ret, v, ir.JmpMode.Always)
            }

            proc.emitLblDirect(getLabels(node).ret)

            proc.stackEmpty();

            let lbl = proc.mkLabel("final")
            if (funcHasReturn(proc.action)) {
                // the jmp will take R0 with it as the return value
                proc.emitJmp(lbl)
            } else {
                proc.emitJmp(lbl, emitLit(undefined))
            }
            proc.emitLbl(lbl)

            if (info.capturedVars.length &&
                info.usedBeforeDecl &&
                node.kind == SK.FunctionDeclaration && !bin.finalPass) {
                info.capturedVars.sort((a, b) => b.pos - a.pos)
                const vinfo = getVarInfo(info.capturedVars[0])
                if (!vinfo.functionsToDefine)
                    vinfo.functionsToDefine = []
                vinfo.functionsToDefine.push(node)
            }

            // nothing should be on work list in final pass - everything should be already marked as used
            assert(!bin.finalPass || usedWorkList.length == 0, "!bin.finalPass || usedWorkList.length == 0")

            return lit
        }

        function sharedDef(e: ir.Expr) {
            let v = ir.shared(e)
            // make sure we save it
            proc.emitExpr(v);
            return v
        }

        function captureJmpValue() {
            return sharedDef(ir.op(EK.JmpValue, []))
        }

        function hasShimDummy(node: Declaration) {
            if (opts.target.isNative)
                return false
            let f = node as FunctionLikeDeclaration
            return f.body && (f.body.kind != SK.Block || (f.body as Block).statements.length > 0)
        }

        function emitFunctionDeclaration(node: FunctionLikeDeclaration) {
            if (!shouldEmitNow(node))
                return undefined;

            if (pxtInfo(node).flags & PxtNodeFlags.FromPreviousCompile)
                return undefined;

            let attrs = parseComments(node)
            if (attrs.shim != null) {
                if (attrs.shim[0] == "@")
                    return undefined;
                if (opts.target.isNative) {
                    hexfile.validateShim(getDeclName(node),
                        attrs.shim,
                        attrs,
                        funcHasReturn(node),
                        getParameters(node).map(p => isNumberLikeType(typeOf(p))))
                }
                if (!hasShimDummy(node))
                    return undefined;
            }

            if (ts.isInAmbientContext(node))
                return undefined;

            if (!node.body)
                return undefined;

            let lit: ir.Expr = null

            let prevProc = proc;
            try {
                lit = emitFuncCore(node);
            } finally {
                proc = prevProc;
            }

            return lit
        }

        function emitDeleteExpression(node: DeleteExpression) {
            let objExpr: Expression
            let keyExpr: Expression
            if (node.expression.kind == SK.PropertyAccessExpression) {
                const inner = node.expression as PropertyAccessExpression
                objExpr = inner.expression
                keyExpr = irToNode(emitStringLiteral(inner.name.text))
            } else if (node.expression.kind == SK.ElementAccessExpression) {
                const inner = node.expression as ElementAccessExpression
                objExpr = inner.expression
                keyExpr = inner.argumentExpression
            } else {
                throw userError(9276, lf("expression not supported as argument to 'delete'"))
            }

            // we know these would just fail at runtime
            const objExprType = typeOf(objExpr)
            if (isClassType(objExprType))
                throw userError(9277, lf("'delete' not supported on class types"))
            if (isArrayType(objExprType))
                throw userError(9277, lf("'delete' not supported on array"))

            return rtcallMask("pxtrt::mapDeleteByString", [objExpr, keyExpr], null)
        }
        function emitTypeOfExpression(node: TypeOfExpression) {
            return rtcallMask("pxt::typeOf", [node.expression], null)
        }
        function emitVoidExpression(node: VoidExpression) { }
        function emitAwaitExpression(node: AwaitExpression) { }
        function emitPrefixUnaryExpression(node: PrefixUnaryExpression): ir.Expr {
            const folded = constantFold(node)
            if (folded)
                return emitLit(folded.val)

            switch (node.operator) {
                case SK.ExclamationToken:
                    return fromBool(ir.rtcall("Boolean_::bang", [emitCondition(node.operand)]))
                case SK.PlusPlusToken:
                    return emitIncrement(node.operand, "numops::adds", false)
                case SK.MinusMinusToken:
                    return emitIncrement(node.operand, "numops::subs", false)
                case SK.PlusToken:
                case SK.MinusToken: {
                    let inner = emitExpr(node.operand)
                    let v = valueToInt(inner)
                    if (v != null)
                        return emitLit(-v)
                    if (node.operator == SK.MinusToken)
                        return emitIntOp("numops::subs", emitLit(0), inner)
                    else
                        // force conversion to number
                        return emitIntOp("numops::subs", inner, emitLit(0))
                }
                case SK.TildeToken: {
                    let inner = emitExpr(node.operand)
                    let v = valueToInt(inner)
                    if (v != null)
                        return emitLit(~v)
                    return rtcallMaskDirect(mapIntOpName("numops::bnot"), [inner]);
                }
                default:
                    throw unhandled(node, lf("unsupported prefix unary operation"), 9245)
            }

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
            let r: any = {
                kind: SK.NullKeyword,
                isRefOverride: isRef,
            }
            pxtInfo(r).valueOverride = expr
            return r
        }

        function emitIncrement(trg: Expression, meth: string, isPost: boolean, one: Expression = null) {
            let cleanup = prepForAssignment(trg)
            let oneExpr = one ? emitExpr(one) : emitLit(1)
            let prev = ir.shared(emitExpr(trg))
            let result = ir.shared(emitIntOp(meth, prev, oneExpr))
            emitStore(trg, irToNode(result, true))
            cleanup()
            return isPost ? prev : result
        }

        function emitPostfixUnaryExpression(node: PostfixUnaryExpression): ir.Expr {
            let tp = typeOf(node.operand)

            if (isNumberType(tp)) {
                switch (node.operator) {
                    case SK.PlusPlusToken:
                        return emitIncrement(node.operand, "numops::adds", true)
                    case SK.MinusMinusToken:
                        return emitIncrement(node.operand, "numops::subs", true)
                    default:
                        break
                }
            }
            throw unhandled(node, lf("unsupported postfix unary operation"), 9246)
        }

        function fieldIndexCore(info: ClassInfo, fld: FieldWithAddInfo, needsCheck = true): FieldAccessInfo {
            if (isStatic(fld))
                U.oops("fieldIndex on static field: " + getName(fld))
            let attrs = parseComments(fld)
            let idx = info.allfields.indexOf(fld)
            if (idx < 0 && bin.finalPass)
                U.oops("missing field")
            return {
                idx,
                name: getName(fld),
                isRef: true,
                shimName: attrs.shim,
                classInfo: info,
                needsCheck
            }
        }

        function fieldIndex(pacc: PropertyAccessExpression): FieldAccessInfo {
            const tp = typeOf(pacc.expression)
            if (isPossiblyGenericClassType(tp)) {
                const info = getClassInfo(tp)
                let noCheck = pacc.expression.kind == SK.ThisKeyword
                if (target.switches.noThisCheckOpt)
                    noCheck = false
                return fieldIndexCore(info, getFieldInfo(info, pacc.name.text), !noCheck)
            } else {
                throw unhandled(pacc, lf("bad field access"), 9247)
            }
        }

        function getFieldInfo(info: ClassInfo, fieldName: string) {
            const field = info.allfields.filter(f => (<Identifier>f.name).text == fieldName)[0]
            if (!field) {
                userError(9224, lf("field {0} not found", fieldName))
            }
            return field;
        }

        function emitStore(trg: Expression, src: Expression, checkAssign: boolean = false) {
            if (checkAssign) {
                typeCheckSubtoSup(src, trg)
            }
            let decl = getDecl(trg)
            let isGlobal = isGlobalVar(decl)
            if (trg.kind == SK.Identifier || isGlobal) {
                if (decl && (isGlobal || isVar(decl) || isParameter(decl))) {
                    let l = lookupCell(decl)
                    recordUse(<VarOrParam>decl, true)
                    proc.emitExpr(l.storeByRef(emitExpr(src)))
                } else {
                    unhandled(trg, lf("bad target identifier"), 9248)
                }
            } else if (trg.kind == SK.PropertyAccessExpression) {
                let decl = getDecl(trg)
                if (decl && (decl.kind == SK.GetAccessor || decl.kind == SK.SetAccessor)) {
                    checkGetter(decl)
                    decl = getDeclarationOfKind(decl.symbol, SK.SetAccessor)
                    if (!decl) {
                        unhandled(trg, lf("setter not available"), 9253)
                    }
                    proc.emitExpr(emitCallCore(trg, trg, [src], null, decl as FunctionLikeDeclaration))
                } else if (decl && (decl.kind == SK.PropertySignature || decl.kind == SK.PropertyAssignment || isSlowField(decl))) {
                    proc.emitExpr(emitCallCore(trg, trg, [src], null, decl as FunctionLikeDeclaration))
                } else {
                    let trg2 = emitExpr(trg)
                    proc.emitExpr(ir.op(EK.Store, [trg2, emitExpr(src)]))
                }
            } else if (trg.kind == SK.ElementAccessExpression) {
                proc.emitExpr(emitIndexedAccess(trg as ElementAccessExpression, src))
            } else if (trg.kind == SK.ArrayLiteralExpression) {
                // special-case [a,b,c]=[1,2,3], or more commonly [a,b]=[b,a]
                if (src.kind == SK.ArrayLiteralExpression) {
                    // typechecker enforces that these two have the same length
                    const tmps = (src as ArrayLiteralExpression).elements.map(e => {
                        const ee = ir.shared(emitExpr(e))
                        proc.emitExpr(ee)
                        return ee
                    });
                    (trg as ArrayLiteralExpression).elements.forEach((e, idx) => {
                        emitStore(e, irToNode(tmps[idx]))
                    })
                } else {
                    // unfortunately, this uses completely different syntax tree nodes to the patters in const/let...
                    const bindingExpr = ir.shared(emitExpr(src));
                    (trg as ArrayLiteralExpression).elements.forEach((e, idx) => {
                        emitStore(e, irToNode(rtcallMaskDirect("Array_::getAt", [bindingExpr, ir.numlit(idx)])))
                    })
                }
            } else {
                unhandled(trg, lf("bad assignment target"), 9249)
            }
        }

        function handleAssignment(node: BinaryExpression) {
            let src = node.right
            if (node.parent.kind == SK.ExpressionStatement)
                src = null
            let cleanup = prepForAssignment(node.left, src)
            emitStore(node.left, node.right, true)
            let res = src ? emitExpr(src) : emitLit(undefined)
            cleanup()
            return res
        }

        function mapIntOpName(n: string) {
            if (isThumb()) {
                switch (n) {
                    case "numops::adds":
                    case "numops::subs":
                    case "numops::eors":
                    case "numops::ands":
                    case "numops::orrs":
                        return "@nomask@" + n
                }
            }

            if (isStackMachine()) {
                switch (n) {
                    case "pxt::switch_eq":
                        return "numops::eq"
                }

            }

            return n
        }

        function emitIntOp(op: string, left: ir.Expr, right: ir.Expr) {
            return rtcallMaskDirect(mapIntOpName(op), [left, right])
        }

        interface Folded {
            val: any;
        }

        function unaryOpConst(tok: SyntaxKind, aa: Folded): Folded {
            if (!aa)
                return null
            const a = aa.val
            switch (tok) {
                case SK.PlusToken: return { val: +a }
                case SK.MinusToken: return { val: -a }
                case SK.TildeToken: return { val: ~a }
                case SK.ExclamationToken: return { val: !a }
                default:
                    return null
            }
        }
        function binaryOpConst(tok: SyntaxKind, aa: Folded, bb: Folded): Folded {
            if (!aa || !bb)
                return null
            const a = aa.val
            const b = bb.val
            switch (tok) {
                case SK.PlusToken: return { val: a + b }
                case SK.MinusToken: return { val: a - b }
                case SK.SlashToken: return { val: a / b }
                case SK.PercentToken: return { val: a % b }
                case SK.AsteriskToken: return { val: a * b }
                case SK.AsteriskAsteriskToken: return { val: a ** b }
                case SK.AmpersandToken: return { val: a & b }
                case SK.BarToken: return { val: a | b }
                case SK.CaretToken: return { val: a ^ b }
                case SK.LessThanLessThanToken: return { val: a << b }
                case SK.GreaterThanGreaterThanToken: return { val: a >> b }
                case SK.GreaterThanGreaterThanGreaterThanToken: return { val: a >>> b }
                case SK.LessThanEqualsToken: return { val: a <= b }
                case SK.LessThanToken: return { val: a < b }
                case SK.GreaterThanEqualsToken: return { val: a >= b }
                case SK.GreaterThanToken: return { val: a > b }
                case SK.EqualsEqualsToken: return { val: a == b }
                case SK.EqualsEqualsEqualsToken: return { val: a === b }
                case SK.ExclamationEqualsEqualsToken: return { val: a !== b }
                case SK.ExclamationEqualsToken: return { val: a != b }
                case SK.BarBarToken: return { val: a || b }
                case SK.AmpersandAmpersandToken: return { val: a && b }
                default:
                    return null
            }
        }
        function quickGetQualifiedName(expr: Expression): string {
            if (expr.kind == SK.Identifier) {
                return (expr as Identifier).text
            } else if (expr.kind == SK.PropertyAccessExpression) {
                const pa = expr as PropertyAccessExpression
                const left = quickGetQualifiedName(pa.expression)
                if (left)
                    return left + "." + pa.name.text
            }
            return null
        }

        function fun1Const(expr: Expression, aa: Folded): Folded {
            if (!aa)
                return null
            const a = aa.val
            switch (quickGetQualifiedName(expr)) {
                case "Math.floor": return { val: Math.floor(a) }
                case "Math.ceil": return { val: Math.ceil(a) }
                case "Math.round": return { val: Math.round(a) }
            }
            return null
        }

        function enumValue(decl: EnumMember): string {
            const attrs = parseComments(decl);
            let ev = attrs.enumval
            if (!ev) {
                let val = checker.getConstantValue(decl)
                if (val == null)
                    return null
                ev = val + ""
            }
            if (/^[+-]?\d+$/.test(ev))
                return ev;
            if (/^0x[A-Fa-f\d]{2,8}$/.test(ev))
                return ev;
            U.userError("enumval only support number literals")
            return "0"
        }

        function emitFolded(f: Folded) {
            if (f)
                return emitLit(f.val)
            return null
        }

        function constantFoldDecl(decl: Declaration) {
            if (!decl)
                return null

            const info = pxtInfo(decl)
            if (info.constantFolded !== undefined)
                return info.constantFolded

            if (isVar(decl) && (decl.parent.flags & NodeFlags.Const)) {
                const vardecl = decl as VariableDeclaration
                if (vardecl.initializer)
                    info.constantFolded = constantFold(vardecl.initializer)
            } else if (decl.kind == SK.EnumMember) {
                const en = decl as EnumMember
                const ev = enumValue(en)
                if (ev == null) {
                    info.constantFolded = constantFold(en.initializer)
                } else {
                    const v = parseInt(ev)
                    if (!isNaN(v))
                        info.constantFolded = { val: v }
                }
            } else if (decl.kind == SK.PropertyDeclaration && isStatic(decl) && isReadOnly(decl)) {
                const pd = decl as PropertyDeclaration
                info.constantFolded = constantFold(pd.initializer)
            }

            //if (info.constantFolded)
            //    console.log(getDeclName(decl), getSourceFileOfNode(decl).fileName, info.constantFolded.val)

            return info.constantFolded
        }

        function constantFold(e: Expression): Folded {
            if (!e)
                return null
            const info = pxtInfo(e)
            if (info.constantFolded === undefined) {
                info.constantFolded = null // make sure we don't come back here recursively
                const res = constantFoldCore(e)
                info.constantFolded = res
            }
            return info.constantFolded
        }

        function constantFoldCore(e: Expression): Folded {
            if (!e)
                return null
            switch (e.kind) {
                case SK.PrefixUnaryExpression: {
                    const expr = e as PrefixUnaryExpression
                    const inner = constantFold(expr.operand)
                    return unaryOpConst(expr.operator, inner)
                }
                case SK.BinaryExpression: {
                    const expr = e as BinaryExpression
                    const left = constantFold(expr.left)
                    if (!left) return null
                    const right = constantFold(expr.right)
                    if (!right) return null
                    return binaryOpConst(expr.operatorToken.kind, left, right)
                }
                case SK.NumericLiteral: {
                    const expr = e as NumericLiteral
                    const v = parseFloat(expr.text)
                    if (isNaN(v))
                        return null
                    return { val: v }
                }
                case SK.NullKeyword:
                    return { val: null }
                case SK.TrueKeyword:
                    return { val: true }
                case SK.FalseKeyword:
                    return { val: false }
                case SK.UndefinedKeyword:
                    return { val: undefined }
                case SK.CallExpression: {
                    const expr = e as CallExpression
                    if (expr.arguments.length == 1)
                        return fun1Const(expr.expression, constantFold(expr.arguments[0]))
                    return null
                }
                case SK.PropertyAccessExpression:
                case SK.Identifier:
                    // regular getDecl() will mark symbols as used
                    // if we succeed, we will not use any symbols, so no rason to mark them
                    return constantFoldDecl(getDeclCore(e))
                case SK.AsExpression:
                    return constantFold((e as AsExpression).expression)
                default:
                    return null
            }
        }

        function emitAsInt(e: Expression) {
            let prev = target.switches.boxDebug
            let expr: ir.Expr = null
            if (prev) {
                try {
                    target.switches.boxDebug = false
                    expr = emitExpr(e)
                } finally {
                    target.switches.boxDebug = prev
                }
            } else {
                expr = emitExpr(e)
            }
            let v = valueToInt(expr)
            if (v === undefined)
                throw userError(9267, lf("a constant number-like expression is required here"))
            return v
        }

        function lookupConfigConst(ctx: Node, name: string) {
            let r = lookupConfigConstCore(ctx, name, "userconfig")
            if (r == null)
                r = lookupConfigConstCore(ctx, name, "config")
            return r
        }

        function lookupConfigConstCore(ctx: Node, name: string, mod: string) {
            let syms = checker.getSymbolsInScope(ctx, SymbolFlags.Module)
            let configMod = syms.filter(s => s.name == mod && !!s.valueDeclaration)[0]
            if (!configMod)
                return null
            for (let stmt of ((configMod.valueDeclaration as ModuleDeclaration).body as ModuleBlock).statements) {
                if (stmt.kind == SK.VariableStatement) {
                    let v = stmt as VariableStatement
                    for (let d of v.declarationList.declarations) {
                        if (d.symbol.name == name) {
                            return emitAsInt(d.initializer)
                        }
                    }
                }
            }
            return null
        }

        function lookupDalConst(ctx: Node, name: string) {
            let syms = checker.getSymbolsInScope(ctx, SymbolFlags.Enum)
            let dalEnm = syms.filter(s => s.name == "DAL" && !!s.valueDeclaration)[0]
            if (!dalEnm)
                return null
            let decl = (dalEnm.valueDeclaration as EnumDeclaration).members
                .filter(s => s.symbol.name == name)[0]
            if (decl)
                return checker.getConstantValue(decl)
            return null
        }

        function valueToInt(e: ir.Expr): number {
            if (e.exprKind == ir.EK.NumberLiteral) {
                let v = e.data
                if (opts.target.isNative && !isStackMachine()) {
                    if (v == taggedNull || v == taggedUndefined || v == taggedFalse)
                        return 0
                    if (v == taggedTrue)
                        return 1
                    if (typeof v == "number")
                        return v >> 1
                } else {
                    if (typeof v == "number")
                        return v
                }
            } else if (e.exprKind == ir.EK.RuntimeCall && e.args.length == 2) {
                let v0 = valueToInt(e.args[0])
                let v1 = valueToInt(e.args[1])
                if (v0 === undefined || v1 === undefined)
                    return undefined
                switch (e.data) {
                    case "numops::orrs":
                        return v0 | v1;
                    case "numops::adds":
                        return v0 + v1;
                    default:
                        console.log(e)
                        return undefined;
                }
            }
            return undefined
        }

        function emitLit(v: number | boolean) {
            if (opts.target.isNative && !isStackMachine()) {
                const numlit = taggedSpecial(v)
                if (numlit != null) return ir.numlit(numlit)
                else if (typeof v == "number") {
                    if (fitsTaggedInt(v as number)) {
                        return ir.numlit(((v as number) << 1) | 1)
                    } else {
                        let lbl = bin.emitDouble(v as number)
                        return ir.ptrlit(lbl, JSON.stringify(v))
                    }
                } else {
                    throw U.oops("bad literal: " + v)
                }
            } else {
                return ir.numlit(v)
            }
        }

        function isNumberLike(e: Expression) {
            if (e.kind == SK.NullKeyword) {
                let vo: ir.Expr = pxtInfo(e).valueOverride
                if (vo != null) {
                    if (vo.exprKind == EK.NumberLiteral) {
                        if (opts.target.isNative)
                            return !!((vo.data as number) & 1)
                        return true
                    } else if (vo.exprKind == EK.RuntimeCall && vo.data == "pxt::ptrOfLiteral") {
                        if (vo.args[0].exprKind == EK.PointerLiteral &&
                            !isNaN(parseFloat(vo.args[0].jsInfo as string)))
                            return true
                        return false
                    } else if (vo.exprKind == EK.PointerLiteral &&
                        !isNaN(parseFloat(vo.jsInfo as string))) {
                        return true
                    } else
                        return false
                }
            }
            if (e.kind == SK.NumericLiteral)
                return true
            return isNumberLikeType(typeOf(e))
        }

        function rtcallMaskDirect(name: string, args: ir.Expr[]) {
            return ir.rtcallMask(name, (1 << args.length) - 1, ir.CallingConvention.Plain, args)
        }

        function rtcallMask(name: string, args: Expression[], attrs: CommentAttrs, append: Expression[] = null) {
            let fmt: string[] = []
            let inf = hexfile.lookupFunc(name)

            if (isThumb()) {
                let inf2 = U.lookup(thumbFuns, name)
                if (inf2) {
                    inf = inf2
                    name = inf2.name
                }
            }

            if (inf) fmt = inf.argsFmt
            if (append) args = args.concat(append)

            let mask = getMask(args)
            let convInfos: ir.ConvInfo[] = []

            let args2 = args.map((a, i) => {
                let r = emitExpr(a)
                if (!needsNumberConversions())
                    return r
                let f = fmt[i + 1]
                let isNumber = isNumberLike(a)

                if (!f && name.indexOf("::") < 0) {
                    // for assembly functions, make up the format string - pass numbers as ints and everything else as is
                    f = isNumber ? "I" : "_"
                }
                if (!f) {
                    throw U.userError("not enough args for " + name)
                } else if (f[0] == "_" || f == "T" || f == "N") {
                    let t = getRefTagToValidate(f)
                    if (t) {
                        convInfos.push({
                            argIdx: i,
                            method: "_validate",
                            refTag: t,
                            refTagNullable: !!attrs.argsNullable
                        })
                    }
                    return r
                } else if (f == "I") {
                    //toInt can handle non-number values as well
                    //if (!isNumber)
                    //    U.userError("argsFmt=...I... but argument not a number in " + name)
                    if (r.exprKind == EK.NumberLiteral && typeof r.data == "number") {
                        return ir.numlit(r.data >> 1)
                    }
                    // mask &= ~(1 << i)
                    convInfos.push({
                        argIdx: i,
                        method: "pxt::toInt"
                    })

                    return r
                } else if (f == "B") {
                    mask &= ~(1 << i)
                    return emitCondition(a, r)
                } else if (f == "S") {
                    if (!r.isStringLiteral) {
                        convInfos.push({
                            argIdx: i,
                            method: "_pxt_stringConv",
                            returnsRef: true
                        })
                        // set the mask - the result of conversion is a ref
                        mask |= (1 << i)
                    }
                    return r
                } else if (f == "F" || f == "D") {
                    if (f == "D")
                        U.oops("double arguments not yet supported") // take two words
                    // TODO disable F on devices with FPU and hard ABI; or maybe altogether
                    // or else, think about using the VFP registers
                    if (!isNumber)
                        U.userError("argsFmt=...F/D... but argument not a number in " + name)
                    // mask &= ~(1 << i)
                    convInfos.push({ argIdx: i, method: f == "D" ? "pxt::toDouble" : "pxt::toFloat" })
                    return r
                } else {
                    throw U.oops("invalid format specifier: " + f)
                }
            })
            let r = ir.rtcallMask(name, mask,
                attrs ? attrs.callingConvention : ir.CallingConvention.Plain, args2)
            if (!r.mask) r.mask = { refMask: 0 }
            r.mask.conversions = convInfos
            if (opts.target.isNative) {
                let f0 = fmt[0]
                if (f0 == "I")
                    r = fromInt(r)
                else if (f0 == "B")
                    r = fromBool(r)
                else if (f0 == "F")
                    r = fromFloat(r)
                else if (f0 == "D") {
                    U.oops("double returns not yet supported") // take two words
                    r = fromDouble(r)
                }
            }
            return r
        }

        function emitInJmpValue(expr: ir.Expr) {
            let lbl = proc.mkLabel("ldjmp")
            proc.emitJmp(lbl, expr, ir.JmpMode.Always)
            proc.emitLbl(lbl)
        }

        function emitInstanceOfExpression(node: BinaryExpression) {
            let tp = typeOf(node.right)
            let classDecl = isPossiblyGenericClassType(tp) ? <ClassDeclaration>getDecl(node.right) : null
            if (!classDecl || classDecl.kind != SK.ClassDeclaration) {
                userError(9275, lf("unsupported instanceof expression"))
            }
            let info = getClassInfo(tp, classDecl)
            markVTableUsed(info)
            let r = ir.op(ir.EK.InstanceOf, [emitExpr(node.left)], info)
            r.jsInfo = "bool"
            return r
        }

        function emitLazyBinaryExpression(node: BinaryExpression) {
            let left = emitExpr(node.left)
            let isString = isStringType(typeOf(node.left));
            let lbl = proc.mkLabel("lazy")

            left = ir.shared(left)
            let cond = ir.rtcall("numops::toBool", [left])
            let lblSkip = proc.mkLabel("lazySkip")
            let mode: ir.JmpMode =
                node.operatorToken.kind == SK.BarBarToken ? ir.JmpMode.IfZero :
                    node.operatorToken.kind == SK.AmpersandAmpersandToken ? ir.JmpMode.IfNotZero :
                        U.oops() as any

            proc.emitJmp(lblSkip, cond, mode)
            proc.emitJmp(lbl, left, ir.JmpMode.Always, left)
            proc.emitLbl(lblSkip)
            proc.emitExpr(rtcallMaskDirect("langsupp::ignore", [left]))

            proc.emitJmp(lbl, emitExpr(node.right), ir.JmpMode.Always)
            proc.emitLbl(lbl)
            return captureJmpValue()
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
            bin.numStmts++
            if (!opts.breakpoints)
                return
            let src = getSourceFileOfNode(node)
            if (opts.justMyCode && isInPxtModules(src))
                return;
            let pos = node.pos
            while (/^\s$/.exec(src.text[pos]))
                pos++;
            let p = ts.getLineAndCharacterOfPosition(src, pos)
            let e = ts.getLineAndCharacterOfPosition(src, node.end);
            let brk: Breakpoint = {
                id: res.breakpoints.length,
                isDebuggerStmt: node.kind == SK.DebuggerStatement,
                fileName: src.fileName,
                start: pos,
                length: node.end - pos,
                line: p.line,
                endLine: e.line,
                column: p.character,
                endColumn: e.character,
            }
            res.breakpoints.push(brk)
            let st = ir.stmt(ir.SK.Breakpoint, null)
            st.breakpointInfo = brk
            proc.emit(st)
        }

        function simpleInstruction(node: Node, k: SyntaxKind) {
            switch (k) {
                case SK.PlusToken: return "numops::adds";
                case SK.MinusToken: return "numops::subs";
                // we could expose __aeabi_idiv directly...
                case SK.SlashToken: return "numops::div";
                case SK.PercentToken: return "numops::mod";
                case SK.AsteriskToken: return "numops::muls";
                case SK.AsteriskAsteriskToken: return "Math_::pow";
                case SK.AmpersandToken: return "numops::ands";
                case SK.BarToken: return "numops::orrs";
                case SK.CaretToken: return "numops::eors";
                case SK.LessThanLessThanToken: return "numops::lsls";
                case SK.GreaterThanGreaterThanToken: return "numops::asrs"
                case SK.GreaterThanGreaterThanGreaterThanToken: return "numops::lsrs"
                case SK.LessThanEqualsToken: return "numops::le";
                case SK.LessThanToken: return "numops::lt";
                case SK.GreaterThanEqualsToken: return "numops::ge";
                case SK.GreaterThanToken: return "numops::gt";
                case SK.EqualsEqualsToken: return "numops::eq";
                case SK.EqualsEqualsEqualsToken: return "numops::eqq";
                case SK.ExclamationEqualsEqualsToken: return "numops::neqq";
                case SK.ExclamationEqualsToken: return "numops::neq";

                default: return null;
            }

        }

        function emitBinaryExpression(node: BinaryExpression): ir.Expr {
            if (node.operatorToken.kind == SK.EqualsToken) {
                return handleAssignment(node);
            }

            const folded = constantFold(node)
            if (folded)
                return emitLit(folded.val)

            let lt: Type = null
            let rt: Type = null

            if (node.operatorToken.kind == SK.PlusToken || node.operatorToken.kind == SK.PlusEqualsToken) {
                lt = typeOf(node.left)
                rt = typeOf(node.right)
                if (isStringType(lt) || (isStringType(rt) && node.operatorToken.kind == SK.PlusToken)) {
                    pxtInfo(node).exprInfo = {
                        leftType: checker.typeToString(lt),
                        rightType: checker.typeToString(rt)
                    }
                }
            }

            let shim = (n: string) => {
                n = mapIntOpName(n)
                let args = [node.left, node.right]
                return ir.rtcallMask(n, getMask(args), ir.CallingConvention.Plain, args.map(x => emitExpr(x)))
            }

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
                case SK.InstanceOfKeyword:
                    return emitInstanceOfExpression(node);
            }

            if (node.operatorToken.kind == SK.PlusToken) {
                if (isStringType(lt) || isStringType(rt)) {
                    return rtcallMask("String_::concat", [asString(node.left), asString(node.right)], null)
                }
            }

            if (node.operatorToken.kind == SK.PlusEqualsToken && isStringType(lt)) {
                let cleanup = prepForAssignment(node.left)
                let post = ir.shared(rtcallMask("String_::concat", [asString(node.left), asString(node.right)], null))
                emitStore(node.left, irToNode(post))
                cleanup();
                return post
            }

            // fallback to numeric operation if none of the argument is string and some are numbers
            let noEq = stripEquals(node.operatorToken.kind)
            let shimName = simpleInstruction(node, noEq || node.operatorToken.kind)
            if (!shimName)
                unhandled(node.operatorToken, lf("unsupported operator"), 9250)
            if (noEq)
                return emitIncrement(node.left, shimName, false, node.right)
            return shim(shimName)
        }

        function emitConditionalExpression(node: ConditionalExpression) {
            let els = proc.mkLabel("condexprz")
            let fin = proc.mkLabel("condexprfin")
            proc.emitJmp(els, emitCondition(node.condition), ir.JmpMode.IfZero)
            proc.emitJmp(fin, emitExpr(node.whenTrue), ir.JmpMode.Always)
            proc.emitLbl(els)
            proc.emitJmp(fin, emitExpr(node.whenFalse), ir.JmpMode.Always)
            proc.emitLbl(fin)

            return captureJmpValue()
        }

        function emitSpreadElementExpression(node: SpreadElement) { }
        function emitYieldExpression(node: YieldExpression) { }
        function emitBlock(node: Block) {
            node.statements.forEach(emit)
        }
        function checkForLetOrConst(declList: VariableDeclarationList): boolean {
            if ((declList.flags & NodeFlags.Let) || (declList.flags & NodeFlags.Const)) {
                return true;
            }
            throw userError(9260, lf("variable needs to be defined using 'let' instead of 'var'"));
        }
        function emitVariableStatement(node: VariableStatement) {
            function addConfigEntry(ent: ConfigEntry) {
                let entry = U.lookup(configEntries, ent.name)
                if (!entry) {
                    entry = ent
                    configEntries[ent.name] = entry
                }
                if (entry.value != ent.value)
                    throw userError(9269, lf("conflicting values for config.{0}", ent.name))
            }

            if (node.declarationList.flags & NodeFlags.Const) {
                let parname = node.parent && node.parent.kind == SK.ModuleBlock ?
                    getName(node.parent.parent) : "?"
                if (parname == "config" || parname == "userconfig")
                    for (let decl of node.declarationList.declarations) {
                        let nm = getDeclName(decl)

                        if (!decl.initializer) continue
                        let val = emitAsInt(decl.initializer)
                        let key = lookupDalConst(node, "CFG_" + nm) as number
                        if (key == null || key == 0) // key cannot be 0
                            throw userError(9268, lf("can't find DAL.CFG_{0}", nm))
                        if (parname == "userconfig")
                            nm = "!" + nm
                        addConfigEntry({ name: nm, key: key, value: val })
                    }
            }

            if (ts.isInAmbientContext(node))
                return;
            checkForLetOrConst(node.declarationList);
            node.declarationList.declarations.forEach(emit);
        }
        function emitExpressionStatement(node: ExpressionStatement) {
            emitExprAsStmt(node.expression)
        }
        function emitCondition(expr: Expression, inner: ir.Expr = null) {
            if (!inner && isThumb() && expr.kind == SK.BinaryExpression) {
                let be = expr as BinaryExpression
                let mapped = U.lookup(thumbCmpMap, simpleInstruction(be, be.operatorToken.kind))
                if (mapped) {
                    return ir.rtcall(mapped, [emitExpr(be.left), emitExpr(be.right)])
                }
            }
            if (!inner)
                inner = emitExpr(expr)
            if (isStackMachine())
                return inner
            return ir.rtcall("numops::toBoolDecr", [inner])
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
            emitBrk(node.expression);
            proc.emitJmpZ(l.brk, emitCondition(node.expression));
            proc.emitJmp(l.cont);
            proc.emitLblDirect(l.brk);
        }

        function emitWhileStatement(node: WhileStatement) {
            emitBrk(node)
            let l = getLabels(node)
            proc.emitLblDirect(l.cont);
            emitBrk(node.expression);
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
            if (node.initializer && node.initializer.kind == SK.VariableDeclarationList) {
                checkForLetOrConst(<VariableDeclarationList>node.initializer);
                (<VariableDeclarationList>node.initializer).declarations.forEach(emit);
            }
            else {
                emitExprAsStmt(<Expression>node.initializer);
            }
            emitBrk(node)
            let l = getLabels(node)
            proc.emitLblDirect(l.fortop);
            if (node.condition) {
                emitBrk(node.condition);
                proc.emitJmpZ(l.brk, emitCondition(node.condition));
            }
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
            checkForLetOrConst(declList);

            //Typecheck the expression being iterated over
            let t = typeOf(node.expression)

            let indexer = ""
            let length = ""
            if (isStringType(t)) {
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
            const iterVar = emitVariableDeclaration(declList.declarations[0]) // c
            U.assert(!!iterVar || !bin.finalPass)
            proc.stackEmpty()

            // Store the expression (it could be a string literal, for example) for the collection being iterated over
            // Note that it's alaways a ref-counted type
            let collectionVar = proc.mkLocalUnnamed(); // a
            proc.emitExpr(collectionVar.storeByRef(emitExpr(node.expression)))

            // Declaration of iterating variable
            let intVarIter = proc.mkLocalUnnamed(); // i
            proc.emitExpr(intVarIter.storeByRef(emitLit(0)))
            proc.stackEmpty();

            emitBrk(node);

            let l = getLabels(node);

            proc.emitLblDirect(l.fortop);
            // i < a.length()
            // we use loadCore() on collection variable so that it doesn't get incr()ed
            // we could have used load() and rtcallMask to be more regular
            let len = ir.rtcall(length, [collectionVar.loadCore()])
            let cmp = emitIntOp("numops::lt_bool", intVarIter.load(), fromInt(len))
            proc.emitJmpZ(l.brk, cmp)

            // TODO this should be changed to use standard indexer lookup and int handling
            let toInt = (e: ir.Expr) => {
                return needsNumberConversions() ? ir.rtcall("pxt::toInt", [e]) : e
            }

            // c = a[i]
            if (iterVar)
                proc.emitExpr(iterVar.storeByRef(ir.rtcall(indexer, [collectionVar.loadCore(), toInt(intVarIter.loadCore())])))

            flushHoistedFunctionDefinitions()

            emit(node.statement);
            proc.emitLblDirect(l.cont);

            // i = i + 1
            proc.emitExpr(intVarIter.storeByRef(
                emitIntOp("numops::adds", intVarIter.load(), emitLit(1))))

            proc.emitJmp(l.fortop);
            proc.emitLblDirect(l.brk);

            proc.emitExpr(collectionVar.storeByRef(emitLit(undefined))) // clear it, so it gets GCed
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
                v = emitLit(undefined) // == return undefined
            }
            proc.emitJmp(getLabels(proc.action).ret, v, ir.JmpMode.Always)
        }

        function emitWithStatement(node: WithStatement) { }

        function emitSwitchStatement(node: SwitchStatement) {
            emitBrk(node)

            let l = getLabels(node)
            let defaultLabel: ir.Stmt

            let expr = ir.shared(emitExpr(node.expression))

            let lbls = node.caseBlock.clauses.map(cl => {
                let lbl = proc.mkLabel("switch")
                if (cl.kind == SK.CaseClause) {
                    let cc = cl as CaseClause
                    let cmpExpr = emitExpr(cc.expression)
                    let mask = isRefCountedExpr(cc.expression) ? 1 : 0
                    // we assume the value we're switching over will stay alive
                    // so, the mask only applies to the case expression if needed
                    // switch_eq() will decr(expr) if result is true
                    let cmpCall = ir.rtcallMask(mapIntOpName("pxt::switch_eq"),
                        mask, ir.CallingConvention.Plain, [cmpExpr, expr])
                    proc.emitJmp(lbl, cmpCall, ir.JmpMode.IfNotZero, expr)
                } else if (cl.kind == SK.DefaultClause) {
                    // Save default label for emit at the end of the
                    // tests section. Default label doesn't have to come at the
                    // end in JS.
                    assert(!defaultLabel, "!defaultLabel")
                    defaultLabel = lbl
                } else {
                    oops()
                }
                return lbl
            })

            if (defaultLabel)
                proc.emitJmp(defaultLabel, expr)
            else
                proc.emitJmp(l.brk, expr);

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

        function emitThrowStatement(node: ThrowStatement) {
            emitBrk(node)
            proc.emitExpr(rtcallMaskDirect("pxt::throwValue", [emitExpr(node.expression)]))
        }

        function emitTryStatement(node: TryStatement) {
            const beginTry = (lbl: ir.Stmt) =>
                rtcallMaskDirect("pxt::beginTry", [ir.ptrlit(lbl.lblName, lbl as any)])

            emitBrk(node)

            const lcatch = proc.mkLabel("catch")
            lcatch.lblName = "_catch_" + getNodeId(node)
            const lfinally = proc.mkLabel("finally")
            lfinally.lblName = "_finally_" + getNodeId(node)

            if (node.finallyBlock)
                proc.emitExpr(beginTry(lfinally))
            if (node.catchClause)
                proc.emitExpr(beginTry(lcatch))

            proc.stackEmpty()
            emitBlock(node.tryBlock)
            proc.stackEmpty()

            if (node.catchClause) {
                const skip = proc.mkLabel("catchend")
                proc.emitExpr(rtcallMaskDirect("pxt::endTry", []))
                proc.emitJmp(skip)

                proc.emitLbl(lcatch)
                const decl = node.catchClause.variableDeclaration
                if (decl) {
                    emitVariableDeclaration(decl)
                    const loc = lookupCell(decl)
                    proc.emitExpr(loc.storeByRef(rtcallMaskDirect("pxt::getThrownValue", [])))
                }
                flushHoistedFunctionDefinitions()
                emitBlock(node.catchClause.block)
                proc.emitLbl(skip)
            }

            if (node.finallyBlock) {
                proc.emitExpr(rtcallMaskDirect("pxt::endTry", []))
                proc.emitLbl(lfinally)
                emitBlock(node.finallyBlock)
                proc.emitExpr(rtcallMaskDirect("pxt::endFinally", []))
            }
        }

        function emitCatchClause(node: CatchClause) { }
        function emitDebuggerStatement(node: Node) {
            emitBrk(node)
        }
        function isLoop(node: Node) {
            switch (node.kind) {
                case SK.WhileStatement:
                case SK.ForInStatement:
                case SK.ForOfStatement:
                case SK.ForStatement:
                case SK.DoStatement:
                    return true;
                default:
                    return false;
            }
        }
        function inLoop(node: Node) {
            while (node) {
                if (isLoop(node))
                    return true
                node = node.parent
            }
            return false
        }

        function emitVarOrParam(node: VarOrParam, bindingExpr: ir.Expr, bindingType: Type): ir.Cell {
            if (node.name.kind === SK.ObjectBindingPattern || node.name.kind == SK.ArrayBindingPattern) {
                if (!bindingExpr) {
                    bindingExpr = node.initializer ? ir.shared(emitExpr(node.initializer)) :
                        emitLocalLoad(node as VariableDeclaration)
                    bindingType = node.initializer ? typeOf(node.initializer) : typeOf(node);
                }
                (node.name as ObjectBindingPattern).elements.forEach((e: BindingElement) => emitVarOrParam(e, bindingExpr, bindingType));
                proc.stackEmpty(); // stack empty only after all assigned
                return null;
            }

            if (!shouldEmitNow(node)) {
                return null;
            }

            // skip emit of things, where access to them is emitted as literal
            if (constantFoldDecl(node))
                return null;

            let loc: ir.Cell

            if (isGlobalVar(node)) {
                emitGlobal(node)
                loc = lookupCell(node)
            } else {
                loc = proc.mkLocal(node, getVarInfo(node))
            }

            markVariableDefinition(loc.info)

            if (loc.isByRefLocal()) {
                proc.emitExpr(loc.storeDirect(ir.rtcall("pxtrt::mklocRef", [])))
            }
            typeCheckVar(typeOf(node))

            if (node.kind === SK.BindingElement) {
                emitBrk(node)
                let [expr, tp] = bindingElementAccessExpression(node as BindingElement, bindingExpr, bindingType)
                proc.emitExpr(loc.storeByRef(expr))
            }
            else if (node.initializer) {
                emitBrk(node)
                if (isGlobalVar(node)) {
                    let attrs = parseComments(node)
                    let jrname = attrs.jres
                    if (jrname) {
                        if (jrname == "true") {
                            jrname = getNodeFullName(checker, node)
                        }
                        let jr = U.lookup(opts.jres || {}, jrname)
                        if (!jr)
                            userError(9270, lf("resource '{0}' not found in any .jres file", jrname))
                        else {
                            currJres = jr
                        }
                    }
                }
                typeCheckSubtoSup(node.initializer, node)
                proc.emitExpr(loc.storeByRef(emitExpr(node.initializer)))
                currJres = null
                proc.stackEmpty();
            } else if (inLoop(node)) {
                // the variable is declared in a loop - we need to clear it on each iteration
                emitBrk(node)
                proc.emitExpr(loc.storeByRef(emitLit(undefined)))
                proc.stackEmpty();
            }
            return loc;
        }

        function emitVariableDeclaration(node: VarOrParam): ir.Cell {
            return emitVarOrParam(node, null, null)
        }

        function emitFieldAccess(node: Node, objRef: ir.Expr, objType: Type, fieldName: string): [ir.Expr, Type] {
            const fieldSym = checker.getPropertyOfType(objType, fieldName);
            U.assert(!!fieldSym, "field sym")
            const myType = checker.getTypeOfSymbolAtLocation(fieldSym, node);
            let res: ir.Expr
            if (isPossiblyGenericClassType(objType)) {
                const info = getClassInfo(objType)
                res = ir.op(EK.FieldAccess, [objRef], fieldIndexCore(info, getFieldInfo(info, fieldName)))
            } else {
                res = mkMethodCall([objRef], {
                    ifaceIndex: getIfaceMemberId(fieldName, true),
                    noArgs: true
                })
            }
            return [res, myType]
        }

        function bindingElementAccessExpression(bindingElement: BindingElement, parentAccess: ir.Expr, parentType: Type): [ir.Expr, Type] {
            const target = bindingElement.parent.parent;

            if (target.kind === SK.BindingElement) {
                const parent = bindingElementAccessExpression(target as BindingElement,
                    parentAccess, parentType);
                parentAccess = parent[0];
                parentType = parent[1];
            }


            if (bindingElement.parent.kind == SK.ArrayBindingPattern) {
                const idx = (bindingElement.parent as ArrayBindingPattern).elements.indexOf(bindingElement)
                if (bindingElement.dotDotDotToken)
                    userError(9203, lf("spread operator not supported yet"))
                const myType = arrayElementType(parentType, idx)
                return [
                    rtcallMaskDirect("Array_::getAt", [parentAccess, ir.numlit(idx)]),
                    myType
                ]
            } else {
                const propertyName = (bindingElement.propertyName || bindingElement.name) as Identifier;
                return emitFieldAccess(bindingElement, parentAccess, parentType, propertyName.text)
            }
        }

        function emitClassDeclaration(node: ClassDeclaration) {
            const info = getClassInfo(null, node)
            if (info.isUsed && bin.usedClassInfos.indexOf(info) < 0)
                bin.usedClassInfos.push(info)
            node.members.forEach(emit)
        }
        function emitInterfaceDeclaration(node: InterfaceDeclaration) {
            checkInterfaceDeclaration(bin, node)
            let attrs = parseComments(node)
            if (attrs.autoCreate)
                autoCreateFunctions[attrs.autoCreate] = true
        }
        function emitEnumDeclaration(node: EnumDeclaration) {
            //No code needs to be generated, enum names are replaced by constant values in generated code
        }
        function emitEnumMember(node: EnumMember) { }
        function emitModuleDeclaration(node: ModuleDeclaration) {
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
                // if (!e.ksEmitterUserError)
                let code = e.ksErrorCode || 9200
                error(node, code, e.message)
                pxt.debug(e.stack)
                return null
            }
        }

        function emitExpr(node0: Node, useCache: boolean = true): ir.Expr {
            let node = node0 as NodeWithCache
            if (useCache && node.cachedIR) {
                return node.cachedIR
            }
            let res = catchErrors(node, emitExprInner) || emitLit(undefined)
            if (useCache && node.needsIRCache) {
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

        function emitTopLevel(node: Declaration): void {
            const pinfo = pxtInfo(node)
            if (pinfo.usedNodes) {
                needsUsingInfo = false
                for (let node of U.values(pinfo.usedNodes))
                    markUsed(node)
                for (let fn of pinfo.usedActions)
                    fn(bin)
                needsUsingInfo = true
            } else if (isGlobalVar(node) || isClassDeclaration(node)) {
                needsUsingInfo = false
                currUsingContext = pinfo
                currUsingContext.usedNodes = null
                currUsingContext.usedActions = null
                if (isGlobalVar(node) && !constantFoldDecl(node)) emitGlobal(node)
                emit(node)
                needsUsingInfo = true
            } else {
                currUsingContext = pinfo
                currUsingContext.usedNodes = {}
                currUsingContext.usedActions = []
                emit(node)
                currUsingContext = null
            }
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
                    flushHoistedFunctionDefinitions()
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
                case SyntaxKind.TryStatement:
                    return emitTryStatement(<TryStatement>node);
                case SyntaxKind.ThrowStatement:
                    return emitThrowStatement(<ThrowStatement>node);
                case SK.DebuggerStatement:
                    return emitDebuggerStatement(node);
                case SK.GetAccessor:
                case SK.SetAccessor:
                    return emitAccessor(<AccessorDeclaration>node);
                case SK.ImportEqualsDeclaration:
                    // this doesn't do anything in compiled code
                    return emitImportEqualsDeclaration(<ImportEqualsDeclaration>node);
                case SK.EmptyStatement:
                    return;
                case SK.SemicolonClassElement:
                    return;
                default:
                    unhandled(node);
            }
        }

        function emitExprCore(node: Node): ir.Expr {
            switch (node.kind) {
                case SK.NullKeyword:
                    let v = pxtInfo(node).valueOverride;
                    if (v) return v
                    return emitLit(null);
                case SK.TrueKeyword:
                    return emitLit(true);
                case SK.FalseKeyword:
                    return emitLit(false);
                case SK.TemplateHead:
                case SK.TemplateMiddle:
                case SK.TemplateTail:
                case SK.NumericLiteral:
                case SK.StringLiteral:
                case SK.NoSubstitutionTemplateLiteral:
                    //case SyntaxKind.RegularExpressionLiteral:
                    return emitLiteral(<LiteralExpression>node);
                case SK.TaggedTemplateExpression:
                    return emitTaggedTemplateExpression(<TaggedTemplateExpression>node);
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
                case SK.TypeOfExpression:
                    return emitTypeOfExpression(<TypeOfExpression>node);
                case SyntaxKind.DeleteExpression:
                    return emitDeleteExpression(<DeleteExpression>node);
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

    function doubleToBits(v: number) {
        let a = new Float64Array(1)
        a[0] = v
        return U.toHex(new Uint8Array(a.buffer))
    }

    function floatToBits(v: number) {
        let a = new Float32Array(1)
        a[0] = v
        return U.toHex(new Uint8Array(a.buffer))
    }

    function checkPrimitiveType(t: Type, flags: number, tp: HasLiteralType) {
        if (t.flags & flags) {
            return true;
        }
        return checkUnionOfLiterals(t) === tp;
    }


    export function isStringType(t: Type) {
        return checkPrimitiveType(t, TypeFlags.String | TypeFlags.StringLiteral, HasLiteralType.String);
    }

    function isNumberType(t: Type) {
        return checkPrimitiveType(t, TypeFlags.Number | TypeFlags.NumberLiteral, HasLiteralType.Number);
    }

    function isBooleanType(t: Type) {
        return checkPrimitiveType(t, TypeFlags.Boolean | TypeFlags.BooleanLiteral, HasLiteralType.Boolean);
    }

    function isEnumType(t: Type) {
        return checkPrimitiveType(t, TypeFlags.Enum | TypeFlags.EnumLiteral, HasLiteralType.Enum);
    }

    function isNumericalType(t: Type) {
        return isEnumType(t) || isNumberType(t);
    }

    export class Binary {
        procs: ir.Procedure[] = [];
        globals: ir.Cell[] = [];
        globalsWords: number;
        nonPtrGlobals: number;
        finalPass = false;
        target: CompileTarget;
        writeFile = (fn: string, cont: string) => { };
        res: CompileResult;
        options: CompileOptions;
        usedClassInfos: ClassInfo[] = [];
        checksumBlock: number[];
        numStmts = 1;
        commSize = 0;
        packedSource: string;
        itEntries = 0;
        itFullEntries = 0;
        numMethods = 0;
        numVirtMethods = 0;
        usedChars = new Uint32Array(0x10000 / 32);

        explicitlyUsedIfaceMembers: pxt.Map<boolean> = {};
        ifaceMemberMap: pxt.Map<number> = {};
        ifaceMembers: string[];
        strings: pxt.Map<string> = {};
        hexlits: pxt.Map<string> = {};
        doubles: pxt.Map<string> = {};
        otherLiterals: string[] = [];
        codeHelpers: pxt.Map<string> = {};
        lblNo = 0;

        reset() {
            this.lblNo = 0
            this.otherLiterals = []
            this.strings = {}
            this.hexlits = {}
            this.doubles = {}
            this.numStmts = 0
        }

        getTitle() {
            const title = this.options.name || U.lf("Untitled")
            if (title.length >= 90)
                return title.slice(0, 87) + "..."
            else
                return title
        }

        addProc(proc: ir.Procedure) {
            assert(!this.finalPass, "!this.finalPass")
            this.procs.push(proc)
            proc.seqNo = this.procs.length
            //proc.binary = this
        }

        recordHelper(usingCtx: PxtNode, id: string, gen: (bin: Binary) => string) {
            const act = (bin: Binary) => {
                if (!bin.codeHelpers[id])
                    bin.codeHelpers[id] = gen(bin)
            }
            act(this)
            this.recordAction(usingCtx, act)
        }

        recordAction<T>(usingCtx: PxtNode, f: (bin: Binary) => T) {
            if (usingCtx) {
                if (usingCtx.usedActions)
                    usingCtx.usedActions.push(f as EmitAction)
            } else
                U.oops("no using ctx!")
        }

        private emitLabelled(v: string, hash: pxt.Map<string>, lblpref: string) {
            let r = U.lookup(hash, v)
            if (r != null)
                return r
            let lbl = lblpref + this.lblNo++
            hash[v] = lbl
            return lbl
        }

        emitDouble(v: number): string {
            return this.emitLabelled(target.switches.numFloat ? floatToBits(v) : doubleToBits(v), this.doubles, "_dbl")
        }

        emitString(s: string): string {
            if (!this.finalPass)
                for (let i = 0; i < s.length; ++i) {
                    const ch = s.charCodeAt(i)
                    if (ch >= 128)
                        this.usedChars[ch >> 5] |= 1 << (ch & 31)
                }
            return this.emitLabelled(s, this.strings, "_str")
        }

        emitHexLiteral(s: string): string {
            return this.emitLabelled(s, this.hexlits, "_hexlit")
        }

        setPerfCounters(systemPerfCounters: string[]) {
            if (!target.switches.profile)
                return []
            const perfCounters = systemPerfCounters.slice()
            this.procs.forEach(p => {
                if (p.perfCounterName) {
                    U.assert(target.switches.profile)
                    p.perfCounterNo = perfCounters.length
                    perfCounters.push(p.perfCounterName)
                }
            })
            return perfCounters
        }
    }

    export function isCtorField(p: ParameterDeclaration) {
        if (!p.modifiers)
            return false
        if (p.parent.kind != SK.Constructor)
            return false
        for (let m of p.modifiers) {
            if (m.kind == SK.PrivateKeyword ||
                m.kind == SK.PublicKeyword ||
                m.kind == SK.ProtectedKeyword)
                return true
        }
        return false
    }

    function isNumberLikeType(type: Type): boolean {
        if (type.flags & TypeFlags.Union) {
            return (type as UnionType).types.every(t => isNumberLikeType(t));
        } else {
            return !!(type.flags & (TypeFlags.NumberLike | TypeFlags.EnumLike | TypeFlags.BooleanLike));
        }
    }
}
