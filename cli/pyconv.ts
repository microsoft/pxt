type Type = py.Type
type Map<T> = pxt.Map<T>;

import * as nodeutil from './nodeutil';
import * as fs from 'fs';
import U = pxt.Util;
import B = pxt.blocks;

namespace py {
    export interface TypeOptions {
        union?: Type;
        classType?: py.ClassDef;
        primType?: string;
        arrayType?: Type;
    }

    export interface Type extends TypeOptions {
        tid: number;
    }

    export interface FieldDesc {
        name: string;
        type: Type;
        inClass: py.ClassDef;
        fundef?: py.FunctionDef;
        isGetSet?: boolean;
        isStatic?: boolean;
        isProtected?: boolean;
        initializer?: py.Expr;
    }

    export interface VarDescOptions {
        expandsTo?: string;
        isImportStar?: boolean;
        isPlainImport?: boolean;
        isLocal?: boolean;
        isParam?: boolean;
        fundef?: py.FunctionDef;
        classdef?: py.ClassDef;
        isImport?: py.Module;
    }

    export interface VarDesc extends VarDescOptions {
        type: Type;
        name: string;
    }

    // based on grammar at https://docs.python.org/3/library/ast.html
    export interface AST {
        lineno: number;
        col_offset: number;
        startPos?: number;
        endPos?: number;
        kind: string;
    }
    export interface Stmt extends AST {
        _stmtBrand: void;
    }
    export interface Symbol extends Stmt {
        _symbolBrand: void;
    }
    export interface Expr extends AST {
        tsType?: Type;
        _exprBrand: void;
    }

    export type expr_context = "Load" | "Store" | "Del" | "AugLoad" | "AugStore" | "Param"
    export type boolop = "And" | "Or"
    export type operator = "Add" | "Sub" | "Mult" | "MatMult" | "Div" | "Mod" | "Pow"
        | "LShift" | "RShift" | "BitOr" | "BitXor" | "BitAnd" | "FloorDiv"
    export type unaryop = "Invert" | "Not" | "UAdd" | "USub"
    export type cmpop = "Eq" | "NotEq" | "Lt" | "LtE" | "Gt" | "GtE" | "Is" | "IsNot" | "In" | "NotIn"

    export type identifier = string
    export type int = number

    export interface Arg extends AST {
        kind: "Arg";
        arg: identifier;
        annotation?: Expr;
        type?: Type;
    }

    export interface Arguments extends AST {
        kind: "Arguments";
        args: Arg[];
        vararg?: Arg;
        kwonlyargs: Arg[];
        kw_defaults: Expr[];
        kwarg?: Arg;
        defaults: Expr[];
    }

    // keyword arguments supplied to call (NULL identifier for **kwargs)
    export interface Keyword extends AST {
        kind: "Keyword";
        arg?: identifier;
        value: Expr;
    }

    export interface Comprehension extends AST {
        kind: "Comprehension";
        target: Expr;
        iter: Expr;
        ifs: Expr[];
        is_async: int;
    }

    export interface Module extends Symbol, ScopeDef {
        kind: "Module";
        body: Stmt[];
        name?: string;
        source?: string[];
        comments?: string[];
    }

    export interface ExceptHandler extends AST {
        kind: "ExceptHandler";
        type?: Expr;
        name?: identifier;
        body: Stmt[];
    }

    // import name with optional 'as' alias.
    export interface Alias extends AST {
        kind: "Alias";
        name: identifier;
        asname?: identifier;
    }

    export interface WithItem extends AST {
        kind: "WithItem";
        context_expr: Expr;
        optional_vars?: Expr;
    }

    export interface AnySlice extends AST {
        _anySliceBrand: void;
    }
    export interface Slice extends AnySlice {
        kind: "Slice";
        lower?: Expr;
        upper?: Expr;
        step?: Expr;
    }
    export interface ExtSlice extends AnySlice {
        kind: "ExtSlice";
        dims: AnySlice[];
    }
    export interface Index extends AnySlice {
        kind: "Index";
        value: Expr;
    }

