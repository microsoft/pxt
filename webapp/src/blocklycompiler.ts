///<reference path='blockly.d.ts'/>
///<reference path='touchdevelop.d.ts'/>
import * as blockyloader from "./blocklyloader"

///////////////////////////////////////////////////////////////////////////////
//                A compiler from Blocky to TouchDevelop                     //
///////////////////////////////////////////////////////////////////////////////

import J = TDev.AST.Json;
import B = Blockly;

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
        "post to wall": "String",
        "=": "Unknown",
    };
    ["=", "≠", "<", "≤", ">", "≥", "+", "-", "/", "*"].forEach(x => knownPropertyRefs[x] = "Number");
    ["and", "or", "not"].forEach(x => knownPropertyRefs[x] = "Boolean");

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
            name: name.toLowerCase(),
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

// Starts at 1, otherwise you can't write "if (type) ...".
enum Type { Number = 1, Boolean, String, Image, Unit, Sprite };

// From a Blockly string annotation to a [Type].
function toType(t: string): Type {
    switch (t) {
        case "String":
            return Type.String;
        case "Number":
            return Type.Number;
        case "Boolean":
            return Type.Boolean;
        case "image":
            return Type.Image;
        case "sprite":
            return Type.Sprite;
        default:
            throw new Error("Unknown type");
    }
}

// From a [Type] to a TouchDevelop type.
function toTdType(t: Type): J.JTypeRef {
    switch (t) {
        case Type.Number:
            return H.mkTypeRef("Number");
        case Type.Boolean:
            return H.mkTypeRef("Boolean");
        case Type.String:
            return H.mkTypeRef("String");
        case Type.Image:
            return H.mkLTypeRef("Image");
        case Type.Sprite:
            return H.mkLTypeRef("Led Sprite");
        default:
            throw new Error("Cannot convert unit");
    }
}

// This is for debugging only.
function typeToString(t: Type): string {
    switch (t) {
        case Type.Number:
            return "Number";
        case Type.Boolean:
            return "Boolean";
        case Type.String:
            return "String";
        case Type.Image:
            return "Image";
        case Type.Sprite:
            return "Sprite";
        case Type.Unit:
            throw new Error("Should be forbidden by Blockly");
        default:
            throw new Error("Unknown type");
    }
}

