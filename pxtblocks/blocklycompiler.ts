///<reference path='../localtypings/pxtblockly.d.ts'/>
/// <reference path="../built/pxtlib.d.ts" />

let iface: pxt.worker.Iface

namespace pxt.blocks {
    export function workerOpAsync(op: string, arg: pxtc.service.OpArg) {
        return pxt.worker.getWorker(pxt.webConfig.workerjs).opAsync(op, arg)
    }

    let placeholders: Map<Map<any>> = {};
    const MAX_COMMENT_LINE_LENGTH = 50;


    interface CommentMap {
        orphans: Blockly.WorkspaceComment[];
        idToComments: Map<Blockly.WorkspaceComment[]>;
    }

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

    function throwBlockError(msg: string, block: Blockly.Block) {
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

    export interface Scope {
        parent?: Scope;
        firstStatement: Blockly.Block;
        declaredVars: Map<VarInfo>;
        referencedVars: number[];
        assignedVars: number[];
        children: Scope[];
    }

    export interface VarInfo {
        name: string;
        id: number;

        escapedName?: string;
        type?: Point;
        alreadyDeclared?: boolean;
        firstReference?: Blockly.Block;
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
    function returnType(e: Environment, b: Blockly.Block): Point {
        assert(b != null);

        if (b.type == "placeholder" || b.type === pxtc.TS_OUTPUT_TYPE)
            return find((<any>b).p);

        if (b.type == "variables_get")
            return find(lookup(e, b, b.getField("VAR").getText()).type);

        if (!b.outputConnection) {
            return ground(pUnit.type);
        }

        const check = b.outputConnection.check_ && b.outputConnection.check_.length ? b.outputConnection.check_[0] : "T";

        if (check === "Array") {
            if (b.outputConnection.check_.length > 1) {
                // HACK: The real type is stored as the second check
                return ground(b.outputConnection.check_[1])
            }
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
            if (isArrayGet || func && func.comp.thisParameter) {
                let parentInput: Blockly.Input;

                if (isArrayGet) {
                    parentInput = b.inputList.filter(i => i.name === "LIST")[0];
                }
                else {
                    parentInput = b.inputList.filter(i => i.name === func.comp.thisParameter.definitionName)[0];
                }

                if (parentInput.connection && parentInput.connection.targetBlock()) {
                    const parentType = returnType(e, parentInput.connection.targetBlock());
                    if (parentType.childType) {
                        return parentType.childType;
                    }
                    const p = isArrayType(parentType.type) ? mkPoint(parentType.type.substr(0, parentType.type.length - 2)) : mkPoint(null);
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

    function mkPlaceholderBlock(e: Environment, parent: Blockly.Block, type?: string): Blockly.Block {
        // XXX define a proper placeholder block type
        return <any>{
            type: "placeholder",
            p: mkPoint(type || null),
            workspace: e.workspace,
            parentBlock_: parent
        };
    }

    function attachPlaceholderIf(e: Environment, b: Blockly.Block, n: string, type?: string) {
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

    function getLoopVariableField(b: Blockly.Block) {
        return (b.type == "pxt_controls_for" || b.type == "pxt_controls_for_of") ?
            getInputTargetBlock(b, "VAR") : b;
    }

    function getInputTargetBlock(b: Blockly.Block, n: string) {
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
    function unionParam(e: Environment, b: Blockly.Block, n: string, p: Point) {
        attachPlaceholderIf(e, b, n);
        try {
            union(returnType(e, getInputTargetBlock(b, n)), p);
        } catch (e) {
            // TypeScript should catch this error and bubble it up
        }
    }

    function infer(e: Environment, w: Blockly.Workspace) {
        if (w) w.getAllBlocks().filter(b => !b.disabled).forEach((b: Blockly.Block) => {
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
                                    // TypeScript should catch this error and bubble it up
                                }
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
                        for (let i = 0; i <= (<Blockly.IfBlock>b).elseifCount_; ++i)
                            attachPlaceholderIf(e, b, "IF" + i, pBoolean.type);
                        break;

                    case "pxt_controls_for":
                    case "controls_simple_for":
                        unionParam(e, b, "TO", ground(pNumber.type));
                        break;
                    case "pxt_controls_for_of":
                    case "controls_for_of":
                        unionParam(e, b, "LIST", ground("Array"));
                        const listTp = returnType(e, getInputTargetBlock(b, "LIST"));
                        const elementTp = lookup(e, b, getLoopVariableField(b).getField("VAR").getText()).type;
                        genericLink(listTp, elementTp);
                        break;
                    case "variables_set":
                    case "variables_change":
                        let p1 = lookup(e, b, b.getField("VAR").getText()).type;
                        attachPlaceholderIf(e, b, "VALUE");
                        let rhs = getInputTargetBlock(b, "VALUE");
                        if (rhs) {
                            let tr = returnType(e, rhs);
                            try {
                                union(p1, tr);
                            } catch (e) {
                                // TypeScript should catch this error and bubble it up
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
                    case 'function_call':
                        (b as Blockly.FunctionCallBlock).getArguments().forEach(arg => {
                            unionParam(e, b, arg.id, ground(arg.type));
                        });
                        break;
                    case pxtc.PAUSE_UNTIL_TYPE:
                        unionParam(e, b, "PREDICATE", pBoolean);
                        break;
                    default:
                        if (b.type in e.stdCallTable) {
                            const call = e.stdCallTable[b.type];
                            if (call.attrs.shim === "ENUM_GET") return;
                            visibleParams(call, countOptionals(b)).forEach((p, i) => {
                                const isInstance = call.isExtensionMethod && i === 0;
                                if (p.definitionName && !b.getFieldValue(p.definitionName)) {
                                    let i = b.inputList.filter((i: Blockly.Input) => i.name == p.definitionName)[0];
                                    if (i.connection && i.connection.check_) {
                                        if (isInstance && connectionCheck(i) === "Array") {
                                            let gen = handleGenericType(b, p.definitionName);
                                            if (gen) {
                                                return;
                                            }
                                        }

                                        // All of our injected blocks have single output checks, but the builtin
                                        // blockly ones like string.length and array.length might have multiple
                                        for (let j = 0; j < i.connection.check_.length; j++) {
                                            try {
                                                let t = i.connection.check_[j];
                                                unionParam(e, b, p.definitionName, ground(t));
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
                const be = ((<any>err).block as Blockly.Block) || b;
                be.setWarningText(err + "");
                e.errors.push(be);
            }
        });

        // Last pass: if some variable has no type (because it was never used or
        // assigned to), just unify it with int...
        e.allVariables.forEach((v: VarInfo) => {
            if (getConcreteType(v.type).type == null)
                union(v.type, ground(pNumber.type));
        });

        function connectionCheck(i: Blockly.Input) {
            return i.name ? i.connection && i.connection.check_ && i.connection.check_.length ? i.connection.check_[0] : "T" : undefined;
        }

        function handleGenericType(b: Blockly.Block, name: string) {
            let genericArgs = b.inputList.filter((input: Blockly.Input) => connectionCheck(input) === "T");
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
        else if (!p.type) {
            p.childType = c;
        }

        if (c.parentType) {
            union(c.parentType, p);
        }
        else if (!c.type) {
            c.parentType = p;
        }
    }

    function getConcreteType(point: Point, found: Point[] = []) {
        const t = find(point)
        if (found.indexOf(t) === -1) {
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

    function extractNumber(b: Blockly.Block): number {
        let v = b.getFieldValue(b.type === "math_number_minmax" ? "SLIDER" : "NUM");
        const parsed = parseFloat(v);
        checkNumber(parsed, b);
        return parsed;
    }

    function checkNumber(n: number, b: Blockly.Block) {
        if (!isFinite(n) || isNaN(n)) {
            throwBlockError(lf("Number entered is either too large or too small"), b);
        }
    }

    function extractTsExpression(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        return mkText(b.getFieldValue("EXPRESSION").trim());
    }

    function compileNumber(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
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
        "POWER": "**"
    };

    function compileArithmetic(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
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
        assert(bOp in opToTok);
        return H.mkSimpleCall(opToTok[bOp], args);
    }

    function compileModulo(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        let left = getInputTargetBlock(b, "DIVIDEND");
        let right = getInputTargetBlock(b, "DIVISOR");
        let args = [compileExpression(e, left, comments), compileExpression(e, right, comments)];
        return H.mkSimpleCall("%", args);
    }

    function compileMathOp2(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        let op = b.getFieldValue("op");
        let x = compileExpression(e, getInputTargetBlock(b, "x"), comments);
        let y = compileExpression(e, getInputTargetBlock(b, "y"), comments);
        return H.mathCall(op, [x, y])
    }

    function compileMathOp3(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        let x = compileExpression(e, getInputTargetBlock(b, "x"), comments);
        return H.mathCall("abs", [x]);
    }

    function compileText(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        return H.mkStringLiteral(b.getFieldValue("TEXT"));
    }

    function compileTextJoin(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
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

    function compileBoolean(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        return H.mkBooleanLiteral(b.getFieldValue("BOOL") == "TRUE");
    }

    function compileNot(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        let expr = compileExpression(e, getInputTargetBlock(b, "BOOL"), comments);
        return mkPrefix("!", [H.mkParenthesizedExpression(expr)]);
    }

    function compileCreateList(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        // collect argument
        let args = b.inputList.map(input => input.connection && input.connection.targetBlock() ? compileExpression(e, input.connection.targetBlock(), comments) : undefined)
            .filter(e => !!e);

        return H.mkArrayLiteral(args);
    }

    function compileListGet(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        const listBlock = getInputTargetBlock(b, "LIST");
        const listExpr = compileExpression(e, listBlock, comments);
        const index = compileExpression(e, getInputTargetBlock(b, "INDEX"), comments);
        const res = mkGroup([listExpr, mkText("["), index, mkText("]")]);

        return res;
    }

    function compileListSet(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        const listBlock = getInputTargetBlock(b, "LIST");
        const listExpr = compileExpression(e, listBlock, comments);
        const index = compileExpression(e, getInputTargetBlock(b, "INDEX"), comments);
        const value = compileExpression(e, getInputTargetBlock(b, "VALUE"), comments);
        const res = mkGroup([listExpr, mkText("["), index, mkText("] = "), value]);

        return listBlock.type === "lists_create_with" ? prefixWithSemicolon(res) : res;

    }

    function compileMathJsOp(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        const op = b.getFieldValue("OP");
        const args = [compileExpression(e, getInputTargetBlock(b, "ARG0"), comments)];

        if ((b as any).getInput("ARG1")) {
            args.push(compileExpression(e, getInputTargetBlock(b, "ARG1"), comments));
        }

        return H.mathCall(op, args);
    }

    function compileFunctionDefinition(e: Environment, b: Blockly.Block, comments: string[]): JsNode[] {
        const name = escapeVarName(b.getFieldValue("function_name"), e, true);
        const stmts = getInputTargetBlock(b, "STACK");
        const argsDeclaration = (b as Blockly.FunctionDefinitionBlock).getArguments().map(a => {
            return `${escapeVarName(a.name, e)}: ${a.type}`;
        });
        return [
            mkText(`function ${name} (${argsDeclaration.join(", ")})`),
            compileStatements(e, stmts)
        ];
    }

    function compileProcedure(e: Environment, b: Blockly.Block, comments: string[]): JsNode[] {
        const name = escapeVarName(b.getFieldValue("NAME"), e, true);
        const stmts = getInputTargetBlock(b, "STACK");
        return [
            mkText("function " + name + "() "),
            compileStatements(e, stmts)
        ];
    }

    function compileProcedureCall(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        const name = escapeVarName(b.getFieldValue("NAME"), e, true);
        return mkStmt(mkText(name + "()"));
    }

    function compileFunctionCall(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        const name = escapeVarName(b.getFieldValue("function_name"), e, true);
        const externalInputs = !b.getInputsInline();
        const args: BlockParameter[] = (b as Blockly.FunctionCallBlock).getArguments().map(a => {
            return {
                actualName: a.name,
                definitionName: a .id
            };
        });

        const compiledArgs = args.map(a => compileArgument(e, b, a, comments));
        return mkStmt(H.stdCall(name, compiledArgs, externalInputs));
    }

    function compileArgumentReporter(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        const name = escapeVarName(b.getFieldValue("VALUE"), e);
        return mkText(name);
    }

    function compileWorkspaceComment(c: Blockly.WorkspaceComment): JsNode {
        const content = c.getContent();
        return Helpers.mkMultiComment(content.trim());
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
    export function compileExpression(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
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
            case "math_integer":
            case "math_whole_number":
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
            case "math_js_op":
            case "math_js_round":
                expr = compileMathJsOp(e, b, comments); break;
            case pxtc.TS_OUTPUT_TYPE:
                expr = extractTsExpression(e, b, comments); break;
            case "argument_reporter_boolean":
            case "argument_reporter_number":
            case "argument_reporter_string":
            case "argument_reporter_custom":
                expr = compileArgumentReporter(e, b, comments); break;
            default:
                let call = e.stdCallTable[b.type];
                if (call) {
                    if (call.imageLiteral)
                        expr = compileImage(e, b, call.imageLiteral, call.namespace, call.f,
                            visibleParams(call, countOptionals(b)).map(ar => compileArgument(e, b, ar, comments)))
                    else
                        expr = compileStdCall(e, b, call, comments);
                }
                else {
                    pxt.reportError("blocks", "unable to compile expression", { "details": b.type });
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
        stdCallTable: pxt.Map<StdFunc>;
        errors: Blockly.Block[];
        renames: RenameMap;
        stats: pxt.Map<number>;
        enums: pxtc.EnumInfo[];
        idToScope: pxt.Map<Scope>;
        blockDeclarations: pxt.Map<VarInfo[]>;
        blocksInfo: pxtc.BlocksInfo;
        allVariables: VarInfo[];
    }

    export interface RenameMap {
        oldToNew: Map<string>;
        takenNames: Map<boolean>;
        oldToNewFunctions: Map<string>;
    }

    function lookup(e: Environment, b: Blockly.Block, name: string): VarInfo {
        return getVarInfo(name, e.idToScope[b.id]);
    }

    function emptyEnv(w: Blockly.Workspace): Environment {
        return {
            workspace: w,
            stdCallTable: {},
            errors: [],
            renames: {
                oldToNew: {},
                takenNames: {},
                oldToNewFunctions: {}
            },
            stats: {},
            enums: [],
            idToScope: {},
            blockDeclarations: {},
            allVariables: [],
            blocksInfo: null
        }
    };

    ///////////////////////////////////////////////////////////////////////////////
    // Statements
    ///////////////////////////////////////////////////////////////////////////////

    function compileControlsIf(e: Environment, b: Blockly.IfBlock, comments: string[]): JsNode[] {
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

    function compileControlsFor(e: Environment, b: Blockly.Block, comments: string[]): JsNode[] {
        let bTo = getInputTargetBlock(b, "TO");
        let bDo = getInputTargetBlock(b, "DO");
        let bBy = getInputTargetBlock(b, "BY");
        let bFrom = getInputTargetBlock(b, "FROM");
        let incOne = !bBy || (bBy.type.match(/^math_number/) && extractNumber(bBy) == 1)

        let binding = lookup(e, b, getLoopVariableField(b).getField("VAR").getText());

        return [
            mkText("for (let " + binding.escapedName + " = "),
            bFrom ? compileExpression(e, bFrom, comments) : mkText("0"),
            mkText("; "),
            mkInfix(mkText(binding.escapedName), "<=", compileExpression(e, bTo, comments)),
            mkText("; "),
            incOne ? mkText(binding.escapedName + "++") : mkInfix(mkText(binding.escapedName), "+=", compileExpression(e, bBy, comments)),
            mkText(")"),
            compileStatements(e, bDo)
        ]
    }

    function compileControlsRepeat(e: Environment, b: Blockly.Block, comments: string[]): JsNode[] {
        let bound = compileExpression(e, getInputTargetBlock(b, "TIMES"), comments);
        let body = compileStatements(e, getInputTargetBlock(b, "DO"));
        let valid = (x: string) => !e.renames.takenNames[x]
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

    function compileWhile(e: Environment, b: Blockly.Block, comments: string[]): JsNode[] {
        let cond = compileExpression(e, getInputTargetBlock(b, "COND"), comments);
        let body = compileStatements(e, getInputTargetBlock(b, "DO"));
        return [
            mkText("while ("),
            cond,
            mkText(")"),
            body
        ]
    }

    function compileControlsForOf(e: Environment, b: Blockly.Block, comments: string[]) {
        let bOf = getInputTargetBlock(b, "LIST");
        let bDo = getInputTargetBlock(b, "DO");

        let binding = lookup(e, b, getLoopVariableField(b).getField("VAR").getText());

        return [
            mkText("for (let " + binding.escapedName + " of "),
            compileExpression(e, bOf, comments),
            mkText(")"),
            compileStatements(e, bDo)
        ]
    }

    function compileForever(e: Environment, b: Blockly.Block): JsNode {
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
            e.renames.takenNames[n] = true;
        }
        else {
            e.renames.oldToNew[name] = n;
        }
        return n;
    }

    function compileVariableGet(e: Environment, b: Blockly.Block): JsNode {
        let binding = lookup(e, b, b.getField("VAR").getText());
        if (!binding.firstReference) binding.firstReference = b;

        assert(binding != null && binding.type != null);
        return mkText(binding.escapedName);
    }

    function compileSet(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        let bExpr = getInputTargetBlock(b, "VALUE");
        let binding = lookup(e, b, b.getField("VAR").getText());

        const currentScope = e.idToScope[b.id];
        let isDef = currentScope.declaredVars[binding.name] === binding && !binding.firstReference && !binding.alreadyDeclared;

        if (isDef) {
            // Check the expression of the set block to determine if it references itself and needs
            // to be hoisted
            forEachChildExpression(b, child => {
                if (child.type === "variables_get") {
                    let childBinding = lookup(e, child, child.getField("VAR").getText());
                    if (childBinding === binding) isDef = false;
                }
            }, true);
        }

        let expr = compileExpression(e, bExpr, comments);

        let bindString = binding.escapedName + " = ";

        if (isDef) {
            binding.alreadyDeclared = true;
            const declaredType = getConcreteType(binding.type);

            bindString = `let ${binding.escapedName} = `;

            if (declaredType) {
                const expressionType = getConcreteType(returnType(e, bExpr));
                if (declaredType.type !== expressionType.type) {
                    bindString = `let ${binding.escapedName}: ${declaredType.type} = `;
                }
            }
        }
        else if (!binding.firstReference) {
            binding.firstReference = b;
        }

        return mkStmt(
            mkText(bindString),
            expr)
    }

    function compileChange(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        let bExpr = getInputTargetBlock(b, "VALUE");
        let binding = lookup(e, b, b.getField("VAR").getText());
        let expr = compileExpression(e, bExpr, comments);
        let ref = mkText(binding.escapedName);
        return mkStmt(mkInfix(ref, "+=", expr))
    }

    function eventArgs(call: StdFunc, b: Blockly.Block): string[] {
        return visibleParams(call, countOptionals(b)).map(ar => ar.definitionName).filter(ar => !!ar);
    }

    function compileCall(e: Environment, b: Blockly.Block, comments: string[]): JsNode {
        const call = e.stdCallTable[b.type];
        if (call.imageLiteral)
            return mkStmt(compileImage(e, b, call.imageLiteral, call.namespace, call.f, visibleParams(call, countOptionals(b)).map(ar => compileArgument(e, b, ar, comments))))
        else if (call.hasHandler)
            return compileEvent(e, b, call, eventArgs(call, b), call.namespace, comments)
        else
            return mkStmt(compileStdCall(e, b, call, comments))
    }

    function compileArgument(e: Environment, b: Blockly.Block, p: BlockParameter, comments: string[], beginningOfStatement = false): JsNode {
        let f = b.getFieldValue(p.definitionName);
        if (f != null) {
            if (b.getField(p.definitionName) instanceof pxtblockly.FieldTextInput) {
                return H.mkStringLiteral(f);
            }
            return mkText(f);
        }
        else {
            attachPlaceholderIf(e, b, p.definitionName);
            const target = getInputTargetBlock(b, p.definitionName);
            if (beginningOfStatement && target.type === "lists_create_with") {
                // We have to be careful of array literals at the beginning of a statement
                // because they can cause errors (i.e. they get parsed as an index). Add a
                // semicolon to the previous statement just in case.
                // FIXME: No need to do this if the previous statement was a code block
                return prefixWithSemicolon(compileExpression(e, target, comments));
            }

            if (p.shadowOptions && p.shadowOptions.toString && returnType(e, target) !== pString) {
                return H.mkSimpleCall("+", [H.mkStringLiteral(""), compileExpression(e, target, comments)]);
            }

            return compileExpression(e, target, comments)
        }
    }

    function compileStdCall(e: Environment, b: Blockly.Block, func: StdFunc, comments: string[]): JsNode {
        let args: JsNode[]
        if (isMutatingBlock(b) && b.mutation.getMutationType() === MutatorTypes.RestParameterMutator) {
            args = b.mutation.compileMutation(e, comments).children;
        }
        else if (func.attrs.shim === "ENUM_GET") {
            const enumName = func.attrs.enumName;
            const enumMember = b.getFieldValue("MEMBER").replace(/^\d+/, "");
            return H.mkPropertyAccess(enumMember, mkText(enumName));
        }
        else {
            args = visibleParams(func, countOptionals(b)).map((p, i) => compileArgument(e, b, p, comments, func.isExtensionMethod && i === 0 && !func.isExpression));
        }

        const externalInputs = !b.getInputsInline();
        if (func.isIdentity)
            return args[0];
        else if (func.property) {
            return H.mkPropertyAccess(func.f, args[0]);
        } else if (func.f == "@get@") {
            return H.mkPropertyAccess(args[1].op.replace(/.*\./, ""), args[0]);
        } else if (func.f == "@set@") {
            return H.mkAssign(H.mkPropertyAccess(args[1].op.replace(/.*\./, "").replace(/@set/, ""), args[0]), args[2]);
        } else if (func.f == "@change@") {
            return H.mkSimpleCall("+=", [H.mkPropertyAccess(args[1].op.replace(/.*\./, "").replace(/@set/, ""), args[0]), args[2]])
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

    function compileStdBlock(e: Environment, b: Blockly.Block, f: StdFunc, comments: string[]) {
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
        else if (n)
            return mkStmt(H.namespaceCall(n, f, args.concat([callback]), false));
        else
            return mkStmt(H.mkCall(f, args.concat([callback]), false));
    }

    function compileArg(e: Environment, b: Blockly.Block, arg: string, comments: string[]): JsNode {
        // b.getFieldValue may be string, numbers
        const argb = getInputTargetBlock(b, arg);
        if (argb) return compileExpression(e, argb, comments);
        if (b.getField(arg) instanceof pxtblockly.FieldTextInput) return H.mkStringLiteral(b.getFieldValue(arg));
        return mkText(b.getFieldValue(arg))
    }

    function compileStartEvent(e: Environment, b: Blockly.Block): JsNode {
        const bBody = getInputTargetBlock(b, "HANDLER");
        const body = compileStatements(e, bBody);

        if (pxt.appTarget.compile && pxt.appTarget.compile.onStartText && body && body.children) {
            body.children.unshift(mkStmt(mkText(`// ${pxtc.ON_START_COMMENT}\n`)))
        }

        return body;
    }

    function compileEvent(e: Environment, b: Blockly.Block, stdfun: StdFunc, args: string[], ns: string, comments: string[]): JsNode {
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
        else if (stdfun.comp.handlerArgs.length) {
            let handlerArgs = getEscapedCBParameters(b, stdfun, e);
            argumentDeclaration = mkText(`function (${handlerArgs.join(", ")})`)
        }

        return mkCallWithCallback(e, ns, stdfun.f, compiledArgs, body, argumentDeclaration, stdfun.isExtensionMethod);
    }

    function isMutatingBlock(b: Blockly.Block): b is MutatingBlock {
        return !!(b as MutatingBlock).mutation;
    }

    function compileImage(e: Environment, b: Blockly.Block, frames: number, n: string, f: string, args?: JsNode[]): JsNode {
        args = args === undefined ? [] : args;
        let state = "\n";
        let rows = 5;
        let columns = frames * 5;
        let leds = b.getFieldValue("LEDS");
        leds = leds.replace(/[ `\n]+/g, '');
        for (let i = 0; i < rows; ++i) {
            for (let j = 0; j < columns; ++j) {
                if (j > 0)
                    state += ' ';
                state += (leds[(i * columns) + j] === '#') ? "#" : ".";
            }
            state += '\n';
        }
        let lit = H.mkStringLiteral(state)
        lit.canIndentInside = true
        return H.namespaceCall(n, f, [lit].concat(args), false);
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
        comp: BlockCompileInfo;
        attrs: ts.pxtc.CommentAttrs;
        isExtensionMethod?: boolean;
        isExpression?: boolean;
        imageLiteral?: number;
        hasHandler?: boolean;
        property?: boolean;
        namespace?: string;
        isIdentity?: boolean; // TD_ID shim
    }

    function compileStatementBlock(e: Environment, b: Blockly.Block): JsNode[] {
        let r: JsNode[];
        const comments: string[] = [];
        e.stats[b.type] = (e.stats[b.type] || 0) + 1;
        maybeAddComment(b, comments);
        switch (b.type) {
            case 'controls_if':
                r = compileControlsIf(e, <Blockly.IfBlock>b, comments);
                break;
            case 'pxt_controls_for':
            case 'controls_for':
            case 'controls_simple_for':
                r = compileControlsFor(e, b, comments);
                break;
            case 'pxt_controls_for_of':
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
            case 'function_definition':
                r = compileFunctionDefinition(e, b, comments);
                break
            case 'procedures_callnoreturn':
                r = [compileProcedureCall(e, b, comments)];
                break;
            case 'function_call':
                r = [compileFunctionCall(e, b, comments)];
                break;
            case ts.pxtc.ON_START_TYPE:
                r = compileStartEvent(e, b).children;
                break;
            case pxtc.TS_STATEMENT_TYPE:
                r = compileTypescriptBlock(e, b);
                break;
            case pxtc.PAUSE_UNTIL_TYPE:
                r = compilePauseUntilBlock(e, b, comments);
                break;
            case pxtc.TS_DEBUGGER_TYPE:
                r = compileDebuggeStatementBlock(e, b);
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

    function compileStatements(e: Environment, b: Blockly.Block): JsNode {
        let stmts: JsNode[] = [];
        let firstBlock = b;

        while (b) {
            if (!b.disabled) append(stmts, compileStatementBlock(e, b));
            b = b.getNextBlock();
        }

        if (firstBlock && e.blockDeclarations[firstBlock.id]) {
            e.blockDeclarations[firstBlock.id].filter(v => !v.alreadyDeclared).forEach(varInfo => {
                stmts.unshift(mkVariableDeclaration(varInfo, e.blocksInfo));
                varInfo.alreadyDeclared = true;
            });
        }
        return mkBlock(stmts);
    }

    function compileTypescriptBlock(e: Environment, b: Blockly.Block) {
        let res: JsNode[] = [];
        let i = 0;

        while (true) {
            const value = b.getFieldValue("LINE" + i);
            i++;

            if (value !== null) {
                res.push(mkText(value + "\n"));
            }
            else {
                break;
            }
        }

        return res;
    }

    function compileDebuggeStatementBlock(e: Environment, b: Blockly.Block) {
        if (b.getFieldValue("ON_OFF") == "1") {
            return [
                mkText("debugger;\n")
            ]
        }
        return [];
    }

    function prefixWithSemicolon(n: JsNode) {
        const emptyStatement = mkStmt(mkText(";"));
        emptyStatement.glueToBlock = GlueMode.NoSpace;
        return mkGroup([emptyStatement, n]);
    }

    function compilePauseUntilBlock(e: Environment, b: Blockly.Block, comments: string[]): JsNode[] {
        const options = pxt.appTarget.runtime && pxt.appTarget.runtime.pauseUntilBlock;
        Util.assert(!!options, "target has block enabled");

        const ns = options.namespace;
        const name = options.callName || "pauseUntil";
        const arg = compileArg(e, b, "PREDICATE", comments);
        const lambda = [mkGroup([mkText("() => "), arg])];

        if (ns) {
            return [mkStmt(H.namespaceCall(ns, name, lambda, false))];
        }
        else {
            return [mkStmt(H.mkCall(name, lambda, false, false))];
        }
    }

    // This function creates an empty environment where type inference has NOT yet
    // been performed.
    // - All variables have been assigned an initial [Point] in the union-find.
    // - Variables have been marked to indicate if they are compatible with the
    //   TouchDevelop for-loop model.
    export function mkEnv(w: Blockly.Workspace, blockInfo?: pxtc.BlocksInfo): Environment {
        // The to-be-returned environment.
        let e = emptyEnv(w);
        e.blocksInfo = blockInfo;

        // append functions in stdcalltable
        if (blockInfo) {
            // Enums, tagged templates, and namespaces are not enclosed in namespaces,
            // so add them to the taken names to avoid collision
            Object.keys(blockInfo.apis.byQName).forEach(name => {
                const info = blockInfo.apis.byQName[name];
                // Note: the check for info.pkg filters out functions defined in the user's project.
                // Otherwise, after the first compile the function will be renamed because it conflicts
                // with itself. You can still get collisions if you attempt to define a function with
                // the same name as a function defined in another file in the user's project (e.g. custom.ts)
                if (info.pkg && (info.kind === pxtc.SymbolKind.Enum || info.kind === pxtc.SymbolKind.Function || info.kind === pxtc.SymbolKind.Module)) {
                    e.renames.takenNames[info.qName] = true;
                }
            });

            if (blockInfo.enumsByName) {
                Object.keys(blockInfo.enumsByName).forEach(k => e.enums.push(blockInfo.enumsByName[k]));
            }

            blockInfo.blocks
                .forEach(fn => {
                    if (e.stdCallTable[fn.attributes.blockId]) {
                        pxt.reportError("blocks", "function already defined", { "details": fn.attributes.blockId });
                        return;
                    }
                    e.renames.takenNames[fn.namespace] = true;
                    const comp = pxt.blocks.compileInfo(fn);
                    const instance = !!comp.thisParameter;

                    e.stdCallTable[fn.attributes.blockId] = {
                        namespace: fn.namespace,
                        f: fn.name,
                        comp,
                        attrs: fn.attributes,
                        isExtensionMethod: instance,
                        isExpression: fn.retType && fn.retType !== "void",
                        imageLiteral: fn.attributes.imageLiteral,
                        hasHandler: !!comp.handlerArgs.length || fn.parameters && fn.parameters.some(p => (p.type == "() => void" || p.type == "Action" || !!p.properties)),
                        property: !fn.parameters,
                        isIdentity: fn.attributes.shim == "TD_ID"
                    }
                });

            w.getTopBlocks(false).filter(isFunctionDefinition).forEach(b => {
                // Add functions to the rename map to prevent name collisions with variables
                const name = b.type === "procedures_defnoreturn" ? b.getFieldValue("NAME") : b.getFieldValue("function_name");
                escapeVarName(name, e, true);
            });
        }

        return e;
    }

    export function compileBlockAsync(b: Blockly.Block, blockInfo: pxtc.BlocksInfo): Promise<BlockCompilationResult> {
        const w = b.workspace;
        const e = mkEnv(w, blockInfo);
        infer(e, w);
        const compiled = compileStatementBlock(e, b)
        removeAllPlaceholders();
        return tdASTtoTS(e, compiled);
    }

    function eventWeight(b: Blockly.Block, e: Environment) {
        if (b.type === ts.pxtc.ON_START_TYPE) {
            return 0;
        }
        const api = e.stdCallTable[b.type];
        if (api && api.attrs.afterOnStart) {
            return 1;
        }
        else {
            return -1;
        }
    }

    function compileWorkspace(e: Environment, w: Blockly.Workspace, blockInfo: pxtc.BlocksInfo): JsNode[] {
        try {
            // all compiled top level blocks are events
            const topblocks = w.getTopBlocks(true).sort((a, b) => {
                return eventWeight(a, e) - eventWeight(b, e)
            });

            updateDisabledBlocks(e, w.getAllBlocks(), topblocks);

            trackAllVariables(topblocks, e);

            infer(e, w);

            const stmtsMain: JsNode[] = [];

            // compile workspace comments, add them to the top
            const topComments = w.getTopComments(true);
            const commentMap = groupWorkspaceComments(topblocks as Blockly.BlockSvg[],
                topComments as Blockly.WorkspaceCommentSvg[]);

            commentMap.orphans.forEach(comment => append(stmtsMain, compileWorkspaceComment(comment).children));

            topblocks.filter(b => !b.disabled).forEach(b => {
                if (commentMap.idToComments[b.id]) {
                    commentMap.idToComments[b.id].forEach(comment => {
                        append(stmtsMain, compileWorkspaceComment(comment).children);
                    });
                }
                if (b.type == ts.pxtc.ON_START_TYPE)
                    append(stmtsMain, compileStartEvent(e, b).children);
                else {
                    const compiled = mkBlock(compileStatementBlock(e, b));
                    if (compiled.type == NT.Block)
                        append(stmtsMain, compiled.children);
                    else stmtsMain.push(compiled)
                }
            });

            const stmtsEnums: JsNode[] = [];
            e.enums.forEach(info => {
                const models = w.getVariablesOfType(info.name);
                if (models && models.length) {
                    const members: [string, number][] = models.map(m => {
                        const match = /^(\d+)([^0-9].*)$/.exec(m.name);
                        if (match) {
                            return [match[2], parseInt(match[1])] as [string, number];
                        }
                        else {
                            // Someone has been messing with the XML...
                            return [m.name, -1] as [string, number];
                        }
                    });

                    members.sort((a, b) => a[1] - b[1]);

                    const nodes: JsNode[] = [];
                    let lastValue = -1;
                    members.forEach(([name, value], index) => {
                        let newNode: JsNode;
                        if (info.isBitMask) {
                            const shift = Math.log2(value);
                            if (shift >= 0 && Math.floor(shift) === shift) {
                                newNode = H.mkAssign(mkText(name), H.mkSimpleCall("<<", [H.mkNumberLiteral(1), H.mkNumberLiteral(shift)]));
                            }
                        } else if (info.isHash) {
                            const hash = ts.pxtc.Util.codalHash16(name.toLowerCase());
                            newNode = H.mkAssign(mkText(name), H.mkNumberLiteral(hash))
                        }
                        if (!newNode) {
                            if (value === lastValue + 1) {
                                newNode = mkText(name);
                            }
                            else {
                                newNode = H.mkAssign(mkText(name), H.mkNumberLiteral(value));
                            }
                        }
                        nodes.push(newNode);
                        lastValue = value;
                    });
                    const declarations = mkCommaSep(nodes, true);
                    declarations.glueToBlock = GlueMode.NoSpace;
                    stmtsEnums.push(mkGroup([
                        mkText(`enum ${info.name}`),
                        mkBlock([declarations])
                    ]));
                }
            });

            const leftoverVars = e.allVariables.filter(v => !v.alreadyDeclared).map(v => mkVariableDeclaration(v, blockInfo));
            return stmtsEnums.concat(leftoverVars.concat(stmtsMain));
        } catch (err) {
            let be: Blockly.Block = (err as any).block;
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

    export function callKey(e: Environment, b: Blockly.Block): string {
        if (b.type == ts.pxtc.ON_START_TYPE)
            return JSON.stringify({ name: ts.pxtc.ON_START_TYPE });

        const call = e.stdCallTable[b.type];
        if (call) {
            // detect if same event is registered already
            const compiledArgs = eventArgs(call, b).map(arg => compileArg(e, b, arg, []));
            const key = JSON.stringify({ name: call.f, ns: call.namespace, compiledArgs })
                .replace(/"id"\s*:\s*"[^"]+"/g, ''); // remove blockly ids
            return key;
        }

        return undefined;
    }

    function updateDisabledBlocks(e: Environment, allBlocks: Blockly.Block[], topBlocks: Blockly.Block[]) {
        // unset disabled
        allBlocks.forEach(b => b.setDisabled(false));

        // update top blocks
        const events: Map<Blockly.Block> = {};

        function flagDuplicate(key: string, block: Blockly.Block) {
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
            else if (isFunctionDefinition(b) || call && call.attrs.blockAllowMultiple && !call.attrs.handlerStatement) return;
            // is this an event?
            else if (call && call.hasHandler && !call.attrs.handlerStatement) {
                // compute key that identifies event call
                // detect if same event is registered already
                const key = call.attrs.blockHandlerKey || callKey(e, b);
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

    export function compileAsync(b: Blockly.Workspace, blockInfo: pxtc.BlocksInfo): Promise<BlockCompilationResult> {
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

    function maybeAddComment(b: Blockly.Block, comments: string[]) {
        if (b.comment) {
            if ((typeof b.comment) === "string") {
                comments.push(b.comment as string)
            }
            else {
                comments.push((b.comment as Blockly.Comment).getText())
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

    function mkVariableDeclaration(v: VarInfo, blockInfo: pxtc.BlocksInfo) {
        const t = getConcreteType(v.type);
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
        return mkStmt(mkText("let " + v.escapedName + tp + " = "), defl)
    }

    function countOptionals(b: Blockly.Block) {
        if ((b as MutatingBlock).mutationToDom) {
            const el = (b as MutatingBlock).mutationToDom();
            if (el.hasAttribute("_expanded")) {
                const val = parseInt(el.getAttribute("_expanded"));
                return isNaN(val) ? 0 : Math.max(val, 0);
            }
        }
        return 0;
    }

    function visibleParams({ comp }: StdFunc, optionalCount: number) {
        const res: pxt.blocks.BlockParameter[] = [];
        if (comp.thisParameter) {
            res.push(comp.thisParameter);
        }

        comp.parameters.forEach(p => {
            if (p.isOptional && optionalCount > 0) {
                res.push(p);
                --optionalCount;
            }
            else if (!p.isOptional) {
                res.push(p);
            }
        });

        return res;
    }

    function getEscapedCBParameters(b: Blockly.Block, stdfun: StdFunc, e: Environment): string[] {
        return getCBParameters(b, stdfun).map(binding => lookup(e, b, binding[0]).escapedName);
    }

    function getCBParameters(b: Blockly.Block, stdfun: StdFunc): [string, Point][] {
        let handlerArgs: [string, Point][] = [];
        if (stdfun.attrs.draggableParameters) {
            for (let i = 0; i < stdfun.comp.handlerArgs.length; i++) {
                const arg = stdfun.comp.handlerArgs[i];
                let varName: string;
                const varBlock = getInputTargetBlock(b, "HANDLER_DRAG_PARAM_" + arg.name) as Blockly.Block;

                if (stdfun.attrs.draggableParameters === "reporter") {
                    varName = varBlock && varBlock.getFieldValue("VALUE");
                } else {
                    varName = varBlock && varBlock.getField("VAR").getText();
                }

                if (varName !== null) {
                    handlerArgs.push([varName, mkPoint(arg.type)]);
                }
                else {
                    break;
                }
            }
        }
        else {
            for (let i = 0; i < stdfun.comp.handlerArgs.length; i++) {
                const arg = stdfun.comp.handlerArgs[i];
                const varField = b.getField("HANDLER_" + arg.name);
                const varName = varField && varField.getText();
                if (varName !== null) {
                    handlerArgs.push([varName, mkPoint(arg.type)]);
                }
                else {
                    break;
                }
            }
        }
        return handlerArgs;
    }

    interface Rect {
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }

    function groupWorkspaceComments(blocks: Blockly.BlockSvg[], comments: Blockly.WorkspaceCommentSvg[]) {
        if (!blocks.length || blocks.some(b => !b.rendered)) {
            return {
                orphans: comments,
                idToComments: {}
            };
        }
        const blockBounds: Rect[] = blocks.map(block => {
            const bounds = block.getBoundingRectangle();
            const size = block.getHeightWidth();
            return {
                id: block.id,
                x: bounds.topLeft.x,
                y: bounds.topLeft.y,
                width: size.width,
                height: size.height
            }
        });

        const map: CommentMap = {
            orphans: [],
            idToComments: {}
        };

        const radius = 20;
        for (const comment of comments) {
            const bounds = comment.getBoundingRectangle();
            const size = comment.getHeightWidth();

            const x = bounds.topLeft.x;
            const y = bounds.topLeft.y;

            let parent: Rect;

            for (const rect of blockBounds) {
                if (doesIntersect(x, y, size.width, size.height, rect)) {
                    parent = rect;
                }
                else if (!parent && doesIntersect(x - radius, y - radius, size.width + radius * 2, size.height + radius * 2, rect)) {
                    parent = rect;
                }
            }

            if (parent) {
                if (!map.idToComments[parent.id]) {
                    map.idToComments[parent.id] = [];
                }
                map.idToComments[parent.id].push(comment);
            }
            else {
                map.orphans.push(comment);
            }
        }

        return map;
    }

    function referencedWithinScope(scope: Scope, varID: number) {
        if (scope.referencedVars.indexOf(varID) !== -1) {
            return true;
        }
        else {
            for (const child of scope.children) {
                if (referencedWithinScope(child, varID)) return true;
            }
        }
        return false;
    }

    function assignedWithinScope(scope: Scope, varID: number) {
        if (scope.assignedVars.indexOf(varID) !== -1) {
            return true;
        }
        else {
            for (const child of scope.children) {
                if (assignedWithinScope(child, varID)) return true;
            }
        }
        return false;
    }

    function escapeVariables(current: Scope, e: Environment) {
        for (const varName of Object.keys(current.declaredVars)) {
            const info = current.declaredVars[varName];
            if (!info.escapedName) info.escapedName = escapeVarName(varName);
        }

        current.children.forEach(c => escapeVariables(c, e));


        function escapeVarName(name: string): string {
            if (!name) return '_';

            let n = ts.pxtc.escapeIdentifier(name);

            if (e.renames.takenNames[n] || nameIsTaken(n, current)) {
                let i = 2;

                while (e.renames.takenNames[n + i] || nameIsTaken(n + i, current)) {
                    i++;
                }

                n += i;
            }

            return n;
        }

        function nameIsTaken(name: string, scope: Scope): boolean {
            if (scope) {
                for (const varName of Object.keys(scope.declaredVars)) {
                    const info = scope.declaredVars[varName];
                    if (info.name !== info.escapedName && info.escapedName === name) return true;
                }
                return nameIsTaken(name, scope.parent);
            }

            return false;
        }
    }


    function findCommonScope(current: Scope, varID: number): Scope {
        let ref: Scope;

        if (current.referencedVars.indexOf(varID) !== -1) {
            return current;
        }

        for (const child of current.children) {
            if (referencedWithinScope(child, varID)) {
                if (assignedWithinScope(child, varID)) {
                    return current;
                }
                if (!ref) {
                    ref = child;
                }
                else {
                    return current;
                }
            }
        }

        return ref ? findCommonScope(ref, varID) : undefined;
    }

    function trackAllVariables(topBlocks: Blockly.Block[], e: Environment) {
        topBlocks = topBlocks.filter(b => !b.disabled);

        let id = 1;
        let topScope: Scope;

        // First, look for on-start
        topBlocks.forEach(block => {
            if (block.type === ts.pxtc.ON_START_TYPE) {
                const firstStatement = block.getInputTargetBlock("HANDLER");
                if (firstStatement) {
                    topScope = {
                        firstStatement: firstStatement,
                        declaredVars: {},
                        referencedVars: [],
                        children: [],
                        assignedVars: []
                    }
                    trackVariables(firstStatement, topScope, e);
                }
            }
        });

        // If we didn't find on-start, then create an empty top scope
        if (!topScope) {
            topScope = {
                firstStatement: null,
                declaredVars: {},
                referencedVars: [],
                children: [],
                assignedVars: []
            }
        }

        topBlocks.forEach(block => {
            if (block.type === ts.pxtc.ON_START_TYPE) {
                return;
            }
            trackVariables(block, topScope, e);
        });

        Object.keys(topScope.declaredVars).forEach(varName => {
            const varID = topScope.declaredVars[varName];
            delete topScope.declaredVars[varName];
            const declaringScope = findCommonScope(topScope, varID.id) || topScope;
            declaringScope.declaredVars[varName] = varID;
        })

        markDeclarationLocations(topScope, e);
        escapeVariables(topScope, e);

        return topScope;

        function trackVariables(block: Blockly.Block, currentScope: Scope, e: Environment) {
            e.idToScope[block.id] = currentScope;

            if (block.type === "variables_get") {
                const name = block.getField("VAR").getText();
                const info = findOrDeclareVariable(name, currentScope);
                currentScope.referencedVars.push(info.id);
            }
            else if (block.type === "variables_set" || block.type === "variables_change") {
                const name = block.getField("VAR").getText();
                const info = findOrDeclareVariable(name, currentScope);
                currentScope.assignedVars.push(info.id);
                currentScope.referencedVars.push(info.id);
            }
            else if (block.type === pxtc.TS_STATEMENT_TYPE) {
                const declaredVars: string = (block as any).declaredVariables
                if (declaredVars) {
                    const varNames = declaredVars.split(",");
                    varNames.forEach(vName => {
                        const info = findOrDeclareVariable(vName, currentScope);
                        info.alreadyDeclared = true;
                    });
                }
            }

            if (hasStatementInput(block)) {
                const vars: VarInfo[] = getDeclaredVariables(block, e).map(binding => {
                    return {
                        name: binding[0],
                        type: binding[1],
                        id: id++
                    }
                });


                let parentScope = currentScope;
                if (vars.length) {
                    // We need to create a scope for this block, and then a scope
                    // for each statement input (in case there are multiple)

                    parentScope = {
                        parent: currentScope,
                        firstStatement: block,
                        declaredVars: {},
                        referencedVars: [],
                        assignedVars: [],
                        children: []
                    };

                    vars.forEach(v => {
                        v.alreadyDeclared = true;
                        parentScope.declaredVars[v.name] = v;
                    });

                    e.idToScope[block.id] = parentScope;
                }


                if (currentScope !== parentScope) {
                    currentScope.children.push(parentScope);
                }

                forEachChildExpression(block, child => {
                    trackVariables(child, parentScope, e);
                });

                forEachStatementInput(block, connectedBlock => {
                    const newScope: Scope = {
                        parent: parentScope,
                        firstStatement: connectedBlock,
                        declaredVars: {},
                        referencedVars: [],
                        assignedVars: [],
                        children: []
                    };
                    parentScope.children.push(newScope);
                    trackVariables(connectedBlock, newScope, e);
                });
            }
            else {
                forEachChildExpression(block, child => {
                    trackVariables(child, currentScope, e);
                });
            }

            if (block.nextConnection && block.nextConnection.targetBlock()) {
                trackVariables(block.nextConnection.targetBlock(), currentScope, e);
            }
        }

        function findOrDeclareVariable(name: string, scope: Scope): VarInfo {
            if (scope.declaredVars[name]) {
                return scope.declaredVars[name];
            }
            else if (scope.parent) {
                return findOrDeclareVariable(name, scope.parent);
            }
            else {
                // Declare it in the top scope
                scope.declaredVars[name] = {
                    name,
                    type: mkPoint(null),
                    id: id++
                };
                return scope.declaredVars[name];
            }
        }
    }

    function getVarInfo(name: string, scope: Scope): VarInfo {
        if (scope.declaredVars[name]) {
            return scope.declaredVars[name];
        }
        else if (scope.parent) {
            return getVarInfo(name, scope.parent);
        }
        else {
            return null;
        }
    }


    function hasStatementInput(block: Blockly.Block) {
        return block.inputList.some(i => i.type === Blockly.NEXT_STATEMENT);
    }

    function getDeclaredVariables(block: Blockly.Block, e: Environment): [string, Point][] {
        switch (block.type) {
            case 'pxt_controls_for':
            case 'controls_simple_for':
                return [[getLoopVariableField(block).getField("VAR").getText(), pNumber]];
            case 'pxt_controls_for_of':
            case 'controls_for_of':
                return [[getLoopVariableField(block).getField("VAR").getText(), mkPoint(null)]];
            default:
                break;
        }

        if (isMutatingBlock(block)) {
            const declarations = block.mutation.getDeclaredVariables();
            if (declarations) {
                return Object.keys(declarations).map(varName => [varName, mkPoint(declarations[varName])] as [string, Point]);
            }
        }

        let stdFunc = e.stdCallTable[block.type];
        if (stdFunc && stdFunc.comp.handlerArgs.length) {
            return getCBParameters(block, stdFunc);
        }

        return [];
    }

    function forEachChildExpression(block: Blockly.Block, cb: (block: Blockly.Block) => void, recursive = false) {
        block.inputList.filter(i => i.type === Blockly.INPUT_VALUE).forEach(i => {
            if (i.connection && i.connection.targetBlock()) {
                cb(i.connection.targetBlock());
                if (recursive) {
                    forEachChildExpression(i.connection.targetBlock(), cb, recursive);
                }
            }
        });
    }

    function forEachStatementInput(block: Blockly.Block, cb: (block: Blockly.Block) => void) {
        block.inputList.filter(i => i.type === Blockly.NEXT_STATEMENT).forEach(i => {
            if (i.connection && i.connection.targetBlock()) {
                cb(i.connection.targetBlock());
            }
        })
    }

    function printScope(scope: Scope, depth = 0) {
        const declared = Object.keys(scope.declaredVars).map(k => `${k}(${scope.declaredVars[k].id})`).join(",");
        const referenced = scope.referencedVars.join(", ");
        console.log(`${mkIndent(depth)}SCOPE: ${scope.firstStatement ? scope.firstStatement.type : "TOP-LEVEL"}`)
        if (declared.length) {
            console.log(`${mkIndent(depth)}DECS: ${declared}`)
        }
        // console.log(`${mkIndent(depth)}REFS: ${referenced}`)
        scope.children.forEach(s => printScope(s, depth + 1));
    }

    function mkIndent(depth: number) {
        let res = "";
        for (let i = 0; i < depth; i++) {
            res += "    ";
        }
        return res;
    }

    function markDeclarationLocations(scope: Scope, e: Environment) {
        const declared = Object.keys(scope.declaredVars);
        if (declared.length) {
            const decls = declared.map(name => scope.declaredVars[name]);

            if (scope.firstStatement) {
                // If we can't find a better place to declare the variable, we'll declare
                // it before the first statement in the code block so we need to keep
                // track of the blocks ids
                e.blockDeclarations[scope.firstStatement.id] = decls.concat(e.blockDeclarations[scope.firstStatement.id] || []);
            }

            decls.forEach(d => e.allVariables.push(d));
        }

        scope.children.forEach(child => markDeclarationLocations(child, e));
    }


    function doesIntersect(x: number, y: number, width: number, height: number, other: Rect) {
        const xOverlap = between(x, other.x, other.x + other.width) || between(other.x, x, x + width);
        const yOverlap = between(y, other.y, other.y + other.height) || between(other.y, y, y + height);
        return xOverlap && yOverlap;

        function between(val: number, lower: number, upper: number) {
            return val >= lower && val <= upper;
        }
    }

    function isFunctionDefinition(b: Blockly.Block) {
        return b.type === "procedures_defnoreturn" || b.type === "function_definition";
    }
}