    export interface ScopeDef extends Stmt {
        vars?: Map<VarDesc>;
        parent?: ScopeDef;
    }

    export interface FunctionDef extends Symbol, ScopeDef {
        kind: "FunctionDef";
        name: identifier;
        args: Arguments;
        body: Stmt[];
        decorator_list: Expr[];
        returns?: Expr;
        retType?: Type;
        alwaysThrows?: boolean;
    }
    export interface AsyncFunctionDef extends Stmt {
        kind: "AsyncFunctionDef";
        name: identifier;
        args: Arguments;
        body: Stmt[];
        decorator_list: Expr[];
        returns?: Expr;
    }
    export interface ClassDef extends Symbol, ScopeDef {
        kind: "ClassDef";
        name: identifier;
        bases: Expr[];
        keywords: Keyword[];
        body: Stmt[];
        decorator_list: Expr[];
        fields?: Map<FieldDesc>;
        baseClass?: ClassDef;
    }
    export interface Return extends Stmt {
        kind: "Return";
        value?: Expr;
    }
    export interface Delete extends Stmt {
        kind: "Delete";
        targets: Expr[];
    }
    export interface Assign extends Symbol {
        kind: "Assign";
        targets: Expr[];
        value: Expr;
    }
    export interface AugAssign extends Stmt {
        kind: "AugAssign";
        target: Expr;
        op: operator;
        value: Expr;
    }
    export interface AnnAssign extends Stmt {
        kind: "AnnAssign";
        target: Expr;
        annotation: Expr;
        value?: Expr;
        simple: int; // 'simple' indicates that we annotate simple name without parens

    }
    export interface For extends Stmt {
        kind: "For";
        target: Expr;
        iter: Expr;
        body: Stmt[];
        orelse: Stmt[]; // use 'orelse' because else is a keyword in target languages
    }
    export interface AsyncFor extends Stmt {
        kind: "AsyncFor";
        target: Expr;
        iter: Expr;
        body: Stmt[];
        orelse: Stmt[];
    }
    export interface While extends Stmt {
        kind: "While";
        test: Expr;
        body: Stmt[];
        orelse: Stmt[];
    }
    export interface If extends Stmt {
        kind: "If";
        test: Expr;
        body: Stmt[];
        orelse: Stmt[];
    }
    export interface With extends Stmt {
        kind: "With";
        items: WithItem[];
        body: Stmt[];
    }
    export interface AsyncWith extends Stmt {
        kind: "AsyncWith";
        items: WithItem[];
        body: Stmt[];
    }
    export interface Raise extends Stmt {
        kind: "Raise";
        exc?: Expr;
        cause?: Expr;
    }
    export interface Try extends Stmt {
        kind: "Try";
        body: Stmt[];
        handlers: ExceptHandler[];
        orelse: Stmt[];
        finalbody: Stmt[];
    }
    export interface Assert extends Stmt {
        kind: "Assert";
        test: Expr;
        msg?: Expr;
    }
    export interface Import extends Stmt {
        kind: "Import";
        names: Alias[];
    }
    export interface ImportFrom extends Stmt {
        kind: "ImportFrom";
        module?: identifier;
        names: Alias[];
        level?: int;
    }
    export interface Global extends Stmt {
        kind: "Global";
        names: identifier[];
    }
    export interface Nonlocal extends Stmt {
        kind: "Nonlocal";
        names: identifier[];
    }
    export interface ExprStmt extends Stmt {
        kind: "ExprStmt";
        value: Expr;
    }
    export interface Pass extends Stmt {
        kind: "Pass";
    }
    export interface Break extends Stmt {
        kind: "Break";
    }
    export interface Continue extends Stmt {
        kind: "Continue";
    }


