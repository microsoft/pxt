///<reference path='blockly.d.ts'/>
///<reference path='touchdevelop.d.ts'/>
/// <reference path="../built/kindlib.d.ts" />


///////////////////////////////////////////////////////////////////////////////
//                A compiler from Blocky to TouchDevelop                     //
///////////////////////////////////////////////////////////////////////////////

import J = TDev.AST.Json;
import B = Blockly;

namespace ks.blocks {

    // A series of utility functions for constructing various J* AST nodes.
    module Helpers {
        // Digits are operators...
        export function mkDigit(x: string): J.JOperator {
            return mkOp(x);
        }

        export function mkNumberLiteral(x: number): J.JNumberLiteral {
            return {
                nodeType: "numberLiteral",
                id: null,
                value: x
            };
        }

        export function mkBooleanLiteral(x: boolean): J.JBooleanLiteral {
            return {
                nodeType: "booleanLiteral",
                id: null,
                value: x
            };
        }

        export function mkStringLiteral(x: string): J.JStringLiteral {
            return {
                nodeType: "stringLiteral",
                id: null,
                value: x
            };
        }

        export function mkOp(x: string): J.JOperator {
            return {
                nodeType: "operator",
                id: null,
                op: x
            };
        }

        // A map from "classic" [JPropertyRef]s to their proper [parent].
        var knownPropertyRefs: { [index: string]: string } = {
            "=": "Unknown",
        };
        ["==", "!=", "<", "<=", ">", ">=", "+", "-", "/", "*"].forEach(x => knownPropertyRefs[x] = "Number");
        ["&&", "||", "!"].forEach(x => knownPropertyRefs[x] = "Boolean");

        export function mkPropertyRef(x: string, p: string): J.JPropertyRef {
            return {
                nodeType: "propertyRef",
                id: null,
                name: x,
                parent: mkTypeRef(p),
            };
        }

        export function mkCall(name: string, parent: J.JTypeRef, args: J.JExpr[]): J.JCall {
            return {
                nodeType: "call",
                id: null,
                name: name,
                parent: parent,
                args: args,
            };
        }

        var librarySymbol = "♻";
        var libraryName = "micro:bit";
        var librarySingleton = mkSingletonRef(librarySymbol);

        function mkSingletonRef(name: string): J.JSingletonRef {
            return {
                nodeType: "singletonRef",
                id: null,
                name: name,
                type: mkTypeRef(name)
            };
        }

        // A library "♻ foobar" is actually a call to the method "foobar" of the
        // global singleton object "♻".
        export function mkLibrary(name: string): J.JCall {
            return mkCall(name, mkTypeRef(librarySymbol), [librarySingleton]);
        }

        // Call function [name] from the standard device library with arguments
        // [args].
        export function stdCall(name: string, args: J.JExpr[]): J.JCall {
            return mkCall(name, mkTypeRef(libraryName), [<J.JExpr>mkLibrary(libraryName)].concat(args));
        }

        // Call extension method [name] on the first argument
        export function extensionCall(name: string, args: J.JExpr[]) {
            return mkCall(name, mkTypeRef("call"), args);
        }

        function mkNamespaceRef(lib: string, namespace: string): J.JSingletonRef {
            return {
                nodeType: "singletonRef",
                id: null,
                libraryName: lib,
                name: namespace.toLowerCase(),
                type: mkTypeRef(namespace)
            };
        }

        // Call function [name] from the specified [namespace] in the micro:bit
        // library.
        export function namespaceCall(namespace: string, name: string, args: J.JExpr[]) {
            return mkCall(name, mkTypeRef(libraryName),
                [<J.JExpr>mkNamespaceRef(libraryName, namespace)].concat(args));
        }

        // Call a function from the Math library. Apparently, the Math library is a
        // different object than other libraries, so its AST typeesentation is not the
        // same. Go figure.
        export function mathCall(name: string, args: J.JExpr[]): J.JCall {
            return mkCall(name, mkTypeRef("Math"), [<J.JExpr>mkSingletonRef("Math")].concat(args));
        }

        export function stringCall(name: string, args: J.JExpr[]): J.JCall {
            return mkCall(name, mkTypeRef("String"), args);
        }

        export function booleanCall(name: string, args: J.JExpr[]): J.JCall {
            return mkCall(name, mkTypeRef("Boolean"), args);
        }

        export function mkGlobalRef(name: string): J.JCall {
            return mkCall(name, mkTypeRef("data"), [mkSingletonRef("data")]);
        }

        // Assumes its parameter [p] is in the [knownPropertyRefs] table.
        export function mkSimpleCall(p: string, args: J.JExpr[]): J.JExpr {
            assert(knownPropertyRefs[p] != undefined);
            return mkCall(p, mkTypeRef(knownPropertyRefs[p]), args);
        }

        export function mkTypeRef(t: string): J.JTypeRef {
            // The interface is a lie -- actually, this type is just string.
            return <any>t;
        }

        export function mkLTypeRef(t: string): J.JTypeRef {
            return <any>JSON.stringify(<J.JLibraryType>{ o: t, l: <any>libraryName });
        }

        export function mkGTypeRef(t: string): J.JTypeRef {
            return <any>JSON.stringify(<J.JGenericTypeInstance>{ g: t });
        }

