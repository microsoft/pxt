/// <reference path="../../built/pxtlib.d.ts" />


import * as Blockly from "blockly";
import { BlockCompilationResult, BlockCompileOptions, BlockDeclarationType, BlockDiagnostic, Environment, GrayBlockStatement, StdFunc, VarInfo, mkEnv } from "./environment";
import { IfBlock, attachPlaceholderIf, defaultValueForType, find, getConcreteType, getEscapedCBParameters, infer, isBooleanType, isFunctionRecursive, isStringType, lookup, returnType } from "./typeChecker";
import { append, countOptionals, escapeVarName, forEachChildExpression, getInputTargetBlock, getLoopVariableField, isFunctionDefinition, isMutatingBlock, visibleParams } from "./util";
import { isArrayType } from "../toolbox";
import { MutatorTypes } from "../legacyMutations";
import { trackAllVariables } from "./variables";
import { FieldTilemap, FieldTextInput } from "../fields";
import { CommonFunctionBlock } from "../plugins/functions/commonFunctionMixin";
import { getContainingFunction } from "../plugins/duplicateOnDrag";
import { FUNCTION_DEFINITION_BLOCK_TYPE } from "../plugins/functions/constants";


interface Rect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface CommentMap {
    orphans: Blockly.comments.RenderedWorkspaceComment[];
    idToComments: pxt.Map<Blockly.comments.RenderedWorkspaceComment[]>;
}

export const PXT_WARNING_ID = "WARNING_MESSAGE"


export function compileBlockAsync(b: Blockly.Block, blockInfo: pxtc.BlocksInfo): Promise<BlockCompilationResult> {
    const w = b.workspace;
    const e = mkEnv(w, blockInfo);
    infer(w && w.getAllBlocks(false), e, w);
    const compiled = compileStatementBlock(e, b)
    e.placeholders = {};
    return tdASTtoTS(e, compiled);
}

export function compileAsync(b: Blockly.Workspace, blockInfo: pxtc.BlocksInfo, opts: BlockCompileOptions = {}): Promise<BlockCompilationResult> {
    const e = mkEnv(b, blockInfo, opts);
    const [nodes, diags] = compileWorkspace(e, b, blockInfo);
    const result = tdASTtoTS(e, nodes, diags);
    return result;
}

function eventWeight(b: Blockly.Block, e: Environment) {
    if (b.type === ts.pxtc.ON_START_TYPE) {
        return 0;
    }
    const api = e.stdCallTable[b.type];
    const key = callKey(e, b);
    const hash = 1 + ts.pxtc.Util.codalHash16(key);
    if (api && api.attrs.afterOnStart)
        return hash;
    else
        return -hash;
}

function compileWorkspace(e: Environment, w: Blockly.Workspace, blockInfo: pxtc.BlocksInfo): [pxt.blocks.JsNode[], BlockDiagnostic[]] {
    try {
        // all compiled top level blocks are events
        let allBlocks = w.getAllBlocks(false);

        if (pxt.react.getTilemapProject) {
            pxt.react.getTilemapProject().removeInactiveBlockAssets(allBlocks.map(b => b.id));
        }

        // the top blocks are storted by blockly
        let topblocks = w.getTopBlocks(true);
        // reorder remaining events by names (top blocks still contains disabled blocks)
        topblocks = topblocks.sort((a, b) => {
            return eventWeight(a, e) - eventWeight(b, e)
        });
        // update disable blocks
        updateDisabledBlocks(e, allBlocks, topblocks);
        // drop disabled blocks
        allBlocks = allBlocks.filter(b => b.isEnabled());
        topblocks = topblocks.filter(b => b.isEnabled());
        trackAllVariables(topblocks, e);
        infer(allBlocks, e, w);

        const stmtsMain: pxt.blocks.JsNode[] = [];

        // compile workspace comments, add them to the top
        const topComments = w.getTopComments(true);
        const commentMap = groupWorkspaceComments(topblocks as Blockly.BlockSvg[],
            topComments as Blockly.comments.RenderedWorkspaceComment[]);

        commentMap.orphans.forEach(comment => append(stmtsMain, compileWorkspaceComment(comment).children));

        topblocks.forEach(b => {
            if (commentMap.idToComments[b.id]) {
                commentMap.idToComments[b.id].forEach(comment => {
                    append(stmtsMain, compileWorkspaceComment(comment).children);
                });
            }
            if (b.type == ts.pxtc.ON_START_TYPE)
                append(stmtsMain, compileStatementBlock(e, b));
            else {
                const compiled = pxt.blocks.mkBlock(compileStatementBlock(e, b));
                if (compiled.type == pxt.blocks.NT.Block)
                    append(stmtsMain, compiled.children);
                else stmtsMain.push(compiled)
            }
        });

        const stmtsEnums: pxt.blocks.JsNode[] = [];
        e.enums.forEach(info => {
            const models = w.getVariableMap().getVariablesOfType(info.name);
            if (models && models.length) {
                const members: [string, number][] = models.map(m => {
                    const match = /^(\d+)([^0-9].*)$/.exec(m.getName());
                    if (match) {
                        return [match[2], parseInt(match[1])] as [string, number];
                    }
                    else {
                        // Someone has been messing with the XML...
                        return [m.getName(), -1] as [string, number];
                    }
                });

                members.sort((a, b) => a[1] - b[1]);

                const nodes: pxt.blocks.JsNode[] = [];
                let lastValue = -1;
                members.forEach(([name, value], index) => {
                    let newNode: pxt.blocks.JsNode;
                    if (info.isBitMask) {
                        const shift = Math.log2(value);
                        if (shift >= 0 && Math.floor(shift) === shift) {
                            newNode = pxt.blocks.H.mkAssign(pxt.blocks.mkText(name), pxt.blocks.H.mkSimpleCall("<<", [pxt.blocks.H.mkNumberLiteral(1), pxt.blocks.H.mkNumberLiteral(shift)]));
                        }
                    } else if (info.isHash) {
                        const hash = ts.pxtc.Util.codalHash16(name.toLowerCase());
                        newNode = pxt.blocks.H.mkAssign(pxt.blocks.mkText(name), pxt.blocks.H.mkNumberLiteral(hash))
                    }
                    if (!newNode) {
                        if (value === lastValue + 1) {
                            newNode = pxt.blocks.mkText(name);
                        }
                        else {
                            newNode = pxt.blocks.H.mkAssign(pxt.blocks.mkText(name), pxt.blocks.H.mkNumberLiteral(value));
                        }
                    }
                    nodes.push(newNode);
                    lastValue = value;
                });
                const declarations = pxt.blocks.mkCommaSep(nodes, true);
                declarations.glueToBlock = pxt.blocks.GlueMode.NoSpace;
                stmtsEnums.push(pxt.blocks.mkGroup([
                    pxt.blocks.mkText(`enum ${info.name}`),
                    pxt.blocks.mkBlock([declarations])
                ]));
            }
        });

        e.kinds.forEach(info => {
            const models = w.getVariableMap().getVariablesOfType("KIND_" + info.name);
            if (models && models.length) {
                const userDefined = models.map(m => m.getName()).filter(n => info.initialMembers.indexOf(n) === -1);

                if (userDefined.length) {
                    stmtsEnums.push(pxt.blocks.mkGroup([
                        pxt.blocks.mkText(`namespace ${info.name}`),
                        pxt.blocks.mkBlock(userDefined.map(varName => pxt.blocks.mkStmt(pxt.blocks.mkText(`export const ${varName} = ${info.name}.${info.createFunctionName}()`))))
                    ]));
                }
            }
        });

        const leftoverVars = e.allVariables.filter(v => !v.alreadyDeclared).map(v => mkVariableDeclaration(v, blockInfo));

        e.allVariables.filter(v => v.alreadyDeclared === BlockDeclarationType.Implicit && !v.isAssigned).forEach(v => {
            const t = getConcreteType(v.type);

            // The primitive types all get initializers set to default values, other types are set to null
            if (t.type === "string" || t.type === "number" || t.type === "boolean" || isArrayType(t.type)) return;

            e.diagnostics.push({
                blockId: v.firstReference && v.firstReference.id,
                message: lf("Variable '{0}' is never assigned", v.name)
            });
        });

        return [stmtsEnums.concat(leftoverVars.concat(stmtsMain)), e.diagnostics];
    } catch (err) {
        let be: Blockly.Block = (err as any).block;
        if (be) {
            be.setWarningText(err + "", PXT_WARNING_ID);
            e.errors.push(be);
        }
        else {
            throw err;
        }
    } finally {
        e.placeholders = {};
    }

    return [null, null] // unreachable
}