    export interface BoolOp extends Expr {
        kind: "BoolOp";
        op: boolop;
        values: Expr[];
    }
    export interface BinOp extends Expr {
        kind: "BinOp";
        left: Expr;
        op: operator;
        right: Expr;
    }
    export interface UnaryOp extends Expr {
        kind: "UnaryOp";
        op: unaryop;
        operand: Expr;
    }
    export interface Lambda extends Expr {
        kind: "Lambda";
        args: Arguments;
        body: Expr;
    }
    export interface IfExp extends Expr {
        kind: "IfExp";
        test: Expr;
        body: Expr;
        orelse: Expr;
    }
    export interface Dict extends Expr {
        kind: "Dict";
        keys: Expr[];
        values: Expr[];
    }
    export interface Set extends Expr {
        kind: "Set";
        elts: Expr[];
    }
    export interface ListComp extends Expr {
        kind: "ListComp";
        elt: Expr;
        generators: Comprehension[];
    }
    export interface SetComp extends Expr {
        kind: "SetComp";
        elt: Expr;
        generators: Comprehension[];
    }
    export interface DictComp extends Expr {
        kind: "DictComp";
        key: Expr;
        value: Expr;
        generators: Comprehension[];
    }
    export interface GeneratorExp extends Expr {
        kind: "GeneratorExp";
        elt: Expr;
        generators: Comprehension[];
    }
    export interface Await extends Expr {
        kind: "Await";
        value: Expr;
    }
    export interface Yield extends Expr {
        kind: "Yield";
        value?: Expr;
    }
    export interface YieldFrom extends Expr {
        kind: "YieldFrom";
        value: Expr;
    }
    // need sequences for compare to distinguish between x < 4 < 3 and (x < 4) < 3
    export interface Compare extends Expr {
        kind: "Compare";
        left: Expr;
        ops: cmpop[];
        comparators: Expr[];
    }
    export interface Call extends Expr {
        kind: "Call";
        func: Expr;
        args: Expr[];
        keywords: Keyword[];
    }
    export interface Num extends Expr {
        kind: "Num";
        n: number;
        ns: string;
    }
    export interface Str extends Expr {
        kind: "Str";
        s: string;
    }
    export interface FormattedValue extends Expr {
        kind: "FormattedValue";
        value: Expr;
        conversion?: int;
        format_spec?: Expr;
    }
    export interface JoinedStr extends Expr {
        kind: "JoinedStr";
        values: Expr[];
    }
    export interface Bytes extends Expr {
        kind: "Bytes";
        s: number[];
    }
    export interface NameConstant extends Expr {
        kind: "NameConstant";
        value: boolean; // null=None, True, False
    }
    export interface Ellipsis extends Expr {
        kind: "Ellipsis";
    }
    export interface Constant extends Expr {
        kind: "Constant";
        value: any; // ??? 
    }

    // the following expression can appear in assignment context
    export interface AssignmentExpr extends Expr { }
    export interface Attribute extends AssignmentExpr {
        kind: "Attribute";
        value: Expr;
        attr: identifier;
        ctx: expr_context;
    }
    export interface Subscript extends AssignmentExpr {
        kind: "Subscript";
        value: Expr;
        slice: AnySlice;
        ctx: expr_context;
    }
    export interface Starred extends AssignmentExpr {
        kind: "Starred";
        value: Expr;
        ctx: expr_context;
    }
    export interface Name extends AssignmentExpr {
        kind: "Name";
        id: identifier;
        ctx: expr_context;
        isdef?: boolean;
    }
    export interface List extends AssignmentExpr {
        kind: "List";
        elts: Expr[];
        ctx: expr_context;
    }
    export interface Tuple extends AssignmentExpr {
        kind: "Tuple";
        elts: Expr[];
        ctx: expr_context;
    }
}


/* tslint:disable:no-trailing-whitespace */
const convPy = `
import ast
import sys
import json

def to_json(val):
    if val is None or isinstance(val, (bool, str, int, float)):
        return val
    if isinstance(val, list):
        return [to_json(x) for x in val]
    if isinstance(val, ast.AST):
        js = dict()
        js['kind'] = val.__class__.__name__
        for attr_name in dir(val):
            if not attr_name.startswith("_"):
                js[attr_name] = to_json(getattr(val, attr_name))
        return js    
    if isinstance(val, (bytearray, bytes)):
        return [x for x in val]
    raise Exception("unhandled: %s (type %s)" % (val, type(val)))

js = dict()
for fn in @files@:
    js[fn] = to_json(ast.parse(open(fn, "r").read()))
print(json.dumps(js))
`
/* tslint:enable:no-trailing-whitespace */