        export function mkVarDecl(x: string, t: J.JTypeRef): J.JData {
            return {
                nodeType: "data",
                id: null,
                name: x,
                type: t,
                comment: "",
                isReadonly: false,
                isTransient: true,
                isCloudEnabled: false,
            };
        }

        // Generates a local definition for [x] at type [t]; this is not enough to
        // properly define a variable, though (see [mkDefAndAssign]).
        export function mkDef(x: string, t: J.JTypeRef): J.JLocalDef {
            assert(!!x)
            return {
                nodeType: "localDef",
                id: null,
                name: x,
                type: t,
                isByRef: false,
            };
        }

        // Generates a reference to bound variable [x]
        export function mkLocalRef(x: string): J.JLocalRef {
            assert(!!x);
            return {
                nodeType: "localRef",
                id: null,
                name: x,
                localId: null // same here
            }
        }

        // [defs] are the variables that this expression binds; this means that this
        // expression *introduces* new variables, whose scope runs until the end of
        // the parent block (see comments for [JExprHolder]).
        export function mkExprHolder(defs: J.JLocalDef[], tree: J.JExpr): J.JExprHolder {
            return {
                nodeType: "exprHolder",
                id: null,
                tokens: null,
                tree: tree,
                locals: defs,
            };
        }

        // Injection of expressions into statements is explicit in TouchDevelop.
        export function mkExprStmt(expr: J.JExprHolder): J.JExprStmt {
            return {
                nodeType: "exprStmt",
                id: null,
                expr: expr,
            };
        }

        // Refinement of the above function for [J.JInlineActions], a subclass of
        // [J.JExprStmt]
        export function mkInlineActions(actions: J.JInlineAction[], expr: J.JExprHolder): J.JInlineActions {
            return {
                nodeType: "inlineActions",
                id: null,
                actions: actions,
                expr: expr,
            };
        }

        export function mkWhile(condition: J.JExprHolder, body: J.JStmt[]): J.JWhile {
            return {
                nodeType: "while",
                id: null,
                condition: condition,
                body: body
            };
        }

        export function mkFor(index: string, bound: J.JExprHolder, body: J.JStmt[]): J.JFor {
            return {
                nodeType: "for",
                id: null,
                index: mkDef(index, mkTypeRef("Number")),
                body: body,
                bound: bound
            };
        }

        export function mkComment(text: string): J.JComment {
            return {
                nodeType: "comment",
                id: null,
                text: text || ""
            };
        }

        // An if-statement that has no [else] branch.
        export function mkSimpleIf(condition: J.JExprHolder, thenBranch: J.JStmt[]): J.JIf {
            return {
                nodeType: "if",
                id: null,
                condition: condition,
                thenBody: thenBranch,
                elseBody: null,
                isElseIf: false,
            };
        }

        // This function takes care of generating an if node *and* de-constructing the
        // else branch to abide by the TouchDevelop typeesentation (see comments in
        // [jsonInterfaces.ts]).
        export function mkIf(condition: J.JExprHolder, thenBranch: J.JStmt[], elseBranch: J.JStmt[]): J.JIf[] {
            var ifNode = mkSimpleIf(condition, thenBranch)

            // The transformation into a "flat" if / else if / else sequence is only
            // valid if the else branch it itself such a sequence.
            var fitForFlattening = elseBranch.length && elseBranch.every((s: J.JStmt, i: number) =>
                s.nodeType == "if" && (i == 0 || (<J.JIf>s).isElseIf)
            );
            if (fitForFlattening) {
                var first = <J.JIf>elseBranch[0];
                assert(!first.isElseIf);
                first.isElseIf = true;
                return [ifNode].concat(<J.JIf[]>elseBranch);
            } else {
                ifNode.elseBody = elseBranch;
                return [ifNode];
            }
        }

        export function mkAssign(x: J.JExpr, e: J.JExpr): J.JStmt {
            var assign = mkSimpleCall("=", [x, e]);
            var expr = mkExprHolder([], assign);
            return mkExprStmt(expr);
        }

        // Generate the AST for:
        //   [var x: t := e]
        export function mkDefAndAssign(x: string, t: J.JTypeRef, e: J.JExpr): J.JStmt {
            var def: J.JLocalDef = mkDef(x, t);
            var assign = mkSimpleCall("=", [mkLocalRef(x), e]);
            var expr = mkExprHolder([def], assign);
            return mkExprStmt(expr);
        }

        export function mkInlineAction(
            body: J.JStmt[],
            isImplicit: boolean,
            reference: J.JLocalDef,
            inParams: J.JLocalDef[] = [],
            outParams: J.JLocalDef[] = []): J.JInlineAction {
            return {
                nodeType: "inlineAction",
                id: null,
                body: body,
                inParameters: inParams,
                outParameters: outParams,
                locals: null,
                reference: reference,
                isImplicit: isImplicit,
                isOptional: false,
                capturedLocals: [],
                allLocals: [],
            }
        }

        export function mkAction(
            name: string,
            body: J.JStmt[],
            inParams: J.JLocalDef[] = [],
            outParams: J.JLocalDef[] = []): J.JAction {
            return {
                nodeType: "action",
                id: null,
                name: name,
                body: body,
                inParameters: inParams,
                outParameters: outParams,
                isPrivate: false,
                isOffline: false,
                isQuery: false,
                isTest: false,
                isAsync: true,
                description: "Action converted from a Blockly script",
            };
        }