export function callKey(e: Environment, b: Blockly.Block): string {
    if (b.type == ts.pxtc.ON_START_TYPE)
        return JSON.stringify({ name: ts.pxtc.ON_START_TYPE });
    else if (b.type == ts.pxtc.FUNCTION_DEFINITION_TYPE)
        return JSON.stringify({ type: "function", name: b.getFieldValue("function_name") });

    const key = JSON.stringify(blockKey(b))
        .replace(/"id"\s*:\s*"[^"]+"/g, ''); // remove blockly ids

    return key;
}

function blockKey(b: Blockly.Block) {
    const fields: string[] = []
    const inputs: any[] = []
    for (const input of b.inputList) {
        for (const field of input.fieldRow) {
            if (field.name) {
                fields.push(field.getText())
            }
        }

        if (input.type === Blockly.inputs.inputTypes.VALUE) {
            if (input.connection.targetBlock()) {
                inputs.push(blockKey(input.connection.targetBlock()));
            }
            else {
                inputs.push(null);
            }
        }
    }

    return {
        type: b.type,
        fields,
        inputs
    };
}

export const AUTO_DISABLED_REASON = "pxt_automatic_disabled";

function setChildrenEnabled(block: Blockly.Block, enabled: boolean) {
    block.setDisabledReason(!enabled, AUTO_DISABLED_REASON);
    // propagate changes
    const children = block.getDescendants(false);
    for (const child of children) {
        child.setDisabledReason(!enabled, AUTO_DISABLED_REASON);
    }
}

function clearDisabled(block: Blockly.Block) {
    block.setDisabledReason(false, AUTO_DISABLED_REASON);

    // for legacy projects, the disabled reason will be MANUALLY_DISABLED
    block.setDisabledReason(false, Blockly.constants.MANUALLY_DISABLED);

    // this is the reason for blocks that are disabled via Blockly.Events.disableOrphans
    block.setDisabledReason(false, "ORPHANED_BLOCK");
}

function updateDisabledBlocks(e: Environment, allBlocks: Blockly.Block[], topBlocks: Blockly.Block[]) {
    // Since enabling/disabling blocks is automatic, we don't want this showing up on the undo/redo stack
    const eventsEnabled = Blockly.Events.isEnabled();

    if (eventsEnabled) {
        Blockly.Events.disable();
    }

    // unset disabled
    allBlocks.forEach(clearDisabled);

    // update top blocks
    const events: pxt.Map<Blockly.Block> = {};

    function flagDuplicate(key: string, block: Blockly.Block) {
        const otherEvent = events[key];
        if (otherEvent) {
            // another block is already registered
            setChildrenEnabled(block, false);
        } else {
            setChildrenEnabled(block, true);
            events[key] = block;
        }
    }

    topBlocks.forEach(b => {
        const call = e.stdCallTable[b.type];
        // multiple calls allowed
        if (b.type == ts.pxtc.ON_START_TYPE)
            flagDuplicate(ts.pxtc.ON_START_TYPE, b);
        else if (isFunctionDefinition(b) || call && call.attrs.blockAllowMultiple && !(call.attrs.handlerStatement || call.attrs.forceStatement)) return;
        // is this an event?
        else if (call && call.hasHandler && !(call.attrs.handlerStatement || call.attrs.forceStatement)) {
            // compute key that identifies event call
            // detect if same event is registered already
            const key = call.attrs.blockHandlerKey || callKey(e, b);
            flagDuplicate(key, b);
        } else {
            // all non-events are disabled
            let t = b;
            while (t) {
                setChildrenEnabled(b, false);
                t = t.getNextBlock();
            }
        }
    });

    if (eventsEnabled) {
        Blockly.Events.enable();
    }
}