const nameMap: Map<string> = {
    "Expr": "ExprStmt",
    "arg": "Arg",
    "arguments": "Arguments",
    "keyword": "Keyword",
    "comprehension": "Comprehension",
    "alias": "Alias",
    "withitem": "WithItem"
}

const simpleNames: Map<boolean> = {
    "Load": true, "Store": true, "Del": true, "AugLoad": true, "AugStore": true, "Param": true, "And": true,
    "Or": true, "Add": true, "Sub": true, "Mult": true, "MatMult": true, "Div": true, "Mod": true, "Pow": true,
    "LShift": true, "RShift": true, "BitOr": true, "BitXor": true, "BitAnd": true, "FloorDiv": true,
    "Invert": true, "Not": true, "UAdd": true, "USub": true, "Eq": true, "NotEq": true, "Lt": true, "LtE": true,
    "Gt": true, "GtE": true, "Is": true, "IsNot": true, "In": true, "NotIn": true,
}

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

let moduleAst: Map<py.Module> = {}

function lookupSymbol(name: string): py.Symbol {
    if (!name) return null
    if (moduleAst[name])
        return moduleAst[name]
    let parts = name.split(".")
    if (parts.length >= 2) {
        let last = parts.length - 1
        let par = moduleAst[parts.slice(0, last).join(".")]
        let ename = parts[last]
        if (par) {
            for (let stmt of par.body) {
                if (stmt.kind == "ClassDef" || stmt.kind == "FunctionDef") {
                    if ((stmt as py.FunctionDef).name == ename)
                        return stmt as py.FunctionDef
                }
                if (stmt.kind == "Assign") {
                    let assignment = stmt as py.Assign
                    if (assignment.targets.length == 1 && getName(assignment.targets[0]) == ename) {
                        return assignment
                    }
                }
            }
        }
    }
    return null
}

interface Ctx {
    currModule: py.Module;
    currClass: py.ClassDef;
    currFun: py.FunctionDef;
}

let ctx: Ctx
let currIteration = 0

let typeId = 0
let numUnifies = 0
function mkType(o: py.TypeOptions = {}) {
    let r: Type = U.flatClone(o) as any
    r.tid = ++typeId
    return r
}

function currentScope(): py.ScopeDef {
    return ctx.currFun || ctx.currClass || ctx.currModule
}

function defvar(n: string, opts: py.VarDescOptions) {
    let scopeDef = currentScope()
    let v = scopeDef.vars[n]
    if (!v) {
        v = scopeDef.vars[n] = { type: mkType(), name: n }
    }
    for (let k of Object.keys(opts)) {
        (v as any)[k] = (opts as any)[k]
    }
    return v
}

let tpString: Type = mkType({ primType: "string" })
let tpNumber: Type = mkType({ primType: "number" })
let tpBoolean: Type = mkType({ primType: "boolean" })
let tpBuffer: Type = mkType({ primType: "Buffer" })
let tpVoid: Type = mkType({ primType: "void" })


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
        return applyTypeMap(getFullName(t.classType))
    else if (t.arrayType)
        return t2s(t.arrayType) + "[]"
    else
        return "?" + t.tid
}

let currErrs = ""

function error(t0: Type, t1: Type) {
    currErrs += "types not compatible: " + t2s(t0) + " and " + t2s(t1) + "; "
}

