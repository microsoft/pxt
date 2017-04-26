export module py {
    // based on grammar at https://docs.python.org/3/library/ast.html
    export interface AST {
        lineno: number;
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
            if not attr_name.startswith("_") and attr_name != "col_offset":
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
    return B.mkStmt(B.mkText("/** " + cmt.replace(/\n/g, "\n * ") + "\n */"))
}

const stmtMap: pxt.Map<(v: py.Stmt) => B.JsNode> = {
    FunctionDef: (n: py.FunctionDef) => stmtTODO(n),
    ClassDef: (n: py.ClassDef) => stmtTODO(n),
    Return: (n: py.Return) =>
        n.value ?
            B.mkStmt(B.mkText("return "), expr(n.value)) :
            B.mkStmt(B.mkText("return")),
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
    For: (n: py.For) => stmtTODO(n),
    While: (n: py.While) => stmtTODO(n),
    If: (n: py.If) => stmtTODO(n),
    With: (n: py.With) => stmtTODO(n),
    Raise: (n: py.Raise) => stmtTODO(n),
    Assert: (n: py.Assert) => stmtTODO(n),
    Import: (n: py.Import) => stmtTODO(n),
    ImportFrom: (n: py.ImportFrom) => stmtTODO(n),
    ExprStmt: (n: py.ExprStmt) =>
        n.value.kind == "Str" ?
            docComment((n.value as py.Str).s) :
            B.mkStmt(expr(n.value)),
    Pass: (n: py.Pass) => B.mkStmt(B.mkText(";")),
    Break: (n: py.Break) => B.mkStmt(B.mkText("break")),
    Continue: (n: py.Continue) => B.mkStmt(B.mkText("break")),

    Delete: (n: py.Delete) => stmtTODO(n),
    Try: (n: py.Try) => stmtTODO(n),
    AugAssign: (n: py.AugAssign) => stmtTODO(n),
    AnnAssign: (n: py.AnnAssign) => stmtTODO(n),
    AsyncFunctionDef: (n: py.AsyncFunctionDef) => stmtTODO(n),
    AsyncFor: (n: py.AsyncFor) => stmtTODO(n),
    AsyncWith: (n: py.AsyncWith) => stmtTODO(n),
    Global: (n: py.Global) =>
        B.mkStmt(B.mkText("TODO: global: "), B.mkGroup(n.names.map(B.mkText))),
    Nonlocal: (n: py.Nonlocal) =>
        B.mkStmt(B.mkText("TODO: nonlocal: "), B.mkGroup(n.names.map(B.mkText))),
}

function quote(id: py.identifier) {
    if (B.isReservedWord(id))
        return B.mkText(id + "_")
    return B.mkText(id)
}

function isCallTo(n: py.Expr, fn: string) {
    if (n.kind != "Call")
        return false
    let c = n as py.Call
    if (c.func.kind != "Name")
        return false
    return (c.func as py.Name).id == fn
}

const exprMap: pxt.Map<(v: py.Expr) => B.JsNode> = {
    BoolOp: (n: py.BoolOp) => exprTODO(n),
    BinOp: (n: py.BinOp) => exprTODO(n),
    UnaryOp: (n: py.UnaryOp) => exprTODO(n),
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
    Compare: (n: py.Compare) => exprTODO(n),
    Call: (n: py.Call) => {
        return exprTODO(n)
    },
    Num: (n: py.Num) => B.mkText(n.n + ""),
    Str: (n: py.Str) => B.mkText(B.stringLit(n.s)),
    FormattedValue: (n: py.FormattedValue) => exprTODO(n),
    JoinedStr: (n: py.JoinedStr) => exprTODO(n),
    Bytes: (n: py.Bytes) => exprTODO(n),
    NameConstant: (n: py.NameConstant) => exprTODO(n),
    Ellipsis: (n: py.Ellipsis) => exprTODO(n),
    Constant: (n: py.Constant) => exprTODO(n),
    Attribute: (n: py.Attribute) => exprTODO(n),
    Subscript: (n: py.Subscript) => exprTODO(n),
    Starred: (n: py.Starred) => exprTODO(n),
    Name: (n: py.Name) => quote(n.id),
    List: (n: py.List) => exprTODO(n),
    Tuple: (n: py.Tuple) => exprTODO(n),
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