function compileStatementBlock(e: Environment, b: Blockly.Block): pxt.blocks.JsNode[] {
    if (b.isInsertionMarker()) {
        // Must have accidentally triggered a compile during a block drag
        return [];
    }
    let r: pxt.blocks.JsNode[];
    const comments: string[] = [];
    e.stats[b.type] = (e.stats[b.type] || 0) + 1;
    maybeAddComment(b, comments);
    switch (b.type) {
        case 'controls_if':
            r = compileControlsIf(e, b as IfBlock, comments);
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
            r = [compileFunctionCall(e, b, comments, true)];
            break;
        case pxtc.TS_RETURN_STATEMENT_TYPE:
            r = [compileReturnStatement(e, b, comments)];
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
        case pxtc.TS_BREAK_TYPE:
            r = compileBreakStatementBlock(e, b);
            break;
        case pxtc.TS_CONTINUE_TYPE:
            r = compileContinueStatementBlock(e, b);
            break;
        default:
            let call = e.stdCallTable[b.type];
            if (call) r = [compileCall(e, b, comments)];
            else r = [pxt.blocks.mkStmt(compileExpression(e, b, comments))];
            break;
    }
    let l = r[r.length - 1]; if (l && !l.id) l.id = b.id;

    if (comments.length) {
        addCommentNodes(comments, r)
    }

    r.forEach(l => {
        if ((l.type === pxt.blocks.NT.Block || l.type === pxt.blocks.NT.Prefix && pxt.Util.startsWith(l.op, "//")) && (b.type != pxtc.ON_START_TYPE || !l.id)) {
            l.id = b.id
        }
    });

    return r;
}

