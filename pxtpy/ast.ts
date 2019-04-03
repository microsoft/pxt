/// <reference path='../built/pxtlib.d.ts' />
/// <reference path='../built/pxtcompiler.d.ts' />

namespace pxt.py {
    export interface ParameterDesc extends pxtc.ParameterDesc {
        pyType?: Type;
    }

    export interface SymbolInfo extends pxtc.SymbolInfo, VarDescOptions {
        pyRetType?: Type;
        pySymbolType?: Type;
        pyInstanceType?: Type;
        parameters: ParameterDesc[];
        pyAST?: AST;
        isProtected?: boolean;
        moduleTypeMarker?: {};
    }

    export interface TypeOptions {
        union?: Type;
        classType?: SymbolInfo; // instance type
        moduleType?: SymbolInfo; // class/static member type
        primType?: string;
        typeArgs?: Type[];
    }

    export interface Type extends TypeOptions {
        tid: number;
    }

    export interface VarDescOptions {
        expandsTo?: string;
        isImportStar?: boolean;
        isPlainImport?: boolean;
        isLocal?: boolean;
        isParam?: boolean;
        isImport?: SymbolInfo;
    }

    // based on grammar at https://docs.python.org/3/library/ast.html
    export interface AST {
        startPos?: number;
        endPos?: number;
        kind: string;
    }
    export interface Stmt extends AST {
        _stmtBrand: void;
        _comments?: Token[];
    }
    export interface Symbol extends Stmt {
        _symbolBrand: void;
        symInfo: SymbolInfo;
    }
    export interface Expr extends AST {
        tsType?: Type;
        symbolInfo?: SymbolInfo;
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

    export interface Module extends Symbol, ScopeDef {
        kind: "Module";
        body: Stmt[];
        name?: string;
        source: string;
        tsFilename: string;
        tsBody?: pxtc.SymbolInfo[];
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
        vars?: Map<SymbolInfo>;
        parent?: ScopeDef;
    }

    export interface FunctionDef extends Symbol, ScopeDef {
        kind: "FunctionDef";
        name: identifier;
        args: Arguments;
        body: Stmt[];
        decorator_list: Expr[];
        returns?: Expr;
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
        baseClass?: ClassDef;
        isEnum?: boolean;
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
    export interface AssignmentExpr extends Expr {
        ctx: expr_context;
    }
    export interface Attribute extends AssignmentExpr {
        kind: "Attribute";
        value: Expr;
        attr: identifier;
    }
    export interface Subscript extends AssignmentExpr {
        kind: "Subscript";
        value: Expr;
        slice: AnySlice;
    }
    export interface Starred extends AssignmentExpr {
        kind: "Starred";
        value: Expr;
    }
    export interface Name extends AssignmentExpr {
        kind: "Name";
        id: identifier;
        isdef?: boolean;
    }
    export interface List extends AssignmentExpr {
        kind: "List";
        elts: Expr[];
    }
    export interface Tuple extends AssignmentExpr {
        kind: "Tuple";
        elts: Expr[];
    }
}