        export function mkApp(name: string, description: string, decls: J.JDecl[]): J.JApp {
            return {
                nodeType: "app",
                id: null,

                textVersion: "v2.2,js,ctx,refs,localcloud,unicodemodel,allasync,upperplex",
                jsonVersion: "v0.1,resolved",

                name: name,
                comment: description,
                autoIcon: "",
                autoColor: "",

                platform: "current",
                isLibrary: false,
                useCppCompiler: false,
                showAd: false,
                hasIds: false,
                rootId: "TODO",
                decls: decls,
                deletedDecls: <any>[],
            };
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
        var e = new Error(msg);
        (<any>e).block = block;
        throw e;
    }

    module Errors {

        export interface CompilationError {
            msg: string;
            block: B.Block;
        }

        var errors: CompilationError[] = [];

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

        var t = unify(p1.type, p2.type);
        p1.link = p2;
        p1.type = null;
        p2.type = t;
    }

    // Ground types.
    function mkPoint(t: string): Point {
        return new Point(null, t);
    }
    var pNumber = mkPoint("number");
    var pBoolean = mkPoint("boolean");
    var pString = mkPoint("string");
    var pImage = mkPoint("input.LedImage");
    var pUnit = mkPoint("void");

    function ground(t?: string): Point {
        switch (t) {
            case "number": return pNumber;
            case "boolean": return pBoolean;
            case "string": return pString;
            case "input.LedImage": return pImage;
            case "void": return pUnit;
            default:
                // Unification variable.
                return mkPoint(null);
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
            return find(lookup(e, b.getFieldValue("VAR")).type);

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
            var i = b.inputList.filter(x => x.name == n)[0];
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
                                var p1 = returnType(e, b.getInputTargetBlock("A"));
                                var p2 = returnType(e, b.getInputTargetBlock("B"));
                                try {
                                    union(p1, p2);
                                } catch (e) {
                                    throwBlockError("Comparing objects of different types", b);
                                }
                                var t = find(p1).type;
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
                        for (var i = 0; i <= (<B.IfBlock>b).elseifCount_; ++i)
                            unionParam(e, b, "IF" + i, ground(pBoolean.type));
                        break;

                    case "controls_simple_for":
                        unionParam(e, b, "TO", ground(pNumber.type));
                        break;
                    case "variables_set":
                    case "variables_change":
                        var x = b.getFieldValue("VAR");
                        var p1 = lookup(e, x).type;
                        attachPlaceholderIf(e, b, "VALUE");
                        var rhs = b.getInputTargetBlock("VALUE");
                        if (rhs) {
                            var tr = returnType(e, rhs);
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
                                    var i = b.inputList.filter((i: B.Input) => i.name == p.field)[0];
                                    // This will throw if someone modified blocks-custom.js and forgot to add
                                    // [setCheck]s in the block definition. This is intentional and MUST be
                                    // fixed.
                                    var t = i.connection.check_[0];
                                    unionParam(e, b, p.field, ground(t));
                                }
                            });
                            compileCall(e, b);
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
        var v = b.getFieldValue("NUM");
        if (!v.match(/\d+/)) {
            Errors.report(v + " is not a valid numeric value", b);
            return 0;
        } else {
            var i = parseInt(v);
            if (i >> 0 != i) {
                Errors.report(v + " is either too big or too small", b);
                return 0;
            }
            return parseInt(v);
        }
    }

    function compileNumber(e: Environment, b: B.Block): J.JExpr {
        return H.mkNumberLiteral(extractNumber(b));
    }

    var opToTok: { [index: string]: string } = {
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

    function compileArithmetic(e: Environment, b: B.Block): J.JExpr {
        var bOp = b.getFieldValue("OP");
        var left = b.getInputTargetBlock("A");
        var right = b.getInputTargetBlock("B");
        var args = [compileExpression(e, left), compileExpression(e, right)];
        var t = returnType(e, left).type;

        if (t == pString.type) {
            if (bOp == "EQ") return H.stringCall("==", args);
            else if (bOp == "NEQ") return H.stringCall("!=", args);
        } else if (t == pBoolean.type)
            return H.mkSimpleCall(opToTok[bOp], args);

        // Compilation of math operators.
        if (bOp == "POWER") return H.mathCall("pow", args);
        else {
            assert(bOp in opToTok);
            return H.mkSimpleCall(opToTok[bOp], args);
        }
    }

    function compileMathOp2(e: Environment, b: B.Block): J.JExpr {
        var op = b.getFieldValue("op");
        var x = compileExpression(e, b.getInputTargetBlock("x"));
        var y = compileExpression(e, b.getInputTargetBlock("y"));
        return H.mathCall(op, [x, y]);
    }

    function compileMathOp3(e: Environment, b: B.Block): J.JExpr {
        var x = compileExpression(e, b.getInputTargetBlock("x"));
        return H.mathCall("abs", [x]);
    }

    function compileVariableGet(e: Environment, b: B.Block): J.JExpr {
        var name = b.getFieldValue("VAR");
        var binding = lookup(e, name);
        assert(binding != null && binding.type != null);
        return H.mkLocalRef(name);
    }

    function compileText(e: Environment, b: B.Block): J.JExpr {
        return H.mkStringLiteral(b.getFieldValue("TEXT"));
    }

    function compileBoolean(e: Environment, b: B.Block): J.JExpr {
        return H.mkBooleanLiteral(b.getFieldValue("BOOL") == "TRUE");
    }

    function compileNot(e: Environment, b: B.Block): J.JExpr {
        var expr = compileExpression(e, b.getInputTargetBlock("BOOL"));
        return H.mkSimpleCall("!", [expr]);
    }

    function compileRandom(e: Environment, b: B.Block): J.JExpr {
        let expr = compileExpression(e, b.getInputTargetBlock("limit"));
        if (expr.nodeType == "numberLiteral")
            return H.mathCall("random", [ H.mkNumberLiteral((expr as J.JNumberLiteral).value + 1)]);
        else
            return H.mathCall("random", [ H.mkSimpleCall(opToTok["+"], [expr, H.mkNumberLiteral(1)])])
    }

    function defaultValueForType(t: Point): J.JExpr {
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
                return H.mkLocalRef("null");
        }
    }