// [t] is the expected type; we assume that we never null block children
// (because placeholder blocks have been inserted by the type-checking phase
// whenever a block was actually missing).
export function compileExpression(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    pxt.U.assert(b != null);
    e.stats[b.type] = (e.stats[b.type] || 0) + 1;
    maybeAddComment(b, comments);
    let expr: pxt.blocks.JsNode;
    if (b.type == "placeholder" || !(b.isEnabled && b.isEnabled())) {
        const ret = find(returnType(e, b));
        if (ret.type === "Array") {
            // FIXME: Can't use default type here because TS complains about
            // the array having an implicit any type. However, forcing this
            // to be a number array may cause type issues. Also, potential semicolon
            // issues if we ever have a block where the array is not the first argument...
            let isExpression = b.getParent().type === "lists_index_get";
            if (!isExpression) {
                const call = e.stdCallTable[b.getParent().type];
                isExpression = call && call.isExpression;
            }
            const arrayNode = pxt.blocks.mkText("[0]");
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
        case "variables_get_reporter":
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
        case "argument_reporter_array":
        case "argument_reporter_custom":
            expr = compileArgumentReporter(e, b, comments);
            break;
        case "function_call_output":
            expr = compileFunctionCall(e, b, comments, false); break;
        default:
            let call = e.stdCallTable[b.type];
            if (call) {
                if (call.imageLiteral)
                    expr = compileImage(e, b, call.imageLiteral, call.imageLiteralColumns, call.imageLiteralRows, call.namespace, call.f,
                        visibleParams(call, countOptionals(b, call)).map(ar => compileArgument(e, b, ar, comments)))
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

function compileStatements(e: Environment, b: Blockly.Block): pxt.blocks.JsNode {
    let stmts: pxt.blocks.JsNode[] = [];
    let firstBlock = b;

    while (b) {
        if (b.isEnabled()) append(stmts, compileStatementBlock(e, b));
        b = b.getNextBlock();
    }

    if (firstBlock && e.blockDeclarations[firstBlock.id]) {
        e.blockDeclarations[firstBlock.id].filter(v => !v.alreadyDeclared).forEach(varInfo => {
            stmts.unshift(mkVariableDeclaration(varInfo, e.blocksInfo));
            varInfo.alreadyDeclared = BlockDeclarationType.Implicit;
        });
    }
    return pxt.blocks.mkBlock(stmts);
}

function compileTypescriptBlock(e: Environment, b: Blockly.Block) {
    return (b as GrayBlockStatement).getLines().map(line => pxt.blocks.mkText(line + "\n"));
}

function compileDebuggeStatementBlock(e: Environment, b: Blockly.Block) {
    if (b.getFieldValue("ON_OFF") == "1") {
        return [
            pxt.blocks.mkText("debugger;\n")
        ]
    }
    return [];
}

function compileBreakStatementBlock(e: Environment, b: Blockly.Block) {
    return [pxt.blocks.mkText("break;\n")]
}

function compileContinueStatementBlock(e: Environment, b: Blockly.Block) {
    return [pxt.blocks.mkText("continue;\n")]
}

function prefixWithSemicolon(n: pxt.blocks.JsNode) {
    const emptyStatement = pxt.blocks.mkStmt(pxt.blocks.mkText(";"));
    emptyStatement.glueToBlock = pxt.blocks.GlueMode.NoSpace;
    return pxt.blocks.mkGroup([emptyStatement, n]);
}

function compilePauseUntilBlock(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode[] {
    const options = pxt.appTarget.runtime && pxt.appTarget.runtime.pauseUntilBlock;
    pxt.U.assert(!!options, "target has block enabled");

    const ns = options.namespace;
    const name = options.callName || "pauseUntil";
    const arg = compileArgument(e, b, { definitionName: "PREDICATE", actualName: "PREDICATE" }, comments);
    const lambda = [pxt.blocks.mkGroup([pxt.blocks.mkText("() => "), arg])];

    if (ns) {
        return [pxt.blocks.mkStmt(pxt.blocks.H.namespaceCall(ns, name, lambda, false))];
    }
    else {
        return [pxt.blocks.mkStmt(pxt.blocks.H.mkCall(name, lambda, false, false))];
    }
}

function compileControlsIf(e: Environment, b: IfBlock, comments: string[]): pxt.blocks.JsNode[] {
    let stmts: pxt.blocks.JsNode[] = [];
    // Notice the <= (if there's no else-if, we still compile the primary if).
    for (let i = 0; i <= b.elseifCount_; ++i) {
        let cond = compileExpression(e, getInputTargetBlock(e, b, "IF" + i), comments);
        let thenBranch = compileStatements(e, getInputTargetBlock(e, b, "DO" + i));
        let startNode = pxt.blocks.mkText("if (")
        if (i > 0) {
            startNode = pxt.blocks.mkText("else if (")
            startNode.glueToBlock = pxt.blocks.GlueMode.WithSpace;
        }
        append(stmts, [
            startNode,
            cond,
            pxt.blocks.mkText(")"),
            thenBranch
        ])
    }
    if (b.elseCount_) {
        let elseNode = pxt.blocks.mkText("else")
        elseNode.glueToBlock = pxt.blocks.GlueMode.WithSpace;
        append(stmts, [
            elseNode,
            compileStatements(e, getInputTargetBlock(e, b, "ELSE"))
        ])
    }
    return stmts;
}

function compileControlsFor(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode[] {
    let bTo = getInputTargetBlock(e, b, "TO");
    let bDo = getInputTargetBlock(e, b, "DO");
    let bBy = getInputTargetBlock(e, b, "BY");
    let bFrom = getInputTargetBlock(e, b, "FROM");
    let incOne = !bBy || (bBy.type.match(/^math_number/) && extractNumber(bBy) == 1)

    let binding = lookup(e, b, getLoopVariableField(e, b).getField("VAR").getText());

    return [
        pxt.blocks.mkText("for (let " + binding.escapedName + " = "),
        bFrom ? compileExpression(e, bFrom, comments) : pxt.blocks.mkText("0"),
        pxt.blocks.mkText("; "),
        pxt.blocks.mkInfix(pxt.blocks.mkText(binding.escapedName), "<=", compileExpression(e, bTo, comments)),
        pxt.blocks.mkText("; "),
        incOne ? pxt.blocks.mkText(binding.escapedName + "++") : pxt.blocks.mkInfix(pxt.blocks.mkText(binding.escapedName), "+=", compileExpression(e, bBy, comments)),
        pxt.blocks.mkText(")"),
        compileStatements(e, bDo)
    ]
}

function compileControlsRepeat(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode[] {
    let bound = compileExpression(e, getInputTargetBlock(e, b, "TIMES"), comments);
    let body = compileStatements(e, getInputTargetBlock(e, b, "DO"));
    let valid = (x: string) => !lookup(e, b, x);

    let name = "index";
    // Start at 2 because index0 and index1 are bad names
    for (let i = 2; !valid(name); i++)
        name = "index" + i;
    return [
        pxt.blocks.mkText("for (let " + name + " = 0; "),
        pxt.blocks.mkInfix(pxt.blocks.mkText(name), "<", bound),
        pxt.blocks.mkText("; " + name + "++)"),
        body
    ]
}

function compileWhile(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode[] {
    let cond = compileExpression(e, getInputTargetBlock(e, b, "COND"), comments);
    let body = compileStatements(e, getInputTargetBlock(e, b, "DO"));
    return [
        pxt.blocks.mkText("while ("),
        cond,
        pxt.blocks.mkText(")"),
        body
    ]
}

function compileControlsForOf(e: Environment, b: Blockly.Block, comments: string[]) {
    let bOf = getInputTargetBlock(e, b, "LIST");
    let bDo = getInputTargetBlock(e, b, "DO");

    let listExpression: pxt.blocks.JsNode;

    if (!bOf || bOf.type === "placeholder") {
        listExpression = pxt.blocks.mkText("[0]");
    }
    else {
        listExpression = compileExpression(e, bOf, comments);
    }

    let binding = lookup(e, b, getLoopVariableField(e, b).getField("VAR").getText());

    return [
        pxt.blocks.mkText("for (let " + binding.escapedName + " of "),
        listExpression,
        pxt.blocks.mkText(")"),
        compileStatements(e, bDo)
    ]
}

function compileVariableGet(e: Environment, b: Blockly.Block): pxt.blocks.JsNode {
    const name = b.getField("VAR").getText();
    let binding = lookup(e, b, name);
    if (!binding) // trying to compile a disabled block with a bogus variable
        return pxt.blocks.mkText(name);

    if (!binding.firstReference) binding.firstReference = b;

    pxt.U.assert(binding != null && binding.type != null);
    return pxt.blocks.mkText(binding.escapedName);
}

function compileSet(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    let bExpr = getInputTargetBlock(e, b, "VALUE");
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

    binding.isAssigned = true;

    if (isDef) {
        binding.alreadyDeclared = BlockDeclarationType.Assigned;
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

    return pxt.blocks.mkStmt(
        pxt.blocks.mkText(bindString),
        expr)
}

function compileChange(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    let bExpr = getInputTargetBlock(e, b, "VALUE");
    let binding = lookup(e, b, b.getField("VAR").getText());
    let expr = compileExpression(e, bExpr, comments);
    let ref = pxt.blocks.mkText(binding.escapedName);
    return pxt.blocks.mkStmt(pxt.blocks.mkInfix(ref, "+=", expr))
}

function mkCallWithCallback(e: Environment, n: string, f: string, args: pxt.blocks.JsNode[], body: pxt.blocks.JsNode, argumentDeclaration?: pxt.blocks.JsNode, isExtension = false): pxt.blocks.JsNode {
    body.noFinalNewline = true
    let callback: pxt.blocks.JsNode;
    if (argumentDeclaration) {
        callback = pxt.blocks.mkGroup([argumentDeclaration, body]);
    }
    else {
        callback = pxt.blocks.mkGroup([pxt.blocks.mkText("function ()"), body]);
    }

    if (isExtension)
        return pxt.blocks.mkStmt(pxt.blocks.H.extensionCall(f, args.concat([callback]), false));
    else if (n)
        return pxt.blocks.mkStmt(pxt.blocks.H.namespaceCall(n, f, args.concat([callback]), false));
    else
        return pxt.blocks.mkStmt(pxt.blocks.H.mkCall(f, args.concat([callback]), false));
}

function compileStartEvent(e: Environment, b: Blockly.Block): pxt.blocks.JsNode {
    const bBody = getInputTargetBlock(e, b, "HANDLER");
    const body = compileStatements(e, bBody);

    if (pxt.appTarget.compile && pxt.appTarget.compile.onStartText && body && body.children) {
        body.children.unshift(pxt.blocks.mkStmt(pxt.blocks.mkText(`// ${pxtc.ON_START_COMMENT}\n`)))
    }

    return body;
}

function compileEvent(e: Environment, b: Blockly.Block, stdfun: StdFunc, args: pxt.blocks.BlockParameter[], ns: string, comments: string[]): pxt.blocks.JsNode {
    const compiledArgs: pxt.blocks.JsNode[] = args.map(arg => compileArgument(e, b, arg, comments));
    const bBody = getInputTargetBlock(e, b, "HANDLER");
    const body = compileStatements(e, bBody);

    if (pxt.appTarget.compile && pxt.appTarget.compile.emptyEventHandlerComments && body.children.length === 0) {
        body.children.unshift(pxt.blocks.mkStmt(pxt.blocks.mkText(`// ${pxtc.HANDLER_COMMENT}`)))
    }

    let argumentDeclaration: pxt.blocks.JsNode;

    if (isMutatingBlock(b) && b.mutation.getMutationType() === MutatorTypes.ObjectDestructuringMutator) {
        argumentDeclaration = b.mutation.compileMutation(e, comments);
    }
    else if (stdfun.comp.handlerArgs.length) {
        let handlerArgs = getEscapedCBParameters(b, stdfun, e);
        argumentDeclaration = pxt.blocks.mkText(`function (${handlerArgs.join(", ")})`)
    }


    let callNamespace = ns;
    let callName = stdfun.f
    if (stdfun.attrs.blockAliasFor) {
        const aliased = e.blocksInfo.apis.byQName[stdfun.attrs.blockAliasFor];

        if (aliased) {
            callName = aliased.name;
            callNamespace = aliased.namespace;
        }
    }


    return mkCallWithCallback(e, callNamespace, callName, compiledArgs, body, argumentDeclaration, stdfun.isExtensionMethod);
}

function compileImage(e: Environment, b: Blockly.Block, frames: number, columns: number, rows: number, n: string, f: string, args?: pxt.blocks.JsNode[]): pxt.blocks.JsNode {
    args = args === undefined ? [] : args;
    let state = "\n";
    rows = rows || 5;
    columns = (columns || 5) * frames;
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
    let lit = pxt.blocks.H.mkStringLiteral(state)
    lit.canIndentInside = true
    return pxt.blocks.H.namespaceCall(n, f, [lit].concat(args), false);
}

function tdASTtoTS(env: Environment, app: pxt.blocks.JsNode[], diags?: BlockDiagnostic[]): Promise<BlockCompilationResult> {
    let res = pxt.blocks.flattenNode(app)

    // Note: the result of format is not used!

    return workerOpAsync("format", { format: { input: res.output, pos: 1 } }).then(() => {
        return {
            source: res.output,
            sourceMap: res.sourceMap,
            stats: env.stats,
            diagnostics: diags || []
        };
    })

}

function maybeAddComment(b: Blockly.Block, comments: string[]) {
    // Check if getCommentText exists, block may be placeholder
    const text = b.getCommentText?.();
    if (text) {
        comments.push(text)
    }
}

function addCommentNodes(comments: string[], r: pxt.blocks.JsNode[]) {
    const commentNodes: pxt.blocks.JsNode[] = []

    for (const comment of comments) {
        for (const line of comment.split("\n")) {
            commentNodes.push(pxt.blocks.mkText(`// ${line}`))
            commentNodes.push(pxt.blocks.mkNewLine())
        }
    }

    for (const commentNode of commentNodes.reverse()) {
        r.unshift(commentNode)
    }
}

function mkVariableDeclaration(v: VarInfo, blockInfo: pxtc.BlocksInfo) {
    const t = getConcreteType(v.type);
    let defl: pxt.blocks.JsNode;

    if (t.type === "Array") {
        defl = pxt.blocks.mkText("[]");
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
            defl = pxt.blocks.mkText(tpinfo.attributes.autoCreate + "()")
        else
            tp = ": " + tpname
    }
    return pxt.blocks.mkStmt(pxt.blocks.mkText("let " + v.escapedName + tp + " = "), defl)
}

function groupWorkspaceComments(blocks: Blockly.BlockSvg[], comments: Blockly.comments.RenderedWorkspaceComment[]): CommentMap {
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
            x: bounds.left,
            y: bounds.top,
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
        const size = comment.getSize();

        const x = bounds.left;
        const y = bounds.top;

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


function doesIntersect(x: number, y: number, width: number, height: number, other: Rect) {
    const xOverlap = between(x, other.x, other.x + other.width) || between(other.x, x, x + width);
    const yOverlap = between(y, other.y, other.y + other.height) || between(other.y, y, y + height);
    return xOverlap && yOverlap;

    function between(val: number, lower: number, upper: number) {
        return val >= lower && val <= upper;
    }
}

function isComparisonOp(op: string) {
    return ["LT", "LTE", "GT", "GTE", "EQ", "NEQ"].indexOf(op) !== -1;
}

let opToTok: { [index: string]: string } = {
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

function compileArithmetic(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    let bOp = b.getFieldValue("OP");
    let left = getInputTargetBlock(e, b, "A");
    let right = getInputTargetBlock(e, b, "B");
    let args = [compileExpression(e, left, comments), compileExpression(e, right, comments)];

    // Special handling for the case of comparing two literals (e.g. 0 === 5). TypeScript
    // throws an error if we don't first cast to any
    if (isComparisonOp(bOp) && isLiteral(e, left) && isLiteral(e, right)) {
        if (pxt.blocks.flattenNode([args[0]]).output !== pxt.blocks.flattenNode([args[1]]).output) {
            args = args.map(arg =>
                pxt.blocks.H.mkParenthesizedExpression(
                    pxt.blocks.mkGroup([arg, pxt.blocks.mkText(" as any")])
                )
            );
        }
    }

    const t = returnType(e, left);

    if (isStringType(t)) {
        if (bOp == "EQ") return pxt.blocks.H.mkSimpleCall("==", args);
        else if (bOp == "NEQ") return pxt.blocks.H.mkSimpleCall("!=", args);
    } else if (isBooleanType(t))
        return pxt.blocks.H.mkSimpleCall(opToTok[bOp], args);

    // Compilation of math operators.
    pxt.U.assert(bOp in opToTok);
    return pxt.blocks.H.mkSimpleCall(opToTok[bOp], args);
}

function compileModulo(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    let left = getInputTargetBlock(e, b, "DIVIDEND");
    let right = getInputTargetBlock(e, b, "DIVISOR");
    let args = [compileExpression(e, left, comments), compileExpression(e, right, comments)];
    return pxt.blocks.H.mkSimpleCall("%", args);
}

function compileMathOp2(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    let op = b.getFieldValue("op");
    let x = compileExpression(e, getInputTargetBlock(e, b, "x"), comments);
    let y = compileExpression(e, getInputTargetBlock(e, b, "y"), comments);
    return pxt.blocks.H.mathCall(op, [x, y])
}

function compileMathOp3(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    let x = compileExpression(e, getInputTargetBlock(e, b, "x"), comments);
    return pxt.blocks.H.mathCall("abs", [x]);
}

function compileText(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    return pxt.blocks.H.mkStringLiteral(b.getFieldValue("TEXT"));
}

function compileTextJoin(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    let last: pxt.blocks.JsNode;
    let i = 0;
    while (true) {
        const val = getInputTargetBlock(e, b, "ADD" + i);
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
                last = pxt.blocks.H.mkSimpleCall("+", [pxt.blocks.H.mkStringLiteral(""), compiled]);
            }
        }
        else {
            last = pxt.blocks.H.mkSimpleCall("+", [last, compiled]);
        }
    }

    if (!last) {
        return pxt.blocks.H.mkStringLiteral("");
    }

    return last;
}

function compileBoolean(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    return pxt.blocks.H.mkBooleanLiteral(b.getFieldValue("BOOL") == "TRUE");
}

function compileNot(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    let expr = compileExpression(e, getInputTargetBlock(e, b, "BOOL"), comments);
    return pxt.blocks.mkPrefix("!", [pxt.blocks.H.mkParenthesizedExpression(expr)]);
}

function compileCreateList(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    // collect argument
    let args = b.inputList.map(input => input.connection && input.connection.targetBlock() ? compileExpression(e, input.connection.targetBlock(), comments) : undefined)
        .filter(e => !!e);

    return pxt.blocks.H.mkArrayLiteral(args, !b.getInputsInline());
}

function compileListGet(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    const listBlock = getInputTargetBlock(e, b, "LIST");
    const listExpr = compileExpression(e, listBlock, comments);
    const index = compileExpression(e, getInputTargetBlock(e, b, "INDEX"), comments);
    const res = pxt.blocks.mkGroup([listExpr, pxt.blocks.mkText("["), index, pxt.blocks.mkText("]")]);

    return res;
}

function compileListSet(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    const listBlock = getInputTargetBlock(e, b, "LIST");
    const listExpr = compileExpression(e, listBlock, comments);
    const index = compileExpression(e, getInputTargetBlock(e, b, "INDEX"), comments);
    const value = compileExpression(e, getInputTargetBlock(e, b, "VALUE"), comments);
    const res = pxt.blocks.mkGroup([listExpr, pxt.blocks.mkText("["), index, pxt.blocks.mkText("] = "), value]);

    return listBlock.type === "lists_create_with" ? prefixWithSemicolon(res) : res;
}

function compileMathJsOp(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    const op = b.getFieldValue("OP");
    const args = [compileExpression(e, getInputTargetBlock(e, b, "ARG0"), comments)];

    if ((b as any).getInput("ARG1")) {
        args.push(compileExpression(e, getInputTargetBlock(e, b, "ARG1"), comments));
    }

    return pxt.blocks.H.mathCall(op, args);
}

function compileFunctionDefinition(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode[] {
    const name = escapeVarName(b.getField("function_name").getText(), e, true);
    const stmts = getInputTargetBlock(e, b, "STACK");
    const argsDeclaration = (b as CommonFunctionBlock).getArguments().map(a => {
        if (a.type == "Array") {
            const binding = lookup(e, b, a.name);
            const declaredType = getConcreteType(binding.type);
            const paramType = (declaredType?.type && declaredType.type !== "Array") ? declaredType.type : "any[]";
            return `${escapeVarName(a.name, e)}: ${paramType}`;
        }
        return `${escapeVarName(a.name, e)}: ${a.type}`;
    });

    const isRecursive = isFunctionRecursive(e, b, false);
    return [
        pxt.blocks.mkText(`function ${name} (${argsDeclaration.join(", ")})${isRecursive ? ": any" : ""}`),
        compileStatements(e, stmts)
    ];
}

function compileProcedure(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode[] {
    const name = escapeVarName(b.getFieldValue("NAME"), e, true);
    const stmts = getInputTargetBlock(e, b, "STACK");
    return [
        pxt.blocks.mkText("function " + name + "() "),
        compileStatements(e, stmts)
    ];
}

function compileProcedureCall(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    const name = escapeVarName(b.getFieldValue("NAME"), e, true);
    return pxt.blocks.mkStmt(pxt.blocks.mkText(name + "()"));
}

function compileFunctionCall(e: Environment, b: Blockly.Block, comments: string[], statement: boolean): pxt.blocks.JsNode {
    const name = escapeVarName(b.getField("function_name").getText(), e, true);
    const externalInputs = !b.getInputsInline();
    const args: pxt.blocks.BlockParameter[] = (b as CommonFunctionBlock).getArguments().map(a => {
        return {
            actualName: a.name,
            definitionName: a.id
        };
    });

    const compiledArgs = args.map(a => compileArgument(e, b, a, comments));
    const res = pxt.blocks.H.stdCall(name, compiledArgs, externalInputs)

    if (statement) {
        return pxt.blocks.mkStmt(res);
    }
    return res;
}

function compileReturnStatement(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    const expression = getInputTargetBlock(e, b, "RETURN_VALUE");

    const hasReturn = expression?.type !== "placeholder";

    const parentFunction = getContainingFunction(b);
    if (!parentFunction) {
        e.diagnostics.push({
            blockId: b.id,
            message: lf("Return statements can only be used within function bodies.")
        });
    }
    else if (hasReturn && parentFunction.type !== FUNCTION_DEFINITION_BLOCK_TYPE) {
        e.diagnostics.push({
            blockId: b.id,
            message: lf("Return statements can only return values inside function definitions.")
        });
    }


    if (hasReturn) {
        return pxt.blocks.mkStmt(pxt.blocks.mkText("return "), compileExpression(e, expression, comments));
    }
    else {
        return pxt.blocks.mkStmt(pxt.blocks.mkText("return"));
    }
}

function compileArgumentReporter(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    const name = escapeVarName(b.getFieldValue("VALUE"), e);
    return pxt.blocks.mkText(name);
}

function compileCall(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    const call = e.stdCallTable[b.type];
    if (call.imageLiteral)
        return pxt.blocks.mkStmt(compileImage(e, b, call.imageLiteral, call.imageLiteralColumns, call.imageLiteralRows, call.namespace, call.f, visibleParams(call, countOptionals(b, call)).map(ar => compileArgument(e, b, ar, comments))))
    else if (call.hasHandler)
        return compileEvent(e, b, call, eventArgs(call, b), call.namespace, comments)
    else
        return pxt.blocks.mkStmt(compileStdCall(e, b, call, comments))
}

function compileArgument(e: Environment, b: Blockly.Block, p: pxt.blocks.BlockParameter, comments: string[], beginningOfStatement = false): pxt.blocks.JsNode {
    let f = b.getFieldValue(p.definitionName);
    if (f != null) {
        const field = b.getField(p.definitionName);

        if (field instanceof Blockly.FieldTextInput || field instanceof FieldTextInput) {
            return pxt.blocks.H.mkStringLiteral(f);
        }
        else if (field instanceof FieldTilemap && !field.isGreyBlock) {
            const project = pxt.react.getTilemapProject();
            const tmString = field.getValue();

            if (tmString.startsWith("tilemap`")) {
                return pxt.blocks.mkText(tmString);
            }

            if (e.options.emitTilemapLiterals) {
                try {
                    const data = pxt.sprite.decodeTilemap(tmString, "typescript", project);
                    if (data) {
                        const [ name ] = project.createNewTilemapFromData(data);
                        return pxt.blocks.mkText(`tilemap\`${name}\``);
                    }
                }
                catch (e) {
                    // This is a legacy tilemap or a grey block, ignore the exception
                    // and compile as a normal field
                }
            }
        }

        // For some enums in pxt-minecraft, we emit the members as constants that are defined in
        // libs/core. For example, Blocks.GoldBlock is emitted as GOLD_BLOCK
        const type = e.blocksInfo.apis.byQName[p.type];
        if (type && type.attributes.emitAsConstant) {
            for (const symbolName of Object.keys(e.blocksInfo.apis.byQName)) {
                const symbol = e.blocksInfo.apis.byQName[symbolName];
                if (symbol && symbol.attributes && symbol.attributes.enumIdentity === f) {
                    return pxt.blocks.mkText(symbolName);
                }
            }
        }

        let text = pxt.blocks.mkText(f)
        text.canIndentInside = typeof f == "string" && f.indexOf('\n') >= 0;
        return text;
    }
    else {
        attachPlaceholderIf(e, b, p.definitionName);
        const target = getInputTargetBlock(e, b, p.definitionName);
        if (beginningOfStatement && target.type === "lists_create_with") {
            // We have to be careful of array literals at the beginning of a statement
            // because they can cause errors (i.e. they get parsed as an index). Add a
            // semicolon to the previous statement just in case.
            // FIXME: No need to do this if the previous statement was a code block
            return prefixWithSemicolon(compileExpression(e, target, comments));
        }

        if (p.shadowOptions && p.shadowOptions.toString && !isStringType(returnType(e, target))) {
            return pxt.blocks.H.mkSimpleCall("+", [pxt.blocks.H.mkStringLiteral(""), pxt.blocks.H.mkParenthesizedExpression(compileExpression(e, target, comments))]);
        }

        return compileExpression(e, target, comments)
    }
}

function compileStdCall(e: Environment, b: Blockly.Block, func: StdFunc, comments: string[]): pxt.blocks.JsNode {
    let args: pxt.blocks.JsNode[]
    if (isMutatingBlock(b) && b.mutation.getMutationType() === MutatorTypes.RestParameterMutator) {
        args = b.mutation.compileMutation(e, comments).children;
    }
    else if (func.attrs.shim === "ENUM_GET") {
        const enumName = func.attrs.enumName;
        const enumMember = b.getFieldValue("MEMBER").replace(/^\d+/, "");
        return pxt.blocks.H.mkPropertyAccess(enumMember, pxt.blocks.mkText(enumName));
    }
    else if (func.attrs.shim === "KIND_GET") {
        const info = e.kinds.filter(k => k.blockId === func.attrs.blockId)[0];
        return pxt.blocks.H.mkPropertyAccess(b.getFieldValue("MEMBER"), pxt.blocks.mkText(info.name));
    }
    else {
        args = visibleParams(func, countOptionals(b, func)).map((p, i) => compileArgument(e, b, p, comments, func.isExtensionMethod && i === 0 && !func.isExpression));
    }

    let callNamespace = func.namespace;
    let callName = func.f
    if (func.attrs.blockAliasFor) {
        const aliased = e.blocksInfo.apis.byQName[func.attrs.blockAliasFor];

        if (aliased) {
            callName = aliased.name;
            callNamespace = aliased.namespace;
        }
    }

    const externalInputs = !b.getInputsInline();
    if (func.isIdentity)
        return args[0];
    else if (func.property) {
        return pxt.blocks.H.mkPropertyAccess(callName, args[0]);
    } else if (callName == "@get@") {
        return pxt.blocks.H.mkPropertyAccess(args[1].op.replace(/.*\./, ""), args[0]);
    } else if (callName == "@set@") {
        return pxt.blocks.H.mkAssign(pxt.blocks.H.mkPropertyAccess(args[1].op.replace(/.*\./, "").replace(/@set/, ""), args[0]), args[2]);
    } else if (callName == "@change@") {
        return pxt.blocks.H.mkSimpleCall("+=", [pxt.blocks.H.mkPropertyAccess(args[1].op.replace(/.*\./, "").replace(/@set/, ""), args[0]), args[2]])
    } else if (func.isExtensionMethod) {
        if (func.attrs.defaultInstance) {
            let instance: pxt.blocks.JsNode;
            if (isMutatingBlock(b) && b.mutation.getMutationType() === MutatorTypes.DefaultInstanceMutator) {
                instance = b.mutation.compileMutation(e, comments);
            }

            if (instance) {
                args.unshift(instance);
            }
            else {
                args.unshift(pxt.blocks.mkText(func.attrs.defaultInstance));
            }
        }
        return pxt.blocks.H.extensionCall(callName, args, externalInputs);
    } else if (callNamespace) {
        return pxt.blocks.H.namespaceCall(callNamespace, callName, args, externalInputs);
    } else {
        return pxt.blocks.H.stdCall(callName, args, externalInputs);
    }
}

function compileWorkspaceComment(c: Blockly.comments.RenderedWorkspaceComment): pxt.blocks.JsNode {
    const content = c.getText();
    return pxt.blocks.H.mkMultiComment(content.trim());
}

function isLiteral(e: Environment, b: Blockly.Block) {
    return isNumericLiteral(e, b) || b.type === "logic_boolean" || b.type === "text";
}

function isNumericLiteral(e: Environment, b: Blockly.Block): boolean {
    if (!b) return false;

    if (b.type === "math_number" || b.type === "math_integer" || b.type === "math_number_minmax" || b.type === "math_whole_number") {
        return true;
    }

    const blockInfo = e.stdCallTable[b.type];
    if (!blockInfo) return false;

    const { comp } = blockInfo;

    if (blockInfo.attrs.shim === "TD_ID" && comp.parameters.length === 1) {
        const fieldValue = b.getFieldValue(comp.parameters[0].definitionName);

        if (fieldValue) {
            return !isNaN(parseInt(fieldValue))
        }
        else {
            return isNumericLiteral(e, getInputTargetBlock(e, b, comp.parameters[0].definitionName));
        }
    }

    return false;
}

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

function extractTsExpression(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    return pxt.blocks.mkText(b.getFieldValue("EXPRESSION").trim());
}

function compileNumber(e: Environment, b: Blockly.Block, comments: string[]): pxt.blocks.JsNode {
    return pxt.blocks.H.mkNumberLiteral(extractNumber(b));
}

function throwBlockError(msg: string, block: Blockly.Block) {
    let e = new Error(msg);
    (e as any).block = block;
    throw e;
}

function eventArgs(call: StdFunc, b: Blockly.Block): pxt.blocks.BlockParameter[] {
    return visibleParams(call, countOptionals(b, call)).filter(ar => !!ar.definitionName);
}

export function workerOpAsync(op: string, arg: pxtc.service.OpArg) {
    return pxt.worker.getWorker(pxt.webConfig.workerjs).opAsync(op, arg)
}