///<reference path='../built/blockly.d.ts'/>
/// <reference path="../built/pxtlib.d.ts" />


///////////////////////////////////////////////////////////////////////////////
//                A compiler from Blocky to TouchDevelop                     //
///////////////////////////////////////////////////////////////////////////////

import B = Blockly;

namespace pxt.blocks {
    enum NT {
        Prefix, // op + map(children)
        Infix, // children.length == 2, child[0] op child[1]
        Block, // { } are implicit
        NewLine
    }

    interface Node {
        type: NT;
        children: Node[];
        op: string;
        id?: string;
        glueToBlock?: boolean;
        canIndentInside?: boolean;
        noFinalNewline?: boolean;
    }

    const MAX_COMMENT_LINE_LENGTH = 50;


    function stringLit(s: string) {
        if (s.length > 20 && /\n/.test(s))
            return "`" + s.replace(/[\\`${}]/g, f => "\\" + f) + "`"
        else return JSON.stringify(s)
    }

    function mkNode(tp: NT, pref: string, children: Node[]): Node {
        return {
            type: tp,
            op: pref,
            children: children
        }
    }

    function mkNewLine() {
        return mkNode(NT.NewLine, "", [])
    }

    function mkPrefix(pref: string, children: Node[]) {
        return mkNode(NT.Prefix, pref, children)
    }

    function mkInfix(child0: Node, op: string, child1: Node) {
        return mkNode(NT.Infix, op, [child0, child1])
    }

    function mkText(s: string) {
        return mkPrefix(s, [])
    }
    function mkBlock(nodes: Node[]) {
        return mkNode(NT.Block, "", nodes)
    }

    function mkGroup(nodes: Node[]) {
        return mkPrefix("", nodes)
    }

    function mkStmt(...nodes: Node[]) {
        nodes.push(mkNewLine())
        return mkGroup(nodes)
    }

    function mkCommaSep(nodes: Node[]) {
        let r: Node[] = []
        for (let n of nodes) {
            if (r.length > 0)
                r.push(mkText(", "))
            r.push(n)
        }
        return mkGroup(r)
    }

    // A series of utility functions for constructing various J* AST nodes.
    namespace Helpers {

        export function mkArrayLiteral(args: Node[]) {
            return mkGroup([
                mkText("["),
                mkCommaSep(args),
                mkText("]")
            ])
        }

        export function mkNumberLiteral(x: number) {
            return mkText(x.toString())
        }

        export function mkBooleanLiteral(x: boolean) {
            return mkText(x ? "true" : "false")
        }

        export function mkStringLiteral(x: string) {
            return mkText(stringLit(x))
        }

        export function mkCall(name: string, args: Node[], property = false) {
            if (property)
                return mkGroup([
                    mkInfix(args[0], ".", mkText(name)),
                    mkText("("),
                    mkCommaSep(args.slice(1)),
                    mkText(")")
                ])
            else
                return mkGroup([
                    mkText(name),
                    mkText("("),
                    mkCommaSep(args),
                    mkText(")")
                ])

        }

        // Call function [name] from the standard device library with arguments
        // [args].
        export function stdCall(name: string, args: Node[]) {
            return mkCall(name, args);
        }

        // Call extension method [name] on the first argument
        export function extensionCall(name: string, args: Node[]) {
            return mkCall(name, args, true);
        }

        // Call function [name] from the specified [namespace] in the micro:bit
        // library.
        export function namespaceCall(namespace: string, name: string, args: Node[]) {
            return mkCall(namespace + "." + name, args);
        }

        export function mathCall(name: string, args: Node[]) {
            return namespaceCall("Math", name, args)
        }

        export function mkGlobalRef(name: string) {
            return mkText(name)
        }

        export function mkSimpleCall(p: string, args: Node[]): Node {
            assert(args.length == 2);
            return mkInfix(args[0], p, args[1])
        }

        export function mkWhile(condition: Node, body: Node[]): Node {
            return mkGroup([
                mkText("while ("),
                condition,
                mkText(")"),
                mkBlock(body)
            ])
        }

        export function mkComment(text: string) {
            return mkStmt(mkText("// " + text))
        }

        export function mkAssign(x: Node, e: Node): Node {
            return mkStmt(mkSimpleCall("=", [x, e]))
        }

        export function mkParenthesizedExpression(expression: Node): Node {
            return mkGroup([
                mkText("("),
                expression,
                mkText(")")
            ])
        }
    }

    import H = Helpers;

    ///////////////////////////////////////////////////////////////////////////////
    // Miscellaneous utility functions
    ///////////////////////////////////////////////////////////////////////////////

    // Mutate [a1] in place and append to it the elements from [a2].
    function append<T>(a1: T[], a2: T[]) {
        a1.push.apply(a1, a2);
    }

    // A few wrappers for basic Block operations that throw errors when compilation
    // is not possible. (The outer code catches these and highlights the relevant
    // block.)

    // Internal error (in our code). Compilation shouldn't proceed.
    function assert(x: boolean) {
        if (!x)
            throw new Error("Assertion failure");
    }

    function throwBlockError(msg: string, block: B.Block) {
        let e = new Error(msg);
        (<any>e).block = block;
        throw e;
    }

    namespace Errors {

        export interface CompilationError {
            msg: string;
            block: B.Block;
        }

        let errors: CompilationError[] = [];

        export function report(m: string, b: B.Block) {
            errors.push({ msg: m, block: b });
        }

        export function clear() {
            errors = [];
        }

        export function get() {
            return errors;
        }

    }

    ///////////////////////////////////////////////////////////////////////////////
    // Types
    //
    // We slap a very simple type system on top of Blockly. This is needed to ensure
    // we generate valid TouchDevelop code (otherwise compilation from TD to C++
    // would not work).
    ///////////////////////////////////////////////////////////////////////////////

    // There are several layers of abstraction for the type system.
    // - Block are annotated with a string return type, and a string type for their
    //   input blocks (see blocks-custom.js). We use that as the reference semantics
    //   for the blocks.
    // - In this "type system", we use the enum Type. Using an enum rules out more
    //   mistakes.
    // - When emitting code, we target the "TouchDevelop types".
    //
    // Type inference / checking is done as follows. First, we try to assign a type
    // to all variables. We do this by examining all variable assignments and
    // figuring out the type from the right-hand side. There's a fixpoint computation
    // (see [mkEnv]). Then, we propagate down the expected type when doing code
    // generation; when generating code for a variable dereference, if the expected
    // type doesn't match the inferred type, it's an error. If the type was
    // undetermined as of yet, the type of the variable becomes the expected type.

    class Point {
        constructor(
            public link: Point,
            public type: string
        ) { }
    }

    function find(p: Point): Point {
        if (p.link)
            return find(p.link);
        else
            return p;
    }

    function union(p1: Point, p2: Point) {
        p1 = find(p1);
        p2 = find(p2);
        assert(p1.link == null && p2.link == null);
        if (p1 == p2)
            return;

        let t = unify(p1.type, p2.type);
        p1.link = p2;
        p1.type = null;
        p2.type = t;
    }

    // Ground types.
    function mkPoint(t: string): Point {
        return new Point(null, t);
    }
    let pNumber = mkPoint("number");
    let pBoolean = mkPoint("boolean");
    let pString = mkPoint("string");
    let pUnit = mkPoint("void");

    function ground(t?: string): Point {
        if (!t) return mkPoint(t);
        switch (t.toLowerCase()) {
            case "number": return pNumber;
            case "boolean": return pBoolean;
            case "string": return pString;
            case "void": return pUnit;
            default:
                // Unification variable.
                return mkPoint(t);
        }
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Type inference
    //
    // Expressions are now directly compiled as a tree. This requires knowing, for
    // each property ref, the right value for its [parent] property.
    ///////////////////////////////////////////////////////////////////////////////

    // Infers the expected type of an expression by looking at the untranslated
    // block and figuring out, from the look of it, what type of expression it
    // holds.
    function returnType(e: Environment, b: B.Block): Point {
        assert(b != null);

        if (b.type == "placeholder")
            return find((<any>b).p);

        if (b.type == "variables_get")
            return find(lookup(e, escapeVarName(b.getFieldValue("VAR"))).type);

        assert(!b.outputConnection || b.outputConnection.check_ && b.outputConnection.check_.length > 0);

        if (!b.outputConnection)
            return ground(pUnit.type);

        return ground(b.outputConnection.check_[0]);
    }

    // Basic type unification routine; easy, because there's no structural types.
    function unify(t1: string, t2: string) {
        if (t1 == null)
            return t2;
        else if (t2 == null)
            return t1;
        else if (t1 == t2)
            return t1;
        else
            throw new Error("cannot mix " + t1 + " with " + t2);
    }

    function mkPlaceholderBlock(e: Environment): B.Block {
        // XXX define a proper placeholder block type
        return <any>{
            type: "placeholder",
            p: mkPoint(null),
            workspace: e.workspace,
        };
    }

    function attachPlaceholderIf(e: Environment, b: B.Block, n: string) {
        // Ugly hack to keep track of the type we want there.
        if (!b.getInputTargetBlock(n)) {
            let i = b.inputList.filter(x => x.name == n)[0];
            assert(i != null);
            i.connection.targetConnection = new B.Connection(mkPlaceholderBlock(e), 0);
        }
    }

    function removeAllPlaceholders(w: B.Workspace) {
        w.getAllBlocks().forEach((b: B.Block) => {
            b.inputList.forEach((i: B.Input) => {
                if (i.connection && i.connection.targetBlock() != null
                    && i.connection.targetBlock().type == "placeholder")
                    i.connection.targetConnection = null;
            });
        });
    }

    // Unify the *return* type of the parameter [n] of block [b] with point [p].
    function unionParam(e: Environment, b: B.Block, n: string, p: Point) {
        try {
            attachPlaceholderIf(e, b, n);
            union(returnType(e, b.getInputTargetBlock(n)), p);
        } catch (e) {
            throwBlockError("The parameter " + n + " of this block is of the wrong type. More precisely: " + e, b);
        }
    }

    function infer(e: Environment, w: B.Workspace) {
        w.getAllBlocks().forEach((b: B.Block) => {
            try {
                switch (b.type) {
                    case "math_op2":
                        unionParam(e, b, "x", ground(pNumber.type));
                        unionParam(e, b, "y", ground(pNumber.type));
                        break;

                    case "math_op3":
                        unionParam(e, b, "x", ground(pNumber.type));
                        break;

                    case "math_arithmetic":
                    case "logic_compare":
                        switch (b.getFieldValue("OP")) {
                            case "ADD": case "MINUS": case "MULTIPLY": case "DIVIDE":
                            case "LT": case "LTE": case "GT": case "GTE": case "POWER":
                                unionParam(e, b, "A", ground(pNumber.type));
                                unionParam(e, b, "B", ground(pNumber.type));
                                break;
                            case "AND": case "OR":
                                unionParam(e, b, "A", ground(pBoolean.type));
                                unionParam(e, b, "B", ground(pBoolean.type));
                                break;
                            case "EQ": case "NEQ":
                                attachPlaceholderIf(e, b, "A");
                                attachPlaceholderIf(e, b, "B");
                                let p1 = returnType(e, b.getInputTargetBlock("A"));
                                let p2 = returnType(e, b.getInputTargetBlock("B"));
                                try {
                                    union(p1, p2);
                                } catch (e) {
                                    throwBlockError("Comparing objects of different types", b);
                                }
                                let t = find(p1).type;
                                if (t != pString.type && t != pBoolean.type && t != pNumber.type && t != null)
                                    throwBlockError("I can only compare strings, booleans and numbers", b);
                                break;
                        }
                        break;

                    case "logic_operation":
                        unionParam(e, b, "A", ground(pBoolean.type));
                        unionParam(e, b, "B", ground(pBoolean.type));
                        break;

                    case "logic_negate":
                        unionParam(e, b, "BOOL", ground(pBoolean.type));
                        break;

                    case "controls_if":
                        for (let i = 0; i <= (<B.IfBlock>b).elseifCount_; ++i)
                            unionParam(e, b, "IF" + i, ground(pBoolean.type));
                        break;

                    case "controls_simple_for":
                        unionParam(e, b, "TO", ground(pNumber.type));
                        break;
                    case "variables_set":
                    case "variables_change":
                        let x = escapeVarName(b.getFieldValue("VAR"));
                        let p1 = lookup(e, x).type;
                        attachPlaceholderIf(e, b, "VALUE");
                        let rhs = b.getInputTargetBlock("VALUE");
                        if (rhs) {
                            let tr = returnType(e, rhs);
                            try {
                                union(p1, tr);
                            } catch (e) {
                                throwBlockError("Assigning a value of the wrong type to variable " + x, b);
                            }
                        }
                        break;
                    case "controls_repeat_ext":
                        unionParam(e, b, "TIMES", ground(pNumber.type));
                        break;

                    case "device_while":
                        unionParam(e, b, "COND", ground(pBoolean.type));
                        break;

                    default:
                        if (b.type in e.stdCallTable) {
                            e.stdCallTable[b.type].args.forEach((p: StdArg) => {
                                if (p.field && !b.getFieldValue(p.field)) {
                                    let i = b.inputList.filter((i: B.Input) => i.name == p.field)[0];
                                    // This will throw if someone modified blocks-custom.js and forgot to add
                                    // [setCheck]s in the block definition. This is intentional and MUST be
                                    // fixed.
                                    let t = i.connection.check_[0];
                                    unionParam(e, b, p.field, ground(t));
                                }
                            });
                        }
                }
            } catch (e) {
                if ((<any>e).block)
                    Errors.report(e + "", (<any>e).block);
                else
                    Errors.report(e + "", b);
            }
        });

        // Last pass: if some variable has no type (because it was never used or
        // assigned to), just unify it with int...
        e.bindings.forEach((b: Binding) => {
            if (find(b.type).type == null)
                union(b.type, ground(pNumber.type));
        });
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Expressions
    //
    // Expressions are now directly compiled as a tree. This requires knowing, for
    // each property ref, the right value for its [parent] property.
    ///////////////////////////////////////////////////////////////////////////////

    function extractNumber(b: B.Block): number {
        let v = b.getFieldValue("NUM");
        return parseFloat(v);
    }

    function compileNumber(e: Environment, b: B.Block, comments: string[]): Node {
        return H.mkNumberLiteral(extractNumber(b));
    }

    let opToTok: { [index: string]: string } = {
        // POWER gets a special treatment because there's no operator for it in
        // TouchDevelop
        "ADD": "+",
        "MINUS": "-",
        "MULTIPLY": "*",
        "DIVIDE": "/",
        "LT": "<",
        "LTE": "<=",
        "GT": ">",
        "GTE": ">=",
        "AND": "&&",
        "OR": "||",
        "EQ": "==",
        "NEQ": "!=",
    };

    function compileArithmetic(e: Environment, b: B.Block, comments: string[]): Node {
        let bOp = b.getFieldValue("OP");
        let left = b.getInputTargetBlock("A");
        let right = b.getInputTargetBlock("B");
        let args = [compileExpression(e, left, comments), compileExpression(e, right, comments)];
        let t = returnType(e, left).type;

        if (t == pString.type) {
            if (bOp == "EQ") return H.mkSimpleCall("==", args);
            else if (bOp == "NEQ") return H.mkSimpleCall("!=", args);
        } else if (t == pBoolean.type)
            return H.mkSimpleCall(opToTok[bOp], args);

        // Compilation of math operators.
        if (bOp == "POWER") return H.mathCall("pow", args);
        else {
            assert(bOp in opToTok);
            return H.mkSimpleCall(opToTok[bOp], args);
        }
    }

    function compileModulo(e: Environment, b: B.Block, comments: string[]): Node {
        let left = b.getInputTargetBlock("DIVIDEND");
        let right = b.getInputTargetBlock("DIVISOR");
        let args = [compileExpression(e, left, comments), compileExpression(e, right, comments)];
        return H.mkSimpleCall("%", args);
    }

    function compileMathOp2(e: Environment, b: B.Block, comments: string[]): Node {
        let op = b.getFieldValue("op");
        let x = compileExpression(e, b.getInputTargetBlock("x"), comments);
        let y = compileExpression(e, b.getInputTargetBlock("y"), comments);
        return H.mathCall(op, [x, y])
    }

    function compileMathOp3(e: Environment, b: B.Block, comments: string[]): Node {
        let x = compileExpression(e, b.getInputTargetBlock("x"), comments);
        return H.mathCall("abs", [x]);
    }

    function compileText(e: Environment, b: B.Block, comments: string[]): Node {
        return H.mkStringLiteral(b.getFieldValue("TEXT"));
    }

    function compileBoolean(e: Environment, b: B.Block, comments: string[]): Node {
        return H.mkBooleanLiteral(b.getFieldValue("BOOL") == "TRUE");
    }

    function compileNot(e: Environment, b: B.Block, comments: string[]): Node {
        let expr = compileExpression(e, b.getInputTargetBlock("BOOL"), comments);
        return mkPrefix("!", [H.mkParenthesizedExpression(expr)]);
    }

    function extractNumberLit(e: Node): number {
        if (e.type != NT.Prefix || !/^-?\d+$/.test(e.op))
            return null
        return parseInt(e.op)
    }

    function compileRandom(e: Environment, b: B.Block, comments: string[]): Node {
        let expr = compileExpression(e, b.getInputTargetBlock("limit"), comments);
        let v = extractNumberLit(expr)
        if (v != null)
            return H.mathCall("random", [H.mkNumberLiteral(v + 1)]);
        else
            return H.mathCall("random", [H.mkSimpleCall(opToTok["ADD"], [expr, H.mkNumberLiteral(1)])])
    }

    function compileCreateList(e: Environment, b: B.Block, comments: string[]): Node {
        // collect argument
        let args = b.inputList.map(input => input.connection && input.connection.targetBlock() ? compileExpression(e, input.connection.targetBlock(), comments) : undefined)
            .filter(e => !!e);

        // we need at least 1 element to determine the type...
        if (args.length < 0)
            U.userError(lf("The list must have at least one element"));

        return H.mkArrayLiteral(args);
    }

    function defaultValueForType(t: Point): Node {
        if (t.type == null) {
            union(t, ground(pNumber.type));
            t = find(t);
        }

        switch (t.type) {
            case "boolean":
                return H.mkBooleanLiteral(false);
            case "number":
                return H.mkNumberLiteral(0);
            case "string":
                return H.mkStringLiteral("");
            default:
                return mkText("null");
        }
    }

    // [t] is the expected type; we assume that we never null block children
    // (because placeholder blocks have been inserted by the type-checking phase
    // whenever a block was actually missing).
    function compileExpression(e: Environment, b: B.Block, comments: string[]): Node {
        assert(b != null);
        maybeAddComment(b, comments);
        let expr: Node;
        if (b.disabled || b.type == "placeholder")
            expr = defaultValueForType(returnType(e, b));
        else switch (b.type) {
            case "math_number":
                expr = compileNumber(e, b, comments); break;
            case "math_op2":
                expr = compileMathOp2(e, b, comments); break;
            case "math_op3":
                expr = compileMathOp3(e, b, comments); break;
            case "device_random":
                expr = compileRandom(e, b, comments); break;
            case "math_arithmetic":
            case "logic_compare":
            case "logic_operation":
                expr = compileArithmetic(e, b, comments); break;
            case "math_modulo":
                expr = compileModulo(e, b, comments); break;
            case "logic_boolean":
                expr = compileBoolean(e, b, comments); break;
            case "logic_negate":
                expr = compileNot(e, b, comments); break;
            case "variables_get":
                expr = compileVariableGet(e, b); break;
            case "text":
                expr = compileText(e, b, comments); break;
            case "lists_create_with":
                expr = compileCreateList(e, b, comments); break;
            default:
                let call = e.stdCallTable[b.type];
                if (call) {
                    if (call.imageLiteral)
                        expr = compileImage(e, b, call.imageLiteral, call.namespace, call.f,
                            call.args.map(ar => compileArgument(e, b, ar, comments)))
                    else
                        expr = compileStdCall(e, b, call, comments);
                }
                else {
                    pxt.reportError("blocks", "unabled compile expression", { "details": b.type });
                    expr = defaultValueForType(returnType(e, b));
                }
                break;
        }

        expr.id = b.id;
        return expr;
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Environments
    ///////////////////////////////////////////////////////////////////////////////

    // Environments are persistent.

    interface Environment {
        workspace: Blockly.Workspace;
        bindings: Binding[];
        stdCallTable: pxt.Map<StdFunc>;
    }

    enum VarUsage {
        Unknown,
        Read,
        Assign
    }

    interface Binding {
        name: string;
        type: Point;
        usedAsForIndex: number;
        assigned?: VarUsage; // records the first usage of this variable (read/assign)
        incompatibleWithFor?: boolean;
    }

    function isCompiledAsForIndex(b: Binding) {
        return b.usedAsForIndex && !b.incompatibleWithFor;
    }

    function extend(e: Environment, x: string, t: string): Environment {
        assert(lookup(e, x) == null);
        return {
            workspace: e.workspace,
            bindings: [{ name: x, type: ground(t), usedAsForIndex: 0 }].concat(e.bindings),
            stdCallTable: e.stdCallTable
        };
    }

    function lookup(e: Environment, n: string): Binding {
        for (let i = 0; i < e.bindings.length; ++i)
            if (e.bindings[i].name == n)
                return e.bindings[i];
        return null;
    }

    function fresh(e: Environment, s: string): string {
        let i = 0;
        let unique = s;
        while (lookup(e, unique) != null)
            unique = s + i++;
        return unique;
    }

    function emptyEnv(w: Blockly.Workspace): Environment {
        return {
            workspace: w,
            bindings: [],
            stdCallTable: {}
        }
    };

    ///////////////////////////////////////////////////////////////////////////////
    // Statements
    ///////////////////////////////////////////////////////////////////////////////

    function compileControlsIf(e: Environment, b: B.IfBlock, comments: string[]): Node[] {
        let stmts: Node[] = [];
        // Notice the <= (if there's no else-if, we still compile the primary if).
        for (let i = 0; i <= b.elseifCount_; ++i) {
            let cond = compileExpression(e, b.getInputTargetBlock("IF" + i), comments);
            let thenBranch = compileStatements(e, b.getInputTargetBlock("DO" + i));
            let startNode = mkText("if (")
            if (i > 0) {
                startNode = mkText("else if (")
                startNode.glueToBlock = true
            }
            append(stmts, [
                startNode,
                cond,
                mkText(")"),
                thenBranch
            ])
        }
        if (b.elseCount_) {
            let elseNode = mkText("else")
            elseNode.glueToBlock = true
            append(stmts, [
                elseNode,
                compileStatements(e, b.getInputTargetBlock("ELSE"))
            ])
        }
        return stmts;
    }

    function compileControlsFor(e: Environment, b: B.Block, comments: string[]): Node[] {
        let bVar = escapeVarName(b.getFieldValue("VAR"));
        let bTo = b.getInputTargetBlock("TO");
        let bDo = b.getInputTargetBlock("DO");
        let bBy = b.getInputTargetBlock("BY");
        let bFrom = b.getInputTargetBlock("FROM");
        let incOne = !bBy || (bBy.type.match(/^math_number/) && extractNumber(bBy) == 1)

        let binding = lookup(e, bVar);
        assert(binding.usedAsForIndex > 0);

        return [
            mkText("for (let " + bVar + " = "),
            bFrom ? compileExpression(e, bFrom, comments) : mkText("0"),
            mkText("; "),
            mkInfix(mkText(bVar), "<=", compileExpression(e, bTo, comments)),
            mkText("; "),
            incOne ? mkText(bVar + "++") : mkInfix(mkText(bVar), "+=", compileExpression(e, bBy, comments)),
            mkText(")"),
            compileStatements(e, bDo)
        ]
    }

    function compileControlsRepeat(e: Environment, b: B.Block, comments: string[]): Node[] {
        let bound = compileExpression(e, b.getInputTargetBlock("TIMES"), comments);
        let body = compileStatements(e, b.getInputTargetBlock("DO"));
        let valid = (x: string) => !lookup(e, x)
        let name = "i";
        for (let i = 0; !valid(name); i++)
            name = "i" + i;
        return [
            mkText("for (let " + name + " = 0; "),
            mkInfix(mkText(name), "<", bound),
            mkText("; " + name + "++)"),
            body
        ]
    }

    function compileWhile(e: Environment, b: B.Block, comments: string[]): Node[] {
        let cond = compileExpression(e, b.getInputTargetBlock("COND"), comments);
        let body = compileStatements(e, b.getInputTargetBlock("DO"));
        return [
            mkText("while ("),
            cond,
            mkText(")"),
            body
        ]
    }

    function compileForever(e: Environment, b: B.Block): Node {
        let bBody = b.getInputTargetBlock("HANDLER");
        let body = compileStatements(e, bBody);
        return mkCallWithCallback(e, "basic", "forever", [], body);
    }

    // convert to javascript friendly name
    function escapeVarName(name: string): string {
        if (!name) return '_';
        let n = name.split(/[^a-zA-Z0-9_$]+/)
            //.map((c, i) => (i ? c[0].toUpperCase() : c[0].toLowerCase()) + c.substr(1)) breaks roundtrip...
            .join('');
        return n;
    }

    function compileVariableGet(e: Environment, b: B.Block): Node {
        let name = escapeVarName(b.getFieldValue("VAR"));
        let binding = lookup(e, name);
        if (!binding.assigned)
            binding.assigned = VarUsage.Read;
        assert(binding != null && binding.type != null);
        return mkText(name);
    }

    function compileSet(e: Environment, b: B.Block, comments: string[]): Node {
        let bVar = escapeVarName(b.getFieldValue("VAR"));
        let bExpr = b.getInputTargetBlock("VALUE");
        let binding = lookup(e, bVar);
        let isDef = false
        if (!binding.assigned)
            if (b.getSurroundParent()) {
                // need to define this variable in the top-scope
                binding.assigned = VarUsage.Read
            } else {
                binding.assigned = VarUsage.Assign;
                isDef = true
            }
        let expr = compileExpression(e, bExpr, comments);
        return mkStmt(
            mkText(isDef ? "let " : ""),
            mkText(bVar + " = "),
            expr)
    }

    function compileChange(e: Environment, b: B.Block, comments: string[]): Node {
        let bVar = escapeVarName(b.getFieldValue("VAR"));
        let bExpr = b.getInputTargetBlock("VALUE");
        let binding = lookup(e, bVar);
        if (!binding.assigned)
            binding.assigned = VarUsage.Read;
        let expr = compileExpression(e, bExpr, comments);
        let ref = mkText(bVar);
        return mkStmt(mkInfix(ref, "+=", expr))
    }

    function compileCall(e: Environment, b: B.Block, comments: string[]): Node {
        let call = e.stdCallTable[b.type];
        if (call.imageLiteral)
            return mkStmt(compileImage(e, b, call.imageLiteral, call.namespace, call.f, call.args.map(ar => compileArgument(e, b, ar, comments))))
        else if (call.hasHandler)
            return compileEvent(e, b, call.f, call.args.map(ar => ar.field).filter(ar => !!ar), call.namespace, comments)
        else
            return mkStmt(compileStdCall(e, b, e.stdCallTable[b.type], comments))
    }

    function compileArgument(e: Environment, b: B.Block, p: StdArg, comments: string[]): Node {
        let lit: any = p.literal;
        if (lit)
            return lit instanceof String ? H.mkStringLiteral(<string>lit) : H.mkNumberLiteral(<number>lit);
        let f = b.getFieldValue(p.field);
        if (f)
            return mkText(f);
        else
            return compileExpression(e, b.getInputTargetBlock(p.field), comments)
    }

    function compileStdCall(e: Environment, b: B.Block, func: StdFunc, comments: string[]): Node {
        let args = func.args.map((p: StdArg) => compileArgument(e, b, p, comments));
        if (func.isIdentity)
            return args[0];
        else if (func.isExtensionMethod) {
            return H.extensionCall(func.f, args);
        } else if (func.namespace) {
            return H.namespaceCall(func.namespace, func.f, args);
        } else {
            return H.stdCall(func.f, args);
        }
    }

    function compileStdBlock(e: Environment, b: B.Block, f: StdFunc, comments: string[]) {
        return mkStmt(compileStdCall(e, b, f, comments))
    }

    function mkCallWithCallback(e: Environment, n: string, f: string, args: Node[], body: Node): Node {
        body.noFinalNewline = true
        return mkStmt(H.namespaceCall(n, f, args.concat([
            mkGroup([mkText("() =>"), body])
        ])))
    }

    function compileEvent(e: Environment, b: B.Block, event: string, args: string[], ns: string, comments: string[]): Node {
        let bBody = b.getInputTargetBlock("HANDLER");
        let compiledArgs: Node[] = args.map((arg: string) => {
            // b.getFieldValue may be string, numbers
            let argb = b.getInputTargetBlock(arg);
            if (argb) return compileExpression(e, argb, comments);
            return mkText(b.getFieldValue(arg))
        });
        let body = compileStatements(e, bBody);
        return mkCallWithCallback(e, ns, event, compiledArgs, body);
    }

    function compileImage(e: Environment, b: B.Block, frames: number, n: string, f: string, args?: Node[]): Node {
        args = args === undefined ? [] : args;
        let state = "\n";
        let rows = 5;
        let columns = frames * 5;
        for (let i = 0; i < rows; ++i) {
            for (let j = 0; j < columns; ++j) {
                if (j > 0)
                    state += ' ';
                state += /TRUE/.test(b.getFieldValue("LED" + j + i)) ? "#" : ".";
            }
            state += '\n';
        }
        let lit = H.mkStringLiteral(state)
        lit.canIndentInside = true
        return H.namespaceCall(n, f, [lit].concat(args));
    }

    // A standard function argument may be a field name (see below)
    // or a string|number literal.
    // The literal is used to hide argument in blocks
    // that are available in TD.
    interface StdArg {
        field?: string;
        literal?: string | number;
    }

    // A description of each function from the "device library". Types are fetched
    // from the Blockly blocks definition.
    // - the key is the name of the Blockly.Block that we compile into a device call;
    // - [f] is the TouchDevelop function name we compile to
    // - [args] is a list of names; the name is taken to be either the name of a
    //   Blockly field value or, if not found, the name of a Blockly input block; if a
    //   field value is found, then this generates a string expression. If argument is a literal, simply emits the literal.
    // - [isExtensionMethod] is a flag so that instead of generating a TouchDevelop
    //   call like [f(x, y...)], we generate the more "natural" [x → f (y...)]
    // - [namespace] is also an optional flag to generate a "namespace" call, that
    //   is, "basic -> show image" instead of "micro:bit -> show image".
    interface StdFunc {
        f: string;
        args: StdArg[];
        isExtensionMethod?: boolean;
        imageLiteral?: number;
        hasHandler?: boolean;
        property?: boolean;
        namespace?: string;
        isIdentity?: boolean; // TD_ID shim
    }

    function compileStatementBlock(e: Environment, b: B.Block): Node[] {
        let r: Node[];
        const comments: string[] = [];
        maybeAddComment(b, comments);
        switch (b.type) {
            case 'controls_if':
                r = compileControlsIf(e, <B.IfBlock>b, comments);
                break;
            case 'controls_for':
            case 'controls_simple_for':
                r = compileControlsFor(e, b, comments);
                break;
            case 'variables_set':
                r = [compileSet(e, b, comments)];
                break;

            case 'variables_change':
                r = [compileChange(e, b, comments)];
                break;

            case 'controls_repeat_ext':
                r = compileControlsRepeat(e, b, comments);
                break;

            case 'device_while':
                r = compileWhile(e, b, comments);
                break;

            default:
                let call = e.stdCallTable[b.type];
                if (call) r = [compileCall(e, b, comments)];
                else r = [mkStmt(compileExpression(e, b, comments))];
                break;
        }
        let l = r[r.length - 1]; if (l) l.id = b.id;

        if (comments.length) {
            addCommentNodes(comments, r)
        }

        return r;
    }

    function compileStatements(e: Environment, b: B.Block): Node {
        let stmts: Node[] = [];
        while (b) {
            if (!b.disabled) append(stmts, compileStatementBlock(e, b));
            b = b.getNextBlock();
        }
        return mkBlock(stmts);
    }

    function isTopBlock(b: B.Block): boolean {
        if (!b.parentBlock_) return true;
        return isTopBlock(b.parentBlock_);
    }

    // This function creates an empty environment where type inference has NOT yet
    // been performed.
    // - All variables have been assigned an initial [Point] in the union-find.
    // - Variables have been marked to indicate if they are compatible with the
    //   TouchDevelop for-loop model.
    function mkEnv(w: B.Workspace, blockInfo: pxtc.BlocksInfo): Environment {
        // The to-be-returned environment.
        let e = emptyEnv(w);

        // append functions in stdcalltable
        if (blockInfo)
            blockInfo.blocks
                .forEach(fn => {
                    if (e.stdCallTable[fn.attributes.blockId]) {
                        pxt.reportError("blocks", "function already defined", { "details" : fn.attributes.blockId });
                        return;
                    }
                    let fieldMap = pxt.blocks.parameterNames(fn);
                    let instance = fn.kind == pxtc.SymbolKind.Method || fn.kind == pxtc.SymbolKind.Property;
                    let args = (fn.parameters || []).map(p => {
                        if (fieldMap[p.name] && fieldMap[p.name].name) return { field: fieldMap[p.name].name };
                        else return null;
                    }).filter(a => !!a);
                    if (instance)
                        args.unshift({
                            field: fieldMap["this"].name
                        });

                    e.stdCallTable[fn.attributes.blockId] = {
                        namespace: fn.namespace,
                        f: fn.name,
                        isExtensionMethod: instance,
                        imageLiteral: fn.attributes.imageLiteral,
                        hasHandler: fn.parameters && fn.parameters.some(p => p.type == "() => void"),
                        property: !fn.parameters,
                        args: args,
                        isIdentity: fn.attributes.shim == "TD_ID"
                    }
                })

        const variableIsScoped = (b: B.Block, name: string): boolean => {
            if (!b)
                return false;
            else if ((b.type == "controls_for" || b.type == "controls_simple_for")
                && escapeVarName(b.getFieldValue("VAR")) == name)
                return true;
            else
                return variableIsScoped(b.getSurroundParent(), name);
        };

        // collect loop variables.
        w.getAllBlocks().forEach(b => {
            if (b.type == "controls_for" || b.type == "controls_simple_for") {
                let x = escapeVarName(b.getFieldValue("VAR"));
                // It's ok for two loops to share the same variable.
                if (lookup(e, x) == null)
                    e = extend(e, x, pNumber.type);
                lookup(e, x).usedAsForIndex++;
                // If multiple loops share the same
                // variable, that means there's potential race conditions in concurrent
                // code, so faithfully compile this as a global variable.
                if (lookup(e, x).usedAsForIndex > 1)
                    lookup(e, x).incompatibleWithFor = true;
            }
        });

        // determine for-loop compatibility: for each get or
        // set block, 1) make sure that the variable is bound, then 2) mark the variable if needed.
        w.getAllBlocks().forEach(b => {
            if (b.type == "variables_get" || b.type == "variables_set" || b.type == "variables_change") {
                let x = escapeVarName(b.getFieldValue("VAR"));
                if (lookup(e, x) == null)
                    e = extend(e, x, null);

                let binding = lookup(e, x);
                if (binding.usedAsForIndex && !variableIsScoped(b, x))
                    // loop index is read outside the loop.
                    binding.incompatibleWithFor = true;
            }
        });

        return e;
    }

    function compileWorkspace(w: B.Workspace, blockInfo: pxtc.BlocksInfo): Node[] {
        try {
            let e = mkEnv(w, blockInfo);
            infer(e, w);

            // [stmtsHandlers] contains calls to register event handlers. They must be
            // executed before the code that goes in the main function, as that latter
            // code may block, and prevent the event handler from being registered.
            let stmtsMain: Node[] = [];
            w.getTopBlocks(true).map(b => {
                let compiled = compileStatements(e, b)
                if (compiled.type == NT.Block)
                    append(stmtsMain, compiled.children);
                else stmtsMain.push(compiled)
            });

            // All variables in this script are compiled as locals within main unless loop or previsouly assigned
            let stmtsVariables = e.bindings.filter(b => !isCompiledAsForIndex(b) && b.assigned != VarUsage.Assign)
                .map(b => {
                    // let btype = find(b.type);
                    // Not sure we need the type here - is is always number or boolean?
                    let defl = defaultValueForType(find(b.type))
                    let tp = ""
                    if (defl.op == "null")
                        tp = ": " + find(b.type).type
                    return mkStmt(mkText("let " + b.name + tp + " = "), defaultValueForType(find(b.type)))
                });

            return stmtsVariables.concat(stmtsMain)
        } finally {
            removeAllPlaceholders(w);
        }

        return [] // unreachable
    }

    export interface SourceInterval {
        id: string;
        start: number;
        end: number;
    }

    export interface BlockCompilationResult {
        source: string;
        sourceMap: SourceInterval[];
    }

    export function findBlockId(sourceMap: SourceInterval[], loc: { start: number; length: number; }): string {
        if (!loc) return undefined;
        for (let i = 0; i < sourceMap.length; ++i) {
            let chunk = sourceMap[i];
            if (chunk.start <= loc.start && chunk.end >= loc.start + loc.length)
                return chunk.id;
        }
        return undefined;
    }

    export function compile(b: B.Workspace, blockInfo: pxtc.BlocksInfo): BlockCompilationResult {
        Errors.clear();
        return tdASTtoTS(compileWorkspace(b, blockInfo));
    }

    function tdASTtoTS(app: Node[]): BlockCompilationResult {
        let sourceMap: SourceInterval[] = [];
        let output = ""
        let indent = ""
        let variables: Map<string>[] = [{}];
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
        let infixPriTable: Map<number> = {
            // 0 = comma/sequence
            // 1 = spread (...)
            // 2 = yield, yield*
            // 3 = assignment
            "=": 3,
            "+=": 3,
            "-=": 3,
            // 4 = conditional (?:)
            "||": 5,
            "&&": 6,
            "|": 7,
            "^": 8,
            "&": 9,
            // 10 = equality
            "==": 10,
            "!=": 10,
            "===": 10,
            "!==": 10,
            // 11 = comparison (excludes in, instanceof)
            "<": 11,
            ">": 11,
            "<=": 11,
            ">=": 11,
            // 12 = bitise shift
            ">>": 12,
            ">>>": 12,
            "<<": 12,
            "+": 13,
            "-": 13,
            "*": 14,
            "/": 14,
            "%": 14,
            "!": 15,
            ".": 18,
        }


        function flatten(e0: Node) {
            function rec(e: Node, outPrio: number) {
                if (e.type != NT.Infix) {
                    for (let c of e.children)
                        rec(c, -1)
                    return
                }

                let r: Node[] = []

                function pushOp(c: string) {
                    r.push(mkText(c))
                }

                let infixPri = U.lookup(infixPriTable, e.op)
                if (infixPri == null) U.oops("bad infix op: " + e.op)

                if (infixPri < outPrio) pushOp("(");
                if (e.children.length == 1) {
                    pushOp(e.op)
                    rec(e.children[0], infixPri)
                } else {
                    let bindLeft = infixPri != 3 && e.op != "**"
                    let letType: string = undefined;
                    /*
                    if (e.name == "=" && e.args[0].nodeType == 'localRef') {
                        let varloc = <TDev.AST.Json.JLocalRef>e.args[0];
                        let varname = varloc.name;
                        if (!variables[variables.length - 1][varname]) {
                            variables[variables.length - 1][varname] = "1";
                            pushOp("let")
                            letType = varloc.type as any as string;
                        }
                    }
                    */
                    rec(e.children[0], bindLeft ? infixPri : infixPri + 0.1)
                    r.push(e.children[0])
                    if (letType && letType != "number") {
                        pushOp(": ")
                        pushOp(letType)
                    }
                    if (e.op == ".")
                        pushOp(".")
                    else
                        pushOp(" " + e.op + " ")
                    rec(e.children[1], !bindLeft ? infixPri : infixPri + 0.1)
                    r.push(e.children[1])
                }
                if (infixPri < outPrio) pushOp(")");

                e.type = NT.Prefix
                e.op = ""
                e.children = r
            }

            rec(e0, -1)
        }

        let root = mkGroup(app)
        flatten(root)
        emit(root)

        // never return empty string - TS compiler service thinks it's an error
        if (!output)
            output += "\n"

        return {
            source: output,
            sourceMap: sourceMap
        };

        function emit(n: Node) {
            if (n.glueToBlock) {
                removeLastIndent()
                output += " "
            }

            let start = output.length

            switch (n.type) {
                case NT.Infix:
                    U.oops("no infix should be left")
                    break
                case NT.NewLine:
                    output += "\n" + indent
                    break
                case NT.Block:
                    block(n)
                    break
                case NT.Prefix:
                    if (n.canIndentInside)
                        output += n.op.replace(/\n/g, "\n" + indent + "    ")
                    else
                        output += n.op
                    n.children.forEach(emit)
                    break
                default:
                    break
            }

            let end = output.length

            if (n.id && start != end) {
                sourceMap.push({ id: n.id, start: start, end: end })

            }
        }

        function write(s: string) {
            output += s.replace(/\n/g, "\n" + indent)
        }

        function removeLastIndent() {
            output = output.replace(/\n *$/, "")
        }

        function block(n: Node) {
            let finalNl = n.noFinalNewline ? "" : "\n";
            if (n.children.length == 0) {
                write(" {\n\t\n}" + finalNl)
                return
            }

            let vars = U.clone<Map<string>>(variables[variables.length - 1] || {});
            variables.push(vars);
            indent += "    "
            write(" {\n")
            for (let nn of n.children)
                emit(nn)
            indent = indent.slice(4)
            removeLastIndent()
            write("\n}" + finalNl)
            variables.pop();
        }
    }

    function maybeAddComment(b: B.Block, comments: string[]) {
        if (b.comment) {
            if ((typeof b.comment) === "string") {
                comments.push(b.comment as string)
            }
            else {
                comments.push((b.comment as B.Comment).getText())
            }
        }
    }

    function addCommentNodes(comments: string[], r: Node[]) {
        const commentNodes: Node[] = []
        const paragraphs: string[] = []

        for (const comment of comments) {
            for (const paragraph of comment.split("\n")) {
                paragraphs.push(paragraph)
            }
        }

        for (let i = 0; i < paragraphs.length; i++) {
            // Wrap paragraph lines
            const words = paragraphs[i].split(/\s/)
            let currentLine: string;
            for (const word of words) {
                if (!currentLine) {
                    currentLine = word
                }
                else if (currentLine.length + word.length > MAX_COMMENT_LINE_LENGTH) {
                    commentNodes.push(mkText(`// ${currentLine}`))
                    commentNodes.push(mkNewLine())
                    currentLine = word
                }
                else {
                    currentLine += " " + word
                }
            }

            if (currentLine) {
                commentNodes.push(mkText(`// ${currentLine}`))
                commentNodes.push(mkNewLine())
            }

            // The decompiler expects an empty comment line between paragraphs
            if (i !== paragraphs.length - 1) {
                commentNodes.push(mkText(`//`))
                commentNodes.push(mkNewLine())
            }
        }

        for (const commentNode of commentNodes.reverse()) {
            r.unshift(commentNode)
        }
    }
}