function typeCtor(t: Type): any {
    if (t.primType) return t.primType
    else if (t.classType) return t.classType
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

function unifyClass(t: Type, cd: py.ClassDef) {
    t = find(t)
    if (t.classType == cd) return
    if (isFree(t)) {
        t.classType = cd
        return
    }
    unify(t, mkType({ classType: cd }))
}

function unify(t0: Type, t1: Type): void {
    t0 = find(t0)
    t1 = find(t1)
    if (t0 === t1)
        return
    if (!canUnify(t0, t1)) {
        error(t0, t1)
        return
    }
    if (typeCtor(t0) && !typeCtor(t1))
        return unify(t1, t0)
    numUnifies++
    t0.union = t1
    if (t0.arrayType && t1.arrayType)
        unify(t0.arrayType, t1.arrayType)
}

function getClassField(ct: py.ClassDef, n: string, checkOnly = false, skipBases = false) {
    if (!ct.fields)
        ct.fields = {}
    if (!ct.fields[n]) {
        if (!skipBases)
            for (let par = ct.baseClass; par; par = par.baseClass) {
                if (par.fields && par.fields[n])
                    return par.fields[n]
            }
        if (checkOnly) return null
        ct.fields[n] = {
            inClass: ct,
            name: n,
            type: mkType()
        }
    }
    return ct.fields[n]
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
    return null
}

function getClassDef(e: py.Expr) {
    let n = getName(e)
    let v = lookupVar(n)
    if (v)
        return v.classdef
    let s = lookupSymbol(n)
    if (s && s.kind == "ClassDef")
        return s as py.ClassDef
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
        if (!a.type) a.type = v.type
        let res = [quote(a.arg), typeAnnot(v.type)]
        if (a.annotation)
            res.push(todoExpr("annotation", expr(a.annotation)))
        if (didx >= 0) {
            res.push(B.mkText(" = "))
            res.push(expr(args.defaults[didx]))
            unify(a.type, typeOf(args.defaults[didx]))
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
            let fd = getClassField(ctx.currClass, funname, false, true)
            if (n.body.length == 1 && n.body[0].kind == "Raise")
                n.alwaysThrows = true
            if (n.name == "__init__") {
                nodes.push(B.mkText("constructor"))
                unifyClass(n.retType, ctx.currClass)
            } else {
                if (funname == "__get__" || funname == "__set__") {
                    let i2cArg = "i2cDev"
                    let vv = n.vars[i2cArg]
                    if (vv) {
                        let i2cDevClass =
                            lookupSymbol("adafruit_bus_device.i2c_device.I2CDevice") as py.ClassDef
                        if (i2cDevClass)
                            unifyClass(vv.type, i2cDevClass)
                    }
                    vv = n.vars["value"]
                    if (funname == "__set__" && vv) {
                        let cf = getClassField(ctx.currClass, "__get__")
                        if (cf.fundef)
                            unify(vv.type, cf.fundef.retType)
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
            fd.fundef = n
        } else {
            U.assert(!prefix)
            if (n.name[0] == "_")
                nodes.push(B.mkText("function "), quote(funname))
            else
                nodes.push(B.mkText("export function "), quote(funname))
        }
        nodes.push(
            doArgs(n.args, isMethod),
            n.name == "__init__" ? B.mkText("") : typeAnnot(n.retType),
            todoComment("returns", n.returns ? [expr(n.returns)] : []))

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
        ctx.currClass = n
        let nodes = [
            todoComment("keywords", n.keywords.map(doKeyword)),
            todoComment("decorators", n.decorator_list.map(expr)),
            B.mkText("export class "),
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
            if (f) unify(f.retType, typeOf(n.value))
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
        if (!ctx.currClass && !ctx.currFun && nm[0] != "_")
            pref = "export "
        if (nm && ctx.currClass && !ctx.currFun) {
            // class fields can't be const
            isConstCall = false;
            let src = expr(n.value)
            let fd = getClassField(ctx.currClass, nm)
            let attrTp = typeOf(n.value)
            let getter = getTypeField(attrTp, "__get__", true)
            if (getter) {
                unify(fd.type, getter.fundef.retType)
                let implNm = "_" + nm
                let fdBack = getClassField(ctx.currClass, implNm)
                unify(fdBack.type, attrTp)
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
            } else if (currIteration < 2) {
                return B.mkText("/* skip for now */")
            }
            unify(fd.type, typeOf(n.targets[0]))
            fd.isStatic = true
            pref = "static "
        }
        unify(typeOf(n.targets[0]), typeOf(n.value))
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
            unify(typeOf(n.target), tpNumber)
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
        unify(typeOf(n.iter), mkType({ arrayType: typeOf(n.target) }))
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
                unify(typeOf(it.context_expr), v.type)
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
            defvar(nm.name, {
                isPlainImport: true
            })
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
                let sym = lookupSymbol(fullname)
                let currname = nn.asname || nn.name
                if (sym && sym.kind == "Module") {
                    defvar(currname, {
                        isImport: sym as py.Module,
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
        unify(n.tsType, curr.type)
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

let funMap: Map<FunOverride> = {
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

function sourceAt(e: py.AST) {
    return (ctx.currModule.source[e.lineno - 1] || "").slice(e.col_offset)
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
        let r = binop(expr(n.left), n.op, expr(n.right))
        if (numOps[n.op]) {
            unify(typeOf(n.left), tpNumber)
            unify(typeOf(n.right), tpNumber)
            unify(n.tsType, tpNumber)
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
                unify(typeOf(n.left), tpString)
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
                if (field) {
                    if (isSuper(recv) || (isThis(recv) && field.inClass != ctx.currClass)) {
                        field.isProtected = true
                    }
                }
                if (field && field.fundef)
                    fd = field.fundef
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
                unify(typeOf(e), fdargs[i].type)
            }
        }

        if (fd) {
            unify(typeOf(n), fd.retType)
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

                if (recv && isOfType(recv, "pins.I2CDevice")) {
                    let stopArg: B.JsNode = null
                    let startArg: B.JsNode = null
                    let endArg: B.JsNode = null

                    keywords = keywords.filter(kw => {
                        if (kw.arg == "stop") {
                            if (kw.value.kind == "NameConstant") {
                                let vv = (kw.value as py.NameConstant).value
                                if (vv === false)
                                    stopArg = B.mkText("true")
                                else
                                    stopArg = B.mkText("false")
                            } else {
                                stopArg = B.mkInfix(null, "!", expr(kw.value))
                            }
                            return false
                        } else if (kw.arg == "start") {
                            startArg = expr(kw.value)
                            return false
                        } else if (kw.arg == "end") {
                            endArg = expr(kw.value)
                            return false
                        }
                        return true
                    })

                    if (endArg && !startArg) startArg = B.mkText("0")

                    if (methName == "read_into") {
                        if (startArg) {
                            allargs.push(stopArg || B.mkText("false"))
                            allargs.push(startArg)
                        }
                        if (endArg) allargs.push(endArg)
                    } else {
                        if (stopArg) allargs.push(stopArg)
                        if (startArg || endArg) {
                            allargs[0] = B.mkInfix(allargs[0], ".", B.H.mkCall("slice",
                                endArg ? [startArg, endArg] : [startArg]))
                        }
                    }
                }
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
                unifyClass(n.tsType, ctx.currClass.baseClass)
            return B.mkText("super")
        }

        if (over != null) {
            if (recv)
                allargs.unshift(expr(recv))
            let overName = over.n
            if (over.t)
                unify(typeOf(n), over.t)
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
                unify(typeOf(n.args[0]), recvTp.arrayType)
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
        unify(n.tsType, tpNumber)
        let src = sourceAt(n)
        let m = /^(0[box][0-9a-f]+)/i.exec(src)
        if (m)
            return B.mkText(m[1])
        return B.mkText(n.n + "")
    },
    Str: (n: py.Str) => {
        unify(n.tsType, tpString)
        return B.mkText(B.stringLit(n.s))
    },
    FormattedValue: (n: py.FormattedValue) => exprTODO(n),
    JoinedStr: (n: py.JoinedStr) => exprTODO(n),
    Bytes: (n: py.Bytes) => {
        return B.mkText(`hex \`${U.toHex(new Uint8Array(n.s))}\``)
    },
    NameConstant: (n: py.NameConstant) => {
        if (n.value != null)
            unify(n.tsType, tpBoolean)
        return B.mkText(JSON.stringify(n.value))
    },
    Ellipsis: (n: py.Ellipsis) => exprTODO(n),
    Constant: (n: py.Constant) => exprTODO(n),
    Attribute: (n: py.Attribute) => {
        let part = typeOf(n.value)
        let fd = getTypeField(part, n.attr)
        if (fd) unify(n.tsType, fd.type)
        return B.mkInfix(expr(n.value), ".", B.mkText(quoteStr(n.attr)))
    },
    Subscript: (n: py.Subscript) => {
        if (n.slice.kind == "Index") {
            let idx = (n.slice as py.Index).value
            if (currIteration > 2 && isFree(typeOf(idx))) {
                unify(typeOf(idx), tpNumber)
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
        if (n.id == "self" && ctx.currClass) {
            unifyClass(n.tsType, ctx.currClass)
        } else {
            let v = lookupVar(n.id)
            if (v) {
                unify(n.tsType, v.type)
                if (v.isImport)
                    return quote(n.id) // it's import X = Y.Z.X, use X not Y.Z.X
            }
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
    unify(n.tsType, mkType({ arrayType: n.elts[0] ? typeOf(n.elts[0]) : mkType() }))
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

    let cmts: string[] = []
    let scmts = ctx.currModule.comments
    if (scmts) {
        for (let i = 0; i < e.lineno; ++i) {
            if (scmts[i]) {
                cmts.push(scmts[i])
                scmts[i] = null
            }
        }
    }

    let r = f(e)
    if (currErrs) {
        cmts.push("TODO: (below) " + currErrs)
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
    resetCtx(mod)
    if (!mod.vars) mod.vars = {}
    let res = mod.body.map(stmt)
    if (res.every(isEmpty)) return null
    return [
        B.mkText("namespace " + mod.name + " "),
        B.mkBlock(res)
    ]
}

function parseComments(mod: py.Module) {
    mod.comments = mod.source.map(l => {
        let m = /(\s|^)#\s*(.*)/.exec(l)
        if (m) return m[2]
        return null
    })
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

function parseWithPythonAsync(files: string[]) {
    return nodeutil.spawnWithPipeAsync({
        cmd: process.env["PYTHON3"] || (/^win/i.test(process.platform) ? "py" : "python3"),
        args: [],
        input: convPy.replace("@files@", JSON.stringify(files)),
        silent: true
    })
        .then(buf => {
            pxt.debug(`analyzing python AST (${buf.length} bytes)`)
            let js = JSON.parse(buf.toString("utf8"))
            // nodeutil.writeFileSync("pyast.json", JSON.stringify(js, null, 2), { encoding: "utf8" })
            const rec = (v: any): any => {
                if (Array.isArray(v)) {
                    for (let i = 0; i < v.length; ++i)
                        v[i] = rec(v[i])
                    return v
                }
                if (!v || !v.kind)
                    return v
                v.kind = U.lookup(nameMap, v.kind) || v.kind
                if (U.lookup(simpleNames, v.kind))
                    return v.kind
                for (let k of Object.keys(v)) {
                    v[k] = rec(v[k])
                }
                return v
            }
            js.kind = "FileSet"
            js = rec(js)
            delete js.kind
            //nodeutil.writeFileSync("pyast2.json", JSON.stringify(js, null, 2), { encoding: "utf8" })
            return js
        })

}

export function convertAsync(fns: string[], useInternal = false) {
    let mainFiles: string[] = []
    while (/\.py$/.test(fns[0])) {
        mainFiles.push(fns.shift().replace(/\\/g, "/"))
    }

    if (useInternal) {
        return parseWithPythonAsync(mainFiles)
            .then(parsedPy => {
                for (let f of mainFiles) {
                    pxt.log(`parse: ${f}`)
                    let source = fs.readFileSync(f, "utf8")
                    let tokens = pxt.py.lex(source)
                    //console.log(pxt.py.tokensToString(tokens))
                    let res = pxt.py.parse(source, f, tokens)
                    let custompy = pxt.py.dump(res.stmts, true)
                    let realpy = pxt.py.dump(parsedPy[f].body, true)
                    let path = "tmp/"
                    if (custompy != realpy) {
                        fs.writeFileSync(path + "pxtpy.txt", custompy)
                        fs.writeFileSync(path + "realpy.txt", realpy)
                        fs.writeFileSync(path + "realpy.json", JSON.stringify(parsedPy[f]))
                        return nodeutil.spawnWithPipeAsync({
                            cmd: "diff",
                            args: ["-u", path + "pxtpy.txt", path + "realpy.txt"],
                            input: "",
                            silent: true,
                            allowNonZeroExit: true
                        })
                            .then(buf => {
                                fs.writeFileSync(path + "diff.patch", buf)
                                console.log(`Differences at ${f}; files written in ${path}`)
                            })
                    }
                }
                return Promise.resolve()
            })
    }

    let primFiles =
        U.toDictionary(mainFiles.length ? mainFiles : nodeutil.allFiles(fns[0]),
            s => s.replace(/\\/g, "/"))
    let files = U.concat(fns.map(f => nodeutil.allFiles(f))).map(f => f.replace(/\\/g, "/"));
    let dirs: Map<number> = {};
    for (let f of files) {
        for (let suff of ["/docs/conf.py", "/conf.py", "/setup.py", "/README.md", "/README.rst", "/__init__.py"]) {
            if (U.endsWith(f, suff)) {
                const dirName = f.slice(0, f.length - suff.length);
                dirs[dirName] = 1;
            }
        }
    }
    let pkgFiles: Map<string> = {}
    for (let f of files) {
        if (U.endsWith(f, ".py") && !U.endsWith(f, "/setup.py") && !U.endsWith(f, "/conf.py")) {
            let par = f
            while (par) {
                if (dirs[par]) {
                    let modName = f.slice(par.length + 1).replace(/\.py$/, "").replace(/\//g, ".")
                    if (!U.startsWith(modName, "examples.")) {
                        pkgFiles[f] = modName
                    }
                    break
                }
                par = par.replace(/\/?[^\/]*$/, "")
            }
        }
    }

    for (let m of mainFiles) {
        pkgFiles[m] = m.replace(/.*\//, "").replace(/\.py$/, "")
    }

    const pkgFilesKeys = Object.keys(pkgFiles);
    pxt.log(`files (${pkgFilesKeys.length}):\n   ${pkgFilesKeys.join('\n   ')}`);

    return parseWithPythonAsync(pkgFilesKeys)
        .then(js => {
            moduleAst = {}
            U.iterMap(js, (fn: string, js: py.Module) => {
                let mname = pkgFiles[fn]
                js.name = mname
                js.source = fs.readFileSync(fn, "utf8").split(/\r?\n/)
                moduleAst[mname] = js
            })

            for (let i = 0; i < 5; ++i) {
                currIteration = i
                U.iterMap(js, (fn: string, js: any) => {
                    pxt.log(`converting ${fn}`);
                    try {
                        toTS(js)
                    } catch (e) {
                        console.log(e);
                    }
                })
            }

            let files: pxt.Map<string> = {}

            currIteration = 1000
            U.iterMap(js, (fn: string, js: py.Module) => {
                if (primFiles[fn]) {
                    pxt.debug(`converting ${fn}`)
                    let s = "//\n// *** " + fn + " ***\n//\n\n"
                    parseComments(js)
                    let nodes = toTS(js)
                    if (!nodes) return
                    let res = B.flattenNode(nodes)
                    s += res.output
                    let fn2 = js.name.replace(/\..*/, "") + ".ts"
                    files[fn2] = (files[fn2] || "") + s
                } else {
                    pxt.debug(`skipping ${fn}`)
                }
            })

            U.iterMap(files, (fn, s) => {
                pxt.log("*** write " + fn)
                fs.writeFileSync(fn, s)
            })
        })
}