    // [t] is the expected type; we assume that we never null block children
    // (because placeholder blocks have been inserted by the type-checking phase
    // whenever a block was actually missing).
    function compileExpression(e: Environment, b: B.Block): J.JExpr {
        assert(b != null);
        let expr: J.JExpr;
        if (b.disabled || b.type == "placeholder")
            expr = defaultValueForType(returnType(e, b));
        else switch (b.type) {
            case "math_number":
                expr = compileNumber(e, b); break;
            case "math_op2":
                expr = compileMathOp2(e, b); break;
            case "math_op3":
                expr = compileMathOp3(e, b); break;
            case "device_random":
                expr = compileRandom(e, b); break;
            case "math_arithmetic":
            case "logic_compare":
            case "logic_operation":
                expr = compileArithmetic(e, b); break;
            case "logic_boolean":
                expr = compileBoolean(e, b); break;
            case "logic_negate":
                expr = compileNot(e, b); break;
            case "variables_get":
                expr = compileVariableGet(e, b); break;
            case "text":
                expr = compileText(e, b); break;
            default:
                var call = e.stdCallTable[b.type];
                if (call) {
                    if (call.imageLiteral) expr = compileImage(e, b, call.imageLiteral, call.namespace, call.f, call.args.map(ar => compileArgument(e, b, ar)))
                    else expr = compileStdCall(e, b, call);
                }
                else {
                    ks.reportError("Unable to compile expression: " + b.type, null);
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
        stdCallTable: Util.StringMap<StdFunc>;
    }

    interface Binding {
        name: string;
        type: Point;
        usedAsForIndex: number;
        incompatibleWithFor?: boolean;
        setInMain?:boolean;
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
        for (var i = 0; i < e.bindings.length; ++i)
            if (e.bindings[i].name == n)
                return e.bindings[i];
        return null;
    }

    function fresh(e: Environment, s: string): string {
        var i = 0;
        var unique = s;
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

    function compileControlsIf(e: Environment, b: B.IfBlock): J.JStmt[] {
        var stmts: J.JIf[] = [];
        // Notice the <= (if there's no else-if, we still compile the primary if).
        for (var i = 0; i <= b.elseifCount_; ++i) {
            var cond = compileExpression(e, b.getInputTargetBlock("IF" + i));
            var thenBranch = compileStatements(e, b.getInputTargetBlock("DO" + i));
            stmts.push(H.mkSimpleIf(H.mkExprHolder([], cond), thenBranch));
            if (i > 0)
                stmts[stmts.length - 1].isElseIf = true;
        }
        if (b.elseCount_) {
            stmts[stmts.length - 1].elseBody = compileStatements(e, b.getInputTargetBlock("ELSE"));
        }
        return stmts;
    }

    function isClassicForLoop(b: B.Block) {
        if (b.type == "controls_simple_for") {
            return true;
        } else if (b.type == "controls_for") {
            var bBy = b.getInputTargetBlock("BY");
            var bFrom = b.getInputTargetBlock("FROM");
            return bBy.type.match(/^math_number/) && extractNumber(bBy) == 1 &&
                bFrom.type.match(/^math_number/) && extractNumber(bFrom) == 0;
        } else {
            throw new Error("Invalid argument: isClassicForLoop");
        }
    }

    function compileControlsFor(e: Environment, b: B.Block): J.JStmt[] {
        var bVar = b.getFieldValue("VAR");
        var bTo = b.getInputTargetBlock("TO");
        var bDo = b.getInputTargetBlock("DO");

        var binding = lookup(e, bVar);
        assert(binding.usedAsForIndex > 0);

        if (isClassicForLoop(b) && !binding.incompatibleWithFor)
            // In the perfect case, we can do a local binding that declares a local
            // variable. The code that generates global variable declarations is in sync
            // and won't generate a global binding.
            return [
                // FOR 0 <= VAR
                H.mkFor(bVar,
                    // < TO + 1 DO
                    H.mkExprHolder([], H.mkSimpleCall("+", [compileExpression(e, bTo), H.mkNumberLiteral(1)])),
                    compileStatements(e, bDo))
            ];
        else {
            // Evaluate the bound first, and store it in b (bound may change over
            // several loop iterations).
            var local = fresh(e, "bound");
            e = extend(e, local, pNumber.type);
            var eLocal = H.mkLocalRef(local);
            var eTo = compileExpression(e, bTo);
            var eVar = H.mkLocalRef(bVar);
            var eBy = H.mkNumberLiteral(1);
            var eFrom = H.mkNumberLiteral(0);
            // Fallback to a while loop followed by an assignment to
            // make sure we don't overshoot the loop variable above the "to" field
            // (since Blockly allows someone to read it afterwards).
            return [
                // LOCAL = TO
                H.mkAssign(eLocal, eTo),
                // VAR = FROM
                H.mkAssign(eVar, eFrom),
                // while
                H.mkWhile(
                    // VAR <= B
                    H.mkExprHolder([], H.mkSimpleCall("≤", [eVar, eLocal])),
                    // DO
                    compileStatements(e, bDo).concat([
                        H.mkExprStmt(
                            H.mkExprHolder([],
                                // VAR =
                                H.mkSimpleCall("=", [eVar,
                                    // VAR + BY
                                    H.mkSimpleCall("+", [eVar, eBy])])))])),
            ];
        }
    }

    function compileControlsRepeat(e: Environment, b: B.Block): J.JStmt {
        var bound = compileExpression(e, b.getInputTargetBlock("TIMES"));
        var body = compileStatements(e, b.getInputTargetBlock("DO"));
        var valid = (x: string) => !lookup(e, x) || !isCompiledAsForIndex(lookup(e, x));
        var name = "i";
        for (var i = 0; !valid(name); i++)
            name = "i" + i;
        return H.mkFor(name, H.mkExprHolder([], bound), body);
    }

    function compileWhile(e: Environment, b: B.Block): J.JStmt {
        var cond = compileExpression(e, b.getInputTargetBlock("COND"));
        var body = compileStatements(e, b.getInputTargetBlock("DO"));
        return H.mkWhile(H.mkExprHolder([], cond), body.concat([
            // Insert a pause instruction after the body of the while loop.
            H.mkExprStmt(H.mkExprHolder([], H.namespaceCall("basic", "pause", [H.mkNumberLiteral(20)])))
        ]));
    }

    function compileForever(e: Environment, b: B.Block): J.JStmt {
        var bBody = b.getInputTargetBlock("HANDLER");
        var body = compileStatements(e, bBody);
        return mkCallWithCallback(e, "basic", "forever", [], body);
    }

    function compileSet(e: Environment, b: B.Block): J.JStmt {
        var bVar = b.getFieldValue("VAR");
        var bExpr = b.getInputTargetBlock("VALUE");
        var binding = lookup(e, bVar);
        var expr = compileExpression(e, bExpr);
        var ref = H.mkLocalRef(bVar);
        return H.mkExprStmt(H.mkExprHolder([], H.mkSimpleCall("=", [ref, expr])));
    }

    function compileChange(e: Environment, b: B.Block): J.JStmt {
        var bVar = b.getFieldValue("VAR");
        var bExpr = b.getInputTargetBlock("VALUE");
        var binding = lookup(e, bVar);
        var expr = compileExpression(e, bExpr);
        var ref = H.mkLocalRef(bVar);
        return H.mkExprStmt(H.mkExprHolder([], H.mkSimpleCall("=", [ref, H.mkSimpleCall("+", [ref, expr])])));
    }

    function compileCall(e: Environment, b: B.Block): J.JStmt {
        var call = e.stdCallTable[b.type];
        return call.imageLiteral
            ? H.mkExprStmt(H.mkExprHolder([], compileImage(e, b, call.imageLiteral, call.namespace, call.f, call.args.map(ar => compileArgument(e, b, ar)))))
            : call.hasHandler ? compileEvent(e, b, call.f, call.args.map(ar => ar.field).filter(ar => !!ar), call.namespace)
                : H.mkExprStmt(H.mkExprHolder([], compileStdCall(e, b, e.stdCallTable[b.type])));
    }

    function compileArgument(e: Environment, b: B.Block, p: StdArg): J.JExpr {
        var lit: any = p.literal;
        if (lit)
            return lit instanceof String ? H.mkStringLiteral(<string>lit) : H.mkNumberLiteral(<number>lit);
        var f = b.getFieldValue(p.field);
        if (f)
            return H.mkLocalRef(f);
        else
            return compileExpression(e, b.getInputTargetBlock(p.field))
    }

    function compileStdCall(e: Environment, b: B.Block, func: StdFunc) {
        var args = func.args.map((p: StdArg) => compileArgument(e, b, p));
        if (func.isExtensionMethod) {
            return H.extensionCall(func.f, args);
        } else if (func.namespace) {
            return H.namespaceCall(func.namespace, func.f, args);
        } else {
            return H.stdCall(func.f, args);
        }
    }

    function compileStdBlock(e: Environment, b: B.Block, f: StdFunc) {
        return H.mkExprStmt(H.mkExprHolder([], compileStdCall(e, b, f)));
    }

    function mkCallWithCallback(e: Environment, n: string, f: string, args: J.JExpr[], body: J.JStmt[]): J.JStmt {
        var def = H.mkDef("_body_", H.mkGTypeRef("Action"));
        return H.mkInlineActions(
            [H.mkInlineAction(body, true, def)],
            H.mkExprHolder(
                [def],
                H.namespaceCall(n, f, args)));
    }

    function compileEvent(e: Environment, b: B.Block, event: string, args: string[], ns: string): J.JStmt {
        var bBody = b.getInputTargetBlock("HANDLER");
        var compiledArgs = args.map((arg: string) => {
            // b.getFieldValue may be string, numbers
            return H.mkLocalRef(b.getFieldValue(arg))
        });
        var body = compileStatements(e, bBody);
        return mkCallWithCallback(e, ns, event, compiledArgs, body);
    }

    function compileImage(e: Environment, b: B.Block, frames: number, n: string, f: string, args?: J.JExpr[]): J.JCall {
        args = args === undefined ? [] : args;
        var state = "\n";
        var rows = 5;
        var columns = frames * 5;
        for (var i = 0; i < rows; ++i) {
            if (i > 0)
                state += '\n';
            for (var j = 0; j < columns; ++j) {
                if (j > 0)
                    state += ' ';
                state += /TRUE/.test(b.getFieldValue("LED" + j + i)) ? "#" : ".";
            }
        }
        return H.namespaceCall(n, f, [<J.JExpr>H.mkStringLiteral(state)].concat(args));
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
        namespace?: string;
    }

    function compileStatementBlock(e: Environment, b: B.Block): J.JStmt[] {
        let r: J.JStmt[];
        switch (b.type) {
            case 'controls_if':
                r = compileControlsIf(e, <B.IfBlock>b);
                break;
            case 'controls_for':
            case 'controls_simple_for':
                r = compileControlsFor(e, b);
                break;
            case 'variables_set':
                r = [compileSet(e, b)];
                break;

            case 'variables_change':
                r = [compileChange(e, b)];
                break;

            case 'device_forever':
                r = [compileForever(e, b)];
                break;

            case 'controls_repeat_ext':
                r = [compileControlsRepeat(e, b)];
                break;

            case 'device_while':
                r = [compileWhile(e, b)];
                break;
            default:
                let call = e.stdCallTable[b.type];
                if (call) r = [compileCall(e, b)];
                else r = [H.mkExprStmt(H.mkExprHolder([], compileExpression(e,b)))];
                break;
        }
        let l = r[r.length - 1]; if (l) l.id = b.id;
        return r;
    }

    function compileStatements(e: Environment, b: B.Block): J.JStmt[] {
        if (b == null)
            return [];

        var stmts: J.JStmt[] = [];
        while (b) {
            if (!b.disabled) append(stmts, compileStatementBlock(e, b));
            b = b.getNextBlock();
        }
        return stmts;
    }

    ///////////////////////////////////////////////////////////////////////////////

    // Top-level definitions for compiling an entire blockly workspace

    export interface CompileOptions {
        name: string;
        description: string;
    }

    function isHandlerRegistration(b: B.Block) {
        return !(b as any).previousConnection && !(b as any).outputConnection;
        //return /(forever|_event)$/.test(b.type);
    }

    // Find the parent (as in "scope" parent) of a Block. The [parentNode_] property
    // will return the visual parent, that is, the one connected to the top of the
    // block.
    function findParent(b: B.Block) {
        var candidate = b.parentBlock_;
        if (!candidate)
            return null;
        var isActualInput = false;
        candidate.inputList.forEach((i: B.Input) => {
            if (i.name && candidate.getInputTargetBlock(i.name) == b)
                isActualInput = true;
        });
        return isActualInput && candidate || null;
    }

    // This function creates an empty environment where type inference has NOT yet
    // been performed.
    // - All variables have been assigned an initial [Point] in the union-find.
    // - Variables have been marked to indicate if they are compatible with the
    //   TouchDevelop for-loop model.
    function mkEnv(w: B.Workspace, blockInfo: ts.ks.BlocksInfo): Environment {
        // The to-be-returned environment.
        let e = emptyEnv(w);

        // append functions in stdcalltable
        if (blockInfo)
            blockInfo.blocks
                .forEach(fn => {
                    if (e.stdCallTable[fn.attributes.blockId]) {
                        ks.reportError("compiler: function " + fn.attributes.blockId + " already defined", null);
                        return;
                    }
                    let fieldMap = ks.blocks.parameterNames(fn);
                    let instance = fn.kind == ts.ks.SymbolKind.Method || fn.kind == ts.ks.SymbolKind.Property;
                    let args = fn.parameters.map(p => {
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
                        hasHandler: fn.parameters.some(p => p.type == "() => void"),
                        args: args
                    }
                })

        // First pass: collect loop variables.
        w.getAllBlocks().forEach((b: B.Block) => {
            if (b.type == "controls_for" || b.type == "controls_simple_for") {
                let x = b.getFieldValue("VAR");
                // It's ok for two loops to share the same variable.
                if (lookup(e, x) == null)
                    e = extend(e, x, pNumber.type);
                lookup(e, x).usedAsForIndex++;
                // Unless the loop starts at 0 and and increments by one, we can't compile
                // as a TouchDevelop for loop. Also, if multiple loops share the same
                // variable, that means there's potential race conditions in concurrent
                // code, so faithfully compile this as a global variable.
                if (!isClassicForLoop(b) || lookup(e, x).usedAsForIndex > 1)
                    lookup(e, x).incompatibleWithFor = true;
            }
        });

        var variableIsScoped = (b: B.Block, name: string): boolean => {
            if (!b)
                return false;
            else if ((b.type == "controls_for" || b.type == "controls_simple_for")
                && b.getFieldValue("VAR") == name)
                return true;
            else
                return variableIsScoped(findParent(b), name);
        };
        
        function isTopBlock(b: B.Block) : boolean {
            if (isHandlerRegistration(b)) return false;
            if (!b.parentBlock_) return true;
            return isTopBlock(b.parentBlock_);
        }

        // Last series of checks to determine for-loop compatibility: for each get or
        // set block, 1) make sure that the variable is bound, then 2) mark the
        // variable if needed.
        w.getAllBlocks().forEach((b: B.Block) => {
            if (b.type == "variables_set" || b.type == "variables_change") {
                let x = b.getFieldValue("VAR");
                if (lookup(e, x) == null)
                    e = extend(e, x, null);

                let binding = lookup(e, x);
                if (binding.usedAsForIndex)
                    // Second reason why we can't compile as a TouchDevelop for-loop: loop
                    // index is assigned to
                    binding.incompatibleWithFor = true;
                if (b.type == "variables_set" && isTopBlock(b))
                    binding.setInMain = true;                    
            } else if (b.type == "variables_get") {
                let x = b.getFieldValue("VAR");
                if (lookup(e, x) == null)
                    e = extend(e, x, null);

                let binding = lookup(e, x);
                if (binding.usedAsForIndex && !variableIsScoped(b, x))
                    // Third reason why we can't compile to a TouchDevelop for-loop: loop
                    // index is read outside the loop.
                    binding.incompatibleWithFor = true;
            }
        });

        return e;
    }

    function compileWorkspace(w: B.Workspace, blockInfo: ts.ks.BlocksInfo, options: CompileOptions): J.JApp {
        try {
            var decls: J.JDecl[] = [];
            var e = mkEnv(w, blockInfo);
            infer(e, w);

            // All variables in this script are compiled as locals within main.
            var stmtsVariables: J.JStmt[] = [];
            e.bindings.forEach((b: Binding) => {
                var btype = find(b.type);
                if (!isCompiledAsForIndex(b) && true) // !b.setInMain)
                    stmtsVariables.push(H.mkDefAndAssign(b.name, H.mkTypeRef(find(b.type).type), defaultValueForType(find(b.type))));
            });

            // [stmtsHandlers] contains calls to register event handlers. They must be
            // executed before the code that goes in the main function, as that latter
            // code may block, and prevent the event handler from being registered.
            var stmtsHandlers: J.JStmt[] = [];
            var stmtsMain: J.JStmt[] = [];
            w.getTopBlocks(true).forEach((b: B.Block) => {
                if (isHandlerRegistration(b))
                    append(stmtsHandlers, compileStatements(e, b));
                else
                    append(stmtsMain, compileStatements(e, b));
            });

            decls.push(H.mkAction("main",
                stmtsVariables
                    .concat(stmtsHandlers)
                    .concat(stmtsMain), [], []));
        } finally {
            removeAllPlaceholders(w);
        }

        return H.mkApp(options.name, options.description, decls);
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

    export function compile(b: B.Workspace, blockInfo: ts.ks.BlocksInfo, options: CompileOptions): BlockCompilationResult {
        Errors.clear();
        return tdASTtoTS(compileWorkspace(b, blockInfo, options));
    }

    function tdASTtoTS(app: J.JApp): BlockCompilationResult {
        let sourceMap: SourceInterval[] = [];
        let output = ""
        let indent = ""
        let variables : U.Map<string>[] = [{}];
        let currInlineAction: J.JInlineAction = null
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
        let infixPriTable: Util.StringMap<number> = {
            "=": 3,
            "||": 5,
            "&&": 6,
            "|": 7,
            "^": 8,
            "&": 9,
            "==": 10,
            "!=": 10,
            "===": 10,
            "!==": 10,
            "<": 11,
            ">": 11,
            "<=": 11,
            ">=": 11,
            ">>": 12,
            ">>>": 12,
            "<<": 12,
            "+": 13,
            "-": 13,
            "*": 14,
            "/": 14,
            "%": 14,
            "!": 15,
        }


        function flatten(e0: J.JExpr) {
            var r: J.JToken[] = []

            function pushOp(c: string) {
                r.push(<J.JOperator>{
                    nodeType: "operator",
                    id: "",
                    op: c
                })
            }

            function call(e: J.JCall, outPrio: number) {
                var infixPri = 0
                if (infixPriTable.hasOwnProperty(e.name))
                    infixPri = infixPriTable[e.name]

                if (infixPri) {
                    // This seems wrong
                    if (e.name == "-" &&
                        (e.args[0].nodeType == "numberLiteral") &&
                        ((<J.JNumberLiteral>e.args[0]).value === 0.0) &&
                        (!(<J.JNumberLiteral>e.args[0]).stringForm)) {
                        pushOp(e.name)
                        rec(e.args[1], 98)
                        return
                    }

                    if (infixPri < outPrio) pushOp("(");
                    if (e.args.length == 1) {
                        pushOp(e.name)
                        rec(e.args[0], infixPri)
                    } else {
                        var bindLeft = infixPri != 3 && e.name != "**"
                        if (e.name == "=" && e.args[0].nodeType == 'localRef') {
                            let varname = (<TDev.AST.Json.JLocalRef>e.args[0]).name;
                            if (!variables[variables.length - 1][varname]) {
                                variables[variables.length - 1][varname] = "1";
                                pushOp("let")
                            }
                        }
                        rec(e.args[0], bindLeft ? infixPri : infixPri + 0.1)
                        pushOp(e.name)
                        rec(e.args[1], !bindLeft ? infixPri : infixPri + 0.1)
                    }
                    if (infixPri < outPrio) pushOp(")");
                } else {
                    rec(e.args[0], 1000)
                    r.push(<J.JPropertyRef><any>{
                        nodeType: "propertyRef",
                        name: e.name,
                        parent: e.parent,
                        declId: e.declId,
                    })
                    pushOp("(")
                    e.args.slice(1).forEach((ee, i) => {
                        if (i > 0) pushOp(",")
                        rec(ee, -1)
                    })
                    pushOp(")")
                }
            }

            function rec(e: J.JExpr, prio: number) {
                switch (e.nodeType) {
                    case "call":
                        call(<J.JCall>e, prio)
                        break;
                    case "numberLiteral":
                        pushOp((<J.JNumberLiteral>e).value.toString())
                        break;
                    case "stringLiteral":
                    case "booleanLiteral":
                    case "localRef":
                    case "placeholder":
                    case "singletonRef":
                        r.push(e);
                        break;
                    case "show":
                    case "break":
                    case "return":
                    case "continue":
                        pushOp(e.nodeType)
                        var ee = (<J.JReturn>e).expr
                        if (ee)
                            rec(ee, prio)
                        break
                    default:
                        ks.reportError("invalid nodeType when flattening: " + e.nodeType, null);
                        Util.oops("invalid nodeType when flattening: " + e.nodeType)
                }
            }

            rec(e0, -1)

            return r
        }

        function stringLit(s: string) {
            if (s.length > 20 && /\n/.test(s))
                return "`" + s.replace(/[\\`${}]/g, f => "\\" + f) + "`"
            else return JSON.stringify(s)
        }

        function emitAndMap(id: string, f: () => void) {
            let start = output.length;
            f();
            let end = output.length;
            if (id)
                sourceMap.push({ id: id, start: start, end: end })
        }

        let byNodeType: Util.StringMap<(n: J.JNode) => void> = {
            app: (n: J.JApp) => {
                Util.assert(n.decls.length == 1)
                Util.assert(n.decls[0].nodeType == "action");
                (n.decls[0] as J.JAction).body.forEach(emit)
            },

            exprStmt: (n: J.JExprStmt) => emitAndMap(n.id, () => {
                emit(n.expr)
                write(";\n")
            }),

            inlineAction: (n: J.JInlineAction) => {
                Util.assert(n.inParameters.length == 0)
                write("() => ")
                emitBlock(n.body)
            },

            inlineActions: (n: J.JInlineActions) => {
                Util.assert(n.actions.length == 1)
                currInlineAction = n.actions[0]
                emit(n.expr)
                if (currInlineAction.isImplicit) {
                    output = output.replace(/\)\s*$/, "")
                    if (!/\($/.test(output))
                        write(", ")
                    emit(currInlineAction)
                    output = output.replace(/\s*$/, "")
                    write(")")
                }
                write(";\n")
            },

            exprHolder: (n: J.JExprHolder) => {
                let toks = flatten(n.tree)
                toks.forEach(emit)
            },

            localRef: (n: J.JLocalRef) => {
                if (n.name == "_body_")
                    emit(currInlineAction)
                else
                    localRef(n.name)
            },

            operator: (n: J.JOperator) => {
                if (/^[\d()]/.test(n.op))
                    write(n.op)
                else if (n.op == ",")
                    write(n.op + " ")
                else
                    write(" " + n.op + " ")
            },

            singletonRef: (n: J.JSingletonRef) => {
                write(jsName(n.name))
            },

            propertyRef: (n: J.JPropertyRef) => {
                write("." + jsName(n.name))
            },

            stringLiteral: (n: J.JStringLiteral) => {
                output += stringLit(n.value)
            },

            booleanLiteral: (n: J.JBooleanLiteral) => {
                write(n.value ? "true" : "false")
            },

            "if": (n: J.JIf) => {
                if (n.isElseIf) write("else ")
                write("if (")
                emit(n.condition)
                write(") ")
                emitBlock(n.thenBody)
                if (n.elseBody) {
                    write("else ")
                    emitBlock(n.elseBody)
                }
            },

            "for": (n: J.JFor) => {
                write("for (let ")
                localRef(n.index.name)
                write(" = 0; ")
                localRef(n.index.name)
                write(" < ")
                emit(n.bound)
                write("; ")
                localRef(n.index.name)
                write("++) ")
                emitBlock(n.body)
            },

            "while": (n: J.JWhile) => {
                write("while (")
                emit(n.condition)
                write(") ")
                emitBlock(n.body)
            },
        }

        emit(app)

        output = output.replace(/^\s*\n/mg, "").replace(/\s+;$/mg, ";")

        // never return empty string - TS compiler service thinks it's an error
        output += "\n"

        return {
            source: output,
            sourceMap: sourceMap
        };

        function localRef(n: string) {
            write(jsName(n))
        }

        function emitBlock(s: J.JStmt[]) {
            block(() => {
                s.forEach(emit)
            })
        }

        function jsName(s: string) {
            return s.replace(/ (.)/g, (f: string, m: string) => m.toUpperCase())
        }

        function emit(n: J.JNode) {
            let f = byNodeType[n.nodeType]
            if (!f) Util.oops("unsupported node type " + n.nodeType)
            f(n)
        }

        function write(s: string) {
            output += s.replace(/\n/g, "\n" + indent)
        }

        
        function block(f: () => void) {
            let vars = U.clone<U.Map<string>>(variables[variables.length-1] || {});
            variables.push(vars);
            
            indent += "    "
            write("{\n")
            f()
            indent = indent.slice(4)
            write("\n}\n")
            
            variables.pop();
        }
    }

}