/// <reference path="../../localtypings/pxtarget.d.ts"/>
/// <reference path="../../localtypings/pxtpackage.d.ts"/>

namespace ts.pxtc {
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

    interface NodeWithId extends Node {
        pxtNodeId: number;
        pxtNodeWave: number;
    }

    export interface FieldWithAddInfo extends NamedDeclaration {
    }

    type TemplateLiteralFragment = TemplateHead | TemplateMiddle | TemplateTail;
    export type EmittableAsCall = FunctionLikeDeclaration | SignatureDeclaration | ObjectLiteralElementLike | PropertySignature | ModuleDeclaration
        | ParameterDeclaration | PropertyDeclaration;

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

    // next free error 9276
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

    function noRefCounting() {
        return !target.jsRefCounting && !target.isNative
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
        if (!target.isNative) return e
        return ir.rtcall("pxt::fromInt", [e])
    }

    function fromBool(e: ir.Expr): ir.Expr {
        if (!target.isNative) return e
        return ir.rtcall("pxt::fromBool", [e])
    }

    function fromFloat(e: ir.Expr): ir.Expr {
        if (!target.isNative) return e
        return ir.rtcall("pxt::fromFloat", [e])
    }

    function fromDouble(e: ir.Expr): ir.Expr {
        if (!target.isNative) return e
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

    export function isObjectType(t: Type): t is ObjectType {
        return "objectFlags" in t;
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
        decl: Declaration;
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

    export interface ClassInfo {
        id: string;
        derivedClasses?: ClassInfo[];
        classNo?: number;
        lastSubtypeNo?: number;
        baseClassInfo: ClassInfo;
        decl: ClassDeclaration;
        allfields: FieldWithAddInfo[];
        methods: FunctionLikeDeclaration[];
        attrs: CommentAttrs;
        isUsed?: boolean;
        vtable?: ir.Procedure[];
        itable?: ITableEntry[];
        ctor?: ir.Procedure;
        toStringMethod?: ir.Procedure;
    }

    export interface BinaryExpressionInfo {
        leftType: string;
        rightType: string;
    }

    let lf = assembler.lf;
    let checker: TypeChecker;
    export let target: CompileTarget;
    let lastSecondaryError: string
    let lastSecondaryErrorCode = 0
    let inCatchErrors = 0

    export function getComments(node: Node) {
        if (node.kind == SK.VariableDeclaration)
            node = node.parent.parent // we need variable stmt

        let cmtCore = (node: Node) => {
            let src = getSourceFileOfNode(node)
            let doc = getLeadingCommentRangesOfNode(node, src)
            if (!doc) return "";
            let cmt = doc.map(r => src.text.slice(r.pos, r.end)).join("\n")
            return cmt;
        }

        if (node.symbol && node.symbol.declarations.length > 1) {
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

    interface NodeWithAttrs extends Node {
        pxtCommentAttrs: CommentAttrs;
    }

    export function parseComments(node0: Node): CommentAttrs {
        if (!node0 || (node0 as any).isBogusFunction) return parseCommentString("")
        let node = node0 as NodeWithAttrs
        let cached = node.pxtCommentAttrs
        if (cached)
            return cached
        let res = parseCommentString(getComments(node))
        res._name = getName(node)
        node.pxtCommentAttrs = res
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
        return (t.objectFlags & ObjectFlags.Reference) && t.symbol.name == "Array"
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
        return !!((t.objectFlags & ObjectFlags.Class) || (t.symbol.flags & SymbolFlags.Class))
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

    function arrayElementType(t: Type): Type {
        if (isArrayType(t))
            return checkType((<TypeReference>t).typeArguments[0])
        return null;
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
        let ok = TypeFlags.String | TypeFlags.Number | TypeFlags.Boolean |
            TypeFlags.StringLiteral | TypeFlags.NumberLiteral | TypeFlags.BooleanLiteral |
            TypeFlags.Void | TypeFlags.Enum | TypeFlags.EnumLiteral | TypeFlags.Null | TypeFlags.Undefined |
            TypeFlags.Never | TypeFlags.TypeParameter | TypeFlags.Any
        if ((t.flags & ok) == 0) {
            if (isArrayType(t)) return t;
            if (isClassType(t)) return t;
            if (isInterfaceType(t)) return t;
            if (isFunctionType(t)) return t;
            if (t.flags & TypeFlags.TypeParameter) return t;
            if (isUnionOfLiterals(t)) return t;

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
        if (!r)
            return r
        if (isStringLiteral(node))
            return r; // skip checkType() - type is any for literal fragments
        // save for future use; this cuts around 10% of emit() time
        (node as any).typeOverride = r
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

    function checkInterfaceDeclaration(decl: InterfaceDeclaration, classes: pxt.Map<ClassInfo>) {
        for (let cl in classes) {
            if (classes[cl].decl.symbol == decl.symbol) {
                userError(9261, lf("Interface with same name as a class not supported"))
            }
        }
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

    let checkSubtypes = false

    function typeCheckSubtoSup(sub: Node | Type, sup: Node | Type) {
        if (!checkSubtypes)
            return

        // get the direct types
        let supTypeLoc = (sup as any).kind ? checker.getTypeAtLocation(sup as Node) : sup as Type;
        let subTypeLoc = (sub as any).kind ? checker.getTypeAtLocation(sub as Node) : sub as Type;

        // get the contextual types, if possible
        let supType = isExpression(sup as Node) ? checker.getContextualType(<Expression>(sup as Node)) : supTypeLoc
        if (!supType)
            supType = supTypeLoc
        let subType = isExpression(sub as Node) ? checker.getContextualType(<Expression>(sub as Node)) : subTypeLoc
        if (!subType)
            subType = subTypeLoc

        if (!supType || !subType)
            return;

        // src may get its type from trg via context, in which case
        // we want to use the direct type of src
        if (supType == subType && subType != subTypeLoc)
            subType = subTypeLoc

        occursCheck = []
        let [ok, message] = checkSubtype(subType, supType)
        if (!ok) {
            userError(9263, lf(message))
        }
    }

    let occursCheck: string[] = []
    let cachedSubtypeQueries: pxt.Map<[boolean, string]> = {}
    function insertSubtype(key: string, val: [boolean, string]) {
        cachedSubtypeQueries[key] = val
        occursCheck.pop()
        return val
    }

    // this function works assuming that the program has passed the
    // TypeScript type checker. We are going to simply rule out some
    // cases that pass the TS checker. We only compare type
    // pairs that the TS checker compared.

    // we are checking that subType is a subtype of supType, so that
    // an assignment of the form trg <- src is safe, where supType is the
    // type of trg and subType is the type of src
    function checkSubtype(subType: Type, superType: Type): [boolean, string] {

        function checkMembers() {
            let superProps = checker.getPropertiesOfType(superType)
            let subProps = checker.getPropertiesOfType(subType)
            let [ret, msg] = [true, ""]
            superProps.forEach(superProp => {
                let superPropDecl = <PropertyDeclaration>superProp.valueDeclaration
                let find = subProps.filter(sp => sp.name == superProp.name)
                if (find.length == 1) {
                    let subPropDecl = <PropertyDeclaration>find[0].valueDeclaration
                    // TODO: record the property on which we have a mismatch
                    let [retSub, msgSub] = checkSubtype(checker.getTypeAtLocation(subPropDecl), checker.getTypeAtLocation(superPropDecl))
                    if (ret && !retSub) [ret, msg] = [retSub, msgSub]
                } else if (find.length == 0) {
                    if (!(superProp.flags & SymbolFlags.Optional)) {
                        // we have a cast to an interface with more properties (unsound)
                        [ret, msg] = [false, "Property " + superProp.name + " not present in " + subType.getSymbol().name]
                    } else {
                        // we will reach this case for something like
                        // let x: Foo = { a:42 }
                        // where x has some optional properties, in addition to "a"
                    }
                }
            })
            return insertSubtype(key, [ret, msg])
        }

        let subId = (subType as any).id
        let superId = (superType as any).id
        let key = subId + "," + superId

        if (cachedSubtypeQueries[key])
            return cachedSubtypeQueries[key];

        // check to see if query already on the stack
        if (occursCheck.indexOf(key) != -1)
            return [true, ""]
        occursCheck.push(key)

        // we don't allow Any!
        if (superType.flags & TypeFlags.Any)
            return insertSubtype(key, [false, "Unsupported type: any."])

        // outlaw all things that can't be cast to class/interface
        if (isStructureType(superType) && !castableToStructureType(subType)) {
            return insertSubtype(key, [false, "Cast to class/interface not supported."])
        }

        if (isClassType(superType) && !isGenericType(superType)) {
            if (isClassType(subType) && !isGenericType(subType)) {
                let superDecl = <ClassDeclaration>superType.symbol.valueDeclaration
                let subDecl = <ClassDeclaration>subType.symbol.valueDeclaration
                // only allow upcast (sub -> ... -> sup) in inheritance chain
                if (!inheritsFrom(subDecl, superDecl)) {
                    if (inheritsFrom(superDecl, subDecl))
                        return insertSubtype(key, [false, "Downcasts not supported."])
                    else
                        return insertSubtype(key, [false, "Classes " + subDecl.name.getText() + " and " + superDecl.name.getText() + " are not related by inheritance."])
                }
                // need to also check subtyping on members
                return checkMembers();
            } else {
                if (!(subType.flags & (TypeFlags.Undefined | TypeFlags.Null))) {
                    return insertSubtype(key, [false, "Cast to class not supported."])
                }
            }
        } else if (isFunctionType(superType)) {
            // implement standard function subtyping (no bivariance)
            let superFun = isFunctionType(superType)
            if (isFunctionType(subType)) {
                let subFun = isFunctionType(subType)
                U.assert(superFun.parameters.length >= subFun.parameters.length, "sup should have at least params of sub")
                let [ret, msg] = [true, ""]
                for (let i = 0; i < subFun.parameters.length; i++) {
                    let superParamType = checker.getTypeAtLocation(superFun.parameters[i].valueDeclaration)
                    let subParamType = checker.getTypeAtLocation(subFun.parameters[i].valueDeclaration)
                    // Check parameter types (contra-variant)
                    let [retSub, msgSub] = checkSubtype(superParamType, subParamType)
                    if (ret && !retSub) [ret, msg] = [retSub, msgSub]
                }
                // check return type (co-variant)
                let superRetType = superFun.getReturnType()
                let subRetType = superFun.getReturnType()
                let [retSub, msgSub] = checkSubtype(subRetType, superRetType)
                if (ret && !retSub) [ret, msg] = [retSub, msgSub]
                return insertSubtype(key, [ret, msg])
            }
        } else if (isInterfaceType(superType)) {
            if (isStructureType(subType)) {
                return checkMembers();
            }
        } else if (isArrayType(superType)) {
            if (isArrayType(subType)) {
                let superElemType = arrayElementType(superType)
                let subElemType = arrayElementType(subType)
                return checkSubtype(subElemType, superElemType)
            }
        }
        return insertSubtype(key, [true, ""])
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

    export function getDeclName(node: Declaration) {
        let text = isNamedDeclaration(node) ? (<Identifier>node.name).text : null
        if (!text && node.kind == SK.Constructor)
            text = "constructor"
        if (node && node.parent && node.parent.kind == SK.ClassDeclaration)
            text = (<ClassDeclaration>node.parent).name.text + "." + text
        text = text || "inline"
        return text;
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
    }

    export interface FunctionAddInfo {
        capturedVars: VarOrParam[];
        decl: EmittableAsCall;
        location?: ir.Cell;
        thisParameter?: ParameterDeclaration; // a bit bogus
        virtualParent?: FunctionAddInfo;
        virtualInstances?: FunctionAddInfo[];
        virtualIndex?: number;
        isUsed?: boolean;
        parentClassInfo?: ClassInfo;
        usedAsValue?: boolean;
        usedAsIface?: boolean;
    }

    export function compileBinary(
        program: Program,
        host: CompilerHost,
        opts: CompileOptions,
        res: CompileResult,
        entryPoint: string): EmitResult {
        target = opts.target
        const diagnostics = createDiagnosticCollection();
        checker = program.getTypeChecker();
        let classInfos: pxt.Map<ClassInfo> = {}
        let usedDecls: pxt.Map<Node> = {}
        let usedWorkList: Declaration[] = []
        let variableStatus: pxt.Map<VariableAddInfo> = {};
        let functionInfo: pxt.Map<FunctionAddInfo> = {};
        let irCachesToClear: NodeWithCache[] = []
        let ifaceMembers: pxt.Map<number> = {}
        let explicitlyUsedIfaceMembers: pxt.Map<number> = {}
        let autoCreateFunctions: pxt.Map<boolean> = {}
        let configEntries: pxt.Map<ConfigEntry> = {}
        let currJres: pxt.JRes = null

        cachedSubtypeQueries = {}
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
                    emittedFiles: [],
                    emitSkipped: true
                };
            }

            hex.setupFor(opts.target, opts.extinfo || emptyExtInfo(), opts.hexinfo);
            hex.setupInlineAssembly(opts);
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

        let src = program.getSourceFiles().filter(f => Util.endsWith(f.fileName, entryPoint))[0];

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
        pruneMethodsAndRecompute()
        emitVTables()

        if (diagnostics.getModificationCount() == 0) {
            reset();
            bin.finalPass = true
            emit(rootFunction)

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

            catchErrors(rootFunction, finalEmit)
        }

        if (opts.ast) {
            annotate(program, entryPoint, target);
        }

        return {
            diagnostics: diagnostics.getDiagnostics(),
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
            try {
                f();
            } finally {
                proc = prevProc;
            }
        }

        function getIfaceMemberId(name: string, markUsed = false) {
            if (markUsed && !U.lookup(explicitlyUsedIfaceMembers, name)) {
                U.assert(!bin.finalPass)
                explicitlyUsedIfaceMembers[name] = 1
                for (let inf of bin.usedClassInfos) {
                    for (let m of inf.methods) {
                        if (getName(m) == name)
                            markFunctionUsed(m)
                    }
                }
            }
            let v = U.lookup(ifaceMembers, name)
            if (v != null) return v
            U.assert(!bin.finalPass)
            // this gets renumbered before the final pass
            v = ifaceMembers[name] = -1;
            bin.emitString(name)
            return v
        }

        function finalEmit() {
            if (diagnostics.getModificationCount() || opts.noEmit || !host)
                return;

            bin.writeFile = (fn: string, data: string) =>
                host.writeFile(fn, data, false, null, program.getSourceFiles());

            if (opts.target.isNative) {
                if (opts.extinfo.yotta)
                    bin.writeFile("yotta.json", JSON.stringify(opts.extinfo.yotta, null, 2));
                if (opts.extinfo.platformio)
                    bin.writeFile("platformio.json", JSON.stringify(opts.extinfo.platformio, null, 2));
                processorEmit(bin, opts, res)
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

        function getVTable(inf: ClassInfo) {
            assert(inf.isUsed, "inf.isUsed")
            if (inf.vtable)
                return inf.vtable
            let tbl = inf.baseClassInfo ? getVTable(inf.baseClassInfo).slice(0) : []
            inf.derivedClasses = []
            if (inf.baseClassInfo)
                inf.baseClassInfo.derivedClasses.push(inf)


            for (let m of inf.methods) {
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
                    info: (finfo.idx + 1) * 4,
                    idx: getIfaceMemberId(fname),
                    proc: null
                })
            }

            for (let curr = inf; curr; curr = curr.baseClassInfo) {
                for (let m of curr.methods) {
                    const n = getName(m)
                    if (isIfaceMemberUsed(n) || isUsed(m)) {
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
            }


            return inf.vtable
        }

        // this code determines if we will need a vtable entry
        // by checking if we are overriding a method in a super class
        function computeVtableInfo(info: ClassInfo) {
            // walk up the inheritance chain to collect any methods
            // we may be overriding in this class
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
                    // pinf is just the parent (why not transitive?)
                    minf.virtualParent = pinf
                    if (!pinf.virtualParent)
                        pinf.virtualParent = pinf
                    assert(pinf.virtualParent == pinf, "pinf.virtualParent == pinf")
                    if (!pinf.virtualInstances)
                        pinf.virtualInstances = []
                    pinf.virtualInstances.push(minf)
                }
            }
        }

        function pruneMethodsAndRecompute() {
            // reset the virtual info
            for (let fi in functionInfo) {
                functionInfo[fi].virtualParent = undefined
                functionInfo[fi].virtualIndex = undefined
                functionInfo[fi].virtualInstances = undefined
            }
            // remove methods that are not used
            for (let ci in classInfos) {
                classInfos[ci].methods = classInfos[ci].methods.filter((m) => getFunctionInfo(m).isUsed)
            }
            // recompute vtable info
            for (let ci in classInfos) {
                if (classInfos[ci].baseClassInfo)
                    computeVtableInfo(classInfos[ci])
            }
        }

        function getClassInfo(t: Type, decl: ClassDeclaration = null) {
            if (!decl)
                decl = <ClassDeclaration>t.symbol.valueDeclaration
            let id = safeName(decl) + "__C" + getNodeId(decl)
            let info: ClassInfo = classInfos[id]
            if (!info) {
                info = {
                    id: id,
                    allfields: [],
                    attrs: parseComments(decl),
                    decl: decl,
                    baseClassInfo: null,
                    methods: [],
                }
                if (info.attrs.autoCreate)
                    autoCreateFunctions[info.attrs.autoCreate] = true
                classInfos[id] = info;
                // only do it after storing our in case we run into cycles (which should be errors)
                info.baseClassInfo = getBaseClassInfo(decl)
                for (let mem of decl.members) {
                    if (mem.kind == SK.PropertyDeclaration) {
                        let pdecl = <PropertyDeclaration>mem
                        info.allfields.push(pdecl)
                    } else if (mem.kind == SK.Constructor) {
                        for (let p of (mem as FunctionLikeDeclaration).parameters) {
                            if (isCtorField(p))
                                info.allfields.push(p)
                        }
                    } else if (isClassFunction(mem)) {
                        let minf = getFunctionInfo(mem as any)
                        minf.parentClassInfo = info
                        info.methods.push(mem as any)
                    }
                }
                if (info.baseClassInfo) {
                    info.allfields = info.baseClassInfo.allfields.concat(info.allfields)
                    computeVtableInfo(info)
                }

            }
            return info;
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

        function isConstLiteral(decl: Declaration) {
            if (isGlobalVar(decl)) {
                if (decl.parent.flags & NodeFlags.Const) {
                    let init = (decl as VariableDeclaration).initializer
                    if (!init) return false
                    if (init.kind == SK.ArrayLiteralExpression) return false
                    return !isSideEffectfulInitializer(init)
                }
            }
            return false
        }

        function isSideEffectfulInitializer(init: Expression): boolean {
            if (!init) return false;
            if (isStringLiteral(init)) return false;
            switch (init.kind) {
                case SK.NullKeyword:
                case SK.NumericLiteral:
                case SK.TrueKeyword:
                case SK.FalseKeyword:
                case SK.UndefinedKeyword:
                    return false;
                case SK.Identifier:
                    return !isConstLiteral(getDecl(init))
                case SK.PropertyAccessExpression:
                    let d = getDecl(init)
                    return !d || d.kind != SK.EnumMember
                case SK.ArrayLiteralExpression:
                    return (init as ArrayLiteralExpression).elements.some(isSideEffectfulInitializer)
                default:
                    return true;
            }
        }

        function emitLocalLoad(decl: VarOrParam) {
            if (isGlobalVar(decl)) {
                let attrs = parseComments(decl)
                if (attrs.shim)
                    return emitShim(decl, decl, [])
                if (isConstLiteral(decl))
                    return emitExpr(decl.initializer)
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
            if (isGenericFunction(f))
                userError(9232, lf("generic functions cannot be yet used as values; did you forget ()?"))
            let info = getFunctionInfo(f)
            if (info.location) {
                return info.location.load()
            } else {
                assert(!bin.finalPass || info.capturedVars.length == 0, "!bin.finalPass || info.capturedVars.length == 0")
                info.usedAsValue = true
                return emitFunLitCore(f)
            }
        }

        function emitIdentifier(node: Identifier): ir.Expr {
            let decl = getDecl(node)
            if (decl && (decl.kind == SK.VariableDeclaration || decl.kind == SK.Parameter || decl.kind === SK.BindingElement)) {
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
                let lbl = bin.emitString(str)
                r = ir.ptrlit(lbl + "meta", JSON.stringify(str))
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
            let expr = (asString(node.head) as any).valueOverride
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
            let coll = ir.sharedNoIncr(ir.rtcall("Array_::mk", []))
            for (let elt of node.elements) {
                let mask = isRefCountedExpr(elt) ? 2 : 0
                proc.emitExpr(ir.rtcall("Array_::push", [coll, emitExpr(elt)], mask))
            }
            return coll
        }
        function emitObjectLiteral(node: ObjectLiteralExpression) {
            let expr = ir.shared(ir.rtcall("pxtrt::mkMap", []))
            node.properties.forEach((p: PropertyAssignment | ShorthandPropertyAssignment) => {
                if (p.kind == SK.ShorthandPropertyAssignment) {
                    userError(9264, "Shorthand properties not supported.")
                    return;
                }
                const keyName = p.name.getText();
                const args = [
                    expr,
                    ir.numlit(getIfaceMemberId(keyName)),
                    emitExpr(p.initializer)
                ];
                // internal decr on all args
                proc.emitExpr(ir.rtcall("pxtrt::mapSet", args))
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
                if (bin.finalPass && !info.ctor)
                    userError(9209, lf("class field initializers currently require an explicit constructor"))
            }
            // do nothing
        }
        function emitShorthandPropertyAssignment(node: ShorthandPropertyAssignment) { }
        function emitComputedPropertyName(node: ComputedPropertyName) { }
        function emitPropertyAccess(node: PropertyAccessExpression): ir.Expr {
            let decl = getDecl(node);

            // we need to type check node.expression before committing code gen
            if ((decl.kind == SK.PropertyDeclaration && !isStatic(decl))
                || decl.kind == SK.PropertySignature || decl.kind == SK.PropertyAssignment) {
                emitExpr(node.expression, false)
            }
            if (decl.kind == SK.GetAccessor) {
                return emitCallCore(node, node, [], null)
            }
            let attrs = parseComments(decl);
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
                if (/^[+-]?\d+$/.test(ev))
                    return emitLit(parseInt(ev));
                if (/^0x[A-Fa-f\d]{2,8}$/.test(ev))
                    return emitLit(parseInt(ev, 16));
                U.userError("enumval only support number literals")
                // TODO needs dealing with int conversions
                return ir.rtcall(ev, [])
            } else if (decl.kind == SK.PropertySignature || decl.kind == SK.PropertyAssignment) {
                return emitCallCore(node, node, [], null, decl as any, node.expression)
            } else if (decl.kind == SK.PropertyDeclaration || decl.kind == SK.Parameter) {
                if (isStatic(decl)) {
                    return emitLocalLoad(decl as PropertyDeclaration)
                }
                if (target.switches.slowFields) {
                    // treat as interface call
                    return emitCallCore(node, node, [], null, decl as any, node.expression)
                } else {
                    let idx = fieldIndex(node)
                    return ir.op(EK.FieldAccess, [emitExpr(node.expression)], idx)
                }
            } else if (isClassFunction(decl) || decl.kind == SK.MethodSignature) {
                throw userError(9211, lf("cannot use method as lambda; did you forget '()' ?"))
            } else if (decl.kind == SK.FunctionDeclaration) {
                return emitFunLiteral(decl as FunctionDeclaration)
            } else if (decl.kind == SK.VariableDeclaration) {
                return emitLocalLoad(decl as VariableDeclaration)
            } else {
                throw unhandled(node, lf("Unknown property access for {0}", stringKind(decl)), 9237);
            }
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
            let res = isOnDemandGlobal(decl) || isTopLevelFunctionDecl(decl)
            if (target.switches.noTreeShake)
                return false
            if (opts.testMode && res) {
                if (!U.startsWith(getSourceFileOfNode(decl).fileName, "pxt_modules"))
                    return false
            }
            return res
        }

        function isUsed(decl: Declaration) {
            return !isOnDemandDecl(decl) || usedDecls.hasOwnProperty(nodeKey(decl))
        }

        function markFunctionUsed(decl: EmittableAsCall) {
            getFunctionInfo(decl).isUsed = true
            markUsed(decl)
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
            markUsed(decl)

            if (!decl && node.kind == SK.PropertyAccessExpression) {
                const namedNode = node as PropertyAccessExpression
                decl = {
                    kind: SK.PropertySignature,
                    symbol: { isBogusSymbol: true, name: namedNode.name.getText() },
                    isBogusFunction: true,
                    name: namedNode.name,
                } as any
            }

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
                        hex.validateShim(getDeclName(decl), nm, attrs, true, litargs.map(v => true))
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
                hex.validateShim(getDeclName(decl), nm, attrs, hasRet, args.map(isNumberLike))
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
                            let defl = attrs.paramDefl[getName(prm)]
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
            let sig = checker.getResolvedSignature(node)
            return emitCallCore(node, node.expression, node.arguments, sig)
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
            let isMethod = false
            let isProperty = false
            if (decl) {
                switch (decl.kind) {
                    // we treat properties via calls
                    // so we say they are "methods"
                    case SK.PropertySignature:
                    case SK.PropertyAssignment:
                    case SK.PropertyDeclaration:
                        if (!isStatic(decl)) {
                            isMethod = true
                            isProperty = true
                        }
                        break;
                    case SK.Parameter:
                        if (isCtorField(decl)) {
                            isMethod = true
                            isProperty = true
                        }
                        break
                    // TOTO case: case SK.ShorthandPropertyAssignment
                    // these are the real methods
                    case SK.GetAccessor:
                    case SK.SetAccessor:
                        isMethod = true
                        if (target.switches.slowMethods)
                            isProperty = true
                        break
                    case SK.MethodDeclaration:
                    case SK.MethodSignature:
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
            }
            let attrs = parseComments(decl)
            let hasRet = !(typeOf(node).flags & TypeFlags.Void)
            let args = callArgs.slice(0)

            if (isMethod && !recv && !isStatic(decl) && funcExpr.kind == SK.PropertyAccessExpression)
                recv = (<PropertyAccessExpression>funcExpr).expression

            if (res.usedArguments && attrs.trackArgs) {
                let targs = recv ? [recv].concat(args) : args
                let tracked = attrs.trackArgs.map(n => targs[n]).map(e => {
                    let d = getDecl(e)
                    if (d && (d.kind == SK.EnumMember || d.kind == SK.VariableDeclaration))
                        return getFullName(checker, d.symbol)
                    else if (e && e.kind == SK.StringLiteral)
                        return (e as StringLiteral).text
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
            if (decl && decl.kind == SK.FunctionDeclaration) {
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
                assert(!bin.finalPass || !!baseCtor, "!bin.finalPass || !!baseCtor")
                let ctorArgs = args.map((x) => emitExpr(x))
                ctorArgs.unshift(emitThis(funcExpr))
                return mkProcCallCore(baseCtor, null, ctorArgs)
            }
            if (isMethod) {
                let isSuper = false
                if (isStatic(decl)) {
                    // no additional arguments
                } else if (recv) {
                    if (recv.kind == SK.SuperKeyword) {
                        isSuper = true
                    }
                    args.unshift(recv)
                } else
                    unhandled(node, lf("strange method call"), 9241)
                let info = getFunctionInfo(decl)
                if (info.parentClassInfo)
                    markClassUsed(info.parentClassInfo)
                // if we call a method and it overrides then
                // mark the virtual root class and all its overrides as used,
                // if their classes are used
                if (info.virtualParent) info = info.virtualParent
                if (!info.isUsed) {
                    info.isUsed = true
                    for (let vinst of info.virtualInstances || []) {
                        if (vinst.parentClassInfo.isUsed)
                            markFunctionUsed(vinst.decl)
                    }
                    // we need to mark the parent as used, otherwise vtable layout fails, see #3740
                    if (info.decl.kind == SK.MethodDeclaration)
                        markFunctionUsed(info.decl)
                }
                if (info.virtualParent && !isSuper && !target.switches.slowMethods) {
                    U.assert(!bin.finalPass || info.virtualIndex != null, "!bin.finalPass || info.virtualIndex != null")
                    let r = mkMethodCall(info.parentClassInfo, info.virtualIndex, null, args.map((x) => emitExpr(x)))
                    if (args[0].kind == SK.ThisKeyword)
                        (r.data as ir.ProcId).isThis = true
                    return r
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
                    let sig = checker.getSignatureFromDeclaration(decl)
                    let tp = sig.getTypeParameters() || []
                    markFunctionUsed(decl)
                    return emitPlain();
                } else if (isProperty) {
                    if (node == funcExpr) {
                        // in this special base case, we have property access recv.foo
                        // where recv is a map obejct
                        let name = getName(decl)
                        let res = mkMethodCall(null, null, getIfaceMemberId(name, true), args.map((x) => emitExpr(x)))
                        let pid = res.data as ir.ProcId
                        if (args.length == 2) {
                            pid.mapMethod = "pxtrt::mapSet"
                        } else {
                            pid.mapMethod = "pxtrt::mapGet"
                        }
                        return res
                    } else {
                        // in this case, recv.foo represents a function/lambda
                        // so the receiver is not needed, as we have already done
                        // the property lookup to get the lambda
                        args.shift()
                    }
                } else if (decl.kind == SK.MethodSignature || (target.switches.slowMethods && !isStatic(decl) && !isSuper)) {
                    let name = getName(decl)
                    return mkMethodCall(null, null, getIfaceMemberId(name, true), args.map((x) => emitExpr(x)))
                } else {
                    markFunctionUsed(decl)
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

            return mkMethodCall(null, -1, null, args.map(x => emitExpr(x)))
        }

        function mkProcCallCore(proc: ir.Procedure, vidx: number, args: ir.Expr[], ifaceIdx: number = null) {
            let data: ir.ProcId = {
                proc: proc,
                virtualIndex: vidx,
                ifaceIndex: ifaceIdx
            }
            return ir.op(EK.ProcCall, args, data)
        }

        function mkMethodCall(ci: ClassInfo, vidx: number, ifaceIdx: number, args: ir.Expr[]) {
            let data: ir.ProcId = {
                proc: proc,
                virtualIndex: vidx,
                ifaceIndex: ifaceIdx,
                classInfo: ci
            }
            return ir.op(EK.ProcCall, args, data)
        }

        function lookupProc(decl: ts.Declaration) {
            let id: ir.ProcQuery = { action: decl as ts.FunctionLikeDeclaration }
            return bin.procs.filter(p => p.matches(id))[0]
        }

        function mkProcCall(decl: ts.Declaration, args: ir.Expr[]) {
            let proc = lookupProc(decl)
            assert(!!proc || !bin.finalPass, "!!proc || !bin.finalPass")
            return mkProcCallCore(proc, null, args)
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

            let keys = Object.keys(ifaceMembers)
            keys.sort(U.strcmp)
            keys.unshift("") // make sure idx=0 is invalid
            bin.emitString("")
            bin.ifaceMembers = keys
            ifaceMembers = {}
            let idx = 0
            for (let k of keys) {
                ifaceMembers[k] = idx++
            }

            for (let info of bin.usedClassInfos) {
                for (let e of info.itable) {
                    e.idx = getIfaceMemberId(e.name)
                }
            }

            let classNo = pxt.BuiltInType.User0
            const numberClasses = (i: ClassInfo) => {
                U.assert(!i.classNo)
                i.classNo = classNo++
                i.derivedClasses.forEach(numberClasses)
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
            return U.lookup(explicitlyUsedIfaceMembers, name) != null
        }

        function markClassUsed(info: ClassInfo) {
            if (info.isUsed) return
            info.isUsed = true
            if (info.baseClassInfo) markClassUsed(info.baseClassInfo)
            bin.usedClassInfos.push(info)
            for (let m of info.methods) {
                let minf = getFunctionInfo(m)
                if (isToString(m) ||
                    isIfaceMemberUsed(getName(m)) ||
                    (minf.virtualParent && minf.virtualParent.isUsed))
                    markFunctionUsed(m)
            }

            let ctor = getCtor(info.decl)
            if (ctor) {
                markFunctionUsed(ctor)
            }
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

                markClassUsed(info)

                let lbl = info.id + "_VT"
                let obj = ir.rtcall("pxt::mkClassInstance", [ir.ptrlit(lbl, lbl)])

                if (ctor) {
                    obj = sharedDef(obj)
                    markUsed(ctor)
                    let args = node.arguments.slice(0)
                    let ctorAttrs = parseComments(ctor)

                    let sig = checker.getResolvedSignature(node)
                    // TODO: can we have overloeads?
                    addDefaultParametersAndTypeCheck(checker.getResolvedSignature(node), args, ctorAttrs)
                    let compiled = args.map((x) => emitExpr(x))
                    if (ctorAttrs.shim) {
                        if (!noRefCounting())
                            U.userError("shim=... on constructor not supported right now")
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

            function parseHexLiteral(s: string) {
                let thisJres = currJres
                if (s[0] == '_' && s[1] == '_' && opts.jres[s]) {
                    thisJres = opts.jres[s]
                    s = ""
                }
                if (s == "" && thisJres) {
                    if (!thisJres.dataEncoding || thisJres.dataEncoding == "base64") {
                        s = U.toHex(U.stringToUint8Array(ts.pxtc.decodeBase64(thisJres.data)))
                    } else if (thisJres.dataEncoding == "hex") {
                        s = thisJres.data
                    } else {
                        userError(9271, lf("invalid jres encoding '{0}' on '{1}'",
                            thisJres.dataEncoding, thisJres.id))
                    }
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
                let lbl = bin.emitHexLiteral(res.toLowerCase())
                return ir.ptrlit(lbl, lbl)
            }
            let decl = getDecl(node.tag) as FunctionLikeDeclaration
            if (!decl)
                throw unhandled(node, lf("invalid tagged template"), 9265)
            let attrs = parseComments(decl)
            let res: ir.Expr

            let callInfo: CallInfo = {
                decl,
                qName: decl ? getFullName(checker, decl.symbol) : "?",
                args: [node.template],
                isExpression: true
            };
            (node as any).callInfo = callInfo;

            function handleHexLike(pp: (s: string) => string) {
                if (node.template.kind != SK.NoSubstitutionTemplateLiteral)
                    throw unhandled(node, lf("substitution not supported in hex literal", attrs.shim), 9265);
                res = parseHexLiteral(pp((node.template as ts.LiteralExpression).text))
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

        function emitFuncCore(node: FunctionLikeDeclaration) {
            let info = getFunctionInfo(node)
            let lit: ir.Expr = null

            let isExpression = node.kind == SK.ArrowFunction || node.kind == SK.FunctionExpression

            let caps = info.capturedVars.slice(0)
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
                assert(getEnclosingFunction(node) != null, "getEnclosingFunction(node) != null)")
                lit = ir.sharedNoIncr(ir.rtcall("pxt::mkAction", [ir.numlit(caps.length), emitFunLitCore(node, true)]))
                info.usedAsValue = true
                caps.forEach((l, i) => {
                    let loc = proc.localIndex(l)
                    if (!loc)
                        userError(9223, lf("cannot find captured value: {0}", checker.symbolToString(l.symbol)))
                    let v = loc.loadCore()
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
                    info.usedAsValue = true
                }
            }

            assert(!!lit == isExpression, "!!lit == isExpression")

            let id: ir.ProcQuery = { action: node }
            let existing = bin.procs.filter(p => p.matches(id))[0]

            if (existing) {
                proc = existing
                proc.reset()
            } else {
                assert(!bin.finalPass, "!bin.finalPass")
                proc = new ir.Procedure();
                proc.isRoot = !!(node as any).isRootFunction
                proc.action = node;
                proc.info = info;
                bin.addProc(proc);
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
                        if (f.kind == SK.PropertyDeclaration) {
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

            if (node.body.kind == SK.Block) {
                emit(node.body);
            } else {
                let v = emitExpr(node.body)
                proc.emitJmp(getLabels(node).ret, v, ir.JmpMode.Always)
            }

            proc.emitLblDirect(getLabels(node).ret)

            proc.stackEmpty();

            let lbl = proc.mkLabel("final")
            let hasRet = funcHasReturn(proc.action)
            if (hasRet) {
                let v = captureJmpValue()
                proc.emitClrs(lbl, v);
                proc.emitJmp(lbl, v, ir.JmpMode.Always)
            } else {
                proc.emitClrs(lbl, null);
            }
            if (hasRet)
                proc.emitLbl(lbl)

            // nothing should be on work list in final pass - everything should be already marked as used
            assert(!bin.finalPass || usedWorkList.length == 0, "!bin.finalPass || usedWorkList.length == 0")

            // otherwise, we emit everything that's left, but only at top level
            // to avoid unbounded stack
            if (proc.isRoot)
                while (usedWorkList.length > 0) {
                    let f = usedWorkList.pop()
                    emit(f)
                }

            return lit
        }

        function sharedDef(e: ir.Expr) {
            let v = ir.shared(e)
            // make sure we save it, but also don't leak ref-count
            proc.emitExpr(ir.op(EK.Decr, [v]))
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
            if (!isUsed(node))
                return undefined;

            let attrs = parseComments(node)
            if (attrs.shim != null) {
                if (attrs.shim[0] == "@")
                    return undefined;
                if (opts.target.isNative) {
                    hex.validateShim(getDeclName(node),
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

        function emitDeleteExpression(node: DeleteExpression) { }
        function emitTypeOfExpression(node: TypeOfExpression) {
            return rtcallMask("pxt::typeOf", [node.expression], null)
        }
        function emitVoidExpression(node: VoidExpression) { }
        function emitAwaitExpression(node: AwaitExpression) { }
        function emitPrefixUnaryExpression(node: PrefixUnaryExpression): ir.Expr {
            let tp = typeOf(node.operand)
            if (node.operator == SK.ExclamationToken) {
                return fromBool(ir.rtcall("Boolean_::bang", [emitCondition(node.operand)]))
            }

            if (isNumberType(tp)) {
                switch (node.operator) {
                    case SK.PlusPlusToken:
                        return emitIncrement(node.operand, "numops::adds", false)
                    case SK.MinusMinusToken:
                        return emitIncrement(node.operand, "numops::subs", false)
                    case SK.MinusToken: {
                        let inner = emitExpr(node.operand)
                        let v = valueToInt(inner)
                        if (v != null)
                            return emitLit(-v)
                        return emitIntOp("numops::subs", emitLit(0), inner)
                    }
                    case SK.PlusToken:
                        return emitExpr(node.operand) // no-op
                    case SK.TildeToken: {
                        let inner = emitExpr(node.operand)
                        let v = valueToInt(inner)
                        if (v != null)
                            return emitLit(~v)
                        return rtcallMaskDirect(mapIntOpName("numops::bnot"), [inner]);
                    }
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
            let attrs = parseComments(fld)
            return {
                idx: info.allfields.indexOf(fld),
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
                } else if (decl && (decl.kind == SK.PropertySignature || decl.kind == SK.PropertyAssignment || target.switches.slowFields)) {
                    proc.emitExpr(emitCallCore(trg, trg, [src], null, decl as FunctionLikeDeclaration))
                } else {
                    let trg2 = emitExpr(trg)
                    proc.emitExpr(ir.op(EK.Store, [trg2, emitExpr(src)]))
                }
            } else if (trg.kind == SK.ElementAccessExpression) {
                proc.emitExpr(emitIndexedAccess(trg as ElementAccessExpression, src))
            } else {
                unhandled(trg, lf("bad assignment target"), 9249)
            }
        }

        function handleAssignment(node: BinaryExpression) {
            let cleanup = prepForAssignment(node.left, node.right)
            emitStore(node.left, node.right, true)
            let res = emitExpr(node.right)
            cleanup()
            return res
        }

        function mapIntOpName(n: string) {
            if (opts.target.isNative && isThumb()) {
                switch (n) {
                    case "numops::adds":
                    case "numops::subs":
                    case "numops::eors":
                    case "numops::ands":
                    case "numops::orrs":
                        return "@nomask@" + n
                }
            }

            return n
        }

        function emitIntOp(op: string, left: ir.Expr, right: ir.Expr) {
            return rtcallMaskDirect(mapIntOpName(op), [left, right])
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
                if (opts.target.isNative) {
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
            }
            return undefined
        }

        function emitLit(v: number | boolean) {
            if (opts.target.isNative) {
                if (v === null) return ir.numlit(taggedNull)
                else if (v === undefined) return ir.numlit(taggedUndefined)
                else if (v === false) return ir.numlit(taggedFalse)
                else if (v === true) return ir.numlit(taggedTrue)
                else if (typeof v == "number") {
                    if (fitsTaggedInt(v as number)) {
                        return ir.numlit(((v as number) << 1) | 1)
                    } else if (v != v) {
                        return ir.numlit(taggedNaN)
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
                let vo: ir.Expr = (e as any).valueOverride
                if (vo !== undefined) {
                    if (vo.exprKind == EK.NumberLiteral) {
                        if (opts.target.isNative)
                            return !!((vo.data as number) & 1)
                        return true
                    } else if (vo.exprKind == EK.RuntimeCall && vo.data == "pxt::ptrOfLiteral") {
                        if (vo.args[0].exprKind == EK.PointerLiteral &&
                            !isNaN(parseFloat(vo.args[0].jsInfo)))
                            return true
                        return false
                    } else if (vo.exprKind == EK.PointerLiteral && !isNaN(parseFloat(vo.jsInfo))) {
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
            let inf = hex.lookupFunc(name)

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
                if (!opts.target.isNative)
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
                            refTag: t
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
            markClassUsed(info)
            let r = ir.op(ir.EK.InstanceOf, [emitExpr(node.left)], info)
            r.jsInfo = "bool"
            return r
        }

        function emitLazyBinaryExpression(node: BinaryExpression) {
            let left = emitExpr(node.left)
            let isString = isStringType(typeOf(node.left));
            let lbl = proc.mkLabel("lazy")

            left = ir.sharedNoIncr(left)
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
            // proc.emitExpr(ir.op(EK.Decr, [left])) - this gets optimized away

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
            if (opts.justMyCode && U.startsWith(src.fileName, "pxt_modules"))
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
                case SK.SlashToken: {
                    if (opts.warnDiv)
                        warning(node, 9274, "usage of / operator");
                    return "numops::div";
                }
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

            let lt = typeOf(node.left)
            let rt = typeOf(node.right)

            if (node.operatorToken.kind == SK.PlusToken || node.operatorToken.kind == SK.PlusEqualsToken) {
                if (isStringType(lt) || (isStringType(rt) && node.operatorToken.kind == SK.PlusToken)) {
                    (node as any).exprInfo = { leftType: checker.typeToString(lt), rightType: checker.typeToString(rt) } as BinaryExpressionInfo;
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

            if (node.declarationList.flags & NodeFlags.Const)
                for (let decl of node.declarationList.declarations) {
                    let nm = getDeclName(decl)
                    let parname = node.parent && node.parent.kind == SK.ModuleBlock ?
                        getName(node.parent.parent) : "?"

                    if (parname == "config" || parname == "userconfig") {
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
            // in all cases decr is internal, so no mask
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
            let a = typeOf(node)
            if (!(a.flags & TypeFlags.Void)) {
                if (v.exprKind == EK.SharedRef && v.data != "noincr") {
                    // skip decr - SharedRef would have introduced an implicit INCR
                } else {
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
            let iterVar = emitVariableDeclaration(declList.declarations[0]) // c
            //Start with undefined
            proc.emitExpr(iterVar.storeByRef(emitLit(undefined)))
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
                return ir.rtcall("pxt::toInt", [e])
            }

            // c = a[i]
            proc.emitExpr(iterVar.storeByRef(ir.rtcall(indexer, [collectionVar.loadCore(), toInt(intVarIter.loadCore())])))

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

            let expr = ir.sharedNoIncr(emitExpr(node.expression))

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

            // this is default case only - none of the switch_eq() succeded,
            // so there is an outstanding reference to expr
            proc.emitExpr(ir.op(EK.Decr, [expr]))

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
        function emitThrowStatement(node: ThrowStatement) { }
        function emitTryStatement(node: TryStatement) { }
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
        function emitVariableDeclaration(node: VarOrParam): ir.Cell {
            if (node.name.kind === SK.ObjectBindingPattern) {
                if (!node.initializer) {
                    (node.name as ObjectBindingPattern).elements.forEach((e: BindingElement) => emitVariableDeclaration(e))
                    return null;
                }
                else {
                    userError(9259, "Object destructuring with initializers is not supported")
                }
            }

            typeCheckVar(node)
            if (!isUsed(node)) {
                return null;
            }
            if (isConstLiteral(node))
                return null;
            let loc = isGlobalVar(node) ?
                lookupCell(node) : proc.mkLocal(node, getVarInfo(node))
            if (loc.isByRefLocal()) {
                proc.emitClrIfRef(loc) // we might be in a loop
                proc.emitExpr(loc.storeDirect(ir.rtcall("pxtrt::mklocRef", [])))
            }

            if (node.kind === SK.BindingElement) {
                emitBrk(node)
                let rhs = bindingElementAccessExpression(node as BindingElement)
                typeCheckSubtoSup(rhs[1], node)
                proc.emitExpr(loc.storeByRef(rhs[0]))
                proc.stackEmpty();
            }
            else if (node.initializer) {
                emitBrk(node)
                if (isGlobalVar(node)) {
                    let attrs = parseComments(node)
                    let jrname = attrs.jres
                    if (jrname) {
                        if (jrname == "true") {
                            jrname = getFullName(checker, node.symbol)
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

        function bindingElementAccessExpression(bindingElement: BindingElement): [ir.Expr, Type] {
            const target = bindingElement.parent.parent;

            let parentAccess: ir.Expr;
            let parentType: Type;

            if (target.kind === SK.BindingElement) {
                const parent = bindingElementAccessExpression(target as BindingElement);
                parentAccess = parent[0];
                parentType = parent[1];
            }
            else {
                parentType = typeOf(target);
            }

            const propertyName = (bindingElement.propertyName || bindingElement.name) as Identifier;

            if (isPossiblyGenericClassType(parentType)) {
                const info = getClassInfo(parentType)
                parentAccess = parentAccess || emitLocalLoad(target as VariableDeclaration);

                const myType = checker.getTypeOfSymbolAtLocation(checker.getPropertyOfType(parentType, propertyName.text), bindingElement);
                return [
                    ir.op(EK.FieldAccess, [parentAccess], fieldIndexCore(info, getFieldInfo(info, propertyName.text))),
                    myType
                ];
            } else {
                throw unhandled(bindingElement, lf("bad field access"), 9247)
            }
        }

        function emitClassDeclaration(node: ClassDeclaration) {
            getClassInfo(null, node)
            node.members.forEach(emit)
        }
        function emitInterfaceDeclaration(node: InterfaceDeclaration) {
            checkInterfaceDeclaration(node, classInfos)
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
                    let v = (node as any).valueOverride;
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
        sourceHash = "";
        checksumBlock: number[];
        numStmts = 1;
        commSize = 0;
        packedSource: string;
        itEntries = 0;
        itFullEntries = 0;
        numMethods = 0;
        numVirtMethods = 0;

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

        addProc(proc: ir.Procedure) {
            assert(!this.finalPass, "!this.finalPass")
            this.procs.push(proc)
            proc.seqNo = this.procs.length
            //proc.binary = this
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

    function isNumberLikeType(type: Type) {
        return !!(type.flags & (TypeFlags.NumberLike | TypeFlags.EnumLike | TypeFlags.BooleanLike))
    }
}
