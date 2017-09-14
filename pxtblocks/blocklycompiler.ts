///<reference path='../localtypings/blockly.d.ts'/>
/// <reference path="../built/pxtlib.d.ts" />

///////////////////////////////////////////////////////////////////////////////
//                A compiler from Blocky to TouchDevelop                     //
///////////////////////////////////////////////////////////////////////////////

import B = Blockly;

let iface: pxt.worker.Iface

namespace pxt.blocks {
    export function initWorker() {
        if (!iface) {
            iface = pxt.worker.makeWebWorker(pxt.webConfig.workerjs)
        }
    }

    export function workerOpAsync(op: string, arg: pxtc.service.OpArg) {
        initWorker()
        return iface.opAsync(op, arg)
    }

    let placeholders: Map<Map<any>> = {};
    const MAX_COMMENT_LINE_LENGTH = 50;

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

    export class Point {
        constructor(
            public link: Point,
            public type: string,
            public parentType?: Point,
            public childType?: Point

        ) { }
    }

    function find(p: Point): Point {
        if (p.link)
            return find(p.link);
        return p;
    }

    function union(p1: Point, p2: Point) {
        let _p1 = find(p1);
        let _p2 = find(p2);
        assert(_p1.link == null && _p2.link == null);

        if (_p1 == _p2)
            return;

        if (_p1.childType && _p2.childType) {
            const ct = _p1.childType;
            _p1.childType = null;
            union(ct, _p2.childType);
        }
        else if (_p1.childType && !_p2.childType) {
            _p2.childType = _p1.childType;
        }

        if (_p1.parentType && _p2.parentType) {
            const pt = _p1.parentType;
            _p1.parentType = null;
            union(pt, _p2.parentType);
        }
        else if (_p1.parentType && !_p2.parentType) {
            _p2.parentType = _p1.parentType;
        }


        let t = unify(_p1.type, _p2.type);

        p1.link = _p2;
        _p1.link = _p2;
        p1.type = null;
        p2.type = t;
    }

    // Ground types.
    function mkPoint(t: string): Point {
        return new Point(null, t);
    }
    const pNumber = mkPoint("number");
    const pBoolean = mkPoint("boolean");
    const pString = mkPoint("string");
    const pUnit = mkPoint("void");

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

        if (b.type == "placeholder" || b.type === pxtc.TS_OUTPUT_TYPE)
            return find((<any>b).p);

        if (b.type == "variables_get")
            return find(lookup(e, escapeVarName(b.getFieldValue("VAR"), e)).type);

        if (!b.outputConnection) {
            return ground(pUnit.type);
        }

        const check = b.outputConnection.check_ && b.outputConnection.check_.length ? b.outputConnection.check_[0] : "T";

        if (check === "Array") {
            // The only block that hits this case should be lists_create_with, so we
            // can safely infer the type from the first input that has a return type
            let tp: Point;
            if (b.inputList && b.inputList.length) {
                for (const input of b.inputList) {
                    if (input.connection && input.connection.targetBlock()) {
                        let t = find(returnType(e, input.connection.targetBlock()))
                        if (t) {
                            if (t.parentType) {
                                return t.parentType;
                            }
                            tp = ground(t.type + "[]");
                            genericLink(tp, t);
                            break;
                        }
                    }
                }
            }
            return tp || ground("Array");
        }
        else if (check === "T") {
            const func = e.stdCallTable[b.type];
            const isArrayGet = b.type === "lists_index_get";
            if (isArrayGet || func && func.args.length) {
                let parentInput: B.Input;

                if (isArrayGet) {
                    parentInput = b.inputList.filter(i => i.name === "LIST")[0];
                }
                else {
                    parentInput = b.inputList.filter(i => i.name === func.args[0].field)[0];
                }

                if (parentInput.connection && parentInput.connection.targetBlock()) {
                    const parentType = returnType(e, parentInput.connection.targetBlock());
                    if (parentType.childType) {
                        return parentType.childType;
                    }
                    const p = isArrayType(parentType.type) ? mkPoint(parentType.type.substr(-2)) : mkPoint(null);
                    genericLink(parentType, p);
                    return p;
                }
            }
            return mkPoint(null);
        }