class Point {
    constructor(
        public link: Point,
        public type: Type
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
function mkPoint(t: Type): Point {
    return new Point(null, t);
}
var pNumber = mkPoint(Type.Number);
var pBoolean = mkPoint(Type.Boolean);
var pString = mkPoint(Type.String);
var pImage = mkPoint(Type.Image);
var pUnit = mkPoint(Type.Unit);
var pSprite = mkPoint(Type.Sprite);

function ground(t?: Type): Point {
    switch (t) {
        case Type.Number:
            return pNumber;
        case Type.Boolean:
            return pBoolean;
        case Type.String:
            return pString;
        case Type.Image:
            return pImage;
        case Type.Sprite:
            return pSprite;
        case Type.Unit:
            return pUnit;
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
        return ground(Type.Unit);

    return ground(toType(b.outputConnection.check_[0]));
}

// Basic type unification routine; easy, because there's no structural types.
function unify(t1: Type, t2: Type) {
    if (t1 == null)
        return t2;
    else if (t2 == null)
        return t1;
    else if (t1 == t2)
        return t1;
    else
        throw new Error("cannot mix " + typeToString(t1) + " with " + typeToString(t2));
}

function mkPlaceholderBlock(): B.Block {
    // XXX define a proper placeholder block type
    return <any>{
        type: "placeholder",
        p: mkPoint(null),
        workspace: Blockly.mainWorkspace,
    };
}

function attachPlaceholderIf(b: B.Block, n: string) {
    // Ugly hack to keep track of the type we want there.
    if (!b.getInputTargetBlock(n)) {
        var i = b.inputList.filter(x => x.name == n)[0];
        assert(i != null);
        i.connection.targetConnection = new B.Connection(mkPlaceholderBlock(), 0);
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
        attachPlaceholderIf(b, n);
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
                    unionParam(e, b, "x", ground(Type.Number));
                    unionParam(e, b, "y", ground(Type.Number));
                    break;

                case "math_op3":
                    unionParam(e, b, "x", ground(Type.Number));
                    break;

                case "math_arithmetic":
                case "logic_compare":
                    switch (b.getFieldValue("OP")) {
                        case "ADD": case "MINUS": case "MULTIPLY": case "DIVIDE":
                        case "LT": case "LTE": case "GT": case "GTE": case "POWER":
                            unionParam(e, b, "A", ground(Type.Number));
                            unionParam(e, b, "B", ground(Type.Number));
                            break;
                        case "AND": case "OR":
                            unionParam(e, b, "A", ground(Type.Boolean));
                            unionParam(e, b, "B", ground(Type.Boolean));
                            break;
                        case "EQ": case "NEQ":
                            attachPlaceholderIf(b, "A");
                            attachPlaceholderIf(b, "B");
                            var p1 = returnType(e, b.getInputTargetBlock("A"));
                            var p2 = returnType(e, b.getInputTargetBlock("B"));
                            try {
                                union(p1, p2);
                            } catch (e) {
                                throwBlockError("Comparing objects of different types", b);
                            }
                            var t = find(p1).type;
                            if (t != Type.String && t != Type.Boolean && t != Type.Number && t != null)
                                throwBlockError("I can only compare strings, booleans and numbers", b);
                            break;
                    }
                    break;

                case "logic_operation":
                    unionParam(e, b, "A", ground(Type.Boolean));
                    unionParam(e, b, "B", ground(Type.Boolean));
                    break;

                case "logic_negate":
                    unionParam(e, b, "BOOL", ground(Type.Boolean));
                    break;

                case "controls_if":
                    for (var i = 0; i <= (<B.IfBlock>b).elseifCount_; ++i)
                        unionParam(e, b, "IF" + i, ground(Type.Boolean));
                    break;

                case "controls_simple_for":
                    unionParam(e, b, "TO", ground(Type.Number));
                    break;

                case "text_print":
                    unionParam(e, b, "TEXT", ground(Type.String));
                    break;

                case "variables_set":
                case "variables_change":
                    var x = b.getFieldValue("VAR");
                    var p1 = lookup(e, x).type;
                    attachPlaceholderIf(b, "VALUE");
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

                case "device_comment":
                    unionParam(e, b, "comment", ground(Type.String));
                    break;

                case "controls_repeat_ext":
                    unionParam(e, b, "TIMES", ground(Type.Number));
                    break;

                case "device_while":
                    unionParam(e, b, "COND", ground(Type.Boolean));
                    break;

                default:
                    if (b.type in e.stdCallTable) {
                        e.stdCallTable[b.type].args.forEach((p: StdArg) => {
                            if (p.field && !b.getFieldValue(p.field)) {
                                var i = b.inputList.filter((i: B.Input) => i.name == p.field)[0];
                                // This will throw if someone modified blocks-custom.js and forgot to add
                                // [setCheck]s in the block definition. This is intentional and MUST be
                                // fixed.
                                var t = toType(i.connection.check_[0]);
                                unionParam(e, b, p.field, ground(t));
                            }
                        });
                        compileStdCall(e, b, e.stdCallTable[b.type]);
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
            union(b.type, ground(Type.Number));
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
    "LTE": "≤",
    "GT": ">",
    "GTE": "≥",
    "AND": "and",
    "OR": "or",
    "EQ": "=",
    "NEQ": "≠",
};

function compileArithmetic(e: Environment, b: B.Block): J.JExpr {
    var bOp = b.getFieldValue("OP");
    var left = b.getInputTargetBlock("A");
    var right = b.getInputTargetBlock("B");
    var args = [compileExpression(e, left), compileExpression(e, right)];
    var t = returnType(e, left).type;

    if (t == Type.String) {
        if (bOp == "EQ")
            return H.stringCall("equals", args);
        else if (bOp == "NEQ")
            return H.booleanCall("not", [H.stringCall("equals", args)]);
    } else if (t == Type.Boolean) {
        if (bOp == "EQ")
            return H.booleanCall("equals", args);
        else if (bOp == "NEQ")
            return H.booleanCall("not", [H.booleanCall("equals", args)]);
        else if (bOp == "AND" || bOp == "OR")
            return H.mkSimpleCall(opToTok[bOp], args);
    }

    // Compilation of math operators.
    if (bOp == "POWER") {
        return H.mathCall("pow", args);
    } else {
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
    return H.mkSimpleCall("not", [expr]);
}

function compileRandom(e: Environment, b: B.Block): J.JExpr {
    return H.mathCall("random", [H.mkNumberLiteral(parseInt(b.getFieldValue("limit")) + 1)]);
}

function defaultValueForType(t: Point): J.JExpr {
    if (t.type == null) {
        union(t, ground(Type.Number));
        t = find(t);
    }

    switch (t.type) {
        case Type.Boolean:
            return H.mkBooleanLiteral(false);
        case Type.Number:
            return H.mkNumberLiteral(0);
        case Type.String:
            return H.mkStringLiteral("");
        case Type.Image:
            return H.namespaceCall("image", "create image", [H.mkStringLiteral("")]);
        case Type.Sprite:
            return H.namespaceCall("game", "invalid sprite", []);
    }
    throw new Error("No default value for type");
}

function compileNote(e: Environment, b: B.Block): J.JExpr {
    var note = b.type.match(/^device_note_([A-G])/)[1];
    return H.namespaceCall("music", "note", [H.mkStringLiteral(note)]);
}

function compileDuration(e: Environment, b: B.Block): J.JExpr {
    var matches = b.type.match(/^device_duration_1\/(\d+)/);
    if (matches)
        return H.mkSimpleCall("/", [
            H.namespaceCall("music", "tempo", []),
            H.mkNumberLiteral(parseInt(matches[1]))]);
    else
        return H.namespaceCall("music", "tempo", []);
}

function compileBeat(e: Environment, b: B.Block): J.JExpr {
    var matches = b.getFieldValue("fraction").match(/^1\/(\d+)/);
    if (matches)
        return H.mkSimpleCall("/", [
            H.namespaceCall("music", "beat", []),
            H.mkNumberLiteral(parseInt(matches[1]))]);
    else
        return H.namespaceCall("music", "beat", []);
}

// [t] is the expected type; we assume that we never null block children
// (because placeholder blocks have been inserted by the type-checking phase
// whenever a block was actually missing).
function compileExpression(e: Environment, b: B.Block): J.JExpr {
    assert(b != null);
    if (b.disabled || b.type == "placeholder")
        return defaultValueForType(returnType(e, b));

    // Tricks for musical notes...
    if (b.type.match(/^device_note_/))
        return compileNote(e, b); // legacy
    if (b.type.match(/^device_duration_/))
        return compileDuration(e, b);

    switch (b.type) {
        case "math_number":
            return compileNumber(e, b);
        case "math_op2":
            return compileMathOp2(e, b);
        case "math_op3":
            return compileMathOp3(e, b);
        case "device_random":
            return compileRandom(e, b);
        case "math_arithmetic":
        case "logic_compare":
        case "logic_operation":
            return compileArithmetic(e, b);
        case "logic_boolean":
            return compileBoolean(e, b);
        case "logic_negate":
            return compileNot(e, b);
        case "variables_get":
            return compileVariableGet(e, b);
        case "text":
            return compileText(e, b);
        case 'device_build_image':
            return compileImage(e, b, false, "image", "create image");
        case 'device_build_big_image':
            return compileImage(e, b, true, "image", "create image");
        case 'game_sprite_property':
            return compileStdCall(e, b, e.stdCallTable["game_sprite_" + b.getFieldValue("property")]);
        case 'device_beat':
            return compileBeat(e, b);
        default:
            if (b.type in e.stdCallTable)
                return compileStdCall(e, b, e.stdCallTable[b.type]);
            else {
                console.error("Unable to compile expression: " + b.type);
                return defaultValueForType(returnType(e, b));
            }
    }
}

///////////////////////////////////////////////////////////////////////////////
// Environments
///////////////////////////////////////////////////////////////////////////////

// Environments are persistent.

interface Environment {
    bindings: Binding[];
    stdCallTable: Util.StringMap<StdFunc>;
}

interface Binding {
    name: string;
    type: Point;
    usedAsForIndex: number;
    incompatibleWithFor?: boolean;
}

function isCompiledAsForIndex(b: Binding) {
    return b.usedAsForIndex && !b.incompatibleWithFor;
}

function extend(e: Environment, x: string, t: Type): Environment {
    assert(lookup(e, x) == null);
    return {
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

function emptyEnv(): Environment {
    return {
        bindings: [],
        stdCallTable: JSON.parse(JSON.stringify(defaultCallTable))
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
        e = extend(e, local, Type.Number);
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
        H.mkExprStmt(H.mkExprHolder([], H.stdCall("pause", [H.mkNumberLiteral(20)])))
    ]));
}

function compileForever(e: Environment, b: B.Block): J.JStmt {
    var bBody = b.getInputTargetBlock("HANDLER");
    var body = compileStatements(e, bBody);
    return mkCallWithCallback(e, "basic", "forever", [], body);
}

function compilePrint(e: Environment, b: B.Block): J.JStmt {
    var text = compileExpression(e, b.getInputTargetBlock("TEXT"));
    return H.mkExprStmt(H.mkExprHolder([], H.mkSimpleCall("post to wall", [text])));
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

function compileStdCall(e: Environment, b: B.Block, func: StdFunc) {
    var args = func.args.map((p: StdArg) => {
        var lit: any = p.literal;
        if (lit)
            return lit instanceof String ? H.mkStringLiteral(<string>lit) : H.mkNumberLiteral(<number>lit);
        var f = b.getFieldValue(p.field);
        if (f)
            return H.mkStringLiteral(f);
        else
            return compileExpression(e, b.getInputTargetBlock(p.field))
    });
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

function compileEvent(e: Environment, b: B.Block, event: string, args: string[], ns: string = "input"): J.JStmt {
    var bBody = b.getInputTargetBlock("HANDLER");
    var compiledArgs = args.map((arg: string) => {
        return H.mkStringLiteral(b.getFieldValue(arg));
    });
    var body = compileStatements(e, bBody);
    return mkCallWithCallback(e, ns, event, compiledArgs, body);
}

function compileNumberEvent(e: Environment, b: B.Block, event: string, args: string[], ns: string = "input"): J.JStmt {
    var bBody = b.getInputTargetBlock("HANDLER");
    var compiledArgs = args.map((arg: string) => {
        return H.mkNumberLiteral(parseInt(b.getFieldValue(arg)));
    });
    var body = compileStatements(e, bBody);
    return mkCallWithCallback(e, ns, event, compiledArgs, body);
}

function compileImage(e: Environment, b: B.Block, big: boolean, n: string, f: string, args?: J.JExpr[]): J.JCall {
    args = args === undefined ? [] : args;
    var state = "\n";
    var rows = 5;
    var columns = big ? 10 : 5;
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
    isExtensionMethod?: boolean
    namespace?: string;
}

var defaultCallTable: Util.StringMap<StdFunc> = {
    device_scroll_image: {
        f: "scroll image",
        args: [{ field: "sprite" }, { field: "frame offset" }, { field: "delay" }],
        isExtensionMethod: true
    },
    device_show_image_offset: {
        f: "show image",
        args: [{ field: "sprite" }, { field: "offset" }],
        isExtensionMethod: true
    },
    game_create_sprite: {
        namespace: "game",
        f: "create sprite",
        args: [{ field: "x" }, { field: "y" }]
    },
    game_move_sprite: {
        isExtensionMethod: true,
        f: "move",
        args: [{ field: "sprite" }, { field: "leds" }]
    },
    game_turn_left: {
        isExtensionMethod: true,
        f: "turn left",
        args: [{ field: "sprite" }, { field: "angle" }]
    },
    game_turn_right: {
        isExtensionMethod: true,
        f: "turn right",
        args: [{ field: "sprite" }, { field: "angle" }]
    },
    game_sprite_change_x: {
        isExtensionMethod: true,
        f: "change x by",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_change_y: {
        isExtensionMethod: true,
        f: "change y by",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_change_direction: {
        isExtensionMethod: true,
        f: "change direction by",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_change_blink: {
        isExtensionMethod: true,
        f: "change blink by",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_change_brightness: {
        isExtensionMethod: true,
        f: "change brightness by",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_set_x: {
        isExtensionMethod: true,
        f: "set x",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_set_y: {
        isExtensionMethod: true,
        f: "set y",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_set_direction: {
        isExtensionMethod: true,
        f: "set direction",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_set_blink: {
        isExtensionMethod: true,
        f: "set blink",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_set_brightness: {
        isExtensionMethod: true,
        f: "set brightness",
        args: [{ field: "sprite" }, { field: "value" }]
    },
    game_sprite_bounce: {
        isExtensionMethod: true,
        f: "if on edge, bounce",
        args: [{ field: "sprite" }]
    },
    game_sprite_touching_sprite: {
        isExtensionMethod: true,
        f: "is touching",
        args: [{ field: "sprite" }, { field: "other" }]
    },
    game_sprite_touching_edge: {
        isExtensionMethod: true,
        f: "is touching edge",
        args: [{ field: "sprite" }]
    },
    game_sprite_x: {
        isExtensionMethod: true,
        f: "x",
        args: [{ field: "sprite" }]
    },
    game_sprite_y: {
        isExtensionMethod: true,
        f: "y",
        args: [{ field: "sprite" }]
    },
    game_sprite_direction: {
        isExtensionMethod: true,
        f: "direction",
        args: [{ field: "sprite" }]
    },
    game_sprite_blink: {
        isExtensionMethod: true,
        f: "blink",
        args: [{ field: "sprite" }]
    },
    game_sprite_brightness: {
        isExtensionMethod: true,
        f: "brightness",
        args: [{ field: "sprite" }]
    }
}

function compileStatements(e: Environment, b: B.Block): J.JStmt[] {
    if (b == null)
        return [];

    var stmts: J.JStmt[] = [];
    while (b) {
        if (!b.disabled) {
            switch (b.type) {
                case 'controls_if':
                    append(stmts, compileControlsIf(e, <B.IfBlock>b));
                    break;

                case 'controls_for':
                case 'controls_simple_for':
                    append(stmts, compileControlsFor(e, b));
                    break;

                case 'text_print':
                    stmts.push(compilePrint(e, b));
                    break;

                case 'variables_set':
                    stmts.push(compileSet(e, b));
                    break;

                case 'variables_change':
                    stmts.push(compileChange(e, b));
                    break;

                case 'device_forever':
                    stmts.push(compileForever(e, b));
                    break;

                case 'controls_repeat_ext':
                    stmts.push(compileControlsRepeat(e, b));
                    break;

                case 'device_while':
                    stmts.push(compileWhile(e, b));
                    break;

                // Special treatment for the event handlers (they require a specific
                // compilation scheme with action-handlers).
                case 'radio_broadcast_received_event':
                    stmts.push(compileNumberEvent(e, b, "on message received", ["MESSAGE"], "radio"));
                    break;

                case 'radio_datagraph_received_event':
                    stmts.push(compileEvent(e, b, "on data received", [], "radio"));
                    break;
                case 'device_gesture_event':
                    stmts.push(compileEvent(e, b, "on " + b.getFieldValue("NAME"), []));
                    break;

                case 'device_pin_event':
                    stmts.push(compileEvent(e, b, "on pin pressed", ["NAME"]));
                    break;

                case 'device_show_leds':
                    stmts.push(H.mkExprStmt(H.mkExprHolder([],
                        compileImage(e, b, false, "basic", "show leds", [H.mkNumberLiteral(400)]))));
                    break;

                case 'game_turn_sprite':
                    stmts.push(compileStdBlock(e, b, e.stdCallTable["game_turn_" + b.getFieldValue("direction")]));
                    break;
                case 'game_sprite_set_property':
                    stmts.push(compileStdBlock(e, b, e.stdCallTable["game_sprite_set_" + b.getFieldValue("property")]));
                    break;
                case 'game_sprite_change_xy':
                    stmts.push(compileStdBlock(e, b, e.stdCallTable["game_sprite_change_" + b.getFieldValue("property")]));
                    break;
                default:
                    if (b.type in e.stdCallTable)
                        stmts.push(compileStdBlock(e, b, e.stdCallTable[b.type]));
                    else
                        console.error("Not generating code for (not a statement / not supported): " + b.type);
            }
        }
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
    return /(forever|_event)$/.test(b.type);
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
function mkEnv(w: B.Workspace, blockInfo: blockyloader.BlocksInfo): Environment {
    // The to-be-returned environment.
    let e = emptyEnv();

    // append functions in stdcalltable
    if (blockInfo)
        blockInfo.blocks
            .forEach(fn => {
                if (e.stdCallTable[fn.attributes.blockId]) {
                    console.error("compiler: function " + fn.attributes.blockId + " already defined");
                    return;
                }
                let fieldMap = blockyloader.parameterNames(fn);
                e.stdCallTable[fn.attributes.blockId] = {
                    namespace: fn.namespace,
                    f: fn.name,
                    isExtensionMethod: fn.kind == ts.mbit.SymbolKind.Method || fn.kind == ts.mbit.SymbolKind.Property,
                    args: fn.parameters.map(p => {
                        if (fieldMap[p.name]) return { field: fieldMap[p.name].name };
                        else return null;
                    }).filter(a => !!a)
                }
            })

    // First pass: collect loop variables.
    w.getAllBlocks().forEach((b: B.Block) => {
        if (b.type == "controls_for" || b.type == "controls_simple_for") {
            let x = b.getFieldValue("VAR");
            // It's ok for two loops to share the same variable.
            if (lookup(e, x) == null)
                e = extend(e, x, Type.Number);
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

function compileWorkspace(w: B.Workspace, blockInfo: blockyloader.BlocksInfo, options: CompileOptions): J.JApp {
    try {
        var decls: J.JDecl[] = [];
        var e = mkEnv(w, blockInfo);
        infer(e, w);

        // All variables in this script are compiled as locals within main.
        var stmtsVariables: J.JStmt[] = [];
        e.bindings.forEach((b: Binding) => {
            var btype = find(b.type);
            if (!isCompiledAsForIndex(b))
                stmtsVariables.push(H.mkDefAndAssign(b.name, toTdType(find(b.type).type), defaultValueForType(find(b.type))));
        });
        // It's magic! The user can either assign to "whole note" (and everything
        // works out), or not do it, and if they need it, the variable will be
        // declared and assigned to automatically.
        var foundWholeNote = e.bindings.filter(x => x.name == "whole note").length > 0;
        var needsWholeNote = w.getAllBlocks().filter(x => !!x.type.match(/^device_duration_/)).length > 0;
        if (!foundWholeNote && needsWholeNote) {
            stmtsVariables.push(H.mkDefAndAssign("whole note", toTdType(Type.Number), H.mkNumberLiteral(2000)));
            e = extend(e, "whole note", Type.Number);
        }

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

export function compile(b: B.Workspace, blockInfo: blockyloader.BlocksInfo, options: CompileOptions): string {
    Errors.clear();
    return tdASTtoTS(compileWorkspace(b, blockInfo, options));
}

function tdASTtoTS(app: J.JApp) {
    let output = ""
    let indent = ""
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
                    Util.oops("invalid nodeType when flattning: " + e.nodeType)
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

    let byNodeType: Util.StringMap<(n: J.JNode) => void> = {
        app: (n: J.JApp) => {
            Util.assert(n.decls.length == 1)
            Util.assert(n.decls[0].nodeType == "action");
            (n.decls[0] as J.JAction).body.forEach(emit)
        },

        exprStmt: (n: J.JExprStmt) => {
            emit(n.expr)
            write(";\n")
        },

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

    return output;

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
        indent += "    "
        write("{\n")
        f()
        indent = indent.slice(4)
        write("\n}\n")
    }
}

