export module py {
    // based on grammar at https://docs.python.org/3/library/ast.html
    export interface AST {
        lineno: number;
        col_offset: number;
        kind: string;
    }
    export interface Stmt extends AST {
        _stmtBrand: void;
    }
    export interface Expr extends AST {
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

    export interface FunctionDef extends Stmt {
        kind: "FunctionDef";
        name: identifier;
        args: Arguments;
        body: Stmt[];
        decorator_list: Expr[];
        returns?: Expr;
    }
    export interface AsyncFunctionDef extends Stmt {
        kind: "AsyncFunctionDef";
        name: identifier;
        args: Arguments;
        body: Stmt[];
        decorator_list: Expr[];
        returns?: Expr;
    }
    export interface ClassDef extends Stmt {
        kind: "ClassDef";
        name: identifier;
        bases: Expr[];
        keywords: Keyword[];
        body: Stmt[];
        decorator_list: Expr[];
    }
    export interface Return extends Stmt {
        kind: "Return";
        value?: Expr;
    }
    export interface Delete extends Stmt {
        kind: "Delete";
        targets: Expr[];
    }
    export interface Assign extends Stmt {
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


import * as nodeutil from './nodeutil';
import U = pxt.Util;
import B = pxt.blocks;

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

print(json.dumps(to_json(ast.parse(open("@file@", "r").read()))))
`

const nameMap: pxt.Map<string> = {
    "Expr": "ExprStmt",
    "arg": "Arg",
    "arguments": "Arguments",
    "keyword": "Keyword",
    "comprehension": "Comprehension",
    "alias": "Alias",
    "withitem": "WithItem"
}

const simpleNames: pxt.Map<boolean> = {
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
        cmt = cmt.replace(/\n/g, "\n * ") + "\n"
    return B.mkStmt(B.mkText("/** " + cmt + " */"))
}

interface VarDesc {
    expandsTo?: string;
    isImportStar?: boolean;
    isPlainImport?: boolean;
    isLocal?: boolean;
    isParam?: boolean;
}

let ctx = {
    currClass: null as py.ClassDef,
    currFun: null as py.FunctionDef,
    vars: {} as pxt.Map<VarDesc>,
}

function scope(f: () => B.JsNode) {
    let prevCtx = U.flatClone(ctx)
    prevCtx.vars = U.flatClone(ctx.vars)
    let r = f()
    ctx = prevCtx
    return r
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
    U.assert(!args.kwarg)
    U.assert(!args.vararg)
    U.assert(!args.kwonlyargs.length)
    let nargs = args.args.slice()
    if (isMethod) {
        U.assert(nargs[0].arg == "self")
        nargs.shift()
    } else {
        U.assert(nargs[0].arg != "self")
    }
    let didx = args.defaults.length - nargs.length
    let lst = nargs.map(a => {
        ctx.vars[a.arg] = { isParam: true }
        let res = [quote(a.arg)]
        if (a.annotation)
            res.push(todoExpr("annotation", expr(a.annotation)))
        if (didx >= 0) {
            res.push(B.mkText(" = "))
            res.push(expr(args.defaults[didx]))
        }
        didx++
        return B.mkGroup(res)
    })

    return B.H.mkParenthesizedExpression(B.mkCommaSep(lst))
}

const opMapping: pxt.Map<string> = {
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

const prefixOps: pxt.Map<string> = {
    Invert: "~",
    Not: "!",
    UAdd: "P+",
    USub: "P-",
}

function stmts(ss: py.Stmt[]) {
    return B.mkBlock(ss.map(stmt))
}

function exprs0(ee: py.Expr[]) {
    ee = ee.filter(e => !!e)
    return ee.map(expr)
}

const stmtMap: pxt.Map<(v: py.Stmt) => B.JsNode> = {
    FunctionDef: (n: py.FunctionDef) => scope(() => {
        let isMethod = !!ctx.currClass && !ctx.currFun
        ctx.currFun = n
        let nodes = [
            todoComment("decorators", n.decorator_list.map(expr))
        ]
        if (isMethod) {
            if (n.name == "__init__")
                nodes.push(B.mkText("constructor"))
            else if (n.name[0] == "_")
                nodes.push(B.mkText("private "), quote(n.name))
            else
                nodes.push(B.mkText("public "), quote(n.name))
        } else {
            if (n.name[0] == "_")
                nodes.push(B.mkText("function "), quote(n.name))
            else
                nodes.push(B.mkText("export function "), quote(n.name))
        }
        nodes.push(
            doArgs(n.args, isMethod),
            todoComment("returns", n.returns ? [expr(n.returns)] : []),
            stmts(n.body)
        )
        return B.mkStmt(B.mkGroup(nodes))
    }),

    ClassDef: (n: py.ClassDef) => scope(() => {
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
        }
        nodes.push(stmts(n.body))
        return B.mkStmt(B.mkGroup(nodes))
    }),

    Return: (n: py.Return) =>
        n.value ?
            B.mkStmt(B.mkText("return "), expr(n.value)) :
            B.mkStmt(B.mkText("return")),
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
        let trg = expr(n.targets[0])
        if (isCallTo(n.value, "const")) {
            return B.mkStmt(B.mkText("const "),
                B.mkInfix(trg, "=", expr((n.value as py.Call).args[0])))
        }
        return B.mkStmt(B.mkInfix(trg, "=", expr(n.value)))
    },
    For: (n: py.For) => {
        U.assert(n.orelse.length == 0)
        if (isCallTo(n.iter, "range")) {
            let r = n.iter as py.Call
            let def = expr(n.target)
            let start = r.args.length == 1 ? B.mkText("0") : expr(r.args[0])
            let stop = expr(r.args[r.args.length == 1 ? 0 : 1])
            return B.mkStmt(
                B.mkText("for ("),
                B.mkInfix(def, "=", start),
                B.mkText("; "),
                B.mkInfix(expr(n.target), "<", stop),
                B.mkText("; "),
                r.args.length >= 3 ?
                    B.mkInfix(expr(n.target), "+=", expr(r.args[2])) :
                    B.mkInfix(null, "++", expr(n.target)),
                B.mkText(")"),
                stmts(n.body))
        }
        return B.mkStmt(
            B.mkText("for ("),
            expr(n.target),
            B.mkText(" of "),
            expr(n.iter),
            B.mkText(")"),
            stmts(n.body))
    },
    While: (n: py.While) => stmtTODO(n),
    If: (n: py.If) => {
        let nodes = [
            B.mkText("if ("),
            expr(n.test),
            B.mkText(")"),
            stmts(n.body)
        ]
        if (n.orelse.length)
            nodes.push(B.mkText("else"), stmts(n.orelse))
        return B.mkStmt(B.mkGroup(nodes))
    },
    With: (n: py.With) => {
        let cleanup: B.JsNode[] = []
        let stmts = n.items.map((it, idx) => {
            let varName = "with" + idx
            if (it.optional_vars) {
                U.assert(it.optional_vars.kind == "Name")
                let id = (it.optional_vars as py.Name).id
                ctx.vars[id] = { isLocal: true }
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
    Raise: (n: py.Raise) => stmtTODO(n),
    Assert: (n: py.Assert) => B.mkStmt(B.H.mkCall("control.assert", exprs0([n.test, n.msg]))),
    Import: (n: py.Import) => {
        for (let nm of n.names) {
            if (nm.asname)
                ctx.vars[nm.asname] = {
                    expandsTo: nm.name
                }
            ctx.vars[nm.name] = {
                isPlainImport: true
            }
        }
        return B.mkText("")
    },
    ImportFrom: (n: py.ImportFrom) => {
        for (let nn of n.names) {
            if (nn.name == "*")
                ctx.vars[n.module] = {
                    isImportStar: true
                }
            else
                ctx.vars[nn.asname || nn.name] = {
                    expandsTo: n.module + "." + nn.name
                }
        }
        return B.mkText("")
    },
    ExprStmt: (n: py.ExprStmt) =>
        n.value.kind == "Str" ?
            docComment((n.value as py.Str).s) :
            B.mkStmt(expr(n.value)),
    Pass: (n: py.Pass) => B.mkStmt(B.mkText(";")),
    Break: (n: py.Break) => B.mkStmt(B.mkText("break")),
    Continue: (n: py.Continue) => B.mkStmt(B.mkText("break")),

    Delete: (n: py.Delete) => stmtTODO(n),
    Try: (n: py.Try) => stmtTODO(n),
    AnnAssign: (n: py.AnnAssign) => stmtTODO(n),
    AsyncFunctionDef: (n: py.AsyncFunctionDef) => stmtTODO(n),
    AsyncFor: (n: py.AsyncFor) => stmtTODO(n),
    AsyncWith: (n: py.AsyncWith) => stmtTODO(n),
    Global: (n: py.Global) =>
        B.mkStmt(B.mkText("TODO: global: "), B.mkGroup(n.names.map(B.mkText))),
    Nonlocal: (n: py.Nonlocal) =>
        B.mkStmt(B.mkText("TODO: nonlocal: "), B.mkGroup(n.names.map(B.mkText))),
}

function possibleDef(id: py.identifier) {
    let curr = U.lookup(ctx.vars, id)
    if (curr) return quote(id)
    if (ctx.currClass && !ctx.currFun)
        return quote(id) // field
    ctx.vars[id] = { isLocal: true }
    return B.mkGroup([B.mkText("let "), quote(id)])
}

function quoteStr(id: string) {
    if (B.isReservedWord(id))
        return id + "_"
    else
        return id
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
    if (c.func.kind != "Name")
        return false
    return (c.func as py.Name).id == fn
}

function binop(left: B.JsNode, pyName: string, right: B.JsNode) {
    let op = opMapping[pyName]
    U.assert(!!op)
    if (op.length > 3)
        return B.H.mkCall(op, [left, right])
    else
        return B.mkInfix(left, op, right)
}

const exprMap: pxt.Map<(v: py.Expr) => B.JsNode> = {
    BoolOp: (n: py.BoolOp) => {
        let r = expr(n.values[0])
        for (let i = 1; i < n.values.length; ++i) {
            r = binop(r, n.op, expr(n.values[i]))
        }
        return r
    },
    BinOp: (n: py.BinOp) => binop(expr(n.left), n.op, expr(n.right)),
    UnaryOp: (n: py.UnaryOp) => {
        let op = prefixOps[n.op]
        U.assert(!!op)
        return B.mkInfix(null, op, expr(n.operand))
    },
    Lambda: (n: py.Lambda) => exprTODO(n),
    IfExp: (n: py.IfExp) => exprTODO(n),
    Dict: (n: py.Dict) => exprTODO(n),
    Set: (n: py.Set) => exprTODO(n),
    ListComp: (n: py.ListComp) => exprTODO(n),
    SetComp: (n: py.SetComp) => exprTODO(n),
    DictComp: (n: py.DictComp) => exprTODO(n),
    GeneratorExp: (n: py.GeneratorExp) => exprTODO(n),
    Await: (n: py.Await) => exprTODO(n),
    Yield: (n: py.Yield) => exprTODO(n),
    YieldFrom: (n: py.YieldFrom) => exprTODO(n),
    Compare: (n: py.Compare) => {
        let r = binop(expr(n.left), n.ops[0], expr(n.comparators[0]))
        for (let i = 1; i < n.ops.length; ++i) {
            r = binop(r, "And", binop(expr(n.comparators[i - 1]), n.ops[i], expr(n.comparators[i])))
        }
        return r
    },
    Call: (n: py.Call) => {
        return B.mkGroup([
            expr(n.func),
            B.mkText("("),
            B.mkCommaSep(n.args.map(expr)),
            todoComment("keywords", n.keywords.map(k => expr(k.value))),
            B.mkText(")")
        ])
    },
    Num: (n: py.Num) => B.mkText(n.n + ""),
    Str: (n: py.Str) => B.mkText(B.stringLit(n.s)),
    FormattedValue: (n: py.FormattedValue) => exprTODO(n),
    JoinedStr: (n: py.JoinedStr) => exprTODO(n),
    Bytes: (n: py.Bytes) => exprTODO(n),
    NameConstant: (n: py.NameConstant) => B.mkText(JSON.stringify(n.value)),
    Ellipsis: (n: py.Ellipsis) => exprTODO(n),
    Constant: (n: py.Constant) => exprTODO(n),
    Attribute: (n: py.Attribute) => B.mkInfix(expr(n.value), ".", B.mkText(n.attr)),
    Subscript: (n: py.Subscript) => {
        U.assert(n.slice.kind == "Index")
        return B.mkGroup([
            expr(n.value),
            B.mkText("["),
            expr((n.slice as py.Index).value),
            B.mkText("]"),
        ])
    },
    Starred: (n: py.Starred) => B.mkGroup([B.mkText("... "), expr(n.value)]),
    Name: (n: py.Name) => {
        if (n.ctx.indexOf("Load") >= 0)
            return quote(n.id)
        else
            return possibleDef(n.id)
    },
    List: (n: py.List) => B.mkGroup([
        B.mkText("["),
        B.mkCommaSep(n.elts.map(expr)),
        B.mkText("]"),
    ]),
    Tuple: (n: py.Tuple) => B.mkGroup([
        B.mkText("["),
        B.mkCommaSep(n.elts.map(expr)),
        B.mkText("]"),
    ]),
}

function expr(e: py.Expr): B.JsNode {
    let f = exprMap[e.kind]
    if (!f) {
        U.oops(e.kind + " - unknown expr")
    }
    return f(e)
}

function stmt(e: py.Stmt): B.JsNode {
    let f = stmtMap[e.kind]
    if (!f) {
        U.oops(e.kind + " - unknown stmt")
    }
    return f(e)
}

// TODO based on lineno/col_offset mark which numbers are written in hex

export function convertAsync(fn: string) {
    return nodeutil.spawnWithPipeAsync({
        cmd: "python3",
        args: [],
        input: convPy.replace("@file@", fn),
        silent: true
    })
        .then(buf => {
            let js = JSON.parse(buf.toString("utf8"))
            let rec = (v: any): any => {
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
            js = rec(js)
            U.assert(js.kind == "Module")
            let nodes = js.body.map(stmt)
            let res = B.flattenNode(nodes)
            console.log(res.output)
        })
}