        return ground(check);
    }

    // Basic type unification routine; easy, because there's no structural types.
    // FIXME: Generics are not supported
    function unify(t1: string, t2: string) {
        if (t1 == null || t1 === "Array" && isArrayType(t2))
            return t2;
        else if (t2 == null || t2 === "Array" && isArrayType(t1))
            return t1;
        else if (t1 == t2)
            return t1;
        else
            throw new Error("cannot mix " + t1 + " with " + t2);
    }

    function isArrayType(type: string) {
        return type && type.indexOf("[]") !== -1;
    }

    function mkPlaceholderBlock(e: Environment, parent: B.Block, type?: string): B.Block {
        // XXX define a proper placeholder block type
        return <any>{
            type: "placeholder",
            p: mkPoint(type || null),
            workspace: e.workspace,
            parentBlock_: parent
        };
    }

    function attachPlaceholderIf(e: Environment, b: B.Block, n: string, type?: string) {
        // Ugly hack to keep track of the type we want there.
        const target = b.getInputTargetBlock(n);
        if (!target) {
            if (!placeholders[b.id]) {
                placeholders[b.id] = {};
            }

            if (!placeholders[b.id][n]) {
                placeholders[b.id][n] = mkPlaceholderBlock(e, b, type);
            }
        }
        else if (target.type === pxtc.TS_OUTPUT_TYPE && !((target as any).p)) {
            (target as any).p = mkPoint(null);
        }
    }

    function getInputTargetBlock(b: B.Block, n: string) {
        const res = b.getInputTargetBlock(n);

        if (!res) {
            return placeholders[b.id] && placeholders[b.id][n];
        }
        else {
            return res
        }
    }

    function removeAllPlaceholders() {
        placeholders = {};
    }

    // Unify the *return* type of the parameter [n] of block [b] with point [p].
    function unionParam(e: Environment, b: B.Block, n: string, p: Point) {
        try {
            attachPlaceholderIf(e, b, n);
            union(returnType(e, getInputTargetBlock(b, n)), p);
        } catch (e) {
            throwBlockError("The parameter " + n + " of this block is of the wrong type. More precisely: " + e, b);
        }
    }

    function infer(e: Environment, w: B.Workspace) {
        if (w) w.getAllBlocks().filter(b => !b.disabled).forEach((b: B.Block) => {
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
                                attachPlaceholderIf(e, b, "A", pBoolean.type);
                                attachPlaceholderIf(e, b, "B", pBoolean.type);
                                break;
                            case "EQ": case "NEQ":
                                attachPlaceholderIf(e, b, "A");
                                attachPlaceholderIf(e, b, "B");
                                let p1 = returnType(e, getInputTargetBlock(b, "A"));
                                let p2 = returnType(e, getInputTargetBlock(b, "B"));
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
                        attachPlaceholderIf(e, b, "A", pBoolean.type);
                        attachPlaceholderIf(e, b, "B", pBoolean.type);
                        break;

                    case "logic_negate":
                        attachPlaceholderIf(e, b, "BOOL", pBoolean.type);
                        break;

                    case "controls_if":
                        for (let i = 0; i <= (<B.IfBlock>b).elseifCount_; ++i)
                            attachPlaceholderIf(e, b, "IF" + i, pBoolean.type);
                        break;

                    case "controls_simple_for":
                        unionParam(e, b, "TO", ground(pNumber.type));
                        break;
                    case "controls_for_of":
                        unionParam(e, b, "LIST", ground("Array"));
                        const listTp = returnType(e, getInputTargetBlock(b, "LIST"));
                        const elementTp = lookup(e, escapeVarName(b.getFieldValue("VAR"), e)).type;
                        genericLink(listTp, elementTp);
                        break;
                    case "variables_set":
                    case "variables_change":
                        let x = escapeVarName(b.getFieldValue("VAR"), e);
                        let p1 = lookup(e, x).type;
                        attachPlaceholderIf(e, b, "VALUE");
                        let rhs = getInputTargetBlock(b, "VALUE");
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
                        attachPlaceholderIf(e, b, "COND", pBoolean.type);
                        break;
                    case "lists_index_get":
                        unionParam(e, b, "LIST", ground("Array"));
                        unionParam(e, b, "INDEX", ground(pNumber.type));
                        const listType = returnType(e, getInputTargetBlock(b, "LIST"));
                        const ret = returnType(e, b);
                        genericLink(listType, ret);
                        break;
                    case "lists_index_set":
                        unionParam(e, b, "LIST", ground("Array"));
                        attachPlaceholderIf(e, b, "VALUE");
                        handleGenericType(b, "LIST");
                        unionParam(e, b, "INDEX", ground(pNumber.type));
                        break;
                    default:
                        if (b.type in e.stdCallTable) {
                            const call = e.stdCallTable[b.type];
                            call.args.forEach((p: StdArg, i: number) => {
                                const isInstance = call.isExtensionMethod && i === 0;
                                if (p.field && !b.getFieldValue(p.field)) {
                                    let i = b.inputList.filter((i: B.Input) => i.name == p.field)[0];
                                    if (i.connection && i.connection.check_) {
                                        if (isInstance && connectionCheck(i) === "Array") {
                                            let gen = handleGenericType(b, p.field);
                                            if (gen) {
                                                return;
                                            }
                                        }

                                        // All of our injected blocks have single output checks, but the builtin
                                        // blockly ones like string.length and array.length might have multiple
                                        for (let j = 0; j < i.connection.check_.length; j++) {
                                            try {
                                                let t = i.connection.check_[j];
                                                unionParam(e, b, p.field, ground(t));
                                                break;
                                            }
                                            catch (e) {
                                                // Ignore type checking errors in the blocks...
                                            }
                                        }
                                    }
                                }
                            });
                        }
                }
            } catch (err) {
                const be = ((<any>err).block as B.Block) || b;
                be.setWarningText(err + "");
                e.errors.push(be);
            }
        });

        // Last pass: if some variable has no type (because it was never used or
        // assigned to), just unify it with int...
        e.bindings.forEach((b: Binding) => {
            if (getConcreteType(b.type).type == null)
                union(b.type, ground(pNumber.type));
        });

        function connectionCheck(i: B.Input) {
            return i.name ? i.connection && i.connection.check_ && i.connection.check_.length ? i.connection.check_[0] : "T" : undefined;
        }

        function handleGenericType(b: B.Block, name: string) {
            let genericArgs = b.inputList.filter((input: B.Input) => connectionCheck(input) === "T");
            if (genericArgs.length) {
                const gen = getInputTargetBlock(b, genericArgs[0].name);
                if (gen) {
                    const arg = returnType(e, gen);
                    const arrayType = arg.type ? ground(returnType(e, gen).type + "[]") : ground(null);
                    genericLink(arrayType, arg);
                    unionParam(e, b, name, arrayType);
                    return true;
                }
            }
            return false;
        }
    }

    function genericLink(parent: Point, child: Point) {
        const p = find(parent);
        const c = find(child);
        if (p.childType) {
            union(p.childType, c);
        }
        else {
            p.childType = c;
        }

        if (c.parentType) {
            union(c.parentType, p);
        }
        else {
            c.parentType = p;
        }
    }

    function getConcreteType(point: Point, found: Point[] = []) {
        const t = find(point)
        if (found.indexOf(t)  === -1) {
            found.push(t);
            if (!t.type || t.type === "Array") {
                if (t.parentType) {
                    const parent = getConcreteType(t.parentType, found);
                    if (parent.type && parent.type !== "Array") {
                        t.type = parent.type.substr(0, parent.type.length - 2);
                        return t;
                    }
                }

                if (t.childType) {
                    const child = getConcreteType(t.childType, found);
                    if (child.type) {
                        t.type = child.type + "[]";
                        return t;
                    }

                }
            }
        }
        return t;
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Expressions
    //
    // Expressions are now directly compiled as a tree. This requires knowing, for
    // each property ref, the right value for its [parent] property.
    ///////////////////////////////////////////////////////////////////////////////

    function extractNumber(b: B.Block): number {
        let v = b.getFieldValue(b.type === "math_number_minmax" ? "SLIDER" : "NUM");
        const parsed = parseFloat(v);
        checkNumber(parsed, b);
        return parsed;
    }

    function checkNumber(n: number, b: B.Block) {
        if (n === Infinity || isNaN(n)) {
            throwBlockError(lf("Number entered is either too large or too small"), b);
        }
    }

    function extractTsExpression(e: Environment, b: B.Block, comments: string[]): JsNode {
        return mkText(b.getFieldValue("EXPRESSION"));
    }

    function compileNumber(e: Environment, b: B.Block, comments: string[]): JsNode {
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

    function compileArithmetic(e: Environment, b: B.Block, comments: string[]): JsNode {
        let bOp = b.getFieldValue("OP");
        let left = getInputTargetBlock(b, "A");
        let right = getInputTargetBlock(b, "B");
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

    function compileModulo(e: Environment, b: B.Block, comments: string[]): JsNode {
        let left = getInputTargetBlock(b, "DIVIDEND");
        let right = getInputTargetBlock(b, "DIVISOR");
        let args = [compileExpression(e, left, comments), compileExpression(e, right, comments)];
        return H.mkSimpleCall("%", args);
    }

    function compileMathOp2(e: Environment, b: B.Block, comments: string[]): JsNode {
        let op = b.getFieldValue("op");
        let x = compileExpression(e, getInputTargetBlock(b, "x"), comments);
        let y = compileExpression(e, getInputTargetBlock(b, "y"), comments);
        return H.mathCall(op, [x, y])
    }

    function compileMathOp3(e: Environment, b: B.Block, comments: string[]): JsNode {
        let x = compileExpression(e, getInputTargetBlock(b, "x"), comments);
        return H.mathCall("abs", [x]);
    }

    function compileText(e: Environment, b: B.Block, comments: string[]): JsNode {
        return H.mkStringLiteral(b.getFieldValue("TEXT"));
    }

    function compileTextJoin(e: Environment, b: B.Block, comments: string[]): JsNode {
        let last: JsNode;
        let i = 0;
        while (true) {
            const val = getInputTargetBlock(b, "ADD" + i);
            i++;

            if (!val) {
                if (i < b.inputList.length) {
                    continue;
                }
                else {
                    break;
                }
            }

            const compiled = compileExpression(e, val, comments);
            if (!last) {
                if (val.type.indexOf("text") === 0) {
                    last = compiled;
                }
                else {
                    // If we don't start with a string, then the TS won't match
                    // the implied semantics of the blocks
                    last = H.mkSimpleCall("+", [H.mkStringLiteral(""), compiled]);
                }
            }
            else {
                last = H.mkSimpleCall("+", [last, compiled]);
            }
        }

        if (!last) {
            return H.mkStringLiteral("");
        }

        return last;
    }

    function compileBoolean(e: Environment, b: B.Block, comments: string[]): JsNode {
        return H.mkBooleanLiteral(b.getFieldValue("BOOL") == "TRUE");
    }

    function compileNot(e: Environment, b: B.Block, comments: string[]): JsNode {
        let expr = compileExpression(e, getInputTargetBlock(b, "BOOL"), comments);
        return mkPrefix("!", [H.mkParenthesizedExpression(expr)]);
    }

    function compileCreateList(e: Environment, b: B.Block, comments: string[]): JsNode {
        // collect argument
        let args = b.inputList.map(input => input.connection && input.connection.targetBlock() ? compileExpression(e, input.connection.targetBlock(), comments) : undefined)
            .filter(e => !!e);

        return H.mkArrayLiteral(args);
    }

    function compileListGet(e: Environment, b: B.Block, comments: string[]): JsNode {
        const listBlock = getInputTargetBlock(b, "LIST");
        const listExpr = compileExpression(e, listBlock, comments);
        const index = compileExpression(e, getInputTargetBlock(b, "INDEX"), comments);
        const res = mkGroup([listExpr, mkText("["), index, mkText("]")]);

        return res;
    }

    function compileListSet(e: Environment, b: B.Block, comments: string[]): JsNode {
        const listBlock = getInputTargetBlock(b, "LIST");
        const listExpr = compileExpression(e, listBlock, comments);
        const index = compileExpression(e, getInputTargetBlock(b, "INDEX"), comments);
        const value = compileExpression(e, getInputTargetBlock(b, "VALUE"), comments);
        const res =  mkGroup([listExpr, mkText("["), index, mkText("] = "), value]);

        return listBlock.type === "lists_create_with" ? prefixWithSemicolon(res) : res;

    }

    function compileProcedure(e: Environment, b: B.Block, comments: string[]): JsNode[] {
        const name = escapeVarName(b.getFieldValue("NAME"), e, true);
        const stmts = getInputTargetBlock(b, "STACK");
        return [
            mkText("function " + name + "() "),
            compileStatements(e, stmts)
        ];
    }

    function compileProcedureCall(e: Environment, b: B.Block, comments: string[]): JsNode {
        const name = escapeVarName(b.getFieldValue("NAME"), e, true);
        return mkStmt(mkText(name + "()"));
    }

    function defaultValueForType(t: Point): JsNode {
        if (t.type == null) {
            union(t, ground(pNumber.type));
            t = find(t);
        }

        if (isArrayType(t.type)) {
            return mkText("[]");
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
    export function compileExpression(e: Environment, b: B.Block, comments: string[]): JsNode {
        assert(b != null);
        e.stats[b.type] = (e.stats[b.type] || 0) + 1;
        maybeAddComment(b, comments);
        let expr: JsNode;
        if (b.disabled || b.type == "placeholder") {
            const ret = find(returnType(e, b));
            if (ret.type === "Array") {
                // FIXME: Can't use default type here because TS complains about
                // the array having an implicit any type. However, forcing this
                // to be a number array may cause type issues. Also, potential semicolon
                // issues if we ever have a block where the array is not the first argument...
                let isExpression = b.parentBlock_.type === "lists_index_get";
                if (!isExpression) {
                    const call = e.stdCallTable[b.parentBlock_.type];
                    isExpression = call && call.isExpression;
                }
                const arrayNode = mkText("[0]");
                expr = isExpression ? arrayNode : prefixWithSemicolon(arrayNode);
            }
            else {
                expr = defaultValueForType(returnType(e, b));
            }
        }
        else switch (b.type) {
            case "math_number":
                expr = compileNumber(e, b, comments); break;
            case "math_number_minmax":
                expr = compileNumber(e, b, comments); break;
            case "math_op2":
                expr = compileMathOp2(e, b, comments); break;
            case "math_op3":
                expr = compileMathOp3(e, b, comments); break;
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
            case "text_join":
                expr = compileTextJoin(e, b, comments); break;
            case "lists_create_with":
                expr = compileCreateList(e, b, comments); break;
            case "lists_index_get":
                expr = compileListGet(e, b, comments); break;
            case "lists_index_set":
                expr = compileListSet(e, b, comments); break;
            case pxtc.TS_OUTPUT_TYPE:
                expr = extractTsExpression(e, b, comments); break;
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

    export interface Environment {
        workspace: Blockly.Workspace;
        bindings: Binding[];
        stdCallTable: pxt.Map<StdFunc>;
        errors: B.Block[];
        renames: RenameMap;
        stats: pxt.Map<number>;
    }

    export interface RenameMap {
        oldToNew: Map<string>;
        takenNames: Map<boolean>;
        oldToNewFunctions: Map<string>;
    }

    export enum VarUsage {
        Unknown,
        Read,
        Assign
    }

    export interface Binding {
        name: string;
        type: Point;
        declaredInLocalScope: number;
        assigned?: VarUsage; // records the first usage of this variable (read/assign)
        mustBeGlobal?: boolean;
    }

    function isCompiledAsLocalVariable(b: Binding) {
        return b.declaredInLocalScope && !b.mustBeGlobal;
    }

    function extend(e: Environment, x: string, t: string): Environment {
        assert(lookup(e, x) == null);
        return {
            workspace: e.workspace,
            bindings: [{ name: x, type: ground(t), declaredInLocalScope: 0 }].concat(e.bindings),
            stdCallTable: e.stdCallTable,
            errors: e.errors,
            renames: e.renames,
            stats: e.stats
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
            stdCallTable: {},
            errors: [],
            renames: {
                oldToNew: {},
                takenNames: {},
                oldToNewFunctions: {}
            },
            stats: {}
        }
    };

    ///////////////////////////////////////////////////////////////////////////////
    // Statements
    ///////////////////////////////////////////////////////////////////////////////

    function compileControlsIf(e: Environment, b: B.IfBlock, comments: string[]): JsNode[] {
        let stmts: JsNode[] = [];
        // Notice the <= (if there's no else-if, we still compile the primary if).
        for (let i = 0; i <= b.elseifCount_; ++i) {
            let cond = compileExpression(e, getInputTargetBlock(b, "IF" + i), comments);
            let thenBranch = compileStatements(e, getInputTargetBlock(b, "DO" + i));
            let startNode = mkText("if (")
            if (i > 0) {
                startNode = mkText("else if (")
                startNode.glueToBlock = GlueMode.WithSpace;
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
            elseNode.glueToBlock = GlueMode.WithSpace;
            append(stmts, [
                elseNode,
                compileStatements(e, getInputTargetBlock(b, "ELSE"))
            ])
        }
        return stmts;
    }

    function compileControlsFor(e: Environment, b: B.Block, comments: string[]): JsNode[] {
        let bVar = escapeVarName(b.getFieldValue("VAR"), e);
        let bTo = getInputTargetBlock(b, "TO");
        let bDo = getInputTargetBlock(b, "DO");
        let bBy = getInputTargetBlock(b, "BY");
        let bFrom = getInputTargetBlock(b, "FROM");
        let incOne = !bBy || (bBy.type.match(/^math_number/) && extractNumber(bBy) == 1)

        let binding = lookup(e, bVar);
        assert(binding.declaredInLocalScope > 0);

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

    function compileControlsRepeat(e: Environment, b: B.Block, comments: string[]): JsNode[] {
        let bound = compileExpression(e, getInputTargetBlock(b, "TIMES"), comments);
        let body = compileStatements(e, getInputTargetBlock(b, "DO"));
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

    function compileWhile(e: Environment, b: B.Block, comments: string[]): JsNode[] {
        let cond = compileExpression(e, getInputTargetBlock(b, "COND"), comments);
        let body = compileStatements(e, getInputTargetBlock(b, "DO"));
        return [
            mkText("while ("),
            cond,
            mkText(")"),
            body
        ]
    }

    function compileControlsForOf(e: Environment, b: B.Block, comments: string[]) {
        let bVar = escapeVarName(b.getFieldValue("VAR"), e);
        let bOf = getInputTargetBlock(b, "LIST");
        let bDo = getInputTargetBlock(b, "DO");

        let binding = lookup(e, bVar);
        assert(binding.declaredInLocalScope > 0);

        return [
            mkText("for (let " + bVar + " of "),
            compileExpression(e, bOf, comments),
            mkText(")"),
            compileStatements(e, bDo)
        ]
    }

    function compileForever(e: Environment, b: B.Block): JsNode {
        let bBody = getInputTargetBlock(b, "HANDLER");
        let body = compileStatements(e, bBody);
        return mkCallWithCallback(e, "basic", "forever", [], body);
    }

    // convert to javascript friendly name
    export function escapeVarName(name: string, e: Environment, isFunction = false): string {
        if (!name) return '_';

        if (isFunction) {
            if (e.renames.oldToNewFunctions[name]) {
                return e.renames.oldToNewFunctions[name];
            }
        }
        else if (e.renames.oldToNew[name]) {
            return e.renames.oldToNew[name];
        }

        let n = ts.pxtc.escapeIdentifier(name);

        if (e.renames.takenNames[n]) {
            let i = 2;

            while (e.renames.takenNames[n + i]) {
                i++;
            }

            n += i;
        }

        if (isFunction) {
            e.renames.oldToNewFunctions[name] = n;
        }
        else {
            e.renames.oldToNew[name] = n;
        }
        e.renames.takenNames[n] = true;
        return n;
    }

    function compileVariableGet(e: Environment, b: B.Block): JsNode {
        let name = escapeVarName(b.getFieldValue("VAR"), e);
        let binding = lookup(e, name);
        if (!binding.assigned)
            binding.assigned = VarUsage.Read;
        assert(binding != null && binding.type != null);
        return mkText(name);
    }

    function compileSet(e: Environment, b: B.Block, comments: string[]): JsNode {
        let bVar = escapeVarName(b.getFieldValue("VAR"), e);
        let bExpr = getInputTargetBlock(b, "VALUE");
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

    function compileChange(e: Environment, b: B.Block, comments: string[]): JsNode {
        let bVar = escapeVarName(b.getFieldValue("VAR"), e);
        let bExpr = getInputTargetBlock(b, "VALUE");
        let binding = lookup(e, bVar);
        if (!binding.assigned)
            binding.assigned = VarUsage.Read;
        let expr = compileExpression(e, bExpr, comments);
        let ref = mkText(bVar);
        return mkStmt(mkInfix(ref, "+=", expr))
    }

    function eventArgs(call: StdFunc): string[] {
        return call.args.map(ar => ar.field).filter(ar => !!ar);
    }

    function compileCall(e: Environment, b: B.Block, comments: string[]): JsNode {
        const call = e.stdCallTable[b.type];
        if (call.imageLiteral)
            return mkStmt(compileImage(e, b, call.imageLiteral, call.namespace, call.f, call.args.map(ar => compileArgument(e, b, ar, comments))))
        else if (call.hasHandler)
            return compileEvent(e, b, call, eventArgs(call), call.namespace, comments)
        else
            return mkStmt(compileStdCall(e, b, call, comments))
    }

    function compileArgument(e: Environment, b: B.Block, p: StdArg, comments: string[], beginningOfStatement = false): JsNode {
        let lit: any = p.literal;
        if (lit)
            return lit instanceof String ? H.mkStringLiteral(<string>lit) : H.mkNumberLiteral(<number>lit);
        let f = b.getFieldValue(p.field);
        if (f != null) {
            if (b.getField(p.field) instanceof pxtblockly.FieldTextInput) {
                return H.mkStringLiteral(f);
            }
            return mkText(f);
        }
        else {
            attachPlaceholderIf(e, b, p.field);
            const target = getInputTargetBlock(b, p.field);
            if (beginningOfStatement && target.type === "lists_create_with") {
                // We have to be careful of array literals at the beginning of a statement
                // because they can cause errors (i.e. they get parsed as an index). Add a
                // semicolon to the previous statement just in case.
                // FIXME: No need to do this if the previous statement was a code block
                return prefixWithSemicolon(compileExpression(e, target, comments));
            }
            return compileExpression(e, target, comments)
        }
    }

    function compileStdCall(e: Environment, b: B.Block, func: StdFunc, comments: string[]): JsNode {
        let args: JsNode[]
        if (isMutatingBlock(b) && b.mutation.getMutationType() === MutatorTypes.RestParameterMutator) {
            args = b.mutation.compileMutation(e, comments).children;
        }
        else {
            args = func.args.map((p: StdArg, i: number) => compileArgument(e, b, p, comments, func.isExtensionMethod && i === 0 && !func.isExpression));
        }

        const externalInputs = !b.getInputsInline();
        if (func.isIdentity)
            return args[0];
        else if (func.property) {
            return H.mkPropertyAccess(func.f, args[0]);
        } else if (func.isExtensionMethod) {
            if (func.attrs.defaultInstance) {
                let instance: JsNode;
                if (isMutatingBlock(b) && b.mutation.getMutationType() === MutatorTypes.DefaultInstanceMutator) {
                    instance = b.mutation.compileMutation(e, comments);
                }

                if (instance) {
                    args.unshift(instance);
                }
                else {
                    args.unshift(mkText(func.attrs.defaultInstance));
                }
            }
            return H.extensionCall(func.f, args, externalInputs);
        } else if (func.namespace) {
            return H.namespaceCall(func.namespace, func.f, args, externalInputs);
        } else {
            return H.stdCall(func.f, args, externalInputs);
        }
    }

    function compileStdBlock(e: Environment, b: B.Block, f: StdFunc, comments: string[]) {
        return mkStmt(compileStdCall(e, b, f, comments))
    }

    function mkCallWithCallback(e: Environment, n: string, f: string, args: JsNode[], body: JsNode, argumentDeclaration?: JsNode, isExtension = false): JsNode {
        body.noFinalNewline = true
        let callback: JsNode;
        if (argumentDeclaration) {
            callback = mkGroup([argumentDeclaration, body]);
        }
        else {
            callback = mkGroup([mkText("function ()"), body]);
        }

        if (isExtension)
            return mkStmt(H.extensionCall(f, args.concat([callback]), false));
        else
            return mkStmt(H.namespaceCall(n, f, args.concat([callback]), false));
    }

    function compileArg(e: Environment, b: B.Block, arg: string, comments: string[]): JsNode {
        // b.getFieldValue may be string, numbers
        const argb = getInputTargetBlock(b, arg);
        if (argb) return compileExpression(e, argb, comments);
        if (b.getField(arg) instanceof pxtblockly.FieldTextInput) return H.mkStringLiteral(b.getFieldValue(arg));
        return mkText(b.getFieldValue(arg))
    }

    function compileStartEvent(e: Environment, b: B.Block): JsNode {
        const bBody = getInputTargetBlock(b, "HANDLER");
        const body = compileStatements(e, bBody);

        if (pxt.appTarget.compile && pxt.appTarget.compile.onStartText && body && body.children) {
            body.children.unshift(mkStmt(mkText(`// ${pxtc.ON_START_COMMENT}\n`)))
        }

        return body;
    }

    function compileEvent(e: Environment, b: B.Block, stdfun: StdFunc, args: string[], ns: string, comments: string[]): JsNode {
        const compiledArgs: JsNode[] = args.map(arg => compileArg(e, b, arg, comments));
        const bBody = getInputTargetBlock(b, "HANDLER");
        const body = compileStatements(e, bBody);

        if (pxt.appTarget.compile && pxt.appTarget.compile.emptyEventHandlerComments && body.children.length === 0) {
            body.children.unshift(mkStmt(mkText(`// ${pxtc.HANDLER_COMMENT}`)))
        }

        let argumentDeclaration: JsNode;

        if (isMutatingBlock(b) && b.mutation.getMutationType() === MutatorTypes.ObjectDestructuringMutator) {
            argumentDeclaration = b.mutation.compileMutation(e, comments);
        }

        return mkCallWithCallback(e, ns, stdfun.f, compiledArgs, body, argumentDeclaration, stdfun.isExtensionMethod);
    }

    function isMutatingBlock(b: B.Block): b is MutatingBlock {
        return !!(b as MutatingBlock).mutation;
    }

    function compileImage(e: Environment, b: B.Block, frames: number, n: string, f: string, args?: JsNode[]): JsNode {
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
        return H.namespaceCall(n, f, [lit].concat(args), false);
    }

    // A standard function argument may be a field name (see below)
    // or a string|number literal.
    // The literal is used to hide argument in blocks
    // that are available in TD.
    export interface StdArg {
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
    export interface StdFunc {
        f: string;
        args: StdArg[];
        attrs: ts.pxtc.CommentAttrs;
        isExtensionMethod?: boolean;
        isExpression?: boolean;
        imageLiteral?: number;
        hasHandler?: boolean;
        property?: boolean;
        namespace?: string;
        isIdentity?: boolean; // TD_ID shim
    }

    function compileStatementBlock(e: Environment, b: B.Block): JsNode[] {
        let r: JsNode[];
        const comments: string[] = [];
        e.stats[b.type] = (e.stats[b.type] || 0) + 1;
        maybeAddComment(b, comments);
        switch (b.type) {
            case 'controls_if':
                r = compileControlsIf(e, <B.IfBlock>b, comments);
                break;
            case 'controls_for':
            case 'controls_simple_for':
                r = compileControlsFor(e, b, comments);
                break;
            case 'controls_for_of':
                r = compileControlsForOf(e, b, comments);
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
            case 'procedures_defnoreturn':
                r = compileProcedure(e, b, comments);
                break;
            case 'procedures_callnoreturn':
                r = [compileProcedureCall(e, b, comments)];
                break;
            case ts.pxtc.ON_START_TYPE:
                r = compileStartEvent(e, b).children;
                break;
            case pxtc.TS_STATEMENT_TYPE:
                r = compileTypescriptBlock(e, b);
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

        r.forEach(l => {
            if (l.type === NT.Block || l.type === NT.Prefix && Util.startsWith(l.op, "//")) {
                l.id = b.id
            }
        });

        return r;
    }

    function compileStatements(e: Environment, b: B.Block): JsNode {
        let stmts: JsNode[] = [];
        while (b) {
            if (!b.disabled) append(stmts, compileStatementBlock(e, b));
            b = b.getNextBlock();
        }
        return mkBlock(stmts);
    }

    function compileTypescriptBlock(e: Environment, b: B.Block) {
        let res: JsNode[] = [];
        let i = 0;

        while (true) {
            const value = b.getFieldValue("LINE" + i);
            i++;

            if (value !== null) {
                res.push(mkText(value + "\n"));

                const declaredVars: string = (b as any).declaredVariables
                if (declaredVars) {
                    const varNames = declaredVars.split(",");
                    varNames.forEach(n => {
                        const existing = lookup(e, n);
                        if (existing) {
                            existing.assigned = VarUsage.Assign;
                            existing.mustBeGlobal = false;
                        }
                        else {
                            e.bindings.push({
                                name: n,
                                type: mkPoint(null),
                                assigned: VarUsage.Assign,
                                declaredInLocalScope: 1,
                                mustBeGlobal: false
                            });
                        }
                    })
                }
            }
            else {
                break;
            }
        }

        return res;
    }

    function prefixWithSemicolon(n: JsNode) {
        const emptyStatement = mkStmt(mkText(";"));
        emptyStatement.glueToBlock = GlueMode.NoSpace;
        return mkGroup([emptyStatement, n]);
    }

    // This function creates an empty environment where type inference has NOT yet
    // been performed.
    // - All variables have been assigned an initial [Point] in the union-find.
    // - Variables have been marked to indicate if they are compatible with the
    //   TouchDevelop for-loop model.
    export function mkEnv(w: B.Workspace, blockInfo?: pxtc.BlocksInfo, skipVariables?: boolean): Environment {
        // The to-be-returned environment.
        let e = emptyEnv(w);

        // append functions in stdcalltable
        if (blockInfo) {
            // Enums are not enclosed in namespaces, so add them to the taken names
            // to avoid collision
            Object.keys(blockInfo.apis.byQName).forEach(name => {
                const info = blockInfo.apis.byQName[name];
                if (info.kind === pxtc.SymbolKind.Enum) {
                    e.renames.takenNames[info.qName] = true;
                }
            });

            blockInfo.blocks
                .forEach(fn => {
                    if (e.stdCallTable[fn.attributes.blockId]) {
                        pxt.reportError("blocks", "function already defined", { "details": fn.attributes.blockId });
                        return;
                    }
                    e.renames.takenNames[fn.namespace] = true;
                    let fieldMap = pxt.blocks.parameterNames(fn);
                    let instance = fn.kind == pxtc.SymbolKind.Method || fn.kind == pxtc.SymbolKind.Property;
                    let args = (fn.parameters || []).map(p => {
                        if (fieldMap[p.name] && fieldMap[p.name].name) return { field: fieldMap[p.name].name };
                        else return null;
                    }).filter(a => !!a);

                    if (instance && !fn.attributes.defaultInstance) {
                        args.unshift({
                            field: fieldMap["this"].name
                        });
                    }

                    e.stdCallTable[fn.attributes.blockId] = {
                        namespace: fn.namespace,
                        f: fn.name,
                        args: args,
                        attrs: fn.attributes,
                        isExtensionMethod: instance,
                        isExpression: fn.retType && fn.retType !== "void",
                        imageLiteral: fn.attributes.imageLiteral,
                        hasHandler: fn.parameters && fn.parameters.some(p => (p.type == "() => void" || !!p.properties)),
                        property: !fn.parameters,
                        isIdentity: fn.attributes.shim == "TD_ID"
                    }
                })
        }

        if (skipVariables) return e;

        const variableIsScoped = (b: B.Block, name: string): boolean => {
            if (!b)
                return false;
            else if ((b.type == "controls_for" || b.type == "controls_simple_for" || b.type == "controls_for_of")
                && escapeVarName(b.getFieldValue("VAR"), e) == name)
                return true;
            else if (isMutatingBlock(b) && b.mutation.isDeclaredByMutation(name))
                return true;
            else
                return variableIsScoped(b.getSurroundParent(), name);
        };

        function trackLocalDeclaration(name: string, type: string) {
            // It's ok for two loops to share the same variable.
            if (lookup(e, name) == null)
                e = extend(e, name, type);
            lookup(e, name).declaredInLocalScope++;
            // If multiple loops share the same
            // variable, that means there's potential race conditions in concurrent
            // code, so faithfully compile this as a global variable.
            if (lookup(e, name).declaredInLocalScope > 1)
                lookup(e, name).mustBeGlobal = true;
        }

        // collect local variables.
        if (w) w.getAllBlocks().filter(b => !b.disabled).forEach(b => {
            if (b.type == "controls_for" || b.type == "controls_simple_for" || b.type == "controls_for_of") {
                let x = escapeVarName(b.getFieldValue("VAR"), e);
                if (b.type == "controls_for_of") {
                    trackLocalDeclaration(x, null);
                }
                else {
                    trackLocalDeclaration(x, pNumber.type);
                }
            }
            else if (isMutatingBlock(b)) {
                const declarations = b.mutation.getDeclaredVariables();
                if (declarations) {
                    for (const varName in declarations) {
                        trackLocalDeclaration(escapeVarName(varName, e), declarations[varName]);
                    }
                }
            }
        });

        // determine for-loop compatibility: for each get or
        // set block, 1) make sure that the variable is bound, then 2) mark the variable if needed.
        if (w) w.getAllBlocks().filter(b => !b.disabled).forEach(b => {
            if (b.type == "variables_get" || b.type == "variables_set" || b.type == "variables_change") {
                let x = escapeVarName(b.getFieldValue("VAR"), e);
                if (lookup(e, x) == null)
                    e = extend(e, x, null);

                let binding = lookup(e, x);
                if (binding.declaredInLocalScope && !variableIsScoped(b, x))
                    // loop index is read outside the loop.
                    binding.mustBeGlobal = true;
            }
        });

        return e;
    }

    export function compileBlockAsync(b: B.Block, blockInfo: pxtc.BlocksInfo): Promise<BlockCompilationResult> {
        const w = b.workspace;
        const e = mkEnv(w, blockInfo);
        infer(e, w);
        const compiled = compileStatementBlock(e, b)
        removeAllPlaceholders();
        return tdASTtoTS(e, compiled);
    }

    function compileWorkspace(e: Environment, w: B.Workspace, blockInfo: pxtc.BlocksInfo): JsNode[] {
        try {
            infer(e, w);

            const stmtsMain: JsNode[] = [];

            // all compiled top level blocks are event, move on start to bottom
            const topblocks = w.getTopBlocks(true).sort((a, b) => {
                return (a.type == ts.pxtc.ON_START_TYPE ? 1 : 0) - (b.type == ts.pxtc.ON_START_TYPE ? 1 : 0);
            });

            updateDisabledBlocks(e, w.getAllBlocks(), topblocks);

            topblocks.forEach(b => {
                if (b.type == ts.pxtc.ON_START_TYPE)
                    append(stmtsMain, compileStartEvent(e, b).children);
                else {
                    const compiled = compileStatements(e, b)
                    if (compiled.type == NT.Block)
                        append(stmtsMain, compiled.children);
                    else stmtsMain.push(compiled)
                }
            });

            // All variables in this script are compiled as locals within main unless loop or previsouly assigned
            const stmtsVariables = e.bindings.filter(b => !isCompiledAsLocalVariable(b) && b.assigned != VarUsage.Assign)
                .map(b => {
                    const t = getConcreteType(b.type);
                    let defl: JsNode;

                    if (t.type === "Array") {
                        defl = mkText("[]");
                    }
                    else {
                        defl = defaultValueForType(t);
                    }

                    let tp = ""
                    if (defl.op == "null" || defl.op == "[]") {
                        let tpname = t.type
                        // If the type is "Array" or null[] it means that we failed to narrow the type of array.
                        // Best we can do is just default to number[]
                        if (tpname === "Array" || tpname === "null[]") {
                            tpname = "number[]";
                        }
                        let tpinfo = blockInfo.apis.byQName[tpname]
                        if (tpinfo && tpinfo.attributes.autoCreate)
                            defl = mkText(tpinfo.attributes.autoCreate + "()")
                        else
                            tp = ": " + tpname
                    }
                    return mkStmt(mkText("let " + b.name + tp + " = "), defl)
                });

            return stmtsVariables.concat(stmtsMain)
        } catch (err) {
            let be: B.Block = (err as any).block;
            if (be) {
                be.setWarningText(err + "");
                e.errors.push(be);
            }
            else {
                throw err;
            }
        } finally {
            removeAllPlaceholders();
        }

        return [] // unreachable
    }

    export function callKey(e: Environment, b: B.Block): string {
        if (b.type == ts.pxtc.ON_START_TYPE)
            return JSON.stringify({ name: ts.pxtc.ON_START_TYPE });

        const call = e.stdCallTable[b.type];
        if (call) {
            // detect if same event is registered already
            const compiledArgs = eventArgs(call).map(arg => compileArg(e, b, arg, []));
            const key = JSON.stringify({ name: call.f, ns: call.namespace, compiledArgs })
                .replace(/"id"\s*:\s*"[^"]+"/g, ''); // remove blockly ids
            return key;
        }

        return undefined;
    }

    function updateDisabledBlocks(e: Environment, allBlocks: B.Block[], topBlocks: B.Block[]) {
        // unset disabled
        allBlocks.forEach(b => b.setDisabled(false));

        // update top blocks
        const events: Map<B.Block> = {};

        function flagDuplicate(key: string, block: B.Block) {
            const otherEvent = events[key];
            if (otherEvent) {
                // another block is already registered
                block.setDisabled(true);
            } else {
                block.setDisabled(false);
                events[key] = block;
            }
        }

        topBlocks.forEach(b => {
            const call = e.stdCallTable[b.type];
            // multiple calls allowed
            if (b.type == ts.pxtc.ON_START_TYPE)
                flagDuplicate(ts.pxtc.ON_START_TYPE, b);
            else if (b.type === "procedures_defnoreturn" || call && call.attrs.blockAllowMultiple && !call.attrs.handlerStatement) return;
            // is this an event?
            else if (call && call.hasHandler && !call.attrs.handlerStatement) {
                // compute key that identifies event call
                // detect if same event is registered already
                const key = callKey(e, b);
                flagDuplicate(key, b);
            } else {
                // all non-events are disabled
                let t = b;
                while (t) {
                    t.setDisabled(true);
                    t = t.getNextBlock();
                }
            }
        });
    }

    export interface BlockCompilationResult {
        source: string;
        sourceMap: SourceInterval[];
        stats: pxt.Map<number>;
    }

    export function findBlockId(sourceMap: SourceInterval[], loc: { start: number; length: number; }): string {
        if (!loc) return undefined;
        let bestChunk: SourceInterval;
        let bestChunkLength: number;
        for (let i = 0; i < sourceMap.length; ++i) {
            let chunk = sourceMap[i];
            if (chunk.start <= loc.start && chunk.end > loc.start + loc.length && (!bestChunk || bestChunkLength > chunk.end - chunk.start)) {
                bestChunk = chunk;
                bestChunkLength = chunk.end - chunk.start;
            }
        }
        if (bestChunk) {
            return bestChunk.id;
        }
        return undefined;
    }

    export function compileAsync(b: B.Workspace, blockInfo: pxtc.BlocksInfo): Promise<BlockCompilationResult> {
        const e = mkEnv(b, blockInfo);
        const nodes = compileWorkspace(e, b, blockInfo);
        const result = tdASTtoTS(e, nodes);
        return result;
    }

    function tdASTtoTS(env: Environment, app: JsNode[]): Promise<BlockCompilationResult> {
        let res = flattenNode(app)

        // Note: the result of format is not used!

        return workerOpAsync("format", { format: { input: res.output, pos: 1 } }).then(() => {
            return {
                source: res.output,
                sourceMap: res.sourceMap,
                stats: env.stats
            };
        })

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

    function addCommentNodes(comments: string[], r: JsNode[]) {
        const commentNodes: JsNode[] = []
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

    function endsWith(text: string, suffix: string) {
        if (text.length < suffix.length) {
            return false;
        }
        return text.substr(text.length - suffix.length) === suffix;
    }
}